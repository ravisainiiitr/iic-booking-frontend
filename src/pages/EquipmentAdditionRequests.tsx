import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import DashboardHeader from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

type AdditionRequest = {
  id: number;
  status: string;
  status_display?: string;
  name: string;
  code: string;
  description?: string;
  make?: string;
  model_information?: string;
  year_of_installation?: string;
  location?: string;
  specifications?: string;
  sample_requirements?: string;
  slots_per_day?: number | null;
  slot_duration_minutes?: number | null;
  slot_start_time?: string | null;
  slot_end_time?: string | null;
  charge_calculation_basis?: string;
  time_calculation_basis?: string;
  charge_iitr_student?: string;
  charge_iitr_faculty?: string;
  charge_external_educational_student?: string;
  charge_external_govt_rnd?: string;
  charge_industry?: string;
  charge_startup_incubated_iitr?: string;
  charge_external_startup_msme?: string;
  equipment_image_url?: string | null;
  supporting_document_url?: string | null;
  supporting_document_name?: string | null;
  internal_department_name?: string | null;
  proposed_oic_name?: string;
  proposed_oic_email?: string;
  proposed_operator_name?: string;
  proposed_operator_email?: string;
  submitter_name: string;
  submitter_email: string;
  submitter_phone?: string;
  notes?: string;
  review_notes?: string;
  created_equipment_id?: number | null;
  created_equipment_code?: string | null;
  created_at?: string;
};

