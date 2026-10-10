import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { FileText, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DisruptionCategoryChips } from "./DisruptionCategoryChips";
import { EMPTY_PROCUREMENT_DRAFT, ProcurementItemsFields } from "./ProcurementItemsFields";
import { MaintenanceFields } from "./MaintenanceFields";
import {
  DISRUPTION_REASON_CATEGORIES,
  DISRUPTION_TYPE_LABELS,
  EMPTY_MAINTENANCE_DRAFT,
  RECOVERY_UNKNOWN_TEXT,
  SERVICE_REPORT_ACCEPT,
  SERVICE_REPORT_MAX_MB,
  procurementRequestBody,
  serviceReportFileError,
  toDateTimeLocal,
  type DisruptionDialogValues,
  type DisruptionType,
  type MaintenanceDraft,
  type ProcurementOptions,
  type ProcurementRequestDraft,
} from "@/lib/disruptions";

export type DisruptionPromptMode = "disrupt" | "resume";

export interface DisruptionSummaryItem {
  label: string;
  value: ReactNode;
}

export interface DisruptionPromptDialogProps {
  open: boolean;
  mode: DisruptionPromptMode;
  /** Required for "disrupt" mode: drives the reason categories. */
  disruptionType?: DisruptionType | null;
  title: string;
  description?: ReactNode;
  summary?: DisruptionSummaryItem[];
  /** Extra notice under the summary (for example bookings that will be cancelled). */
  notice?: ReactNode;
  /** Resume mode: allow attaching a service report (roles that can open the Disruption history). */
  canAttachReport?: boolean;
  /** Disrupt mode: ask for the expected recovery (shown to users on the equipment page and slots). */
  askRecovery?: boolean;
  /** Resume mode: offer a Procurement & Assets request for items the service person recommended. */
  procurement?: ProcurementOptions | null;
  busy?: boolean;
  onCancel: () => void;
  /** `skipped` is true when the user chose "Skip reason" / "Skip for now"; values are then empty. */
  onSubmit: (values: DisruptionDialogValues, skipped: boolean) => void;
}

const EMPTY: DisruptionDialogValues = { reason: "", reasonCategory: "", actionTaken: "", serviceReport: null };

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Asks for an optional reason when equipment or slots are disrupted, and for an optional action taken
 * (plus service report) when they are made available / operational again. Everything is optional:
 * "Skip" applies the change without details, which can be added later from Disruption history.
 */
