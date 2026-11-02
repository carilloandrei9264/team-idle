function dateToMillis(value) {
  if (value && typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }
  return null;
}

function hasConfirmedOverlap(bookings, requestedStart, requestedEnd) {
  const start = dateToMillis(requestedStart);
  const end = dateToMillis(requestedEnd);
  if (start === null || end === null || start >= end) return false;

  return bookings.some((booking) => {
    if (booking.status !== "Confirmed") return false;
    const bookingStart = dateToMillis(booking.startDate);
    const bookingEnd = dateToMillis(booking.endDate);
    return bookingStart !== null && bookingEnd !== null && bookingStart < end && bookingEnd > start;
  });
}

module.exports = { dateToMillis, hasConfirmedOverlap };