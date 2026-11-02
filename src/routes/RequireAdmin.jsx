import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { getAdminAccessState } from "../lib/adminAccess";
import SuspendedAccess from "./SuspendedAccess";

/**
 * Wraps <AdminLayout> in the router. Three outcomes:
 *  - still checking auth/role  -> render nothing (brief loading state)
 *  - not signed in             -> bounce to /login
 *  - signed in but not admin   -> bounce home (not the login page —
 *                                  they ARE authenticated, just not allowed here)
 */
export default function RequireAdmin({ children }) {
  const { user, profile, profileError, loading } = useAuth();
  const location = useLocation();
  const accessState = getAdminAccessState({ user, profile, profileError, loading });

  if (accessState === "loading") {
    return <main className="app-loading" role="status" aria-live="polite">Verifying admin access...</main>;
  }

  if (accessState === "signed-out") {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (accessState === "suspended") return <SuspendedAccess />;

  if (accessState === "unverified") return <UnverifiedAdminProfile />;

  if (accessState === "denied") {
    return <Navigate to="/" replace />;
  }

  return children;
}

function UnverifiedAdminProfile() {
  return (
    <main className="app-error" role="alert">
      <section className="app-error__panel">
        <p className="app-error__eyebrow">Access check</p>
        <h1>Admin access could not be verified</h1>
        <p>TrustHome could not confirm an active account role. Refresh to try again; if the problem continues, contact the TrustHome team.</p>
        <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
          Retry access check
        </button>
        <Link to="/" className="btn btn--secondary">Return home</Link>
      </section>
    </main>
  );
}
