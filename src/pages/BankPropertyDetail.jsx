import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { ArrowLeft, Calculator, ExternalLink, Landmark, MapPin } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import PublicNav from "../components/PublicNav";
import { db } from "../firebase";
import { formatCurrency, numericValue } from "../lib/number";
import "./UserPages.css";

export default function BankPropertyDetail() {
  const { propertyId } = useParams();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downPayment, setDownPayment] = useState("20");
  const [interestRate, setInterestRate] = useState("7");
  const [termYears, setTermYears] = useState("20");

  useEffect(() => { getDoc(doc(db, "bankProperties", propertyId)).then((snapshot) => { if (snapshot.exists()) setProperty({ id: snapshot.id, ...snapshot.data() }); else setError("This bank property could not be found."); setLoading(false); }).catch(() => { setError("This bank property is unavailable."); setLoading(false); }); }, [propertyId]);

  const payment = property ? calculatePayment(numericValue(property.price), numericValue(downPayment), numericValue(interestRate), numericValue(termYears)) : null;
  return <div className="user-page"><PublicNav /><main className="user-page__content"><Link to="/bank-catalog" className="user-page__back"><ArrowLeft size={16} aria-hidden="true" /> Bank catalog</Link>{loading ? <p className="user-page__empty">Loading property...</p> : error ? <div className="user-page__empty" role="alert"><h1>Property unavailable</h1><p>{error}</p></div> : <><article className="listing-detail"><div className="listing-detail__gallery">{property.imageUrl ? <img src={property.imageUrl} alt={property.title || "Bank property"} /> : <div className="listing-detail__placeholder"><Landmark size={36} aria-hidden="true" /><span>Photo unavailable from source</span></div>}</div><div className="listing-detail__content"><span className="badge badge--verified">{property.bank || "Bank property"}</span><h1>{property.title || "Bank-acquired property"}</h1><p className="listing-detail__location"><MapPin size={16} aria-hidden="true" />{property.location || "Location not provided"}</p><p className="listing-detail__price">{formatCurrency(property.price)}</p><div className="listing-detail__facts"><span>Floor area <strong>{property.floorArea || "Not provided"}</strong></span><span>Lot area <strong>{property.lotArea || "Not provided"}</strong></span><span>Last verified <strong>{formatDate(property.lastSeen)}</strong></span></div>{property.listingUrl && <a className="btn btn--secondary" href={property.listingUrl} target="_blank" rel="noreferrer">View original listing <ExternalLink size={14} aria-hidden="true" /></a>}</div></article><section className="user-page__empty calculator-card"><div className="account-card__heading"><Calculator size={20} aria-hidden="true" /><div><h2>Loan estimate</h2><p>Estimate only. Confirm financing terms with the bank.</p></div></div><div className="listing-form__grid"><Field id="loan-down" label="Down payment (%)" value={downPayment} setValue={setDownPayment} /><Field id="loan-rate" label="Annual interest (%)" value={interestRate} setValue={setInterestRate} /><Field id="loan-term" label="Term (years)" value={termYears} setValue={setTermYears} /></div><p className="bank-property-card__price">Estimated monthly payment: {payment == null ? "Unavailable" : formatCurrency(payment)}</p></section></>}</main></div>;
}
function Field({ id, label, value, setValue }) { return <div className="field"><label className="field__label" htmlFor={id}>{label}</label><input id={id} className="field__input" type="number" min="0" value={value} onChange={(event) => setValue(event.target.value)} /></div>; }
function calculatePayment(price, downPercent, annualPercent, years) { const principal = price * (1 - downPercent / 100); const months = years * 12; const monthlyRate = annualPercent / 100 / 12; if (principal <= 0 || months <= 0) return null; if (monthlyRate === 0) return principal / months; const factor = Math.pow(1 + monthlyRate, months); return principal * ((monthlyRate * factor) / (factor - 1)); }
function formatDate(value) { const date = value?.toDate?.() || (value ? new Date(value) : null); return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date) : "Not available"; }
