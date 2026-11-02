export function numericValue(value, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const cleaned = String(value ?? "").replace(/[^0-9.-]/g, "");
  if (!cleaned) return fallback;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formatCurrency(value, fractionDigits = null) {
  const numeric = numericValue(value, null);
  if (numeric == null) return "Price unavailable";
  const options = Number.isInteger(fractionDigits)
    ? { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits }
    : undefined;
  return `₱${numeric.toLocaleString(undefined, options)}`;
}
