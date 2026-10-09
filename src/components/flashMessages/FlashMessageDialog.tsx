import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DateTimeInput } from "@/components/ui/datetime-input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { apiClient } from "@/lib/api";
import {
  FLASH_AUDIENCE_LABELS,
  FLASH_DURATION_PRESETS,
  FLASH_MESSAGE_MAX_CHARS,
  FLASH_TONE_LABELS,
  FLASH_TONE_STYLES,
  addDays,
  flashPlainText,
  localInputToIso,
  toLocalInputValue,
  type FlashAudience,
  type FlashMessageOptions,
  type FlashMessagePayload,
  type FlashMessageRecord,
  type FlashTone,
} from "@/lib/flashMessages";
import { cn } from "@/lib/utils";
import { EquipmentFlashBanner } from "./EquipmentFlashBanner";
import { FlashMessageEditor } from "./FlashMessageEditor";

const TONES: FlashTone[] = ["INFO", "NOTICE", "IMPORTANT", "SUCCESS"];
const AUDIENCES: FlashAudience[] = ["ALL", "INTERNAL", "EXTERNAL", "USER_TYPES"];

export type FlashDialogMode =
  | { kind: "create"; equipmentId?: number | null; from?: FlashMessageRecord | null }
  | { kind: "edit"; record: FlashMessageRecord };

interface FormState {
  equipment: string;
  message: string;
  tone: FlashTone;
  preset: string;
  startLater: boolean;
  start: string;
  end: string;
  isActive: boolean;
  audience: FlashAudience;
  userTypes: string[];
  showOnModes: boolean;
  linkUrl: string;
  linkLabel: string;
}

function initialState(mode: FlashDialogMode): FormState {
  const now = new Date();
  const src = mode.kind === "edit" ? mode.record : mode.from ?? null;
  const base: FormState = {
    equipment: mode.kind === "edit" ? String(mode.record.equipment_id) : String(mode.equipmentId ?? src?.equipment_id ?? ""),
    message: src?.message ?? "",
    tone: src?.tone ?? "INFO",
    preset: "1d",
    startLater: false,
    start: toLocalInputValue(now),
    end: toLocalInputValue(addDays(now, 1)),
    isActive: mode.kind === "edit" ? mode.record.is_active : true,
    audience: src?.audience ?? "ALL",
    userTypes: src?.audience_user_types ?? [],
    showOnModes: src?.show_on_modes ?? false,
    linkUrl: src?.link_url ?? "",
    linkLabel: src?.link_label ?? "",
  };
  if (mode.kind === "edit") {
    base.preset = "custom";
    base.startLater = new Date(mode.record.start_at).getTime() > now.getTime();
    base.start = toLocalInputValue(mode.record.start_at);
    base.end = toLocalInputValue(mode.record.end_at);
  }
  return base;
}

