import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Activity, CalendarDays, CheckCircle2, Home, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import PublicNav from "../components/PublicNav";
import { useAuth } from "../context/useAuth";
import { db } from "../firebase";
import { formatBookingDate } from "../lib/booking";
import "./MyDashboard.css";

export default function MyDashboard() {
  const { user } = useAuth();
  const [listings, setListings] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let listingsReady = false;
    let bookingsReady = false;
    const finishLoading = () => {
      if (listingsReady && bookingsReady) setLoading(false);
    };
    const unsubscribeListings = onSnapshot(
      query(collection(db, "listings"), where("ownerId", "==", user.uid)),
      (snapshot) => {
        setListings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        listingsReady = true;
        finishLoading();
      },
      () => {
        setError("Your dashboard data could not be loaded.");
        listingsReady = true;
        finishLoading();
      }
    );
    const unsubscribeBookings = onSnapshot(
      query(collection(db, "bookings"), where("ownerId", "==", user.uid)),
      (snapshot) => {
        setBookings(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        bookingsReady = true;
        finishLoading();
      },
      () => {
        setError("Your dashboard data could not be loaded.");
        bookingsReady = true;
        finishLoading();
      }
    );
    return () => {
      unsubscribeListings();
      unsubscribeBookings();
    };
  }, [user.uid]);

  const pendingRequests = bookings.filter((booking) => booking.status === "Pending");
  const confirmedBookings = bookings.filter((booking) => booking.status === "Confirmed");
  const completedBookings = bookings.filter((booking) => booking.status === "Completed");
  const recentBookings = [...bookings]
    .sort((first, second) => (second.createdAt?.toMillis?.() || 0) - (first.createdAt?.toMillis?.() || 0))
    .slice(0, 5);

  return (
    <div className="user-page">
      <PublicNav />
      <main className="user-page__content dashboard-page">
        <header className="user-page__header">
          <div>
            <p className="user-page__eyebrow">Owner tools</p>
            <h1>My Dashboard</h1>
            <p>See listing health, incoming requests, and confirmed activity at a glance.</p>
          </div>
          <Link to="/listings/new" className="btn btn--primary"><Plus size={16} aria-hidden="true" /> Create listing</Link>
        </header>

        {error && <p className="user-page__form-error" role="alert">{error}</p>}
        {loading ? <p className="user-page__empty">Loading your dashboard...</p> : <>
          <section className="dashboard-page__stats" aria-label="Owner activity summary">
            <StatCard icon={Home} label="My listings" value={listings.length} />
            <StatCard icon={Activity} label="Pending requests" value={pendingRequests.length} tone="warning" />
            <StatCard icon={CalendarDays} label="Confirmed bookings" value={confirmedBookings.length} tone="primary" />
            <StatCard icon={CheckCircle2} label="Completed stays" value={completedBookings.length} tone="success" />
          </section>

          <div className="dashboard-page__columns">
            <section className="dashboard-page__section" aria-labelledby="dashboard-listings-title">
              <div className="dashboard-page__section-heading"><div><p className="user-page__eyebrow">Performance</p><h2 id="dashboard-listings-title">Listing activity</h2></div><Link to="/my-listings" className="btn btn--secondary">View listings</Link></div>
              {listings.length === 0 ? <div className="user-page__empty"><h3>No listings yet</h3><p>Create a listing to start receiving booking requests.</p></div> : <div className="dashboard-page__list">{listings.map((listing) => {
                const listingBookings = bookings.filter((booking) => booking.listingId === listing.id);
                const listingPending = listingBookings.filter((booking) => booking.status === "Pending").length;
                return <article className="dashboard-page__listing" key={listing.id}><div><h3>{listing.title || "Untitled listing"}</h3><p>{listing.city || "Location not provided"}</p></div><div className="dashboard-page__listing-meta"><span className={`badge badge--${listing.verificationStatus === "verified" ? "verified" : "pending"}`}>{listing.verificationStatus || "pending"}</span><strong>{listingPending} pending</strong><Link to={`/listings/${listing.id}`}>Open</Link></div></article>;
              })}</div>}
            </section>

            <section className="dashboard-page__section" aria-labelledby="dashboard-bookings-title">
              <div className="dashboard-page__section-heading"><div><p className="user-page__eyebrow">Recent activity</p><h2 id="dashboard-bookings-title">Booking requests</h2></div><Link to="/manage-bookings" className="btn btn--secondary">Manage</Link></div>
              {recentBookings.length === 0 ? <div className="user-page__empty"><h3>No booking activity</h3><p>Requests for your listings will appear here.</p></div> : <div className="dashboard-page__list">{recentBookings.map((booking) => <article className="dashboard-page__booking" key={booking.id}><div><h3>{booking.listingTitle || "Listing"}</h3><p>{booking.renterName || "TrustHome user"}</p><p>{formatBookingDate(booking.startDate)} to {formatBookingDate(booking.endDate)}</p></div><span className={`badge badge--${booking.status === "Confirmed" || booking.status === "Completed" ? "verified" : booking.status === "Disputed" ? "danger" : "pending"}`}>{booking.status}</span></article>)}</div>}
            </section>
          </div>
        </>}
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone = "neutral" }) {
  return <article className={`dashboard-page__stat dashboard-page__stat--${tone}`}><span className="dashboard-page__stat-icon" aria-hidden="true"><Icon size={20} /></span><span className="dashboard-page__stat-label">{label}</span><strong>{value}</strong></article>;
}
