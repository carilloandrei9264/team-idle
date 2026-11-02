const DEFAULT_WEIGHTS = {
  booking: 0.4,
  rating: 0.4,
  fairness: 0.2,
};

const COMPARABLE_SIZE_TOLERANCE = 0.2;
const SELF_BOOKING_THRESHOLD = 3;
const SELF_BOOKING_WINDOW_DAYS = 30;

export const PRICE_FAIRNESS_LABELS = {
  ABOVE_MARKET: "Above market",
  AT_MARKET: "At market",
  BELOW_MARKET: "Below market",
  INSUFFICIENT_DATA: "Insufficient data",
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

export function calculatePriceFairness(listing = {}, comparableListings = []) {
  const listingPricePerSqm = pricePerSquareMeter(listing);
  if (!listingPricePerSqm) return emptyFairnessResult();

  const pricesPerSqm = comparableListings
    .filter((comparable) => comparable.city === listing.city && comparable.type === listing.type)
    .filter((comparable) => comparable !== listing)
    .filter((comparable) => {
      const comparableArea = Number(comparable.floorArea);
      const listingArea = Number(listing.floorArea);
      return comparableArea > 0 && Math.abs(comparableArea - listingArea) / listingArea <= COMPARABLE_SIZE_TOLERANCE;
    })
    .map(pricePerSquareMeter)
    .filter(Boolean)
    .sort((first, second) => first - second);

  if (!pricesPerSqm.length) return emptyFairnessResult();

  const median = pricesPerSqm[Math.floor(pricesPerSqm.length / 2)];
  const delta = (listingPricePerSqm - median) / median;
  if (delta > 0.15) return { score: 0.3, label: PRICE_FAIRNESS_LABELS.ABOVE_MARKET, delta, medianPricePerSqm: median };
  if (delta < -0.15) return { score: 1, label: PRICE_FAIRNESS_LABELS.BELOW_MARKET, delta, medianPricePerSqm: median };
  return { score: 0.8, label: PRICE_FAIRNESS_LABELS.AT_MARKET, delta, medianPricePerSqm: median };
}

export function detectSelfBookingPatterns(bookings = [], threshold = SELF_BOOKING_THRESHOLD, windowDays = SELF_BOOKING_WINDOW_DAYS) {
  const completed = bookings
    .filter((booking) => booking.status === "Completed" && booking.renterId && booking.ownerId)
    .map((booking) => ({ booking, date: toDate(booking.endDate || booking.createdAt) }))
    .filter((entry) => entry.date)
    .sort((first, second) => first.date - second.date);
  const groups = new Map();

  completed.forEach(({ booking, date }) => {
    const key = `${booking.renterId}:${booking.ownerId}`;
    const group = groups.get(key) || [];
    group.push({ booking, date });
    groups.set(key, group);
  });

  return [...groups.entries()]
    .map(([key, group]) => {
      let largestWindow = [];
      group.forEach((entry, index) => {
        const window = group.slice(index).filter(({ date }) => date - entry.date <= windowDays * 24 * 60 * 60 * 1000);
        if (window.length > largestWindow.length) largestWindow = window;
      });
      return { key, bookingIds: largestWindow.map(({ booking }) => booking.id).filter(Boolean), count: largestWindow.length };
    })
    .filter((pattern) => pattern.count >= threshold);
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

function pricePerSquareMeter(listing = {}) {
  const price = Number(listing.price);
  const floorArea = Number(listing.floorArea);
  return price > 0 && floorArea > 0 ? price / floorArea : 0;
}

function emptyFairnessResult() {
  return { score: 0, label: PRICE_FAIRNESS_LABELS.INSUFFICIENT_DATA, delta: null, medianPricePerSqm: null };
}

function clamp(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}
