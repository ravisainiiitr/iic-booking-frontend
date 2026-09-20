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
  /** User id we already decided auto-show for (show or skip). Survives user-object refreshes. */
  const autoShowHandledUserIdRef = useRef<number | null>(null);
  const autoShowTimeoutRef = useRef<number | null>(null);

  const guide = useMemo(() => {
    if (!user) return null;
    return getGuideForUser(user.user_type, user.user_type_alias);
  }, [user?.id, user?.user_type, user?.user_type_alias]);

  const markGuideViewed = useCallback(async () => {
    // Session-only acknowledgement — do not persist so the manual can open on every login.
    return;
  }, []);

  const openGuide = useCallback(
    (opts?: { force?: boolean }) => {
      if (!guide && !opts?.force) return;
      setOpen(true);
    },
    [guide]
  );

  const closeGuide = useCallback(() => setOpen(false), []);

  // Reset auto-show bookkeeping on logout so the next login can show the manual again
  useEffect(() => {
    if (isAuthenticated) return;
    autoShowHandledUserIdRef.current = null;
    if (autoShowTimeoutRef.current != null) {
      window.clearTimeout(autoShowTimeoutRef.current);
      autoShowTimeoutRef.current = null;
    }
    setOpen(false);
  }, [isAuthenticated]);

  // Every successful login → first dashboard landing: show role user manual
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    if (location.pathname !== "/dashboard") return;
    if (autoShowHandledUserIdRef.current === user.id) return;

    if (
      !shouldAutoShowUserGuide({
        userType: user.user_type,
        userTypeAlias: user.user_type_alias,
        userGuideViewed: false,
      })
    ) {
      autoShowHandledUserIdRef.current = user.id;
      return;
    }

    // Wait until guide content is available (do not mark handled yet)
    if (!guide) return;

    autoShowHandledUserIdRef.current = user.id;

    // Do not clear this timeout on later user refreshes — that was cancelling the first-login prompt
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
