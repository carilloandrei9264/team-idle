import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import PublicNav from "../components/PublicNav";
import { useAuth } from "../context/useAuth";
import { db } from "../firebase";
import "./UserPages.css";

export default function MyListings() {
  const { user } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const listingsQuery = query(collection(db, "listings"), where("ownerId", "==", user.uid));
    return onSnapshot(listingsQuery, (snapshot) => {
      setListings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      setLoading(false);
    }, () => setLoading(false));
  }, [user.uid]);

  return (
    <div className="user-page">
      <PublicNav />
      <main className="user-page__content">
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
        </header>
        {loading ? <p className="user-page__empty">Loading your listings...</p> : listings.length === 0 ? (
          <div className="user-page__empty">
            <h2>No listings yet</h2>
            <p>Your submitted properties will appear here.</p>
          </div>
        ) : (
          <div className="user-page__list">
            {listings.map((listing) => (
              <article className="user-page__item" key={listing.id}>
                <Link to={`/listings/${listing.id}`} className="user-page__item-link">
                  <h2>{listing.title || "Untitled listing"}</h2>
                  <p>{listing.city || "Location not provided"}</p>
                  {listing.verificationStatus === "rejected" && listing.rejectionReason && (
                    <p className="user-page__rejection">Review note: {listing.rejectionReason}</p>
                  )}
                </Link>
                <span className={`badge badge--${listing.verificationStatus === "verified" ? "verified" : listing.verificationStatus === "rejected" ? "danger" : "pending"}`}>
                  {listing.verificationStatus || "pending"}
                </span>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}