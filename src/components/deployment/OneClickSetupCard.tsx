import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HardDrive, KeyRound, Loader2, Wrench } from "lucide-react";

type Department = { id: number; name: string; code: string };
type EquipmentRow = { equipment_id: number; code: string; name: string; internal_department?: number | null };

const KEY_TTLS = [
  { hours: 2, label: "2 hours" },
  { hours: 4, label: "4 hours" },
  { hours: 8, label: "8 hours" },
  { hours: 24, label: "24 hours" },
];

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

/** Same-origin ticket URL → the browser streams the file natively (no blob in memory). */
function startNativeDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Deployment Center → One-click setup.
 * DSA: the download carries a single-use setup key for one department (expires in ≤ 24 h).
 * Equipment PC: the wizard is named for one instrument, so it configures that PC without questions.
 */
export default function OneClickSetupCard() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [equipment, setEquipment] = useState<EquipmentRow[]>([]);
  const [departmentId, setDepartmentId] = useState<number | "">("");
  const [ttlHours, setTtlHours] = useState(4);
  const [equipmentId, setEquipmentId] = useState<number | "">("");
  const [dataFolder, setDataFolder] = useState("");
  const [busy, setBusy] = useState<"dsa" | "wizard" | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await apiClient.getDepartments("internal");
      if (!res.error && res.data) {
        setDepartments(
          (res.data.departments || [])
            .map((d) => ({ id: d.id, name: d.name, code: d.code }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      }
    })();
  }, []);

  useEffect(() => {
    setEquipmentId("");
    if (departmentId === "") {
      setEquipment([]);
      return;
    }
    void (async () => {
      const res = await apiClient.getEquipments(undefined, undefined, undefined, false, departmentId, "all");
      if (!res.error && res.data) {
        setEquipment(
          (res.data.equipments || [])
            .filter((e) => Boolean(e.code))
            .map((e) => ({ equipment_id: e.equipment_id, code: e.code, name: e.name }))
            .sort((a, b) => a.code.localeCompare(b.code)),
        );
      }
    })();
  }, [departmentId]);

  const department = useMemo(() => departments.find((d) => d.id === departmentId), [departments, departmentId]);

  const downloadDsa = async () => {
    if (departmentId === "") {
      toast.error("Choose the department this DSA serves.");
      return;
    }
    setBusy("dsa");
    try {
      const res = await apiClient.createDsaOneClickTicket({ department_id: departmentId, ttl_hours: ttlHours });
      if (res.error || !res.data) {
        toast.error(res.error || "Could not prepare the one-click installer.");
        return;
      }
      startNativeDownload(res.data.url, res.data.filename);
      toast.success(
        `Downloading ${res.data.filename}. It enrols one DSA for ${res.data.department || "this department"} and stops working after ${res.data.key_ttl_hours} h or first use.`,
      );
    } finally {
      setBusy(null);
    }
  };

  const downloadWizard = async () => {
    if (equipmentId === "") {
      toast.error("Choose the instrument this Equipment PC runs.");
      return;
    }
    setBusy("wizard");
    try {
      const res = await apiClient.createEquipmentWizardOneClickTicket({
        equipment_id: equipmentId,
        data_folder: dataFolder.trim() || undefined,
      });
      if (res.error || !res.data) {
        toast.error(res.error || "Could not prepare the one-click wizard.");
        return;
      }
      startNativeDownload(res.data.url, res.data.filename);
      toast.success(`Downloading ${res.data.filename} for ${res.data.equipment_code}.`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <KeyRound className="h-5 w-5" />
          One-click setup
        </CardTitle>
        <CardDescription>
          Download installers that set up a PC with a double-click — no sign-in, no choices on the lab PC.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 font-medium">
            <HardDrive className="h-4 w-4" />
            Department Sync Agent
          </h3>
          <div className="space-y-1.5">
            <Label htmlFor="oc-dept">Department</Label>
            <select
              id="oc-dept"
              className={selectClass}
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Choose a department…</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="oc-ttl">Installer stops working after</Label>
            <select
              id="oc-ttl"
              className={selectClass}
              value={ttlHours}
              onChange={(e) => setTtlHours(Number(e.target.value))}
            >
              {KEY_TTLS.map((t) => (
                <option key={t.hours} value={t.hours}>
                  {t.label} (or first use)
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted-foreground">
            The file can enrol one DSA for {department ? department.name : "the chosen department"} until it is used
            or expires. Keep it like a key and run it only on the department&apos;s DSA PC.
          </p>
          <Button onClick={() => void downloadDsa()} disabled={busy !== null || departmentId === ""}>
            {busy === "dsa" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Download one-click DSA installer
          </Button>
        </section>

        <section className="space-y-3">
          <h3 className="flex items-center gap-2 font-medium">
            <Wrench className="h-4 w-4" />
            Equipment PC
          </h3>
          <div className="space-y-1.5">
            <Label htmlFor="oc-eq">Instrument</Label>
            <select
              id="oc-eq"
              className={selectClass}
              value={equipmentId}
              disabled={departmentId === ""}
              onChange={(e) => setEquipmentId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">{departmentId === "" ? "Choose a department first" : "Choose an instrument…"}</option>
              {equipment.map((e) => (
                <option key={e.equipment_id} value={e.equipment_id}>
                  {e.code} — {e.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="oc-folder">Data folder on the instrument PC (optional)</Label>
            <Input
              id="oc-folder"
              placeholder="Default: D:\<CODE> (or C:\<CODE>)"
              value={dataFolder}
              onChange={(e) => setDataFolder(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Copy the file to the instrument PC (connected to the Equipment Network) and double-click it. It finds the
            DSA, selects this instrument, shares the folder and installs the agent. Nothing secret is in this file.
          </p>
          <Button
            variant="outline"
            onClick={() => void downloadWizard()}
            disabled={busy !== null || equipmentId === ""}
          >
            {busy === "wizard" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Download one-click wizard
          </Button>
        </section>
      </CardContent>
    </Card>
  );
}
