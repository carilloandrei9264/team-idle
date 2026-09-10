import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
import { AuthContext } from "./AuthContextValue";

/**
 * Firebase Auth only ever answers "is this credential valid" — it has no
 * concept of role. This context is the bridge: it listens for auth state,
 * then subscribes to that user's users/{uid} Firestore document (where
 * role, name, status live) and exposes both together.
 *
 * Wrap the whole app with <AuthProvider> in main.jsx, above <App />.
 */
export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null); // the users/{uid} document
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setLoading(true);
      setFirebaseUser(user);
      if (!user) {
        setProfile(null);
        setLoading(false);
      }
    });
    return unsubscribeAuth;
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    // onSnapshot (not a one-time getDoc) so a role change in the Console
    // takes effect immediately if this tab is left open.
    const unsubscribeDoc = onSnapshot(
      doc(db, "users", firebaseUser.uid),
      (snap) => {
        setProfile(snap.exists() ? snap.data() : null);
        setLoading(false);
      },
      () => {
        setProfile(null);
        setLoading(false);
      }
    );
    return unsubscribeDoc;
  }, [firebaseUser]);

  const value = {
    user: firebaseUser,
    profile,
    role: profile?.role ?? null,
    isAdmin: profile?.role === "admin",
    loading,
    signOut: () => firebaseSignOut(auth),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
