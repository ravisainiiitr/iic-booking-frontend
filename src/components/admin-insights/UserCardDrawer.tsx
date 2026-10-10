import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  Award,
  Building2,
  CalendarClock,
  GraduationCap,
  IdCard,
  LogIn,
  Mail,
  Phone,
  UserRound,
  Wallet,
} from "lucide-react";
import IdPhoto from "@/components/IdPhoto";
import { IdField } from "@/components/walletLedger/OwnerIdCard";
import { TestAccountBadge } from "@/components/wallet/TestAccountBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadError } from "@/components/admin-insights/InsightParts";
import UserBookingRows from "@/components/admin-insights/UserBookingRows";
import WalletLinkedBookings from "@/components/admin-insights/WalletLinkedBookings";
import { userBookingsPath, type UserCard } from "@/lib/adminInsights";
import { apiClient } from "@/lib/api";
import { formatDMY, formatDMYTime } from "@/lib/dateFormat";
import { formatINRAmount } from "@/lib/money";

function money(value: number) {
  return formatINRAmount(Math.round(value));
}

function IdCardHeader({ card, onOpenUser }: { card: UserCard; onOpenUser: (id: number) => void }) {
  const p = card.profile;
  const subtitle = [p.designation, p.user_type_display, p.programme_display].filter(Boolean).join(" · ");
  return (
    <Card className="overflow-hidden">
      <div className="h-1.5 bg-gradient-to-r from-primary via-violet-500 to-sky-500" aria-hidden />
      <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-5 py-2">
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <IdCard className="h-4 w-4 text-primary dark:text-sky-300" aria-hidden />
          {p.category_display}
        </span>
        <Badge variant={p.is_active ? "secondary" : "outline"}>{p.is_active ? "Active account" : "Inactive account"}</Badge>
      </div>
      <div className="space-y-4 p-5">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <IdPhoto url={p.profile_picture_url} name={p.name} email={p.email} caption={subtitle || "User photo"} />
          <div className="w-full min-w-0 flex-1 space-y-3 text-center sm:text-left">
            <div>
              <h2 className="break-words text-lg font-semibold leading-tight">{p.name}</h2>
              {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
              {p.employee_id || p.is_test_account ? (
                <div className="mt-1.5 flex flex-wrap justify-center gap-1.5 sm:justify-start">
                  {p.employee_id ? (
                    <p className="inline-flex rounded-md border bg-muted/50 px-2 py-0.5 font-mono text-xs font-medium">
                      ID: {p.employee_id}
                    </p>
                  ) : null}
                  {p.is_test_account ? <TestAccountBadge /> : null}
                </div>
              ) : null}
            </div>
            <dl className="grid grid-cols-1 gap-2.5 text-left sm:grid-cols-2">
              <IdField icon={<Building2 className="h-4 w-4" />} label="Department / organisation">
                {p.department?.name || "—"}
              </IdField>
              <IdField icon={<UserRound className="h-4 w-4" />} label="Supervisor">
                {p.supervisor ? (
                  <button
                    type="button"
                    className="text-left text-primary underline-offset-2 hover:underline"
                    onClick={() => onOpenUser(p.supervisor!.id)}
                  >
                    {p.supervisor.name}
                  </button>
                ) : (
                  "—"
                )}
              </IdField>
              <IdField icon={<Mail className="h-4 w-4" />} label="Email">
                {p.email ? (
                  <a href={`mailto:${p.email}`} className="break-all text-primary underline-offset-2 hover:underline">
                    {p.email}
                  </a>
                ) : (
                  "—"
                )}
              </IdField>
              <IdField icon={<Phone className="h-4 w-4" />} label="Mobile">
                {p.phone || "—"}
              </IdField>
              {p.degree_name ? (
                <IdField icon={<GraduationCap className="h-4 w-4" />} label="Programme">
                  {p.degree_name}
                </IdField>
              ) : null}
              <IdField icon={<CalendarClock className="h-4 w-4" />} label="Joined">
                {p.date_joined ? formatDMY(p.date_joined) : "—"}
              </IdField>
              <IdField icon={<LogIn className="h-4 w-4" />} label="Last login">
                {p.last_login ? formatDMYTime(p.last_login) : "Never"}
              </IdField>
              {card.wallet ? (
                <IdField icon={<Wallet className="h-4 w-4" />} label={card.wallet.is_owner ? "Wallet" : "Books from"}>
                  <Link
                    to={`/admin/wallet-ledger/${card.wallet.owner_id}`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {card.wallet.is_owner ? "Own wallet" : "Supervisor's wallet"} · {money(card.wallet.balance)}
                  </Link>
                </IdField>
              ) : null}
            </dl>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Bookings</p>
            <p className="font-semibold tabular-nums">{card.bookings.total}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Charged</p>
            <p className="font-semibold tabular-nums">{money(card.bookings.charged)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cancelled / refunded</p>
            <p className="font-semibold tabular-nums">{card.bookings.cancelled}</p>
          </div>
        </div>
        {card.certifications.length > 0 ? (
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Award className="h-3.5 w-3.5" aria-hidden />
              Certifications
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {card.certifications.map((c) => (
                <li key={c.id}>
                  <Badge
                    variant={c.status === "ACTIVE" ? "secondary" : "outline"}
                    title={c.valid_until ? `Valid until ${formatDMY(c.valid_until)}` : undefined}
                  >
                    {[c.equipment, c.level].filter(Boolean).join(" · ")}
                    {c.status !== "ACTIVE" ? ` (${c.status_display})` : ""}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/** User card from the Users overview: ID card, recent bookings and, for wallet owners, linked users' bookings. */
export default function UserCardDrawer({ userId, onClose }: { userId: number | null; onClose: () => void }) {
  const [trail, setTrail] = useState<number[]>([]);
  const [card, setCard] = useState<UserCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    setTrail(userId == null ? [] : [userId]);
  }, [userId]);

  const current = trail[trail.length - 1] ?? null;

  useEffect(() => {
    if (current == null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiClient.getAdminUserCard(current).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.error || !res.data) {
        setCard(null);
        setError(res.error || "Could not load this user.");
        return;
      }
      setCard(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [current, reloadKey]);

  const shown = card && card.profile.id === current ? card : null;

  return (
    <Sheet open={userId != null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full space-y-4 sm:max-w-4xl">
        <SheetHeader>
          <div className="flex items-center gap-2">
            {trail.length > 1 ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label="Back"
                onClick={() => setTrail((t) => t.slice(0, -1))}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            ) : null}
            <SheetTitle>{shown ? shown.profile.name : "User"}</SheetTitle>
          </div>
          <SheetDescription>ID card, recent bookings and bookings made through their wallet.</SheetDescription>
        </SheetHeader>

        {error ? (
          <LoadError message={error} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : !shown ? (
          <p className="py-10 text-center text-sm text-muted-foreground" aria-busy={loading}>
            Loading…
          </p>
        ) : (
          <>
            <IdCardHeader card={shown} onOpenUser={(id) => setTrail((t) => [...t, id])} />

            <section aria-label="Recent bookings" className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Recent bookings</h3>
                {shown.profile.email ? (
                  <Button asChild variant="outline" size="sm">
                    <Link to={userBookingsPath(shown.profile.email)}>View all bookings</Link>
                  </Button>
                ) : null}
              </div>
              {shown.bookings.recent.length === 0 ? (
                <p className="rounded-lg border px-3 py-6 text-center text-sm text-muted-foreground">No bookings yet.</p>
              ) : (
                <Table className="text-sm" containerProps={{ role: "region", "aria-label": "Recent bookings" }}>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Booking ID</TableHead>
                      <TableHead>Equipment</TableHead>
                      <TableHead>Slot</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Charge</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <UserBookingRows rows={shown.bookings.recent} />
                  </TableBody>
                </Table>
              )}
            </section>

            {shown.linked_wallet ? <WalletLinkedBookings ownerId={shown.linked_wallet.owner_id} /> : null}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
