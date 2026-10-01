import { auth } from "../firebase";

const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

export async function api(path, { method = "GET", body } = {}) {
  if (!API_BASE_URL) {
    throw Object.assign(new Error("Booking service is not configured."), { code: "UNAVAILABLE" });
  }

  const token = await auth.currentUser?.getIdToken();
  if (!token) throw Object.assign(new Error("Sign in to continue."), { code: "NO_TOKEN", status: 401 });

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw Object.assign(new Error("Booking service is temporarily unavailable. Try again shortly."), { code: "UNAVAILABLE" });
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(
      new Error(data.error?.message || "The booking request could not be updated. Please try again."),
      { code: data.error?.code || "REQUEST_FAILED", status: response.status },
    );
  }
  return data;
}

export function confirmBooking(bookingId) {
  return api(`/api/bookings/${encodeURIComponent(bookingId)}/confirm`, { method: "POST" });
}