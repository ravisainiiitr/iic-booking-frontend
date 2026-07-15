import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Palette, Loader2 } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const SLOT_KEYS: { key: string; label: string }[] = [
  { key: "AVAILABLE", label: "Available" },
  { key: "BOOKED", label: "Booked" },
  { key: "COMPLETED", label: "Completed booking" },
  { key: "HOLD", label: "Hold" },
  { key: "BLOCKED", label: "Blocked" },
  { key: "UNDER_MAINTENANCE", label: "Under Maintenance" },
  { key: "OPERATOR_ABSENT", label: "Operator Absent" },
  { key: "BOOKING_NOT_UTILIZED", label: "Booking Not Utilized" },
  { key: "RESERVED_FOR_EXTERNAL", label: "Reserved for External User" },
  { key: "HOME_DEPARTMENT_ONLY", label: "Home department only" },
  { key: "NOT_AVAILABLE", label: "Not Available" },
];

const DEFAULT_COLORS: Record<string, string> = {
  AVAILABLE: "#22c55e",
  BOOKED: "#ef4444",
  COMPLETED: "#059669",
  HOLD: "#f59e0b",
  BLOCKED: "#64748b",
  UNDER_MAINTENANCE: "#f97316",
  OPERATOR_ABSENT: "#eab308",
  BOOKING_NOT_UTILIZED: "#a855f7",
  RESERVED_FOR_EXTERNAL: "#94a3b8",
  HOME_DEPARTMENT_ONLY: "#c4b5fd",
  NOT_AVAILABLE: "#e2e8f0",
  HOLIDAY_DEFAULT: "#f59e0b",
  SATURDAY: "#c7d2fe",
  SUNDAY: "#fbcfe8",
};

