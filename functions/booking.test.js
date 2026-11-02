const test = require("node:test");
const assert = require("node:assert/strict");
const { hasConfirmedOverlap } = require("./booking.js");

test("booking overlap uses half-open date intervals", () => {
  const bookings = [{ status: "Confirmed", startDate: "2026-10-10", endDate: "2026-10-15" }];

  assert.equal(hasConfirmedOverlap(bookings, "2026-10-15", "2026-10-20"), false);
  assert.equal(hasConfirmedOverlap(bookings, "2026-10-14", "2026-10-18"), true);
});

test("pending bookings do not block confirmation", () => {
  const bookings = [{ status: "Pending", startDate: "2026-10-10", endDate: "2026-10-15" }];

  assert.equal(hasConfirmedOverlap(bookings, "2026-10-12", "2026-10-14"), false);
});

test("overlap checks accept Firestore-like timestamp values", () => {
  const bookings = [{
    status: "Confirmed",
    startDate: { toMillis: () => Date.parse("2026-10-10") },
    endDate: { toMillis: () => Date.parse("2026-10-15") },
  }];

  assert.equal(hasConfirmedOverlap(bookings, new Date("2026-10-12"), new Date("2026-10-13")), true);
});