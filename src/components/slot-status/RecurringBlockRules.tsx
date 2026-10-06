import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarClock, Loader2, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  WEEKDAY_LABELS,
  describeRule,
  formatRuleDate,
  plural,
  presetRange,
  slotBlockRulesApi,
  type RangePreset,
  type RulePlanSummary,
  type SkippedBookedSlot,
  type SkippedOtherSlot,
  type SlotBlockRule,
  type SlotBlockRuleInput,
  type SlotBlockRuleList,
} from "@/lib/slotBlockRulesApi";

interface RecurringBlockRulesProps {
  equipmentId: number | string;
  /** Called after a repeat block is created or removed so the calendar can refetch slots. */
  onChanged?: () => void | Promise<void>;
}

const CHIP_CLASS =
  "h-8 min-w-[3rem] rounded-md border px-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const CHIP_OFF_CLASS = "border-border/60 bg-background text-foreground hover:border-primary/30 hover:bg-primary/10";
const CHIP_ON_CLASS = "border-primary bg-primary text-primary-foreground hover:bg-primary/90";
const SMALL_BUTTON_CLASS = "h-8 whitespace-nowrap px-2.5 text-xs font-medium";

const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: "rest_of_month", label: "Rest of this month" },
  { value: "next_12_months", label: "Next 12 months" },
  { value: "custom", label: "Custom dates" },
];

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

function SkippedBookedTable({ rows, total }: { rows: SkippedBookedSlot[]; total: number }) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-1.5 max-h-56 overflow-auto rounded-md border border-border/60">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-muted/80 text-left">
          <tr>
            <th className="px-2 py-1 font-semibold">Date</th>
            <th className="px-2 py-1 font-semibold">Time</th>
            <th className="px-2 py-1 font-semibold">Booking</th>
            <th className="px-2 py-1 font-semibold">User</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.slot_id} className="border-t border-border/40">
              <td className="px-2 py-1 whitespace-nowrap">
                {r.weekday} {formatRuleDate(r.date)}
              </td>
              <td className="px-2 py-1 whitespace-nowrap tabular-nums">
                {r.start_time}–{r.end_time}
              </td>
              <td className="px-2 py-1 font-mono">{r.booking_reference || "—"}</td>
              <td className="px-2 py-1">{r.user_name || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {total > rows.length && (
        <p className="border-t border-border/40 px-2 py-1 text-xs text-muted-foreground">
          and {total - rows.length} more
        </p>
      )}
    </div>
  );
}

function SkippedOtherTable({ rows, total }: { rows: SkippedOtherSlot[]; total: number }) {
  if (rows.length === 0) return null;
  return (
    <div className="mt-1.5 max-h-56 overflow-auto rounded-md border border-border/60">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-muted/80 text-left">
          <tr>
            <th className="px-2 py-1 font-semibold">Date</th>
            <th className="px-2 py-1 font-semibold">Time</th>
            <th className="px-2 py-1 font-semibold">Left as it is because</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.slot_id} className="border-t border-border/40">
              <td className="px-2 py-1 whitespace-nowrap">
                {r.weekday} {formatRuleDate(r.date)}
              </td>
              <td className="px-2 py-1 whitespace-nowrap tabular-nums">
                {r.start_time}–{r.end_time}
              </td>
              <td className="px-2 py-1">
                {r.reason}
                {r.blocked_label ? ` (${r.blocked_label})` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {total > rows.length && (
        <p className="border-t border-border/40 px-2 py-1 text-xs text-muted-foreground">
          and {total - rows.length} more
        </p>
      )}
    </div>
  );
}

