import { confirmBooking } from "./bookings.js";
import { requireUser } from "./auth.js";
import { HttpError } from "./errors.js";

export async function handleConfirmBooking(req, dependencies) {
  const { uid, role } = await requireUser(req, dependencies);
  if (role !== "user") throw new HttpError(403, "FORBIDDEN", "Admin accounts cannot confirm owner bookings.");
  const bookingId = req.query?.id;
  return confirmBooking({ ...dependencies, bookingId, uid });
}