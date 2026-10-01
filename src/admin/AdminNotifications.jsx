import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { Bell, CheckCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { db } from "../firebase";
import {
  ADMIN_NOTIFICATION_RECIPIENT,
  ADMIN_NOTIFICATION_TYPES,
  isAdminInboxNotification,
  sortNotifications,
} from "../lib/notifications";
import "../pages/Notifications.css";

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => onSnapshot(
    query(
      collection(db, "notifications"),
      where("recipientId", "==", ADMIN_NOTIFICATION_RECIPIENT),
      where("type", "in", ADMIN_NOTIFICATION_TYPES)
    ),
    (snapshot) => {
      setNotifications(sortNotifications(snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .filter(isAdminInboxNotification)));
      setLoading(false);
    },
    () => { setError("Admin notifications could not be loaded."); setLoading(false); }
  ), []);

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
  return <section className="admin-page notifications-page">
    <header className="admin-page__header notifications-page__header">
      <div><h1 className="admin-page__title">Admin notifications</h1><p className="admin-page__description">New listing submissions and disputes requiring review.</p></div>
    </header>
    {error && <p className="admin-page__error" role="alert">{error}</p>}
    {loading ? <div className="admin-data-card admin-empty">Loading admin notifications...</div> : notifications.length === 0 ? (
      <div className="admin-data-card admin-empty"><Bell size={26} aria-hidden="true" /><h2>No admin notifications</h2><p>New listing submissions and disputes will appear here.</p></div>
    ) : <>
      <div className="notifications-page__toolbar"><span>{unreadCount ? `${unreadCount} unread` : "All caught up"}</span>{unreadCount > 0 && <button type="button" className="btn btn--secondary" onClick={markAllRead}><CheckCheck size={16} aria-hidden="true" /> Mark all read</button>}</div>
      <div className="notifications-page__list">{notifications.map((notification) => <article className={`notification-item${notification.read ? " notification-item--read" : ""}`} key={notification.id}>
        <div className="notification-item__icon" aria-hidden="true"><Bell size={17} /></div>
        {notification.link ? (
          <Link className="notification-item__content notification-item__link" to={notification.link} onClick={() => markRead(notification)}>
            <h2>{notification.title}</h2><p>{notification.message}</p><time>{formatNotificationDate(notification.createdAt)}</time>
          </Link>
        ) : (
          <div className="notification-item__content"><h2>{notification.title}</h2><p>{notification.message}</p><time>{formatNotificationDate(notification.createdAt)}</time></div>
        )}
        {!notification.read && <button type="button" className="btn btn--secondary" onClick={() => markRead(notification)}>Mark read</button>}
      </article>)}</div>
    </>}
  </section>;
}

function formatNotificationDate(value) {
  const date = value?.toDate?.();
  return date ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date) : "Just now";
}
