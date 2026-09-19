import { Link } from "react-router-dom";
import "./Footer.css";

const QUICK_LINKS = [
  { to: "/", label: "Home" },
  { to: "/browse", label: "Browse Listings" },
  { to: "/bank-catalog", label: "Bank Catalog" },
];

export default function Footer() {
  return (
    <footer className="site-footer" role="contentinfo">
      <div className="site-footer__inner">

        {/* ── Col 1: Brand + tagline ── */}
        <div className="site-footer__brand">
          <Link to="/" className="site-footer__logo" aria-label="TrustHome — go to home">
            <span className="site-footer__logo-gradient">Trust</span>
            <span className="site-footer__logo-plain">Home</span>
          </Link>
          <p className="site-footer__tagline">
            Rentals ranked by real accountability,<br />not just price.
          </p>
          <p className="site-footer__sub">Philippines · 2026</p>
        </div>

        {/* ── Col 2: Quick links ── */}
        <nav className="site-footer__nav" aria-label="Footer navigation">
          <p className="site-footer__heading">Quick links</p>
          <ul className="site-footer__links">
            {QUICK_LINKS.map(({ to, label }) => (
              <li key={to}>
                <Link to={to} className="site-footer__link">{label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* ── Col 3: Contact ── */}
        <div className="site-footer__contact">
          <p className="site-footer__heading">Contact</p>
          <a
            href="mailto:hello@trusthome.ph"
            className="site-footer__link"
          >
            hello@trusthome.ph
          </a>
          <div className="site-footer__socials" aria-label="Social media links">
            {/* Facebook */}
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              className="site-footer__social-icon"
              aria-label="Facebook"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
              </svg>
            </a>
            {/* Instagram */}
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="site-footer__social-icon"
              aria-label="Instagram"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                <circle cx="12" cy="12" r="4" />
                <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
              </svg>
            </a>
            {/* X / Twitter */}
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="site-footer__social-icon"
              aria-label="X (Twitter)"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div className="site-footer__bottom">
        <p>© 2026 TrustHome Philippines. All rights reserved.</p>
      </div>
    </footer>
  );
}
