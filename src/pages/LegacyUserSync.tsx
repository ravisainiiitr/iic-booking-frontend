import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardHeader from "@/components/DashboardHeader";
import UserProfile from "@/components/UserProfile";
import FacultyWalletSyncDeadlineCard from "@/components/admin/FacultyWalletSyncDeadlineCard";
import { useAuth } from "@/contexts/AuthContext";
import { useEmbeddedMode } from "@/contexts/EmbeddedModeContext";
import {
  apiClient,
  type LegacySyncBookingRow,
  type LegacySyncCandidate,
  type LegacySyncConfirmResult,
  type LegacySyncPreview,
  type LegacySyncUserDetail,
  type LegacySyncUserSearchRow,
  type LegacySyncWalletBrief,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Database,
  FlaskConical,
  Link2,
  Loader2,
  Search,
  User,
  Wallet as WalletIcon,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function money(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function isTruthyFlag(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true";
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="break-words text-sm">{value === null || value === undefined || value === "" ? "—" : value}</span>
    </div>
  );
}

function WalletBriefView({ title, wallet }: { title: string; wallet: LegacySyncWalletBrief }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        <span className="text-sm font-semibold">{money(wallet.total_balance)}</span>
      </div>
      <p className="mb-2 text-xs text-muted-foreground">
        Owner: {wallet.owner_name} ({wallet.owner_email}) · Wallet #{wallet.wallet_id}
      </p>
      {wallet.sub_wallets.length > 0 ? (
        <ul className="space-y-1 text-xs">
          {wallet.sub_wallets.map((sw) => (
            <li key={sw.department} className="flex justify-between gap-2">
              <span className="truncate text-muted-foreground">{sw.department}</span>
              <span>{money(sw.balance)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No department balances yet.</p>
      )}
    </div>
  );
}

function BookingsTable({ rows, showSyncedAt = false }: { rows: LegacySyncBookingRow[]; showSyncedAt?: boolean }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No legacy bookings.</p>;
  }
  return (
    <div className="max-h-96 overflow-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Old booking #</TableHead>
            <TableHead>Equipment</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Duration</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Charge</TableHead>
            {showSyncedAt && <TableHead>Synced</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((b) => {
            const deleted = isTruthyFlag(b.is_deleted);
            return (
              <TableRow key={b.legacy_booking_id} className={cn(deleted && "opacity-60")}>
                <TableCell className="font-mono text-xs">{b.legacy_booking_id}</TableCell>
                <TableCell className="text-sm">
                  <div>{b.legacy_equipment_name || (b.legacy_equipment_id ? `Old equipment #${b.legacy_equipment_id}` : "—")}</div>
                  {b.new_equipment ? (
                    <div className="text-xs text-muted-foreground">
                      New: {b.new_equipment.name} ({b.new_equipment.code})
                    </div>
                  ) : (
                    <div className="text-xs text-amber-600">No mapped equipment in new portal</div>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">{formatDateTime(b.booking_date)}</TableCell>
                <TableCell className="text-right text-sm">
                  {b.duration_minutes != null ? `${b.duration_minutes} min` : "—"}
                </TableCell>
                <TableCell className="text-sm">
                  {b.status ?? "—"}
                  {deleted && (
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      deleted
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right text-sm">{money(b.charge)}</TableCell>
                {showSyncedAt && <TableCell className="whitespace-nowrap text-xs">{formatDateTime(b.synced_at)}</TableCell>}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

const LegacyUserSync = () => {
  const navigate = useNavigate();
  const embedded = useEmbeddedMode();
  const { user } = useAuth();
  const isAdmin = String(user?.user_type ?? "").toLowerCase() === "admin";

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<LegacySyncUserSearchRow[]>([]);
  const [selectionLocked, setSelectionLocked] = useState(false);

  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedUser, setSelectedUser] = useState<LegacySyncUserDetail | null>(null);
  const [candidates, setCandidates] = useState<LegacySyncCandidate[]>([]);
  const [legacyError, setLegacyError] = useState<string | null>(null);
  const [syncedBookings, setSyncedBookings] = useState<LegacySyncBookingRow[]>([]);

  const [legacyUserId, setLegacyUserId] = useState("");
  const [walletTarget, setWalletTarget] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<LegacySyncPreview | null>(null);

  const [syncWallet, setSyncWallet] = useState(true);
  const [syncBookings, setSyncBookings] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<LegacySyncConfirmResult | null>(null);

  const searchSeq = useRef(0);

  useEffect(() => {
    if (!isAdmin) navigate("/dashboard");
  }, [isAdmin, navigate]);

  useEffect(() => {
    const q = query.trim();
    if (selectionLocked || q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    const seq = ++searchSeq.current;
    setSearching(true);
    const handle = window.setTimeout(async () => {
      const res = await apiClient.searchLegacySyncUsers(q);
      if (seq !== searchSeq.current) return;
      setSearching(false);
      if (res.error) {
        toast.error(res.error);
        setResults([]);
        return;
      }
      setResults(res.data?.results ?? []);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query, selectionLocked]);

  const resetSyncState = () => {
    setPreview(null);
    setResult(null);
    setWalletTarget(null);
    setSyncWallet(true);
    setSyncBookings(true);
  };

  const loadUserDetail = async (userId: number) => {
    setLoadingDetail(true);
    const res = await apiClient.getLegacySyncUserDetail(userId);
    setLoadingDetail(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not load user details.");
      return;
    }
    setSelectedUser(res.data.user);
    setCandidates(res.data.legacy_candidates);
    setLegacyError(res.data.legacy_error);
    setSyncedBookings(res.data.synced_bookings);
    if (res.data.legacy_candidates.length === 1) {
      setLegacyUserId(String(res.data.legacy_candidates[0].legacy_user_id));
    }
  };

  const handleSelectUser = (row: LegacySyncUserSearchRow) => {
    setSelectionLocked(true);
    setQuery(row.name || row.email);
    setResults([]);
    setLegacyUserId("");
    setCandidates([]);
    setLegacyError(null);
    setSyncedBookings([]);
    resetSyncState();
    void loadUserDetail(row.id);
  };

  const runPreview = async (target: string | null = walletTarget) => {
    if (!selectedUser) {
      toast.error("Search and select a user first.");
      return;
    }
    const uid = Number(legacyUserId.trim());
    if (!Number.isInteger(uid) || uid <= 0) {
      toast.error("Enter a valid old-portal user ID.");
      return;
    }
    setPreviewing(true);
    setResult(null);
    const res = await apiClient.previewLegacyUserSync({
      user_id: selectedUser.id,
      legacy_user_id: uid,
      wallet_target: target,
    });
    setPreviewing(false);
    if (res.error || !res.data) {
      setPreview(null);
      toast.error(res.error || "Test sync failed.");
      return;
    }
    setPreview(res.data);
    setWalletTarget(res.data.wallet_sync.selected_target);
    setSyncWallet(res.data.wallet_sync.can_sync);
    setSyncBookings(res.data.bookings.ok && res.data.bookings.count > 0);
    toast.success(`Old balance fetched: ${money(res.data.legacy_wallet.balance)}`);
  };

  const previewMatchesInput = preview !== null && String(preview.legacy_user.legacy_user_id) === legacyUserId.trim();
  const walletSyncAllowed = Boolean(preview?.wallet_sync.can_sync);
  const bookingSyncAllowed = Boolean(preview?.bookings.ok);
  const canConfirm =
    previewMatchesInput &&
    Boolean(preview?.ok) &&
    ((syncWallet && walletSyncAllowed) || (syncBookings && bookingSyncAllowed)) &&
    !confirming;

  const selectedTargetInfo = useMemo(
    () => preview?.wallet_sync.targets.find((t) => t.key === preview.wallet_sync.selected_target) ?? null,
    [preview],
  );

  const handleConfirm = async () => {
    if (!preview || !selectedUser) return;
    setConfirming(true);
    const res = await apiClient.confirmLegacyUserSync({
      user_id: selectedUser.id,
      legacy_user_id: preview.legacy_user.legacy_user_id,
      wallet_target: preview.wallet_sync.selected_target,
      sync_wallet: syncWallet && walletSyncAllowed,
      sync_bookings: syncBookings && bookingSyncAllowed,
      expected_legacy_balance: preview.legacy_wallet.balance,
    });
    setConfirming(false);
    setConfirmOpen(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Sync failed.");
      return;
    }
    setResult(res.data);
    setSelectedUser(res.data.user);
    setSyncedBookings(res.data.synced_bookings);
    setPreview(null);
    toast.success("Mapping confirmed and sync completed.");
  };

  if (!isAdmin) return null;

  const u = selectedUser;

  return (
    <div className="page-shell">
      <DashboardHeader />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        {!embedded && (
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">Legacy user sync</h1>
              <p className="text-sm text-muted-foreground">
                Map a new-portal user to an old booking portal user ID, then sync the wallet balance and legacy bookings.
              </p>
            </div>
          </div>
        )}

        <FacultyWalletSyncDeadlineCard />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Search className="h-5 w-5" />
              1. Find the user
            </CardTitle>
            <CardDescription>Search by name, email, or employee / enrolment ID.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Popover open={results.length > 0 && query.trim().length >= 2 && !selectionLocked}>
              <PopoverTrigger asChild>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Type at least 2 characters..."
                    value={query}
                    onChange={(e) => {
                      setSelectionLocked(false);
                      setQuery(e.target.value);
                    }}
                    className="pl-10"
                  />
                  {searching && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              </PopoverTrigger>
              <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <Command shouldFilter={false}>
                  <CommandList>
                    <CommandEmpty>{searching ? "Searching..." : "No users found"}</CommandEmpty>
                    <CommandGroup>
                      {results.map((row) => (
                        <CommandItem
                          key={row.id}
                          value={String(row.id)}
                          onSelect={() => handleSelectUser(row)}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectUser(row);
                          }}
                          className="cursor-pointer"
                        >
                          <div className="flex w-full items-center gap-3 py-1">
                            {row.profile_picture ? (
                              <img
                                src={apiClient.getProfilePictureUrl(row.id)}
                                alt={row.name}
                                className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                                <User className="h-4 w-4 text-foreground/70" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <p className="truncate text-sm font-medium">{row.name}</p>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-xs text-foreground/80">{row.email}</p>
                                {row.emp_id && (
                                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground/70">{row.emp_id}</span>
                                )}
                                {row.user_type_display && (
                                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground/70">
                                    {row.user_type_display}
                                  </span>
                                )}
                              </div>
                              {row.department && <p className="truncate text-xs text-foreground/70">{row.department}</p>}
                            </div>
                            {!row.is_active && <XCircle className="h-4 w-4 flex-shrink-0 text-red-500" />}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {loadingDetail && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading user details...
              </div>
            )}

            {u && !loadingDetail && (
              <div className="space-y-4 rounded-lg border bg-muted p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <UserProfile
                    name={u.name}
                    email={u.email}
                    phone={u.phone}
                    department={u.department}
                    profilePicture={u.profile_picture ? apiClient.getProfilePictureUrl(u.id) : undefined}
                    size="lg"
                  />
                  <div className="flex flex-wrap gap-2">
                    {u.user_type_display && <Badge variant="secondary">{u.user_type_display}</Badge>}
                    <Badge variant={u.is_active ? "default" : "destructive"}>{u.is_active ? "Active" : "Inactive"}</Badge>
                    {u.legacy_bookings_synced > 0 && (
                      <Badge variant="outline">{u.legacy_bookings_synced} legacy bookings synced</Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <DetailRow label="New portal user ID" value={u.id} />
                  <DetailRow label="Employee / enrolment ID" value={u.emp_id} />
                  <DetailRow label="Secondary phone" value={u.secondary_phone} />
                  <DetailRow label="Designation" value={u.designation} />
                  <DetailRow label="Degree" value={u.degree_name} />
                  <DetailRow label="Branch" value={u.branch_name} />
                  <DetailRow label="Joining date" value={u.joining_date} />
                  <DetailRow label="Graduation date" value={u.graduation_date} />
                  <DetailRow label="Registered on" value={formatDateTime(u.date_joined)} />
                  <DetailRow label="Last login" value={formatDateTime(u.last_login)} />
                  <DetailRow
                    label="Supervisor"
                    value={u.supervisor ? `${u.supervisor.name} (${u.supervisor.email})` : null}
                  />
                  <DetailRow label="Eligible for own wallet" value={u.can_have_own_wallet ? "Yes" : "No"} />
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {u.own_wallet && <WalletBriefView title="Own wallet" wallet={u.own_wallet} />}
                  {u.linked_faculty_wallet && <WalletBriefView title="Linked faculty wallet" wallet={u.linked_faculty_wallet} />}
                  {!u.own_wallet && !u.linked_faculty_wallet && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                      No wallet yet and not linked to a faculty wallet.
                      {u.can_have_own_wallet ? " An own wallet will be created if you sync the balance." : ""}
                    </div>
                  )}
                </div>

                {u.legacy_mappings.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium">Existing legacy mappings</p>
                    <div className="overflow-auto rounded-md border bg-background">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Old user ID</TableHead>
                            <TableHead>Key</TableHead>
                            <TableHead>Old name / email</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Old balance</TableHead>
                            <TableHead>Updated</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {u.legacy_mappings.map((m) => (
                            <TableRow key={m.employee_id}>
                              <TableCell className="font-mono text-xs">{m.old_user_id ?? "—"}</TableCell>
                              <TableCell className="font-mono text-xs">{m.employee_id}</TableCell>
                              <TableCell className="text-sm">
                                {m.old_name || "—"}
                                <div className="text-xs text-muted-foreground">{m.old_email}</div>
                              </TableCell>
                              <TableCell className="text-xs">{m.mapping_status}</TableCell>
                              <TableCell className="text-right text-sm">{money(m.old_wallet_balance)}</TableCell>
                              <TableCell className="whitespace-nowrap text-xs">{formatDateTime(m.updated_at)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {u && !loadingDetail && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-5 w-5" />
                2. Old portal user ID
              </CardTitle>
              <CardDescription>
                Pick a suggested old account (same employee / enrolment ID or email) or enter the old user ID manually, then run
                Test sync. Test sync only reads data; nothing is changed until you confirm.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {legacyError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
                  {legacyError}
                </div>
              )}
              {!legacyError && candidates.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No old account matches this user's ID or email. Enter the old user ID manually.
                </p>
              )}
              {candidates.length > 0 && (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {candidates.map((c) => {
                    const active = legacyUserId.trim() === String(c.legacy_user_id);
                    return (
                      <button
                        key={c.legacy_user_id}
                        type="button"
                        onClick={() => {
                          setLegacyUserId(String(c.legacy_user_id));
                          setPreview(null);
                          setResult(null);
                        }}
                        className={cn(
                          "rounded-lg border p-3 text-left transition-colors hover:bg-muted",
                          active && "border-primary ring-1 ring-primary",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{c.name || "(no name)"}</span>
                          <span className="font-mono text-xs text-muted-foreground">Old ID {c.legacy_user_id}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {c.email || "—"} · {c.emp_id || "no emp_id"}
                        </p>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span className="text-xs">
                            Matched on: {c.matched_on.join(", ")}
                          </span>
                          <span className="text-sm font-semibold">{money(c.wallet_balance)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="legacy-user-id">Old portal user ID</Label>
                  <Input
                    id="legacy-user-id"
                    inputMode="numeric"
                    placeholder="e.g. 1234"
                    value={legacyUserId}
                    onChange={(e) => {
                      setLegacyUserId(e.target.value.replace(/[^0-9]/g, ""));
                      setPreview(null);
                      setResult(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void runPreview(null);
                    }}
                  />
                </div>
                <Button onClick={() => void runPreview(null)} disabled={previewing || !legacyUserId.trim()}>
                  {previewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-2 h-4 w-4" />}
                  Test sync
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {preview && u && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FlaskConical className="h-5 w-5" />
                3. Test sync result
              </CardTitle>
              <CardDescription>Review the old balance and bookings, then confirm the mapping.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {preview.blockers.length > 0 && (
                <div className="space-y-1 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
                  {preview.blockers.map((b) => (
                    <p key={b} className="flex items-start gap-2">
                      <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      {b}
                    </p>
                  ))}
                </div>
              )}
              {preview.warnings.length > 0 && (
                <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  {preview.warnings.map((w) => (
                    <p key={w} className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      {w}
                    </p>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="space-y-3 rounded-lg border p-4">
                  <p className="text-sm font-medium">Old portal account</p>
                  <div className="grid grid-cols-2 gap-3">
                    <DetailRow label="Old user ID" value={preview.legacy_user.legacy_user_id} />
                    <DetailRow label="Employee / enrolment ID" value={preview.legacy_user.emp_id} />
                    <DetailRow label="Name" value={preview.legacy_user.name} />
                    <DetailRow label="Email" value={preview.legacy_user.email} />
                  </div>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">All old account fields</summary>
                    <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                      {Object.entries(preview.legacy_user.details).map(([k, v]) => (
                        <div key={k} className="flex gap-2">
                          <span className="font-mono text-muted-foreground">{k}:</span>
                          <span className="break-all">{v === null || v === undefined || v === "" ? "—" : String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>

                <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <WalletIcon className="h-4 w-4" />
                    Old wallet balance
                  </p>
                  <p className="text-3xl font-bold">{money(preview.legacy_wallet.balance)}</p>
                  <p className="text-xs text-muted-foreground">Source: {preview.legacy_wallet.balance_source}</p>
                  <div className="grid grid-cols-3 gap-3">
                    <DetailRow label="Total credits" value={money(preview.legacy_wallet.total_credits)} />
                    <DetailRow label="Total debits" value={money(preview.legacy_wallet.total_debits)} />
                    <DetailRow label="Transactions" value={preview.legacy_wallet.transaction_count} />
                  </div>
                  {preview.legacy_wallet.wallet_balance !== null &&
                    preview.legacy_wallet.wallet_balance !== preview.legacy_wallet.ledger_balance && (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Ledger total (credits − debits) is {money(preview.legacy_wallet.ledger_balance)}; the wallet balance
                        field is used.
                      </p>
                    )}
                </div>
              </div>

              {preview.legacy_wallet.recent_transactions.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-medium">Recent old wallet transactions</p>
                  <div className="max-h-64 overflow-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                          <TableHead>Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.legacy_wallet.recent_transactions.map((t) => (
                          <TableRow key={t.id}>
                            <TableCell className="whitespace-nowrap text-xs">{formatDateTime(t.date)}</TableCell>
                            <TableCell className={cn("text-xs capitalize", t.type === "credit" ? "text-green-700" : "text-red-700")}>
                              {t.type}
                            </TableCell>
                            <TableCell className="text-right text-sm">{money(t.amount)}</TableCell>
                            <TableCell className="text-right text-sm">{money(t.running_balance)}</TableCell>
                            <TableCell className="max-w-xs truncate text-xs" title={t.description}>
                              {t.description || "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Checkbox
                      checked={syncWallet && walletSyncAllowed}
                      disabled={!walletSyncAllowed}
                      onCheckedChange={(v) => setSyncWallet(v === true)}
                    />
                    Sync wallet balance
                  </label>
                  <span className="font-mono text-xs text-muted-foreground">{preview.wallet_sync.migration_id}</span>
                </div>

                {preview.wallet_sync.targets.length > 0 ? (
                  <RadioGroup
                    value={preview.wallet_sync.selected_target ?? ""}
                    onValueChange={(v) => {
                      setWalletTarget(v);
                      void runPreview(v);
                    }}
                    className="space-y-1"
                  >
                    {preview.wallet_sync.targets.map((t) => (
                      <label key={t.key} className="flex items-center gap-2 text-sm">
                        <RadioGroupItem value={t.key} disabled={previewing} />
                        <span>
                          {t.label}
                          <span className="ml-1 text-xs text-muted-foreground">({t.owner_email})</span>
                          {t.will_create_wallet && (
                            <Badge variant="outline" className="ml-2 text-[10px]">
                              wallet will be created
                            </Badge>
                          )}
                        </span>
                      </label>
                    ))}
                  </RadioGroup>
                ) : (
                  <p className="text-sm text-muted-foreground">No wallet target available for this user.</p>
                )}

                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                  <DetailRow label="Department" value={preview.wallet_sync.department} />
                  <DetailRow label="Already credited" value={money(preview.wallet_sync.previously_credited)} />
                  <DetailRow label="Will credit / adjust" value={<strong>{money(preview.wallet_sync.delta)}</strong>} />
                  <DetailRow label="Balance before" value={money(preview.wallet_sync.subwallet_balance_before)} />
                  <DetailRow label="Balance after" value={money(preview.wallet_sync.subwallet_balance_after)} />
                </div>
                {selectedTargetInfo && (
                  <p className="text-xs text-muted-foreground">
                    Credit goes to {selectedTargetInfo.owner_name}'s wallet ({preview.wallet_sync.department ?? "IIC"}),
                    attributed to {u.name}.
                  </p>
                )}
                {Number(preview.wallet_sync.credited_elsewhere) !== 0 && (
                  <p className="text-xs text-red-700 dark:text-red-400">
                    {money(preview.wallet_sync.credited_elsewhere)} of this old balance is already credited to another wallet.
                  </p>
                )}
                {preview.wallet_sync.reasons.map((r) => (
                  <p key={r} className="flex items-start gap-2 text-xs text-red-700 dark:text-red-400">
                    <XCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                    {r}
                  </p>
                ))}
                {preview.wallet_sync.existing_legacy_credits.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground">
                      Existing legacy credits for this user ({preview.wallet_sync.existing_legacy_credits.length})
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {preview.wallet_sync.existing_legacy_credits.map((c) => (
                        <li key={c.id}>
                          {formatDateTime(c.created_at)} · {c.type} {money(c.amount)} · {c.wallet_owner} / {c.department} ·{" "}
                          <span className="text-muted-foreground">{c.description}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={syncBookings && bookingSyncAllowed}
                    disabled={!bookingSyncAllowed}
                    onCheckedChange={(v) => setSyncBookings(v === true)}
                  />
                  Sync legacy bookings (archived as booking history)
                </label>
                {!preview.bookings.ok && (
                  <p className="text-xs text-red-700 dark:text-red-400">{preview.bookings.error || "Old bookings unavailable."}</p>
                )}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                  <DetailRow label="Old bookings" value={preview.bookings.count} />
                  <DetailRow label="Deleted" value={preview.bookings.deleted_count} />
                  <DetailRow label="Total charge" value={money(preview.bookings.total_charge)} />
                  <DetailRow label="Already synced here" value={preview.bookings.already_synced_to_this_user} />
                  <DetailRow
                    label="Active slot blocks"
                    value={`${preview.bookings.active_blocks_linked_here} / ${preview.bookings.active_blocks} linked`}
                  />
                </div>
                {preview.bookings.rows.length < preview.bookings.count && (
                  <p className="text-xs text-muted-foreground">
                    Showing the latest {preview.bookings.rows.length} of {preview.bookings.count}. All will be synced.
                  </p>
                )}
                <BookingsTable rows={preview.bookings.rows} />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3">
                {!previewMatchesInput && (
                  <span className="text-xs text-amber-700">The old user ID changed. Run Test sync again.</span>
                )}
                <Button variant="outline" onClick={() => void runPreview()} disabled={previewing}>
                  {previewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-2 h-4 w-4" />}
                  Re-run Test sync
                </Button>
                <Button onClick={() => setConfirmOpen(true)} disabled={!canConfirm}>
                  <Link2 className="mr-2 h-4 w-4" />
                  Confirm mapping &amp; sync
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {result && (
          <Card className="border-green-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-green-700">
                <CheckCircle2 className="h-5 w-5" />
                Sync completed
              </CardTitle>
              <CardDescription>Mapping key: {result.mapping_key}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-sm font-medium">Wallet</p>
                {result.wallet ? (
                  <div className="grid grid-cols-2 gap-3">
                    <DetailRow label="Old balance" value={money(result.wallet.legacy_balance)} />
                    <DetailRow label="Credited now" value={money(result.wallet.delta)} />
                    <DetailRow label="Wallet owner" value={result.wallet.wallet_owner} />
                    <DetailRow label="Department balance" value={money(result.wallet.subwallet_balance)} />
                    <DetailRow
                      label="Old ledger rows"
                      value={`${result.wallet.ledger_rows.imported} imported, ${result.wallet.ledger_rows.duplicate} already present`}
                    />
                    <DetailRow label="New transaction" value={result.wallet.transaction_created ? "Yes" : "No (already in sync)"} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Wallet not synced.</p>
                )}
              </div>
              <div className="space-y-2 rounded-lg border p-3">
                <p className="text-sm font-medium">Bookings</p>
                {result.bookings ? (
                  <div className="grid grid-cols-3 gap-3">
                    <DetailRow label="Newly archived" value={result.bookings.archived_created} />
                    <DetailRow label="Updated" value={result.bookings.archived_updated} />
                    <DetailRow label="Slot blocks linked" value={result.bookings.blocks_linked} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Bookings not synced.</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {u && !loadingDetail && syncedBookings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Legacy bookings synced to {u.name}</CardTitle>
              <CardDescription>{syncedBookings.length} record(s) in booking history.</CardDescription>
            </CardHeader>
            <CardContent>
              <BookingsTable rows={syncedBookings} showSyncedAt />
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(open) => !confirming && setConfirmOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm legacy mapping</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Map <strong>{u?.name}</strong> ({u?.email}) to old user ID{" "}
                  <strong>{preview?.legacy_user.legacy_user_id}</strong> ({preview?.legacy_user.name || preview?.legacy_user.email}).
                </p>
                {syncWallet && walletSyncAllowed && preview && (
                  <p>
                    Wallet: old balance {money(preview.legacy_wallet.balance)}, credit {money(preview.wallet_sync.delta)} to{" "}
                    {selectedTargetInfo?.owner_name ?? "the selected wallet"}.
                  </p>
                )}
                {syncBookings && bookingSyncAllowed && preview && (
                  <p>Bookings: archive {preview.bookings.count} old booking(s) as history for this user.</p>
                )}
                <p className="text-xs text-muted-foreground">
                  If the old balance has changed since Test sync, the confirmation is rejected and you need to test again.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirming}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirm();
              }}
              disabled={confirming}
            >
              {confirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm &amp; sync
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LegacyUserSync;
