import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftRight, Check, Clock, Loader2, Mail, Phone, X } from "lucide-react";
import { toast } from "sonner";
import { apiClient, type SlotExchangeRequestRow, type SlotExchangeStatus } from "@/lib/api";
import { wallDateTimeLabel } from "@/lib/slotWallClock";
import { PageHero, PageShell, StandaloneOnly, heroButtonClass } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const STATUS_STYLE: Record<SlotExchangeStatus, string> = {
  PENDING: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  ACCEPTED: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
  DECLINED: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
  CANCELLED: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
  EXPIRED: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
  FAILED: "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-100",
};

function SlotList({ title, slots }: { title: string; slots: SlotExchangeRequestRow["you_give"] }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="mt-1 space-y-0.5 text-sm">
        {slots.map((s) => (
          <li key={s.id}>{s.label}</li>
        ))}
      </ul>
    </div>
  );
}

function ExchangeCard({ row, onChanged }: { row: SlotExchangeRequestRow; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  const act = async (action: "accept" | "decline" | "cancel") => {
    setBusy(action);
    const res = await apiClient.respondSlotExchange(row.id, action, action === "decline" ? note.trim() : undefined);
    setBusy(null);
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success(
        action === "accept"
          ? "Slots exchanged. Your booking now has the new slots."
          : action === "decline"
            ? "Request declined."
            : "Request withdrawn."
      );
    }
    onChanged();
  };
  const other = row.other_user;
  return (
    <Card className="border shadow-sm">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold">
              {row.direction === "incoming" ? `${other.name} asks to exchange` : `You asked ${other.name}`}
            </p>
            <p className="text-xs text-muted-foreground">
              {row.equipment_name} · {row.requester_booking_ref} ↔ {row.responder_booking_ref}
            </p>
          </div>
          <Badge className={STATUS_STYLE[row.status]} variant="secondary">
            {row.status_display}
          </Badge>
        </div>

        <div className="grid gap-3 rounded-md bg-muted/40 p-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <SlotList title="You give" slots={row.you_give} />
          <ArrowLeftRight className="mx-auto h-4 w-4 text-muted-foreground" aria-hidden />
          <SlotList title="You get" slots={row.you_get} />
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {other.department ? <span>{other.department}</span> : null}
          {other.email ? (
            <a className="inline-flex items-center gap-1 hover:underline" href={`mailto:${other.email}`}>
              <Mail className="h-3 w-3" aria-hidden />
              {other.email}
            </a>
          ) : null}
          {other.phone ? (
            <a className="inline-flex items-center gap-1 hover:underline" href={`tel:${other.phone}`}>
              <Phone className="h-3 w-3" aria-hidden />
              {other.phone}
            </a>
          ) : null}
          {row.status === "PENDING" && row.expires_at ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden />
              Respond by {wallDateTimeLabel(row.expires_at)}
            </span>
          ) : null}
        </div>

        {row.message ? <p className="rounded-md border-l-2 border-primary/50 pl-3 text-sm">“{row.message}”</p> : null}
        {row.response_note ? <p className="text-sm text-muted-foreground">Reply: {row.response_note}</p> : null}
        {row.failure_reason ? <p className="text-sm text-destructive">{row.failure_reason}</p> : null}

        {row.can_respond && (
          <div className="space-y-2">
            {declining && (
              <Textarea
                value={note}
                maxLength={500}
                rows={2}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note to the requester"
                aria-label="Note to the requester"
              />
            )}
            <div className="flex flex-wrap justify-end gap-2">
              {declining ? (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setDeclining(false)} disabled={busy != null}>
                    Back
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => act("decline")} disabled={busy != null}>
                    {busy === "decline" ? "Declining…" : "Decline request"}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => setDeclining(true)} disabled={busy != null}>
                    <X className="mr-1 h-4 w-4" aria-hidden />
                    Decline
                  </Button>
                  <Button size="sm" onClick={() => act("accept")} disabled={busy != null}>
                    <Check className="mr-1 h-4 w-4" aria-hidden />
                    {busy === "accept" ? "Exchanging…" : "Accept exchange"}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
        {row.can_cancel && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => act("cancel")} disabled={busy != null}>
              {busy === "cancel" ? "Withdrawing…" : "Withdraw request"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Slot Exchange requests the signed-in internal user has sent or received. */
export default function SlotExchanges() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<SlotExchangeRequestRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiClient.getSlotExchanges();
    if (res.error || !res.data) {
      setError(res.error || "Could not load slot exchanges.");
      return;
    }
    setError(null);
    setRows(res.data.results);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const incoming = (rows ?? []).filter((r) => r.direction === "incoming");
  const outgoing = (rows ?? []).filter((r) => r.direction === "outgoing");
  const pendingIncoming = incoming.filter((r) => r.can_respond).length;

  const list = (items: SlotExchangeRequestRow[], empty: string) =>
    items.length === 0 ? (
      <p className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">{empty}</p>
    ) : (
      <div className="space-y-3">
        {items.map((r) => (
          <ExchangeCard key={r.id} row={r} onChanged={() => void load()} />
        ))}
      </div>
    );

  return (
    <PageShell>
      <main className="container mx-auto max-w-3xl space-y-5 px-4 py-5">
        <StandaloneOnly>
          <PageHero
            compact
            title="Slot exchanges"
            description="Swap booked slots of the same charge with another internal user. Open a booked slot on an equipment calendar to send a request; both of you must agree, up to 5 minutes before the slots start."
            icon={<ArrowLeftRight className="h-5 w-5" />}
            actions={
              <Button variant="outline" size="sm" className={heroButtonClass.secondary} onClick={() => navigate("/my-bookings")}>
                My Bookings
              </Button>
            }
          />
        </StandaloneOnly>

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : rows == null ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue={pendingIncoming > 0 || outgoing.length === 0 ? "incoming" : "outgoing"}>
            <TabsList>
              <TabsTrigger value="incoming">
                Received{pendingIncoming > 0 ? ` (${pendingIncoming})` : ""}
              </TabsTrigger>
              <TabsTrigger value="outgoing">Sent</TabsTrigger>
            </TabsList>
            <TabsContent value="incoming" className="mt-4">
              {list(incoming, "No one has asked to exchange slots with you.")}
            </TabsContent>
            <TabsContent value="outgoing" className="mt-4">
              {list(outgoing, "You haven't sent any exchange requests.")}
            </TabsContent>
          </Tabs>
        )}
      </main>
    </PageShell>
  );
}
