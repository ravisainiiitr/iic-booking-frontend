import { useCallback, useEffect, useState } from "react";
import {
  apiClient,
  type BookingDataShareRow,
  type DataShareUserDetails,
  type DataShareUserSummary,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Loader2, Search, Share2, ShieldCheck, UserRound, X } from "lucide-react";
import { toast } from "sonner";

const MIN_SEARCH_CHARS = 3;

type Step = "search" | "details" | "confirm";

function isInternalIitrUser(
  user: { user_type?: number | string | null; department_type?: string | null } | null | undefined
): boolean {
  const type = String(user?.user_type ?? "").toLowerCase();
  if (type === "student" || type === "individual_student") return true;
  return type === "faculty" && String(user?.department_type ?? "").toLowerCase() === "internal";
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium break-words">{value}</span>
    </div>
  );
}

function UserDetailsCard({ user }: { user: DataShareUserDetails }) {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center gap-3">
        {user.profile_picture ? (
          <img src={user.profile_picture} alt="" className="h-12 w-12 rounded-full object-cover border" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <UserRound className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0">
          <p className="font-semibold break-words">{user.name}</p>
          <p className="text-sm text-muted-foreground break-all">{user.email}</p>
        </div>
      </div>
      <div className="space-y-1.5">
        <DetailRow label="User type" value={user.user_type_label} />
        <DetailRow
          label="Department"
          value={user.department ? `${user.department}${user.department_code ? ` (${user.department_code})` : ""}` : null}
        />
        <DetailRow label="Enrolment / Emp. ID" value={user.id_number} />
        <DetailRow label="Designation" value={user.designation} />
        <DetailRow label="Programme" value={user.degree_name} />
        <DetailRow label="Branch" value={user.branch_name} />
      </div>
    </div>
  );
}

interface BookingShareButtonProps {
  bookingId: number;
  bookingLabel?: string;
}

/** Owner-only research-data sharing with internal IIT Roorkee students/faculty (search → details → confirm). */
export function BookingShareButton({ bookingId, bookingLabel }: BookingShareButtonProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loadingShares, setLoadingShares] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [blockReason, setBlockReason] = useState<string | null>(null);
  const [shares, setShares] = useState<BookingDataShareRow[]>([]);
  const [step, setStep] = useState<Step>("search");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<DataShareUserSummary[]>([]);
  const [selected, setSelected] = useState<DataShareUserDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [revokeArmedId, setRevokeArmedId] = useState<number | null>(null);
  const [revokingId, setRevokingId] = useState<number | null>(null);

  const loadShares = useCallback(async () => {
    setLoadingShares(true);
    const res = await apiClient.getBookingDataShares(bookingId);
    setLoadingShares(false);
    if (res.error || !res.data) {
      setCanShare(false);
      setBlockReason(res.error || "Could not load sharing details.");
      return;
    }
    setCanShare(res.data.can_share);
    setBlockReason(res.data.reason);
    setShares(res.data.shares);
  }, [bookingId]);

  useEffect(() => {
    if (!open) return;
    setStep("search");
    setQuery("");
    setResults([]);
    setSelected(null);
    setRevokeArmedId(null);
    void loadShares();
  }, [open, loadShares]);

  useEffect(() => {
    if (!open || step !== "search") return;
    const q = query.trim();
    if (q.length < MIN_SEARCH_CHARS) {
      setResults([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      const res = await apiClient.searchDataSharingUsers(q);
      if (cancelled) return;
      setSearching(false);
      if (res.error) {
        toast.error(res.error);
        setResults([]);
        return;
      }
      setResults(res.data?.results ?? []);
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, open, step]);

  if (!isInternalIitrUser(user)) return null;

  const sharedUserIds = new Set(shares.map((s) => s.shared_with.id));

  const selectUser = async (summary: DataShareUserSummary) => {
    setLoadingDetails(true);
    const res = await apiClient.getDataSharingUser(summary.id);
    setLoadingDetails(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not load user details.");
      return;
    }
    setSelected(res.data);
    setStep("details");
  };

  const confirmShare = async () => {
    if (!selected) return;
    setSubmitting(true);
    const res = await apiClient.createBookingDataShare(bookingId, selected.id);
    setSubmitting(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Research data shared with ${selected.name}.`);
    setSelected(null);
    setQuery("");
    setResults([]);
    setStep("search");
    void loadShares();
  };

  const revoke = async (share: BookingDataShareRow) => {
    if (revokeArmedId !== share.id) {
      setRevokeArmedId(share.id);
      return;
    }
    setRevokingId(share.id);
    const res = await apiClient.revokeBookingDataShare(bookingId, share.id);
    setRevokingId(null);
    setRevokeArmedId(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`Access revoked for ${share.shared_with.name}.`);
    void loadShares();
  };

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1" onClick={() => setOpen(true)}>
        <Share2 className="h-4 w-4" />
        Share data
      </Button>
      <Dialog open={open} onOpenChange={(next) => !submitting && setOpen(next)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Share research data{bookingLabel ? ` · ${bookingLabel}` : ""}</DialogTitle>
            <DialogDescription>
              Share this booking&apos;s details and result files with an IIT Roorkee student or faculty member. They
              can view and download the results until you revoke access.
            </DialogDescription>
          </DialogHeader>

          {loadingShares && shares.length === 0 ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !canShare ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">{blockReason || "This booking cannot be shared."}</p>
          ) : step === "search" ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, email or enrolment / employee ID"
                  className="pl-9"
                />
              </div>
              {query.trim().length > 0 && query.trim().length < MIN_SEARCH_CHARS ? (
                <p className="text-xs text-muted-foreground">Type at least {MIN_SEARCH_CHARS} characters.</p>
              ) : null}
              {searching || loadingDetails ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : results.length > 0 ? (
                <ul className="divide-y rounded-md border max-h-64 overflow-y-auto">
                  {results.map((r) => {
                    const already = sharedUserIds.has(r.id);
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          disabled={already}
                          onClick={() => selectUser(r)}
                          className="w-full text-left px-3 py-2 hover:bg-muted/60 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium break-words">{r.name}</p>
                              <p className="text-xs text-muted-foreground break-all">
                                {r.email}
                                {r.department ? ` · ${r.department}` : ""}
                              </p>
                            </div>
                            {already ? <Badge variant="secondary">Already shared</Badge> : null}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : query.trim().length >= MIN_SEARCH_CHARS ? (
                <p className="text-sm text-muted-foreground">No eligible IIT Roorkee users found.</p>
              ) : null}
            </div>
          ) : step === "details" && selected ? (
            <div className="space-y-3">
              <p className="text-sm font-medium">Please verify the recipient&apos;s details</p>
              <UserDetailsCard user={selected} />
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setStep("search")}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <Button onClick={() => setStep("confirm")}>Continue</Button>
              </DialogFooter>
            </div>
          ) : step === "confirm" && selected ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
                <p className="flex items-center gap-1 font-medium">
                  <ShieldCheck className="h-4 w-4" />
                  Confirm sharing
                </p>
                <p className="mt-1">
                  <span className="font-medium">{selected.name}</span> ({selected.email}) will be able to see the
                  details of booking {bookingLabel || `#${bookingId}`} and download all of its result files. They will
                  be notified by email. You can revoke access at any time.
                </p>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" disabled={submitting} onClick={() => setStep("details")}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <Button className="bg-green-600 hover:bg-green-700" disabled={submitting} onClick={confirmShare}>
                  {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Share2 className="h-4 w-4 mr-1" />}
                  Confirm &amp; share
                </Button>
              </DialogFooter>
            </div>
          ) : null}

          {shares.length > 0 ? (
            <div className="space-y-2 border-t pt-3">
              <p className="text-sm font-medium">Currently shared with</p>
              <ul className="space-y-2">
                {shares.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium break-words">{s.shared_with.name}</p>
                      <p className="text-xs text-muted-foreground break-all">
                        {s.shared_with.email}
                        {s.shared_with.department ? ` · ${s.shared_with.department}` : ""} · since{" "}
                        {new Date(s.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={revokeArmedId === s.id ? "destructive" : "outline"}
                      disabled={revokingId === s.id}
                      onClick={() => revoke(s)}
                    >
                      {revokingId === s.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <X className="h-4 w-4 mr-1" />
                          {revokeArmedId === s.id ? "Confirm revoke" : "Revoke"}
                        </>
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default BookingShareButton;
