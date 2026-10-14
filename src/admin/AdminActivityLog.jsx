import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query, limit } from "firebase/firestore";
import { ChevronDown, ChevronLeft, ChevronRight, Clock3, Search, UserRound } from "lucide-react";
import { db } from "../firebase";
import { describeAccountActivityEntry, formatAccountActivityAction } from "../lib/accountActivity";
import "./AdminDashboard.css";

const MAX_LOG_ITEMS = 200;
const PAGE_SIZE = 20;

export default function AdminActivityLog() {
  const [entries, setEntries] = useState([]);
  const [page, setPage] = useState(0);
  const [searchText, setSearchText] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const normalizedSearch = searchText.trim().toLowerCase();
  const filteredEntries = entries.filter((entry) => {
    if (actionFilter && entry.action !== actionFilter) return false;
    if (!normalizedSearch) return true;

    const searchableText = [
      formatAccountActivityAction(entry.action),
      describeAccountActivityEntry(entry),
      entry.actorId,
      entry.actorRole,
      entry.entityType,
      entry.entityId,
      entry.details ? JSON.stringify(entry.details) : "",
    ].join(" ").toLowerCase();

    return searchableText.includes(normalizedSearch);
  });
  const actionOptions = [...new Set(entries.map((entry) => entry.action).filter(Boolean))]
    .sort((first, second) => formatAccountActivityAction(first).localeCompare(formatAccountActivityAction(second)));
  const pageCount = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageEntries = filteredEntries.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  function clearFilters() {
    setSearchText("");
    setActionFilter("");
    setPage(0);
  }

  async function loadActivityLog() {
    setError("");
    setLoading(true);

    try {
      const snapshot = await getDocs(
        query(collection(db, "accountActivity"), orderBy("createdAt", "desc"), limit(MAX_LOG_ITEMS)),
      );

      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setEntries(items);
    } catch {
      setError("The audit log could not be loaded. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadActivityLog();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="dashboard">
      <div className="dashboard__header">
        <div>
          <h1 className="dashboard__title">Activity Log</h1>
          <p className="dashboard__date">Audit trail for the platform</p>
        </div>
      </div>

      {error && (
        <div className="dashboard__error" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn--secondary" onClick={loadActivityLog}>
            Retry
          </button>
        </div>
      )}

      {!loading && entries.length > 0 && (
        <div className="activity-log__toolbar">
          <label className="admin-search-wrap activity-log__search">
            <Search size={16} aria-hidden="true" />
            <input
              className="admin-search"
              type="search"
              value={searchText}
              onChange={(event) => { setSearchText(event.target.value); setPage(0); }}
              placeholder="Search actor, event, or entity"
              aria-label="Search activity log"
            />
          </label>
          <label className="sr-only" htmlFor="activity-action-filter">Filter by event type</label>
          <select
            id="activity-action-filter"
            className="admin-search activity-log__action-filter"
            value={actionFilter}
            onChange={(event) => { setActionFilter(event.target.value); setPage(0); }}
          >
            <option value="">All event types</option>
            {actionOptions.map((action) => (
              <option key={action} value={action}>{formatAccountActivityAction(action)}</option>
            ))}
          </select>
          {(searchText || actionFilter) && (
            <button type="button" className="activity-log__clear" onClick={clearFilters}>
              Clear filters
            </button>
          )}
          <span className="activity-log__result-count" aria-live="polite">
            {filteredEntries.length} {filteredEntries.length === 1 ? "event" : "events"}
          </span>
        </div>
      )}

      <section className="panel">
        {loading ? (
          <p className="panel__empty">Loading audit log…</p>
        ) : entries.length === 0 ? (
          <p className="panel__empty">No activity has been recorded yet.</p>
        ) : filteredEntries.length === 0 ? (
          <div className="activity-log__no-results">
            <p>No activity matches these filters.</p>
            <button type="button" className="activity-log__clear" onClick={clearFilters}>Clear filters</button>
          </div>
        ) : (
          <ul className="activity-log">
            {pageEntries.map((entry) => (
              <li key={entry.id} className="activity-log__item">
                <div className="activity-log__meta">
                  <span className="activity-log__badge">
                    {formatAccountActivityAction(entry.action)}
                  </span>
                  <time className="activity-log__time" dateTime={formatIsoDate(entry.createdAt)}>
                    {formatFriendlyDate(entry.createdAt)}
                  </time>
                </div>

                <p className="activity-log__summary">{describeAccountActivityEntry(entry)}</p>

                <div className="activity-log__details">
                  <div className="activity-log__detail">
                    <UserRound size={14} aria-hidden="true" />
                    <span title={entry.actorId || "System"}>{entry.actorId || "System"}</span>
                  </div>
                  <div className="activity-log__detail">
                    <Clock3 size={14} aria-hidden="true" />
                    <span>{entry.actorRole || "user"}</span>
                  </div>
                  {entry.entityType && (
                    <div className="activity-log__detail activity-log__entity">
                      <span>Entity: <strong>{entry.entityType}</strong> · {entry.entityId || "n/a"}</span>
                    </div>
                  )}
                </div>

                {entry.details && Object.keys(entry.details).length > 0 && (
                  <details className="activity-log__disclosure">
                    <summary>
                      <ChevronDown size={14} aria-hidden="true" />
                      View details
                    </summary>
                    <pre className="activity-log__payload">{JSON.stringify(entry.details, null, 2)}</pre>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
        {!loading && filteredEntries.length > PAGE_SIZE && (
          <nav className="admin-pagination" aria-label="Activity log pages">
            <p>Showing {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, filteredEntries.length)} of {filteredEntries.length} events</p>
            <div>
              <button type="button" className="admin-pagination__button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 0} aria-label="Previous page" title="Previous page"><ChevronLeft size={16} aria-hidden="true" /></button>
              <span>Page {currentPage + 1} of {pageCount}</span>
              <button type="button" className="admin-pagination__button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= pageCount - 1} aria-label="Next page" title="Next page"><ChevronRight size={16} aria-hidden="true" /></button>
            </div>
          </nav>
        )}
      </section>
    </div>
  );
}

function formatFriendlyDate(value) {
  if (!value) return "Unknown time";

  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";

  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatIsoDate(value) {
  if (!value) return "";

  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString();
}
