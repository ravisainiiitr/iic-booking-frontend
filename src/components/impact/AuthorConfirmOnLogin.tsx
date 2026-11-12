import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { BookOpenCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ResearcherCard, { recordsToConfirm } from "@/components/impact/ResearcherRecordsCard";
import { useAuth } from "@/contexts/AuthContext";
import { authorConfirmationsApi, type ResearcherRecords } from "@/lib/authorConfirmationsApi";
import { normalizeUserTypeCode } from "@/lib/userTypes";

const SHOWN_KEY = "authorConfirm.shownFor";
/** When the server has just started a name search, look again once after this long. */
export const SEARCH_RECHECK_MS = 20_000;

function shownThisSession(userId: unknown): boolean {
  try {
    return sessionStorage.getItem(SHOWN_KEY) === String(userId);
  } catch {
    return false;
  }
}

function markShown(userId: unknown): void {
  try {
    sessionStorage.setItem(SHOWN_KEY, String(userId));
  } catch {
    // Storage unavailable: the prompt may show again on the next page load.
  }
}

/**
 * On sign-in, every faculty member is asked to confirm the OpenAlex author records found under their name (lookalikes
 * and automatic matches alike), so papers acknowledging IIC are credited to the right person. Once per sign-in
 * session; it comes back on the next sign-in until nothing is left to confirm. A faculty member with no records yet
 * gets a background name search, and the prompt looks again once shortly after.
 */
export default function AuthorConfirmOnLogin() {
  const { user, isAuthenticated } = useAuth();
  const { pathname } = useLocation();
  const [row, setRow] = useState<ResearcherRecords | null>(null);
  const [open, setOpen] = useState(false);
  const userId = (user as { id?: unknown } | null)?.id;
  const faculty = isAuthenticated && normalizeUserTypeCode((user as { user_type?: string | number } | null)?.user_type) === "faculty";
  const onAuthPage = pathname.startsWith("/auth");

  useEffect(() => {
    if (!faculty || onAuthPage || userId == null || shownThisSession(userId)) return;
    let cancelled = false;
    let timer: number | undefined;
    const look = (retry: boolean) =>
      authorConfirmationsApi.mine().then((res) => {
        if (cancelled || !res.data) return;
        if (recordsToConfirm(res.data, true).length) {
          markShown(userId);
          setRow(res.data);
          setOpen(true);
        } else if (retry && res.data.searching) {
          timer = window.setTimeout(() => void look(false), SEARCH_RECHECK_MS);
        }
      });
    void look(true);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [faculty, onAuthPage, userId]);

  if (!row) return null;
  const left = recordsToConfirm(row, true).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto" data-testid="author-confirm-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpenCheck className="h-5 w-5 text-primary" aria-hidden /> Confirm your author records
          </DialogTitle>
          <DialogDescription>
            We searched OpenAlex (a public index of scholarly works) for {row.researcher.name || "your name"}. Confirm each record
            that is yours and mark the others “Not me”, so papers that acknowledge IIC facilities are credited to you.
          </DialogDescription>
        </DialogHeader>
        <ul>
          <ResearcherCard
            row={row}
            self
            includeAutoLinked
            onUpdated={(next) => {
              setRow(next);
              if (!recordsToConfirm(next, true).length) {
                toast.success("Thank you: your author records are confirmed");
                setOpen(false);
              }
            }}
          />
        </ul>
        <DialogFooter className="items-center gap-2 sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {left} record{left === 1 ? "" : "s"} to confirm. You will be asked again at your next sign-in.
          </p>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
