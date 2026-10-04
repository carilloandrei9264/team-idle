export function normalizeUserProfileData(profile = {}, fallback = {}) {
  const nextProfile = {
    ...profile,
    name: profile.name ?? fallback.name ?? "",
    email: profile.email ?? fallback.email ?? "",
    status: "active",
    role: profile.role ?? fallback.role ?? "user",
  };

  return nextProfile;
}
