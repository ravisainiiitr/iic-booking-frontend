import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import DashboardHeader from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
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
import { ArrowLeft, CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

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

function statusBadgeClass(status: string) {
  switch (status) {
    case "PENDING":
      return "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-700";
    case "APPROVED":
      return "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-700";
    case "REJECTED":
      return "bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-900/40 dark:text-rose-100 dark:border-rose-700";
    default:
      return "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-100";
  }
}

const EquipmentAdditionRequests = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const normalizedUserType = String(user?.user_type || "").toLowerCase();
  const isAdmin = normalizedUserType === "admin";
  const isDeptAdmin = normalizedUserType === "dept_admin";

  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [rows, setRows] = useState<AdditionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdditionRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [editDraft, setEditDraft] = useState({
    name: "",
    code: "",
    location: "",
    description: "",
    notes: "",
    make: "",
    model_information: "",
  });

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
    if (!isAdmin && !isDeptAdmin) {
      toast.error("Only Main Admin or Department Admin can open equipment addition requests.");
      navigate("/dashboard");
      return;
    }
    load();
  }, [authLoading, isAuthenticated, user?.id, isAdmin, isDeptAdmin, navigate, load]);

  const handleSaveEdits = async () => {
    if (!selected || selected.status !== "PENDING") return;
    setActionLoading(true);
    try {
      const res = await apiClient.adminUpdateEquipmentAdditionRequest(selected.id, {
        name: editDraft.name,
        code: editDraft.code,
        location: editDraft.location,
        description: editDraft.description,
        notes: editDraft.notes,
        make: editDraft.make,
        model_information: editDraft.model_information,
      });
      if (res.error || !res.data) {
        toast.error(res.error || "Failed to save changes.");
        return;
      }
      toast.success("Request updated.");
      const updated = res.data as AdditionRequest;
      setSelected(updated);
      setEditDraft({
        name: updated.name || "",
        code: updated.code || "",
        location: updated.location || "",
        description: updated.description || "",
        notes: updated.notes || "",
        make: updated.make || "",
        model_information: updated.model_information || "",
      });
      load();
    } finally {
      setActionLoading(false);
    }
  };

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

  if (!isAdmin && !isDeptAdmin && !authLoading) return null;

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-teal-800 via-teal-700 to-cyan-800 p-6 text-white shadow-xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <Button
                variant="ghost"
                size="sm"
                className="mb-3 -ml-2 text-white hover:text-white hover:bg-white/20"
                onClick={() => navigate("/admin-settings/equipment")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Equipment settings
              </Button>
              <h1 className="text-2xl font-semibold tracking-tight text-white">Equipment addition requests</h1>
              <p className="mt-2 text-sm text-teal-50/95 max-w-2xl">
                {isAdmin
                  ? "Review public proposals from /propose-equipment. Approve creates equipment under maintenance."
                  : "Track your department's equipment addition requests submitted for Main Admin approval."}
              </p>
            </div>
            <div className="w-[220px] space-y-1">
              <Label className="text-teal-50 text-xs">Filter by status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-white text-slate-900 border-0 shadow-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white text-slate-900">
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                  <SelectItem value="ALL">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Card className="border-0 shadow-md overflow-hidden">
          <CardHeader className="bg-slate-50 dark:bg-slate-900/60 border-b">
            <CardTitle className="text-base text-foreground">Requests</CardTitle>
            <CardDescription className="text-muted-foreground">{rows.length} shown</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">No requests in this filter.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-foreground font-semibold">Code</TableHead>
                      <TableHead className="text-foreground font-semibold">Name</TableHead>
                      <TableHead className="text-foreground font-semibold">Submitter</TableHead>
                      <TableHead className="text-foreground font-semibold">Department</TableHead>
                      <TableHead className="text-foreground font-semibold">Status</TableHead>
                      <TableHead className="text-foreground font-semibold text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id} className="hover:bg-teal-50/40 dark:hover:bg-teal-950/20">
                        <TableCell className="font-semibold text-foreground">{r.code}</TableCell>
                        <TableCell className="text-foreground">{r.name}</TableCell>
                        <TableCell>
                          <div className="text-sm text-foreground">{r.submitter_name}</div>
                          <div className="text-xs text-muted-foreground">{r.submitter_email}</div>
                        </TableCell>
                        <TableCell className="text-foreground">{r.internal_department_name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("border font-medium", statusBadgeClass(r.status))}>
                            {r.status === "PENDING" && <Clock className="h-3 w-3 mr-1" />}
                            {r.status === "APPROVED" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                            {r.status === "REJECTED" && <XCircle className="h-3 w-3 mr-1" />}
                            {r.status_display || r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            className="bg-teal-700 hover:bg-teal-800 text-white"
                            onClick={() => {
                              setSelected(r);
                              setReviewNotes(r.review_notes || "");
                              setEditDraft({
                                name: r.name || "",
                                code: r.code || "",
                                location: r.location || "",
                                description: r.description || "",
                                notes: r.notes || "",
                                make: r.make || "",
                                model_information: r.model_information || "",
                              });
                            }}
                          >
                            {isAdmin ? "Review" : "View"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto bg-background text-foreground">
            <DialogHeader>
              <DialogTitle className="text-foreground pr-6">
                {selected?.code} — {selected?.name}
              </DialogTitle>
              {selected && (
                <Badge variant="outline" className={cn("w-fit border font-medium mt-1", statusBadgeClass(selected.status))}>
                  {selected.status_display || selected.status}
                </Badge>
              )}
            </DialogHeader>
            {selected && (
              <div className="space-y-3 text-sm text-foreground">
                {isAdmin && selected.status === "PENDING" ? (
                  <div className="rounded-lg border bg-muted/40 p-3 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Edit details before approving. Changes are saved to the request and notified to the submitter.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label>Code</Label>
                        <Input
                          value={editDraft.code}
                          onChange={(e) => setEditDraft((p) => ({ ...p, code: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Name</Label>
                        <Input
                          value={editDraft.name}
                          onChange={(e) => setEditDraft((p) => ({ ...p, name: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Make</Label>
                        <Input
                          value={editDraft.make}
                          onChange={(e) => setEditDraft((p) => ({ ...p, make: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Model</Label>
                        <Input
                          value={editDraft.model_information}
                          onChange={(e) =>
                            setEditDraft((p) => ({ ...p, model_information: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Location</Label>
                      <Input
                        value={editDraft.location}
                        onChange={(e) => setEditDraft((p) => ({ ...p, location: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Description</Label>
                      <Textarea
                        value={editDraft.description}
                        onChange={(e) => setEditDraft((p) => ({ ...p, description: e.target.value }))}
                        rows={2}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Submitter notes</Label>
                      <Textarea
                        value={editDraft.notes}
                        onChange={(e) => setEditDraft((p) => ({ ...p, notes: e.target.value }))}
                        rows={2}
                      />
                    </div>
                    <Button type="button" variant="secondary" size="sm" onClick={handleSaveEdits} disabled={actionLoading}>
                      Save changes
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-lg border bg-muted/40 p-3 space-y-1">
                    <p><span className="font-semibold">Make / model / year:</span> {selected.make || "—"} / {selected.model_information || "—"} / {selected.year_of_installation || "—"}</p>
                    <p><span className="font-semibold">Location:</span> {selected.location || "—"}</p>
                    <p><span className="font-semibold">Department:</span> {selected.internal_department_name || "—"}</p>
                  </div>
                )}
                {!(isAdmin && selected.status === "PENDING") && (
                  <p><span className="font-semibold">Description:</span> {selected.description || "—"}</p>
                )}
                <p className="whitespace-pre-wrap"><span className="font-semibold">Specifications:</span> {selected.specifications || "—"}</p>
                <p className="whitespace-pre-wrap"><span className="font-semibold">Sample requirements:</span> {selected.sample_requirements || "—"}</p>
                <p>
                  <span className="font-semibold">Slots:</span>{" "}
                  {selected.slots_per_day ?? "—"} / day, {selected.slot_duration_minutes ?? "—"} min,{" "}
                  {selected.slot_start_time || "—"}–{selected.slot_end_time || "—"}
                </p>
                <div className="rounded-lg border p-3">
                  <p className="font-semibold mb-2">Category charges</p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-muted-foreground">
                    <li>IITR Students: <span className="text-foreground">{selected.charge_iitr_student || "—"}</span></li>
                    <li>IITR Faculty: <span className="text-foreground">{selected.charge_iitr_faculty || "—"}</span></li>
                    <li>Educational: <span className="text-foreground">{selected.charge_external_educational_student || "—"}</span></li>
                    <li>Govt R&amp;D: <span className="text-foreground">{selected.charge_external_govt_rnd || "—"}</span></li>
                    <li>Industry: <span className="text-foreground">{selected.charge_industry || "—"}</span></li>
                    <li>Startup IITR: <span className="text-foreground">{selected.charge_startup_incubated_iitr || "—"}</span></li>
                    <li>Startup/MSME: <span className="text-foreground">{selected.charge_external_startup_msme || "—"}</span></li>
                  </ul>
                </div>
                <p>
                  <span className="font-semibold">Proposed OIC:</span>{" "}
                  {selected.proposed_oic_name || "—"} {selected.proposed_oic_email ? `(${selected.proposed_oic_email})` : ""}
                </p>
                <p>
                  <span className="font-semibold">Proposed operator:</span>{" "}
                  {selected.proposed_operator_name || "—"}{" "}
                  {selected.proposed_operator_email ? `(${selected.proposed_operator_email})` : ""}
                </p>
                {!(isAdmin && selected.status === "PENDING") && (
                  <p><span className="font-semibold">Submitter notes:</span> {selected.notes || "—"}</p>
                )}
                <p><span className="font-semibold">Department:</span> {selected.internal_department_name || "—"}</p>
                {isAdmin && selected.status === "PENDING" && (
                  <div className="space-y-2 pt-2 border-t">
                    <Label htmlFor="review-notes" className="text-foreground">Review notes</Label>
                    <Textarea
                      id="review-notes"
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      rows={3}
                      className="bg-background text-foreground"
                    />
                  </div>
                )}
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setSelected(null)} disabled={actionLoading}>
                Close
              </Button>
              {isAdmin && selected?.status === "PENDING" && (
                <>
                  <Button variant="destructive" onClick={handleReject} disabled={actionLoading}>
                    Reject
                  </Button>
                  <Button className="bg-teal-700 hover:bg-teal-800 text-white" onClick={handleApprove} disabled={actionLoading}>
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
