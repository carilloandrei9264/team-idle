import { adminAuth, db } from "../../../../lib/firebaseAdmin.js";
import { cloudinary } from "../../../../lib/cloudinary.js";
import { handleGetPrivateDocument } from "../../../../lib/documentRoutes.js";
import { handler } from "../../../../lib/http.js";

export default handler(["GET", "OPTIONS"], (req) => handleGetPrivateDocument(req, {
  adminAuth,
  db,
  cloudinary,
}));