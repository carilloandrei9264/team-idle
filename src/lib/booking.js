import { Timestamp } from "firebase/firestore";

export const BOOKING_STATUSES = ["Pending", "Confirmed", "Completed", "Disputed"];

export const PAYMENT_STATUSES = {
  awaiting_payment: "Awaiting payment",
  reference_submitted: "Reference submitted",
  payment_received: "Payment received",
};

export const BOOKING_TRANSITIONS = {
  Pending: ["Confirmed"],
  Confirmed: ["Completed", "Disputed"],
  Completed: ["Disputed"],
  Disputed: ["Confirmed", "Completed"],
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

export function hasRenterBookingConflict(bookings, requestedStart, requestedEnd) {
  return bookings.some((booking) => ["Pending", "Confirmed", "Disputed"].includes(booking.status)
    && datesOverlap(booking.startDate, booking.endDate, requestedStart, requestedEnd));
}

export function canRenterCompleteBooking(booking, now = new Date()) {
  if (booking?.status !== "Confirmed") return false;
  const checkout = toDate(booking.endDate);
  const currentTime = toDate(now);
  if (!checkout || !currentTime) return false;
  const legacyDateOnlyGrace = booking.bookingTimeZone === "Asia/Manila" ? 0 : 24 * 60 * 60 * 1000;
  return checkout.getTime() + legacyDateOnlyGrace <= currentTime.getTime();
}

export function isValidDateRange(startDate, endDate) {
  const start = toDate(startDate);
  const end = toDate(endDate);
  return Boolean(start && end && start < end);
}

export function canRevealExactAddress(status) {
  return ["Confirmed", "Completed", "Disputed"].includes(status);
}

export function getBookingReference(booking) {
  if (booking?.bookingReference) return booking.bookingReference;
  const sourceId = booking?.id || booking?.bookingId || booking?.referenceId;
  if (!sourceId) return "BK-N/A";
  const suffix = String(sourceId).replace(/[^A-Za-z0-9]/g, "").slice(-6).toUpperCase() || "000000";
  return `BK-${suffix.padEnd(6, "0")}`;
}

export function getPaymentStatus(booking) {
  if (booking?.paymentStatus) return booking.paymentStatus;
  if (booking?.depositReference) return "reference_submitted";
  return "awaiting_payment";
}

export function getPaymentStatusLabel(booking) {
  return PAYMENT_STATUSES[getPaymentStatus(booking)] || PAYMENT_STATUSES.awaiting_payment;
}

export function getCompletionState(booking) {
  if (booking?.status !== "Completed") return "not_ready";
  if (booking?.ownerConfirmedCompletion || booking?.completionConfirmedAt) return "confirmed";
  return "awaiting_owner_confirmation";
}

export function getCompletionStateLabel(booking) {
  switch (getCompletionState(booking)) {
    case "confirmed":
      return "Completed and confirmed";
    case "awaiting_owner_confirmation":
      return "Awaiting owner confirmation";
    default:
      return "Not ready to complete";
  }
}

export function bookingConfirmationErrorMessage(error) {
  if (["functions/internal", "functions/not-found", "functions/unavailable", "functions/network-request-failed"].includes(error?.code)) {
    return "The booking confirmation service is unavailable. Refresh to check the request status, then try again or contact support.";
  }
  return error?.message || "The booking request could not be updated. Please try again.";
}

export function dateInputToTimestamp(value) {
  return Timestamp.fromDate(new Date(`${value}T00:00:00`));
}

export function dateTimeInputToTimestamp(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || "")) || !/^\d{2}:\d{2}$/.test(String(time || ""))) return null;
  const parsed = new Date(`${date}T${time}:00+08:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return Timestamp.fromDate(parsed);
}

export function formatBookingDate(value) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date)
    : "Unknown date";
}

export function formatBookingDateTime(value) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Manila",
    }).format(date)
    : "Unknown date";
}

export function dateInputValue(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
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
