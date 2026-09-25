import { Timestamp } from "firebase/firestore";

export const BOOKING_STATUSES = ["Pending", "Confirmed", "Completed", "Disputed"];

export const BOOKING_TRANSITIONS = {
  Pending: ["Confirmed"],
  Confirmed: ["Completed", "Disputed"],
  Completed: ["Disputed"],
  Disputed: [],
};

export function canTransitionBookingStatus(currentStatus, nextStatus) {
  return BOOKING_TRANSITIONS[currentStatus]?.includes(nextStatus) || false;
}

export function dateRangeIsValid(startDate, endDate) {
  return Boolean(startDate && endDate && endDate > startDate);
}

export function bookingDatesOverlap(booking, requestedStart, requestedEnd) {
  const existingStart = booking.startDate?.toDate?.() || new Date(booking.startDate);
  const existingEnd = booking.endDate?.toDate?.() || new Date(booking.endDate);
  return existingStart < requestedEnd && existingEnd > requestedStart;
}

export function datesOverlap(startDate, endDate, requestedStart, requestedEnd) {
  const existingStart = toDate(startDate);
  const existingEnd = toDate(endDate);
  const nextStart = toDate(requestedStart);
  const nextEnd = toDate(requestedEnd);
  if (!existingStart || !existingEnd || !nextStart || !nextEnd) return false;
  return existingStart < nextEnd && existingEnd > nextStart;
}

export function hasConfirmedConflict(bookings, requestedStart, requestedEnd) {
  return bookings.some((booking) => booking.status === "Confirmed"
    && datesOverlap(booking.startDate, booking.endDate, requestedStart, requestedEnd));
}

export function isValidDateRange(startDate, endDate) {
  const start = toDate(startDate);
  const end = toDate(endDate);
  return Boolean(start && end && start < end);
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

export function toDate(value) {
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}
