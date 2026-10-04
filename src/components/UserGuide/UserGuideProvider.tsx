import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePeakWindow } from "@/hooks/use-peak-window";
import { resolveGuideAudienceForUser, shouldAutoShowUserGuide, type GuideUserLike } from "@/guides/resolveAudience";
import type { GuideAudienceId, UserGuideContent } from "@/guides/types";
import { loadGuideFlags } from "@/components/UserGuide/guideFlags";
import { formatPersonName } from "@/lib/displayName";
import { isPeakBlockableUserType } from "@/lib/peakWindow";
import { useStaffAppShell } from "@/lib/staffApp";
import { useProfileCompletion } from "@/components/ProfileCompletion/ProfileCompletionProvider";
import {
  hasUserGuideAutoShownThisLogin,
  markUserGuideAutoShownThisLogin,
} from "@/components/UserGuide/userGuideSession";
import { markWhatsNewSeen, unreadWhatsNewIds } from "@/components/UserGuide/whatsNewSeen";

interface UserGuideContextValue {
  /** Opens the user guide window, at `sectionId` when given. */
  openGuide: (opts?: { force?: boolean; sectionId?: string }) => void;
  closeGuide: () => void;
  isOpen: boolean;
  /** Opens "What's new for you" (also shown after each sign-in). */
  openWhatsNew: () => void;
  whatsNewOpen: boolean;
  /**
   * True from sign-in until the Complete your profile prompt and then the post-login What's New have been
   * shown and closed (or skipped), and while the guide or What's New is open. Other post-login prompts wait for it.
   */
  postLoginBusy: boolean;
  /** Built for the signed-in user on demand; null until requested and loaded, or when there is no guide. */
  guide: UserGuideContent | null;
  /** True when the signed-in user's role has a guide, even before its content has loaded. */
  hasGuide: boolean;
  /** Start loading the guide without opening the dialog (e.g. the full-page view). */
  requestGuide: () => void;
  markGuideViewed: () => Promise<void>;
}

const UserGuideContext = createContext<UserGuideContextValue | undefined>(undefined);

// Kept out of the entry bundle: only users who open the guide or What's New download the dialogs.
const UserGuideDialog = lazy(() => import("@/components/UserGuide/UserGuideDialog"));
const loadWhatsNewDialog = () => import("@/components/UserGuide/WhatsNewDialog");
const WhatsNewDialog = lazy(loadWhatsNewDialog);

/** Delay after the dashboard appears, so What's New does not flash over a page that is still loading. */
const AUTO_SHOW_DELAY_MS = 900;

type GuideUser = GuideUserLike & {
  oic_enable_leave_management?: boolean | null;
  oic_enable_ta_nomination?: boolean | null;
};

