import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { ArrowLeft, CalendarDays, MapPin, Pencil, ShieldCheck } from "lucide-react";
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

  useEffect(() => {
    let active = true;
    getDoc(doc(db, "listings", listingId)).then((snapshot) => {
      if (!active) return;
      if (snapshot.exists()) setListing({ id: snapshot.id, ...snapshot.data() });
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
              {listing.verificationStatus === "verified" && <p className="listing-detail__verified"><ShieldCheck size={16} aria-hidden="true" /> Ownership document reviewed by TrustHome</p>}
              {listing.verificationStatus === "verified" && !isOwner && (
                <Link to={`/listings/${listing.id}/book`} className="btn btn--primary listing-detail__booking-cta"><CalendarDays size={17} aria-hidden="true" /> Request booking</Link>
              )}
            </div>
          </article>
        )}
      </main>
    </div>
  );
}