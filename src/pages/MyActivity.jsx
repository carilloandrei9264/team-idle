import { Building2, CalendarCheck, Inbox } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import PublicNav from "../components/PublicNav";
import MyListings from "./MyListings";
import MyBookings from "./MyBookings";
import BookingRequests from "./BookingRequests";
import "./MyActivity.css";

const ACTIVITY_TABS = [
  { id: "listings", label: "My listings", icon: Building2, Component: MyListings },
  { id: "bookings", label: "My bookings", icon: CalendarCheck, Component: MyBookings },
  { id: "requests", label: "Booking requests", icon: Inbox, Component: BookingRequests },
];

export default function MyActivity() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const activeTab = ACTIVITY_TABS.find((tab) => tab.id === requestedTab) || ACTIVITY_TABS[0];
  const ActiveView = activeTab.Component;

  function handleTabKeyDown(event, currentIndex) {
    let nextIndex;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % ACTIVITY_TABS.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + ACTIVITY_TABS.length) % ACTIVITY_TABS.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = ACTIVITY_TABS.length - 1;
    if (nextIndex === undefined) return;

    event.preventDefault();
    const nextTab = ACTIVITY_TABS[nextIndex];
    document.getElementById(`activity-tab-${nextTab.id}`)?.focus();
    setSearchParams({ tab: nextTab.id });
  }

  return (
    <div className="user-page">
      <PublicNav />
      <main className="user-page__content my-activity">
        <header className="user-page__header">
          <div>
            <p className="user-page__eyebrow">Your account</p>
            <h1>My activity</h1>
            <p>Manage your listings, stays, and incoming booking requests.</p>
          </div>
        </header>
        <div className="my-activity__tabs" role="tablist" aria-label="My activity">
          {ACTIVITY_TABS.map(({ id, label, icon: Icon }, index) => (
            <button
              key={id}
              id={`activity-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={activeTab.id === id}
              aria-controls="activity-panel"
              tabIndex={activeTab.id === id ? 0 : -1}
              className="my-activity__tab"
              onClick={() => setSearchParams({ tab: id })}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              <Icon size={17} aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        <section
          id="activity-panel"
          className="my-activity__panel"
          role="tabpanel"
          aria-labelledby={`activity-tab-${activeTab.id}`}
          tabIndex={0}
        >
          <ActiveView embedded />
        </section>
      </main>
    </div>
  );
}
