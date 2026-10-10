import { useCallback, useEffect, useState } from "react";
import { Ban, Loader2, Paperclip, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  facilityGroupsApi,
  formatBytes,
  isActiveCampaign,
  type Campaign,
  type CampaignDetail,
  type CampaignStatus,
  type RecipientStatus,
} from "@/lib/facilityGroupsApi";
import { formatDateTime, plural } from "./format";

const POLL_MS = 5000;

const STATUS_VARIANT: Record<CampaignStatus, "default" | "secondary" | "destructive" | "outline"> = {
  queued: "outline",
  sending: "secondary",
  sent: "default",
  partial: "destructive",
  failed: "destructive",
  cancelled: "outline",
};

const RECIPIENT_STATUS_LABEL: Record<RecipientStatus, string> = {
  pending: "Waiting",
  sending: "Sending",
  sent: "Sent",
  failed: "Failed",
  skipped: "Skipped",
};

function StatusBadge({ campaign }: { campaign: Pick<Campaign, "status" | "status_label"> }) {
  return (
    <Badge variant={STATUS_VARIANT[campaign.status]} className="whitespace-nowrap">
      {isActiveCampaign(campaign.status) ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
      {campaign.status_label}
    </Badge>
  );
}

export function SentEmails({ focusId, onFocusHandled }: { focusId: number | null; onFocusHandled: () => void }) {
  const [rows, setRows] = useState<Campaign[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [status, setStatus] = useState<CampaignStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const res = await facilityGroupsApi.campaigns({ page, status });
        setRows(res.results);
        setCount(res.count);
        setPageSize(res.page_size);
        setError("");
      } catch (err) {
        setError((err as Error).message || "Could not load sent emails.");
      } finally {
        setLoading(false);
      }
    },
    [page, status],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const anyActive = rows.some((r) => isActiveCampaign(r.status));
  useEffect(() => {
    if (!anyActive) return;
    const t = setInterval(() => void load(true), POLL_MS);
    return () => clearInterval(t);
  }, [anyActive, load]);

  useEffect(() => {
    if (focusId == null) return;
    setOpenId(focusId);
    onFocusHandled();
  }, [focusId, onFocusHandled]);

  const pages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={status || "all"}
          onValueChange={(v) => {
            setPage(1);
            setStatus(v === "all" ? "" : (v as CampaignStatus));
          }}
        >
          <SelectTrigger className="w-44" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="sending">Sending</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="partial">Partly sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        <span className="text-sm text-muted-foreground">{plural(count, "email")}</span>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Table stackOnMobile>
        <TableHeader>
          <TableRow>
            <TableHead className="text-left">Subject</TableHead>
            <TableHead>Groups</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Sent / total</TableHead>
            <TableHead>Failed</TableHead>
            <TableHead>Sent by</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => (
            <TableRow key={c.id} className="cursor-pointer" onClick={() => setOpenId(c.id)}>
              <TableCell className="text-left font-medium" data-label="Subject">
                <button type="button" className="text-left hover:underline" onClick={() => setOpenId(c.id)}>
                  {c.subject}
                </button>
              </TableCell>
              <TableCell className="max-w-[16rem] text-xs" data-label="Groups">
                {c.group_names.join(", ")}
              </TableCell>
              <TableCell data-label="Status">
                <StatusBadge campaign={c} />
              </TableCell>
              <TableCell className="tabular-nums" data-label="Sent / total">
                {c.sent_count.toLocaleString()} / {c.total_recipients.toLocaleString()}
              </TableCell>
              <TableCell className="tabular-nums" data-label="Failed">
                {c.failed_count ? <span className="text-destructive">{c.failed_count}</span> : "0"}
              </TableCell>
              <TableCell className="text-sm" data-label="Sent by">
                {c.created_by || "—"}
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm" data-label="Created">
                {formatDateTime(c.created_at)}
              </TableCell>
            </TableRow>
          ))}
          {!rows.length && !loading ? (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-muted-foreground">
                No group emails yet.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      {pages > 1 ? (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span>
            Page {page} of {pages}
          </span>
          <Button type="button" size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      ) : null}

      <CampaignDialog id={openId} onClose={() => setOpenId(null)} onChanged={() => void load(true)} />
    </div>
  );
}

