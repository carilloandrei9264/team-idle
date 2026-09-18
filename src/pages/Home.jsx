import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import PublicNav from "../components/PublicNav";
import Footer from "../components/Footer";
import ListingCard from "../components/ListingCard";
import {
  Search, ShieldCheck, TrendingUp, MessageSquareWarning,
  ChevronDown, MapPin, Star, ArrowRight,
} from "lucide-react";

// HOW_IT_WORKS is kept for the hero accordion only — the standalone
// value-prop section has been removed (hero subtext already covers it).
import { motion, useInView } from "framer-motion";
import "./Home.css";

// ── Value-prop data — each item carries its own left-border accent class ────
const HOW_IT_WORKS = [
  {
    icon: ShieldCheck,
    title: "Every listing is checked",
    body: "Owners upload an ID or ownership document that's matched against their account before a listing goes public.",
    accent: "how-it-works__item--emerald",
  },
  {
    icon: TrendingUp,
    title: "Ranked by trust, not just price",
    body: "Listings are ordered by completed bookings and ratings — not who paid for the top spot.",
    accent: "how-it-works__item--blue",
  },
  {
    icon: MessageSquareWarning,
    title: "Disputes stay on the record",
    body: "If something goes wrong, it's reviewed and reflected on the owner's public profile — not buried.",
    accent: "how-it-works__item--amber",
  },
];

// ── Sample properties (hardcoded until real data populates) ─────────────────
const SAMPLE_PROPERTIES = [
  {
    id: "sample-1",
    title: "2BR Apartment in Cebu IT Park",
    price: "₱15,000",
    period: "mo",
    location: "Cebu IT Park, Cebu City",
    trust: 4.8,
    image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&q=80",
  },
  {
    id: "sample-2",
    title: "3BR House in Talisay",
    price: "₱28,000",
    period: "mo",
    location: "Talisay City, Cebu",
    trust: 4.6,
    image: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=600&q=80",
  },
  {
    id: "sample-3",
    title: "Studio in Cebu City",
    price: "₱8,500",
    period: "mo",
    location: "Cebu City",
    trust: 4.9,
    image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&q=80",
  },
];

