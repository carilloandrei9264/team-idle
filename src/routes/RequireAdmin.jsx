import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import SuspendedAccess from "./SuspendedAccess";

/**
 * Wraps <AdminLayout> in the router. Three outcomes:
 *  - still checking auth/role  -> render nothing (brief loading state)
 *  - not signed in             -> bounce to /login
 *  - signed in but not admin   -> bounce home (not the login page —
 *                                  they ARE authenticated, just not allowed here)
 */
export default function RequireAdmin({ children }) {
  const { user, profile, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (profile?.status?.toLowerCase() === "suspended") return <SuspendedAccess />;

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}
