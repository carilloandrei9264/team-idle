import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { db } from "../firebase";
import { notificationInboxPath, notificationRecipientForRole, ADMIN_NOTIFICATION_TYPES } from "../lib/notifications";

export default function NotificationBell({ className = "" }) {
  const { user, profile, loading } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const userId = user?.uid;

  useEffect(() => {
    if (loading || !userId) return undefined;
    const recipientId = notificationRecipientForRole(profile?.role, userId);
    if (!recipientId) return undefined;
    const filters = [where("recipientId", "==", recipientId)];
    if (profile?.role === "admin") filters.push(where("type", "in", ADMIN_NOTIFICATION_TYPES));
    return onSnapshot(
      query(collection(db, "notifications"), ...filters),
      (snapshot) => setUnreadCount(snapshot.docs.filter((item) => item.data().read !== true).length),
      () => setUnreadCount(0)
    );
  }, [loading, profile?.role, userId]);

  return (
    <Link to={notificationInboxPath(profile?.role)} className={`notification-bell ${className}`} aria-label={unreadCount ? `${unreadCount} unread notifications` : "Notifications"} title="Notifications">
      <Bell size={18} aria-hidden="true" />
      {unreadCount > 0 && <span className="notification-bell__count">{unreadCount > 99 ? "99+" : unreadCount}</span>}
    </Link>
  );
}
