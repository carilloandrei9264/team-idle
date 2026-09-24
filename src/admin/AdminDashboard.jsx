import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getCountFromServer,
} from "firebase/firestore";
import { db } from "../firebase";
import { FileCheck, ShieldAlert, Users as UsersIcon, RefreshCw, Sparkles } from "lucide-react";
import "./AdminDashboard.css";

const TODAY = new Date().toLocaleDateString(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});

export default function AdminDashboard() {
  const [counts, setCounts] = useState({ pendingListings: null, openDisputes: null, totalUsers: null });
  const [activity, setActivity] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [dashboardError, setDashboardError] = useState("");

  async function loadDashboard() {
    setDashboardError("");
    setLoadingActivity(true);
    try {
      const [pendingListings, openDisputes, totalUsers, listingsSnap, disputesSnap, usersSnap] = await Promise.all([
        getCountFromServer(query(collection(db, "listings"), where("verificationStatus", "==", "pending"))),
        getCountFromServer(query(collection(db, "disputes"), where("status", "==", "Open"))),
        getCountFromServer(collection(db, "users")),
        getDocs(query(collection(db, "listings"), orderBy("createdAt", "desc"), limit(5))),
        getDocs(query(collection(db, "disputes"), orderBy("createdAt", "desc"), limit(5))),
        getDocs(query(collection(db, "users"), orderBy("createdAt", "desc"), limit(5))),
      ]);

      setCounts({
        pendingListings: pendingListings.data().count,
        openDisputes: openDisputes.data().count,
        totalUsers: totalUsers.data().count,
      });

      const events = [
        ...listingsSnap.docs.map((d) => ({
          id: `listing-${d.id}`,
          at: d.data().createdAt,
          text: `Listing "${d.data().title ?? d.id}" submitted for review`,
        })),
        ...disputesSnap.docs.map((d) => ({
          id: `dispute-${d.id}`,
          at: d.data().createdAt,
          text: `Dispute #${d.id.slice(0, 6)} raised — ${d.data().reason ?? "no reason given"}`,
        })),
        ...usersSnap.docs.map((d) => ({
          id: `user-${d.id}`,
          at: d.data().createdAt,
          text: `New user registered: ${d.data().name ?? d.data().email}`,
        })),
      ]
        .filter((event) => event.at)
        .sort((a, b) => b.at.toMillis() - a.at.toMillis())
        .slice(0, 5);

      setActivity(events);
    } catch {
      setDashboardError("The dashboard data could not be loaded. Check your connection and try again.");
    } finally {
      setLoadingActivity(false);
    }
  }

  useEffect(() => {
    queueMicrotask(loadDashboard);
  }, []);

  // Real signal, not decoration: while the team is still seeding data,
  // an empty dashboard reads as broken rather than "new". Show next
  // steps instead of blank panels until there's enough to look at.
  const isEarlyState =
    counts.totalUsers !== null && counts.totalUsers <= 2 && counts.pendingListings === 0;

  return (
    <div className="dashboard">
      <div className="dashboard__header">
        <h1 className="dashboard__title">Dashboard</h1>
        <p className="dashboard__date">{TODAY}</p>
      </div>

      {dashboardError && (
        <div className="dashboard__error" role="alert">
          <span>{dashboardError}</span>
          <button type="button" className="btn btn--secondary" onClick={loadDashboard}>
            <RefreshCw size={16} aria-hidden="true" /> Retry
          </button>
        </div>
      )}

      <div className="stat-row">
        <StatCard label="Pending Listings" value={counts.pendingListings} tone="warning" icon={FileCheck} />
        <StatCard label="Open Disputes" value={counts.openDisputes} tone="danger" icon={ShieldAlert} />
        <StatCard label="Total Users" value={counts.totalUsers} tone="primary" icon={UsersIcon} />
      </div>

      <div className="dashboard__grid">
        <section className="panel">
          <h2 className="panel__title">Recent activity</h2>
          {loadingActivity ? (
            <p className="panel__empty">Loading…</p>
          ) : activity.length === 0 ? (
            <p className="panel__empty">Nothing to show yet.</p>
          ) : (
            <ul className="activity-list">
              {activity.map((event) => (
                <li key={event.id} className="activity-list__item">
                  <span className="activity-list__dot" aria-hidden="true" />
                  {event.text}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h2 className="panel__title">Quick actions</h2>
          <div className="quick-actions">
            <a href="/admin/listings" className="btn btn--secondary btn--block">
              <FileCheck size={16} aria-hidden="true" />
              Review Listings
            </a>
            <a href="/admin/disputes" className="btn btn--secondary btn--block">
              <ShieldAlert size={16} aria-hidden="true" />
              Review Disputes
            </a>
            <a href="/admin/bank-catalog" className="btn btn--secondary btn--block">
              <RefreshCw size={16} aria-hidden="true" />
              Run Bank Scraper
            </a>
          </div>
        </section>
      </div>

      {isEarlyState && (
        <section className="panel panel--wide getting-started">
          <div className="getting-started__heading">
            <Sparkles size={18} aria-hidden="true" />
            <h2 className="panel__title panel__title--inline">Getting started</h2>
          </div>
          <ul className="getting-started__list">
            <li>Ask each teammate to sign up so they show up under Users.</li>
            <li>Seed a few listings (mixed pending/verified) so the review queue has something to demo.</li>
            <li>Run the bank scraper once from Bank Catalog so it has a real "last verified" date.</li>
            <li>Submit one test dispute so the review flow and public flag have something to show.</li>
          </ul>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value, tone, icon: Icon }) {
  return (
    <div className="stat-card">
      <div className={`stat-card__icon stat-card__icon--${tone}`}>
        <Icon size={18} aria-hidden="true" />
      </div>
      <span className={`stat-card__value stat-card__value--${tone}`}>
        {value === null ? "—" : value}
      </span>
      <span className="stat-card__label">{label}</span>
    </div>
  );
}
