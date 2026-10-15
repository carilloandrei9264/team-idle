import { useEffect, useMemo, useState } from "react";
import { collection, deleteField, doc, getDocs, onSnapshot, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { ChevronLeft, ChevronRight, Search, Sparkles } from "lucide-react";
import { db } from "../firebase";
import { useAuth } from "../context/useAuth";
import { ACCOUNT_ACTIVITY_ACTIONS, createAccountActivity } from "../lib/accountActivity";
import MembershipPreviewDialog from "../components/MembershipPreviewDialog";
import ConfirmDialog from "../components/ConfirmDialog";
import "./AdminData.css";

const PAGE_SIZE = 20;

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewUser, setPreviewUser] = useState(null);
  const [suspendTarget, setSuspendTarget] = useState(null);

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
  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageUsers = filteredUsers.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  async function toggleStatus(user, confirmed = false) {
    const nextStatus = String(user.status || "active").toLowerCase() === "suspended" ? "active" : "suspended";
    if (nextStatus === "suspended" && !confirmed) {
      setSuspendTarget(user);
      return;
    }
    try {
      const listings = await getDocs(query(collection(db, "listings"), where("ownerId", "==", user.id)));
      const batch = writeBatch(db);
      batch.update(doc(db, "users", user.id), { status: nextStatus });
      listings.docs.forEach((listingSnapshot) => {
        const listing = listingSnapshot.data();
        if (nextStatus === "suspended" && listing.verificationStatus === "verified") {
          batch.update(listingSnapshot.ref, {
            verificationStatus: "suspended",
            ownerSuspensionApplied: true,
            previousVerificationStatus: "verified",
            ownerSuspendedAt: serverTimestamp(),
          });
        } else if (nextStatus === "active" && listing.ownerSuspensionApplied === true) {
          batch.update(listingSnapshot.ref, {
            verificationStatus: listing.previousVerificationStatus || "verified",
            ownerSuspensionApplied: deleteField(),
            previousVerificationStatus: deleteField(),
            ownerSuspendedAt: deleteField(),
          });
        }
      });
      await batch.commit();
      try {
        await createAccountActivity(db, {
          actorId: currentUser.uid,
          actorRole: "admin",
          targetUserId: user.id,
          entityType: "user",
          entityId: user.id,
          action: nextStatus === "suspended"
            ? ACCOUNT_ACTIVITY_ACTIONS.USER_SUSPENDED
            : ACCOUNT_ACTIVITY_ACTIONS.USER_REACTIVATED,
          summary: nextStatus === "suspended" ? "User suspended" : "User reactivated",
          details: { status: nextStatus },
        });
      } catch {
        // Activity logging is non-blocking for user status changes.
      }
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
      {suspendTarget && <ConfirmDialog
        title={suspendTarget.role === "admin" ? "Suspend administrator?" : "Suspend user?"}
        message={suspendTarget.role === "admin"
          ? `${suspendTarget.name || "This administrator"} will lose admin access immediately.`
          : `${suspendTarget.name || "This user"} will lose access to TrustHome.`}
        confirmLabel="Suspend user"
        danger
        onCancel={() => setSuspendTarget(null)}
        onConfirm={() => {
          const target = suspendTarget;
          setSuspendTarget(null);
          void toggleStatus(target, true);
        }}
      />}
      <section className="admin-data-card">
        <div className="admin-data-card__toolbar">
          <label className="admin-search-wrap" htmlFor="user-search">
            <span className="sr-only">Search users</span>
            <Search size={16} aria-hidden="true" />
            <input id="user-search" className="admin-search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder="Search name or email..." />
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
                <tr><th>Name</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {pageUsers.map((user) => {
                  const suspended = String(user.status || "active").toLowerCase() === "suspended";
                  return (
                    <tr key={user.id}>
                      <td><strong>{user.name || "Unnamed user"}</strong><br /><span className="admin-table__muted">{user.email || "No email"}</span></td>
                      <td>{capitalize(user.role || "user")}</td>
                      <td><span className={`badge ${suspended ? "badge--danger" : "badge--verified"}`}>{suspended ? "SUSPENDED" : "ACTIVE"}</span></td>
                      <td className="admin-table__muted">{formatDate(user.createdAt)}</td>
                      <td className="admin-users__actions">
                        <button type="button" className="admin-table__action" onClick={() => setPreviewUser(user)}>
                          <Sparkles size={14} aria-hidden="true" /> Preview plan
                        </button>
                        {user.id === currentUser?.uid
                          ? <span className="admin-table__muted">Current account</span>
                          : <button type="button" className="admin-table__action admin-table__action--status" onClick={() => toggleStatus(user)}>{suspended ? "Reactivate" : "Suspend"}</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filteredUsers.length > PAGE_SIZE && (
          <nav className="admin-pagination" aria-label="User pages">
            <p>Showing {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length} users</p>
            <div>
              <button type="button" className="admin-pagination__button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 0} aria-label="Previous page" title="Previous page"><ChevronLeft size={16} aria-hidden="true" /></button>
              <span>Page {currentPage + 1} of {pageCount}</span>
              <button type="button" className="admin-pagination__button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= pageCount - 1} aria-label="Next page" title="Next page"><ChevronRight size={16} aria-hidden="true" /></button>
            </div>
          </nav>
        )}
      </section>
      {previewUser && <MembershipPreviewDialog previewUser={previewUser} onClose={() => setPreviewUser(null)} />}
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
