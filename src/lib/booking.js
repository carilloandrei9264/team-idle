export const BOOKING_STATUSES = ["Pending", "Confirmed", "Completed", "Disputed", "Cancelled"];

export function datesOverlap(startDate, endDate, requestedStart, requestedEnd) {
  const existingStart = toDate(startDate);
  const existingEnd = toDate(endDate);
  const nextStart = toDate(requestedStart);
  const nextEnd = toDate(requestedEnd);

  if (!existingStart || !existingEnd || !nextStart || !nextEnd) return false;
  return existingStart < nextEnd && existingEnd > nextStart;
}

export function hasConfirmedConflict(bookings, requestedStart, requestedEnd) {
  return bookings.some((booking) => (
    booking.status === "Confirmed"
      && datesOverlap(booking.startDate, booking.endDate, requestedStart, requestedEnd)
  ));
}

export function isValidDateRange(startDate, endDate) {
  const start = toDate(startDate);
  const end = toDate(endDate);
  return Boolean(start && end && start < end);
}

export function toDate(value) {
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}