const EquipmentAdditionRequests = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const isAdmin = String(user?.user_type || "").toLowerCase() === "admin";

  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [rows, setRows] = useState<AdditionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdditionRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiClient
      .adminListEquipmentAdditionRequests(statusFilter)
      .then((res) => {
        if (res.error) {
          toast.error(res.error);
          setRows([]);
          return;
        }
        setRows((res.data?.results || []) as AdditionRequest[]);
      })
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!isAdmin) {
      toast.error("Only admin can review equipment addition requests.");
      navigate("/admin-settings");
      return;
    }
    load();
  }, [authLoading, isAuthenticated, user, isAdmin, navigate, load]);

  const handleApprove = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      const res = await apiClient.adminApproveEquipmentAdditionRequest(selected.id, reviewNotes);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.data?.message || "Approved.");
      const eid = res.data?.equipment_id;
      setSelected(null);
      setReviewNotes("");
      load();
      if (eid) {
        toast.message("Finish setup in Equipment admin", {
          description: "Add slots/charges, assign OIC, then set status to Operational.",
          action: {
            label: "Open equipment",
            onClick: () => navigate("/admin/section/equipment"),
          },
        });
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      const res = await apiClient.adminRejectEquipmentAdditionRequest(selected.id, reviewNotes);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.data?.message || "Rejected.");
      setSelected(null);
      setReviewNotes("");
      load();
    } finally {
      setActionLoading(false);
    }
  };

  if (!isAdmin && !authLoading) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <Button variant="ghost" size="sm" className="mb-2" onClick={() => navigate("/admin-settings/equipment")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Equipment settings
        </Button>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Equipment addition requests</h1>
            <p className="text-muted-foreground mt-1">
              Review public proposals from `/propose-equipment`. Approve creates equipment under maintenance.
            </p>
          </div>
          <div className="w-[200px]">
            <Label className="sr-only">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="ALL">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Requests</CardTitle>
            <CardDescription>{rows.length} shown</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No requests in this filter.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Submitter</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.code}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell>
                        <div className="text-sm">{r.submitter_name}</div>
                        <div className="text-xs text-muted-foreground">{r.submitter_email}</div>
                      </TableCell>
                      <TableCell>{r.internal_department_name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === "PENDING" ? "default" : "secondary"}>
                          {r.status_display || r.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => { setSelected(r); setReviewNotes(""); }}>
                          Review
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selected?.code} — {selected?.name}
              </DialogTitle>
              <DialogDescription>
                Status: {selected?.status_display || selected?.status}
              </DialogDescription>
            </DialogHeader>
            {selected && (
              <div className="space-y-3 text-sm">
                <p><span className="font-medium">Make / model / year:</span> {selected.make || "—"} / {selected.model_information || "—"} / {selected.year_of_installation || "—"}</p>
                <p><span className="font-medium">Location:</span> {selected.location || "—"}</p>
                <p><span className="font-medium">Department:</span> {selected.internal_department_name || "—"}</p>
                <p><span className="font-medium">Description:</span> {selected.description || "—"}</p>
                <p className="whitespace-pre-wrap"><span className="font-medium">Specifications:</span> {selected.specifications || "—"}</p>
                <p className="whitespace-pre-wrap"><span className="font-medium">Sample requirements:</span> {selected.sample_requirements || "—"}</p>
                <p>
                  <span className="font-medium">Slots:</span>{" "}
                  {selected.slots_per_day ?? "—"} / day, {selected.slot_duration_minutes ?? "—"} min,{" "}
                  {selected.slot_start_time || "—"}–{selected.slot_end_time || "—"}
                </p>
                <p className="whitespace-pre-wrap"><span className="font-medium">Charge basis:</span> {selected.charge_calculation_basis || "—"}</p>
                <p className="whitespace-pre-wrap"><span className="font-medium">Time basis:</span> {selected.time_calculation_basis || "—"}</p>
                <div>
                  <p className="font-medium mb-1">Category charges</p>
                  <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground">
                    <li>IITR Students: {selected.charge_iitr_student || "—"}</li>
                    <li>IITR Faculty: {selected.charge_iitr_faculty || "—"}</li>
                    <li>External Educational Student: {selected.charge_external_educational_student || "—"}</li>
                    <li>External Govt R&amp;D: {selected.charge_external_govt_rnd || "—"}</li>
                    <li>Industry: {selected.charge_industry || "—"}</li>
                    <li>Startup Incubated at IITR: {selected.charge_startup_incubated_iitr || "—"}</li>
                    <li>External Startup/MSME: {selected.charge_external_startup_msme || "—"}</li>
                  </ul>
                </div>
                {selected.equipment_image_url && (
                  <p>
                    <span className="font-medium">Image:</span>{" "}
                    <a className="text-primary underline" href={selected.equipment_image_url} target="_blank" rel="noreferrer">
                      View
                    </a>
                  </p>
                )}
                {selected.supporting_document_url && (
                  <p>
                    <span className="font-medium">Document:</span>{" "}
                    <a className="text-primary underline" href={selected.supporting_document_url} target="_blank" rel="noreferrer">
                      {selected.supporting_document_name || "Download"}
                    </a>
                  </p>
                )}
                <p>
                  <span className="font-medium">Proposed OIC:</span>{" "}
                  {selected.proposed_oic_name || "—"} {selected.proposed_oic_email ? `<${selected.proposed_oic_email}>` : ""}
                </p>
                <p>
                  <span className="font-medium">Proposed operator:</span>{" "}
                  {selected.proposed_operator_name || "—"}{" "}
                  {selected.proposed_operator_email ? `<${selected.proposed_operator_email}>` : ""}
                </p>
                <p><span className="font-medium">Submitter notes:</span> {selected.notes || "—"}</p>
                {selected.created_equipment_id != null && (
                  <p>
                    <span className="font-medium">Created equipment:</span>{" "}
                    #{selected.created_equipment_id} ({selected.created_equipment_code})
                  </p>
                )}
                {selected.status === "PENDING" && (
                  <div className="space-y-2 pt-2">
                    <Label htmlFor="review-notes">Review notes</Label>
                    <Textarea
                      id="review-notes"
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      rows={3}
                    />
                  </div>
                )}
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setSelected(null)} disabled={actionLoading}>
                Close
              </Button>
              {selected?.status === "PENDING" && (
                <>
                  <Button variant="destructive" onClick={handleReject} disabled={actionLoading}>
                    Reject
                  </Button>
                  <Button onClick={handleApprove} disabled={actionLoading}>
                    {actionLoading ? "Working…" : "Approve & create"}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default EquipmentAdditionRequests;
