import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import DashboardHeader from "@/components/DashboardHeader";

type EquipmentOption = { equipment_id: number; name: string; code: string };
type WaitlistEntry = {
  id: number;
  position: number;
  user_id: number;
  user_email: string;
  user_name: string;
  created_at: string | null;
  booking_attempt_requested_at?: string | null;
  booking_attempt_failure_reason?: string | null;
  booking_attempt_number_of_samples?: number | null;
  booking_attempt_slots_requested?: number | null;
  booking_attempt_duration_minutes?: number | null;
  booking_attempt_additional_info?: any;
};
type WaitlistData = {
  equipment_id: number;
  equipment_code: string;
  equipment_name: string;
  waitlist_queue_depth: number;
  entries: WaitlistEntry[];
  count: number;
};

export default function EquipmentWaitlist() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userType = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const canView = userType === "admin" || userType === "manager"; // admin and OIC

  const [equipmentList, setEquipmentList] = useState<EquipmentOption[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<number | null>(null);
  const [waitlist, setWaitlist] = useState<WaitlistData | null>(null);
  const [loadingWaitlist, setLoadingWaitlist] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (!canView) {
      navigate("/dashboard");
      return;
    }
    (async () => {
      setLoadingList(true);
      // Backend restricts equipment list to OIC's managed equipment for managers
      const res = await apiClient.getEquipments();
      setLoadingList(false);
      const data = (res as { data?: { equipments?: Array<{ equipment_id?: number; id?: number; name?: string; code?: string }> } }).data
        ?? (res as { equipments?: Array<{ equipment_id?: number; id?: number; name?: string; code?: string }> });
      const arr = data?.equipments ?? [];
      if (Array.isArray(arr)) {
        setEquipmentList(
          arr
            .map((e) => ({
              equipment_id: e.equipment_id ?? e.id ?? 0,
              name: e.name ?? e.code ?? "",
              code: e.code ?? "",
            }))
            .filter((e) => e.equipment_id > 0)
        );
      } else {
        setEquipmentList([]);
      }
    })();
  }, [canView, navigate]);

  useEffect(() => {
    if (selectedEquipmentId == null) {
      setWaitlist(null);
      return;
    }
    setLoadingWaitlist(true);
    apiClient
      .getEquipmentWaitlist(selectedEquipmentId)
      .then((res) => {
        if (res.error) {
          toast.error(res.error);
          setWaitlist(null);
        } else if (res.data) setWaitlist(res.data as WaitlistData);
        else setWaitlist(null);
      })
      .catch(() => {
        toast.error("Failed to load waitlist");
        setWaitlist(null);
      })
      .finally(() => setLoadingWaitlist(false));
  }, [selectedEquipmentId]);

  const handleClearQueue = async () => {
    if (selectedEquipmentId == null) return;
    setClearing(true);
    try {
      const res = await apiClient.clearEquipmentWaitlist(selectedEquipmentId);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.data?.message ?? "Waitlist cleared.");
        setWaitlist((prev) =>
          prev ? { ...prev, entries: [], count: 0 } : null
        );
      }
    } finally {
      setClearing(false);
    }
  };

  const formatAttemptInputs = (additionalInfo: any) => {
    if (!additionalInfo || typeof additionalInfo !== "object") return "";
    const inputValues = additionalInfo.input_values ?? additionalInfo.inputValues ?? null;
    const selectedParams = additionalInfo.selected_parameters ?? additionalInfo.selectedParameters ?? null;

    const parts: string[] = [];
    if (inputValues && typeof inputValues === "object") {
      const entries = Object.entries(inputValues);
      if (entries.length) parts.push(`inputs: ${entries.map(([k, v]) => `${k}=${String(v)}`).slice(0, 6).join(", ")}${entries.length > 6 ? "…" : ""}`);
    }
    if (selectedParams != null) parts.push(`selected: ${typeof selectedParams === "string" ? selectedParams : JSON.stringify(selectedParams).slice(0, 80)}${JSON.stringify(selectedParams).length > 80 ? "…" : ""}`);
    return parts.join(" | ");
  };

  if (!canView) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/dashboard")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Equipment waitlist</CardTitle>
            <CardDescription>
              View and clear the waitlist queue for each equipment. When a booking attempt fails, users are added to the waitlist (if queue depth is set). They are notified when slots become available.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select equipment</label>
              <Select
                value={selectedEquipmentId != null ? String(selectedEquipmentId) : ""}
                onValueChange={(v) => setSelectedEquipmentId(v ? Number(v) : null)}
              >
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder="Choose equipment" />
                </SelectTrigger>
                <SelectContent>
                  {equipmentList.map((e) => (
                    <SelectItem key={e.equipment_id} value={String(e.equipment_id)}>
                      {e.code} – {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {loadingWaitlist && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading waitlist…
              </div>
            )}

            {!loadingWaitlist && waitlist && (
              <>
                <div className="flex flex-wrap items-center gap-4">
                  <p className="text-sm text-muted-foreground">
                    Queue depth: <strong>{waitlist.waitlist_queue_depth}</strong>
                    {waitlist.waitlist_queue_depth === 0 && " (waitlist disabled)"}
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleClearQueue}
                    disabled={waitlist.count === 0 || clearing}
                  >
                    {clearing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                    Clear queue
                  </Button>
                </div>
                {waitlist.entries.length === 0 ? (
                  <p className="text-muted-foreground">No one on the waitlist.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead>Last Attempt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {waitlist.entries.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">{e.position}</TableCell>
                          <TableCell>{e.user_name || "—"}</TableCell>
                          <TableCell>{e.user_email}</TableCell>
                          <TableCell>
                            {e.created_at ? format(new Date(e.created_at), "PPp") : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <div className="text-sm font-medium">
                                {e.booking_attempt_requested_at
                                  ? format(new Date(e.booking_attempt_requested_at), "PPp")
                                  : "—"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {e.booking_attempt_failure_reason || "—"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {[
                                  e.booking_attempt_number_of_samples != null ? `samples=${e.booking_attempt_number_of_samples}` : null,
                                  e.booking_attempt_slots_requested != null ? `slots=${e.booking_attempt_slots_requested}` : null,
                                  e.booking_attempt_duration_minutes != null ? `duration=${e.booking_attempt_duration_minutes}m` : null,
                                ]
                                  .filter(Boolean)
                                  .join(" • ") || "—"}
                              </div>
                              {(() => {
                                const details = formatAttemptInputs(e.booking_attempt_additional_info);
                                if (!details) return null;
                                return (
                                  <div className="text-xs text-muted-foreground" title={details}>
                                    {details}
                                  </div>
                                );
                              })()}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </>
            )}

            {!loadingList && equipmentList.length === 0 && (
              <p className="text-muted-foreground">No equipment found.</p>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
