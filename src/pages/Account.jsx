import { useEffect, useState } from "react";
import { updateProfile } from "firebase/auth";
import { collection, deleteField, doc, getDoc, limit, onSnapshot, orderBy, query, setDoc, where } from "firebase/firestore";
import { ArrowRight, Check, ShieldCheck, UserRound } from "lucide-react";
import PublicNav from "../components/PublicNav";
import MembershipPreviewDialog from "../components/MembershipPreviewDialog";
import { useAuth } from "../context/useAuth";
import { db } from "../firebase";
import { createAccountActivity } from "../lib/accountActivity";
import "./UserPages.css";

export default function Account() {
  const { user, profile } = useAuth();
  const [name, setName] = useState(profile?.name || user.displayName || "");
  const [listingCount, setListingCount] = useState(0);
  const [contactPhone, setContactPhone] = useState("");
  const [shareEmail, setShareEmail] = useState(false);
  const [sharePhone, setSharePhone] = useState(false);
  const [contactSettingsLoading, setContactSettingsLoading] = useState(true);
  const [contactSettingsError, setContactSettingsError] = useState(false);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPlans, setShowPlans] = useState(false);

  useEffect(() => {
    let active = true;
    getDoc(doc(db, "publicProfiles", user.uid))
      .then((snapshot) => {
        if (!active) return;
        const publicProfile = snapshot.exists() ? snapshot.data() : {};
        setContactPhone(publicProfile.contactPhone || "");
        setShareEmail(Boolean(user.email && publicProfile.contactEmail === user.email));
        setSharePhone(Boolean(publicProfile.contactPhone));
      })
      .catch(() => {
        if (active) {
          setContactSettingsError(true);
          setError("Public contact settings could not be loaded. Refresh before saving changes.");
        }
      })
      .finally(() => {
        if (active) setContactSettingsLoading(false);
      });

    return () => { active = false; };
  }, [user.uid, user.email]);

  useEffect(() => {
    const listingsQuery = query(collection(db, "listings"), where("ownerId", "==", user.uid));
    const activityQuery = query(
      collection(db, "accountActivity"),
      where("actorId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(6)
    );

    const unsubscribeListings = onSnapshot(
      listingsQuery,
      (snapshot) => {
        setListingCount(snapshot.size);
        setListingsLoading(false);
      },
      () => setListingsLoading(false)
    );

    const unsubscribeActivity = onSnapshot(
      activityQuery,
      (snapshot) => {
        setActivity(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        setActivityLoading(false);
      },
      () => setActivityLoading(false)
    );

    return () => {
      unsubscribeListings();
      unsubscribeActivity();
    };
  }, [user.uid]);

  async function handleSave(event) {
    event.preventDefault();
    const nextName = name.trim();
    if (nextName.length < 2) {
      setError("Enter at least two characters for your name.");
      setMessage("");
      return;
    }

    if (contactSettingsError) {
      setError("Refresh the page to reload contact settings before saving.");
      return;
    }

    const nextPhone = contactPhone.replace(/[\s().-]/g, "");
    if (sharePhone && !/^\+[1-9]\d{7,14}$/.test(nextPhone)) {
      setError("Enter a valid international phone number, or turn off public phone sharing.");
      setMessage("");
      return;
    }

    if (shareEmail && !user.email) {
      setError("There is no sign-in email available to share.");
      setMessage("");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      await updateProfile(user, { displayName: nextName });
      await setDoc(doc(db, "users", user.uid), { name: nextName }, { merge: true });
      await setDoc(doc(db, "publicProfiles", user.uid), {
        userId: user.uid,
        name: nextName,
        contactEmail: shareEmail ? user.email : deleteField(),
        contactPhone: sharePhone ? nextPhone : deleteField(),
      }, { merge: true });
      await createAccountActivity(db, {
        actorId: user.uid,
        actorRole: profile?.role || "user",
        targetUserId: user.uid,
        entityType: "account",
        entityId: user.uid,
        action: "profile_updated",
        summary: "Profile updated",
        details: { field: "name", value: nextName },
      });
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

        <section className="account-verified-promo" aria-labelledby="account-verified-title">
          <span className="account-verified-promo__icon" aria-hidden="true">
            <ShieldCheck size={22} />
          </span>
          <div className="account-verified-promo__copy">
            <p className="account-verified-promo__eyebrow">Member feature preview</p>
            <h2 id="account-verified-title">TrustHome Verified</h2>
            <p>
              An optional profile badge is planned to help build trust. This preview does not
              change your account status or listing reviews.
            </p>
          </div>
          <button
            type="button"
            className="account-verified-promo__action"
            onClick={() => setShowPlans(true)}
            aria-haspopup="dialog"
          >
            View plans <ArrowRight size={15} aria-hidden="true" />
          </button>
        </section>

        <div className="account-layout">
          <section className="user-page__empty account-card">
            <div className="account-card__heading">
              <span className="account-card__icon" aria-hidden="true"><UserRound size={20} /></span>
              <div>
                <h2>Profile details</h2>
                <p>Your display name appears on listings, your profile, and account menu.</p>
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
                <label className="field__label" htmlFor="account-email">Sign-in email</label>
                <input id="account-email" className="field__input" value={user.email || ""} readOnly />
              </div>
              <fieldset className="account-form__contact">
                <legend>Public contact details</legend>
                <p>Shared details appear publicly on your profile and listings. An unshared phone number is not saved.</p>
                {contactSettingsLoading ? (
                  <span className="account-form__contact-loading" role="status">Loading contact settings…</span>
                ) : (
                  <>
                    <label className="account-form__consent">
                      <input type="checkbox" checked={shareEmail} onChange={(event) => setShareEmail(event.target.checked)} />
                      <span>Show my sign-in email as the primary contact</span>
                    </label>
                    <div className="field">
                      <label className="field__label" htmlFor="account-contact-phone">Contact phone (optional)</label>
                      <input
                        id="account-contact-phone"
                        className="field__input"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={contactPhone}
                        onChange={(event) => setContactPhone(event.target.value)}
                        placeholder="+63 917 123 4567"
                      />
                    </div>
                    <label className="account-form__consent">
                      <input type="checkbox" checked={sharePhone} onChange={(event) => setSharePhone(event.target.checked)} />
                      <span>Show this phone number publicly</span>
                    </label>
                  </>
                )}
              </fieldset>
              {error && <p className="user-page__form-error" role="alert">{error}</p>}
              {message && <p className="user-page__form-success" role="status"><Check size={15} aria-hidden="true" />{message}</p>}
              <button type="submit" className="btn btn--primary" disabled={saving || contactSettingsLoading}>
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

        <section className="user-page__empty account-activity" aria-live="polite">
          <div className="account-card__heading">
            <span className="account-card__icon" aria-hidden="true"><Check size={20} /></span>
            <div>
              <h2>Recent activity</h2>
              <p>Your latest account events, listing updates, and booking actions.</p>
            </div>
          </div>

          {activityLoading ? (
            <p className="account-activity__empty">Loading recent activity...</p>
          ) : activity.length === 0 ? (
            <p className="account-activity__empty">No activity yet. Your profile changes and booking actions will appear here.</p>
          ) : (
            <ul className="account-activity__list">
              {activity.map((item) => (
                <li key={item.id} className="account-activity__item">
                  <span className="account-activity__dot" aria-hidden="true" />
                  <div>
                    <strong>{item.summary}</strong>
                    <p>{item.action.replace("_", " ")}</p>
                    <time dateTime={item.createdAt?.toDate ? item.createdAt.toDate().toISOString() : ""}>
                      {item.createdAt?.toDate ? new Date(item.createdAt.toDate()).toLocaleString() : "Just now"}
                    </time>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      {showPlans && <MembershipPreviewDialog onClose={() => setShowPlans(false)} />}
    </div>
  );
}