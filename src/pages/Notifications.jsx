import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
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

  async function clearNotification(notification) {
    try {
      await deleteDoc(doc(db, "notifications", notification.id));
    } catch {
      setError("This notification could not be cleared.");
    }
  }

  async function clearReadNotifications() {
    try {
      await Promise.all(notifications.filter((item) => item.read).map((item) => deleteDoc(doc(db, "notifications", item.id))));
    } catch {
      setError("Some read notifications could not be cleared.");
    }
  }

  const unreadCount = notifications.filter((item) => !item.read).length;
  return <div className="user-page"><PublicNav /><main className="user-page__content notifications-page"><header className="user-page__header"><div><p className="user-page__eyebrow">Activity center</p><h1>Notifications</h1><p>Stay updated on listings, bookings, and dispute decisions.</p></div><NotificationBell /></header>{error && <p className="user-page__form-error" role="alert">{error}</p>}{loading ? <p className="user-page__empty">Loading notifications...</p> : notifications.length === 0 ? <div className="user-page__empty"><Bell size={28} aria-hidden="true" /><h2>Nothing new</h2><p>Updates about your TrustHome activity will appear here.</p></div> : <><div className="notifications-page__toolbar"><span>{unreadCount ? `${unreadCount} unread` : "All caught up"}</span><div className="notifications-page__toolbar-actions">{unreadCount > 0 && <button type="button" className="btn btn--secondary" onClick={markAllRead}><CheckCheck size={16} aria-hidden="true" /> Mark all read</button>}{notifications.some((item) => item.read) && <button type="button" className="btn btn--secondary" onClick={clearReadNotifications}><Trash2 size={16} aria-hidden="true" /> Clear read</button>}</div></div><div className="notifications-page__list">{notifications.map((notification) => <article className={`notification-item${notification.read ? " notification-item--read" : ""}`} key={notification.id}><div className="notification-item__icon" aria-hidden="true"><Bell size={17} /></div>{notification.link ? <Link className="notification-item__content notification-item__link" to={notification.link} onClick={() => markRead(notification)}><h2>{notification.title}</h2><p>{notification.message}</p><time>{formatNotificationDate(notification.createdAt)}</time></Link> : <div className="notification-item__content"><h2>{notification.title}</h2><p>{notification.message}</p><time>{formatNotificationDate(notification.createdAt)}</time></div>}<div className="notification-item__actions">{!notification.read && <button type="button" className="notification-item__action" onClick={() => markRead(notification)} aria-label={`Mark ${notification.title} as read`} title="Mark read"><Check size={17} aria-hidden="true" /></button>}<button type="button" className="notification-item__action" onClick={() => clearNotification(notification)} aria-label={`Clear ${notification.title}`} title="Clear notification"><Trash2 size={17} aria-hidden="true" /></button></div></article>)}</div></>}</main></div>;
}

function formatNotificationDate(value) {
  const date = value?.toDate?.();
  return date ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date) : "Just now";
}
