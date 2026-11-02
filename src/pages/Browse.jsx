import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { collection, documentId, getDocs, limit, orderBy, query, startAfter, where } from "firebase/firestore";
import { db } from "../firebase";
import { formatCurrency, numericValue } from "../lib/number";
import PublicNav from "../components/PublicNav";
import ListingCard from "../components/ListingCard";
import AnimatedSelect from "../components/AnimatedSelect";
import { MapPin, SlidersHorizontal, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { approximateMapCenter } from "../lib/propertyLocation";
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
const LISTINGS_PER_PAGE = 24;

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
  const [loadingMore, setLoadingMore] = useState(false);
  const lastListingSnapshot = useRef(null);
  const [hasMore, setHasMore] = useState(true);
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

  // Mobile/tablet filter drawer — same pattern as the Bank Catalog page
  const [filtersOpen, setFiltersOpen] = useState(false);
  const closeRef = useRef(null);

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

  useEffect(() => {
    if (!filtersOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const mq = window.matchMedia("(min-width: 900px)");
    const onKey = (e) => { if (e.key === "Escape") setFiltersOpen(false); };
    const onResize = () => { if (mq.matches) setFiltersOpen(false); };
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onResize);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onResize);
    };
  }, [filtersOpen]);

  const loadListings = useCallback(async ({ reset = false } = {}) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);
    setError("");
    const slowNetworkTimer = window.setTimeout(() => setSlowNetwork(true), 5000);
    try {
      const baseQuery = query(
        collection(db, "listings"),
        where("verificationStatus", "==", "verified"),
        orderBy("createdAt", "desc"),
        limit(LISTINGS_PER_PAGE)
      );
      const cursor = reset ? null : lastListingSnapshot.current;
      const listingsSnap = await getDocs(cursor ? query(baseQuery, startAfter(cursor)) : baseQuery);
      const nextListings = listingsSnap.docs.map((listingDocument) => ({ id: listingDocument.id, ...listingDocument.data() }));
      const listingIds = nextListings.map((listing) => listing.id);
      const scoresSnap = listingIds.length
        ? await getDocs(query(collection(db, "trustScores"), where(documentId(), "in", listingIds)))
        : { docs: [] };
      setAllListings((current) => reset
        ? nextListings
        : [...current, ...nextListings.filter((listing) => !current.some((item) => item.id === listing.id))]);
      lastListingSnapshot.current = listingsSnap.docs.at(-1) || null;
      setHasMore(listingsSnap.docs.length === LISTINGS_PER_PAGE);
      const scoreMap = {};
      scoresSnap.docs.forEach((d) => { scoreMap[d.id] = d.data(); });
      setTrustScores((current) => reset ? scoreMap : { ...current, ...scoreMap });
    } catch (loadError) {
      setError(firebaseAccessErrorMessage(loadError, "property listings"));
    } finally {
      window.clearTimeout(slowNetworkTimer);
      setSlowNetwork(false);
      if (reset) setLoading(false);
      else setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    const task = setTimeout(() => loadListings({ reset: true }), 0);
    return () => clearTimeout(task);
  }, [loadListings]);

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
        const distanceA = getListingDistance(a, userLocation);
        const distanceB = getListingDistance(b, userLocation);
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

  function clearFilters() {
    handleCityChange("");
    handlePurposeChange("");
    setType("");
    setMinPrice("");
    setMaxPrice("");
  }

  const typeLabel = PROPERTY_TYPE_OPTIONS.find((o) => o.value === type)?.label;
  const purposeLabel = PURPOSE_OPTIONS.find((o) => o.value === purpose)?.label;
  const priceLabel = minPrice && maxPrice
    ? `${formatCurrency(minPrice)} – ${formatCurrency(maxPrice)}`
    : minPrice ? `From ${formatCurrency(minPrice)}`
    : maxPrice ? `Up to ${formatCurrency(maxPrice)}`
    : null;

  const chips = [
    city.trim() && { label: `City: ${city.trim()}`, clear: () => handleCityChange("") },
    type && { label: typeLabel, clear: () => setType("") },
    purpose && { label: purposeLabel, clear: () => handlePurposeChange("") },
    priceLabel && { label: priceLabel, clear: () => { setMinPrice(""); setMaxPrice(""); } },
  ].filter(Boolean);

  const animationKey = `${city}-${purpose}-${type}-${minPrice}-${maxPrice}-${sort}`;

  return (
    <div className="browse">
      <PublicNav />

      <div className="browse__layout">
        {/* ── Filter sidebar: sticky on desktop, slide-in drawer below 900px ── */}
        <aside className={`browse__filters${filtersOpen ? " browse__filters--open" : ""}`} aria-label="Filters">
          <div className="browse__filters-head">
            <h2 className="browse__filters-heading">
              <SlidersHorizontal size={15} aria-hidden="true" /> Filters
            </h2>
            {chips.length > 0 && (
              <button type="button" className="browse__filters-clear" onClick={clearFilters}>Clear all</button>
            )}
            <button
              type="button"
              className="browse__filters-close"
              onClick={() => setFiltersOpen(false)}
              ref={closeRef}
              aria-label="Close filters"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="browse__filters-body">
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
            <div className="field">
              <span className="field__label">Price range</span>
              <div className="browse__price-row">
                <input
                  id="minPrice"
                  type="number"
                  className="field__input"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="₱0"
                  aria-label="Minimum price"
                />
                <span aria-hidden="true">to</span>
                <input
                  id="maxPrice"
                  type="number"
                  className="field__input"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="No limit"
                  aria-label="Maximum price"
                />
              </div>
            </div>
          </div>

          <div className="browse__filters-foot">
            <button type="button" className="btn btn--primary" onClick={() => setFiltersOpen(false)}>
              {loading ? "Show listings" : `Show ${results.length} listing${results.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </aside>
        {filtersOpen && <div className="browse__scrim" onClick={() => setFiltersOpen(false)} />}

        {/* ── Results panel ── */}
        <main className="browse__results">
          <header className="browse__page-heading">
            <p>Property search</p>
            <h1>Browse properties</h1>
            <span>Compare verified rentals and properties for sale.</span>
          </header>
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
          <div className="browse__toolbar">
            <button
              type="button"
              className="btn btn--secondary browse__toolbar-filters"
              onClick={() => {
                // Belt-and-suspenders: never lock page scroll for a drawer that
                // has no visible way to close on a screen wide enough that the
                // sidebar is already shown inline.
                if (window.matchMedia("(min-width: 900px)").matches) return;
                setFiltersOpen(true);
              }}
            >
              <SlidersHorizontal size={16} aria-hidden="true" />
              Filters
              {chips.length > 0 && <span className="browse__toolbar-badge">{chips.length}</span>}
            </button>

            <p className="browse__count">
              {loading ? "Loading…" : `${results.length} listing${results.length === 1 ? "" : "s"}`}
            </p>

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

          {chips.length > 0 && (
            <ul className="browse__chips" aria-label="Active filters">
              {chips.map((c) => (
                <li key={c.label}>
                  <button type="button" className="browse__chip" onClick={c.clear} aria-label={`Remove filter: ${c.label}`}>
                    {c.label}<X size={12} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {error ? (
            <div className="browse__empty" role="alert">
              <p>{error}</p>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => loadListings({ reset: true })}
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
              {allListings.length > 0 && <button type="button" className="btn btn--secondary" onClick={clearFilters}>Clear filters</button>}
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
                {loading ? (
                  Array.from({ length: 6 }, (_, index) => <div key={`loading-${index}`} className="browse__skeleton" aria-hidden="true" />)
                ) : results.map((listing, index) => (
                  <Fragment key={listing.id}>
                    <AnimatedCard listing={listing} trustScore={trustScores[listing.id]} />
                    {index === 5 && results.length > 6 && (
                      <article className="browse__house-ad" aria-label="TrustHome promotion">
                        <span>Advertisement · TrustHome promotion</span>
                        <h2>Have a place to rent?</h2>
                        <p>List your property on TrustHome and help renters find a verified home near them.</p>
                        <Link className="btn btn--secondary" to="/listings/new">List your property</Link>
                      </article>
                    )}
                  </Fragment>
                ))}
              </motion.div>
            </AnimatePresence>
          )}
          {!loading && !error && hasMore && (
            <button type="button" className="btn btn--secondary browse__load-more" onClick={() => loadListings()} disabled={loadingMore}>
              {loadingMore ? "Loading listings..." : "Load more listings"}
            </button>
          )}
        </main>
      </div>
    </div>
  );
}

function getListingDistance(listing, userLocation) {
  const center = approximateMapCenter(listing.mapLocation);
  if (!center) return Number.POSITIVE_INFINITY;
  return distanceInKilometers(
    userLocation.latitude,
    userLocation.longitude,
    center[0],
    center[1],
  );
}

function distanceInKilometers(latitudeA, longitudeA, latitudeB, longitudeB) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const latitudeDifference = radians(latitudeB - latitudeA);
  const longitudeDifference = radians(longitudeB - longitudeA);
  const haversine = Math.sin(latitudeDifference / 2) ** 2
    + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB))
    * Math.sin(longitudeDifference / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}