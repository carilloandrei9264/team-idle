import { adminAuth, db } from "../../../lib/firebaseAdmin.js";
import { requireUser } from "../../../lib/auth.js";
import { handler } from "../../../lib/http.js";
import { getListingAvailability } from "../../../lib/listingAvailability.js";

export default handler(["GET", "OPTIONS"], async (req) => {
  await requireUser(req, { adminAuth, db });
  return getListingAvailability({ db, listingId: req.query?.id });
});
