import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, ShieldAlert } from "lucide-react";
import { useAuth } from "../context/useAuth";
import "../pages/UserPages.css";

export default function SessionDenied() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  async function handleSignOut() {
    setError("");
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch {
      setError("We couldn't end this session. Refresh the page and try again.");
    }
  }

  return (
    <main className="access-blocked">
      <section className="access-blocked__panel" role="alert">
        <div className="access-blocked__icon" aria-hidden="true"><ShieldAlert size={24} /></div>
        <p className="user-page__eyebrow">Session check</p>
        <h1>We couldn't verify your session</h1>
        <p>Your account access could not be confirmed. Sign in again, or contact the TrustHome team if this keeps happening.</p>
        {error && <p className="user-page__form-error" role="alert">{error}</p>}
        <button type="button" className="btn btn--secondary" onClick={handleSignOut}>
          <LogOut size={16} aria-hidden="true" />
          Sign in again
        </button>
      </section>
    </main>
  );
}