function CampaignDialog({ id, onClose, onChanged }: { id: number | null; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<CampaignDetail | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<RecipientStatus | "">("");
  const [busy, setBusy] = useState<"" | "resume" | "retry" | "cancel">("");
  const [error, setError] = useState("");

  useEffect(() => {
    setData(null);
    setPage(1);
    setStatus("");
    setError("");
  }, [id]);

  const load = useCallback(async () => {
    if (id == null) return;
    try {
      setData(await facilityGroupsApi.campaign(id, { page, status }));
      setError("");
    } catch (err) {
      setError((err as Error).message || "Could not load this email.");
    }
  }, [id, page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const active = data ? isActiveCampaign(data.status) : false;
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(t);
  }, [active, load]);

  const act = async (kind: "resume" | "retry" | "cancel") => {
    if (id == null) return;
    setBusy(kind);
    try {
      if (kind === "cancel") {
        await facilityGroupsApi.cancel(id);
        toast.success("Cancelled. Emails already sent are not affected.");
      } else {
        await facilityGroupsApi.resume(id, kind === "retry");
        toast.success(kind === "retry" ? "Retrying the failed emails." : "Sending resumed.");
      }
      await load();
      onChanged();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy("");
    }
  };

  const counts = data?.status_counts;
  const pending = (counts?.pending ?? 0) + (counts?.sending ?? 0);
  const recipientPages = data ? Math.max(1, Math.ceil(data.recipients.count / data.recipients.page_size)) : 1;

  return (
    <Dialog open={id != null} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{data?.subject ?? "Group email"}</DialogTitle>
          <DialogDescription>
            {data ? `${data.group_names.join(", ")} · sent by ${data.created_by || "—"} · ${formatDateTime(data.created_at)}` : "Loading…"}
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {!data ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge campaign={data} />
              <span className="text-sm">
                {data.sent_count.toLocaleString()} sent · {data.failed_count.toLocaleString()} failed · {pending.toLocaleString()} waiting
                {data.skipped_count ? ` · ${data.skipped_count} skipped` : ""} of {data.total_recipients.toLocaleString()}
              </span>
              <div className="ml-auto flex flex-wrap gap-2">
                {!active && data.status !== "cancelled" && (counts?.pending ?? 0) > 0 ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => void act("resume")} disabled={busy !== ""}>
                    {busy === "resume" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-1.5 h-4 w-4" />}
                    Resume
                  </Button>
                ) : null}
                {data.failed_count > 0 && !active && data.status !== "cancelled" ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => void act("retry")} disabled={busy !== ""}>
                    {busy === "retry" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-1.5 h-4 w-4" />}
                    Retry failed
                  </Button>
                ) : null}
                {active ? (
                  <Button type="button" size="sm" variant="destructive" onClick={() => void act("cancel")} disabled={busy !== ""}>
                    {busy === "cancel" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Ban className="mr-1.5 h-4 w-4" />}
                    Cancel remaining
                  </Button>
                ) : null}
              </div>
            </div>

            <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1 text-sm">
              {data.cc.length ? (
                <>
                  <dt className="text-muted-foreground">CC</dt>
                  <dd>{data.cc.join(", ")}</dd>
                </>
              ) : null}
              {data.bcc.length ? (
                <>
                  <dt className="text-muted-foreground">BCC</dt>
                  <dd>{data.bcc.join(", ")}</dd>
                </>
              ) : null}
              {data.cc.length || data.bcc.length ? (
                <>
                  <dt className="text-muted-foreground">CC / BCC got</dt>
                  <dd>
                    {data.cc_mode === "summary"
                      ? data.summary_sent_at
                        ? `One summary copy (${formatDateTime(data.summary_sent_at)})`
                        : "One summary copy (not sent yet)"
                      : "A copy of every email"}
                  </dd>
                </>
              ) : null}
              {data.reply_to ? (
                <>
                  <dt className="text-muted-foreground">Reply-to</dt>
                  <dd>{data.reply_to}</dd>
                </>
              ) : null}
              {data.attachments.length ? (
                <>
                  <dt className="text-muted-foreground">Attachments</dt>
                  <dd className="flex flex-wrap gap-2">
                    {data.attachments.map((a) => (
                      <span key={a.id} className="inline-flex items-center gap-1">
                        <Paperclip className="h-3.5 w-3.5" />
                        {a.filename} <span className="text-xs text-muted-foreground">({formatBytes(a.size)})</span>
                      </span>
                    ))}
                  </dd>
                </>
              ) : null}
              {data.last_error ? (
                <>
                  <dt className="text-muted-foreground">Last error</dt>
                  <dd className="text-destructive">{data.last_error}</dd>
                </>
              ) : null}
            </dl>

            <details className="rounded-md border p-3">
              <summary className="cursor-pointer text-sm font-medium">Message</summary>
              <iframe
                title="Message"
                sandbox=""
                srcDoc={data.body_html}
                className="mt-2 h-72 w-full rounded border bg-white"
              />
            </details>

            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={status || "all"}
                onValueChange={(v) => {
                  setPage(1);
                  setStatus(v === "all" ? "" : (v as RecipientStatus));
                }}
              >
                <SelectTrigger className="w-44" aria-label="Recipient status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All recipients</SelectItem>
                  {(Object.keys(RECIPIENT_STATUS_LABEL) as RecipientStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {RECIPIENT_STATUS_LABEL[s]} ({counts?.[s] ?? 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Table stackOnMobile>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left">Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Department / Organisation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recipients.results.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-left" data-label="Name">
                      {r.name || "—"}
                    </TableCell>
                    <TableCell className="text-sm" data-label="Email">
                      {r.email}
                    </TableCell>
                    <TableCell className="text-sm" data-label="Department / Organisation">
                      {r.department_name || "—"}
                    </TableCell>
                    <TableCell data-label="Status">
                      <Badge variant={r.status === "failed" ? "destructive" : r.status === "sent" ? "default" : "outline"}>
                        {RECIPIENT_STATUS_LABEL[r.status]}
                      </Badge>
                      {r.error ? <div className="mt-1 max-w-[18rem] text-xs text-destructive">{r.error}</div> : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm" data-label="Sent">
                      {formatDateTime(r.sent_at)}
                    </TableCell>
                  </TableRow>
                ))}
                {!data.recipients.results.length ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-muted-foreground">
                      No recipients with this status.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
            {recipientPages > 1 ? (
              <div className="flex items-center justify-end gap-2 text-sm">
                <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <span>
                  Page {page} of {recipientPages}
                </span>
                <Button type="button" size="sm" variant="outline" disabled={page >= recipientPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
