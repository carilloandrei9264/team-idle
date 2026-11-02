import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import SuspendedAccess from "./SuspendedAccess";
import SessionDenied from "./SessionDenied";

export default function RequireAuth({ children }) {
  const { user, profile, profileError, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (profileError) return <SessionDenied />;
  if (profile?.status?.toLowerCase() === "suspended") return <SuspendedAccess />;

  return children;
}