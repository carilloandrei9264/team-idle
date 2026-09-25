import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  Bell, Bookmark, Building2, CalendarCheck, ChevronDown, Home, Inbox, Landmark, LayoutDashboard,
  LogOut, Menu, Moon, Search, Sun, UserRound, X,
} from "lucide-react";
import { useAuth } from "../context/useAuth";
import { useTheme } from "../context/useTheme";
import NotificationBell from "./NotificationBell";
import "./PublicNav.css";

const LINKS = [
  { to: "/", label: "Home", end: true, icon: Home },
  { to: "/browse", label: "Browse", icon: Search },
  { to: "/bank-catalog", label: "Bank Catalog", icon: Landmark },
];

// Shown in the mobile drawer once signed in
const MEMBER_LINKS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/my-listings", label: "My listings", icon: Building2 },
  { to: "/my-bookings", label: "My bookings", icon: CalendarCheck },
  { to: "/booking-requests", label: "Booking requests", icon: Inbox },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/saved-searches", label: "Saved searches", icon: Bookmark },
  { to: "/account", label: "Account", icon: UserRound },
];

// Shows the profile photo when one exists (profile.photoURL or the auth photo),
// otherwise the first letter of the name.
function Avatar({ user, profile, className = "" }) {
  const name = profile?.name || user.displayName || user.email || "?";
  const photo = profile?.photoURL || user.photoURL;
  return (
    <span className={`public-nav__avatar ${className}`} aria-hidden="true">
      {photo
        ? <img src={photo} alt="" referrerPolicy="no-referrer" />
        : name.charAt(0).toUpperCase()}
    </span>
  );
}

