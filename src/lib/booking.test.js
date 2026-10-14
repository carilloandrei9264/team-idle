import test from "node:test";
import assert from "node:assert/strict";
import { BOOKING_STATUSES, bookingConfirmationErrorMessage, canRevealExactAddress, canRenterCompleteBooking, canTransitionBookingStatus, dateTimeInputToTimestamp, datesOverlap, getBookingReference, getCompletionState, getCompletionStateLabel, getPaymentStatus, getPaymentStatusLabel, hasConfirmedConflict, hasRenterBookingConflict, isValidDateRange } from "./booking.js";

test("booking status machine contains only the required MVP statuses", () => {
  assert.deepEqual(BOOKING_STATUSES, ["Pending", "Confirmed", "Completed", "Disputed"]);
  assert.equal(canTransitionBookingStatus("Pending", "Confirmed"), true);
  assert.equal(canTransitionBookingStatus("Pending", "Completed"), false);
  assert.equal(canTransitionBookingStatus("Confirmed", "Completed"), true);
  assert.equal(canTransitionBookingStatus("Confirmed", "Disputed"), true);
  assert.equal(canTransitionBookingStatus("Completed", "Disputed"), true);
  assert.equal(canTransitionBookingStatus("Disputed", "Confirmed"), true);
  assert.equal(canTransitionBookingStatus("Disputed", "Completed"), true);
  assert.equal(canTransitionBookingStatus("Disputed", "Pending"), false);
});

test("overlap uses half-open date intervals", () => {
  assert.equal(datesOverlap("2026-09-01", "2026-09-05", "2026-09-05", "2026-09-08"), false);
  assert.equal(datesOverlap("2026-09-01", "2026-09-05", "2026-09-04", "2026-09-08"), true);
});

test("only confirmed bookings block a request", () => {
  const bookings = [
    { status: "Pending", startDate: "2026-09-01", endDate: "2026-09-05" },
    { status: "Confirmed", startDate: "2026-09-10", endDate: "2026-09-15" },
  ];

  assert.equal(hasConfirmedConflict(bookings, "2026-09-02", "2026-09-04"), false);
  assert.equal(hasConfirmedConflict(bookings, "2026-09-12", "2026-09-14"), true);
});

test("exact address sharing is only available after confirmation", () => {
  assert.equal(canRevealExactAddress("Pending"), false);
  assert.equal(canRevealExactAddress("Confirmed"), true);
  assert.equal(canRevealExactAddress("Completed"), true);
  assert.equal(canRevealExactAddress("Disputed"), true);
});

test("callable internal errors explain that confirmation service is unavailable", () => {
  assert.match(bookingConfirmationErrorMessage({ code: "functions/internal" }), /service is unavailable/i);
  assert.match(bookingConfirmationErrorMessage({ code: "functions/not-found" }), /refresh to check/i);
  assert.equal(bookingConfirmationErrorMessage({ message: "This request overlaps an existing confirmed booking." }), "This request overlaps an existing confirmed booking.");
});

test("date ranges must end after they start", () => {
  assert.equal(isValidDateRange("2026-09-10", "2026-09-11"), true);
  assert.equal(isValidDateRange("2026-09-11", "2026-09-10"), false);
  assert.equal(isValidDateRange("", "2026-09-10"), false);
});

test("booking date and time inputs are stored as Philippine time", () => {
  assert.equal(dateTimeInputToTimestamp("2026-10-20", "15:30").toDate().toISOString(), "2026-10-20T07:30:00.000Z");
  assert.equal(dateTimeInputToTimestamp("2026-10-20", ""), null);
});

test("overlapping active bookings for the same renter and listing are blocked", () => {
  const existing = [
    { status: "Pending", startDate: "2026-10-20T07:00:00Z", endDate: "2026-10-22T03:00:00Z" },
    { status: "Completed", startDate: "2026-10-25T07:00:00Z", endDate: "2026-10-27T03:00:00Z" },
  ];

  assert.equal(hasRenterBookingConflict(existing, "2026-10-21T01:00:00Z", "2026-10-23T03:00:00Z"), true);
  assert.equal(hasRenterBookingConflict(existing, "2026-10-22T03:00:00Z", "2026-10-24T03:00:00Z"), false);
  assert.equal(hasRenterBookingConflict(existing, "2026-10-25T07:00:00Z", "2026-10-26T07:00:00Z"), false);
});

test("renter completion is available only after checkout for confirmed bookings", () => {
  const now = new Date("2026-10-12T12:00:00Z");
  assert.equal(canRenterCompleteBooking({ status: "Confirmed", bookingTimeZone: "Asia/Manila", endDate: "2026-10-12T13:00:00Z" }, now), false);
  assert.equal(canRenterCompleteBooking({ status: "Confirmed", bookingTimeZone: "Asia/Manila", endDate: "2026-10-12T11:59:00Z" }, now), true);
  assert.equal(canRenterCompleteBooking({ status: "Pending", endDate: "2026-10-01T00:00:00Z" }, now), false);
  assert.equal(canRenterCompleteBooking({ status: "Confirmed", endDate: "2026-10-12T00:00:00Z" }, now), false);
  assert.equal(canRenterCompleteBooking({ status: "Confirmed", endDate: "2026-10-12T00:00:00Z" }, new Date("2026-10-13T00:00:00Z")), true);
});

test("booking references are stable and human-readable for payment tracking", () => {
  assert.equal(getBookingReference({ id: "booking-123456" }), "BK-123456");
  assert.equal(getBookingReference({ bookingReference: "BK-ABCD12" }), "BK-ABCD12");
  assert.equal(getBookingReference({ id: "abc" }), "BK-ABC000");
});

test("payment status falls back to a clear, trackable state", () => {
  assert.equal(getPaymentStatus({}), "awaiting_payment");
  assert.equal(getPaymentStatus({ depositReference: "GCASH-123" }), "reference_submitted");
  assert.equal(getPaymentStatusLabel({ paymentStatus: "payment_received" }), "Payment received");
});

test("completed stays keep an explicit owner-confirmation review state", () => {
  assert.equal(getCompletionState({ status: "Confirmed" }), "not_ready");
  assert.equal(getCompletionState({ status: "Completed" }), "awaiting_owner_confirmation");
  assert.equal(getCompletionState({ status: "Completed", ownerConfirmedCompletion: true }), "confirmed");
  assert.equal(getCompletionStateLabel({ status: "Completed" }), "Awaiting owner confirmation");
  assert.equal(getCompletionStateLabel({ status: "Completed", completionConfirmedAt: "2026-10-20T11:00:00Z" }), "Completed and confirmed");
});
