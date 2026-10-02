import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Loader2, Lock, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { BackButton } from "@/components/BackButton";
import { PageHero, PageShell, heroButtonClass } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useEmbeddedMode } from "@/contexts/EmbeddedModeContext";
import type { TrainingResult } from "@/lib/trainingApi";
import type { ReservationConflict } from "@/lib/trainingTypes";
import { cn } from "@/lib/utils";
import { formatWindow, statusMeta, toneClass, type StatusKind } from "./trainingHelpers";

/** Runs a training API call; shows the server `detail` on failure and `success` on success. */
export async function runTrainingAction<T>(
  call: Promise<TrainingResult<T>>,
  success?: string,
): Promise<TrainingResult<T>> {
  const res = await call;
  if (res.error) toast.error(res.error);
  else if (success) toast.success(success);
  return res;
}

export function StatusChip({
  kind,
  status,
  label,
  className,
}: {
  kind: StatusKind;
  status: string | null | undefined;
  label?: string | null;
  className?: string;
}) {
  const meta = statusMeta(kind, status, label);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium",
        toneClass(meta.tone),
        className,
      )}
    >
      {meta.label}
    </span>
  );
}

export function TrainingPageFrame({
  title,
  description,
  icon,
  onRefresh,
  refreshing = false,
  actions,
  children,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Rendered in the hero (onHero = true) or in a toolbar when the page is embedded in the dashboard. */
  actions?: (onHero: boolean) => ReactNode;
  children: ReactNode;
}) {
  const embedded = useEmbeddedMode();
  const refreshButton = (onHero: boolean) =>
    onRefresh ? (
      <Button
        type="button"
        variant={onHero ? "ghost" : "outline"}
        size="icon"
        onClick={onRefresh}
        disabled={refreshing}
        aria-label="Refresh"
        title="Refresh"
        className={cn("h-9 w-9", onHero && heroButtonClass.icon)}
      >
        <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} aria-hidden />
      </Button>
    ) : null;

  return (
    <PageShell>
      <main className="container mx-auto space-y-4 px-4 py-5">
        {embedded ? (
          actions || onRefresh ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {actions?.(false)}
              {refreshButton(false)}
            </div>
          ) : null
        ) : (
          <PageHero
            compact
            title={title}
            description={description}
            icon={icon}
            actions={
              <>
                <BackButton className={heroButtonClass.secondary} />
                {actions?.(true)}
                {refreshButton(true)}
              </>
            }
          />
        )}
        {children}
      </main>
    </PageShell>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 bg-muted/20 px-6 py-10 text-center",
        className,
      )}
    >
      {icon ? <div className="text-muted-foreground/70">{icon}</div> : null}
      <p className="font-medium text-foreground">{title}</p>
      {description ? <p className="max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action}
    </div>
  );
}

export function ModuleUnavailable({ message }: { message?: string }) {
  return (
    <EmptyState
      icon={<Lock className="h-8 w-8" />}
      title="Training & Certification is not available"
      description={message ?? "This section is not enabled for your account right now."}
    />
  );
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  icon,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm", className)}>
      {title || actions ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon ? <span className="text-primary dark:text-sky-300">{icon}</span> : null}
            <div className="min-w-0">
              {title ? <h2 className="text-sm font-semibold text-foreground sm:text-base">{title}</h2> : null}
              {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
            </div>
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

export function ConflictList({ conflicts }: { conflicts: ReservationConflict[] }) {
  if (!conflicts.length) return null;
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
      <p className="mb-1.5 flex items-center gap-1.5 font-medium">
        <AlertTriangle className="h-4 w-4" aria-hidden /> Instrument slots already taken
      </p>
      <ul className="space-y-1">
        {conflicts.map((c) => (
          <li key={c.slot_id} className="flex flex-wrap gap-x-2 text-xs">
            <span className="font-medium">{c.label || (c.booked ? "Booked by a user" : `Slot #${c.slot_id}`)}</span>
            {c.start && c.end ? <span>{formatWindow(c.start, c.end)}</span> : null}
            {c.status ? <span className="text-amber-800/80 dark:text-amber-200/80">({c.status})</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Dialog asking for a reason/note; `onConfirm` returns true to close. */
export function PromptDialog({
  open,
  onOpenChange,
  title,
  description,
  label = "Reason",
  placeholder,
  confirmLabel = "Confirm",
  destructive = false,
  required = true,
  minLength = 0,
  acknowledgement,
  children,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  label?: string;
  placeholder?: string;
  confirmLabel?: string;
  destructive?: boolean;
  required?: boolean;
  minLength?: number;
  /** When set, a checkbox that must be ticked before confirming. */
  acknowledgement?: string;
  children?: ReactNode;
  onConfirm: (text: string) => Promise<boolean> | boolean;
}) {
  const [text, setText] = useState("");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setText("");
      setAck(false);
    }
  }, [open]);

  const trimmed = text.trim();
  const tooShort = required
    ? trimmed.length < Math.max(minLength, 1)
    : trimmed.length > 0 && trimmed.length < minLength;
  const blocked = tooShort || (Boolean(acknowledgement) && !ack);

  const submit = async () => {
    if (blocked || busy) return;
    setBusy(true);
    try {
      if (await onConfirm(trimmed)) onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
        {label ? (
          <div className="space-y-1.5">
            <Label htmlFor="training-prompt-text">
              {label}
              {required ? <span className="text-destructive"> *</span> : <span className="text-muted-foreground"> (optional)</span>}
            </Label>
            <Textarea
              id="training-prompt-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={placeholder}
              rows={4}
            />
            {minLength > 0 ? (
              <p className={cn("text-xs", trimmed.length >= minLength ? "text-muted-foreground" : "text-amber-700 dark:text-amber-300")}>
                {trimmed.length}/{minLength} characters minimum
              </p>
            ) : null}
          </div>
        ) : null}
        {acknowledgement ? (
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} className="mt-0.5" />
            <span>{acknowledgement}</span>
          </label>
        ) : null}
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Close
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            onClick={() => void submit()}
            disabled={blocked || busy}
          >
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CountTile({
  label,
  value,
  highlight = false,
  onClick,
}: {
  label: string;
  value: number | null | undefined;
  highlight?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className={cn("text-xl font-semibold tabular-nums", highlight && value ? "text-amber-700 dark:text-amber-300" : "text-foreground")}>
        {value ?? "—"}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </>
  );
  const className = "flex flex-col items-start gap-0.5 rounded-lg border border-border/70 bg-card px-3 py-2 text-left shadow-sm";
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(className, "transition-colors hover:border-primary/40 hover:bg-muted/40")}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}
