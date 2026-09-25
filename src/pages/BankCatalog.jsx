import { useCallback, useEffect, useRef, useState } from "react";
import {
  collection, getCountFromServer, getDocs, limit, orderBy, query, startAfter, where,
} from "firebase/firestore";
import { ChevronLeft, ChevronRight, Clipboard, ClipboardCheck, MapPin, SlidersHorizontal, X } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import PublicNav from "../components/PublicNav";
import { db } from "../firebase";
import { formatCurrency, numericValue } from "../lib/number";
import { BANK_LABELS, CURRENT_BANKS } from "../lib/bankCatalog";
import "./UserPages.css";
import "./BankCatalog.css";

const PAGE_SIZE = 12;

// Budget slider range. Dragging the top thumb all the way to the end means
// "no upper limit" (mirrors how the numeric Max field being empty behaves).
const SLIDER_MAX = 50_000_000;
const SLIDER_STEP = 100_000;

function formatCompactPrice(value) {
  if (value >= SLIDER_MAX) return "₱50M+";
  if (!value) return "₱0";
  return `₱${new Intl.NumberFormat("en-PH", { notation: "compact", maximumFractionDigits: 1 }).format(value)}`;
}

// Firestore has no "contains" query, so the scraper stores lowercase word prefixes
// in `searchKeywords`. We search on the longest word (3+ letters) the visitor typed.
function searchWord(text) {
  const words = String(text || "").toLowerCase().match(/[a-z0-9ñ]{3,}/g) || [];
  return words.sort((a, b) => b.length - a.length)[0] || "";
}

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
function PropertyIcon({ size = 36 }) {
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
            decoding="async"
            referrerPolicy="no-referrer"
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

        {(property.floorArea || property.lotArea) && (
          <div className="bp-card__stats">
            {property.floorArea && <span>{property.floorArea} floor area</span>}
            {property.floorArea && property.lotArea && <span aria-hidden="true">·</span>}
            {property.lotArea && <span>{property.lotArea} lot area</span>}
          </div>
        )}

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
  const [bank, setBank]             = useState("");
  const [city, setCity]             = useState("");
  const [maxPrice, setMaxPrice]     = useState("");
  const gridRef = useRef(null);
  const location = useLocation();

  // Filters are debounced so typing doesn't fire a query per keystroke
  const [minPrice, setMinPrice] = useState("");
  const sliderMin = numericValue(minPrice, 0);
  const sliderMax = maxPrice ? numericValue(maxPrice, SLIDER_MAX) : SLIDER_MAX;
  const [sort, setSort] = useState("price-asc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cityTerm, setCityTerm] = useState("");
  const [minTerm, setMinTerm] = useState("");
  const [maxTerm, setMaxTerm] = useState("");
  useEffect(() => {
    const t = setTimeout(() => { setCityTerm(city); setMinTerm(minPrice); setMaxTerm(maxPrice); }, 400);
    return () => clearTimeout(t);
  }, [city, minPrice, maxPrice]);

  // Mobile filter drawer: lock page scroll, close on Escape or when resized to desktop
  useEffect(() => {
    if (!filtersOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const mq = window.matchMedia("(min-width: 900px)");
    const onKey = (e) => { if (e.key === "Escape") setFiltersOpen(false); };
    const onResize = () => { if (mq.matches) setFiltersOpen(false); };
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onResize);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onResize);
    };
  }, [filtersOpen]);

  const cityWord = searchWord(cityTerm);
  const minLimit = numericValue(minTerm, 0); // 0 = no limit
  const maxLimit = numericValue(maxTerm, 0);
  const filterKey = `${bank}|${cityWord}|${minLimit}|${maxLimit}|${sort}`;

  // Cursor pagination: Firestore can't jump to page N, so we remember the last
  // document of every page we've visited and start the next query after it.
  const [pageState, setPageState] = useState({ key: filterKey, page: 0 });
  const page = pageState.key === filterKey ? pageState.page : 0;
  const requestKey = `${filterKey}#${page}`;
  const cursors = useRef({ key: filterKey, docs: [] });
  const [result, setResult] = useState({ key: "", items: [], total: 0, error: "" });
  const loading = result.key !== requestKey;

  useEffect(() => {
    if (cursors.current.key !== filterKey) cursors.current = { key: filterKey, docs: [] };
    let cancelled = false;
    const base = [
      where("status", "==", "active"),
      ...(bank ? [where("bank", "==", bank)] : []),
      ...(cityWord ? [where("searchKeywords", "array-contains", cityWord)] : []),
      minLimit ? where("price", ">=", minLimit) : where("price", ">", 0),
      ...(maxLimit ? [where("price", "<=", maxLimit)] : []),
    ];
    const col = collection(db, "bankProperties");
    const after = cursors.current.docs[page - 1];

    Promise.all([
      getDocs(query(col, ...base, orderBy("price", sort === "price-desc" ? "desc" : "asc"), ...(after ? [startAfter(after)] : []), limit(PAGE_SIZE))),
      page === 0 ? getCountFromServer(query(col, ...base)) : null,
    ])
      .then(([snap, count]) => {
        if (cancelled) return;
        cursors.current.docs[page] = snap.docs[snap.docs.length - 1];
        setResult((prev) => ({
          key: requestKey,
          items: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
          total: count ? count.data().count : prev.total,
          error: "",
        }));
      })
      .catch(() => {
        if (!cancelled) {
          setResult({ key: requestKey, items: [], total: 0, error: "The bank property catalog could not be loaded. Please try again later." });
        }
      });
    return () => { cancelled = true; };
  }, [bank, cityWord, minLimit, maxLimit, sort, page, filterKey, requestKey]);

  const results = result.items;
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  function goToPage(next) {
    setPageState({ key: filterKey, page: next });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const isFiltered = Boolean(bank || cityWord || minLimit || maxLimit);

  // Active-filter chips (built from the raw inputs so they react instantly)
  const budgetLabel = minPrice && maxPrice
    ? `${formatCurrency(minPrice)} – ${formatCurrency(maxPrice)}`
    : minPrice ? `From ${formatCurrency(minPrice)}` : `Up to ${formatCurrency(maxPrice)}`;
  const chips = [
    bank && { label: BANK_LABELS[bank] || bank, clear: () => setBank("") },
    city.trim() && { label: `Location: ${city.trim()}`, clear: () => setCity("") },
    (minPrice || maxPrice) && { label: budgetLabel, clear: () => { setMinPrice(""); setMaxPrice(""); } },
  ].filter(Boolean);

  function clearFilters() {
    setBank(""); setCity(""); setMinPrice(""); setMaxPrice("");
    setCityTerm(""); setMinTerm(""); setMaxTerm("");
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

        <p className="bank-catalog__note">
          Currently showing Metrobank listings — more banks coming soon
        </p>

        <div className="bc-layout">
          {/* ── Filters: sidebar on desktop, slide-in drawer on mobile ── */}
          <aside className={`bc-filters${filtersOpen ? " bc-filters--open" : ""}`} aria-label="Filters">
            <div className="bc-filters__head">
              <h2><SlidersHorizontal size={15} aria-hidden="true" /> Filters</h2>
              {chips.length > 0 && (
                <button type="button" className="bc-filters__clear" onClick={clearFilters}>Clear all</button>
              )}
              <button type="button" className="bc-filters__close" onClick={() => setFiltersOpen(false)} aria-label="Close filters">
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="bc-filters__body">
              <div className="field">
                <label className="field__label" htmlFor="bank-filter">Bank</label>
                <select id="bank-filter" className="field__input" value={bank} onChange={(e) => setBank(e.target.value)}>
                  <option value="">All banks</option>
                  {CURRENT_BANKS.map((name) => (
                    <option key={name} value={name}>{BANK_LABELS[name]}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="field__label" htmlFor="bank-city-filter">Location</label>
                <input
                  id="bank-city-filter"
                  className="field__input"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City or province, e.g. Laguna"
                />
              </div>

              <fieldset className="bc-filters__budget">
                <legend className="field__label">Budget (₱)</legend>

                <div className="bc-slider">
                  <div className="bc-slider__track" aria-hidden="true" />
                  {/* Only show the filled segment once a thumb has actually moved —
                      otherwise a full-width bar reads as "filtered" when it isn't. */}
                  {(sliderMin > 0 || sliderMax < SLIDER_MAX) && (
                    <div
                      className="bc-slider__fill"
                      aria-hidden="true"
                      style={{
                        left: `${(sliderMin / SLIDER_MAX) * 100}%`,
                        right: `${100 - (sliderMax / SLIDER_MAX) * 100}%`,
                      }}
                    />
                  )}
                  <input
                    type="range" className="bc-slider__input" min={0} max={SLIDER_MAX} step={SLIDER_STEP}
                    value={sliderMin} aria-label="Minimum price"
                    onChange={(e) => {
                      const next = Math.min(Number(e.target.value), sliderMax - SLIDER_STEP);
                      setMinPrice(next > 0 ? String(next) : "");
                    }}
                  />
                  <input
                    type="range" className="bc-slider__input" min={0} max={SLIDER_MAX} step={SLIDER_STEP}
                    value={sliderMax} aria-label="Maximum price"
                    onChange={(e) => {
                      const next = Math.max(Number(e.target.value), sliderMin + SLIDER_STEP);
                      setMaxPrice(next < SLIDER_MAX ? String(next) : "");
                    }}
                  />
                </div>
                <p className="bc-slider__labels" aria-hidden="true">
                  <span>{formatCompactPrice(sliderMin)}</span>
                  <span>{formatCompactPrice(sliderMax)}</span>
                </p>

                <div className="bc-filters__range">
                  <input className="field__input" type="number" min="0" inputMode="numeric" placeholder="Min"
                    aria-label="Minimum price, exact amount" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
                  <span aria-hidden="true">to</span>
                  <input className="field__input" type="number" min="0" inputMode="numeric" placeholder="Max"
                    aria-label="Maximum price, exact amount" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
                </div>
              </fieldset>
            </div>

            <div className="bc-filters__foot">
              <button type="button" className="btn btn--primary" onClick={() => setFiltersOpen(false)}>
                {loading ? "Show results" : `Show ${result.total} propert${result.total === 1 ? "y" : "ies"}`}
              </button>
            </div>
          </aside>
          {filtersOpen && <div className="bc-scrim" onClick={() => setFiltersOpen(false)} />}

          <div className="bc-results">
            <div className="bc-toolbar">
              <button
                type="button"
                className="btn btn--secondary bc-toolbar__filters"
                onClick={() => {
                  // Belt-and-suspenders: on desktop the sidebar is always visible and
                  // this button is CSS-hidden, but if that ever gets out of sync (stale
                  // CSS, a resize mid-interaction), don't lock page scroll for a drawer
                  // that has no visible way to close again.
                  if (window.matchMedia("(min-width: 900px)").matches) return;
                  setFiltersOpen(true);
                }}
              >
                <SlidersHorizontal size={16} aria-hidden="true" />
                Filters
                {chips.length > 0 && <span className="bc-toolbar__badge">{chips.length}</span>}
              </button>
              {result.key && !result.error && <ResultCountBadge count={result.total} filtered={isFiltered} />}
              <label className="bc-toolbar__sort">
                <span>Sort by</span>
                <select className="field__input" value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="price-asc">Price: low to high</option>
                  <option value="price-desc">Price: high to low</option>
                </select>
              </label>
            </div>

            {chips.length > 0 && (
              <ul className="bc-chips" aria-label="Active filters">
                {chips.map((c) => (
                  <li key={c.label}>
                    <button type="button" className="bc-chip" onClick={c.clear} aria-label={`Remove filter: ${c.label}`}>
                      {c.label}<X size={12} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {loading ? (
              <div className="bank-catalog__grid" aria-busy="true" aria-label="Loading properties">
                {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : result.error ? (
              <div className="user-page__empty" role="alert"><p>{result.error}</p></div>
            ) : results.length === 0 ? (
              <EmptyState onClear={clearFilters} />
            ) : (
              <>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={requestKey}
                    ref={gridRef}
                    className="bank-catalog__grid"
                    variants={gridVariants}
                    initial="hidden"
                    animate="visible"
                    exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  >
                    {results.map((property) => (
                      <motion.div key={property.id} variants={cardVariants} style={{ height: "100%" }}>
                        <BankPropertyCard property={property} onKeyNav={handleCardKeyNav} />
                      </motion.div>
                    ))}
                  </motion.div>
                </AnimatePresence>

                {totalPages > 1 && (
                  <nav className="bc-pager" aria-label="Pagination">
                    <button type="button" className="btn btn--secondary" disabled={page === 0} onClick={() => goToPage(page - 1)}>
                      <ChevronLeft size={16} aria-hidden="true" /> Previous
                    </button>
                    <span className="bc-pager__info" aria-live="polite">Page {page + 1} of {totalPages}</span>
                    <button type="button" className="btn btn--secondary" disabled={page + 1 >= totalPages} onClick={() => goToPage(page + 1)}>
                      Next <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  </nav>
                )}
              </>
            )}
          </div>
        </div>
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