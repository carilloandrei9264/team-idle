import assert from "node:assert/strict";
import process from "node:process";
import test from "node:test";
import { handler } from "../lib/http.js";
import { HttpError } from "../lib/errors.js";

function response() {
  return {
    headers: {},
    statusCode: null,
    body: null,
    ended: false,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
    end() { this.ended = true; return this; },
  };
}

test("handler only allows configured CORS origins and disables caching", async () => {
  process.env.ALLOWED_ORIGINS = "https://trusthome-ph.web.app, https://trusthome-ph.firebaseapp.com";
  const endpoint = handler(["POST", "OPTIONS"], async () => ({ ok: true }));
  const allowed = response();
  await endpoint({ method: "POST", headers: { origin: "https://trusthome-ph.web.app" } }, allowed);
  assert.equal(allowed.headers["Access-Control-Allow-Origin"], "https://trusthome-ph.web.app");
  assert.equal(allowed.headers["Cache-Control"], "no-store");
  assert.equal(allowed.headers["X-Content-Type-Options"], "nosniff");

  const rejectedOrigin = response();
  await endpoint({ method: "POST", headers: { origin: "https://attacker.example" } }, rejectedOrigin);
  assert.equal(rejectedOrigin.headers["Access-Control-Allow-Origin"], undefined);
});

test("handler returns method and typed business errors in the API error shape", async () => {
  const endpoint = handler(["POST"], async () => { throw new HttpError(409, "BOOKING_OVERLAP", "Dates overlap."); });
  const methodResponse = response();
  await endpoint({ method: "GET", headers: {} }, methodResponse);
  assert.equal(methodResponse.statusCode, 405);
  assert.equal(methodResponse.body.error.code, "METHOD_NOT_ALLOWED");

  const conflictResponse = response();
  await endpoint({ method: "POST", headers: {} }, conflictResponse);
  assert.equal(conflictResponse.statusCode, 409);
  assert.deepEqual(conflictResponse.body, { error: { code: "BOOKING_OVERLAP", message: "Dates overlap." } });
});

test("handler hides internal errors", async () => {
  const endpoint = handler(["POST"], async () => { throw new Error("private details"); });
  const result = response();
  await endpoint({ method: "POST", headers: {} }, result);
  assert.equal(result.statusCode, 500);
  assert.deepEqual(result.body, { error: { code: "INTERNAL", message: "Something went wrong. Please try again." } });
});