export function DisruptionPromptDialog({
  open,
  mode,
  disruptionType,
  title,
  description,
  summary,
  notice,
  canAttachReport = false,
  askRecovery = false,
  procurement = null,
  busy = false,
  onCancel,
  onSubmit,
}: DisruptionPromptDialogProps) {
  const [values, setValues] = useState<DisruptionDialogValues>(EMPTY);
  const [fileError, setFileError] = useState<string | null>(null);
  const [wantsProcurement, setWantsProcurement] = useState(false);
  const [procurementDraft, setProcurementDraft] = useState<ProcurementRequestDraft>(EMPTY_PROCUREMENT_DRAFT);
  const [wantsMaintenance, setWantsMaintenance] = useState(false);
  const [maintenanceDraft, setMaintenanceDraft] = useState<MaintenanceDraft>(EMPTY_MAINTENANCE_DRAFT);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const baseId = useId();

  useEffect(() => {
    if (open) {
      setValues(EMPTY);
      setFileError(null);
      setWantsProcurement(false);
      setProcurementDraft(EMPTY_PROCUREMENT_DRAFT);
      setWantsMaintenance(false);
      setMaintenanceDraft(EMPTY_MAINTENANCE_DRAFT);
    }
  }, [open]);

  const categories = mode === "disrupt" && disruptionType ? DISRUPTION_REASON_CATEGORIES[disruptionType] : [];
  const isResume = mode === "resume";
  const showRecovery = !isResume && askRecovery;
  const showProcurement = isResume && Boolean(procurement?.available) && (procurement?.categories.length ?? 0) > 0;
  const showMaintenance = isResume && Boolean(procurement?.can_record_maintenance);
  const procurementIncomplete = showProcurement && wantsProcurement && procurementRequestBody(procurementDraft) === null;
  const hasInput = isResume
    ? Boolean(
        values.actionTaken.trim() ||
          values.serviceReport ||
          (showProcurement && wantsProcurement) ||
          (showMaintenance && wantsMaintenance)
      )
    : Boolean(values.reason.trim() || values.reasonCategory || (showRecovery && values.expectedRecovery));
  const textLabel = isResume ? "Action taken / resolution" : "Reason";
  const textPlaceholder = isResume
    ? "For example: detector replaced by the service engineer, calibration verified."
    : disruptionType === "OPERATOR_ABSENT"
      ? "For example: operator on medical leave; no substitute available."
      : disruptionType === "SCHEDULED_MAINTENANCE"
        ? "For example: half-yearly preventive maintenance by the vendor."
        : "Briefly describe what happened.";

  const submit = (skipped: boolean) => {
    if (busy) return;
    if (skipped) {
      onSubmit(EMPTY, true);
      return;
    }
    if (fileError || procurementIncomplete) return;
    const out: DisruptionDialogValues = { ...values, reason: values.reason.trim(), actionTaken: values.actionTaken.trim() };
    if (showRecovery) out.expectedRecovery = values.expectedRecovery ?? "";
    else delete out.expectedRecovery;
    if (showProcurement) out.procurement = wantsProcurement ? procurementDraft : null;
    if (showMaintenance) out.maintenance = wantsMaintenance ? maintenanceDraft : null;
    onSubmit(out, false);
  };

  const pickFile = (file: File | null) => {
    const error = serviceReportFileError(file);
    setFileError(error);
    setValues((v) => ({ ...v, serviceReport: error ? null : file }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onCancel()}>
      <DialogContent
        className="max-h-[92vh] max-w-xl overflow-y-auto"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          textRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ??
              (isResume
                ? "Record what was done to resolve the disruption. This is optional and can be added later from Disruption history."
                : "Record why this is happening. This is optional and can be added later from Disruption history.")}
          </DialogDescription>
        </DialogHeader>

        {summary && summary.length > 0 && (
          <dl
            className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-md border border-border bg-muted/40 px-3 py-2.5 text-sm"
            aria-label="Summary of the change"
          >
            {summary.map((item) => (
              <div key={item.label} className="contents">
                <dt className="text-muted-foreground">{item.label}</dt>
                <dd className="min-w-0 break-words font-medium text-foreground">{item.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {notice && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
            {notice}
          </div>
        )}

        <DisruptionCategoryChips
          options={categories}
          value={values.reasonCategory}
          onChange={(reasonCategory) => setValues((v) => ({ ...v, reasonCategory }))}
        />

        <div className="space-y-1.5">
          <Label htmlFor={`${baseId}-text`}>
            {textLabel} <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id={`${baseId}-text`}
            ref={textRef}
            rows={3}
            maxLength={2000}
            placeholder={textPlaceholder}
            value={isResume ? values.actionTaken : values.reason}
            onChange={(e) =>
              setValues((v) => (isResume ? { ...v, actionTaken: e.target.value } : { ...v, reason: e.target.value }))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                submit(false);
              }
            }}
          />
        </div>

        {showRecovery && (
          <div className="space-y-1.5">
            <Label htmlFor={`${baseId}-recovery`}>
              Expected recovery <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id={`${baseId}-recovery`}
                type="datetime-local"
                className="h-9 w-auto"
                min={toDateTimeLocal(new Date().toISOString())}
                value={values.expectedRecovery ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, expectedRecovery: e.target.value }))}
              />
              {values.expectedRecovery ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setValues((v) => ({ ...v, expectedRecovery: "" }))}
                >
                  Not known
                </Button>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Shown to users on the equipment page and slots. Leave empty if not known: users see “{RECOVERY_UNKNOWN_TEXT}”.
              You can change it later from Disruption history.
            </p>
          </div>
        )}

        {isResume && canAttachReport && (
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">
              Service report <span className="font-normal text-muted-foreground">(optional)</span>
            </p>
            <input
              ref={fileInputRef}
              id={`${baseId}-file`}
              type="file"
              accept={SERVICE_REPORT_ACCEPT}
              className="sr-only"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            {values.serviceReport ? (
              <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{values.serviceReport.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatSize(values.serviceReport.size)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Remove service report"
                  onClick={() => setValues((v) => ({ ...v, serviceReport: null }))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Paperclip className="mr-2 h-4 w-4" aria-hidden />
                Attach service report
              </Button>
            )}
            <p className="text-xs text-muted-foreground">PDF, JPG, PNG, WebP or Word, up to {SERVICE_REPORT_MAX_MB} MB.</p>
            {fileError && (
              <p role="alert" className="text-xs text-destructive">
                {fileError}
              </p>
            )}
          </div>
        )}

        {showMaintenance && procurement && (
          <div className="space-y-2 rounded-md border border-border p-3">
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={wantsMaintenance}
                onCheckedChange={(c) => setWantsMaintenance(c === true)}
              />
              <span>
                <span className="font-medium">Record in maintenance history</span>
                <span className="block text-xs text-muted-foreground">
                  Downtime, cause and action taken are copied from this disruption. Parts used from stock can be added
                  later under Procurement &amp; Assets → Maintenance.
                </span>
              </span>
            </label>
            {wantsMaintenance && (
              <MaintenanceFields
                kinds={procurement.maintenance_kinds ?? []}
                value={maintenanceDraft}
                onChange={setMaintenanceDraft}
              />
            )}
          </div>
        )}

        {showProcurement && procurement && (
          <div className="space-y-2 rounded-md border border-border p-3">
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={wantsProcurement}
                onCheckedChange={(c) => setWantsProcurement(c === true)}
              />
              <span>
                <span className="font-medium">Service person recommended items?</span>
                <span className="block text-xs text-muted-foreground">
                  Raise a Procurement &amp; Assets requirement for consumables, spares, assets, repair or AMC. It is
                  linked to this equipment and goes through the usual approval, with the service report attached.
                </span>
              </span>
            </label>
            {wantsProcurement && (
              <>
                <ProcurementItemsFields
                  categories={procurement.categories}
                  value={procurementDraft}
                  onChange={setProcurementDraft}
                  equipmentId={procurement.inventory_suggestions ? procurement.equipment_id : null}
                />
                {procurementIncomplete && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">Choose a request type and name at least one item.</p>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" variant="outline" onClick={() => submit(true)} disabled={busy}>
            {isResume ? "Skip for now" : "Skip reason"}
          </Button>
          <Button type="button" onClick={() => submit(false)} disabled={busy || !hasInput || procurementIncomplete}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function disruptionDialogTitle(mode: DisruptionPromptMode, type?: DisruptionType | null): string {
  if (mode === "resume") return "Record action taken";
  return type ? `Reason for ${DISRUPTION_TYPE_LABELS[type]}` : "Record a reason";
}
