import { useNavigate } from "react-router-dom";
import { LogOut, ShieldAlert } from "lucide-react";
import { useAuth } from "../context/useAuth";
import "../pages/UserPages.css";

export default function SuspendedAccess() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <main className="access-blocked">
      <section className="access-blocked__panel">
        <div className="access-blocked__icon" aria-hidden="true">
          <ShieldAlert size={24} />
        </div>
        <p className="user-page__eyebrow">Account unavailable</p>
        <h1>Your account is suspended</h1>
        <p>Owner and admin tools are unavailable while your account is suspended. Contact the TrustHome team if you think this is a mistake.</p>
        <button type="button" className="btn btn--secondary" onClick={handleSignOut}>
          <LogOut size={16} aria-hidden="true" />
          Sign out
        </button>
      </section>
    </main>
  );
}