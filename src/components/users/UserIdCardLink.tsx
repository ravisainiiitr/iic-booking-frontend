import { createContext, lazy, Suspense, useCallback, useContext, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { IdCard } from "lucide-react";
import { cn } from "@/lib/utils";

const UserCardDrawer = lazy(() => import("@/components/admin-insights/UserCardDrawer"));

type UserCardContextValue = { openUserCard: (userId: number) => void };

const UserCardContext = createContext<UserCardContextValue | null>(null);

function Drawer({ userId, onClose }: { userId: number | null; onClose: () => void }) {
  if (userId == null) return null;
  return (
    <Suspense fallback={null}>
      <UserCardDrawer userId={userId} onClose={onClose} source="any" />
    </Suspense>
  );
}

/** One ID-card drawer for the whole app; any `UserIdCardLink` below opens it. */
export function UserCardProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<number | null>(null);
  const openUserCard = useCallback((id: number) => setUserId(id), []);
  const value = useMemo(() => ({ openUserCard }), [openUserCard]);
  return (
    <UserCardContext.Provider value={value}>
      {children}
      <Drawer userId={userId} onClose={() => setUserId(null)} />
    </UserCardContext.Provider>
  );
}

/** Opens a user's ID card; works without the provider too (the link then hosts its own drawer). */
export function useUserCard(): UserCardContextValue & { drawer: ReactNode } {
  const shared = useContext(UserCardContext);
  const [localId, setLocalId] = useState<number | null>(null);
  const openLocal = useCallback((id: number) => setLocalId(id), []);
  if (shared) return { ...shared, drawer: null };
  return { openUserCard: openLocal, drawer: <Drawer userId={localId} onClose={() => setLocalId(null)} /> };
}

/**
 * A user's name that opens their ID card (photo, category, department, supervisor, bookings within the viewer's
 * scope). The backend decides what the viewer may see; without an id the name is plain text.
 */
export function UserIdCardLink({
  userId,
  name,
  email,
  className,
  showIcon = false,
  children,
}: {
  userId: number | string | null | undefined;
  name?: string | null;
  email?: string | null;
  className?: string;
  showIcon?: boolean;
  children?: ReactNode;
}) {
  const { openUserCard, drawer } = useUserCard();
  const label = children ?? (name?.trim() || email?.trim() || "—");
  const id = userId != null && String(userId).trim() !== "" && Number.isFinite(Number(userId)) ? Number(userId) : null;
  if (id == null || id <= 0) return <span className={className}>{label}</span>;
  return (
    <>
      <button
        type="button"
        className={cn(
          "inline-flex max-w-full items-center gap-1 text-left font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
          className,
        )}
        title="View ID card"
        onClick={(e: MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          openUserCard(id);
        }}
      >
        {showIcon ? <IdCard className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden /> : null}
        <span className="min-w-0 break-words">{label}</span>
      </button>
      {drawer}
    </>
  );
}

export default UserIdCardLink;
