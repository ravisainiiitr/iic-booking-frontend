import { useCallback, useEffect, useState } from "react";
import { Copy, Download, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trainingApi } from "@/lib/trainingApi";
import type { CertificationAction, CertificationDetail } from "@/lib/trainingOpsTypes";
import { absoluteUrl } from "./dutyHelpers";
import { formatDate, formatDateTime, humanizeCode } from "./trainingHelpers";
import { DetailRow, LoadingBlock, PromptDialog, StatusChip, runTrainingAction } from "./trainingUi";

const ACTIONS: Array<{ action: CertificationAction; label: string; done: string; when: string[]; destructive?: boolean; help: string }> = [
  { action: "renew", label: "Renew", done: "Certificate renewed", when: ["ACTIVE", "DORMANT", "EXPIRED"], help: "Extends validity from today (or the current end date if later)." },
  { action: "reinstate", label: "Reinstate", done: "Certificate reinstated", when: ["SUSPENDED", "DORMANT"], help: "Back to active, e.g. after a refresher." },
  { action: "suspend", label: "Suspend", done: "Certificate suspended", when: ["ACTIVE", "DORMANT"], destructive: true, help: "Stops independent use and operator duty until reinstated." },
  { action: "revoke", label: "Revoke", done: "Certificate revoked", when: ["ACTIVE", "DORMANT", "SUSPENDED", "EXPIRED"], destructive: true, help: "Permanently withdraws the certificate. A new assessment is needed." },
];

const HISTORY_LABELS: Record<string, string> = {
  "award.issued": "Issued",
  "award.superseded": "Superseded by a higher level",
  "award.suspend": "Suspended",
  "award.reinstate": "Reinstated",
  "award.revoke": "Revoked",
  "award.renew": "Renewed",
  "award.expired": "Expired",
  "award.expiry_reminded": "Expiry reminder sent",
  "award.dormant": "Marked dormant (unused)",
};

