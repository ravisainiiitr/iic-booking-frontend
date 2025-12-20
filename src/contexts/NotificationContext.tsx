import { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from "react";
import { apiClient } from "@/lib/api";

export interface Notification {
  id: string | number;
  title: string;
  message: string;
  type: "booking" | "system" | "warning" | "info";
  read: boolean;
  createdAt: string;
  link?: string;
  isFromAPI?: boolean; // Track if notification comes from API
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  addNotification: (notification: Omit<Notification, "id" | "read" | "createdAt">) => void;
  markAsRead: (id: string | number) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string | number) => void;
  clearAll: () => void;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const hasInitialized = useRef(false);
  const isFetching = useRef(false);

  // Memoize refreshNotifications to prevent infinite loops
  const refreshNotifications = useCallback(async () => {
    // Disabled: Notifications API endpoint not available yet
    // Uncomment below when API is ready
    return;
    
    /*
    const token = apiClient.getToken();
    if (!token || isFetching.current) return;

    isFetching.current = true;
    setLoading(true);
    try {
      const response = await apiClient.getNotifications();
      if (response.data) {
        // Transform API notifications to match our format
        const apiNotifications: Notification[] = response.data.map((n) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          type: n.type,
          read: n.read,
          createdAt: n.created_at,
          link: n.link,
          isFromAPI: true,
        }));

        // Merge with local notifications (keep local ones that aren't from API)
        setNotifications((prev) => {
          const localOnly = prev.filter((n) => !n.isFromAPI);
          return [...apiNotifications, ...localOnly];
        });
      } else if (response.error) {
        // If API endpoint doesn't exist or returns error, just log it
        // Don't cause page refresh or throw errors
        console.log("Notifications API not available:", response.error);
      }
    } catch (error) {
      // Silently handle errors - don't break the app if notifications fail
      console.log("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
    */
  }, []);

  // Fetch notifications from API on mount and when token changes
  useEffect(() => {
    // Only initialize once
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Load from localStorage (API notifications disabled)
    const stored = localStorage.getItem("notifications");
    if (stored) {
      try {
        const localNotifications = JSON.parse(stored);
        setNotifications(localNotifications.filter((n: Notification) => !n.isFromAPI));
      } catch {
        setNotifications([]);
      }
    }

    // Disabled: Notifications API endpoint not available yet
    // Uncomment below when API is ready
    /*
    const initTimer = setTimeout(() => {
      // Check if we're on auth page - don't fetch notifications there
      if (window.location.pathname === '/auth' || window.location.pathname === '/auth/callback') {
        return;
      }

      const token = apiClient.getToken();
      if (token) {
        refreshNotifications();
      } else {
        // Load from localStorage if not authenticated
        const stored = localStorage.getItem("notifications");
        if (stored) {
          try {
            const localNotifications = JSON.parse(stored);
            setNotifications(localNotifications.filter((n: Notification) => !n.isFromAPI));
          } catch {
            setNotifications([]);
          }
        }
      }
    }, 500);

    return () => clearTimeout(initTimer);
    */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save local notifications to localStorage (exclude API notifications)
  useEffect(() => {
    const localNotifications = notifications.filter((n) => !n.isFromAPI);
    if (localNotifications.length > 0) {
      localStorage.setItem("notifications", JSON.stringify(localNotifications));
    } else {
      localStorage.removeItem("notifications");
    }
  }, [notifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const addNotification = (notification: Omit<Notification, "id" | "read" | "createdAt">) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      read: false,
      createdAt: new Date().toISOString(),
      isFromAPI: false,
    };
    setNotifications((prev) => [newNotification, ...prev]);
  };

  const markAsRead = useCallback(async (id: string | number) => {
    // Optimistically update UI
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );

    // Sync with API if it's an API notification
    const notification = notifications.find((n) => n.id === id);
    if (notification?.isFromAPI && typeof id === "number") {
      try {
        await apiClient.markNotificationAsRead(id);
      } catch (error) {
        console.log("Failed to mark notification as read:", error);
        // Revert on error
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: false } : n))
        );
      }
    }
  }, [notifications]);

  const markAllAsRead = useCallback(async () => {
    // Optimistically update UI
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    // Sync with API
    const token = apiClient.getToken();
    if (token) {
      try {
        await apiClient.markAllNotificationsAsRead();
      } catch (error) {
        console.log("Failed to mark all notifications as read:", error);
        // Don't refresh on error to avoid loops
      }
    }
  }, []);

  const removeNotification = useCallback(async (id: string | number) => {
    // Remove from UI
    setNotifications((prev) => prev.filter((n) => n.id !== id));

    // Delete from API if it's an API notification
    const notification = notifications.find((n) => n.id === id);
    if (notification?.isFromAPI && typeof id === "number") {
      try {
        await apiClient.deleteNotification(id);
      } catch (error) {
        console.log("Failed to delete notification:", error);
        // Don't refresh on error to avoid loops
      }
    }
  }, [notifications]);

  const clearAll = () => {
    setNotifications([]);
    localStorage.removeItem("notifications");
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        addNotification,
        markAsRead,
        markAllAsRead,
        removeNotification,
        clearAll,
        refreshNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
};

