import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Clipboard, ClipboardCheck, Home, Landmark, MapPin, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import PublicNav from "../components/PublicNav";
import { db } from "../firebase";
import { formatCurrency, numericValue } from "../lib/number";
import { BANK_LABELS, CURRENT_BANKS } from "../lib/bankCatalog";
import "./UserPages.css";
import "./BankCatalog.css";

// ── Framer Motion variants ────────────────────────────────────────────────────

// Page-level fade transition (200ms) — satisfies "subtle page transition" ask
const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit:    { opacity: 0, transition: { duration: 0.15 } },
};

const gridVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const cardVariants = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
};

// ── Property type → icon mapping ──────────────────────────────────────────────
function PropertyIcon({ type, size = 36 }) {
  // Uses a consistent house SVG regardless of type so it looks intentional
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      style={{ color: "#94A3B8" /* slate-400 */ }}
    >
      <path
        d="M6 22L24 6L42 22V42H30V30H18V42H6V22Z"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

// ── Structured placeholder image ──────────────────────────────────────────────
// TODO: Replace placeholder with real image from bank API
// Expected format: { imageUrl: string } in property object
function PropertyImagePlaceholder({ type }) {
  const label = type || "Property";
  return (
    <div className="bp-card__placeholder" aria-hidden="true">
      <PropertyIcon size={40} />
      <span className="bp-card__placeholder-label">{label}</span>
    </div>
  );
}

// ── Loading skeleton (3 pulsing cards) ───────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bp-card bp-card--skeleton" aria-hidden="true">
      <div className="bp-card__image-wrap bp-skeleton" />
      <div className="bp-card__body">
        <div className="bp-skeleton bp-skeleton--line bp-skeleton--title" />
        <div className="bp-skeleton bp-skeleton--line bp-skeleton--short" />
        <div className="bp-skeleton bp-skeleton--line bp-skeleton--medium" />
        <div className="bp-skeleton bp-skeleton--line bp-skeleton--btn" />
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ onClear }) {
  return (
    <div className="bc-empty" role="status">
      {/* Muted house illustration */}
      <div className="bc-empty__icon" aria-hidden="true">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <path
            d="M8 30L32 8L56 30V56H40V40H24V56H8V30Z"
            stroke="#CBD5E1"
            strokeWidth="3"
            strokeLinejoin="round"
            fill="#F1F5F9"
          />
          <circle cx="50" cy="14" r="10" fill="#FEE2E2" />
          <path d="M46 14h8M50 10v8" stroke="#F87171" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <h2 className="bc-empty__title">No properties match your filters</h2>
      <p className="bc-empty__body">Try adjusting the bank, city, or price limit.</p>
      <button type="button" className="btn btn--secondary bc-empty__btn" onClick={onClear}>
        <X size={14} aria-hidden="true" />
        Clear filters
      </button>
    </div>
  );
}

// ── Result count badge ────────────────────────────────────────────────────────
// Flashes a brief highlight animation whenever the count changes.
function ResultCountBadge({ count, filtered }) {
  const [flash, setFlash] = useState(false);
  const prevCount = useRef(count);

  useEffect(() => {
    if (prevCount.current !== count) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 600);
      prevCount.current = count;
      return () => clearTimeout(t);
    }
  }, [count]);

  return (
    <p className={`bank-catalog__count${flash ? " bank-catalog__count--flash" : ""}`}>
      <span className="bank-catalog__count-num">{count}</span>
      {" "}
      {filtered ? "matching" : "active"} propert{count === 1 ? "y" : "ies"}
    </p>
  );
}

