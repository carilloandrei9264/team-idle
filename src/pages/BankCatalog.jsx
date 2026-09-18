import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Landmark, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import PublicNav from "../components/PublicNav";
import { db } from "../firebase";
import { formatCurrency, numericValue } from "../lib/number";
import "./UserPages.css";

const BANKS = ["landbank", "metrobank"];
const BANK_LABELS = { landbank: "Landbank", metrobank: "Metrobank" };

export default function BankCatalog() {
  const [properties, setProperties] = useState([]);
  const [bank, setBank] = useState("");
  const [city, setCity] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => onSnapshot(
    query(collection(db, "bankProperties"), where("status", "==", "active")),
    (snapshot) => {
      setProperties(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      setLoading(false);
      setError("");
    },
    () => {
      setLoading(false);
      setError("The bank property catalog could not be loaded. Please try again later.");
    }
  ), []);

  const results = useMemo(() => properties.filter((property) => {
    if (String(property.status || "active").toLowerCase() !== "active") return false;
    if (bank && String(property.bank || "").toLowerCase() !== bank) return false;
    if (city.trim() && !String(property.location || "").toLowerCase().includes(city.trim().toLowerCase())) return false;
    if (maxPrice && numericValue(property.price) > numericValue(maxPrice)) return false;
    return true;
  }), [bank, city, maxPrice, properties]);

  return (
    <div className="user-page">
      <PublicNav />
      <main className="user-page__content bank-catalog-page">
        <p className="user-page__eyebrow">Public catalog</p>
        <h1>Bank-acquired properties</h1>
        <p className="user-page__intro">Properties collected from participating bank websites. Verify details with the original bank listing before making a decision.</p>

        <section className="bank-catalog__filters" aria-label="Filter bank properties">
          <div className="field"><label className="field__label" htmlFor="bank-filter">Bank</label><select id="bank-filter" className="field__input" value={bank} onChange={(event) => setBank(event.target.value)}><option value="">All banks</option>{BANKS.map((name) => <option key={name} value={name}>{BANK_LABELS[name]}</option>)}</select></div>
          <div className="field"><label className="field__label" htmlFor="bank-city-filter">City or location</label><input id="bank-city-filter" className="field__input" value={city} onChange={(event) => setCity(event.target.value)} placeholder="e.g. Laguna" /></div>
          <div className="field"><label className="field__label" htmlFor="bank-price-filter">Maximum price</label><input id="bank-price-filter" className="field__input" type="number" min="0" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="No limit" /></div>
        </section>

        {loading ? <p className="user-page__empty">Loading properties...</p> : error ? <div className="user-page__empty" role="alert"><p>{error}</p></div> : results.length === 0 ? (
          <div className="user-page__empty"><h2>No properties found</h2><p>Try changing the filters or check back after the next catalog update.</p></div>
        ) : (
          <>
            <p className="bank-catalog__count">{results.length} active propert{results.length === 1 ? "y" : "ies"}</p>
            <div className="bank-catalog__grid">
              {results.map((property) => <BankPropertyCard key={property.id} property={property} />)}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function BankPropertyCard({ property }) {
  return (
    <article className="bank-property-card">
      <div className="bank-property-card__image-wrap">
        {property.imageUrl ? <img src={property.imageUrl} alt={property.title || "Bank-acquired property"} /> : <Landmark size={30} aria-hidden="true" />}
        <span className="badge badge--verified">{BANK_LABELS[property.bank] || property.bank || "Bank property"}</span>
      </div>
      <div className="bank-property-card__body">
        <h2>{property.title || "Untitled bank property"}</h2>
        <p className="bank-property-card__location"><MapPin size={14} aria-hidden="true" />{property.location || "Location not provided"}</p>
        <p className="bank-property-card__price">{formatCurrency(property.price)}</p>
        <p className="bank-property-card__meta">Last verified: {formatDate(property.lastSeen || property.firstSeen)}</p>
        <Link className="btn btn--primary bank-property-card__link" to={`/bank-catalog/${property.id}`}>View property and loan estimate</Link>
      </div>
    </article>
  );
}

function formatDate(value) {
  const milliseconds = value?.toMillis?.() || (value ? Date.parse(value) : 0);
  return milliseconds ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(milliseconds) : "Not available";
}
