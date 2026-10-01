import process from "node:process";
import { adminAuth, db } from "../../lib/firebaseAdmin.js";
import { cloudinary } from "../../lib/cloudinary.js";
import { handleSignPrivateDocument } from "../../lib/documentRoutes.js";
import { handler } from "../../lib/http.js";

export default handler(["POST", "OPTIONS"], (req) => handleSignPrivateDocument(req, {
  adminAuth,
  db,
  cloudinary,
  apiKey: process.env.CLOUDINARY_API_KEY,
  apiSecret: process.env.CLOUDINARY_API_SECRET,
  cloudName: process.env.CLOUDINARY_CLOUD_NAME,
}));