/** Counts plus the skipped lists, used for the preview and for the result after Confirm. */
function PlanSummary({ summary, done }: { summary: RulePlanSummary; done?: boolean }) {
  const blocked = done ? summary.blocked_count ?? summary.to_block_count : summary.to_block_count;
  return (
    <div className="space-y-2 text-sm">
      <ul className="space-y-1">
        <li>
          <strong className="text-foreground">{plural(blocked, "slot")}</strong>{" "}
          {done ? "blocked now." : "will be blocked now."}
        </li>
        <li>
          <strong className="text-foreground">{plural(summary.skipped_booked_count, "booked slot")}</strong>{" "}
          {done ? "skipped" : "will be skipped"} (the bookings stay as they are; nothing is cancelled or refunded).
        </li>
        {summary.skipped_other_count > 0 && (
          <li>
            <strong className="text-foreground">{plural(summary.skipped_other_count, "slot")}</strong>{" "}
            {done ? "left" : "will be left"} as they are (already blocked, maintenance, closed day and so on).
          </li>
        )}
        <li>
          <strong className="text-foreground">{plural(summary.future_slots_count, "future slot")}</strong>{" "}
          will be blocked automatically when they are created
          {summary.slots_exist_until ? ` (slots exist up to ${formatRuleDate(summary.slots_exist_until)} today)` : ""}.
        </li>
      </ul>
      {summary.skipped_booked_count > 0 && (
        <details open={summary.skipped_booked_count <= 10}>
          <summary className="cursor-pointer text-xs font-semibold text-foreground">Booked slots skipped</summary>
          <SkippedBookedTable rows={summary.skipped_booked} total={summary.skipped_booked_count} />
        </details>
      )}
      {summary.skipped_other_count > 0 && (
        <details>
          <summary className="cursor-pointer text-xs font-semibold text-foreground">Slots left as they are</summary>
          <SkippedOtherTable rows={summary.skipped_other} total={summary.skipped_other_count} />
        </details>
      )}
    </div>
  );
}

