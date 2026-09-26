import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, Bell } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useUserGuide } from "@/components/UserGuide/UserGuideProvider";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
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
import { PendingActionList, type PendingItem } from "@/components/PendingActions/PendingActionList";

/** After sign-in, lists everything waiting on the user (requests, shares, payments, reviews) with a direct link to each. */
export default function PendingActionsPrompt() {
  const { user, isAuthenticated } = useAuth();
  const { isOpen: guideOpen } = useUserGuide();
  const location = useLocation();
  const navigate = useNavigate();
  const [items, setItems] = useState<PendingItem[]>([]);
  const [open, setOpen] = useState(false);
  const inFlight = useRef(false);

  const eligible = isAuthenticated && !!user?.id;

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
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {total === 1 ? "1 item needs your attention" : `${total} items need your attention`}
          </DialogTitle>
          <DialogDescription>
            Requests addressed to you and items waiting on you. Open any of them to review and act.
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          <PendingActionList
            items={items}
            onOpen={(link) => {
              setOpen(false);
              navigate(link);
            }}
          />
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Bell className="h-3.5 w-3.5" /> These are also listed under notifications and on your dashboard.
          </p>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
