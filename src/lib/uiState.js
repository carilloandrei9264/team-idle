export function firebaseAccessErrorMessage(error, resource = "this information") {
  if (error?.code === "permission-denied") {
    return `You don't have permission to access ${resource}.`;
  }
  if (["unauthenticated", "auth/invalid-user-token", "NO_TOKEN", "BAD_TOKEN"].includes(error?.code)) {
    return "Your session has expired. Sign in again to continue.";
  }
  if (["unavailable", "network-request-failed", "UNAVAILABLE"].includes(error?.code)) {
    return `We couldn't connect to load ${resource}. Check your connection and try again.`;
  }
  return `We couldn't load ${resource}. Please try again.`;
}
