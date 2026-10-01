import { adminAuth, db, FieldValue } from "../../../lib/firebaseAdmin.js";
import { handleConfirmBooking } from "../../../lib/confirmBookingRoute.js";
import { handler } from "../../../lib/http.js";

export default handler(["POST", "OPTIONS"], (req) => handleConfirmBooking(req, {
  adminAuth,
  db,
  FieldValue,
}));