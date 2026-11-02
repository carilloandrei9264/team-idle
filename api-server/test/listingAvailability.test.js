import assert from "node:assert/strict";
import test from "node:test";
import { getListingAvailability } from "../lib/listingAvailability.js";

const now = Date.now();
const future = (days) => new Date(now + days * 24 * 60 * 60 * 1000);

function makeDb({ listing = { verificationStatus: "verified", listingPurpose: "rent" }, bookings = [], disputes = {} } = {}) {
  return {
    collection(name) {
      if (name === "listings") {
        return { doc: () => ({ get: async () => ({ exists: Boolean(listing), data: () => listing }) }) };
      }
      if (name === "bookings") {
        return {
          where() { return this; },
          get: async () => ({ docs: bookings.map((booking, index) => ({ id: `booking-${index}`, data: () => booking })) }),
        };
      }
      if (name === "disputes") {
        return {
          doc(id) {
            return { get: async () => ({ exists: Boolean(disputes[id]), data: () => disputes[id] }) };
          },
        };
      }
      throw new Error(`Unexpected collection: ${name}`);
    },
  };
}

test("availability returns only future blocking date ranges", async () => {
  const db = makeDb({
    bookings: [
      { status: "Confirmed", startDate: future(2), endDate: future(4), renterName: "Private" },
      { status: "Confirmed", startDate: future(-4), endDate: future(-2) },
      { status: "Disputed", disputeId: "completed-dispute", startDate: future(5), endDate: future(6) },
      { status: "Disputed", disputeId: "active-dispute", startDate: future(7), endDate: future(8) },
    ],
    disputes: {
      "completed-dispute": { priorStatus: "Completed" },
      "active-dispute": { priorStatus: "Confirmed" },
    },
  });

  const result = await getListingAvailability({ db, listingId: "listing-1" });

  assert.equal(result.blockedRanges.length, 2);
  assert.deepEqual(Object.keys(result.blockedRanges[0]), ["start", "end"]);
});

test("availability rejects missing and non-rental listings", async () => {
  await assert.rejects(
    getListingAvailability({ db: makeDb({ listing: null }), listingId: "listing-1" }),
    (error) => error.status === 404,
  );
  await assert.rejects(
    getListingAvailability({
      db: makeDb({ listing: { verificationStatus: "verified", listingPurpose: "sale" } }),
      listingId: "listing-1",
    }),
    (error) => error.status === 404,
  );
});
