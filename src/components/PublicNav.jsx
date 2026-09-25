import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, Menu, Moon, Sun, X } from "lucide-react";
import { useAuth } from "../context/useAuth";
import { useTheme } from "../context/useTheme";
import NotificationBell from "./NotificationBell";
import "./PublicNav.css";

const LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/browse", label: "Browse" },
  { to: "/bank-catalog", label: "Bank Catalog" },
];

export default function PublicNav() {
  const { user, profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef(null);

  // Scroll-triggered shadow — adds class when user scrolls past 4px
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

  async function handleSignOut() {
    setMenuOpen(false);
    await signOut();
    navigate("/", { replace: true });
  }

  function handleNavClick() {
    setMobileNavOpen(false);
  }

  return (
    <header className={`public-nav${scrolled ? " public-nav--scrolled" : ""}`}>
      {/*
        3-column grid:
          col 1 (left)   → brand logo
          col 2 (center) → nav links — absolutely centred via justify-self:center
          col 3 (right)  → theme toggle + auth actions
        On mobile the center col collapses and the hamburger takes its place.
      */}
      <div className="public-nav__inner">

        {/* ── Col 1: Brand — "Trust" gradient, "Home" plain ── */}
        <Link to="/" className="public-nav__brand" aria-label="TrustHome — go to home">
          <span className="public-nav__brand-gradient">Trust</span>
          <span className="public-nav__brand-plain">Home</span>
        </Link>

        {/* ── Col 2: Desktop nav links (centered) ── */}
        <nav
          id="public-navigation"
          className={`public-nav__links${mobileNavOpen ? " public-nav__links--open" : ""}`}
          aria-label="Main navigation"
        >
          {LINKS.map(({ to, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                "public-nav__link" + (isActive ? " public-nav__link--active" : "")
              }
              onClick={handleNavClick}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* ── Col 3: Right-side actions ── */}
        <div className="public-nav__actions">

          {/* Dark / light toggle — icon rotates 180° on swap */}
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
              {theme === "dark"
                ? <Sun size={18} aria-hidden="true" />
                : <Moon size={18} aria-hidden="true" />
              }
            </span>
          </button>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="public-nav__mobile-toggle"
            onClick={() => setMobileNavOpen((open) => !open)}
            aria-expanded={mobileNavOpen}
            aria-controls="public-navigation"
            aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
          >
            {mobileNavOpen
              ? <X size={20} aria-hidden="true" />
              : <Menu size={20} aria-hidden="true" />
            }
          </button>

          {/* Auth */}
          {user ? (
            <>
              <NotificationBell />
              <Link to="/my-listings" className="btn btn--secondary public-nav__cta">
                My Listings
              </Link>
              <Link to="/dashboard" className="btn btn--secondary public-nav__cta">
                Dashboard
              </Link>
              <Link to="/my-bookings" className="btn btn--secondary public-nav__cta">
                My Bookings
              </Link>
              <div className="public-nav__profile" ref={menuRef}>
                <button
                  type="button"
                  className="public-nav__profile-trigger"
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  aria-label={`Open account menu for ${profile?.name || user.email}`}
                >
                  <span className="public-nav__avatar" aria-hidden="true">
                    {(profile?.name || user.email || "?").charAt(0).toUpperCase()}
                  </span>
                  <ChevronDown size={15} aria-hidden="true" />
                </button>
                {menuOpen && (
                  <div className="public-nav__menu" role="menu">
                    <div className="public-nav__identity">
                      <strong>{profile?.name || "TrustHome member"}</strong>
                      <span>{user.email}</span>
                    </div>
                    <Link to="/account" role="menuitem" onClick={() => setMenuOpen(false)}>Account</Link>
                    <Link to="/dashboard" role="menuitem" onClick={() => setMenuOpen(false)}>Dashboard</Link>
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
            <button
              type="button"
              className="btn btn--primary public-nav__cta"
              onClick={() => navigate("/login")}
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
