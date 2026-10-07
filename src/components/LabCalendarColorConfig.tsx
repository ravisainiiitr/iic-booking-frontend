import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, Loader2, Palette } from "lucide-react";
import { toast } from "sonner";

export const LAB_BOOKING_COLOR_KEYS = [
  { key: "BOOKED_INTERNAL", label: "Internal booked" },
  { key: "BOOKED_EXTERNAL", label: "External booked" },
  { key: "AVAILABLE", label: "Available" },
  { key: "COMPLETED", label: "Completed" },
] as const;

export type LabBookingColorKey = (typeof LAB_BOOKING_COLOR_KEYS)[number]["key"];

/** Same as the booking screen's calendar colours; external bookings keep their own colour. */
export const DEFAULT_LAB_BOOKING_COLORS: Record<LabBookingColorKey, string> = {
  BOOKED_INTERNAL: "#ef4444",
  BOOKED_EXTERNAL: "#2563eb",
  AVAILABLE: "#22c55e",
  COMPLETED: "#059669",
};

type Props = {
  /** Required: colours are personal and scoped to this equipment only. */
  equipmentId: number | null;
  equipmentLabel?: string;
  /** Called after a successful save so the week calendar can reload colours. */
  onSaved?: (equipmentId: number, slotColors: Record<string, string>) => void;
  /** Optional: sync legend when colours change locally before save. */
  onColorsChange?: (slotColors: Record<string, string>) => void;
  /** Controlled expanded state; collapsed by default when omitted. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function LabCalendarColorConfig({
  equipmentId,
  equipmentLabel,
  onSaved,
  onColorsChange,
  open: openProp,
  onOpenChange,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const toggleOpen = () => {
    setOpenState(!open);
    onOpenChange?.(!open);
  };
  const [colors, setColors] = useState<Record<string, string>>({ ...DEFAULT_LAB_BOOKING_COLORS });

  useEffect(() => {
    let cancelled = false;
    if (equipmentId == null) {
      setLoading(false);
      setColors({ ...DEFAULT_LAB_BOOKING_COLORS });
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const res = await apiClient.getLabDashboardCalendarColors(equipmentId);
        if (cancelled) return;
        const saved = res.data?.slot_colors || {};
        setColors({ ...DEFAULT_LAB_BOOKING_COLORS, ...saved });
        onColorsChange?.(saved);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when equipment changes
  }, [equipmentId]);

  const setColor = (key: string, value: string) => {
    setColors((prev) => {
      const next = { ...prev, [key]: value };
      onColorsChange?.(next);
      return next;
    });
  };

  const handleSave = async () => {
    if (equipmentId == null) {
      toast.error("Select an instrument to save colours for that equipment.");
      return;
    }
    setSaving(true);
    try {
      const slot_colors: Record<string, string> = {};
      for (const { key } of LAB_BOOKING_COLOR_KEYS) {
        const v = colors[key]?.trim();
        if (v && v.startsWith("#")) slot_colors[key] = v;
      }
      const res = await apiClient.updateLabDashboardCalendarColors({
        equipment_id: equipmentId,
        slot_colors,
      });
      const saved = {
        ...DEFAULT_LAB_BOOKING_COLORS,
        ...(res.data?.slot_colors || slot_colors),
      };
      setColors(saved);
      onColorsChange?.(saved);
      onSaved?.(equipmentId, saved);
      toast.success("Colours saved for your view of this equipment only");
    } catch (e) {
      console.error("Failed to save lab calendar colours:", e);
      toast.error("Failed to save calendar colours");
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <button
      type="button"
      onClick={toggleOpen}
      aria-expanded={open}
      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Palette className="h-4 w-4 shrink-0 text-primary" />
      <span className="font-medium text-foreground">Calendar colours</span>
      <span className="hidden min-w-0 truncate text-xs text-muted-foreground sm:inline">
        {equipmentId == null
          ? "· select one instrument to customise"
          : `· personal view for ${equipmentLabel || `equipment #${equipmentId}`}`}
      </span>
      {loading && equipmentId != null ? (
        <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-muted-foreground" />
      ) : (
        <ChevronDown
          className={`ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      )}
    </button>
  );

  return (
    <div className="overflow-hidden rounded-lg border border-border/60 bg-background/80">
      {header}
      {open && (
        <div className="space-y-3 border-t border-border/50 p-3">
          {equipmentId == null ? (
            <p className="text-xs text-muted-foreground">
              Select a single instrument above to customise colours for your view of that equipment. Other users
              (students, faculty, external) keep the main administrator colours.
            </p>
          ) : loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading colour settings…
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {LAB_BOOKING_COLOR_KEYS.map(({ key, label }) => (
                  <div key={key} className="flex min-w-0 items-center gap-2.5">
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
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">Does not change colours for other users.</p>
                <Button type="button" size="sm" className="h-8 shrink-0" onClick={handleSave} disabled={saving}>
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
