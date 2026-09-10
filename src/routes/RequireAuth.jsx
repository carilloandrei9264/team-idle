import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import SuspendedAccess from "./SuspendedAccess";

export default function RequireAuth({ children }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (profile?.status?.toLowerCase() === "suspended") return <SuspendedAccess />;

  return children;
}