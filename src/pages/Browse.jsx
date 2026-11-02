import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { numericValue } from "../lib/number";
import PublicNav from "../components/PublicNav";
import ListingCard from "../components/ListingCard";
import AnimatedSelect from "../components/AnimatedSelect";
import { MapPin, SlidersHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { approximateDistanceKm } from "../lib/propertyLocation";
import { firebaseAccessErrorMessage } from "../lib/uiState";
import useNetworkStatus from "../hooks/useNetworkStatus";
import "./Browse.css";

const PROPERTY_TYPE_OPTIONS = [
  { value: "", label: "Any type" },
  { value: "Apartment", label: "Apartment" },
  { value: "House", label: "House" },
  { value: "Condo", label: "Condo" },
  { value: "Room", label: "Room" },
  { value: "Land", label: "Land" },
];

const PURPOSE_OPTIONS = [
  { value: "", label: "Rent or sale" },
  { value: "rent", label: "For rent" },
  { value: "sale", label: "For sale" },
];

const SORT_OPTIONS = [
  { value: "nearby", label: "Nearest to me" },
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
  const isOnline = useNetworkStatus();
  const [allListings, setAllListings] = useState([]);
  const [trustScores, setTrustScores] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("prompt");
  const [slowNetwork, setSlowNetwork] = useState(false);

  const [city, setCity]       = useState(searchParams.get("city") || "");
  const [purpose, setPurpose] = useState(searchParams.get("purpose") || "");
  const [type, setType]       = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort]       = useState("trust");

  const requestNearbyLocation = useCallback(() => {
    setLocationStatus("loading");
    setSort("nearby");
    if (!navigator.geolocation) {
      setLocationStatus("unsupported");
      setSort("trust");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUserLocation({ latitude: coords.latitude, longitude: coords.longitude });
        setLocationStatus("ready");
      },
      (locationError) => {
        setLocationStatus(locationError.code === 1 ? "denied" : "unavailable");
        setSort("trust");
      },
      { enableHighAccuracy: false, maximumAge: 10 * 60 * 1000, timeout: 8000 },
    );
  }, []);

  useEffect(() => {
    let active = true;
    if (!navigator.permissions?.query) return undefined;
    navigator.permissions.query({ name: "geolocation" }).then((permission) => {
      if (!active) return;
      if (permission.state === "granted") requestNearbyLocation();
      else if (permission.state === "denied") setLocationStatus("denied");
    }).catch(() => {
      if (active) setLocationStatus("prompt");
    });
    return () => { active = false; };
  }, [requestNearbyLocation]);

  async function loadListings() {
    setError("");
    const slowNetworkTimer = window.setTimeout(() => setSlowNetwork(true), 5000);
    try {
      const [listingsSnap, scoresSnap] = await Promise.all([
        getDocs(query(collection(db, "listings"), where("verificationStatus", "==", "verified"))),
        getDocs(collection(db, "trustScores")),
      ]);
      setAllListings(listingsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      const scoreMap = {};
      scoresSnap.docs.forEach((d) => { scoreMap[d.id] = d.data(); });
      setTrustScores(scoreMap);
    } catch (loadError) {
      setError(firebaseAccessErrorMessage(loadError, "property listings"));
    } finally {
      window.clearTimeout(slowNetworkTimer);
      setSlowNetwork(false);
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
      if (purpose && (l.listingPurpose || "rent") !== purpose) return false;
      if (minPrice && numericValue(l.price) < numericValue(minPrice)) return false;
      if (maxPrice && numericValue(l.price) > numericValue(maxPrice)) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sort === "price_asc")  return numericValue(a.price) - numericValue(b.price);
      if (sort === "price_desc") return numericValue(b.price) - numericValue(a.price);
      if (sort === "newest")     return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
      if (sort === "nearby" && userLocation) {
        const distanceA = approximateDistanceKm(a.mapLocation, userLocation.latitude, userLocation.longitude);
        const distanceB = approximateDistanceKm(b.mapLocation, userLocation.latitude, userLocation.longitude);
        if (distanceA !== distanceB) return distanceA - distanceB;
      }
      const scoreA = trustScores[a.id]?.score;
      const scoreB = trustScores[b.id]?.score;
      if (scoreA == null && scoreB == null) return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
      if (scoreA == null) return 1;
      if (scoreB == null) return -1;
      return scoreB - scoreA;
    });

    return list;
  }, [allListings, trustScores, city, purpose, type, minPrice, maxPrice, sort, userLocation]);

  function handleCityChange(value) {
    setCity(value);
    const nextParams = new URLSearchParams(searchParams);
    if (value.trim()) nextParams.set("city", value.trim());
    else nextParams.delete("city");
    setSearchParams(nextParams);
  }

  function handlePurposeChange(value) {
    setPurpose(value);
    const nextParams = new URLSearchParams(searchParams);
    if (value) nextParams.set("purpose", value);
    else nextParams.delete("purpose");
    setSearchParams(nextParams);
  }

  const animationKey = `${city}-${purpose}-${type}-${minPrice}-${maxPrice}-${sort}`;

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

          <div className="field">
            <label className="field__label" htmlFor="purpose">Purpose</label>
            <AnimatedSelect
              id="purpose"
              value={purpose}
              onChange={handlePurposeChange}
              options={PURPOSE_OPTIONS}
              placeholder="Rent or sale"
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
          {!isOnline && <p className="network-state network-state--offline" role="status">No internet connection. Showing any listings already loaded; new results may be unavailable.</p>}
          {slowNetwork && <p className="network-state" role="status">This is taking longer than usual. The network may be slow.</p>}
          {locationStatus === "ready" && sort === "nearby" && (
            <p className="browse__location-status"><MapPin size={15} aria-hidden="true" /> Prioritizing nearby listings using your approximate location.</p>
          )}
          {["prompt", "denied", "unavailable", "unsupported"].includes(locationStatus) && (
            <p className="browse__location-status" role={locationStatus === "denied" ? "alert" : "status"}>
              {locationStatus === "denied"
                ? "Location access is blocked. Update this site's browser permission to prioritize nearby listings."
                : locationStatus === "prompt"
                  ? "Want nearby results? Allow approximate location to prioritize listings close to you."
                  : locationStatus === "unsupported"
                    ? "Your browser doesn't support location access. Showing listings by trust score instead."
                    : "Your location could not be determined. Showing listings by trust score instead."}
              {locationStatus !== "unsupported" && (
                <button type="button" className="browse__location-retry" onClick={requestNearbyLocation}>
                  {locationStatus === "prompt" ? "Use my location" : "Try again"}
                </button>
              )}
            </p>
          )}
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
                onChange={(value) => {
                  setSort(value);
                  if (value === "nearby" && !userLocation) requestNearbyLocation();
                }}
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
              <h2>{allListings.length === 0 ? "No listings yet" : "No search results"}</h2>
              <p>{allListings.length === 0
                ? "No verified listings are available right now. Check back soon."
                : "No listings match those filters. Try another location or widen your price range."}</p>
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
                {results.map((listing, index) => (
                  <Fragment key={listing.id}>
                    <AnimatedCard listing={listing} trustScore={trustScores[listing.id]} />
                    {index === 3 && (
                      <article className="browse__house-ad">
                        <span>Promotion</span>
                        <h2>Have a place to rent?</h2>
                        <p>Create a listing and connect with renters looking for a home.</p>
                        <Link to="/listings/new" className="btn btn--secondary">List your property</Link>
                      </article>
                    )}
                  </Fragment>
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </main>
      </div>
    </div>
  );
}
