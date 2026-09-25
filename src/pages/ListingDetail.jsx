import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { ArrowLeft, MapPin, Pencil, ShieldCheck } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import PublicNav from "../components/PublicNav";
import { useAuth } from "../context/useAuth";
import { db } from "../firebase";
import { formatCurrency } from "../lib/number";
import "./UserPages.css";

export default function ListingDetail() {
  const { listingId } = useParams();
  const { user } = useAuth();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ratings, setRatings] = useState([]);
  const [trustScore, setTrustScore] = useState(null);

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

  const isOwner = listing && user?.uid === listing.ownerId;

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
              <p className="listing-detail__price">{formatCurrency(listing.price)} <span>/{listing.pricePeriod || "month"}</span></p>
              <div className="listing-detail__facts" aria-label="Trust and fairness summary">
                <span>Trust score <strong>{trustScore ? `${(Number(trustScore.score) * 5).toFixed(1)} / 5` : "Building history"}</strong></span>
                <span>Price fairness <strong>{trustScore?.priceFairnessLabel || "Insufficient data"}</strong></span>
              </div>
              <p className="listing-detail__description">{listing.description || "No description provided."}</p>
              {listing.verificationStatus === "rejected" && listing.rejectionReason && (
                <div className="listing-detail__rejection" role="alert">
                  <strong>Review note</strong>
                  <span>{listing.rejectionReason}</span>
                </div>
              )}
              <div className="listing-detail__facts">
                <span>Type <strong>{listing.type || "Not specified"}</strong></span>
                <span>Floor area <strong>{listing.floorArea ? `${listing.floorArea} sqm` : "Not specified"}</strong></span>
                <span>Lot area <strong>{listing.lotArea ? `${listing.lotArea} sqm` : "Not specified"}</strong></span>
              </div>
              {listing.verificationStatus === "verified" && <>
                <p className="listing-detail__verified"><ShieldCheck size={16} aria-hidden="true" /> Ownership document reviewed by TrustHome</p>
                {!isOwner && user && <Link to={`/listings/${listing.id}/book`} className="btn btn--primary">Request booking</Link>}
              </>}
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