export default function PublicNav() {
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef(null);
  const closeRef = useRef(null);

  const displayName = profile?.name || user?.displayName || "TrustHome member";
  const closeDrawer = () => setDrawerOpen(false);

  useEffect(() => {
    function onScroll() { setScrolled(window.scrollY > 4); }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function closeMenu(event) {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, [menuOpen]);

  // Drawer: lock page scroll, close on Escape or when resized up to desktop
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const mq = window.matchMedia("(min-width: 860px)");
    const onKey = (e) => { if (e.key === "Escape") setDrawerOpen(false); };
    const onResize = () => { if (mq.matches) setDrawerOpen(false); };
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onResize);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onResize);
    };
  }, [drawerOpen]);

  async function handleSignOut() {
    setMenuOpen(false);
    setDrawerOpen(false);
    await signOut();
    navigate("/", { replace: true });
  }

  const navLinkClass = (base) => ({ isActive }) =>
    `${base}${isActive ? ` ${base}--active` : ""}`;

  return (
    <>
      <header className={`public-nav${scrolled ? " public-nav--scrolled" : ""}`}>
        <div className="public-nav__inner">
          <Link to="/" className="public-nav__brand" aria-label="TrustHome — go to home">
            <span className="public-nav__brand-gradient">Trust</span>
            <span className="public-nav__brand-plain">Home</span>
          </Link>

          {/* Desktop links */}
          <nav className="public-nav__links" aria-label="Main navigation">
            {LINKS.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={navLinkClass("public-nav__link")}>
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="public-nav__actions">
            {/* Desktop-only: theme toggle + auth (phones get these in the drawer) */}
            <button
              type="button"
              className="public-nav__theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              <span
                className="public-nav__theme-icon"
                style={{ transform: theme === "dark" ? "rotate(180deg)" : "rotate(0deg)" }}
              >
                {theme === "dark" ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
              </span>
            </button>

            {user ? (
              <>
                <NotificationBell />
                <Link to="/my-listings" className="btn btn--secondary public-nav__cta">My Listings</Link>
                <Link to="/dashboard" className="btn btn--secondary public-nav__cta">Dashboard</Link>
                <Link to="/my-bookings" className="btn btn--secondary public-nav__cta">My Bookings</Link>
                <div className="public-nav__profile" ref={menuRef}>
                  <button
                    type="button"
                    className="public-nav__profile-trigger"
                    onClick={() => setMenuOpen((open) => !open)}
                    aria-expanded={menuOpen}
                    aria-haspopup="menu"
                    aria-label={`Open account menu for ${displayName}`}
                  >
                    <Avatar user={user} profile={profile} />
                    <ChevronDown size={15} aria-hidden="true" />
                  </button>
                  {menuOpen && (
                    <div className="public-nav__menu" role="menu">
                      <div className="public-nav__identity">
                        <strong>{displayName}</strong>
                        <span>{user.email}</span>
                      </div>
                      <Link to="/dashboard" role="menuitem" onClick={() => setMenuOpen(false)}>Dashboard</Link>
                      <Link to="/account" role="menuitem" onClick={() => setMenuOpen(false)}>Account</Link>
                      <Link to="/notifications" role="menuitem" onClick={() => setMenuOpen(false)}>Notifications</Link>
                      <Link to="/my-bookings" role="menuitem" onClick={() => setMenuOpen(false)}>My bookings</Link>
                      <Link to="/booking-requests" role="menuitem" onClick={() => setMenuOpen(false)}>Booking requests</Link>
                      <Link to="/saved-searches" role="menuitem" onClick={() => setMenuOpen(false)}>Saved searches</Link>
                      <button type="button" role="menuitem" onClick={handleSignOut}>
                        <LogOut size={16} aria-hidden="true" />
                        Log out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <button type="button" className="btn btn--primary public-nav__cta" onClick={() => navigate("/login")}>
                Sign in
              </button>
            )}

            {/* Mobile: avatar (when signed in) + hamburger both open the drawer */}
            {user && (
              <button
                type="button"
                className="public-nav__mobile-avatar"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open menu"
              >
                <Avatar user={user} profile={profile} />
              </button>
            )}
            <button
              type="button"
              className="public-nav__mobile-toggle"
              onClick={() => setDrawerOpen(true)}
              aria-expanded={drawerOpen}
              aria-controls="mobile-drawer"
              aria-label="Open navigation menu"
            >
              <Menu size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* Drawer lives outside <header>: the header's backdrop-filter would break position:fixed */}
      <div
        id="mobile-drawer"
        className={`nav-drawer${drawerOpen ? " nav-drawer--open" : ""}`}
        aria-hidden={!drawerOpen}
      >
        <div className="nav-drawer__scrim" onClick={closeDrawer} />
        <aside className="nav-drawer__panel" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="nav-drawer__head">
            <button
              type="button"
              className="nav-drawer__close"
              onClick={closeDrawer}
              ref={closeRef}
              aria-label="Close menu"
            >
              <X size={20} aria-hidden="true" />
            </button>

            {user ? (
              <Link to="/account" className="nav-drawer__profile" onClick={closeDrawer}>
                <Avatar user={user} profile={profile} className="nav-drawer__avatar" />
                <span className="nav-drawer__who">
                  <strong>{displayName}</strong>
                  <span>{user.email}</span>
                </span>
              </Link>
            ) : (
              <div className="nav-drawer__guest">
                <strong>Welcome to TrustHome</strong>
                <span>Sign in to book, save searches, and list a property.</span>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => { closeDrawer(); navigate("/login"); }}
                >
                  Sign in
                </button>
              </div>
            )}
          </div>

          <nav className="nav-drawer__body" aria-label="Menu">
            <div className="nav-drawer__group">
              {LINKS.map(({ to, label, end, icon: Icon }) => (
                <NavLink key={to} to={to} end={end} className={navLinkClass("nav-drawer__link")} onClick={closeDrawer}>
                  <Icon size={19} aria-hidden="true" />
                  {label}
                </NavLink>
              ))}
            </div>
            {user && (
              <div className="nav-drawer__group">
                {MEMBER_LINKS.map(({ to, label, icon: Icon }) => (
                  <NavLink key={to} to={to} className={navLinkClass("nav-drawer__link")} onClick={closeDrawer}>
                    <Icon size={19} aria-hidden="true" />
                    {label}
                  </NavLink>
                ))}
              </div>
            )}
          </nav>

          <div className="nav-drawer__foot">
            <button type="button" className="nav-drawer__link" onClick={toggleTheme}>
              {theme === "dark" ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
              Dark mode
              <span className="nav-drawer__switch" data-on={theme === "dark"} aria-hidden="true" />
            </button>
            {user && (
              <button type="button" className="nav-drawer__link nav-drawer__link--danger" onClick={handleSignOut}>
                <LogOut size={19} aria-hidden="true" />
                Log out
              </button>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}