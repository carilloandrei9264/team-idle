import assert from "node:assert/strict";
import test from "node:test";
import { requireUser } from "../lib/auth.js";

function dependencies({ profile, verifyIdToken = async () => ({ uid: "owner-1" }) } = {}) {
  return {
    adminAuth: { verifyIdToken },
    db: {
      collection(name) {
        assert.equal(name, "users");
        return { doc: (uid) => ({ get: async () => ({ exists: Boolean(profile), data: () => profile, uid }) }) };
      },
    },
  };
}

test("requireUser rejects requests without a bearer token", async () => {
  let verified = false;
  const deps = dependencies({ verifyIdToken: async () => { verified = true; return { uid: "owner-1" }; } });
  await assert.rejects(requireUser({ headers: {} }, deps), (error) => error.status === 401 && error.code === "NO_TOKEN");
  assert.equal(verified, false);
});

test("requireUser verifies the token and re-reads an active profile", async () => {
  const deps = dependencies({ profile: { role: "user", status: "active" } });
  const result = await requireUser({ headers: { authorization: "Bearer signed-token" } }, deps);
  assert.equal(result.uid, "owner-1");
  assert.equal(result.profile.status, "active");
});

test("requireUser rejects invalid tokens, missing profiles, and suspended profiles", async () => {
  const invalidToken = dependencies({ verifyIdToken: async () => { throw new Error("invalid"); } });
  await assert.rejects(requireUser({ headers: { authorization: "Bearer bad" } }, invalidToken), (error) => error.code === "BAD_TOKEN");

  await assert.rejects(
    requireUser({ headers: { authorization: "Bearer good" } }, dependencies()),
    (error) => error.status === 403 && error.code === "NO_PROFILE",
  );
  await assert.rejects(
    requireUser({ headers: { authorization: "Bearer good" } }, dependencies({ profile: { status: "suspended" } })),
    (error) => error.status === 403 && error.code === "ACCOUNT_SUSPENDED",
  );
});