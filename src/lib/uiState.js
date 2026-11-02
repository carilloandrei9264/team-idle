export function firebaseAccessErrorMessage(error, resource) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return `No internet connection. ${resource} will be available when you're back online.`;
  }
  if (error?.code === "permission-denied") {
    return `Permission denied while accessing ${resource}. Check that you're signed in with an active account.`;
  }
  if (["unauthenticated", "auth/user-token-expired"].includes(error?.code)) {
    return `Your session expired while accessing ${resource}. Sign in again and retry.`;
  }
  if (["unavailable", "network-request-failed"].includes(error?.code)) {
    return `The connection to ${resource} was interrupted. Check your internet and try again.`;
  }
  return `${resource} could not be loaded. Please try again.`;
}
