import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { apiClient, getApiOrigin, type PrintAnalysisResult } from "@/lib/api";
import { formatINR } from "@/lib/money";
import { ceilPrintWeightGrams, formatPrintWeightGrams } from "@/components/Print3DBookingPanel";
import { Pencil, Check } from "lucide-react";
import { Download } from "lucide-react";

interface Print3DBookingActualsProps {
  printAnalysis: PrintAnalysisResult;
  /** All STL files of the booking; a file picker is shown when there is more than one. */
  printAnalyses?: PrintAnalysisResult[];
  bookingId: number;
  canEdit?: boolean;
  /** Current booking amount and pending adjustment (negative = refund, positive = extra to pay). */
  totalCharge?: string | number | null;
  pendingAmount?: string | number | null;
  /** Called after save with latest booking payload (no navigation). */
  onUpdated?: (payload?: { booking?: any; print_analysis?: PrintAnalysisResult }) => void;
}

function hasActuals(a: PrintAnalysisResult): boolean {
  return a.actual_weight_grams != null || a.actual_time_minutes != null;
}

export function Print3DBookingActuals({
  printAnalysis,
  printAnalyses,
  bookingId,
  canEdit = false,
  totalCharge,
  pendingAmount,
  onUpdated,
}: Print3DBookingActualsProps) {
  const files = useMemo(
    () => (printAnalyses && printAnalyses.length > 0 ? printAnalyses : [printAnalysis]),
    [printAnalyses, printAnalysis],
  );
  const [selectedId, setSelectedId] = useState(printAnalysis.id);
  const selected = files.find((f) => f.id === selectedId) ?? files[0];
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [weight, setWeight] = useState(String(selected.actual_weight_grams ?? selected.weight_grams ?? ""));
  const [time, setTime] = useState(String(selected.actual_time_minutes ?? selected.estimated_time_minutes ?? ""));

  useEffect(() => {
    setWeight(String(selected.actual_weight_grams ?? selected.weight_grams ?? ""));
    setTime(String(selected.actual_time_minutes ?? selected.estimated_time_minutes ?? ""));
  }, [selected]);

  const estimatedWeight = selected.weight_grams;
  const estimatedTime = selected.estimated_time_minutes;
  const selectedHasActuals = hasActuals(selected);
  const anyActuals = files.some(hasActuals);
  const pending = Number(pendingAmount ?? 0);
  const total = totalCharge != null && totalCharge !== "" ? Number(totalCharge) : null;

  const downloadStl = async () => {
    try {
      const res = await apiClient.getPrintAnalysisStlPresign(selected.id);
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
        a.download = selected.stl_filename || "model.stl";
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
        ...(files.length > 1 ? { analysis_id: selected.id } : {}),
        actual_weight_grams: weightNum,
        actual_time_minutes: timeNum,
      });
      if (res.error) throw new Error(res.error);
      const updatedBooking = res.data?.booking;
      const updatedAnalysis = res.data?.print_analysis;
      const summary = res.data?.charge_recalculation_summary;
      if (summary?.refund_amount) {
        toast.success(
          `Actuals saved. The charge is now ${formatINR(summary.new_charge)}; the refund of ${formatINR(summary.refund_amount)} waits for Confirm refund.`,
        );
      } else if (summary?.extra_amount) {
        toast.success(
          `Actuals saved. The charge is now ${formatINR(summary.new_charge)}; ${formatINR(summary.extra_amount)} more is to be paid.`,
        );
      } else {
        toast.success(res.data?.message || "Actual weight and time saved.");
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
    <div className="mt-4 pt-4 border-t space-y-3" data-testid="print-actuals">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-base font-medium">3D print details</p>
        <div className="flex flex-wrap items-center gap-2">
          {selected.stl_download_url && (
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
              {selectedHasActuals ? "Edit actuals" : "Set actual weight & time"}
            </Button>
          )}
        </div>
      </div>

      {files.length > 1 ? (
        <div className="space-y-1">
          <Label htmlFor={`print-actuals-file-${bookingId}`} className="text-sm text-muted-foreground">
            File ({files.length} files in this booking)
          </Label>
          <Select value={selected.id} onValueChange={setSelectedId} disabled={saving}>
            <SelectTrigger id={`print-actuals-file-${bookingId}`} className="w-full sm:max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {files.map((f, i) => (
                <SelectItem key={f.id} value={f.id}>
                  {`${i + 1}. ${f.stl_filename || f.id}${hasActuals(f) ? " (actuals set)" : ""}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        selected.stl_filename && (
          <p className="text-sm text-muted-foreground">
            STL: <span className="text-foreground font-medium">{selected.stl_filename}</span>
          </p>
        )
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
            {selected.actual_weight_grams != null
              ? formatPrintWeightGrams(selected.actual_weight_grams)
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Actual time</dt>
          <dd className="font-medium">
            {selected.actual_time_minutes != null
              ? `${selected.actual_time_minutes} min`
              : "—"}
          </dd>
        </div>
        {selected.material_name && (
          <div>
            <dt className="text-muted-foreground">Material</dt>
            <dd className="font-medium">{selected.material_name}</dd>
          </div>
        )}
        {selected.slicer_settings && (
          <>
            <div>
              <dt className="text-muted-foreground">Layer height</dt>
              <dd className="font-medium">
                {selected.slicer_settings.layer_height_mm != null
                  ? `${selected.slicer_settings.layer_height_mm} mm`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Infill</dt>
              <dd className="font-medium">
                {selected.slicer_settings.infill_percent != null
                  ? `${selected.slicer_settings.infill_percent}%`
                  : "—"}
              </dd>
            </div>
          </>
        )}
      </dl>

      {(anyActuals || pending !== 0) && total !== null && (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm" data-testid="print-actuals-amount">
          <p>
            <span className="text-muted-foreground">Booking amount: </span>
            <span className="font-semibold tabular-nums">{formatINR(total)}</span>
            {anyActuals && <span className="text-muted-foreground"> (charged on the actual weight and time)</span>}
          </p>
          {pending < 0 && (
            <p className="text-success-subtle-foreground">
              Refund of {formatINR(Math.abs(pending))} is waiting for the Officer In Charge&apos;s confirmation (see the charge
              recalculation summary below).
            </p>
          )}
          {pending > 0 && (
            <p className="text-warning-subtle-foreground">
              {formatINR(pending)} more is to be paid (see the charge recalculation summary below).
            </p>
          )}
        </div>
      )}

      {editing && canEdit && (
        <>
          <Separator />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="actual-weight">
                Actual weight (g){files.length > 1 ? ", all copies of this file" : ""}
              </Label>
              <Input
                id="actual-weight"
                type="number"
                inputMode="numeric"
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
                inputMode="numeric"
                min={1}
                step={1}
                value={time}
                onChange={(e) => setTime(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Saving recalculates the booking amount with the same rates and GST as the estimate. A lower amount becomes a
            refund that the Officer In Charge confirms; a higher amount is collected with Deduct Money or the user&apos;s
            Pay Now.
          </p>
          <div className="flex flex-wrap gap-2">
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
                setWeight(String(selected.actual_weight_grams ?? selected.weight_grams ?? ""));
                setTime(String(selected.actual_time_minutes ?? selected.estimated_time_minutes ?? ""));
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
