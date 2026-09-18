import { Timestamp } from "firebase/firestore";

export function dateRangeIsValid(startDate, endDate) {
  return Boolean(startDate && endDate && endDate > startDate);
}

export function bookingDatesOverlap(booking, requestedStart, requestedEnd) {
  const existingStart = booking.startDate?.toDate?.() || new Date(booking.startDate);
  const existingEnd = booking.endDate?.toDate?.() || new Date(booking.endDate);
  return existingStart < requestedEnd && existingEnd > requestedStart;
}

export function dateInputToTimestamp(value) {
  return Timestamp.fromDate(new Date(`${value}T00:00:00`));
}

export function formatBookingDate(value) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date)
    : "Unknown date";
}

export function dateInputValue(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
