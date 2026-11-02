export function getAdminAccessState({ user, profile, loading, profileError }) {
  if (loading) return "loading";
  if (!user) return "signed-out";
  const status = typeof profile?.status === "string" ? profile.status : null;
  if (status?.toLowerCase() === "suspended") return "suspended";
  if (profileError || !profile || !profile.role || !status) return "unverified";
  if (profile.role !== "admin" || status !== "active") return "denied";
  return "allowed";
}