export function CertificateDialog({
  awardId,
  open,
  onOpenChange,
  onChanged,
}: {
  awardId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}) {
  const [detail, setDetail] = useState<CertificationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [pending, setPending] = useState<CertificationAction | null>(null);
  const [months, setMonths] = useState("");

  const load = useCallback(async () => {
    if (!awardId) return;
    setLoading(true);
    const res = await trainingApi.certification(awardId);
    setLoading(false);
    if (res.error) toast.error(res.error);
    else setDetail(res.data ?? null);
  }, [awardId]);

  useEffect(() => {
    if (open) void load();
    else setDetail(null);
  }, [open, load]);

  const verifyUrl = detail?.verify_path ? absoluteUrl(detail.verify_path) : "";
  const action = ACTIONS.find((a) => a.action === pending);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden /> Certificate
          </DialogTitle>
          <DialogDescription>Status, validity, verification and history of this certification.</DialogDescription>
        </DialogHeader>
        {loading && !detail ? (
          <LoadingBlock />
        ) : detail ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 p-3">
              <div>
                <p className="text-lg font-semibold">{detail.user?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {detail.level_name} · {detail.equipment?.name} ({detail.equipment?.code})
                </p>
              </div>
              <StatusChip kind="award" status={detail.status} label={detail.status_label} />
            </div>
            <dl className="grid gap-3 sm:grid-cols-3">
              <DetailRow label="Certificate no.">{detail.certificate_no || "—"}</DetailRow>
              <DetailRow label="Awarded">{formatDate(detail.awarded_at)}</DetailRow>
              <DetailRow label="Valid until">{detail.valid_until ? formatDate(detail.valid_until) : "No expiry"}</DetailRow>
              <DetailRow label="Last used">{detail.last_used_at ? formatDate(detail.last_used_at) : "—"}</DetailRow>
              {detail.suspend_reason && detail.status === "SUSPENDED" ? (
                <DetailRow label="Suspended because">{detail.suspend_reason}</DetailRow>
              ) : null}
              {detail.revoke_reason && detail.status === "REVOKED" ? <DetailRow label="Revoked because">{detail.revoke_reason}</DetailRow> : null}
            </dl>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={async () => {
                  setDownloading(true);
                  const res = await trainingApi.downloadCertificate(detail.id, detail.certificate_no);
                  setDownloading(false);
                  if (res.error) toast.error(res.error);
                }}
                disabled={downloading}
              >
                {downloading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
                Download certificate (PDF)
              </Button>
              {verifyUrl ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard?.writeText(verifyUrl).then(
                        () => toast.success("Verification link copied"),
                        () => toast.error("Could not copy the link"),
                      );
                    }}
                  >
                    <Copy className="mr-1.5 h-4 w-4" /> Copy verification link
                  </Button>
                  <Button type="button" size="sm" variant="ghost" asChild>
                    <a href={verifyUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-1.5 h-4 w-4" /> Open public check
                    </a>
                  </Button>
                </>
              ) : null}
            </div>

            {detail.can_manage ? (
              <div className="space-y-2 rounded-lg border border-border/70 p-3">
                <p className="text-sm font-medium">OIC actions</p>
                <div className="flex flex-wrap gap-2">
                  {ACTIONS.filter((a) => a.when.includes(detail.status)).map((a) => (
                    <Button
                      key={a.action}
                      type="button"
                      size="sm"
                      variant={a.destructive ? "destructive" : "outline"}
                      onClick={() => {
                        setMonths("");
                        setPending(a.action);
                      }}
                    >
                      {a.label}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            {detail.assessments.length ? (
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Assessment</p>
                {detail.assessments.map((a) => (
                  <div key={a.id} className="rounded-md border border-border/60 p-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusChip kind="assessment" status={a.result} label={a.result_label} />
                      <span className="text-muted-foreground">
                        Theory {a.theory_score_pct ?? "—"}% · Practical {a.practical_score_pct ?? "—"}% · by {a.assessor?.name ?? "—"}
                        {a.signed_off_by ? `, signed off by ${a.signed_off_by.name}` : ""}
                      </span>
                    </div>
                    {a.scope_note ? <p className="mt-1 text-xs text-muted-foreground">Scope: {a.scope_note}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <p className="text-sm font-medium">History</p>
              <ol className="relative space-y-2 border-l border-border/70 pl-4">
                {detail.history.map((h, i) => (
                  <li key={`${h.action}-${i}`} className="text-sm">
                    <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-primary/70" aria-hidden />
                    <p className="font-medium">{HISTORY_LABELS[h.action] ?? humanizeCode(h.action.replace(/^award\./, ""))}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(h.at)}
                      {h.by ? ` · ${h.by.name}` : " · System"}
                      {h.note ? ` · ${h.note}` : ""}
                    </p>
                  </li>
                ))}
                {!detail.history.length ? <li className="text-sm text-muted-foreground">No recorded changes.</li> : null}
              </ol>
            </div>
          </div>
        ) : null}

        <PromptDialog
          open={Boolean(action)}
          onOpenChange={(v) => !v && setPending(null)}
          title={action ? `${action.label} certificate` : ""}
          description={action?.help}
          destructive={action?.destructive}
          confirmLabel={action?.label}
          placeholder="This is recorded in the certificate history and sent to the holder."
          onConfirm={async (reason) => {
            if (!detail || !action) return false;
            const res = await runTrainingAction(
              trainingApi.certificationAction(detail.id, action.action, {
                reason,
                months: action.action === "renew" && months ? Number(months) : undefined,
              }),
              action.done,
            );
            if (res.error) return false;
            await load();
            onChanged?.();
            return true;
          }}
        >
          {action?.action === "renew" ? (
            <div className="space-y-1.5">
              <Label htmlFor="renew-months">Extend by (months)</Label>
              <Input
                id="renew-months"
                type="number"
                min={1}
                max={60}
                value={months}
                onChange={(e) => setMonths(e.target.value)}
                placeholder="Level default"
              />
            </div>
          ) : null}
        </PromptDialog>
      </DialogContent>
    </Dialog>
  );
}
