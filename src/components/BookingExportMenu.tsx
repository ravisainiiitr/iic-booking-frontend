import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2, Sheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiClient, type BookingExportFormat, type BookingListFilters } from "@/lib/api";

const FORMATS: Array<{ format: BookingExportFormat; label: string; icon: typeof FileText }> = [
  { format: "xlsx", label: "Excel (.xlsx)", icon: FileSpreadsheet },
  { format: "csv", label: "CSV", icon: Sheet },
  { format: "pdf", label: "PDF", icon: FileText },
];

type BookingExportMenuProps = {
  view: "staff" | "my";
  /** Read when a format is chosen, so the export always uses the filters on screen. */
  getFilters: () => BookingListFilters;
  disabled?: boolean;
};

export function BookingExportMenu({ view, getFilters, disabled }: BookingExportMenuProps) {
  const [busy, setBusy] = useState<BookingExportFormat | null>(null);

  const runExport = async (format: BookingExportFormat) => {
    if (busy) return;
    setBusy(format);
    try {
      const res = await apiClient.exportBookings(format, view, getFilters());
      if (res.error) {
        toast.error(res.error);
      } else if (res.rowCount === 0) {
        toast.info("No bookings match these filters; the file has only the column headings.");
      } else if (res.rowCount != null) {
        toast.success(`Exported ${res.rowCount.toLocaleString("en-IN")} booking${res.rowCount === 1 ? "" : "s"}.`);
      }
    } catch {
      toast.error("Export failed. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0 gap-1.5"
          disabled={disabled || busy != null}
          aria-busy={busy != null || undefined}
          title="Download every booking matching the current filters"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
          {busy ? "Exporting…" : "Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          All bookings matching the filters
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {FORMATS.map(({ format, label, icon: Icon }) => (
          <DropdownMenuItem key={format} onSelect={() => void runExport(format)} className="gap-2">
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
