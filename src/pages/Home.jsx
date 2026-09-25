import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import PublicNav from "../components/PublicNav";
import Footer from "../components/Footer";
import ListingCard from "../components/ListingCard";
import {
  Search, ShieldCheck, TrendingUp, MessageSquareWarning,
  MapPin, Star, ArrowRight, Check,
} from "lucide-react";
import "./Home.css";

const HOW_IT_WORKS = [
  {
    icon: ShieldCheck,
    title: "Every listing is checked",
    body: "Owners upload an ID or ownership document that's matched against their account before a listing goes public.",
  },
  {
    icon: TrendingUp,
    title: "Ranked by trust, not just price",
    body: "Listings are ordered by completed bookings and ratings, not by who paid for the top spot.",
  },
  {
    icon: MessageSquareWarning,
    title: "Disputes stay on the record",
    body: "If something goes wrong, it's reviewed and shown on the owner's public profile, not buried.",
  },
];

const HERO_CHECKS = ["Owners verified by ID", "Ranked by real bookings", "Disputes stay public"];

// Sample properties (temporary — swap the image URLs for your own photos)
const SAMPLE_PROPERTIES = [
  {
    id: "sample-1", title: "2BR Apartment in Cebu IT Park", price: "₱15,000", period: "mo",
    location: "Cebu IT Park, Cebu City", trust: 4.8,
    image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&q=80",
  },
  {
    id: "sample-2", title: "3BR House in Talisay", price: "₱28,000", period: "mo",
    location: "Talisay City, Cebu", trust: 4.6,
    image: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=600&q=80",
  },
  {
    id: "sample-3", title: "Studio in Cebu City", price: "₱8,500", period: "mo",
    location: "Cebu City", trust: 4.9,
    image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&q=80",
  },
];

// Hero mosaic — 3x3 tiles. `img` tiles are photos (temporary, replace freely);
// the rest are colour shapes. `r` picks which corner is rounded.
const MOSAIC = [
  { tone: "navy", r: "tl" },
  { img: SAMPLE_PROPERTIES[0].image, r: "tr" },
  { tone: "ring" },
  { tone: "blue", r: "br" },
  { tone: "sky", r: "tl" },
  { img: SAMPLE_PROPERTIES[2].image, r: "br" },
  { img: SAMPLE_PROPERTIES[1].image, r: "tl" },
  { tone: "navy-ring" },
  { tone: "blue", r: "tr" },
];

function Hero({ searchCity, setSearchCity, onSearch }) {
  return (
    <section className="hero" aria-label="TrustHome hero">
      <div className="hero__inner">
        <div className="hero__copy">
          <h1 className="hero__title">Find a place you can actually trust.</h1>
          <p className="hero__subtitle">
            Every owner is ID-checked, and listings are ranked by completed bookings
            and ratings, not by who pays.
          </p>

          <form className="hero__search" onSubmit={onSearch}>
            <Search size={18} className="hero__search-icon" aria-hidden="true" />
            <input
              type="text"
              className="hero__search-input"
              placeholder="Search by city, e.g. Cabuyao, Laguna"
              value={searchCity}
              onChange={(e) => setSearchCity(e.target.value)}
              aria-label="Search by city"
            />
            <button type="submit" className="btn btn--primary hero__search-btn">Search</button>
          </form>

          <ul className="hero__checks">
            {HERO_CHECKS.map((t) => (
              <li key={t}><Check size={15} aria-hidden="true" />{t}</li>
            ))}
          </ul>
        </div>

        <div className="hero__visual">
          <div className="mosaic" aria-hidden="true">
            {MOSAIC.map((t, i) => (
              <div
                key={i}
                className={`tile${t.tone ? ` tile--${t.tone}` : " tile--photo"}${t.r ? ` r-${t.r}` : ""}`}
                style={{ "--i": i }}
              >
                {t.img && <img src={t.img} alt="" loading="eager" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SamplePropertyCard({ property }) {
  return (
    <Link to="/browse" className="sample-card" aria-label={`View ${property.title}`}>
      <div className="sample-card__image-wrap">
        <img src={property.image} alt={property.title} className="sample-card__image" loading="lazy" />
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
          {property.price}<span className="sample-card__period">/{property.period}</span>
        </p>
      </div>
    </Link>
  );
}

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

      <Hero searchCity={searchCity} setSearchCity={setSearchCity} onSearch={handleSearch} />

      {/* How trust works — dark band */}
      <section className="trust" aria-label="How TrustHome works">
        <div className="wrap">
          <div className="trust__head">
            <h2>Renting shouldn't feel like a gamble</h2>
            <p>Three checks sit behind every listing, so you can compare places on what matters.</p>
          </div>
          <div className="trust__grid">
            {HOW_IT_WORKS.map(({ icon: Icon, title, body }) => (
              <article key={title} className="trust__item">
                <span className="trust__icon"><Icon size={22} aria-hidden="true" /></span>
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Sample properties */}
      <section className="section" aria-label="Sample properties">
        <div className="wrap">
          <div className="section__head">
            <h2>Popular rentals</h2>
            <Link to="/browse" className="section__link">
              See all <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          <div className="cards cards--3">
            {SAMPLE_PROPERTIES.map((p) => <SamplePropertyCard key={p.id} property={p} />)}
          </div>
        </div>
      </section>

      {/* Featured verified listings (live data) */}
      <section className="section section--tint">
        <div className="wrap">
          <div className="section__head">
            <h2>Featured verified listings</h2>
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
              <p>No verified listings yet. Check back soon, or be the first to list one.</p>
              <button type="button" className="btn btn--secondary" onClick={() => navigate("/listings/new")}>
                List your property
              </button>
            </div>
          ) : (
            <div className="cards cards--3">
              {featured.map((listing) => (
                <ListingCard key={listing.id} listing={listing} trustScore={trustScores[listing.id]} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Owner CTA */}
      <section className="section" aria-label="For property owners">
        <div className="wrap">
          <div className="cta">
            <div>
              <h2>Own a rental? Get verified and get seen.</h2>
              <p>Upload your ID or ownership document once. Verified listings rank by your bookings and ratings.</p>
            </div>
            <button type="button" className="btn cta__btn" onClick={() => navigate("/listings/new")}>
              List your property
            </button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}