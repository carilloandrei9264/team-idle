import ngeohash from "ngeohash";

export function approximateMapLocation(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  return {
    geohash: ngeohash.encode(latitude, longitude, 5),
    precision: "approximate",
  };
}

export async function geocodeAddress(address) {
  const query = String(address ?? "").trim();
  if (!query) return null;

  const variants = Array.from(new Set([
    query,
    `${query}, Philippines`,
    `${query.replace(/,\s*Philippines$/i, "")}, Philippines`,
    `${query} Philippines`,
  ])).filter(Boolean);

  let lastError = null;

  for (const variant of variants) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ph&q=${encodeURIComponent(variant)}`,
        { headers: { Accept: "application/json" } },
      );

      if (!response.ok) {
        throw new Error("Address lookup failed. Please try a more specific location.");
      }

      const results = await response.json();
      const match = Array.isArray(results) ? results[0] : null;
      if (!match) continue;

      const latitude = Number(match.lat);
      const longitude = Number(match.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

      return {
        latitude,
        longitude,
        label: match.display_name || variant,
      };
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return null;
}

export function isValidMapLocation(location) {
  return location?.precision === "approximate"
    && typeof location.geohash === "string"
    && /^[0123456789bcdefghjkmnpqrstuvwxyz]{5}$/.test(location.geohash);
}

export function approximateMapCenter(location) {
  if (!isValidMapLocation(location)) return null;
  const { latitude, longitude } = ngeohash.decode(location.geohash);
  return [latitude, longitude];
}