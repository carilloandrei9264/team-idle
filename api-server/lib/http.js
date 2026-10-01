import process from "node:process";
import { HttpError } from "./errors.js";

export function handler(methods, endpoint) {
  return async (req, res) => {
    const allowedOrigins = new Set((process.env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean));
    const origin = req.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.setHeader("Access-Control-Allow-Methods", methods.join(", "));
    }
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");

    if (req.method === "OPTIONS") return res.status(204).end();
    if (!methods.includes(req.method)) {
      return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "Method not allowed." } });
    }

    try {
      return res.status(200).json(await endpoint(req));
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      const code = error instanceof HttpError ? error.code : "INTERNAL";
      const message = status >= 500 ? "Something went wrong. Please try again." : error.message;
      return res.status(status).json({ error: { code, message } });
    }
  };
}