export function UserGuideProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { blocking: profilePromptDue } = useProfileCompletion();
  const location = useLocation();
  const navigate = useNavigate();
  const peak = usePeakWindow();
  const staffAppShell = useStaffAppShell();
  const [open, setOpen] = useState(false);
  const [guideStart, setGuideStart] = useState<string | null>(null);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  /** Bumped on every What's New opening; the unread snapshot is taken per opening. */
  const [whatsNewSession, setWhatsNewSession] = useState(0);
  const [wanted, setWanted] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  /** User whose post-login What's New is decided (shown or skipped) in this mount. */
  const [settledUserId, setSettledUserId] = useState<number | null>(null);
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
    void loadWhatsNewDialog().catch(() => undefined);
    void Promise.all([import("@/guides"), loadGuideFlags(audience, guideUser)])
      .then(([m, flags]) => {
        if (!cancelled) setLoaded({ userId: user?.id, guide: m.buildGuide({ audience, flags }) });
      })
      .catch(() => {
        // Chunk load failure: the guide stays unavailable until the next page load.
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience, wanted, user?.id]);
  const guide = audience && loaded?.userId === user?.id && loaded?.guide.audience === audience ? loaded.guide : null;
  const hasGuide = audience != null;

  const unreadIds = useMemo<ReadonlySet<string>>(
    () => (guide ? unreadWhatsNewIds(user?.id, guide.whatsNew.items.map((i) => i.id)) : new Set()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [whatsNewSession, guide, user?.id]
  );

  const requestGuide = useCallback(() => setWanted(true), []);

  const markGuideViewed = useCallback(async () => {
    if (user?.id != null) {
      markUserGuideAutoShownThisLogin(user.id);
      autoShowHandledUserIdRef.current = user.id;
    }
  }, [user?.id]);

  const closeWhatsNew = useCallback(() => {
    if (guide) markWhatsNewSeen(user?.id, guide.whatsNew.items.map((i) => i.id));
    void markGuideViewed();
    setWhatsNewOpen(false);
  }, [guide, user?.id, markGuideViewed]);

  const openGuide = useCallback(
    (opts?: { force?: boolean; sectionId?: string }) => {
      if (!hasGuide && !opts?.force) return;
      if (whatsNewOpen) closeWhatsNew();
      setGuideStart(opts?.sectionId ?? null);
      setWanted(true);
      setOpen(true);
    },
    [hasGuide, whatsNewOpen, closeWhatsNew]
  );

  const closeGuide = useCallback(() => setOpen(false), []);

  const openWhatsNew = useCallback(() => {
    if (!hasGuide) return;
    setOpen(false);
    setWanted(true);
    setWhatsNewSession((n) => n + 1);
    setWhatsNewOpen(true);
  }, [hasGuide]);

  const openGuideFromWhatsNew = useCallback(
    (sectionId?: string) => {
      closeWhatsNew();
      setGuideStart(sectionId ?? guide?.sections[0]?.id ?? null);
      setOpen(true);
    },
    [closeWhatsNew, guide]
  );

  const tryLink = useCallback(
    (href: string) => {
      closeWhatsNew();
      navigate(href);
    },
    [closeWhatsNew, navigate]
  );

  const settle = useCallback((userId: number) => {
    autoShowHandledUserIdRef.current = userId;
    setSettledUserId(userId);
  }, []);

  // Close dialog UI on logout; session flag is cleared in AuthContext.logout.
  useEffect(() => {
    if (isAuthenticated) return;
    autoShowHandledUserIdRef.current = null;
    if (autoShowTimeoutRef.current != null) {
      window.clearTimeout(autoShowTimeoutRef.current);
      autoShowTimeoutRef.current = null;
    }
    setOpen(false);
    setWhatsNewOpen(false);
    setSettledUserId(null);
    setWanted(false);
    setLoaded(null);
  }, [isAuthenticated]);

  useEffect(() => {
    if (loadFailed) setWhatsNewOpen(false);
  }, [loadFailed]);

  const peakPaused = peak.externalPaused && isPeakBlockableUserType(user?.user_type ?? null);

  // What's New on the first /dashboard visit after each sign-in, for every role with a guide
  // (sessionStorage survives remounts / auth flicker). Waits for the fresh profile so it never
  // opens on a stale cached user, and for the Complete your profile prompt to close first.
  // Not in the staff Android app, which opens its own Today screen.
  useEffect(() => {
    if (!isAuthenticated || !user?.id || authLoading || profilePromptDue) return;
    if (autoShowHandledUserIdRef.current === user.id) return;

    if (hasUserGuideAutoShownThisLogin(user.id)) {
      settle(user.id);
      return;
    }

    if (!shouldAutoShowUserGuide({ user: guideUser }) || staffAppShell) {
      markUserGuideAutoShownThisLogin(user.id);
      settle(user.id);
      return;
    }

    if (location.pathname !== "/dashboard" || peakPaused) return;

    if (loadFailed) {
      markUserGuideAutoShownThisLogin(user.id);
      settle(user.id);
      return;
    }

    if (!guide) {
      setWanted(true);
      return;
    }

    const userId = user.id;
    autoShowHandledUserIdRef.current = userId;
    markUserGuideAutoShownThisLogin(userId);

    if (autoShowTimeoutRef.current != null) {
      window.clearTimeout(autoShowTimeoutRef.current);
    }
    autoShowTimeoutRef.current = window.setTimeout(() => {
      autoShowTimeoutRef.current = null;
      setWhatsNewSession((n) => n + 1);
      setWhatsNewOpen(true);
      setSettledUserId(userId);
    }, AUTO_SHOW_DELAY_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading, profilePromptDue, user?.id, audience, location.pathname, guide, staffAppShell, peakPaused, loadFailed]);

  const postLoginBusy =
    isAuthenticated && user?.id != null && (profilePromptDue || settledUserId !== user.id || whatsNewOpen || open);

  const value = useMemo(
    () => ({
      openGuide,
      closeGuide,
      isOpen: open,
      openWhatsNew,
      whatsNewOpen,
      postLoginBusy,
      guide,
      hasGuide,
      requestGuide,
      markGuideViewed,
    }),
    [openGuide, closeGuide, open, openWhatsNew, whatsNewOpen, postLoginBusy, guide, hasGuide, requestGuide, markGuideViewed]
  );

  const userName = formatPersonName(user);

  return (
    <UserGuideContext.Provider value={value}>
      {children}
      {(open || wanted) && (
        <Suspense fallback={null}>
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
            userName={userName}
            userEmail={user?.email}
            initialSectionId={guideStart}
            onTry={(href) => navigate(href)}
          />
        </Suspense>
      )}
      {guide && whatsNewSession > 0 ? (
        <Suspense fallback={null}>
          <WhatsNewDialog
            open={whatsNewOpen}
            onClose={closeWhatsNew}
            guide={guide}
            userName={userName}
            unreadIds={unreadIds}
            onOpenGuide={openGuideFromWhatsNew}
            onTry={tryLink}
          />
        </Suspense>
      ) : null}
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
