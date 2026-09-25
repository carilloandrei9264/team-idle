import test from "node:test";
import assert from "node:assert/strict";
import { calculateBookingScore, calculatePriceFairness, calculateTrustScore, detectSelfBookingPatterns } from "./trustScore.js";

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

test("price fairness compares matching listings within the size band", () => {
  const listing = { city: "Pasig", type: "Condo", price: 30000, floorArea: 50 };
  const result = calculatePriceFairness(listing, [
    { city: "Pasig", type: "Condo", price: 20000, floorArea: 50 },
    { city: "Pasig", type: "Condo", price: 22000, floorArea: 55 },
    { city: "Pasig", type: "House", price: 10000, floorArea: 50 },
  ]);

  assert.equal(result.label, "Above market");
  assert.equal(result.score, 0.3);
  assert.equal(result.medianPricePerSqm, 400);
});

test("price fairness avoids inventing a label without comparable data", () => {
  const result = calculatePriceFairness({ city: "Cebu", type: "Room", price: 12000, floorArea: 20 }, []);
  assert.equal(result.label, "Insufficient data");
  assert.equal(result.score, 0);
  assert.equal(result.delta, null);
});

test("self-booking detection flags three completed bookings in thirty days", () => {
  const bookings = [1, 8, 29, 45].map((day, index) => ({
    id: `booking-${index}`,
    status: "Completed",
    renterId: "renter-1",
    ownerId: "owner-1",
    endDate: new Date(`2026-09-${String(day).padStart(2, "0")}T00:00:00Z`),
  }));

  const patterns = detectSelfBookingPatterns(bookings);
  assert.equal(patterns.length, 1);
  assert.equal(patterns[0].count, 3);
  assert.deepEqual(patterns[0].bookingIds, ["booking-0", "booking-1", "booking-2"]);
});