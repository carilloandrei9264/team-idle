import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { CheckCheck, Bell } from "lucide-react";
import { Navigate } from "react-router-dom";
import PublicNav from "../components/PublicNav";
import NotificationBell from "../components/NotificationBell";
import { useAuth } from "../context/useAuth";
import { db } from "../firebase";
import { sortNotifications } from "../lib/notifications";
import "./Notifications.css";

export default function Notifications() {
  const { profile, loading } = useAuth();

  if (loading) return <main className="user-page__empty">Loading notifications...</main>;
  if (profile?.role === "admin") return <Navigate to="/admin/notifications" replace />;

  return <UserNotifications />;
}

function UserNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    return onSnapshot(
      query(collection(db, "notifications"), where("recipientId", "==", user.uid)),
      (snapshot) => {
        setNotifications(sortNotifications(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))));
        setLoading(false);
      },
      () => { setError("Notifications could not be loaded."); setLoading(false); }
    );
  }, [user.uid]);

  async function markRead(notification) {
    if (notification.read) return;
    try {
      await updateDoc(doc(db, "notifications", notification.id), { read: true });
    } catch {
      setError("This notification could not be marked as read.");
    }
  }

  async function markAllRead() {
    await Promise.all(notifications.filter((item) => !item.read).map((item) => markRead(item)));
  }

  const unreadCount = notifications.filter((item) => !item.read).length;
  return <div className="user-page"><PublicNav /><main className="user-page__content notifications-page"><header className="user-page__header"><div><p className="user-page__eyebrow">Activity center</p><h1>Notifications</h1><p>Stay updated on listings, bookings, and dispute decisions.</p></div><NotificationBell /></header>{error && <p className="user-page__form-error" role="alert">{error}</p>}{loading ? <p className="user-page__empty">Loading notifications...</p> : notifications.length === 0 ? <div className="user-page__empty"><Bell size={28} aria-hidden="true" /><h2>Nothing new</h2><p>Updates about your TrustHome activity will appear here.</p></div> : <><div className="notifications-page__toolbar"><span>{unreadCount ? `${unreadCount} unread` : "All caught up"}</span>{unreadCount > 0 && <button type="button" className="btn btn--secondary" onClick={markAllRead}><CheckCheck size={16} aria-hidden="true" /> Mark all read</button>}</div><div className="notifications-page__list">{notifications.map((notification) => <article className={`notification-item${notification.read ? " notification-item--read" : ""}`} key={notification.id}><div className="notification-item__icon" aria-hidden="true"><Bell size={17} /></div><div className="notification-item__content"><h2>{notification.title}</h2><p>{notification.message}</p><time>{formatNotificationDate(notification.createdAt)}</time></div>{!notification.read && <button type="button" className="btn btn--secondary" onClick={() => markRead(notification)}>Mark read</button>}</article>)}</div></>}</main></div>;
}

function formatNotificationDate(value) {
  const date = value?.toDate?.();
  return date ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date) : "Just now";
}
