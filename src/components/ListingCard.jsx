import { Link } from "react-router-dom";
import { formatCurrency } from "../lib/number";
import "./ListingCard.css";

/**
 * `trustScore` is the corresponding trustScores/{listingId} document, or
 * null if the scheduled Cloud Function hasn't scored this listing yet
 * (brand-new listings before their first nightly run). We show "New
 * listing" rather than inventing a number in that case.
 */
export default function ListingCard({ listing, trustScore }) {
  const cover = listing.photoUrls?.[0];
  const display = trustScore ? (trustScore.score * 5).toFixed(1) : null;
  const label = trustScore ? trustLabel(trustScore.score) : "New listing";

  return (
    <Link to={`/listings/${listing.id}`} className="listing-card">
      <div className="listing-card__image-wrap">
        {cover ? (
          <img className="listing-card__image" src={cover} alt={listing.title || "Property photo"} />
        ) : (
          <div className="listing-card__image-placeholder" aria-hidden="true" />
        )}
        <span className="badge badge--verified listing-card__badge">Verified</span>
      </div>

      <div className="listing-card__body">
        <div className="listing-card__top-row">
          <h3 className="listing-card__title">{listing.title || "Untitled listing"}</h3>
          <span className="listing-card__trust">
            {display ? `${display} · ${label}` : label}
          </span>
        </div>
        <p className="listing-card__location">{listing.city}</p>
        <p className="listing-card__price">
          {formatCurrency(listing.price)}
          {listing.pricePeriod ? <span className="listing-card__period">/{listing.pricePeriod}</span> : null}
        </p>
      </div>
    </Link>
  );
}

function trustLabel(score) {
  if (score >= 0.8) return "Highly rated";
  if (score >= 0.6) return "Good standing";
  return "Building trust";
}
