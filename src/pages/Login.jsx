import { useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../context/useAuth";
import { useLocation, useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import "./Login.css";

/**
 * Single account type: every signed-in user can list a property and
 * browse/book properties. No "I am a renter / I am a homeowner" choice —
 * that split lived on the guide's original wireframe, not in the data
 * model, and it doesn't reflect how people actually use TrustHome.
 */
export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, loading } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const isRegister = mode === "register";

  useEffect(() => {
    if (!user || loading) return;

    const requestedPath = location.state?.from?.pathname;
    const destination = isAdmin && requestedPath?.startsWith("/admin")
      ? requestedPath
      : isAdmin
        ? "/admin"
        : "/";
    navigate(destination, { replace: true });
  }, [isAdmin, loading, location.state, navigate, user]);

  function validate() {
    const next = {};
    if (isRegister && name.trim().length < 2) {
      next.name = "Enter your full name.";
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      next.email = "Enter a valid email address.";
    }
    if (password.length < 8) {
      next.password = "Use at least 8 characters.";
    }
    if (isRegister && password !== confirmPassword) {
      next.confirmPassword = "Passwords don't match.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function createUserDoc(user, displayName) {
    const userRef = doc(db, "users", user.uid);
    const existingUser = await getDoc(userRef);
    const data = {
      name: displayName || user.displayName || "",
      email: user.email,
      status: "active",
    };

    if (!existingUser.exists()) {
      data.role = "user";
      data.createdAt = serverTimestamp();
    }

    await setDoc(
      userRef,
      data,
      { merge: true }
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setErrors((prev) => ({ ...prev, form: undefined }));
    try {
      if (isRegister) {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name.trim() });
        await createUserDoc(cred.user, name.trim());
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setErrors((prev) => ({ ...prev, form: friendlyAuthError(err.code) }));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setSubmitting(true);
    setErrors((prev) => ({ ...prev, form: undefined }));
    try {
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      await createUserDoc(cred.user, cred.user.displayName);
    } catch (err) {
      setErrors((prev) => ({ ...prev, form: friendlyAuthError(err.code) }));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <aside className="auth-panel" aria-hidden="true">
        <div className="auth-panel__mark">TrustHome</div>
        <p className="auth-panel__line">
          Every listing here has been checked against the name on the deed.
        </p>
        <ul className="auth-panel__proof">
          <li>
            <span className="badge badge--verified">Verified</span>
            Ownership document matched to account
          </li>
          <li>
            <span className="badge badge--pending">Trust score</span>
            Ranked by completed bookings, not just price
          </li>
          <li>
            <span className="badge badge--danger">Accountable</span>
            Disputes are reviewed and stay on the record
          </li>
        </ul>
      </aside>

      <main className="auth-card-wrap">
        <form className="auth-card" onSubmit={handleSubmit} noValidate>
          <div className="auth-card__brand">TrustHome</div>
          <h1 className="auth-card__title">
            {isRegister ? "Create your account" : "Welcome back"}
          </h1>
          <p className="auth-card__subtitle">
            {isRegister
              ? "List a place, or find one — one account does both."
              : "Sign in to browse, list, or manage your bookings."}
          </p>

          {errors.form && (
            <div className="auth-card__form-error" role="alert">
              {errors.form}
            </div>
          )}

          {isRegister && (
            <Field
              id="name"
              label="Full name"
              value={name}
              onChange={setName}
              error={errors.name}
              autoComplete="name"
            />
          )}

          <Field
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            error={errors.email}
            autoComplete="email"
          />

          <Field
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            error={errors.password}
            autoComplete={isRegister ? "new-password" : "current-password"}
          />

          {isRegister && (
            <Field
              id="confirmPassword"
              label="Confirm password"
              type="password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              error={errors.confirmPassword}
              autoComplete="new-password"
            />
          )}

          <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
            {submitting ? (
              <span className="btn__spinner" aria-hidden="true" />
            ) : isRegister ? (
              "Create account"
            ) : (
              "Sign in"
            )}
          </button>

          <div className="auth-card__divider">
            <span>or</span>
          </div>

          <button
            type="button"
            className="btn btn--secondary btn--block"
            onClick={handleGoogleSignIn}
            disabled={submitting}
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <p className="auth-card__switch">
            {isRegister ? "Already have an account?" : "New to TrustHome?"}{" "}
            <button
              type="button"
              className="link-button"
              onClick={() => {
                setMode(isRegister ? "login" : "register");
                setErrors({});
              }}
            >
              {isRegister ? "Sign in" : "Create one"}
            </button>
          </p>
        </form>
      </main>
    </div>
  );
}

function Field({ id, label, value, onChange, error, type = "text", autoComplete }) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        className={`field__input${error ? " field__input--error" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p className="field__error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

function friendlyAuthError(code) {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "That email and password don't match our records.";
    case "auth/email-already-in-use":
      return "An account already exists with that email — sign in instead.";
    case "auth/popup-closed-by-user":
      return "Google sign-in was closed before finishing.";
    default:
      return "Something went wrong. Please try again.";
  }
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.95v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.03l3-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.97l3 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  );
}