export default function RecurringBlockRules({ equipmentId, onChanged }: RecurringBlockRulesProps) {
  const [data, setData] = useState<SlotBlockRuleList | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [times, setTimes] = useState<string[]>([]);
  const [preset, setPreset] = useState<RangePreset>("rest_of_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [label, setLabel] = useState("");

  const [preview, setPreview] = useState<RulePlanSummary | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [lastResult, setLastResult] = useState<RulePlanSummary | null>(null);

  const [removeTarget, setRemoveTarget] = useState<SlotBlockRule | null>(null);
  const [removing, setRemoving] = useState(false);

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setData(await slotBlockRulesApi.list(equipmentId));
    } catch (e) {
      setLoadError(errorMessage(e, "Could not load repeat blocks."));
    } finally {
      setLoading(false);
    }
  }, [equipmentId]);

  useEffect(() => {
    setData(null);
    setFormOpen(false);
    setWeekdays([]);
    setTimes([]);
    setPreset("rest_of_month");
    setCustomStart("");
    setCustomEnd("");
    setLabel("");
    setPreview(null);
    setLastResult(null);
    void load();
  }, [load]);

  const range = useMemo(
    () => (preset === "custom" ? { start: customStart, end: customEnd } : presetRange(preset, new Date())),
    [preset, customStart, customEnd],
  );

  const input: SlotBlockRuleInput = useMemo(
    () => ({
      weekdays: [...weekdays].sort((a, b) => a - b),
      slot_times: [...times].sort(),
      start_date: range.start,
      end_date: range.end,
      label: label.trim(),
    }),
    [weekdays, times, range, label],
  );
  const inputKey = JSON.stringify(input);

  useEffect(() => {
    setPreview(null);
  }, [inputKey]);

  const rangeProblem = !input.start_date || !input.end_date
    ? "Pick a start and end date."
    : input.start_date < todayStr
      ? "The start date cannot be in the past."
      : input.end_date < input.start_date
        ? "The end date must be on or after the start date."
        : null;
  const canPreview = weekdays.length > 0 && times.length > 0 && !rangeProblem;
  const slotTimes = data?.slot_times ?? [];

  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const runPreview = async () => {
    setPreviewing(true);
    try {
      const res = await slotBlockRulesApi.preview(equipmentId, input);
      setPreview(res.preview);
    } catch (e) {
      toast.error(errorMessage(e, "Could not preview the repeat block."));
    } finally {
      setPreviewing(false);
    }
  };

  const confirmCreate = async () => {
    setCreating(true);
    try {
      const res = await slotBlockRulesApi.create(equipmentId, input);
      const r = res.result;
      toast.success(
        `Repeat block saved: ${plural(r.blocked_count ?? r.to_block_count, "slot")} blocked, ` +
          `${plural(r.skipped_booked_count, "booked slot")} skipped.`,
      );
      setLastResult(r);
      setPreview(null);
      setFormOpen(false);
      setWeekdays([]);
      setTimes([]);
      setLabel("");
      await load();
      await onChanged?.();
    } catch (e) {
      toast.error(errorMessage(e, "Could not save the repeat block."));
    } finally {
      setCreating(false);
    }
  };

  const openRemove = async (rule: SlotBlockRule) => {
    setRemoveTarget(rule);
    // The list's counts can be stale; show what removing would do right now.
    const fresh = await slotBlockRulesApi.get(equipmentId, rule.id).catch(() => null);
    if (fresh) setRemoveTarget((cur) => (cur && cur.id === rule.id ? fresh.rule : cur));
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      const res = await slotBlockRulesApi.remove(equipmentId, removeTarget.id);
      toast.success(`Repeat block removed: ${plural(res.result.unblocked_count, "future slot")} unblocked.`);
      setRemoveTarget(null);
      await load();
      await onChanged?.();
    } catch (e) {
      toast.error(errorMessage(e, "Could not remove the repeat block."));
    } finally {
      setRemoving(false);
    }
  };

  const rules = data?.rules ?? [];
  const removal = removeTarget?.removal_preview;

  return (
    <section
      aria-labelledby="repeat-block-heading"
      className="w-full max-w-none mx-auto mb-4 rounded-xl border border-primary/20 bg-card shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-primary/15 bg-primary/5 px-3 py-2">
        <Repeat className="h-4 w-4 text-primary" aria-hidden />
        <h3 id="repeat-block-heading" className="text-sm font-semibold text-foreground">
          Repeat block
        </h3>
        {rules.length > 0 && <Badge variant="secondary">{plural(rules.length, "active rule")}</Badge>}
        <p className="text-xs text-muted-foreground">
          Block the same slots every week, e.g. every Mon &amp; Thu at 10:00. Future slots are blocked as they are
          created. Booked slots are never touched.
        </p>
        <Button
          size="sm"
          variant={formOpen ? "outline" : "default"}
          className={cn(SMALL_BUTTON_CLASS, "ml-auto")}
          onClick={() => {
            setFormOpen((v) => !v);
            setLastResult(null);
          }}
          aria-expanded={formOpen}
          disabled={loading && !data}
        >
          {formOpen ? "Close" : "Repeat block…"}
        </Button>
      </div>

      <div className="space-y-3 p-3">
        {loadError && (
          <p className="text-sm text-destructive" role="alert">
            {loadError}{" "}
            <button type="button" className="underline" onClick={() => void load()}>
              Try again
            </button>
          </p>
        )}

        {lastResult && !formOpen && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">Repeat block saved</h4>
              <Button variant="ghost" size="sm" className={SMALL_BUTTON_CLASS} onClick={() => setLastResult(null)}>
                Dismiss
              </Button>
            </div>
            <PlanSummary summary={lastResult} done />
          </div>
        )}

        {formOpen && (
          <div className="space-y-3 rounded-lg border border-border/60 p-3">
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-semibold text-foreground">Weekdays</legend>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAY_LABELS.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={weekdays.includes(i)}
                    className={cn(CHIP_CLASS, weekdays.includes(i) ? CHIP_ON_CLASS : CHIP_OFF_CLASS)}
                    onClick={() => setWeekdays((prev) => toggle(prev, i))}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-1.5">
              <legend className="flex items-center gap-2 text-sm font-semibold text-foreground">
                Slot times
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setTimes(slotTimes.map((t) => t.time))}
                  disabled={slotTimes.length === 0}
                >
                  All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setTimes([])}
                  disabled={times.length === 0}
                >
                  None
                </Button>
              </legend>
              {slotTimes.length === 0 ? (
                <p className="text-xs text-muted-foreground">This equipment has no active slot times.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {slotTimes.map((t) => (
                    <button
                      key={t.time}
                      type="button"
                      aria-pressed={times.includes(t.time)}
                      title={`${t.name}: ${t.time}–${t.end_time}`}
                      className={cn(CHIP_CLASS, "tabular-nums", times.includes(t.time) ? CHIP_ON_CLASS : CHIP_OFF_CLASS)}
                      onClick={() => setTimes((prev) => toggle(prev, t.time))}
                    >
                      {t.time}–{t.end_time}
                    </button>
                  ))}
                </div>
              )}
            </fieldset>

            <fieldset className="space-y-1.5">
              <legend className="text-sm font-semibold text-foreground">Date range</legend>
              <div className="flex flex-wrap gap-1.5">
                {RANGE_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    aria-pressed={preset === p.value}
                    className={cn(CHIP_CLASS, preset === p.value ? CHIP_ON_CLASS : CHIP_OFF_CLASS)}
                    onClick={() => {
                      if (p.value === "custom" && !customStart) {
                        const r = presetRange("rest_of_month", new Date());
                        setCustomStart(r.start);
                        setCustomEnd(r.end);
                      }
                      setPreset(p.value);
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {preset === "custom" ? (
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="repeat-block-from" className="text-xs">
                      From
                    </Label>
                    <DateInput
                      id="repeat-block-from"
                      min={todayStr}
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="w-[160px]" inputClassName="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="repeat-block-to" className="text-xs">
                      To
                    </Label>
                    <DateInput
                      id="repeat-block-to"
                      min={customStart || todayStr}
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="w-[160px]" inputClassName="h-8 text-sm"
                    />
                  </div>
                </div>
              ) : (
                input.start_date &&
                input.end_date && (
                  <p className="text-xs text-muted-foreground">
                    {formatRuleDate(input.start_date)} – {formatRuleDate(input.end_date)}
                  </p>
                )
              )}
              {rangeProblem && (preset !== "custom" || (customStart && customEnd)) && (
                <p className="text-xs text-destructive">{rangeProblem}</p>
              )}
            </fieldset>

            <div className="space-y-1">
              <Label htmlFor="repeat-block-label" className="text-sm font-semibold">
                Other Reasons label (optional)
              </Label>
              <Input
                id="repeat-block-label"
                placeholder="e.g. Weekly calibration"
                maxLength={255}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="h-8 max-w-[320px] text-sm"
              />
            </div>

            {!preview ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className={SMALL_BUTTON_CLASS} disabled={!canPreview || previewing} onClick={runPreview}>
                  {previewing && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden />}
                  Preview
                </Button>
                <Button size="sm" variant="outline" className={SMALL_BUTTON_CLASS} onClick={() => setFormOpen(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
                <h4 className="text-sm font-semibold">Preview: {describeRule(input)}</h4>
                <PlanSummary summary={preview} />
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" className={SMALL_BUTTON_CLASS} disabled={creating} onClick={confirmCreate}>
                    {creating && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden />}
                    Confirm and block
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={SMALL_BUTTON_CLASS}
                    disabled={creating}
                    onClick={() => setPreview(null)}
                  >
                    Back to edit
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {loading && !data && <p className="text-xs text-muted-foreground">Loading repeat blocks…</p>}
        {data && rules.length === 0 && !formOpen && (
          <p className="text-xs text-muted-foreground">No repeat blocks on this equipment.</p>
        )}
        {rules.length > 0 && (
          <ul className="divide-y divide-border/50 rounded-lg border border-border/60" aria-label="Active repeat blocks">
            {rules.map((rule) => {
              const skippedBooked = rule.summary?.skipped_booked_count ?? 0;
              return (
                <li key={rule.id} className="flex flex-wrap items-start gap-2 px-3 py-2">
                  <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="text-sm font-medium text-foreground">
                      {describeRule(rule)}
                      {rule.label && (
                        <Badge variant="outline" className="ml-2 align-middle">
                          {rule.label}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Blocking {plural(rule.blocked_now_count, "slot")}
                      {rule.generated_count > 0 && ` (${rule.generated_count} added as new slots were created)`} ·{" "}
                      {plural(skippedBooked, "booked slot")} skipped when saved
                      {rule.created_by_name && ` · by ${rule.created_by_name}`}
                      {rule.created_at && ` on ${format(new Date(rule.created_at), "d MMM yyyy")}`}
                    </p>
                    {skippedBooked > 0 && (
                      <details>
                        <summary className="cursor-pointer text-xs font-medium text-foreground">
                          Booked slots skipped
                        </summary>
                        <SkippedBookedTable rows={rule.summary.skipped_booked ?? []} total={skippedBooked} />
                      </details>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className={cn(SMALL_BUTTON_CLASS, "text-destructive hover:text-destructive")}
                    onClick={() => void openRemove(rule)}
                    aria-label={`Remove repeat block: ${describeRule(rule)}`}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden />
                    Remove
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AlertDialog open={removeTarget !== null} onOpenChange={(open) => !open && !removing && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this repeat block?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {removeTarget && <p className="font-medium text-foreground">{describeRule(removeTarget)}</p>}
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    <strong>{plural(removal?.will_unblock_count ?? 0, "future slot")}</strong> will be unblocked and open
                    for booking again.
                  </li>
                  {(removal?.kept_by_other_rule_count ?? 0) > 0 && (
                    <li>
                      {plural(removal?.kept_by_other_rule_count ?? 0, "slot")} stay blocked because another repeat block
                      covers them.
                    </li>
                  )}
                  {(removal?.unchanged_count ?? 0) > 0 && (
                    <li>
                      {plural(removal?.unchanged_count ?? 0, "slot")} were changed by hand or booked since, and stay as
                      they are.
                    </li>
                  )}
                  <li>Past slots and slots blocked by hand are not changed. No new slots will be blocked.</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={removing}
              onClick={(e) => {
                e.preventDefault();
                void confirmRemove();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing ? "Removing…" : "Remove repeat block"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
