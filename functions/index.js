const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { dateToMillis, hasConfirmedOverlap } = require("./booking");

initializeApp();
setGlobalOptions({ region: "asia-southeast1", maxInstances: 1 });
const db = getFirestore();

exports.confirmBooking = onCall({ region: "asia-southeast1" }, async (request) => {
  const ownerId = request.auth?.uid;
  const bookingId = request.data?.bookingId;
  if (!ownerId) throw new HttpsError("unauthenticated", "Sign in to confirm a booking.");
  if (typeof bookingId !== "string" || !bookingId) {
    throw new HttpsError("invalid-argument", "A booking ID is required.");
  }

  const bookingRef = db.collection("bookings").doc(bookingId);
  const userRef = db.collection("users").doc(ownerId);

  await db.runTransaction(async (transaction) => {
    const [userSnapshot, bookingSnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(bookingRef),
    ]);
    if (!userSnapshot.exists || userSnapshot.data().status !== "active") {
      throw new HttpsError("permission-denied", "Only active accounts can confirm bookings.");
    }
    if (!bookingSnapshot.exists) throw new HttpsError("not-found", "This booking request no longer exists.");

    const booking = bookingSnapshot.data();
    if (booking.ownerId !== ownerId) throw new HttpsError("permission-denied", "You can only confirm requests for your listings.");
    if (booking.status !== "Pending") throw new HttpsError("failed-precondition", "This booking request is no longer pending.");

    const startMillis = dateToMillis(booking.startDate);
    const endMillis = dateToMillis(booking.endDate);
    if (startMillis === null || endMillis === null || startMillis >= endMillis) {
      throw new HttpsError("failed-precondition", "This booking request has an invalid date range.");
    }

    const listingRef = db.collection("listings").doc(booking.listingId);
    const privateListingRef = db.collection("listingPrivate").doc(booking.listingId);
    const lockRef = db.collection("bookingConfirmationLocks").doc(booking.listingId);
    const confirmedBookingsQuery = db.collection("bookings")
      .where("listingId", "==", booking.listingId)
      .where("status", "==", "Confirmed");
    const [listingSnapshot, privateSnapshot, lockSnapshot, confirmedSnapshot] = await Promise.all([
      transaction.get(listingRef),
      transaction.get(privateListingRef),
      transaction.get(lockRef),
      transaction.get(confirmedBookingsQuery),
    ]);

    if (!listingSnapshot.exists
      || listingSnapshot.data().verificationStatus !== "verified"
      || listingSnapshot.data().ownerId !== ownerId
      || listingSnapshot.data().listingPurpose === "sale") {
      throw new HttpsError("failed-precondition", "This listing is no longer available for booking.");
    }
    if (!privateSnapshot.exists
      || privateSnapshot.data().ownerId !== ownerId
      || typeof privateSnapshot.data().address !== "string"
      || !privateSnapshot.data().address.trim()) {
      throw new HttpsError("failed-precondition", "The private listing address is unavailable.");
    }

    const existingBookings = confirmedSnapshot.docs
      .filter((item) => item.id !== bookingId)
      .map((item) => item.data());
    if (hasConfirmedOverlap(existingBookings, booking.startDate, booking.endDate)) {
      throw new HttpsError("failed-precondition", "This request overlaps an existing confirmed booking.");
    }

    transaction.set(lockRef, {
      version: Number(lockSnapshot.data()?.version || 0) + 1,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.update(bookingRef, {
      status: "Confirmed",
      address: privateSnapshot.data().address,
      confirmedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return { bookingId, status: "Confirmed" };
});

exports.completeExpiredBookings = onSchedule("every day 01:00", async () => {
  const snapshot = await db.collection("bookings")
    .where("status", "==", "Confirmed")
    .where("endDate", "<", new Date())
    .get();

  if (snapshot.empty) return null;
  const batch = db.batch();
  snapshot.docs.forEach((booking) => {
    batch.update(booking.ref, {
      status: "Completed",
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();
  return null;
});

exports.recomputeTrustScores = onSchedule("every day 02:00", async () => {
  const listings = await db.collection("listings")
    .where("verificationStatus", "==", "verified")
    .get();

  for (const listing of listings.docs) {
    const data = listing.data();
    if (data.listingPurpose === "sale") continue;
    const [completed, ratings, comparable] = await Promise.all([
      db.collection("bookings").where("listingId", "==", listing.id).where("status", "==", "Completed").get(),
      db.collection("ratings").where("listingId", "==", listing.id).get(),
      db.collection("listings")
        .where("city", "==", data.city)
        .where("type", "==", data.type)
        .where("verificationStatus", "==", "verified")
        .get(),
    ]);

    const bookingPoints = completed.docs.reduce((total, item) => {
      const endDate = item.data().endDate?.toDate?.();
      if (!endDate) return total;
      const monthsAgo = (Date.now() - endDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
      return total + (monthsAgo <= 6 ? 1 : 0.5);
    }, 0);
    const bookingScore = Math.min(1, bookingPoints / 5);
    const values = ratings.docs.map((item) => Number(item.data().score)).filter((score) => score >= 1 && score <= 5);
    const averageRating = values.length ? values.reduce((total, score) => total + score, 0) / values.length : 0;
    const ratingScore = averageRating / 5;
    const floorArea = Number(data.floorArea);
    const price = Number(data.price);
    const comparablePrices = comparable.docs
      .map((item) => item.data())
      .filter((item) => item.listingPurpose !== "sale")
      .filter((item) => (item.pricePeriod || "month") === (data.pricePeriod || "month"))
      .filter((item) => floorArea > 0 && Number(item.floorArea) > 0)
      .filter((item) => Math.abs(Number(item.floorArea) - floorArea) / floorArea <= 0.2)
      .map((item) => Number(item.price) / Number(item.floorArea))
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
    const median = comparablePrices.length ? comparablePrices[Math.floor(comparablePrices.length / 2)] : null;
    const pricePerSqm = floorArea > 0 ? price / floorArea : null;
    const delta = median && Number.isFinite(pricePerSqm) ? (pricePerSqm - median) / median : 0;
    const fairnessScore = median == null ? 0.5 : delta > 0.15 ? 0.3 : delta < -0.15 ? 1 : 0.8;

    await db.collection("trustScores").doc(listing.id).set({
      listingId: listing.id,
      score: (bookingScore * 0.4) + (ratingScore * 0.4) + (fairnessScore * 0.2),
      completedBookingsCount: completed.size,
      averageRating,
      fairnessScore,
      priceFairnessLabel: median == null ? "Not enough data" : delta > 0.15 ? "Above market" : delta < -0.15 ? "Below market" : "At market",
      computedAt: FieldValue.serverTimestamp(),
    });
  }
  return null;
});
