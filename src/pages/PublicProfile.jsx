import { useEffect, useState } from "react";
import { collection, getDocs, getDoc, doc, query, where } from "firebase/firestore";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import PublicNav from "../components/PublicNav";
import { db } from "../firebase";
import "./UserPages.css";

export default function PublicProfile() {
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [listingCount, setListingCount] = useState(0);
  const [accountability, setAccountability] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      getDoc(doc(db, "publicProfiles", userId)),
      getDoc(doc(db, "publicAccountability", userId)),
      getDocs(query(collection(db, "listings"), where("ownerId", "==", userId), where("verificationStatus", "==", "verified"))),
      getDocs(query(collection(db, "ratings"), where("ownerId", "==", userId))),
    ]).then(([profileSnapshot, accountabilitySnapshot, listings, ownerRatings]) => {
      setProfile(profileSnapshot.exists() ? profileSnapshot.data() : null);
      setAccountability(accountabilitySnapshot.exists() ? accountabilitySnapshot.data() : null);
      setListingCount(listings.size);
      setRatings(ownerRatings.docs.map((item) => item.data()));
      setLoading(false);
    }).catch(() => { setError("This profile could not be loaded."); setLoading(false); });
  }, [userId]);

  const average = ratings.length ? ratings.reduce((sum, rating) => sum + Number(rating.score || 0), 0) / ratings.length : null;
  const foundedDisputes = Number(accountability?.foundedDisputes || 0);
  const displayName = profile?.name && !profile.name.includes("@") ? profile.name : "TrustHome member";
  const contactEmail = profile?.contactEmail || "";
  const contactPhone = profile?.contactPhone || "";

  return (
    <div className="user-page">
      <PublicNav />
      <main className="user-page__content">
        <Link to="/browse" className="user-page__back"><ArrowLeft size={16} aria-hidden="true" /> Browse</Link>
        {loading ? (
          <p className="user-page__empty">Loading profile...</p>
        ) : error ? (
          <div className="user-page__empty" role="alert">{error}</div>
        ) : (
          <section className="user-page__empty public-profile">
            <div className="account-summary__avatar" aria-hidden="true">{displayName.charAt(0).toUpperCase()}</div>
            <p className="user-page__eyebrow">Public owner profile</p>
            <h1>{displayName}</h1>
            {foundedDisputes > 0 && (
              <p className="public-profile__flag" role="status">
                {foundedDisputes} founded {foundedDisputes === 1 ? "dispute" : "disputes"} on record
              </p>
            )}
            <div className="listing-detail__facts">
              <span>Verified listings <strong>{listingCount}</strong></span>
              <span>Ratings <strong>{ratings.length}</strong></span>
              <span>Average rating <strong>{average !== null ? `${average.toFixed(1)} / 5` : "No ratings yet"}</strong></span>
            </div>
            {(contactEmail || contactPhone) && (
              <div className="public-profile__contact" aria-label="Owner contact details">
                {contactEmail && (
                  <div className="public-profile__contact-method">
                    <span className="public-profile__contact-value"><Mail size={16} aria-hidden="true" /><span>{contactEmail}</span></span>
                    <a className="btn btn--secondary" href={`mailto:${contactEmail}`}>Email owner</a>
                  </div>
                )}
                {contactPhone && (
                  <div className="public-profile__contact-method">
                    <span className="public-profile__contact-value"><Phone size={16} aria-hidden="true" /><span>{contactPhone}</span></span>
                    <a className="btn btn--secondary" href={`tel:${contactPhone}`}>Call owner</a>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
