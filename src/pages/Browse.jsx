import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { numericValue } from "../lib/number";
import PublicNav from "../components/PublicNav";
import ListingCard from "../components/ListingCard";
import AnimatedSelect from "../components/AnimatedSelect";
import { SlidersHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import "./Browse.css";

const PROPERTY_TYPE_OPTIONS = [
  { value: "", label: "Any type" },
  { value: "Apartment", label: "Apartment" },
  { value: "House", label: "House" },
  { value: "Condo", label: "Condo" },
  { value: "Room", label: "Room" },
];

const SORT_OPTIONS = [
  { value: "trust", label: "Trust & Fairness score" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "newest", label: "Newest" },
];

// Stagger container + card variants for scroll-reveal
const gridVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const cardVariants = {
  hidden:  { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] },
  },
};

// Thin wrapper: gives the motion.div full height so ListingCard can fill it
function AnimatedCard({ listing, trustScore }) {
  return (
    <motion.div variants={cardVariants} style={{ height: "100%" }}>
      <ListingCard listing={listing} trustScore={trustScore} />
    </motion.div>
  );
}

export default function Browse() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allListings, setAllListings] = useState([]);
  const [trustScores, setTrustScores] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [city, setCity]       = useState(searchParams.get("city") || "");
  const [type, setType]       = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort]       = useState("trust");

  async function loadListings() {
    setError("");
    try {
      const [listingsSnap, scoresSnap] = await Promise.all([
        getDocs(query(collection(db, "listings"), where("verificationStatus", "==", "verified"))),
        getDocs(collection(db, "trustScores")),
      ]);
      setAllListings(listingsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      const scoreMap = {};
      scoresSnap.docs.forEach((d) => { scoreMap[d.id] = d.data(); });
      setTrustScores(scoreMap);
    } catch {
      setError("Listings could not be loaded. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const task = setTimeout(() => loadListings(), 0);
    return () => clearTimeout(task);
  }, []);

  // Client-side filtering — same rationale as before
  const results = useMemo(() => {
    let list = allListings.filter((l) => {
      if (city.trim() && !l.city?.toLowerCase().includes(city.trim().toLowerCase())) return false;
      if (type && l.type !== type) return false;
      if (minPrice && numericValue(l.price) < numericValue(minPrice)) return false;
      if (maxPrice && numericValue(l.price) > numericValue(maxPrice)) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sort === "price_asc")  return numericValue(a.price) - numericValue(b.price);
      if (sort === "price_desc") return numericValue(b.price) - numericValue(a.price);
      if (sort === "newest")     return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
      const scoreA = trustScores[a.id]?.score;
      const scoreB = trustScores[b.id]?.score;
      if (scoreA == null && scoreB == null) return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
      if (scoreA == null) return 1;
      if (scoreB == null) return -1;
      return scoreB - scoreA;
    });

    return list;
  }, [allListings, trustScores, city, type, minPrice, maxPrice, sort]);

  function handleCityChange(value) {
    setCity(value);
    setSearchParams(value.trim() ? { city: value.trim() } : {});
  }

  const animationKey = `${city}-${type}-${minPrice}-${maxPrice}-${sort}`;

  return (
    <div className="browse">
      <PublicNav />

      <div className="browse__layout">
        {/* ── Filter sidebar ── */}
        <aside className="browse__filters">
          <div className="browse__filters-heading">
            <SlidersHorizontal size={16} aria-hidden="true" />
            <h2 className="panel__title panel__title--inline">Filters</h2>
          </div>

          {/* City — plain text input, no dropdown */}
          <div className="field">
            <label className="field__label" htmlFor="city">City</label>
            <input
              id="city"
              className="field__input"
              value={city}
              onChange={(e) => handleCityChange(e.target.value)}
              placeholder="e.g. Cabuyao"
            />
          </div>

          {/* Property type — animated custom select */}
          <div className="field">
            <label className="field__label" htmlFor="type">Property type</label>
            <AnimatedSelect
              id="type"
              value={type}
              onChange={setType}
              options={PROPERTY_TYPE_OPTIONS}
              placeholder="Any type"
            />
          </div>

          {/* Price range — plain number inputs */}
          <div className="browse__price-row">
            <div className="field">
              <label className="field__label" htmlFor="minPrice">Min price</label>
              <input
                id="minPrice"
                type="number"
                className="field__input"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="₱0"
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="maxPrice">Max price</label>
              <input
                id="maxPrice"
                type="number"
                className="field__input"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="No limit"
              />
            </div>
          </div>
        </aside>

        {/* ── Results panel ── */}
        <main className="browse__results">
          <div className="browse__results-header">
            <p className="browse__count">
              {loading ? "Loading…" : `${results.length} listing${results.length === 1 ? "" : "s"}`}
            </p>
            {/* Sort — animated custom select */}
            <div className="field browse__sort">
              <label className="field__label browse__sort-label" htmlFor="sort">Sort by</label>
              <AnimatedSelect
                id="sort"
                value={sort}
                onChange={setSort}
                options={SORT_OPTIONS}
              />
            </div>
          </div>

          {error ? (
            <div className="browse__empty" role="alert">
              <p>{error}</p>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => { setLoading(true); loadListings(); }}
              >
                Try again
              </button>
            </div>
          ) : !loading && results.length === 0 ? (
            <div className="browse__empty">
              <p>
                {allListings.length === 0
                  ? "No verified listings yet — the review queue is still empty."
                  : "No listings match those filters — try widening your search."}
              </p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={animationKey}
                className="browse__grid"
                variants={gridVariants}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0 }}
              >
                {results.map((listing) => (
                  <AnimatedCard
                    key={listing.id}
                    listing={listing}
                    trustScore={trustScores[listing.id]}
                  />
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </main>
      </div>
    </div>
  );
}
