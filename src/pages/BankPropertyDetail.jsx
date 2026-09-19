import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { ArrowLeft, Calculator, ExternalLink, Landmark, MapPin } from "lucide-react";
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

export default function BankPropertyDetail() {
  const { propertyId } = useParams();
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downPayment, setDownPayment] = useState("20");
  const [interestRate, setInterestRate] = useState("7");
  const [termYears, setTermYears] = useState("20");

  useEffect(() => {
    async function loadProperty() {
      try {
        const snapshot = await getDoc(doc(db, "bankProperties", propertyId));

        if (snapshot.exists() && snapshot.data().status === "active") {
          setProperty({ id: snapshot.id, ...snapshot.data() });
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
      <main className="user-page__content">
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
            <article className="listing-detail">
              <div className="listing-detail__gallery">
                {property.imageUrl ? (
                  <img src={property.imageUrl} alt={property.title || "Bank property"} />
                ) : (
                  <div className="listing-detail__placeholder">
                    <Landmark size={36} aria-hidden="true" />
                    <span>Photo unavailable from source</span>
                  </div>
                )}
              </div>

              <div className="listing-detail__content">
                <span className="badge badge--verified">{property.bank || "Bank property"}</span>
                <h1>{property.title || "Bank-acquired property"}</h1>

                <p className="listing-detail__location">
                  <MapPin size={16} aria-hidden="true" />
                  {property.location || "Location not provided"}
                </p>

                <p className="listing-detail__price">{formatCurrency(property.price)}</p>

                <div className="listing-detail__facts">
                  <span>
                    Floor area <strong>{property.floorArea || "Not provided"}</strong>
                  </span>
                  <span>
                    Lot area <strong>{property.lotArea || "Not provided"}</strong>
                  </span>
                  <span>
                    Last verified <strong>{formatDate(property.lastSeen)}</strong>
                  </span>
                </div>

                {property.listingUrl && (
                  <a className="btn btn--secondary" href={property.listingUrl} target="_blank" rel="noreferrer">
                    View original listing <ExternalLink size={14} aria-hidden="true" />
                  </a>
                )}
              </div>
            </article>

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
                  <div className="field__static">{formatCurrency(principalAmount)}</div>
                </div>
              </div>

              <div className="calculator-card__summary" aria-live="polite">
                <div className="calculator-card__metric">
                  <span>Monthly payment</span>
                  <strong>{formatCurrency(monthlyPayment)}</strong>
                </div>
                <div className="calculator-card__metric">
                  <span>Total interest</span>
                  <strong>{formatCurrency(totalInterest)}</strong>
                </div>
                <div className="calculator-card__metric">
                  <span>Property price</span>
                  <strong>{formatCurrency(property.price)}</strong>
                </div>
              </div>
            </section>
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

function formatDate(value) {
  const date = value?.toDate?.() || (value ? new Date(value) : null);
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date)
    : "Not available";
}
