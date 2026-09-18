import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import PublicNav from "../components/PublicNav";
import { db } from "../firebase";
import "./UserPages.css";

export default function PublicProfile() {
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [ratings, setRatings] = useState([]);
  const [listingCount, setListingCount] = useState(0);
  const [disputeCount, setDisputeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      getDocs(query(collection(db, "publicProfiles"), where("userId", "==", userId))),
      getDocs(query(collection(db, "listings"), where("ownerId", "==", userId), where("verificationStatus", "==", "verified"))),
      getDocs(query(collection(db, "ratings"), where("ownerId", "==", userId))),
    ]).then(([profiles, listings, ownerRatings]) => {
      setProfile(profiles.docs[0]?.data() || null);
      setListingCount(listings.size);
      setRatings(ownerRatings.docs.map((item) => item.data()));
      setDisputeCount(profiles.docs[0]?.data()?.foundedDisputeCount || 0);
      setLoading(false);
    }).catch(() => { setError("This profile could not be loaded."); setLoading(false); });
  }, [userId]);

  const average = ratings.length ? ratings.reduce((sum, rating) => sum + Number(rating.score || 0), 0) / ratings.length : null;
  return <div className="user-page"><PublicNav /><main className="user-page__content"><Link to="/browse" className="user-page__back"><ArrowLeft size={16} aria-hidden="true" /> Browse</Link>{loading ? <p className="user-page__empty">Loading profile...</p> : error ? <div className="user-page__empty" role="alert">{error}</div> : <section className="user-page__empty public-profile"><div className="account-summary__avatar" aria-hidden="true">{(profile?.name || "T").charAt(0).toUpperCase()}</div><p className="user-page__eyebrow">TrustHome member</p><h1>{profile?.name || "TrustHome member"}</h1><p className="listing-detail__verified"><ShieldCheck size={16} aria-hidden="true" /> Verified account</p><div className="listing-detail__facts"><span>Verified listings <strong>{listingCount}</strong></span><span>Ratings <strong>{ratings.length}</strong></span><span>Average rating <strong>{average ? `${average.toFixed(1)} / 5` : "No ratings yet"}</strong></span></div>{disputeCount > 0 && <p className="listing-detail__rejection" role="alert">Accountability record: {disputeCount} founded dispute{disputeCount === 1 ? "" : "s"}</p>}</section>}</main></div>;
}
