import assert from "node:assert/strict";
import test from "node:test";
import { approximateMapCenter, approximateMapLocation, geocodeAddress, isValidMapLocation } from "./propertyLocation.js";

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

test("only valid coordinates explicitly marked approximate can be displayed", () => {
  assert.equal(isValidMapLocation({ geohash: "w4pru", precision: "approximate" }), true);
  assert.equal(isValidMapLocation({ geohash: "w4pru" }), false);
  assert.equal(isValidMapLocation({ geohash: "invalid", precision: "approximate" }), false);
});