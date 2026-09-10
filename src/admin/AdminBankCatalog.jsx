import { useEffect, useState } from "react";
import { addDoc, collection, onSnapshot, serverTimestamp } from "firebase/firestore";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { db } from "../firebase";
import { useAuth } from "../context/useAuth";
import "./AdminData.css";

const DEFAULT_BANKS = ["BDO", "Landbank", "Metrobank"];

export default function AdminBankCatalog() {
  const { user } = useAuth();
  const [properties, setProperties] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribeBanks = onSnapshot(
      collection(db, "bankProperties"),
      (snapshot) => {
        setProperties(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        setLoading(false);
      },
      () => {
        setLoading(false);
        setError("We could not load the bank catalog. Check your connection and permissions.");
      }
    );
    const unsubscribeLogs = onSnapshot(
      collection(db, "scraperJobs"),
      (snapshot) => {
        setLogs(
          snapshot.docs
            .map((item) => ({ id: item.id, ...item.data() }))
            .sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt))
            .slice(0, 5)
        );
      }
    );
    return () => {
      unsubscribeBanks();
      unsubscribeLogs();
    };
  }, []);

  async function queueScraper() {
    setRunning(true);
    setMessage("");
    setError("");
    try {
      await addDoc(collection(db, "scraperJobs"), {
        requestedBy: user?.uid ?? null,
        banks: DEFAULT_BANKS,
        status: "queued",
        createdAt: serverTimestamp(),
      });
      setMessage("Scraper run queued. The worker will update the catalog when it completes.");
    } catch {
      setError("The scraper run could not be queued. Check your connection and permissions.");
    } finally {
      setRunning(false);
    }
  }

  const displayedBanks = DEFAULT_BANKS.map((name) => {
    const bankProperties = properties.filter((property) => property.bank === name && String(property.status || "active").toLowerCase() === "active");
    const latest = bankProperties.reduce((current, property) => timestampValue(property.lastSeen) > timestampValue(current) ? property.lastSeen : current, null);
    return { id: name, name, listingCount: bankProperties.length, lastRunAt: latest };
  });

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h1 className="admin-page__title">Bank Catalog Status</h1>
          <p className="admin-page__description">Monitor verified listings collected from supported bank sources.</p>
        </div>
        <button type="button" className="btn btn--primary" onClick={queueScraper} disabled={running}>
          <RefreshCw size={16} aria-hidden="true" /> {running ? "Queueing..." : "Run Scraper Now"}
        </button>
      </header>
      {error && <p className="admin-page__error" role="alert">{error}</p>}
      {message && <p className="admin-page__success" role="status">{message}</p>}
      {loading ? (
        <div className="admin-data-card admin-empty">Loading bank catalog...</div>
      ) : (
        <>
          <div className="admin-bank-grid">
            {displayedBanks.map((bank) => (
              <article className="admin-bank-card" key={bank.id}>
                <h2 className="admin-bank-card__name">{bank.name || bank.bankName || bank.id}</h2>
                <span className="badge badge--verified"><CheckCircle2 size={12} aria-hidden="true" /> OK</span>
                <strong className="admin-bank-card__count">{bank.listingCount ?? bank.count ?? 0}</strong>
                <span className="admin-bank-card__meta">listings tracked</span>
                <p className="admin-bank-card__meta">Last run: {formatDate(bank.lastRunAt || bank.updatedAt)}</p>
              </article>
            ))}
          </div>
          <section className="admin-data-card" aria-labelledby="scrape-log-title">
            <div className="admin-data-card__toolbar"><h2 className="admin-side-list__title" id="scrape-log-title">Recent scrape log</h2></div>
            {logs.length === 0 ? (
              <div className="admin-empty">No scraper runs have been queued yet.</div>
            ) : (
              <ul className="admin-log">
                {logs.map((log) => <li key={log.id}>{formatDate(log.createdAt)} - {log.status} for {(log.banks || DEFAULT_BANKS).join(", ")}</li>)}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function timestampValue(value) {
  return value?.toMillis?.() ?? 0;
}

function formatDate(value) {
  const milliseconds = value?.toMillis?.();
  return milliseconds ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(milliseconds) : "Not run yet";
}
