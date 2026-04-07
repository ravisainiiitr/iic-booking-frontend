import { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from "react";
import { apiClient } from "@/lib/api";

interface User {
  id: number;
  email: string;
  name: string;
  user_type: number | string;
  user_type_display?: string | null;
  emp_id?: string | null;
  phone_number?: string | null;
  secondary_phone_number?: string | null;
  profile_picture?: string | null;
  department?: number;
  department_code?: string;
  department_name?: string;
  /** From department.department_type: internal IITR dept vs external (startup / institute). */
  department_type?: string | null;
  can_have_wallet?: boolean;
  supervisor?: number | null;
  uses_admin_panel?: boolean;
  uses_react_app?: boolean;
  uses_omniport_auth?: boolean;
  uses_email_auth?: boolean;
  is_active?: boolean;
  email_verified?: boolean;
  admin_approved?: boolean;
  date_of_birth?: string | null;
  branch_name?: string | null;
  degree_name?: string | null;
  designation?: string | null;
  date_joined?: string | null;
  last_login?: string | null;
  /** Set by backend from admin Auth settings (inactivity timeout is disabled; this is unused). */
  auth_inactivity_timeout_seconds?: number;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  /** Set user after OAuth/OTP login when token is already set by apiClient. Avoids refreshUser() 401 race. */
  setUserFromAuth: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const isInitialized = useRef(false);
  const isRefreshing = useRef(false);

  // Load user from localStorage on mount
  useEffect(() => {
    const loadStoredUser = () => {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
        } catch (e) {
          console.error("Failed to parse stored user:", e);
          localStorage.removeItem("user");
        }
      }
    };

    loadStoredUser();
  }, []);

  // Verify token and fetch fresh user data
  const refreshUser = useCallback(async () => {
    const token = apiClient.getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    // Prevent multiple simultaneous refresh calls
    if (isRefreshing.current) {
      return;
    }
    isRefreshing.current = true;

    try {
      const userResponse = await apiClient.getCurrentUser();
      
      if (userResponse.error || !userResponse.data) {
        // Token is invalid, clear everything
        apiClient.setToken(null);
        localStorage.removeItem("user");
        setUser(null);
        setLoading(false);
        return;
      }

      // Update user state and localStorage
      setUser(userResponse.data);
      localStorage.setItem("user", JSON.stringify(userResponse.data));
    } catch (error) {
      console.error("Error refreshing user:", error);
      // On error, clear auth state
      apiClient.setToken(null);
      localStorage.removeItem("user");
      setUser(null);
    } finally {
      isRefreshing.current = false;
      setLoading(false);
    }
  }, []);

  // Initial authentication check
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    const token = apiClient.getToken();
    if (token) {
      refreshUser();
    } else {
      setLoading(false);
    }
  }, [refreshUser]);

  // On 401 from API (session expired / invalidated), clear auth and redirect to login
  useEffect(() => {
    apiClient.onUnauthorized = () => {
      apiClient.setToken(null);
      localStorage.removeItem("user");
      setUser(null);
      if (window.location.pathname !== "/auth") {
        window.location.replace("/auth");
      }
    };
    return () => {
      apiClient.onUnauthorized = null;
    };
  }, []);

  // Periodic session check: when logged in and tab is visible, validate token so we detect
  // "logged in elsewhere" (single-session) quickly and redirect this tab to login
  const SESSION_CHECK_MS = 15 * 1000; // 15 seconds
  useEffect(() => {
    if (!user || !apiClient.getToken()) return;

    const checkSession = () => {
      if (document.visibilityState !== "visible") return;
      apiClient.getCurrentUser();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") checkSession();
    };

    const intervalId = setInterval(checkSession, SESSION_CHECK_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [user]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await apiClient.signIn(email, password);

      if (response.error) {
        return { success: false, error: response.error };
      }

      if (response.data?.token && response.data?.user) {
        // Set token in apiClient
        apiClient.setToken(response.data.token);
        // Set user data
        setUser(response.data.user);
        localStorage.setItem("user", JSON.stringify(response.data.user));
        return { success: true };
      }

      return { success: false, error: "No token received" };
    } catch (error: any) {
      return { success: false, error: error.message || "Login failed" };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.signOut();
    } catch (error) {
      console.error("Error during logout:", error);
    } finally {
      // Clear local state regardless of API response
      apiClient.setToken(null);
      localStorage.removeItem("user");
      setUser(null);
    }
  }, []);

  const updateUser = useCallback((userData: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...userData };
      localStorage.setItem("user", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const setUserFromAuth = useCallback((userData: User) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
  }, []);

  const isAuthenticated = !!user && !!apiClient.getToken();

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated,
        login,
        logout,
        refreshUser,
        updateUser,
        setUserFromAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