// ── Copy-address button ───────────────────────────────────────────────────────
function CopyAddressButton({ address }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e) {
    e.preventDefault(); // card is a link — stop navigation
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — silent fail
    }
  }

  return (
    <div className="bp-card__copy-wrap">
      <button
        type="button"
        className="bp-card__copy-btn"
        onClick={handleCopy}
        aria-label={copied ? "Address copied" : "Copy address to clipboard"}
        title={copied ? "Copied!" : "Copy address"}
      >
        {copied
          ? <ClipboardCheck size={13} aria-hidden="true" />
          : <Clipboard size={13} aria-hidden="true" />
        }
      </button>
      <AnimatePresence>
        {copied && (
          <motion.span
            className="bp-card__copy-tooltip"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            role="status"
            aria-live="polite"
          >
            Copied!
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Bank property card ────────────────────────────────────────────────────────
const BankPropertyCard = ({ property, onKeyNav }) => {
  const [imgError, setImgError] = useState(false);
  const address = property.location || "";

  return (
    <article
      className="bp-card"
      // data attribute for future image wiring
      data-image-url={property.imageUrl || ""}
      // Keyboard navigation: arrow keys handled by parent grid
      onKeyDown={onKeyNav}
      tabIndex={0}
      aria-label={property.title || "Bank-acquired property"}
    >
      {/* ── Image / placeholder ── */}
      <div className="bp-card__image-wrap">
        {/*
          TODO: Replace placeholder with real image from bank API
          Expected format: { imageUrl: string } in property object
        */}
        {property.imageUrl && !imgError ? (
          <img
            src={property.imageUrl}
            alt={property.title || "Bank-acquired property"}
            className="bp-card__image"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <PropertyImagePlaceholder type={property.propertyType || property.type} />
        )}
        <span className="badge badge--verified bp-card__bank-badge">
          {BANK_LABELS[property.bank] || property.bank || "Bank property"}
        </span>
      </div>

      {/* ── Body ── */}
      <div className="bp-card__body">
        <h2 className="bp-card__title">{property.title || "Untitled bank property"}</h2>

        {/* Address — flex-1 so it pushes footer to bottom; line-clamp-3 */}
        <div className="bp-card__location-row">
          <p className="bp-card__location">
            <MapPin size={13} aria-hidden="true" />
            <span className="bp-card__location-text">{address || "Location not provided"}</span>
          </p>
          {address && <CopyAddressButton address={address} />}
        </div>

        {/* Footer pinned to bottom via mt-auto */}
        <div className="bp-card__footer">
          <p className="bp-card__price">{formatCurrency(property.price)}</p>
          <p className="bp-card__meta">
            Last verified: {formatDate(property.lastSeen || property.firstSeen)}
          </p>
          <Link
            className="btn btn--primary bp-card__cta"
            to={`/bank-catalog/${property.id}`}
            tabIndex={-1}   /* card itself is focusable; Enter activates this */
          >
            View property and loan estimate
          </Link>
        </div>
      </div>
    </article>
  );
};

// ── Back-to-top button ────────────────────────────────────────────────────────
function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() { setVisible(window.scrollY > 400); }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          className="bc-back-to-top"
          onClick={scrollTop}
          aria-label="Back to top"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.2 }}
        >
          ↑
        </motion.button>
      )}
    </AnimatePresence>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BankCatalog() {
  const [properties, setProperties] = useState([]);
  const [bank, setBank]             = useState("");
  const [city, setCity]             = useState("");
  const [maxPrice, setMaxPrice]     = useState("");
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const gridRef = useRef(null);
  const location = useLocation();

  useEffect(() => onSnapshot(
    query(collection(db, "bankProperties"), where("status", "==", "active")),
    (snapshot) => {
      setProperties(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
      setError("");
    },
    () => {
      setLoading(false);
      setError("The bank property catalog could not be loaded. Please try again later.");
    }
  ), []);

  const results = useMemo(() => properties.filter((p) => {
    if (String(p.status || "active").toLowerCase() !== "active") return false;
    if (bank && String(p.bank || "").toLowerCase() !== bank) return false;
    if (city.trim() && !String(p.location || "").toLowerCase().includes(city.trim().toLowerCase())) return false;
    if (maxPrice && numericValue(p.price) > numericValue(maxPrice)) return false;
    return true;
  }), [bank, city, maxPrice, properties]);

  const isFiltered = Boolean(bank || city.trim() || maxPrice);
  const animationKey = `${bank}-${city}-${maxPrice}`;

  function clearFilters() {
    setBank("");
    setCity("");
    setMaxPrice("");
  }

  // ── Keyboard navigation: arrow keys move focus between cards ──────────────
  const handleCardKeyNav = useCallback((e) => {
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Enter"].includes(e.key)) return;
    const cards = Array.from(gridRef.current?.querySelectorAll(".bp-card") ?? []);
    const idx = cards.indexOf(e.currentTarget);
    if (idx === -1) return;

    if (e.key === "Enter") {
      // Navigate to the detail page — find the CTA link inside the card
      e.currentTarget.querySelector("a")?.click();
      return;
    }

    e.preventDefault();
    // ArrowRight / ArrowDown → next; ArrowLeft / ArrowUp → previous
    const next = (e.key === "ArrowRight" || e.key === "ArrowDown")
      ? cards[idx + 1]
      : cards[idx - 1];
    next?.focus();
  }, []);

  return (
    <motion.div
      className="user-page"
      key={location.pathname}
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <PublicNav />

      <main className="user-page__content bank-catalog-page">
        {/* ── Page header — NOT sticky ── */}
        <p className="user-page__eyebrow">Public catalog</p>
        <h1>Bank-acquired properties</h1>
        <p className="user-page__intro">
          Properties collected from participating bank websites. Verify details
          with the original bank listing before making a decision.
        </p>

        {/* ── Filters ── */}
        <section className="bank-catalog__filters" aria-label="Filter bank properties">
          <div className="field">
            <label className="field__label" htmlFor="bank-filter">Bank</label>
            <select
              id="bank-filter"
              className="field__input"
              value={bank}
              onChange={(e) => setBank(e.target.value)}
            >
              <option value="">All banks</option>
              {CURRENT_BANKS.map((name) => (
                <option key={name} value={name}>{BANK_LABELS[name]}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="bank-city-filter">City or location</label>
            <input
              id="bank-city-filter"
              className="field__input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Laguna"
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="bank-price-filter">Maximum price</label>
            <input
              id="bank-price-filter"
              className="field__input"
              type="number"
              min="0"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="No limit"
            />
          </div>
        </section>

        <p className="bank-catalog__note">
          Currently showing Metrobank listings — more banks coming soon
        </p>

        {/* ── Content area ── */}
        {loading ? (
          // Loading skeleton — 3 pulsing placeholder cards
          <div className="bank-catalog__grid" aria-busy="true" aria-label="Loading properties">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : error ? (
          <div className="user-page__empty" role="alert"><p>{error}</p></div>
        ) : results.length === 0 ? (
          <EmptyState onClear={clearFilters} />
        ) : (
          <>
            {/* Live result count badge */}
            <div className="bank-catalog__results-header">
              <ResultCountBadge count={results.length} filtered={isFiltered} />
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={animationKey}
                ref={gridRef}
                className="bank-catalog__grid"
                variants={gridVariants}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
              >
                {results.map((property) => (
                  <motion.div
                    key={property.id}
                    variants={cardVariants}
                    style={{ height: "100%" }}
                  >
                    <BankPropertyCard
                      property={property}
                      onKeyNav={handleCardKeyNav}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </main>

      <BackToTop />
    </motion.div>
  );
}

function formatDate(value) {
  const ms = value?.toMillis?.() || (value ? Date.parse(value) : 0);
  return ms
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(ms)
    : "Not available";
}