export function FlashMessageDialog({
  open,
  mode,
  options,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  mode: FlashDialogMode;
  options: FlashMessageOptions | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (record: FlashMessageRecord) => void;
}) {
  const [form, setForm] = useState<FormState>(() => initialState(mode));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(initialState(mode));
      setError(null);
    }
  }, [open, mode]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const maxChars = options?.limits.message_max_chars ?? FLASH_MESSAGE_MAX_CHARS;
  const maxDays = options?.limits.max_duration_days ?? 30;
  const equipmentOptions = options?.equipment_options ?? [];
  const selectedEquipment = equipmentOptions.find((e) => String(e.id) === form.equipment);
  const plainLength = flashPlainText(form.message).length;

  const startDate = form.startLater && form.start ? new Date(form.start) : new Date();
  const endDate = useMemo(() => {
    const presetDays = FLASH_DURATION_PRESETS.find((p) => p.key === form.preset)?.days;
    if (presetDays) return addDays(form.startLater && form.start ? new Date(form.start) : new Date(), presetDays);
    return form.end ? new Date(form.end) : null;
  }, [form.preset, form.start, form.startLater, form.end]);

  const previewMessages = useMemo(
    () =>
      form.message.trim()
        ? [
            {
              id: -1,
              message: form.message,
              tone: form.tone,
              end_at: endDate?.toISOString() ?? "",
              link_url: form.linkUrl.trim(),
              link_label: form.linkLabel.trim(),
            },
          ]
        : [],
    [form.message, form.tone, form.linkUrl, form.linkLabel, endDate],
  );

  const validate = (): string | null => {
    if (mode.kind === "create" && !form.equipment) return "Choose the equipment.";
    if (!plainLength) return "Enter the message.";
    if (plainLength > maxChars) return `Keep the message under ${maxChars} characters.`;
    if (!endDate || Number.isNaN(endDate.getTime())) return "Choose when the message should end.";
    if (endDate.getTime() <= startDate.getTime()) return "The end must be after the start.";
    if (endDate.getTime() - Math.max(startDate.getTime(), Date.now()) > (maxDays * 24 * 60 + 1) * 60 * 1000) {
      return `A flash message can run for at most ${maxDays} days.`;
    }
    if (form.audience === "USER_TYPES" && form.userTypes.length === 0) return "Choose at least one user type.";
    if (form.linkUrl.trim() && !/^https?:\/\/\S+$/i.test(form.linkUrl.trim())) {
      return "Enter a link starting with https:// (or leave it empty).";
    }
    return null;
  };

  const submit = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    const payload: FlashMessagePayload = {
      message: form.message,
      tone: form.tone,
      end_at: endDate!.toISOString(),
      is_active: form.isActive,
      audience: form.audience,
      audience_user_types: form.audience === "USER_TYPES" ? form.userTypes : [],
      show_on_modes: Boolean(selectedEquipment?.has_modes) && form.showOnModes,
      link_url: form.linkUrl.trim(),
      link_label: form.linkLabel.trim(),
    };
    if (form.startLater) payload.start_at = localInputToIso(form.start);
    else if (mode.kind === "create") payload.start_at = null;
    else if (new Date(mode.record.start_at).getTime() > Date.now()) payload.start_at = new Date().toISOString();
    setSaving(true);
    setError(null);
    const res =
      mode.kind === "edit"
        ? await apiClient.updateFlashMessage(mode.record.id, payload)
        : await apiClient.createFlashMessage({
            ...payload,
            equipment: Number(form.equipment),
            ...(mode.from ? { duplicated_from: mode.from.id } : {}),
          });
    setSaving(false);
    if (res.error || !res.data) {
      setError(res.error || "Could not save the flash message.");
      return;
    }
    toast.success(mode.kind === "edit" ? "Flash message updated." : "Flash message created.");
    onSaved(res.data);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent
        className="max-h-[92vh] grid-cols-[minmax(0,1fr)] overflow-y-auto sm:max-w-2xl"
        data-testid="flash-message-dialog"
      >
        <DialogHeader>
          <DialogTitle>{mode.kind === "edit" ? "Edit flash message" : "New flash message"}</DialogTitle>
          <DialogDescription>
            A short message at the top of the equipment page and its booking page. It disappears on its own when it ends.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-dashed bg-muted/30 p-3" aria-label="Live preview">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Live preview</p>
            {previewMessages.length ? (
              <EquipmentFlashBanner messages={previewMessages} preview />
            ) : (
              <p className="py-2 text-center text-xs text-muted-foreground">Type a message to see how it will look.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="flash-equipment">Equipment</Label>
            <Select value={form.equipment} onValueChange={(v) => set("equipment", v)} disabled={mode.kind === "edit"}>
              <SelectTrigger id="flash-equipment" aria-label="Equipment">
                <SelectValue placeholder="Choose equipment" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {equipmentOptions.map((e) => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.code ? `${e.name} (${e.code})` : e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Message</Label>
              <span className={cn("text-xs tabular-nums", plainLength > maxChars ? "text-destructive" : "text-muted-foreground")}>
                {plainLength}/{maxChars}
              </span>
            </div>
            <FlashMessageEditor value={form.message} onChange={(v) => set("message", v)} invalid={plainLength > maxChars} />
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Tone</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tone">
              {TONES.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={form.tone === t}
                  onClick={() => set("tone", t)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    form.tone === t ? FLASH_TONE_STYLES[t].chip : "border-border bg-background text-muted-foreground hover:bg-muted",
                    form.tone === t && "shadow-sm",
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", FLASH_TONE_STYLES[t].dot)} aria-hidden />
                  {FLASH_TONE_LABELS[t]}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Show for</legend>
            <div className="flex flex-wrap gap-2">
              {[...FLASH_DURATION_PRESETS, { key: "custom", label: "Custom", days: 0 }].map((p) => (
                <Button
                  key={p.key}
                  type="button"
                  size="sm"
                  variant={form.preset === p.key ? "default" : "outline"}
                  aria-pressed={form.preset === p.key}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      preset: p.key,
                      end: p.key === "custom" && endDate ? toLocalInputValue(endDate) : f.end,
                    }))
                  }
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Checkbox id="flash-start-later" checked={form.startLater} onCheckedChange={(v) => set("startLater", v === true)} />
              <Label htmlFor="flash-start-later" className="font-normal">
                Start later (otherwise it starts now)
              </Label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {form.startLater ? (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Starts</Label>
                  <DateTimeInput value={form.start} onValueChange={(v) => set("start", v)} aria-label="Starts" />
                </div>
              ) : null}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Ends</Label>
                {form.preset === "custom" ? (
                  <DateTimeInput value={form.end} onValueChange={(v) => set("end", v)} aria-label="Ends" />
                ) : (
                  <p className="text-sm" data-testid="flash-end-preview">
                    {endDate ? endDate.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}
                  </p>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Up to {maxDays} days. Expired messages hide on their own.</p>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="flash-audience">Who sees it</Label>
            <Select value={form.audience} onValueChange={(v) => set("audience", v as FlashAudience)}>
              <SelectTrigger id="flash-audience" aria-label="Who sees it">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUDIENCES.map((a) => (
                  <SelectItem key={a} value={a}>
                    {FLASH_AUDIENCE_LABELS[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.audience === "USER_TYPES" ? (
              <div className="grid gap-1.5 rounded-md border p-2 sm:grid-cols-2">
                {(options?.user_types ?? []).map((t) => (
                  <label key={t.value} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.userTypes.includes(t.value)}
                      onCheckedChange={(v) =>
                        set(
                          "userTypes",
                          v === true ? [...form.userTypes, t.value] : form.userTypes.filter((x) => x !== t.value),
                        )
                      }
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">Staff always see every message of their equipment.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
            <div className="space-y-1">
              <Label htmlFor="flash-link-url">Link (optional)</Label>
              <Input
                id="flash-link-url"
                value={form.linkUrl}
                onChange={(e) => set("linkUrl", e.target.value)}
                placeholder="https://…"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="flash-link-label">Link text</Label>
              <Input
                id="flash-link-label"
                value={form.linkLabel}
                maxLength={options?.limits.link_label_max_chars ?? 40}
                onChange={(e) => set("linkLabel", e.target.value)}
                placeholder="Learn more"
              />
            </div>
          </div>

          {selectedEquipment?.has_modes ? (
            <div className="flex items-start gap-2 rounded-md border bg-muted/20 p-2.5">
              <Checkbox id="flash-modes" checked={form.showOnModes} onCheckedChange={(v) => set("showOnModes", v === true)} />
              <Label htmlFor="flash-modes" className="font-normal leading-snug">
                Also show on all modes of this instrument
              </Label>
            </div>
          ) : null}

          <div className="flex items-center justify-between rounded-md border p-2.5">
            <Label htmlFor="flash-active" className="font-normal">
              Show this message {form.isActive ? "(on)" : "(off — saved but hidden)"}
            </Label>
            <Switch id="flash-active" checked={form.isActive} onCheckedChange={(v) => set("isActive", v)} />
          </div>

          {error ? (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {mode.kind === "edit" ? "Save changes" : "Publish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default FlashMessageDialog;
