import { HttpError } from "./errors.js";

const BOOKING_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function dateToMillis(value) {
  if (value && typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }
  return null;
}

export function hasBlockingOverlap(bookings, requestedStart, requestedEnd, disputedPriorStatus = new Map()) {
  const start = dateToMillis(requestedStart);
  const end = dateToMillis(requestedEnd);
  if (start === null || end === null || start >= end) return false;

  return bookings.some((booking) => {
    const blocksDates = booking.status === "Confirmed"
      || (booking.status === "Disputed" && disputedPriorStatus.get(booking.id) !== "Completed");
    if (!blocksDates) return false;
    const bookingStart = dateToMillis(booking.startDate);
    const bookingEnd = dateToMillis(booking.endDate);
    return bookingStart !== null && bookingEnd !== null && bookingStart < end && bookingEnd > start;
  });
}

export async function confirmBooking({ db, FieldValue, bookingId, uid }) {
  if (typeof bookingId !== "string" || !BOOKING_ID_PATTERN.test(bookingId)) {
    throw new HttpError(422, "INVALID_BOOKING_ID", "A valid booking ID is required.");
  }

  const bookingRef = db.collection("bookings").doc(bookingId);
  const result = await db.runTransaction(async (transaction) => {
    const bookingSnapshot = await transaction.get(bookingRef);
    if (!bookingSnapshot.exists) throw new HttpError(404, "NOT_FOUND", "Booking not found.");

    const booking = bookingSnapshot.data();
    if (booking.ownerId !== uid) throw new HttpError(403, "NOT_OWNER", "Only the listing owner can confirm this booking.");
    if (booking.status === "Confirmed") return { bookingId, status: "Confirmed", idempotent: true };
    if (booking.status !== "Pending") throw new HttpError(409, "NOT_PENDING", "This booking is no longer pending.");

    const startMillis = dateToMillis(booking.startDate);
    const endMillis = dateToMillis(booking.endDate);
    if (startMillis === null || endMillis === null || startMillis >= endMillis) {
      throw new HttpError(409, "INVALID_DATE_RANGE", "This booking has an invalid date range.");
    }

    const listingRef = db.collection("listings").doc(booking.listingId);
    const privateListingRef = db.collection("listingPrivate").doc(booking.listingId);
    const lockRef = db.collection("bookingConfirmationLocks").doc(booking.listingId);
    const competingBookingsQuery = db.collection("bookings")
      .where("listingId", "==", booking.listingId)
      .where("status", "in", ["Confirmed", "Disputed"]);
    const [listingSnapshot, privateSnapshot, lockSnapshot, competingBookingsSnapshot] = await Promise.all([
      transaction.get(listingRef),
      transaction.get(privateListingRef),
      transaction.get(lockRef),
      transaction.get(competingBookingsQuery),
    ]);

    const listing = listingSnapshot.data();
    const purpose = listing?.purpose ?? listing?.listingPurpose ?? "rent";
    if (!listingSnapshot.exists
      || listing.verificationStatus !== "verified"
      || listing.ownerId !== uid
      || purpose !== "rent") {
      throw new HttpError(409, "LISTING_UNAVAILABLE", "This listing is no longer available for booking.");
    }

    const privateListing = privateSnapshot.data();
    if (!privateSnapshot.exists
      || privateListing.ownerId !== uid
      || typeof privateListing.address !== "string"
      || !privateListing.address.trim()) {
      throw new HttpError(409, "ADDRESS_UNAVAILABLE", "The private listing address is unavailable.");
    }

    const competingBookings = competingBookingsSnapshot.docs
      .filter((snapshot) => snapshot.id !== bookingId)
      .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));
    const disputedBookings = competingBookings.filter((item) => item.status === "Disputed" && item.disputeId);
    const disputedPriorStatusEntries = await Promise.all(disputedBookings.map(async (item) => {
      const disputeSnapshot = await transaction.get(db.collection("disputes").doc(item.disputeId));
      return [item.id, disputeSnapshot.exists ? disputeSnapshot.data().priorStatus : null];
    }));
    const disputedPriorStatus = new Map(disputedPriorStatusEntries);

    if (hasBlockingOverlap(competingBookings, booking.startDate, booking.endDate, disputedPriorStatus)) {
      throw new HttpError(409, "BOOKING_OVERLAP", "These dates are already confirmed for another renter.");
    }

    const now = FieldValue.serverTimestamp();
    transaction.update(bookingRef, {
      status: "Confirmed",
      address: privateListing.address,
      confirmedAt: now,
      confirmedBy: uid,
      updatedAt: now,
    });
    transaction.set(lockRef, {
      version: Number(lockSnapshot.data()?.version || 0) + 1,
      updatedAt: now,
    }, { merge: true });
    return {
      bookingId,
      status: "Confirmed",
      idempotent: false,
      notification: {
        recipientId: booking.renterId,
        createdBy: uid,
        type: "booking_update",
        title: "Booking request confirmed",
        message: `${booking.listingTitle || "Your booking"} has been confirmed by the owner.`,
        link: "/my-activity?tab=bookings",
        entityId: bookingId,
        entityType: "booking",
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      },
    };
  });

  if (result.notification) {
    try {
      await db.collection("notifications").doc(`booking-confirmed-${bookingId}`).create(result.notification);
    } catch {
      // Notification delivery must not roll back a successful confirmation.
    }
    delete result.notification;
  }

  return result;
}