import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import PublicNav from "../components/PublicNav";
import ListingCard from "../components/ListingCard";
import { Search, ShieldCheck, TrendingUp, MessageSquareWarning } from "lucide-react";
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
    body: "Listings are ordered by completed bookings and ratings — not who paid for the top spot.",
  },
  {
    icon: MessageSquareWarning,
    title: "Disputes stay on the record",
    body: "If something goes wrong, it's reviewed and reflected on the owner's public profile — not buried.",
  },
];

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
        scoresSnap.docs.forEach((d) => {
          scoreMap[d.id] = d.data();
        });
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

      <section className="hero">
        <p className="hero__eyebrow">TrustHome Philippines</p>
        <h1 className="hero__title">Find a place you can actually trust.</h1>
        <p className="hero__subtitle">
          Every listing on TrustHome is checked against the name on the deed —
          browse rentals ranked by real accountability, not just price.
        </p>

        <form className="hero__search" onSubmit={handleSearch}>
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
      </section>

      <section className="how-it-works">
        {HOW_IT_WORKS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="how-it-works__item">
            <div className="how-it-works__icon">
              <Icon size={20} aria-hidden="true" />
            </div>
            <h3 className="how-it-works__title">{title}</h3>
            <p className="how-it-works__body">{body}</p>
          </div>
        ))}
      </section>

      <section className="featured">
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
            <button type="button" className="btn btn--secondary" onClick={() => {
              setLoading(true);
              loadFeatured();
            }}>
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
    </div>
  );
}
