import assert from "node:assert/strict";
import test from "node:test";
import { approximateMapCenter, approximateMapLocation, buildAddressSearchVariants, geocodeAddress, isValidMapLocation } from "./propertyLocation.js";

test("public map locations use a five-character approximate geohash", () => {
  const location = approximateMapLocation(12.3456, 121.5678);

  assert.equal(location.precision, "approximate");
  assert.equal(location.geohash.length, 5);
  assert.deepEqual(approximateMapCenter(location), approximateMapCenter(approximateMapLocation(12.346, 121.568)));
});

test("invalid coordinates are rejected", () => {
  assert.equal(approximateMapLocation(91, 121), null);
  assert.equal(approximateMapLocation(12, 181), null);
  assert.equal(approximateMapLocation(Number.NaN, 121), null);
});

test("address lookups return a usable latitude and longitude", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => [{ lat: "14.1234", lon: "121.5678", display_name: "Banay-Banay, Cabuyao" }],
  });

  try {
    const match = await geocodeAddress("Banay-Banay, Cabuyao");
    assert.deepEqual(match, {
      latitude: 14.1234,
      longitude: 121.5678,
      label: "Banay-Banay, Cabuyao",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("address lookups retry with a Philippines-specific fallback", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    if (calls.length === 1) {
      return { ok: true, json: async () => [] };
    }

    return {
      ok: true,
      json: async () => [{ lat: "14.1234", lon: "121.5678", display_name: "San Pedro, Laguna" }],
    };
  };

  try {
    const match = await geocodeAddress("18 Lapu-Lapu St");
    assert.equal(calls.length, 2);
    assert.deepEqual(match, {
      latitude: 14.1234,
      longitude: 121.5678,
      label: "San Pedro, Laguna",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("exact-address queries try a full Philippines fallback before giving up", () => {
  const variants = buildAddressSearchVariants("123 Sample Street, Brgy. San Jose, Cabuyao, Laguna");

  assert.deepEqual(variants[0], "123 Sample Street, Brgy. San Jose, Cabuyao, Laguna");
  assert.ok(variants.includes("123 Sample Street, Brgy. San Jose, Cabuyao, Laguna, Philippines"));
  assert.ok(variants.includes("123 Sample Street, Brgy. San Jose, Cabuyao, Laguna Philippines"));
  assert.ok(variants.every((value) => typeof value === "string" && value.trim().length > 0));
});

test("only valid coordinates explicitly marked approximate can be displayed", () => {
  assert.equal(isValidMapLocation({ geohash: "w4pru", precision: "approximate" }), true);
  assert.equal(isValidMapLocation({ geohash: "w4pru" }), false);
  assert.equal(isValidMapLocation({ geohash: "invalid", precision: "approximate" }), false);
});