import { HttpError } from "./errors.js";
import { dateToMillis } from "./bookings.js";

const LISTING_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export async function getListingAvailability({ db, listingId }) {
  if (typeof listingId !== "string" || !LISTING_ID_PATTERN.test(listingId)) {
    throw new HttpError(422, "INVALID_LISTING_ID", "A valid listing ID is required.");
  }

  const listingSnapshot = await db.collection("listings").doc(listingId).get();
  const listing = listingSnapshot.data();
  const purpose = listing?.purpose ?? listing?.listingPurpose ?? "rent";
  if (!listingSnapshot.exists || listing.verificationStatus !== "verified" || purpose !== "rent") {
    throw new HttpError(404, "NOT_FOUND", "This listing is not available for booking.");
  }

  const bookingsSnapshot = await db.collection("bookings")
    .where("listingId", "==", listingId)
    .where("status", "in", ["Confirmed", "Disputed"])
    .get();
  const bookings = bookingsSnapshot.docs.map((snapshot) => ({
    id: snapshot.id,
    ...snapshot.data(),
  }));
  const disputedBookings = bookings.filter((booking) => booking.status === "Disputed" && booking.disputeId);
  const disputedPriorStatusEntries = await Promise.all(disputedBookings.map(async (booking) => {
    const disputeSnapshot = await db.collection("disputes").doc(booking.disputeId).get();
    return [booking.id, disputeSnapshot.exists ? disputeSnapshot.data().priorStatus : null];
  }));
  const disputedPriorStatus = new Map(disputedPriorStatusEntries);
  const now = Date.now();

  return {
    blockedRanges: bookings.flatMap((booking) => {
      const blocksDates = booking.status === "Confirmed"
        || (booking.status === "Disputed" && disputedPriorStatus.get(booking.id) !== "Completed");
      const start = dateToMillis(booking.startDate);
      const end = dateToMillis(booking.endDate);
      if (!blocksDates || start === null || end === null || start >= end || end <= now) return [];
      return [{ start: new Date(start).toISOString(), end: new Date(end).toISOString() }];
    }),
  };
}
