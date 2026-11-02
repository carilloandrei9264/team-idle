export const DISPUTE_STATUSES = ["Open", "Founded", "Dismissed"];

export function isDisputableBookingStatus(status) {
  return ["Confirmed", "Completed"].includes(status);
}

export function normalizeDisputeReason(reason) {
  return String(reason ?? "").trim();
}

export function isValidDisputeReason(reason) {
  return normalizeDisputeReason(reason).length >= 10;
}

export function hasOpenDisputeForBooking(disputes, bookingId) {
  return disputes.some((dispute) => (
    dispute.bookingId === bookingId
    && String(dispute.status || "Open").toLowerCase() === "open"
  ));
}
