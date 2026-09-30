import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import PublicNav from "../components/PublicNav";
import ListingCard from "../components/ListingCard";
import {
  Search, ShieldCheck, TrendingUp, MessageSquareWarning,
  Check,
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

// Hero mosaic — 3x3 tiles. `img` tiles are photos (temporary, replace freely);
// the rest are colour shapes. `r` picks which corner is rounded.
const MOSAIC = [
  { tone: "navy", r: "tl" },
  { tone: "sky", r: "tr" },
  { tone: "ring" },
  { tone: "blue", r: "br" },
  { tone: "sky", r: "tl" },
  { tone: "blue", r: "br" },
  { tone: "navy", r: "tl" },
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

      {/* Featured verified listings (live data) */}
      <section className="section section--tint">
        <div className="wrap">
          <div className="section__head">
            <h2>Verified rentals</h2>
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

    </div>
  );
}