// ── FadeUpSection — scroll-triggered fade+translateY ─────────────────────
function FadeUpSection({ children, delay = 0, className = "" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 14 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

// ── TextShimmer — "trust" word only ─────────────────────────────────────────
// Surrounding text is plain; only this span gets the gradient sweep.
function HeroHeadline() {
  return (
    <h1 className="hero__title" aria-label="Find a place you can actually trust.">
      <span className="hero__title-plain">Find a place you can actually </span>
      <span className="text-shimmer" aria-hidden="true">trust</span>
      <span className="hero__title-plain">.</span>
    </h1>
  );
}

// ── Eyebrow pill badge ───────────────────────────────────────────────────────
function EyebrowBadge() {
  return (
    <div className="hero__eyebrow-wrap">
      <span className="hero__eyebrow-badge">TrustHome Philippines</span>
    </div>
  );
}

// ── Section divider ──────────────────────────────────────────────────────────
function SectionDivider() {
  return <div className="section-divider" aria-hidden="true" />;
}

// ── Card-split accordion hero ────────────────────────────────────────────────
function CardSplitAccordionHero({ searchCity, setSearchCity, onSearch }) {
  const [open, setOpen] = useState(null);

  function toggle(idx) {
    setOpen((prev) => (prev === idx ? null : idx));
  }

  return (
    <section className="hero-split" aria-label="TrustHome hero">
      <div className="hero-split__glow" aria-hidden="true" />
      <div className="hero-split__noise" aria-hidden="true" />
      {/* Decorative 3D rotating diamond */}
      <div className="hero__diamond" aria-hidden="true" />

      {/* Left — floating panel */}
      <motion.div
        className="hero-split__left"
        animate={{ y: [0, -4, 0, 4, 0] }}
        transition={{ duration: 3, ease: "easeInOut", repeat: Infinity, repeatType: "loop" }}
      >
        <EyebrowBadge />
        <HeroHeadline />
        <p className="hero__subtitle">
          Rentals ranked by real accountability, not just price.
        </p>

        <form className="hero__search" onSubmit={onSearch}>
          <Search size={18} className="hero__search-icon" aria-hidden="true" />
          <input
            type="text"
            className="hero__search-input"
            placeholder="Search by city — e.g. Cabuyao, Laguna"
            value={searchCity}
            onChange={(e) => setSearchCity(e.target.value)}
            aria-label="Search by city"
          />
          <button type="submit" className="btn btn--primary hero__search-btn">
            Search
          </button>
        </form>
      </motion.div>

      {/* Right — accordion */}
      <div className="hero-split__right" aria-label="How TrustHome works">
        {HOW_IT_WORKS.map(({ icon: Icon, title, body }, idx) => (
          <div
            key={title}
            className={`hero-accordion__item${open === idx ? " hero-accordion__item--open" : ""}`}
          >
            <button
              type="button"
              className="hero-accordion__trigger"
              onClick={() => toggle(idx)}
              aria-expanded={open === idx}
              aria-controls={`accordion-body-${idx}`}
            >
              <span className="hero-accordion__icon-wrap">
                <Icon size={18} aria-hidden="true" />
              </span>
              <span className="hero-accordion__title">{title}</span>
              <ChevronDown size={16} className="hero-accordion__chevron" aria-hidden="true" />
            </button>
            <div
              id={`accordion-body-${idx}`}
              className="hero-accordion__body"
              role="region"
              hidden={open !== idx}
            >
              <p>{body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Sample property card ─────────────────────────────────────────────────────
function SamplePropertyCard({ property }) {
  return (
    <Link to="/browse" className="sample-card" aria-label={`View ${property.title}`}>
      <div className="sample-card__image-wrap">
        <img
          src={property.image}
          alt={property.title}
          className="sample-card__image"
          loading="lazy"
        />
        <span className="sample-card__trust" aria-label={`Trust score ${property.trust}`}>
          <Star size={11} aria-hidden="true" />
          {property.trust}
        </span>
      </div>
      <div className="sample-card__body">
        <h3 className="sample-card__title">{property.title}</h3>
        <p className="sample-card__location">
          <MapPin size={12} aria-hidden="true" />
          {property.location}
        </p>
        <p className="sample-card__price">
          {property.price}
          <span className="sample-card__period">/{property.period}</span>
        </p>
      </div>
    </Link>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function Home() {
  const [searchCity, setSearchCity] = useState("");
  const [featured, setFeatured] = useState([]);
  const [trustScores, setTrustScores] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function loadFeatured() {
    setError("");
    try {
      const listingsSnap = await getDocs(
        query(
          collection(db, "listings"),
          where("verificationStatus", "==", "verified"),
          orderBy("createdAt", "desc"),
          limit(6)
        )
      );
      const listings = listingsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setFeatured(listings);
      if (listings.length > 0) {
        const scoresSnap = await getDocs(collection(db, "trustScores"));
        const scoreMap = {};
        scoresSnap.docs.forEach((d) => { scoreMap[d.id] = d.data(); });
        setTrustScores(scoreMap);
      }
    } catch {
      setError("Featured listings could not be loaded. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const task = setTimeout(() => loadFeatured(), 0);
    return () => clearTimeout(task);
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    const params = searchCity.trim() ? `?city=${encodeURIComponent(searchCity.trim())}` : "";
    navigate(`/browse${params}`);
  }

  return (
    <div className="home">
      <PublicNav />

      {/* ── Hero ── */}
      <CardSplitAccordionHero
        searchCity={searchCity}
        setSearchCity={setSearchCity}
        onSearch={handleSearch}
      />

      <SectionDivider />

      {/* ── Sample properties — FadeUp with slight delay ── */}
      <FadeUpSection delay={0.05}>
        <section className="properties-section" aria-label="Sample properties">
        <div className="properties-section__inner">
          <div className="properties-section__header">
            <h2 className="properties-section__title">Properties</h2>
            <Link to="/browse" className="properties-section__see-all">
              See all <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          <div className="properties-section__grid">
            {SAMPLE_PROPERTIES.map((p) => (
              <SamplePropertyCard key={p.id} property={p} />
            ))}
          </div>
        </div>
      </section>
      </FadeUpSection>

      <SectionDivider />

      {/* ── Featured listings — FadeUp ── */}
      <FadeUpSection delay={0.08}>
      <section className="featured featured--spaced">
        <div className="featured__header">
          <h2 className="featured__title">Featured verified listings</h2>
          <button type="button" className="link-button" onClick={() => navigate("/browse")}>
            See all
          </button>
        </div>

        {loading ? (
          <p className="panel__empty">Loading listings…</p>
        ) : error ? (
          <div className="featured__empty" role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => { setLoading(true); loadFeatured(); }}
            >
              Try again
            </button>
          </div>
        ) : featured.length === 0 ? (
          <div className="featured__empty">
            <p>No verified listings yet — check back soon, or be the first to list one.</p>
            <button type="button" className="btn btn--secondary" onClick={() => navigate("/listings/new")}>
              List your property
            </button>
          </div>
        ) : (
          <div className="featured__grid">
            {featured.map((listing) => (
              <ListingCard key={listing.id} listing={listing} trustScore={trustScores[listing.id]} />
            ))}
          </div>
        )}
      </section>
      </FadeUpSection>

      <Footer />
    </div>
  );
}
