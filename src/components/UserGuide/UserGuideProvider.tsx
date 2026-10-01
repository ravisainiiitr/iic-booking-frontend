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
import { resolveGuideAudienceForUser, shouldAutoShowUserGuide, type GuideUserLike } from "@/guides/resolveAudience";
import type { GuideAudienceId, UserGuideContent } from "@/guides/types";
import UserGuideDialog from "@/components/UserGuide/UserGuideDialog";
import { loadGuideFlags } from "@/components/UserGuide/guideFlags";
import { formatUserDisplayName } from "@/lib/displayName";
import {
  hasUserGuideAutoShownThisLogin,
  markUserGuideAutoShownThisLogin,
} from "@/components/UserGuide/userGuideSession";

interface UserGuideContextValue {
  openGuide: (opts?: { force?: boolean }) => void;
  closeGuide: () => void;
  isOpen: boolean;
  /** Built for the signed-in user on demand; null until requested and loaded, or when there is no guide. */
  guide: UserGuideContent | null;
  /** True when the signed-in user's role has a guide, even before its content has loaded. */
  hasGuide: boolean;
  /** Start loading the guide without opening the dialog (e.g. the full-page view). */
  requestGuide: () => void;
  markGuideViewed: () => Promise<void>;
}

const UserGuideContext = createContext<UserGuideContextValue | undefined>(undefined);

type GuideUser = GuideUserLike & {
  oic_enable_leave_management?: boolean | null;
  oic_enable_ta_nomination?: boolean | null;
};

export function UserGuideProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [wanted, setWanted] = useState(false);
  /** In-memory mirror — survives user-object refreshes within this mount. */
  const autoShowHandledUserIdRef = useRef<number | null>(null);
  const autoShowTimeoutRef = useRef<number | null>(null);

  const guideUser = user as unknown as GuideUser | null;
  const audience = useMemo<GuideAudienceId | null>(
    () => resolveGuideAudienceForUser(guideUser),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id, user?.user_type, user?.user_type_alias, guideUser?.user_type_display, guideUser?.is_faculty]
  );

  const [loaded, setLoaded] = useState<{ userId: number | undefined; guide: UserGuideContent } | null>(null);
  useEffect(() => {
    if (!audience || !wanted) return;
    let cancelled = false;
    void Promise.all([import("@/guides"), loadGuideFlags(audience, guideUser)])
      .then(([m, flags]) => {
        if (!cancelled) setLoaded({ userId: user?.id, guide: m.buildGuide({ audience, flags }) });
      })
      .catch(() => {
        /* chunk load failure: the guide stays unavailable until the next page load */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience, wanted, user?.id]);
  const guide = audience && loaded?.userId === user?.id && loaded?.guide.audience === audience ? loaded.guide : null;
  const hasGuide = audience != null;

  const requestGuide = useCallback(() => setWanted(true), []);

  const markGuideViewed = useCallback(async () => {
    if (user?.id != null) {
      markUserGuideAutoShownThisLogin(user.id);
      autoShowHandledUserIdRef.current = user.id;
    }
  }, [user?.id]);

  const openGuide = useCallback(
    (opts?: { force?: boolean }) => {
      if (!hasGuide && !opts?.force) return;
      setWanted(true);
      setOpen(true);
    },
    [hasGuide]
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
    setWanted(false);
    setLoaded(null);
  }, [isAuthenticated]);

  // First /dashboard visit after this login only (sessionStorage survives remounts / auth flicker).
  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    if (location.pathname !== "/dashboard") return;

    if (autoShowHandledUserIdRef.current === user.id || hasUserGuideAutoShownThisLogin(user.id)) {
      autoShowHandledUserIdRef.current = user.id;
      return;
    }

    if (!shouldAutoShowUserGuide({ user: guideUser, userGuideViewed: user.user_guide_viewed })) {
      autoShowHandledUserIdRef.current = user.id;
      markUserGuideAutoShownThisLogin(user.id);
      return;
    }

    if (!guide) {
      setWanted(true);
      return;
    }

    autoShowHandledUserIdRef.current = user.id;
    markUserGuideAutoShownThisLogin(user.id);

    if (autoShowTimeoutRef.current != null) {
      window.clearTimeout(autoShowTimeoutRef.current);
    }
    autoShowTimeoutRef.current = window.setTimeout(() => {
      autoShowTimeoutRef.current = null;
      setOpen(true);
    }, 900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id, audience, user?.user_guide_viewed, location.pathname, guide]);

  const value = useMemo(
    () => ({
      openGuide,
      closeGuide,
      isOpen: open,
      guide,
      hasGuide,
      requestGuide,
      markGuideViewed,
    }),
    [openGuide, closeGuide, open, guide, hasGuide, requestGuide, markGuideViewed]
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
        loading={hasGuide && !guide}
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
