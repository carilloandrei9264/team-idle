import { onSchedule } from "firebase-functions/v2/scheduler";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();
const WEIGHTS = { booking: 0.4, rating: 0.4, fairness: 0.2 };

export const recomputeTrustScores = onSchedule("every 24 hours", async () => {
  const [listingsSnapshot, bookingsSnapshot, ratingsSnapshot] = await Promise.all([
    db.collection("listings").where("verificationStatus", "==", "verified").get(),
    db.collection("bookings").where("status", "==", "Completed").get(),
    db.collection("ratings").get(),
  ]);

  const completedByListing = groupBy(bookingsSnapshot.docs.map((item) => item.data()), "listingId");
  const ratingsByListing = groupBy(ratingsSnapshot.docs.map((item) => item.data()), "listingId");
  const listings = listingsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  const batch = db.batch();

  listings.forEach((listing) => {
    const completedBookings = completedByListing[listing.id] || [];
    const ratings = ratingsByListing[listing.id] || [];
    const averageRating = ratings.length
      ? ratings.reduce((sum, rating) => sum + Number(rating.score || 0), 0) / ratings.length
      : 0;
    const fairness = calculateFairness(listing, listings);
    const bookingScore = clamp(completedBookings.reduce((sum, booking) => {
      const endDate = toDate(booking.endDate);
      if (!endDate) return sum;
      const monthsAgo = (Date.now() - endDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
      return sum + (monthsAgo <= 6 ? 1 : 0.5);
    }, 0) / 5);
    const ratingScore = clamp(averageRating / 5);
    const score = clamp(
      bookingScore * WEIGHTS.booking
        + ratingScore * WEIGHTS.rating
        + fairness.score * WEIGHTS.fairness
    );

    batch.set(db.collection("trustScores").doc(listing.id), {
      listingId: listing.id,
      score,
      completedBookingsCount: completedBookings.length,
      avgRating: averageRating,
      priceFairnessLabel: fairness.label,
      computedAt: new Date(),
    });
  });

  await batch.commit();
  console.log(`Recomputed ${listings.length} trust scores.`);
});

function calculateFairness(listing, listings) {
  const comparablePrices = listings
    .filter((candidate) => candidate.id !== listing.id
      && candidate.city === listing.city
      && candidate.type === listing.type
      && Number(candidate.floorArea) > 0
      && Number(listing.floorArea) > 0
      && Math.abs(Number(candidate.floorArea) - Number(listing.floorArea)) / Number(listing.floorArea) <= 0.2)
    .map((candidate) => Number(candidate.price) / Number(candidate.floorArea))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  if (!comparablePrices.length || Number(listing.price) <= 0 || Number(listing.floorArea) <= 0) {
    return { score: 0.5, label: "Not enough data" };
  }

  const median = comparablePrices[Math.floor(comparablePrices.length / 2)];
  const pricePerSqm = Number(listing.price) / Number(listing.floorArea);
  const delta = (pricePerSqm - median) / median;
  if (delta > 0.15) return { score: 0.3, label: "Above market" };
  if (delta < -0.15) return { score: 1, label: "Below market" };
  return { score: 0.8, label: "At market" };
}

function groupBy(items, key) {
  return items.reduce((groups, item) => {
    const value = item[key];
    if (value) groups[value] = [...(groups[value] || []), item];
    return groups;
  }, {});
}

function toDate(value) {
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

function clamp(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}