export default function CalendarColorSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isAdmin = userTypeStr === "admin";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [slotColors, setSlotColors] = useState<Record<string, string>>({ ...DEFAULT_COLORS });
  const [holidayDefault, setHolidayDefault] = useState(DEFAULT_COLORS.HOLIDAY_DEFAULT);
  const [saturdayColor, setSaturdayColor] = useState(DEFAULT_COLORS.SATURDAY);
  const [sundayColor, setSundayColor] = useState(DEFAULT_COLORS.SUNDAY);
  const [externalGstPercent, setExternalGstPercent] = useState<number>(18);

  useEffect(() => {
    if (!isAdmin) {
      navigate("/dashboard");
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiClient.getAdminCalendarColors();
        if (res.data) {
          setSlotColors((prev) => ({
            ...prev,
            ...res.data!.slot_colors,
          }));
          if (res.data.holiday_default) setHolidayDefault(res.data.holiday_default);
          if (res.data.saturday_color) setSaturdayColor(res.data.saturday_color);
          if (res.data.sunday_color) setSundayColor(res.data.sunday_color);
          if (res.data.external_gst_percent != null) setExternalGstPercent(Number(res.data.external_gst_percent));
        }
      } catch (e) {
        console.error("Failed to load calendar colors:", e);
        toast.error("Failed to load calendar colors");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isAdmin, navigate]);

  const handleSlotColorChange = (key: string, value: string) => {
    setSlotColors((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const slot_colors: Record<string, string> = {};
      SLOT_KEYS.forEach(({ key }) => {
        const v = slotColors[key]?.trim();
        if (v && v.startsWith("#")) slot_colors[key] = v;
      });
      const holiday_default = holidayDefault?.trim().startsWith("#") ? holidayDefault.trim() : undefined;
      const saturday_color = saturdayColor?.trim().startsWith("#") ? saturdayColor.trim() : undefined;
      const sunday_color = sundayColor?.trim().startsWith("#") ? sundayColor.trim() : undefined;
      const external_gst_percent = typeof externalGstPercent === 'number' && externalGstPercent >= 0 && externalGstPercent <= 100 ? externalGstPercent : undefined;
      await apiClient.updateAdminCalendarColors({ slot_colors, holiday_default, saturday_color, sunday_color, external_gst_percent });
      toast.success("Calendar colors updated. They will apply to the weekly window on equipment and booking pages.");
    } catch (e) {
      console.error("Failed to save calendar colors:", e);
      toast.error("Failed to save calendar colors");
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Palette className="h-8 w-8" />
            Calendar colors
          </h1>
          <p className="text-muted-foreground mt-1">
            Customize colors for the weekly calendar: slot states (including completed bookings), holiday default, and weekend (Saturday & Sunday). Changes apply to equipment profile and book-equipment weekly views.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Slot states, holidays & weekends</CardTitle>
              <CardDescription>
                Use hex codes (e.g. #22c55e). Text contrast is chosen automatically for readability.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {SLOT_KEYS.map(({ key, label }) => (
                <div key={key} className="flex flex-wrap items-center gap-3">
                  <Label className="w-40 shrink-0">{label}</Label>
                  <input
                    type="color"
                    value={slotColors[key] || DEFAULT_COLORS[key]}
                    onChange={(e) => handleSlotColorChange(key, e.target.value)}
                    className="h-10 w-14 rounded border cursor-pointer"
                  />
                  <Input
                    value={slotColors[key] ?? ""}
                    onChange={(e) => handleSlotColorChange(key, e.target.value)}
                    placeholder="#hex"
                    className="font-mono w-28"
                  />
                  <div
                    className="h-8 w-20 rounded border-2 border-white/50 shadow-sm flex items-center justify-center text-xs font-medium"
                    style={{
                      backgroundColor: slotColors[key] || DEFAULT_COLORS[key],
                      color:
                        (() => {
                          const hex = slotColors[key] || DEFAULT_COLORS[key];
                          if (!hex) return "#000";
                          const n = parseInt(hex.slice(1), 16);
                          const r = (n >> 16) & 0xff;
                          const g = (n >> 8) & 0xff;
                          const b = n & 0xff;
                          const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                          return luminance > 0.5 ? "#1f2937" : "#ffffff";
                        })(),
                    }}
                  >
                    Preview
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t">
                <Label className="w-40 shrink-0">Holiday default</Label>
                <input
                  type="color"
                  value={holidayDefault}
                  onChange={(e) => setHolidayDefault(e.target.value)}
                  className="h-10 w-14 rounded border cursor-pointer"
                />
                <Input
                  value={holidayDefault}
                  onChange={(e) => setHolidayDefault(e.target.value)}
                  placeholder="#hex"
                  className="font-mono w-28"
                />
                <div
                  className="h-8 w-20 rounded border-2 border-white/50 shadow-sm flex items-center justify-center text-xs font-medium"
                  style={{
                    backgroundColor: holidayDefault,
                    color:
                      (() => {
                        const hex = holidayDefault;
                        if (!hex?.startsWith("#")) return "#000";
                        const n = parseInt(hex.slice(1), 16);
                        if (Number.isNaN(n)) return "#000";
                        const r = (n >> 16) & 0xff;
                        const g = (n >> 8) & 0xff;
                        const b = n & 0xff;
                        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                        return luminance > 0.5 ? "#1f2937" : "#ffffff";
                      })(),
                  }}
                >
                  Preview
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t">
                <Label className="w-40 shrink-0">Saturday</Label>
                <input
                  type="color"
                  value={saturdayColor}
                  onChange={(e) => setSaturdayColor(e.target.value)}
                  className="h-10 w-14 rounded border cursor-pointer"
                />
                <Input
                  value={saturdayColor}
                  onChange={(e) => setSaturdayColor(e.target.value)}
                  placeholder="#hex"
                  className="font-mono w-28"
                />
                <div
                  className="h-8 w-20 rounded border-2 border-white/50 shadow-sm flex items-center justify-center text-xs font-medium"
                  style={{
                    backgroundColor: saturdayColor,
                    color:
                      (() => {
                        const hex = saturdayColor;
                        if (!hex?.startsWith("#")) return "#000";
                        const n = parseInt(hex.slice(1), 16);
                        if (Number.isNaN(n)) return "#000";
                        const r = (n >> 16) & 0xff;
                        const g = (n >> 8) & 0xff;
                        const b = n & 0xff;
                        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                        return luminance > 0.5 ? "#1f2937" : "#ffffff";
                      })(),
                  }}
                >
                  Preview
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Label className="w-40 shrink-0">Sunday</Label>
                <input
                  type="color"
                  value={sundayColor}
                  onChange={(e) => setSundayColor(e.target.value)}
                  className="h-10 w-14 rounded border cursor-pointer"
                />
                <Input
                  value={sundayColor}
                  onChange={(e) => setSundayColor(e.target.value)}
                  placeholder="#hex"
                  className="font-mono w-28"
                />
                <div
                  className="h-8 w-20 rounded border-2 border-white/50 shadow-sm flex items-center justify-center text-xs font-medium"
                  style={{
                    backgroundColor: sundayColor,
                    color:
                      (() => {
                        const hex = sundayColor;
                        if (!hex?.startsWith("#")) return "#000";
                        const n = parseInt(hex.slice(1), 16);
                        if (Number.isNaN(n)) return "#000";
                        const r = (n >> 16) & 0xff;
                        const g = (n >> 8) & 0xff;
                        const b = n & 0xff;
                        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                        return luminance > 0.5 ? "#1f2937" : "#ffffff";
                      })(),
                  }}
                >
                  Preview
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t">
                <Label className="w-40 shrink-0">External user GST %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={externalGstPercent}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!Number.isNaN(v)) setExternalGstPercent(Math.max(0, Math.min(100, v)));
                  }}
                  className="font-mono w-24"
                />
                <span className="text-sm text-muted-foreground">Applied on top of base charge for external users. Internal students: 0%.</span>
              </div>
              <div className="flex gap-3 pt-4">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save colors
                </Button>
                <Button variant="outline" onClick={() => navigate("/dashboard")}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
