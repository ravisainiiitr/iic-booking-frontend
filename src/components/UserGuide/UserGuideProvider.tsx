import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { getGuideForUser, shouldAutoShowUserGuide } from "@/guides";
import type { UserGuideContent } from "@/guides";
import UserGuideDialog from "@/components/UserGuide/UserGuideDialog";

interface UserGuideContextValue {
  openGuide: (opts?: { force?: boolean }) => void;
  closeGuide: () => void;
  isOpen: boolean;
  guide: UserGuideContent | null;
  markGuideViewed: () => Promise<void>;
}

const UserGuideContext = createContext<UserGuideContextValue | undefined>(undefined);

export function UserGuideProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, updateUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [autoPromptChecked, setAutoPromptChecked] = useState(false);

  const guide = useMemo(() => {
    if (!user) return null;
    return getGuideForUser(user.user_type, user.user_type_alias);
  }, [user]);

  const markGuideViewed = useCallback(async () => {
    if (!user?.id || user.user_guide_viewed) return;
    updateUser({ user_guide_viewed: true });
    try {
      await apiClient.updateProfile({ user_guide_viewed: true });
    } catch {
      // Local flag still set; next refresh may re-prompt if PATCH failed
    }
  }, [user?.id, user?.user_guide_viewed, updateUser]);

  const openGuide = useCallback(
    (opts?: { force?: boolean }) => {
      if (!guide && !opts?.force) return;
      setOpen(true);
    },
    [guide]
  );

  const closeGuide = useCallback(() => setOpen(false), []);

  // First-login / first-session auto launch for eligible end users
  useEffect(() => {
    if (!isAuthenticated || !user?.id || autoPromptChecked) return;
    setAutoPromptChecked(true);

    if (
      !shouldAutoShowUserGuide({
        userType: user.user_type,
        userTypeAlias: user.user_type_alias,
        userGuideViewed: user.user_guide_viewed,
      })
    ) {
      return;
    }

    // Avoid stacking with other dashboard toasts: slight delay
    const t = window.setTimeout(() => setOpen(true), 600);
    return () => window.clearTimeout(t);
  }, [
    isAuthenticated,
    user?.id,
    user?.user_type,
    user?.user_type_alias,
    user?.user_guide_viewed,
    autoPromptChecked,
  ]);

  // Reset auto-check when user logs out / switches
  useEffect(() => {
    if (!isAuthenticated) setAutoPromptChecked(false);
  }, [isAuthenticated]);

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
        userName={user?.name}
      />
    </UserGuideContext.Provider>
  );
}

export function useUserGuide() {
  const ctx = useContext(UserGuideContext);
  if (!ctx) {
    throw new Error("useUserGuide must be used within UserGuideProvider");
  }
  return ctx;
}
