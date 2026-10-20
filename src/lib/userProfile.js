export function normalizeUserProfileData(profile = {}, fallback = {}) {
  const status = String(profile.status ?? "").toLowerCase() === "suspended"
    ? "suspended"
    : "active";
  const nextProfile = {
    ...profile,
    name: profile.name ?? fallback.name ?? "",
    email: profile.email ?? fallback.email ?? "",
    status,
    role: profile.role ?? fallback.role ?? "user",
  };

  return nextProfile;
}
