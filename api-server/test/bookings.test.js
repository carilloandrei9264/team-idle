import assert from "node:assert/strict";
import test from "node:test";
import { confirmBooking, hasBlockingOverlap } from "../lib/bookings.js";

const ownerId = "owner-1";
const listingId = "listing-1";

function makeDb(seed = {}, { failNotification = false } = {}) {
  const records = structuredClone(seed);
  const writes = [];
  let generatedId = 0;

  function documentRef(collection, id) {
    return {
      collection,
      id,
      path: `${collection}/${id}`,
      async create(data) {
        if (failNotification && collection === "notifications") throw new Error("notification unavailable");
        writes.push({ operation: "create", ref: this, data });
      },
    };
  }

  function queryRef(collection, filters = []) {
    return {
      kind: "query",
      collection,
      filters,
      where(field, operator, value) {
        return queryRef(collection, [...filters, [field, operator, value]]);
      },
    };
  }

  function collectionRef(name) {
    return {
      doc(id = `generated-${++generatedId}`) {
        return documentRef(name, id);
      },
      where(field, operator, value) {
        return queryRef(name, [[field, operator, value]]);
      },
    };
  }

  const db = {
    collection: collectionRef,
    runTransaction(callback) {
      const transaction = {
        async get(ref) {
          if (ref.kind === "query") {
            const rows = Object.entries(records[ref.collection] || {})
              .filter(([, item]) => ref.filters.every(([field, operator, value]) => (
                operator === "==" ? item[field] === value : value.includes(item[field])
              )))
              .map(([id, item]) => ({ id, exists: true, data: () => item }));
            return { docs: rows };
          }
          const item = records[ref.collection]?.[ref.id];
          return { id: ref.id, exists: Boolean(item), data: () => item };
        },
        update(ref, data) { writes.push({ operation: "update", ref, data }); },
        set(ref, data, options) { writes.push({ operation: "set", ref, data, options }); },
        create(ref, data) { writes.push({ operation: "create", ref, data }); },
      };
      return callback(transaction);
    },
  };

  return { db, writes, records };
}

function validSeed(booking = {}) {
  return {
    bookings: {
      request: {
        listingId,
        ownerId,
        renterId: "renter-1",
        listingTitle: "Makati studio",
        startDate: "2026-10-10",
        endDate: "2026-10-15",
        status: "Pending",
        ...booking,
      },
    },
    listings: {
      [listingId]: { ownerId, verificationStatus: "verified", purpose: "rent" },
    },
    listingPrivate: {
      [listingId]: { ownerId, address: "Private address" },
    },
    bookingConfirmationLocks: {},
    notifications: {},
  };
}

const FieldValue = { serverTimestamp: () => "server-time" };

test("date ranges are half-open and pending requests do not block", () => {
  const existing = [{ status: "Confirmed", startDate: "2026-10-10", endDate: "2026-10-15" }];
  assert.equal(hasBlockingOverlap(existing, "2026-10-15", "2026-10-20"), false);
  assert.equal(hasBlockingOverlap(existing, "2026-10-14", "2026-10-18"), true);
  assert.equal(hasBlockingOverlap([{ ...existing[0], status: "Pending" }], "2026-10-12", "2026-10-14"), false);
});

test("disputed bookings block unless their prior status was Completed", () => {
  const disputed = [{ id: "confirmed-dispute", status: "Disputed", startDate: "2026-10-10", endDate: "2026-10-15" }];
  assert.equal(hasBlockingOverlap(disputed, "2026-10-12", "2026-10-13"), true);
  assert.equal(hasBlockingOverlap(disputed, "2026-10-12", "2026-10-13", new Map([["confirmed-dispute", "Confirmed"]])), true);
  assert.equal(hasBlockingOverlap(disputed, "2026-10-12", "2026-10-13", new Map([["confirmed-dispute", "Completed"]])), false);
  assert.equal(hasBlockingOverlap(disputed, "2026-10-12", "2026-10-13", new Map()), true);
});

test("confirmation rejects an owner mismatch before writes", async () => {
  const { db, writes } = makeDb(validSeed());
  await assert.rejects(
    confirmBooking({ db, FieldValue, bookingId: "request", uid: "other-owner" }),
    (error) => error.status === 403 && error.code === "NOT_OWNER",
  );
  assert.equal(writes.length, 0);
});

test("confirmation is idempotent for an already confirmed owner request", async () => {
  const { db, writes } = makeDb(validSeed({ status: "Confirmed" }));
  const result = await confirmBooking({ db, FieldValue, bookingId: "request", uid: ownerId });
  assert.deepEqual(result, { bookingId: "request", status: "Confirmed", idempotent: true });
  assert.equal(writes.length, 0);
});

test("confirmation rejects overlapping confirmed bookings", async () => {
  const seed = validSeed();
  seed.bookings.existing = {
    listingId,
    ownerId,
    renterId: "renter-2",
    startDate: "2026-10-12",
    endDate: "2026-10-17",
    status: "Confirmed",
  };
  const { db, writes } = makeDb(seed);
  await assert.rejects(
    confirmBooking({ db, FieldValue, bookingId: "request", uid: ownerId }),
    (error) => error.status === 409 && error.code === "BOOKING_OVERLAP",
  );
  assert.equal(writes.length, 0);
});

test("confirmation writes booking and lock, then best-effort notifies the renter", async () => {
  const { db, writes } = makeDb(validSeed());
  const result = await confirmBooking({ db, FieldValue, bookingId: "request", uid: ownerId });
  assert.deepEqual(result, { bookingId: "request", status: "Confirmed", idempotent: false });
  assert.deepEqual(writes.map((write) => write.operation), ["update", "set", "create"]);
  assert.equal(writes[0].data.address, "Private address");
  assert.equal(writes[1].ref.path, "bookingConfirmationLocks/listing-1");
  assert.equal(writes[2].ref.path, "notifications/booking-confirmed-request");
  assert.equal(writes[2].data.recipientId, "renter-1");
});

test("notification failure does not fail booking confirmation", async () => {
  const { db, writes } = makeDb(validSeed(), { failNotification: true });
  const result = await confirmBooking({ db, FieldValue, bookingId: "request", uid: ownerId });
  assert.deepEqual(result, { bookingId: "request", status: "Confirmed", idempotent: false });
  assert.deepEqual(writes.map((write) => write.operation), ["update", "set"]);
});