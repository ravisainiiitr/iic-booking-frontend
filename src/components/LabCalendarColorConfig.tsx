import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Palette } from "lucide-react";
import { toast } from "sonner";

export const LAB_BOOKING_COLOR_KEYS = [
  { key: "BOOKED_INTERNAL", label: "Internal booked" },
  { key: "BOOKED_EXTERNAL", label: "External booked" },
  { key: "AVAILABLE", label: "Available" },
  { key: "COMPLETED", label: "Completed" },
] as const;

export type LabBookingColorKey = (typeof LAB_BOOKING_COLOR_KEYS)[number]["key"];

export const DEFAULT_LAB_BOOKING_COLORS: Record<LabBookingColorKey, string> = {
  BOOKED_INTERNAL: "#3b82f6",
  BOOKED_EXTERNAL: "#ea580c",
  AVAILABLE: "#86efac",
  COMPLETED: "#34d399",
};

type Props = {
  /** Called after a successful save so the week calendar can reload colours. */
  onSaved?: (slotColors: Record<string, string>) => void;
  /** Optional: sync legend when colours change locally before save. */
  onColorsChange?: (slotColors: Record<string, string>) => void;
};

export function LabCalendarColorConfig({ onSaved, onColorsChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [colors, setColors] = useState<Record<string, string>>({ ...DEFAULT_LAB_BOOKING_COLORS });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiClient.getLabDashboardCalendarColors();
        if (cancelled) return;
        const next = {
          ...DEFAULT_LAB_BOOKING_COLORS,
          ...(res.data?.slot_colors || {}),
        };
        setColors(next);
        onColorsChange?.(next);
      } catch (e) {
        console.error("Failed to load lab calendar colours:", e);
        if (!cancelled) toast.error("Failed to load calendar colours");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  const setColor = (key: string, value: string) => {
    setColors((prev) => {
      const next = { ...prev, [key]: value };
      onColorsChange?.(next);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const slot_colors: Record<string, string> = {};
      for (const { key } of LAB_BOOKING_COLOR_KEYS) {
        const v = colors[key]?.trim();
        if (v && v.startsWith("#")) slot_colors[key] = v;
      }
      const res = await apiClient.updateLabDashboardCalendarColors({ slot_colors });
      const saved = {
        ...DEFAULT_LAB_BOOKING_COLORS,
        ...(res.data?.slot_colors || slot_colors),
      };
      setColors(saved);
      onColorsChange?.(saved);
      onSaved?.(saved);
      toast.success("Calendar colours saved");
    } catch (e) {
      console.error("Failed to save lab calendar colours:", e);
      toast.error("Failed to save calendar colours");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading colour settings…
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-background/80 p-3 sm:p-4 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 min-w-0">
          <Palette className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Calendar colours</p>
            <p className="text-xs text-muted-foreground">
              Set colours for Internal, External, Available, and Completed tiles on this dashboard.
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8 shrink-0"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Saving…
            </>
          ) : (
            "Save colours"
          )}
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {LAB_BOOKING_COLOR_KEYS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-2.5 min-w-0">
            <Input
              type="color"
              aria-label={label}
              className="h-9 w-11 shrink-0 cursor-pointer p-1"
              value={colors[key] || DEFAULT_LAB_BOOKING_COLORS[key]}
              onChange={(e) => setColor(key, e.target.value)}
            />
            <div className="min-w-0 flex-1 space-y-1">
              <Label className="text-xs text-muted-foreground">{label}</Label>
              <Input
                type="text"
                className="h-8 font-mono text-xs"
                value={colors[key] || ""}
                onChange={(e) => setColor(key, e.target.value)}
                placeholder="#000000"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
