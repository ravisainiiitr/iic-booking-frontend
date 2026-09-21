import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getGuideForUser, shouldAutoShowUserGuide } from "@/guides";
import type { UserGuideContent } from "@/guides";
import UserGuideDialog from "@/components/UserGuide/UserGuideDialog";
import { formatUserDisplayName } from "@/lib/displayName";
import {
  hasUserGuideAutoShownThisLogin,
  markUserGuideAutoShownThisLogin,
} from "@/components/UserGuide/userGuideSession";

interface UserGuideContextValue {
  openGuide: (opts?: { force?: boolean }) => void;
  closeGuide: () => void;
  isOpen: boolean;
  guide: UserGuideContent | null;
  markGuideViewed: () => Promise<void>;
}

const UserGuideContext = createContext<UserGuideContextValue | undefined>(undefined);

export function UserGuideProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  /** In-memory mirror — survives user-object refreshes within this mount. */
  const autoShowHandledUserIdRef = useRef<number | null>(null);
  const autoShowTimeoutRef = useRef<number | null>(null);

  const guide = useMemo(() => {
    if (!user) return null;
    return getGuideForUser(user.user_type, user.user_type_alias);
  }, [user?.id, user?.user_type, user?.user_type_alias]);

  const markGuideViewed = useCallback(async () => {
    if (user?.id != null) {
      markUserGuideAutoShownThisLogin(user.id);
      autoShowHandledUserIdRef.current = user.id;
    }
  }, [user?.id]);

  const openGuide = useCallback(
    (opts?: { force?: boolean }) => {
      if (!guide && !opts?.force) return;
      setOpen(true);
    },
    [guide]
  );

  const closeGuide = useCallback(() => setOpen(false), []);

  // Close dialog UI on logout; session flag is cleared in AuthContext.logout.
  useEffect(() => {
    if (isAuthenticated) return;
    autoShowHandledUserIdRef.current = null;
    if (autoShowTimeoutRef.current != null) {
      window.clearTimeout(autoShowTimeoutRef.current);
      autoShowTimeoutRef.current = null;
    }
    setOpen(false);
  }, [isAuthenticated]);

  // First /dashboard visit after this login only (sessionStorage survives remounts / auth flicker).
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    if (location.pathname !== "/dashboard") return;

    if (
      autoShowHandledUserIdRef.current === user.id ||
      hasUserGuideAutoShownThisLogin(user.id)
    ) {
      autoShowHandledUserIdRef.current = user.id;
      return;
    }

    if (
      !shouldAutoShowUserGuide({
        userType: user.user_type,
        userTypeAlias: user.user_type_alias,
        userGuideViewed: user.user_guide_viewed,
      })
    ) {
      autoShowHandledUserIdRef.current = user.id;
      markUserGuideAutoShownThisLogin(user.id);
      return;
    }

    if (!guide) return;

    autoShowHandledUserIdRef.current = user.id;
    markUserGuideAutoShownThisLogin(user.id);

    if (autoShowTimeoutRef.current != null) {
      window.clearTimeout(autoShowTimeoutRef.current);
    }
    autoShowTimeoutRef.current = window.setTimeout(() => {
      autoShowTimeoutRef.current = null;
      setOpen(true);
    }, 900);
  }, [
    isAuthenticated,
    user?.id,
    user?.user_type,
    user?.user_type_alias,
    user?.user_guide_viewed,
    location.pathname,
    guide,
  ]);

  const value = useMemo(
    () => ({
      openGuide,
      closeGuide,
      isOpen: open,
      guide,
      markGuideViewed,
    }),
    [openGuide, closeGuide, open, guide, markGuideViewed]
  );

  return (
    <UserGuideContext.Provider value={value}>
      {children}
      <UserGuideDialog
        open={open}
        onOpenChange={(next) => {
          if (!next && open) {
            void markGuideViewed();
          }
          setOpen(next);
        }}
        guide={guide}
        userName={formatUserDisplayName(user)}
      />
    </UserGuideContext.Provider>
  );
}

export function useUserGuide() {
  const ctx = useContext(UserGuideContext);
  if (!ctx) {
    throw new Error("useUserGuide must be used within a UserGuideProvider");
  }
  return ctx;
}
