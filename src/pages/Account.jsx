import { useEffect, useState } from "react";
import { updateProfile } from "firebase/auth";
import { collection, doc, onSnapshot, query, setDoc, where } from "firebase/firestore";
import { Check, UserRound } from "lucide-react";
import PublicNav from "../components/PublicNav";
import { useAuth } from "../context/useAuth";
import { db } from "../firebase";
import "./UserPages.css";

export default function Account() {
  const { user, profile } = useAuth();
  const [name, setName] = useState(profile?.name || user.displayName || "");
  const [listingCount, setListingCount] = useState(0);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const listingsQuery = query(collection(db, "listings"), where("ownerId", "==", user.uid));
    return onSnapshot(
      listingsQuery,
      (snapshot) => {
        setListingCount(snapshot.size);
        setListingsLoading(false);
      },
      () => setListingsLoading(false)
    );
  }, [user.uid]);

  async function handleSave(event) {
    event.preventDefault();
    const nextName = name.trim();
    if (nextName.length < 2) {
      setError("Enter at least two characters for your name.");
      setMessage("");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      await updateProfile(user, { displayName: nextName });
      await setDoc(doc(db, "users", user.uid), { name: nextName }, { merge: true });
      await setDoc(doc(db, "publicProfiles", user.uid), { userId: user.uid, name: nextName }, { merge: true });
      setMessage("Profile saved.");
    } catch {
      setError("Your profile could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="user-page">
      <PublicNav />
      <main className="user-page__content">
        <header className="user-page__header">
          <div>
            <p className="user-page__eyebrow">Your account</p>
            <h1>Account</h1>
            <p>Manage your profile and see your activity on TrustHome.</p>
          </div>
        </header>

        <div className="account-layout">
          <section className="user-page__empty account-card">
            <div className="account-card__heading">
              <span className="account-card__icon" aria-hidden="true"><UserRound size={20} /></span>
              <div>
                <h2>Profile details</h2>
                <p>Your name appears on your listings and account menu.</p>
              </div>
            </div>
            <form className="account-form" onSubmit={handleSave}>
              <div className="field">
                <label className="field__label" htmlFor="account-name">Full name</label>
                <input
                  id="account-name"
                  className="field__input"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="account-email">Email address</label>
                <input id="account-email" className="field__input" value={user.email || ""} readOnly />
              </div>
              {error && <p className="user-page__form-error" role="alert">{error}</p>}
              {message && <p className="user-page__form-success" role="status"><Check size={15} aria-hidden="true" />{message}</p>}
              <button type="submit" className="btn btn--primary" disabled={saving}>
                {saving ? "Saving..." : "Save changes"}
              </button>
            </form>
          </section>

          <aside className="account-summary">
            <div className="account-summary__avatar" aria-hidden="true">
              {(profile?.name || user.displayName || user.email || "?").charAt(0).toUpperCase()}
            </div>
            <h2>{profile?.name || user.displayName || "TrustHome member"}</h2>
            <p>{user.email}</p>
            <div className="account-summary__meta">
              <span>Status</span>
              <strong>{profile?.status || "active"}</strong>
            </div>
            <div className="account-summary__meta">
              <span>Role</span>
              <strong>{profile?.role || "user"}</strong>
            </div>
            <div className="account-summary__meta">
              <span>My listings</span>
              <strong>{listingsLoading ? "..." : listingCount}</strong>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}