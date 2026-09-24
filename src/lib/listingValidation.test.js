import test from "node:test";
import assert from "node:assert/strict";

import {
  countWords,
  MIN_DESCRIPTION_WORDS,
  validateListingForm,
} from "./listingValidation.js";

const validForm = {
  title: "Bright apartment",
  city: "Cabuyao",
  address: "Banay-Banay, Cabuyao",
  bedrooms: "2",
  bathrooms: "1",
  availabilityDate: "2026-10-01",
  amenities: ["WiFi"],
  showingWindows: { Monday: { enabled: true, start: "09:00", end: "17:00" } },
  description: Array(MIN_DESCRIPTION_WORDS).fill("property").join(" "),
};

test("countWords ignores repeated whitespace", () => {
  assert.equal(countWords("  bright   apartment home "), 3);
});

test("a complete listing intake passes validation", () => {
  assert.deepEqual(validateListingForm({
    form: validForm,
    photos: [{ name: "one" }, { name: "two" }, { name: "three" }, { name: "four" }],
    ownershipDocument: { name: "title.pdf" },
    governmentId: { name: "id.jpg" },
  }), []);
});

test("listing validation reports missing documents, photos, and required fields", () => {
  const errors = validateListingForm({
    form: { ...validForm, address: "", amenities: [], showingWindows: {}, description: "short" },
    photos: [],
    ownershipDocument: null,
    governmentId: null,
  });

  assert.match(errors.join(" "), /address|amenity|Description|photos|ownership|government-issued/i);
});
