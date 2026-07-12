import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { apiClient, getApiOrigin, type PrintAnalysisResult } from "@/lib/api";
import { ceilPrintWeightGrams, formatPrintWeightGrams } from "@/components/Print3DBookingPanel";
import { Pencil, Check } from "lucide-react";
import { Download } from "lucide-react";

interface Print3DBookingActualsProps {
  printAnalysis: PrintAnalysisResult;
  bookingId: number;
  enableChargeRecalculation?: boolean;
  canEdit?: boolean;
  /** Called after save with latest booking payload (no navigation). */
  onUpdated?: (payload?: { booking?: any; print_analysis?: PrintAnalysisResult }) => void;
}

export function Print3DBookingActuals({
  printAnalysis,
  bookingId,
  enableChargeRecalculation = false,
  canEdit = false,
  onUpdated,
}: Print3DBookingActualsProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [weight, setWeight] = useState(
    String(printAnalysis.actual_weight_grams ?? printAnalysis.weight_grams ?? ""),
  );
  const [time, setTime] = useState(
    String(printAnalysis.actual_time_minutes ?? printAnalysis.estimated_time_minutes ?? ""),
  );

  useEffect(() => {
    setWeight(String(printAnalysis.actual_weight_grams ?? printAnalysis.weight_grams ?? ""));
    setTime(String(printAnalysis.actual_time_minutes ?? printAnalysis.estimated_time_minutes ?? ""));
  }, [printAnalysis]);

  const estimatedWeight = printAnalysis.weight_grams;
  const estimatedTime = printAnalysis.estimated_time_minutes;
  const hasActuals =
    printAnalysis.actual_weight_grams != null || printAnalysis.actual_time_minutes != null;

  const downloadStl = async () => {
    try {
      const res = await apiClient.getPrintAnalysisStlPresign(printAnalysis.id);
      if (res.error || !res.data?.url) {
        throw new Error(res.error || "Failed to generate download link");
      }
      const url = String(res.data.url);
      const absolute = /^https?:\/\//i.test(url)
        ? url
        : `${getApiOrigin()}${url.startsWith("/") ? url : `/${url}`}`;

      // If backend returns an internal API URL (local filesystem storage),
      // download via authenticated fetch so it doesn't open DRF 403 in a new tab.
      if (!/^https?:\/\//i.test(url) || absolute.includes("/api/print-analyses/")) {
        const token = apiClient.getToken?.();
        const dl = await fetch(absolute, {
          method: "GET",
          headers: {
            ...(token ? { Authorization: `Token ${token}` } : {}),
          },
        });
        if (!dl.ok) {
          const text = await dl.text().catch(() => "");
          throw new Error(text || `Download failed (HTTP ${dl.status})`);
        }
        const blob = await dl.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = printAnalysis.stl_filename || "model.stl";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(objectUrl);
        return;
      }

      // Presigned S3 URL: safe to open directly.
      window.open(absolute, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to download STL");
    }
  };

  const handleSave = async () => {
    const weightNum = ceilPrintWeightGrams(weight);
    const timeNum = parseInt(time, 10);
    if (weightNum <= 0) {
      toast.error("Enter a valid actual weight (g).");
      return;
    }
    if (!Number.isFinite(timeNum) || timeNum <= 0) {
      toast.error("Enter a valid actual print time (minutes).");
      return;
    }
    setSaving(true);
    try {
      const res = await apiClient.updateBookingPrintActuals(bookingId, {
        actual_weight_grams: weightNum,
        actual_time_minutes: timeNum,
      });
      if (res.error) throw new Error(res.error);
      const updatedBooking = res.data?.booking;
      const updatedAnalysis = (res.data as { print_analysis?: PrintAnalysisResult } | undefined)?.print_analysis;
      const summary = res.data?.charge_recalculation_summary;
      if (summary?.refund_amount) {
        toast.success(`Actuals saved. Refund of ₹${summary.refund_amount} pending — use Refund to credit wallet.`);
      } else if (summary?.extra_amount) {
        toast.success(`Actuals saved. Extra ₹${summary.extra_amount} to pay — use Pay Now.`);
      } else if (enableChargeRecalculation) {
        toast.success("Actual weight and time updated. Charges recalculated.");
      } else {
        toast.success("Actual weight and time updated.");
      }
      setEditing(false);
      onUpdated?.({ booking: updatedBooking, print_analysis: updatedAnalysis });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update actuals");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-base font-medium">3D print details</p>
        <div className="flex items-center gap-2">
          {printAnalysis.stl_download_url && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void downloadStl()}
            >
              <Download className="h-4 w-4 mr-1" />
              Download STL
            </Button>
          )}
          {canEdit && !editing && (
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4 mr-1" />
              {hasActuals ? "Edit actuals" : "Set actual weight & time"}
            </Button>
          )}
        </div>
      </div>

      {printAnalysis.stl_filename && (
        <p className="text-sm text-muted-foreground">
          STL: <span className="text-foreground font-medium">{printAnalysis.stl_filename}</span>
        </p>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-muted-foreground">Estimated weight</dt>
          <dd className="font-medium">
            {estimatedWeight != null ? formatPrintWeightGrams(estimatedWeight) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Estimated time</dt>
          <dd className="font-medium">
            {estimatedTime != null ? `${estimatedTime} min` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Actual weight</dt>
          <dd className="font-medium">
            {printAnalysis.actual_weight_grams != null
              ? formatPrintWeightGrams(printAnalysis.actual_weight_grams)
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Actual time</dt>
          <dd className="font-medium">
            {printAnalysis.actual_time_minutes != null
              ? `${printAnalysis.actual_time_minutes} min`
              : "—"}
          </dd>
        </div>
        {printAnalysis.material_name && (
          <div>
            <dt className="text-muted-foreground">Material</dt>
            <dd className="font-medium">{printAnalysis.material_name}</dd>
          </div>
        )}
        {printAnalysis.slicer_settings && (
          <>
            <div>
              <dt className="text-muted-foreground">Layer height</dt>
              <dd className="font-medium">
                {printAnalysis.slicer_settings.layer_height_mm != null
                  ? `${printAnalysis.slicer_settings.layer_height_mm} mm`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Infill</dt>
              <dd className="font-medium">
                {printAnalysis.slicer_settings.infill_percent != null
                  ? `${printAnalysis.slicer_settings.infill_percent}%`
                  : "—"}
              </dd>
            </div>
          </>
        )}
      </dl>

      {editing && canEdit && (
        <>
          <Separator />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="actual-weight">Actual weight (g)</Label>
              <Input
                id="actual-weight"
                type="number"
                min={1}
                step={1}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="actual-time">Actual print time (min)</Label>
              <Input
                id="actual-time"
                type="number"
                min={1}
                step={1}
                value={time}
                onChange={(e) => setTime(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>
          {enableChargeRecalculation && (
            <p className="text-xs text-muted-foreground">
              Saving will recalculate charges. Any difference will be refunded or collected via Pay Now.
            </p>
          )}
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving}>
              <Check className="h-4 w-4 mr-1" />
              {saving ? "Saving…" : "Save & update charges"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => {
                setWeight(String(printAnalysis.actual_weight_grams ?? printAnalysis.weight_grams ?? ""));
                setTime(String(printAnalysis.actual_time_minutes ?? printAnalysis.estimated_time_minutes ?? ""));
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
