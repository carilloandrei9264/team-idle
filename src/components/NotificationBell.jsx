import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { db } from "../firebase";
import { ADMIN_NOTIFICATION_RECIPIENT, sortNotifications } from "../lib/notifications";

export default function NotificationBell({ className = "" }) {
  const { user, profile } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return undefined;
    const notificationMap = new Map();
    const recipients = [user.uid];
    if (profile?.role === "admin") recipients.push(ADMIN_NOTIFICATION_RECIPIENT);
    const unsubscribe = recipients.map((recipientId) => onSnapshot(
      query(collection(db, "notifications"), where("recipientId", "==", recipientId)),
      (snapshot) => {
        snapshot.docs.forEach((item) => notificationMap.set(item.id, { id: item.id, ...item.data() }));
        setUnreadCount(sortNotifications([...notificationMap.values()]).filter((item) => item.read !== true).length);
      },
      () => setUnreadCount(0)
    ));
    return () => unsubscribe.forEach((stop) => stop());
  }, [profile?.role, user]);

  return (
    <Link to="/notifications" className={`notification-bell ${className}`} aria-label={unreadCount ? `${unreadCount} unread notifications` : "Notifications"} title="Notifications">
      <Bell size={18} aria-hidden="true" />
      {unreadCount > 0 && <span className="notification-bell__count">{unreadCount > 99 ? "99+" : unreadCount}</span>}
    </Link>
  );
}
