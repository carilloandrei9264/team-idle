import assert from "node:assert/strict";
import test from "node:test";
import { getAdminAccessState } from "./adminAccess.js";
import { normalizeUserProfileData } from "./userProfile.js";

const user = { uid: "member-1" };

test("admin access waits until authentication and profile checks finish", () => {
  assert.equal(getAdminAccessState({ user, profile: null, loading: true }), "loading");
});

test("only an active admin profile is allowed into admin routes", () => {
  assert.equal(getAdminAccessState({ user, profile: { role: "admin", status: "active" } }), "allowed");
  assert.equal(getAdminAccessState({ user, profile: { role: "user", status: "active" } }), "denied");
  assert.equal(getAdminAccessState({ user, profile: { role: "admin", status: "inactive" } }), "denied");
});

test("suspended accounts are explicitly blocked", () => {
  assert.equal(getAdminAccessState({ user, profile: { role: "admin", status: "suspended" } }), "suspended");
});

test("profile normalization preserves an explicit suspended status", () => {
  const profile = normalizeUserProfileData({ role: "admin", status: "suspended" });
  assert.equal(profile.status, "suspended");
  assert.equal(getAdminAccessState({ user, profile }), "suspended");
});

test("missing or unreadable profiles fail closed as unverified", () => {
  assert.equal(getAdminAccessState({ user, profile: null }), "unverified");
  assert.equal(getAdminAccessState({ user, profile: { status: "active" } }), "unverified");
  assert.equal(getAdminAccessState({ user, profile: { role: "admin" } }), "unverified");
  assert.equal(getAdminAccessState({ user, profile: { role: "admin", status: "active" }, profileError: true }), "unverified");
});

test("signed-out sessions cannot enter admin routes", () => {
  assert.equal(getAdminAccessState({ user: null, profile: null }), "signed-out");
});

test("legacy or incomplete user profiles are normalized to active user accounts", () => {
  assert.deepEqual(normalizeUserProfileData({}, { name: "Jane Doe", email: "jane@example.com", role: "user" }), {
    name: "Jane Doe",
    email: "jane@example.com",
    status: "active",
    role: "user",
  });

  assert.deepEqual(normalizeUserProfileData({ role: "admin", status: "inactive" }, { name: "Admin User", email: "admin@example.com" }), {
    role: "admin",
    status: "active",
    name: "Admin User",
    email: "admin@example.com",
  });
});