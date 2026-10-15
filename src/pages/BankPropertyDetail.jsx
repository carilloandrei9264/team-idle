import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import {
  ArrowLeft, Calculator, ExternalLink, FileText, Home, Landmark, MapPin, Scale,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import PublicNav from "../components/PublicNav";
import { db } from "../firebase";
import { formatCurrency, numericValue } from "../lib/number";
import {
  calculateLoanPrincipal,
  calculateMonthlyPayment,
  calculateTotalInterest,
} from "../lib/loanCalculator.js";
import "./UserPages.css";
import "./BankPropertyDetail.css";

// Which icon represents each remarks category Metrobank sends back.
const PROBLEM_ICONS = [
  { match: /physical/i, Icon: Home },
  { match: /legal/i, Icon: Scale },
  { match: /document/i, Icon: FileText },
];
function iconForCategory(category) {
  return PROBLEM_ICONS.find((p) => p.match.test(category || ""))?.Icon || FileText;
}

export default function BankPropertyDetail() {
  const { propertyId } = useParams();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeImage, setActiveImage] = useState(0);
  const [downPayment, setDownPayment] = useState("20");
  const [interestRate, setInterestRate] = useState("7");
  const [termYears, setTermYears] = useState("20");

  useEffect(() => {
    async function loadProperty() {
      try {
        const snapshot = await getDoc(doc(db, "bankProperties", propertyId));

        if (snapshot.exists() && snapshot.data().status === "active") {
          setProperty({ id: snapshot.id, ...snapshot.data() });
          setActiveImage(0);
        } else {
          setError("This bank property could not be found.");
        }
      } catch {
        setError("This bank property is unavailable.");
      } finally {
        setLoading(false);
      }
    }

    loadProperty();
  }, [propertyId]);

  const downPaymentValue = numericValue(downPayment, 0);
  const interestRateValue = numericValue(interestRate, 0);
  const termYearsValue = numericValue(termYears, 0);

  const principalAmount = property ? calculateLoanPrincipal(property.price, downPaymentValue) : 0;
  const monthlyPayment = property ? calculateMonthlyPayment(property.price, downPaymentValue, interestRateValue, termYearsValue) : 0;
  const totalInterest = property ? calculateTotalInterest(principalAmount, monthlyPayment, termYearsValue) : 0;

  return (
    <div className="user-page">
      <PublicNav />
      <main className="user-page__content bank-property-detail-page">
        <Link to="/bank-catalog" className="user-page__back">
          <ArrowLeft size={16} aria-hidden="true" /> Bank catalog
        </Link>

        {loading ? (
          <p className="user-page__empty">Loading property...</p>
        ) : error ? (
          <div className="user-page__empty" role="alert">
            <h1>Property unavailable</h1>
            <p>{error}</p>
          </div>
        ) : (
          <>
            {/* Older cached properties only have the single defaultImage;
                properties re-scraped since the gallery endpoint was added
                have the full `images` array — fall back gracefully either way. */}
            <article className="bpd-hero">
              <div className="bpd-hero__media">
                {galleryImages(property).length > 0 ? (
                  <img
                    src={galleryImages(property)[activeImage]?.url}
                    alt={galleryImages(property)[activeImage]?.caption || property.title || "Bank property"}
                  />
                ) : (
                  <div className="bpd-hero__media-fallback">
                    <Landmark size={40} aria-hidden="true" />
                    <span>Photo unavailable from source</span>
                  </div>
                )}
              </div>

              <div className="bpd-hero__panel">
                <span className="bpd-hero__bank">{property.bank || "Bank property"}</span>
                {property.referenceNo && (
                  <p className="bpd-hero__ref">Ref. No. {property.referenceNo}</p>
                )}
                <h1 className="bpd-hero__title">{property.title || "Bank-acquired property"}</h1>

                <p className="bpd-hero__location">
                  <MapPin size={15} aria-hidden="true" />
                  {property.location || "Location not provided"}
                </p>

                <p className="bpd-hero__price">{formatCurrency(property.price)}</p>

                {/* TrustHome compiles listings from bank sites rather than hosting
                    the sale itself, so the real action here is the source link,
                    not a print button. */}
                {property.listingUrl && (
                  <a
                    className="bpd-hero__cta"
                    href={property.listingUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View original listing <ExternalLink size={16} aria-hidden="true" />
                  </a>
                )}
              </div>
            </article>

            {galleryImages(property).length > 1 && (
              <ul className="bpd-thumbs" aria-label="Property photos">
                {galleryImages(property).map((img, index) => (
                  <li key={img.url}>
                    <button
                      type="button"
                      className={`bpd-thumbs__btn${index === activeImage ? " bpd-thumbs__btn--active" : ""}`}
                      onClick={() => setActiveImage(index)}
                      aria-label={img.caption || `Photo ${index + 1}`}
                      aria-pressed={index === activeImage}
                    >
                      <img src={img.url} alt="" loading="lazy" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="bpd-layout">
              <div className="bpd-layout__main">
                <section className="bpd-facts">
                  <div className="bpd-facts__grid">
                    <span>
                      Floor area <strong>{property.floorArea || "Not provided"}</strong>
                    </span>
                    <span>
                      Lot area <strong>{property.lotArea || "Not provided"}</strong>
                    </span>
                    <span>
                      TCT number <strong>{property.tctNumber || "Not provided"}</strong>
                    </span>
                    <span>
                      Classification <strong>{property.classification || "Not provided"}</strong>
                    </span>
                    <span>
                      Last verified <strong>{formatDate(property.lastSeen)}</strong>
                    </span>
                  </div>
                </section>

                {/* Only properties re-scraped since the detail endpoint was added
                    have this — older cached ones just skip the section. */}
                {property.problems?.length > 0 && (
                  <section className="bpd-remarks" aria-label="Other remarks">
                    <h2 className="bpd-remarks__title">Other remarks</h2>
                    <div className="bpd-remarks__grid">
                      {property.problems.map((problem, index) => {
                        const Icon = iconForCategory(problem.category);
                        return (
                          <article className="bpd-remarks__card" key={`${problem.category}-${index}`}>
                            <span className="bpd-remarks__icon"><Icon size={18} aria-hidden="true" /></span>
                            <div>
                              <h3>{problem.category || "Remark"}</h3>
                              <p>{problem.status}</p>
                              {problem.remarks && <p className="bpd-remarks__note">{problem.remarks}</p>}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>

              <section className="user-page__empty calculator-card" aria-labelledby="loan-estimate-title">
                <div className="account-card__heading">
                  <Calculator size={20} aria-hidden="true" />
                  <div>
                    <h2 id="loan-estimate-title">Loan estimate</h2>
                    <p>Estimate only. Confirm financing terms with the bank.</p>
                  </div>
                </div>

                <div className="listing-form__grid">
                  <Field id="loan-down" label="Down payment (%)" value={downPayment} setValue={setDownPayment} />
                  <Field id="loan-rate" label="Annual interest (%)" value={interestRate} setValue={setInterestRate} />
                  <Field id="loan-years" label="Loan term (years)" value={termYears} setValue={setTermYears} />
                  <div className="field">
                    <label className="field__label">Estimated loan amount</label>
                    <div className="field__static">{formatCurrency(principalAmount, 2)}</div>
                  </div>
                </div>

                <div className="calculator-card__summary" aria-live="polite">
                  <div className="calculator-card__metric">
                    <span>Monthly payment</span>
                    <strong>{formatCurrency(monthlyPayment, 2)}</strong>
                  </div>
                  <div className="calculator-card__metric">
                    <span>Total interest</span>
                    <strong>{formatCurrency(totalInterest, 2)}</strong>
                  </div>
                  <div className="calculator-card__metric">
                    <span>Property price</span>
                    <strong>{formatCurrency(property.price, 2)}</strong>
                  </div>
                </div>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Field({ id, label, value, setValue }) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>{label}</label>
      <input
        id={id}
        className="field__input"
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </div>
  );
}

// Properties re-scraped since the gallery endpoint was added have a full
// `images` array; older cached ones only have the single `imageUrl` —
// normalize both into the same {url, caption}[] shape the gallery expects.
function galleryImages(property) {
  if (property.images?.length > 0) return property.images;
  if (property.imageUrl) return [{ url: property.imageUrl, caption: property.title }];
  return [];
}

function formatDate(value) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date)
    : "Not available";
}