import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Eye, Pencil, Plus } from "lucide-react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import PublicNav from "../components/PublicNav";
import { useAuth } from "../context/useAuth";
import { db } from "../firebase";
import { formatCurrency } from "../lib/number";
import "./UserPages.css";

export default function MyListings({ embedded = false }) {
  const { user } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingRequests, setPendingRequests] = useState(null);
  const [requestsError, setRequestsError] = useState(false);

  useEffect(() => {
    const listingsQuery = query(collection(db, "listings"), where("ownerId", "==", user.uid));
    return onSnapshot(listingsQuery, (snapshot) => {
      setListings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      setLoading(false);
    }, () => setLoading(false));
  }, [user.uid]);

  useEffect(() => onSnapshot(
    query(collection(db, "bookings"), where("ownerId", "==", user.uid)),
    (snapshot) => {
      const counts = {};
      snapshot.docs.forEach((item) => {
        const booking = item.data();
        if (booking.status === "Pending" && booking.listingId) {
          counts[booking.listingId] = (counts[booking.listingId] || 0) + 1;
        }
      });
      setPendingRequests(counts);
      setRequestsError(false);
    },
    () => {
      setPendingRequests({});
      setRequestsError(true);
    }
  ), [user.uid]);

  function renderListing(listing) {
    const cover = listing.photoUrls?.[0];
    const isSale = listing.listingPurpose === "sale";
    const priceBasis = isSale ? "asking price" : listing.rentalTerm === "short_term" || listing.pricePeriod === "day" ? "per night" : "per month";
    const pendingCount = pendingRequests?.[listing.id] || 0;
    const details = [
      listing.type,
      listing.bedrooms != null ? `${listing.bedrooms} bedrooms` : null,
    ].filter(Boolean);

    return (
      <article className="owner-listing-card" key={listing.id}>
        <div className="owner-listing-card__image">
          {cover ? <img src={cover} alt="" loading="lazy" /> : <Building2 size={28} aria-hidden="true" />}
        </div>
        <div className="owner-listing-card__body">
          <div className="owner-listing-card__heading">
            <div>
              <h2>{listing.title || "Untitled listing"}</h2>
              <p>{[listing.listingPurpose === "sale" ? "For sale" : listing.rentalTerm === "short_term" || listing.pricePeriod === "day" ? "Short-term rental" : "Long-term rental", listing.city || "Location not provided", ...details].join(" · ")}</p>
            </div>
            <span className={`badge badge--${listing.verificationStatus === "verified" ? "verified" : listing.verificationStatus === "rejected" ? "danger" : "pending"}`}>
              {listing.resubmissionRequested ? "changes requested" : listing.verificationStatus || "pending"}
            </span>
          </div>
          <div className="owner-listing-card__details">
            <strong>{formatCurrency(listing.price)}<span> · {priceBasis}</span></strong>
            {!isSale && <div className="owner-listing-card__requests">
              <span>{requestsError ? "Request count unavailable" : pendingRequests === null ? "Loading requests..." : `${pendingCount} pending ${pendingCount === 1 ? "request" : "requests"}`}</span>
              <Link to={`/my-activity?tab=requests&listingId=${encodeURIComponent(listing.id)}`}>
                Review requests
              </Link>
            </div>}
          </div>
          {listing.verificationStatus === "rejected" && listing.rejectionReason && (
            <p className="owner-listing-card__review-note">
              {listing.resubmissionRequested ? "Changes requested: " : "Review note: "}{listing.rejectionReason}
            </p>
          )}
          <div className="owner-listing-card__actions">
            <Link to={`/listings/${listing.id}`} className="btn btn--secondary"><Eye size={15} aria-hidden="true" /> View</Link>
            <Link to={`/listings/${listing.id}/edit`} className="btn btn--secondary"><Pencil size={15} aria-hidden="true" /> Edit</Link>
          </div>
        </div>
      </article>
    );
  }

  const content = (
    <>
      <header className="user-page__header">
        <div>
          <p className="user-page__eyebrow">Your account</p>
          <h1>My Listings</h1>
          <p>Track the properties you have submitted for verification.</p>
        </div>
        <Link to="/listings/new" className="btn btn--primary">
          <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
          Create listing
        </Link>
        <Link to="/my-activity?tab=requests" className="btn btn--secondary">Manage requests</Link>
      </header>
      {loading ? <p className="user-page__empty">Loading your listings...</p> : listings.length === 0 ? (
        <div className="user-page__empty">
          <h2>No listings yet</h2>
          <p>Your submitted properties will appear here.</p>
        </div>
      ) : (
        <div className="owner-listing-list">{listings.map(renderListing)}</div>
      )}
    </>
  );

  if (embedded) return content;

  return (
    <div className="user-page">
      <PublicNav />
      <main className="user-page__content">
        {content}
      </main>
    </div>
  );
}