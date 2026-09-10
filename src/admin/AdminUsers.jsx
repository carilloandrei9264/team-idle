import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { Search } from "lucide-react";
import { db } from "../firebase";
import "./AdminData.css";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    return onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        setUsers(
          snapshot.docs
            .map((item) => ({ id: item.id, ...item.data() }))
            .sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt))
        );
        setLoading(false);
        setError("");
      },
      () => {
        setLoading(false);
        setError("We could not load users. Check your connection and permissions.");
      }
    );
  }, []);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) => [user.name, user.email, user.role, user.status].some((value) => String(value || "").toLowerCase().includes(term)));
  }, [search, users]);

  async function toggleStatus(user) {
    const nextStatus = String(user.status || "active").toLowerCase() === "suspended" ? "active" : "suspended";
    try {
      await updateDoc(doc(db, "users", user.id), { status: nextStatus });
    } catch {
      setError("The user status could not be updated. Please try again.");
    }
  }

  return (
    <div className="admin-page">
      <header className="admin-page__header">
        <div>
          <h1 className="admin-page__title">User Management</h1>
          <p className="admin-page__description">Review account status and manage access to TrustHome.</p>
        </div>
      </header>
      {error && <p className="admin-page__error" role="alert">{error}</p>}
      <section className="admin-data-card">
        <div className="admin-data-card__toolbar">
          <label className="admin-search-wrap" htmlFor="user-search">
            <span className="sr-only">Search users</span>
            <Search size={16} aria-hidden="true" />
            <input id="user-search" className="admin-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email..." />
          </label>
          <span className="admin-table__muted">{filteredUsers.length} users</span>
        </div>
        {loading ? (
          <div className="admin-empty">Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="admin-empty">No users match this search.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Name</th><th>Role</th><th>Status</th><th>Joined</th><th>Action</th></tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const suspended = String(user.status || "active").toLowerCase() === "suspended";
                  return (
                    <tr key={user.id}>
                      <td><strong>{user.name || "Unnamed user"}</strong><br /><span className="admin-table__muted">{user.email || "No email"}</span></td>
                      <td>{capitalize(user.role || "user")}</td>
                      <td><span className={`badge ${suspended ? "badge--danger" : "badge--verified"}`}>{suspended ? "SUSPENDED" : "ACTIVE"}</span></td>
                      <td className="admin-table__muted">{formatDate(user.createdAt)}</td>
                      <td><button type="button" className="admin-table__action" onClick={() => toggleStatus(user)}>{suspended ? "Reactivate" : "Suspend"}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function timestampValue(value) {
  return value?.toMillis?.() ?? 0;
}

function formatDate(value) {
  const milliseconds = value?.toMillis?.();
  return milliseconds ? new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric" }).format(milliseconds) : "-";
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
