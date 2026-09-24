export const MIN_LISTING_PHOTOS = 4;
export const MIN_DESCRIPTION_WORDS = 150;
export const MAX_DESCRIPTION_WORDS = 400;

export function countWords(value) {
  return String(value ?? "").trim().split(/\s+/).filter(Boolean).length;
}

export function validateListingForm({ form, photos, ownershipDocument, governmentId }) {
  const errors = [];
  const descriptionWords = countWords(form.description);

  if (!String(form.title ?? "").trim()) errors.push("Add a listing title.");
  if (!String(form.city ?? "").trim()) errors.push("Add the property city or area.");
  if (!String(form.address ?? "").trim()) errors.push("Add the property address or area.");
  if (!String(form.bedrooms ?? "").trim()) errors.push("Add the number of bedrooms.");
  if (!String(form.bathrooms ?? "").trim()) errors.push("Add the number of bathrooms.");
  if (!String(form.availabilityDate ?? "").trim()) errors.push("Add an availability date.");
  if (!Array.isArray(form.amenities) || form.amenities.length === 0) errors.push("Select at least one amenity.");
  if (descriptionWords < MIN_DESCRIPTION_WORDS || descriptionWords > MAX_DESCRIPTION_WORDS) {
    errors.push(`Description must be between ${MIN_DESCRIPTION_WORDS} and ${MAX_DESCRIPTION_WORDS} words.`);
  }
  if (!Array.isArray(photos) || photos.length < MIN_LISTING_PHOTOS) {
    errors.push(`Upload at least ${MIN_LISTING_PHOTOS} property photos.`);
  }
  if (!ownershipDocument) errors.push("Upload an ownership document.");
  if (!governmentId) errors.push("Upload a government-issued photo ID.");

  return errors;
}
