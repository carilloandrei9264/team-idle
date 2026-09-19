import test from "node:test";
import assert from "node:assert/strict";

import {
  hasOpenDisputeForBooking,
  isDisputableBookingStatus,
  isValidDisputeReason,
  normalizeDisputeReason,
} from "./dispute.js";

test("only confirmed and completed bookings can be disputed", () => {
  assert.equal(isDisputableBookingStatus("Confirmed"), true);
  assert.equal(isDisputableBookingStatus("Completed"), true);
  assert.equal(isDisputableBookingStatus("Pending"), false);
  assert.equal(isDisputableBookingStatus("Cancelled"), false);
});

test("dispute reasons are normalized and require meaningful detail", () => {
  assert.equal(normalizeDisputeReason("  Property was not available.  "), "Property was not available.");
  assert.equal(isValidDisputeReason("too short"), false);
  assert.equal(isValidDisputeReason("The property was unavailable."), true);
});

test("an open dispute blocks another dispute for the same booking", () => {
  assert.equal(hasOpenDisputeForBooking([{ bookingId: "booking-1", status: "Open" }], "booking-1"), true);
  assert.equal(hasOpenDisputeForBooking([{ bookingId: "booking-1", status: "Dismissed" }], "booking-1"), false);
  assert.equal(hasOpenDisputeForBooking([], "booking-1"), false);
});
