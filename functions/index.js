const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();
setGlobalOptions({ region: "asia-southeast1", maxInstances: 1 });
const db = getFirestore();

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
