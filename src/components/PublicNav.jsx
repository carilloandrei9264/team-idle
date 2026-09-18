import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "../context/useAuth";
import "./PublicNav.css";

const LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/browse", label: "Browse" },
  { to: "/bank-catalog", label: "Bank Catalog" },
];

export default function PublicNav() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuRef = useRef(null);

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
    <header className="public-nav">
      <Link to="/" className="public-nav__brand">
        TrustHome
      </Link>

      <button
        type="button"
        className="public-nav__mobile-toggle"
        onClick={() => setMobileNavOpen((open) => !open)}
        aria-expanded={mobileNavOpen}
        aria-controls="public-navigation"
        aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
      >
        {mobileNavOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
      </button>

      <nav id="public-navigation" className={`public-nav__links${mobileNavOpen ? " public-nav__links--open" : ""}`} aria-label="Main navigation">
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

      <div className="public-nav__actions">
        {user ? (
          <>
            <Link to="/my-listings" className="btn btn--secondary public-nav__cta">
              My Listings
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
                  <Link to="/account" role="menuitem" onClick={() => setMenuOpen(false)}>
                    Account
                  </Link>
                  <Link to="/my-bookings" role="menuitem" onClick={() => setMenuOpen(false)}>
                    My bookings
                  </Link>
                  <Link to="/booking-requests" role="menuitem" onClick={() => setMenuOpen(false)}>
                    Booking requests
                  </Link>
                  <Link to="/saved-searches" role="menuitem" onClick={() => setMenuOpen(false)}>
                    Saved searches
                  </Link>
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
      </div>
    </header>
  );
}
