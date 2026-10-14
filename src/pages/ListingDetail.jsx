import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { ArrowLeft, Mail, MapPin, Pencil, Phone, ShieldCheck, UserRound } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import PublicNav from "../components/PublicNav";
import PropertyMap from "../components/PropertyMap";
import { useAuth } from "../context/useAuth";
import { db } from "../firebase";
import { formatCurrency } from "../lib/number";
import { isValidMapLocation } from "../lib/propertyLocation";
import "./UserPages.css";

export default function ListingDetail() {
  const { listingId } = useParams();
  const { user } = useAuth();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ratings, setRatings] = useState([]);
  const [trustScore, setTrustScore] = useState(null);
  const [ownerProfileResult, setOwnerProfileResult] = useState(null);

  useEffect(() => {
    let active = true;
    getDoc(doc(db, "listings", listingId)).then((snapshot) => {
      if (!active) return;
      if (snapshot.exists()) {
        setListing({ id: snapshot.id, ...snapshot.data() });
        Promise.all([
          getDocs(query(collection(db, "ratings"), where("listingId", "==", listingId))),
          getDoc(doc(db, "trustScores", listingId)),
        ]).then(([ratingsSnapshot, trustScoreSnapshot]) => {
          setRatings(ratingsSnapshot.docs.map((item) => item.data()));
          setTrustScore(trustScoreSnapshot.exists() ? trustScoreSnapshot.data() : null);
        }).catch(() => {
          setRatings([]);
          setTrustScore(null);
        });
      }
      else setError("This listing could not be found.");
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setError("This listing is unavailable or has not been verified yet.");
      setLoading(false);
    });
    return () => { active = false; };
  }, [listingId]);

  useEffect(() => {
    const ownerId = listing?.ownerId;
    if (!ownerId) return undefined;

    let active = true;
    getDoc(doc(db, "publicProfiles", ownerId))
      .then((snapshot) => {
        if (active) setOwnerProfileResult({ ownerId, profile: snapshot.exists() ? snapshot.data() : null });
      })
      .catch(() => {
        if (active) setOwnerProfileResult({ ownerId, profile: null });
      });

    return () => { active = false; };
  }, [listing?.ownerId]);

  const isOwner = listing && user?.uid === listing.ownerId;
  const isSale = listing?.listingPurpose === "sale";
  const priceBasis = isSale ? "asking price" : listing?.rentalTerm === "short_term" || listing?.pricePeriod === "day" ? "per night" : "per month";
  const ownerProfile = ownerProfileResult?.ownerId && ownerProfileResult.ownerId === listing?.ownerId
    ? ownerProfileResult.profile
    : null;
  const ownerNameFromListing = listing?.ownerName && !listing.ownerName.includes("@") ? listing.ownerName : "";
  const ownerName = ownerProfile?.name || ownerNameFromListing || "TrustHome member";
  const ownerContactEmail = ownerProfile?.contactEmail || "";
  const ownerContactPhone = ownerProfile?.contactPhone || "";
  const hasOwnerContact = Boolean(ownerContactEmail || ownerContactPhone);

  return (
    <div className="user-page">
      <PublicNav />
      <main className="user-page__content">
        <Link to="/browse" className="user-page__back"><ArrowLeft size={16} aria-hidden="true" /> Browse listings</Link>
        {loading ? <p className="user-page__empty">Loading listing...</p> : error ? (
          <div className="user-page__empty" role="alert"><h1>Listing unavailable</h1><p>{error}</p></div>
        ) : (
          <article className="listing-detail">
            <div className="listing-detail__gallery">
              {listing.photoUrls?.length ? listing.photoUrls.map((photo, index) => (
                <img key={photo} src={photo} alt={`${listing.title || "Property"} photo ${index + 1}`} />
              )) : <div className="listing-detail__placeholder">No property photos</div>}
            </div>
            <div className="listing-detail__content">
              <div className="listing-detail__heading">
                <div>
                  <span className={`badge badge--${listing.verificationStatus === "verified" ? "verified" : "pending"}`}>
                    {listing.verificationStatus || "pending"}
                  </span>
                  <h1>{listing.title || "Untitled listing"}</h1>
                  <p className="listing-detail__location"><MapPin size={16} aria-hidden="true" />{listing.city || "Location not provided"}</p>
                </div>
                {isOwner && <Link to={`/listings/${listing.id}/edit`} className="btn btn--secondary"><Pencil size={15} aria-hidden="true" /> Edit</Link>}
              </div>
              <div className="listing-detail__price-row">
                <p className="listing-detail__price">{formatCurrency(listing.price)} <span>{priceBasis}</span></p>
                {listing.verificationStatus === "verified" && !isSale && !isOwner && (
                  <Link to={`/listings/${listing.id}/book`} className="btn btn--primary listing-detail__booking-cta">
                    {user ? "Request booking" : "Sign in to book"}
                  </Link>
                )}
              </div>
              {!isSale && <div className="listing-detail__facts" aria-label="Trust and fairness summary">
                <span>Trust score <strong>{trustScore ? `${(Number(trustScore.score) * 5).toFixed(1)} / 5` : "Building history"}</strong></span>
                <span>Price fairness <strong>{trustScore?.priceFairnessLabel || "Insufficient data"}</strong></span>
              </div>}
              {listing.ownerId && (
                <section className="listing-detail__owner" aria-label="Listing owner">
                  <span className="listing-detail__owner-avatar" aria-hidden="true">
                    <UserRound size={18} />
                  </span>
                  <div className="listing-detail__owner-copy">
                    <p>Listed by</p>
                    <strong>{ownerName}</strong>
                    <span>
                      {isOwner
                        ? "This is your listing."
                        : isSale
                          ? hasOwnerContact
                            ? "The owner chose to share contact details. Sale arrangements happen outside TrustHome."
                            : "Direct seller contact is not available through TrustHome yet."
                          : user
                            ? hasOwnerContact
                              ? "Send a booking request or use the contact options shared by the owner."
                              : "Your booking request will be sent to the owner."
                            : hasOwnerContact
                              ? "Sign in to request a stay, or use the contact options shared by the owner."
                              : "Sign in to request a stay and contact the owner."}
                    </span>
                    {(ownerContactEmail || ownerContactPhone) && (
                      <div className="listing-detail__owner-contacts">
                        {ownerContactEmail && <a href={`mailto:${ownerContactEmail}`}><Mail size={14} aria-hidden="true" /> Email owner</a>}
                        {ownerContactPhone && <a href={`tel:${ownerContactPhone}`}><Phone size={14} aria-hidden="true" /> Call owner</a>}
                      </div>
                    )}
                  </div>
                  <Link className="btn btn--secondary listing-detail__owner-link" to={`/profiles/${listing.ownerId}`}>
                    View profile
                  </Link>
                </section>
              )}
              <p className="listing-detail__description">{listing.description || "No description provided."}</p>
              {isValidMapLocation(listing.mapLocation) && (
                <section className="listing-detail__map" aria-labelledby="listing-map-title">
                  <h2 id="listing-map-title">Approximate area</h2>
                  <PropertyMap location={listing.mapLocation} label="Approximate property area map" />
                </section>
              )}
              {listing.verificationStatus === "rejected" && listing.rejectionReason && (
                <div className="listing-detail__rejection" role="alert">
                  <strong>Review note</strong>
                  <span>{listing.rejectionReason}</span>
                </div>
              )}
              <div className="listing-detail__facts">
                <span>Purpose <strong>{isSale ? "For sale" : listing.rentalTerm === "short_term" || listing.pricePeriod === "day" ? "Short-term rental" : "Long-term rental"}</strong></span>
                <span>Type <strong>{listing.type || "Not specified"}</strong></span>
                <span>Floor area <strong>{listing.floorArea ? `${listing.floorArea} sqm` : "Not specified"}</strong></span>
                <span>Lot area <strong>{listing.lotArea ? `${listing.lotArea} sqm` : "Not specified"}</strong></span>
                {listing.propertyCondition && <span>Condition <strong>{formatOptionLabel(listing.propertyCondition)}</strong></span>}
                {listing.furnishingStatus && <span>Furnishing <strong>{formatOptionLabel(listing.furnishingStatus)}</strong></span>}
              </div>
              {listing.verificationStatus === "verified" && (
                <p className="listing-detail__verified"><ShieldCheck size={16} aria-hidden="true" /> Ownership document reviewed by TrustHome</p>
              )}
              <section className="listing-detail__reviews" aria-labelledby="listing-reviews-title">
                <h2 id="listing-reviews-title">Reviews</h2>
                {ratings.length === 0 ? <p>No reviews yet.</p> : <>
                  <p className="listing-detail__rating-summary"><strong>{averageRating(ratings).toFixed(1)}</strong> / 5 from {ratings.length} review{ratings.length === 1 ? "" : "s"}</p>
                  <ul className="listing-detail__review-list">{ratings.slice(0, 5).map((rating, index) => <li key={`${rating.reviewerId || "review"}-${index}`}><strong>{rating.reviewerName || "TrustHome user"}</strong><span>{rating.score} / 5</span><p>{rating.comment}</p></li>)}</ul>
                </>}
              </section>
            </div>
          </article>
        )}
      </main>
    </div>
  );
}

function averageRating(ratings) {
  return ratings.reduce((total, rating) => total + Number(rating.score || 0), 0) / ratings.length;
}

function formatOptionLabel(value) {
  return String(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}