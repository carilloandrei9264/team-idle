import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  ChevronDown,
  LayoutDashboard,
  Home,
  LogOut,
  ShieldAlert,
  Users,
  Landmark,
} from "lucide-react";
import { useAuth } from "../context/useAuth";
import "./AdminLayout.css";

const NAV_ITEMS = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/listings", label: "Listings", icon: Home },
  { to: "/admin/disputes", label: "Disputes", icon: ShieldAlert },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/bank-catalog", label: "Bank Catalog", icon: Landmark },
];

/**
 * Desktop-landscape by design (Design Guide, Part 0 / B6) — admins work
 * from a laptop, so this doesn't try to also be a mobile layout.
 * Route it as the parent of every /admin/* route:
 *   <Route path="/admin" element={<AdminLayout />}>
 *     <Route index element={<AdminDashboard />} />
 *     ...
 *   </Route>
 */
export default function AdminLayout({ adminName = "Admin" }) {
  const { user, profile, signOut } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const displayName = profile?.name || user?.displayName || adminName;
  const initials = displayName.trim().charAt(0).toUpperCase() || "A";

  useEffect(() => {
    if (!profileOpen) return undefined;

    function closeOnOutsideClick(event) {
      if (!profileMenuRef.current?.contains(event.target)) {
        setProfileOpen(false);
      }
    }

    function closeOnEscape(event) {
      if (event.key === "Escape") setProfileOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [profileOpen]);

  async function handleSignOut() {
    setProfileOpen(false);
    await signOut();
  }

  return (
    <div className="admin-shell">
      <nav className="admin-sidebar" aria-label="Admin navigation">
        <div className="admin-sidebar__brand">
          <span className="admin-sidebar__name">TrustHome</span>
          <span className="admin-sidebar__sub">Admin Panel</span>
        </div>

        <ul className="admin-sidebar__nav">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  "admin-sidebar__link" + (isActive ? " admin-sidebar__link--active" : "")
                }
              >
                <Icon size={18} strokeWidth={2} aria-hidden="true" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-profile" ref={profileMenuRef}>
            <button
              type="button"
              className="admin-profile__trigger"
              aria-expanded={profileOpen}
              aria-haspopup="menu"
              aria-label={`Open profile menu for ${displayName}`}
              onClick={() => setProfileOpen((open) => !open)}
            >
              <span className="admin-topbar__avatar" aria-hidden="true">{initials}</span>
              <ChevronDown size={15} aria-hidden="true" />
            </button>
            {profileOpen && (
              <div className="admin-profile__menu" role="menu">
                <div className="admin-profile__identity">
                  <strong>{displayName}</strong>
                  <span>{user?.email || "Admin account"}</span>
                </div>
                <button type="button" className="admin-profile__logout" role="menuitem" onClick={handleSignOut}>
                  <LogOut size={16} aria-hidden="true" />
                  Log out
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
