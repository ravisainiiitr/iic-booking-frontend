import { useEffect, useState } from "react";
import { Building2, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import {
  buildEquipmentBrochureInput,
  departmentBrochureFilename,
  exportDepartmentBrochurePdf,
  type BrochureSourceEquipment,
  type EquipmentBrochurePdfInput,
} from "@/lib/equipmentBrochurePdf";
import { findPreferredDepartment, type CatalogDepartment } from "@/components/DepartmentFilter";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DEFAULT_BROCHURE_DEPARTMENT = "Institute Instrumentation Centre";
const DETAIL_FETCH_CONCURRENCY = 4;

interface DepartmentBrochureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ListEquipment = {
  equipment_id: number;
  name: string;
  code?: string | null;
  location?: string | null;
  status?: string | null;
  status_display?: string | null;
};

const DepartmentBrochureDialog = ({ open, onOpenChange }: DepartmentBrochureDialogProps) => {
  const [departments, setDepartments] = useState<CatalogDepartment[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>("");

  useEffect(() => {
    if (!open || departments.length > 0) return;
    let cancelled = false;
    (async () => {
      setLoadingDepartments(true);
      try {
        const res = await apiClient.getCatalogDepartments();
        if (cancelled) return;
        if (res.error || !res.data) {
          toast.error(res.error || "Could not load departments.");
          return;
        }
        const list = (res.data.departments ?? []).filter((d) => {
          const name = (d.name || "").trim().toLowerCase();
          const code = (d.code || "").trim().toLowerCase();
          return name !== "admin" && code !== "admin";
        });
        setDepartments(list);
        const preferred = findPreferredDepartment(list, DEFAULT_BROCHURE_DEPARTMENT) ?? list[0];
        if (preferred) setSelectedId(String(preferred.id));
      } finally {
        if (!cancelled) setLoadingDepartments(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, departments.length]);

  const selectedDepartment = departments.find((d) => String(d.id) === selectedId);

  const handleDownload = async () => {
    if (!selectedDepartment || busy) return;
    setBusy(true);
    setProgress("Loading equipment list…");
    try {
      const listRes = await apiClient.getEquipments(
        undefined,
        undefined,
        undefined,
        false,
        selectedDepartment.id,
        "all",
      );
      if (listRes.error) throw new Error(listRes.error);
      const equipments = ((listRes.data?.equipments ?? []) as ListEquipment[])
        .filter(
          (eq) =>
            eq.status_display !== "Disposed" && String(eq.status || "").toUpperCase() !== "DISPOSED",
        )
        .sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }));

      if (equipments.length === 0) {
        toast.error(`No equipment is listed under ${selectedDepartment.name}.`);
        return;
      }

      const inputs: EquipmentBrochurePdfInput[] = new Array(equipments.length);
      let fetched = 0;
      let next = 0;
      const worker = async () => {
        while (next < equipments.length) {
          const idx = next++;
          const eq = equipments[idx];
          const detail = await apiClient.getEquipmentDetailById(eq.equipment_id);
          const source: BrochureSourceEquipment =
            !detail.error && detail.data
              ? (detail.data as unknown as BrochureSourceEquipment)
              : { equipment_id: eq.equipment_id, name: eq.name, code: eq.code, location: eq.location };
          inputs[idx] = buildEquipmentBrochureInput(source, selectedDepartment.name);
          fetched += 1;
          setProgress(`Fetching equipment details ${fetched} of ${equipments.length}…`);
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(DETAIL_FETCH_CONCURRENCY, equipments.length) }, worker),
      );

      await exportDepartmentBrochurePdf(selectedDepartment.name, inputs, {
        onProgress: (done, total) => setProgress(`Building PDF ${done} of ${total}…`),
      });
      toast.success(`${departmentBrochureFilename(selectedDepartment.name)} downloaded.`);
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Could not generate the brochure PDF. Please try again.");
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" aria-hidden />
            Download brochure
          </DialogTitle>
          <DialogDescription>
            Select a department / centre to download a combined brochure of all its listed equipment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="brochure-department" className="text-sm font-semibold">
            Department / Centre
          </Label>
          <Select
            value={selectedId}
            onValueChange={setSelectedId}
            disabled={loadingDepartments || busy}
          >
            <SelectTrigger id="brochure-department" className="h-11 text-sm font-semibold">
              <div className="flex items-center gap-2 min-w-0 w-full">
                {loadingDepartments ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                ) : (
                  <Building2 className="h-4 w-4 shrink-0 text-primary" />
                )}
                <SelectValue placeholder={loadingDepartments ? "Loading…" : "Select department"} />
              </div>
            </SelectTrigger>
            <SelectContent className="max-w-[min(100vw-2rem,28rem)]">
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={String(dept.id)} className="py-2.5">
                  <span className="whitespace-normal break-words leading-snug">
                    {`${dept.name}${dept.code ? ` (${dept.code})` : ""} · ${dept.equipment_count}`}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedDepartment ? (
            <p className="text-xs text-muted-foreground">
              File: <span className="font-medium">{departmentBrochureFilename(selectedDepartment.name)}</span>
            </p>
          ) : null}
          {busy && progress ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {progress}
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleDownload}
            disabled={!selectedDepartment || busy || loadingDepartments}
            className="gap-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DepartmentBrochureDialog;
