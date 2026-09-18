import test from "node:test";
import assert from "node:assert/strict";
import { calculateBookingScore, calculateTrustScore } from "./trustScore.js";

test("trust score stays normalized and uses the documented weights", () => {
  const score = calculateTrustScore({
    completedBookings: [{ endDate: new Date() }],
    averageRating: 5,
    fairnessScore: 1,
  });

  assert.equal(score, 0.68);
  assert.ok(score >= 0 && score <= 1);
});

test("recent completed bookings contribute more than older bookings", () => {
  const recent = calculateBookingScore([{ endDate: new Date() }]);
  const old = calculateBookingScore([{ endDate: new Date(Date.now() - 7 * 30 * 24 * 60 * 60 * 1000) }]);

  assert.equal(recent, 0.2);
  assert.equal(old, 0.1);
});

test("invalid or empty score inputs resolve to zero", () => {
  assert.equal(calculateTrustScore({}), 0);
  assert.equal(calculateBookingScore([{ endDate: "not-a-date" }]), 0);
});