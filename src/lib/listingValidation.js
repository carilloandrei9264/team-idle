import { isValidMapLocation } from "./propertyLocation.js";

export const MIN_LISTING_PHOTOS = 4;
export const MIN_DESCRIPTION_WORDS = 150;
export const MAX_DESCRIPTION_WORDS = 400;
export const SHOWING_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function countWords(value) {
  return String(value ?? "").trim().split(/\s+/).filter(Boolean).length;
}

export function validateListingForm({ form, photos, ownershipDocument, governmentId, mapLocation = form?.mapLocation ?? null }) {
  const errors = [];
  const descriptionWords = countWords(form.description);
  const resolvedMapLocation = mapLocation ?? form?.mapLocation ?? null;

  if (!String(form.title ?? "").trim()) errors.push("Add a listing title.");
  if (!String(form.city ?? "").trim()) errors.push("Add the property city or area.");
  if (!String(form.address ?? "").trim()) errors.push("Add the property address or area.");
  if (!String(form.bedrooms ?? "").trim()) errors.push("Add the number of bedrooms.");
  if (!String(form.bathrooms ?? "").trim()) errors.push("Add the number of bathrooms.");
  if (!String(form.availabilityDate ?? "").trim()) errors.push("Add an availability date.");
  if (!Array.isArray(form.amenities) || form.amenities.length === 0) errors.push("Select at least one amenity.");
  if (!hasValidShowingWindow(form.showingWindows)) errors.push("Add at least one showing window with a start and end time.");
  if (resolvedMapLocation !== null && resolvedMapLocation !== undefined && !isValidMapLocation(resolvedMapLocation)) {
    errors.push("Use a valid approximate map location or remove the pin.");
  }
  if (!String(form.description ?? "").trim()) {
    errors.push("Add a property description.");
  } else if (descriptionWords > MAX_DESCRIPTION_WORDS) {
    errors.push(`Description should stay within ${MAX_DESCRIPTION_WORDS} words. Current length: ${descriptionWords}.`);
  }
  if (!Array.isArray(photos) || photos.length < MIN_LISTING_PHOTOS) {
    errors.push(`Upload at least ${MIN_LISTING_PHOTOS} property photos.`);
  }
  if (!ownershipDocument) errors.push("Upload an ownership document.");
  if (!governmentId) errors.push("Upload a government-issued photo ID.");

  return errors;
}

export function hasValidShowingWindow(showingWindows = {}) {
  return Object.values(showingWindows).some((window) => window?.enabled && window.start && window.end && window.start < window.end);
}
