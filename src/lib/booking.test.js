import test from "node:test";
import assert from "node:assert/strict";
import { BOOKING_STATUSES, canTransitionBookingStatus, datesOverlap, hasConfirmedConflict, isValidDateRange } from "./booking.js";

test("booking status machine contains only the required MVP statuses", () => {
  assert.deepEqual(BOOKING_STATUSES, ["Pending", "Confirmed", "Completed", "Disputed"]);
  assert.equal(canTransitionBookingStatus("Pending", "Confirmed"), true);
  assert.equal(canTransitionBookingStatus("Pending", "Completed"), false);
  assert.equal(canTransitionBookingStatus("Confirmed", "Completed"), true);
  assert.equal(canTransitionBookingStatus("Confirmed", "Disputed"), true);
  assert.equal(canTransitionBookingStatus("Completed", "Disputed"), true);
  assert.equal(canTransitionBookingStatus("Disputed", "Confirmed"), false);
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

test("date ranges must end after they start", () => {
  assert.equal(isValidDateRange("2026-09-10", "2026-09-11"), true);
  assert.equal(isValidDateRange("2026-09-11", "2026-09-10"), false);
  assert.equal(isValidDateRange("", "2026-09-10"), false);
});
