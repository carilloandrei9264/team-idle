const DEFAULT_WEIGHTS = {
  booking: 0.4,
  rating: 0.4,
  fairness: 0.2,
};

/**
 * Returns a normalized trust score in the range 0..1.
 * Store this value in trustScores/{listingId}; the UI can display score * 5.
 */
export function calculateTrustScore({
  completedBookings = [],
  averageRating = 0,
  fairnessScore = 0,
  weights = DEFAULT_WEIGHTS,
}) {
  const bookingScore = calculateBookingScore(completedBookings);
  const ratingScore = clamp(Number(averageRating) / 5);
  const normalizedFairnessScore = clamp(fairnessScore);
  const totalWeight = weights.booking + weights.rating + weights.fairness;

  if (totalWeight <= 0) return 0;

  return clamp(
    (bookingScore * weights.booking
      + ratingScore * weights.rating
      + normalizedFairnessScore * weights.fairness) / totalWeight
  );
}

export function calculateBookingScore(completedBookings = []) {
  const weightedBookings = completedBookings.reduce((total, booking) => {
    const endDate = toDate(booking.endDate);
    if (!endDate) return total;

    const monthsAgo = (Date.now() - endDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    return total + (monthsAgo <= 6 ? 1 : 0.5);
  }, 0);

  // Five weighted completed bookings represents a full booking score.
  return clamp(weightedBookings / 5);
}

function toDate(value) {
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function clamp(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}
