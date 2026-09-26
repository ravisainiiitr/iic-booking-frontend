import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, Bell } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useUserGuide } from "@/components/UserGuide/UserGuideProvider";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  hasPendingActionsShownThisLogin,
  markPendingActionsShownThisLogin,
} from "@/components/PendingActions/pendingActionsSession";

type PendingItem = { key: string; label: string; count: number; link: string; description: string };

const STAFF_TYPES = new Set(["admin", "manager", "operator", "dept_admin"]);

/** After sign-in, tells OIC / Lab Incharge / admins what is waiting on them, with a direct link to each queue. */
export default function PendingActionsPrompt() {
  const { user, isAuthenticated } = useAuth();
  const { isOpen: guideOpen } = useUserGuide();
  const location = useLocation();
  const navigate = useNavigate();
  const [items, setItems] = useState<PendingItem[]>([]);
  const [open, setOpen] = useState(false);
  const inFlight = useRef(false);

  const userType = String(user?.user_type ?? "").toLowerCase();
  const eligible = isAuthenticated && !!user?.id && STAFF_TYPES.has(userType);

  useEffect(() => {
    if (!isAuthenticated) setOpen(false);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!eligible || !user?.id) return;
    if (location.pathname !== "/dashboard") return;
    if (guideOpen || hasPendingActionsShownThisLogin(user.id) || inFlight.current) return;

    const uid = user.id;
    const timer = window.setTimeout(async () => {
      inFlight.current = true;
      try {
        const res = await apiClient.getPendingActions();
        markPendingActionsShownThisLogin(uid);
        const list = res.data?.items ?? [];
        if (list.length > 0) {
          setItems(list);
          setOpen(true);
        }
      } finally {
        inFlight.current = false;
      }
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [eligible, user?.id, location.pathname, guideOpen]);

  if (!eligible) return null;

  const total = items.reduce((sum, i) => sum + i.count, 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {total === 1 ? "1 item needs your action" : `${total} items need your action`}
          </DialogTitle>
          <DialogDescription>
            These requests are waiting for your decision. Open a queue to review and act on them.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.key}
              className="flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/60 dark:bg-amber-950/20"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium">
                  {item.label}
                  <Badge className="bg-amber-500 hover:bg-amber-500">{item.count} pending</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
              </div>
              <Button
                size="sm"
                className="shrink-0"
                onClick={() => {
                  setOpen(false);
                  navigate(item.link);
                }}
              >
                Open <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
        <DialogFooter className="sm:justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Bell className="h-3.5 w-3.5" /> New requests and your decisions are also listed under notifications.
          </p>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
