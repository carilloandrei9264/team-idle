import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { numericValue } from "../lib/number";
import PublicNav from "../components/PublicNav";
import ListingCard from "../components/ListingCard";
import { SlidersHorizontal } from "lucide-react";
import "./Browse.css";

const PROPERTY_TYPES = ["Apartment", "House", "Condo", "Room"];
const SORTS = [
  { value: "trust", label: "Trust & Fairness score" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "newest", label: "Newest" },
];

export default function Browse() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allListings, setAllListings] = useState([]);
  const [trustScores, setTrustScores] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [city, setCity] = useState(searchParams.get("city") || "");
  const [type, setType] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState("trust");

  async function loadListings() {
    setError("");
    try {
      const [listingsSnap, scoresSnap] = await Promise.all([
        getDocs(query(collection(db, "listings"), where("verificationStatus", "==", "verified"))),
        getDocs(collection(db, "trustScores")),
      ]);
      setAllListings(listingsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      const scoreMap = {};
      scoresSnap.docs.forEach((d) => {
        scoreMap[d.id] = d.data();
      });
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

  // Client-side filtering: Firestore doesn't do partial-text city search,
  // and this dataset is small enough that fetching verified listings once
  // and filtering in the browser is simpler than a pile of composite
  // indexes — same reasoning the System Build Plan uses for overlap checks.
  const results = useMemo(() => {
    let list = allListings.filter((l) => {
      if (city.trim() && !l.city?.toLowerCase().includes(city.trim().toLowerCase())) return false;
      if (type && l.type !== type) return false;
      if (minPrice && numericValue(l.price) < numericValue(minPrice)) return false;
      if (maxPrice && numericValue(l.price) > numericValue(maxPrice)) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sort === "price_asc") return numericValue(a.price) - numericValue(b.price);
      if (sort === "price_desc") return numericValue(b.price) - numericValue(a.price);
      if (sort === "newest") return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
      // trust: unscored listings sink to the bottom rather than defaulting
      // to 0-looks-broken — sorted by recency among themselves instead.
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

  return (
    <div className="browse">
      <PublicNav />

      <div className="browse__layout">
        <aside className="browse__filters">
          <div className="browse__filters-heading">
            <SlidersHorizontal size={16} aria-hidden="true" />
            <h2 className="panel__title panel__title--inline">Filters</h2>
          </div>

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

          <div className="field">
            <label className="field__label" htmlFor="type">Property type</label>
            <select id="type" className="field__input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Any type</option>
              {PROPERTY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

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

        <main className="browse__results">
          <div className="browse__results-header">
            <p className="browse__count">
              {loading ? "Loading…" : `${results.length} listing${results.length === 1 ? "" : "s"}`}
            </p>
            <div className="field browse__sort">
              <label className="field__label" htmlFor="sort">Sort by</label>
              <select id="sort" className="field__input" value={sort} onChange={(e) => setSort(e.target.value)}>
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          {error ? (
            <div className="browse__empty" role="alert">
              <p>{error}</p>
              <button type="button" className="btn btn--secondary" onClick={() => {
                setLoading(true);
                loadListings();
              }}>
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
            <div className="browse__grid">
              {results.map((listing) => (
                <ListingCard key={listing.id} listing={listing} trustScore={trustScores[listing.id]} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
