import assert from "node:assert/strict";
import test from "node:test";
import { handleConfirmBooking } from "../lib/confirmBookingRoute.js";

function deps(role) {
  return {
    adminAuth: { verifyIdToken: async () => ({ uid: "owner-1" }) },
    db: {
      collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => ({ role, status: "active" }) }) }) }),
    },
  };
}

test("admin accounts cannot invoke owner booking confirmation", async () => {
  await assert.rejects(
    handleConfirmBooking({ headers: { authorization: "Bearer token" }, query: { id: "booking-1" } }, deps("admin")),
    (error) => error.status === 403 && error.code === "FORBIDDEN",
  );
});