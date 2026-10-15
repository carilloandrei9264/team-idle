import { isValidMapLocation } from "./propertyLocation.js";

export const MIN_LISTING_PHOTOS = 4;
export const MAX_LISTING_PHOTOS = 12;
export const MAX_LISTING_PHOTO_SIZE = 5 * 1024 * 1024;
export const MAX_LISTING_DOCUMENT_SIZE = 10 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MIN_DESCRIPTION_WORDS = 150;
export const MAX_DESCRIPTION_WORDS = 400;
export const SHOWING_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const LISTING_PURPOSES = ["rent", "sale"];
export const RENTAL_TERMS = ["short_term", "long_term"];
export const PROPERTY_CONDITIONS = ["new", "excellent", "good", "fair", "needs_repair"];
export const FURNISHING_STATUSES = ["furnished", "partially_furnished", "unfurnished"];

export function countWords(value) {
  return String(value ?? "").trim().split(/\s+/).filter(Boolean).length;
}

export function validateListingForm({ form, photos, ownershipDocument, governmentId, mapLocation = form?.mapLocation ?? null }) {
  const errors = [];
  const listingPurpose = form.listingPurpose || "rent";
  const rentalTerm = form.rentalTerm || (form.pricePeriod === "day" ? "short_term" : "long_term");
  const descriptionWords = countWords(form.description);
  const resolvedMapLocation = mapLocation ?? form?.mapLocation ?? null;

  if (!LISTING_PURPOSES.includes(listingPurpose)) errors.push("Choose whether the property is for rent or for sale.");
  if (listingPurpose === "rent" && !RENTAL_TERMS.includes(rentalTerm)) errors.push("Choose a short-term or long-term rental.");
  if (form.propertyCondition && !PROPERTY_CONDITIONS.includes(form.propertyCondition)) errors.push("Choose a supported property condition.");
  if (form.furnishingStatus && !FURNISHING_STATUSES.includes(form.furnishingStatus)) errors.push("Choose a supported furnishing status.");
  if (!String(form.title ?? "").trim()) errors.push("Add a listing title.");
  if (String(form.title ?? "").trim().length > 120) errors.push("Keep the listing title to 120 characters or fewer.");
  if (!String(form.city ?? "").trim()) errors.push("Add the property city or area.");
  if (!String(form.address ?? "").trim()) errors.push("Add the property address or area.");
  if (!String(form.bedrooms ?? "").trim()) errors.push("Add the number of bedrooms.");
  if (!String(form.bathrooms ?? "").trim()) errors.push("Add the number of bathrooms.");
  if (!Number.isFinite(Number(form.price)) || Number(form.price) <= 0) errors.push("Add a price greater than 0.");
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
  } else if (photos.length > MAX_LISTING_PHOTOS) {
    errors.push(`Upload no more than ${MAX_LISTING_PHOTOS} property photos.`);
  }
  const photoFiles = Array.isArray(photos) ? photos : [];
  if (photoFiles.some((photo) => photo && typeof photo.type === "string" && !ACCEPTED_IMAGE_TYPES.includes(photo.type))) {
    errors.push("Property photos must be JPEG, PNG, or WebP images.");
  }
  if (photoFiles.some((photo) => typeof photo?.size === "number" && photo.size > MAX_LISTING_PHOTO_SIZE)) {
    errors.push("Each property photo must be 5 MB or smaller.");
  }
  if (ownershipDocument?.type && ![...ACCEPTED_IMAGE_TYPES, "application/pdf"].includes(ownershipDocument.type)) {
    errors.push("Ownership documents must be JPEG, PNG, WebP, or PDF files.");
  }
  if (typeof ownershipDocument?.size === "number" && ownershipDocument.size > MAX_LISTING_DOCUMENT_SIZE) {
    errors.push("The ownership document must be 10 MB or smaller.");
  }
  if (governmentId?.type && !ACCEPTED_IMAGE_TYPES.includes(governmentId.type)) {
    errors.push("Government ID files must be JPEG, PNG, or WebP images.");
  }
  if (typeof governmentId?.size === "number" && governmentId.size > MAX_LISTING_DOCUMENT_SIZE) {
    errors.push("The government ID must be 10 MB or smaller.");
  }
  if (!ownershipDocument) errors.push("Upload an ownership document.");
  if (!governmentId) errors.push("Upload a government-issued photo ID.");

  return errors;
}

export function hasValidShowingWindow(showingWindows = {}) {
  return Object.values(showingWindows).some((window) => window?.enabled && window.start && window.end && window.start < window.end);
}
