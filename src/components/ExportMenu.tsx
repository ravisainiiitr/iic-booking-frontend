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
import { apiClient, type ReportExportFormat, type ReportExportParams } from "@/lib/api";
import { cn } from "@/lib/utils";

const FORMATS: Array<{ format: ReportExportFormat; label: string; hint: string; icon: typeof FileText }> = [
  { format: "xlsx", label: "Excel (.xlsx)", hint: "Formatted workbook", icon: FileSpreadsheet },
  { format: "csv", label: "CSV", hint: "Plain data", icon: Sheet },
  { format: "pdf", label: "PDF", hint: "Printable report", icon: FileText },
];

export type ExportMenuProps = {
  /** Report key served by GET /api/exports/<report>/. */
  report: string;
  /** Read when a format is chosen, so the file always uses the filters, search and sort on screen. */
  getParams?: () => ReportExportParams;
  /** One section of a multi-table report (backend ``table`` key). */
  table?: string;
  label?: string;
  /** Shown at the top of the menu, e.g. "All requests matching the filters". */
  description?: string;
  /** Plural noun for the success toast, e.g. "requests". */
  noun?: string;
  disabled?: boolean;
  size?: "sm" | "default";
  className?: string;
  /** Page-specific downloads listed under the standard formats (e.g. an emailed PDF layout). */
  extraItems?: Array<{ label: string; icon?: typeof FileText; onSelect: () => void; disabled?: boolean }>;
};

export function ExportMenu({
  report,
  getParams,
  table,
  label = "Export",
  description = "All rows matching the filters",
  noun = "rows",
  disabled,
  size = "sm",
  className,
  extraItems,
}: ExportMenuProps) {
  const [busy, setBusy] = useState<ReportExportFormat | null>(null);

  const runExport = async (format: ReportExportFormat) => {
    if (busy) return;
    setBusy(format);
    try {
      const params: ReportExportParams = { ...(getParams?.() ?? {}) };
      if (table) params.table = table;
      const res = await apiClient.downloadReportExport(report, format, params);
      if (res.error) {
        toast.error(res.error);
      } else if (res.rowCount === 0) {
        toast.info("Nothing matches these filters; the file has only the headings.");
      } else if (res.rowCount != null) {
        toast.success(`Exported ${res.rowCount.toLocaleString("en-IN")} ${res.rowCount === 1 ? noun.replace(/s$/, "") : noun}.`);
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
          size={size}
          className={cn(size === "sm" && "h-9", "shrink-0 gap-1.5", className)}
          disabled={disabled || busy != null}
          aria-busy={busy != null || undefined}
          title={description}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
          {busy ? "Exporting…" : label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{description}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {FORMATS.map(({ format, label: formatLabel, hint, icon: Icon }) => (
          <DropdownMenuItem key={format} onSelect={() => void runExport(format)} className="gap-2">
            <Icon className="h-4 w-4" aria-hidden />
            <span className="flex-1">{formatLabel}</span>
            <span className="text-[11px] text-muted-foreground">{hint}</span>
          </DropdownMenuItem>
        ))}
        {extraItems?.length ? (
          <>
            <DropdownMenuSeparator />
            {extraItems.map(({ label: itemLabel, icon: Icon = FileText, onSelect, disabled: itemDisabled }) => (
              <DropdownMenuItem key={itemLabel} onSelect={onSelect} disabled={itemDisabled} className="gap-2">
                <Icon className="h-4 w-4" aria-hidden />
                {itemLabel}
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
