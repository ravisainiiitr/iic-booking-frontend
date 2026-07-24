import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

type Eq = { equipment_id: number; code?: string; name?: string };
type ProcReq = Record<string, any>;

export default function ProcurementWorkflow() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userType = String(user?.user_type ?? "").toLowerCase();
  const isAdminPanel = ["admin", "manager", "operator", "finance"].includes(userType);

  const [loading, setLoading] = useState(true);
  const [equipments, setEquipments] = useState<Eq[]>([]);
  const [requests, setRequests] = useState<ProcReq[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [manualItemName, setManualItemName] = useState("");
  const [classification, setClassification] = useState<"MAS" | "MIA_LLTA" | "CS">("CS");
  const [quantity, setQuantity] = useState("1");
  const [tentativeCost, setTentativeCost] = useState("0");
  const [remarks, setRemarks] = useState("");
  const [creating, setCreating] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<number | null>(null);
  const [headMode, setHeadMode] = useState<"OFFLINE" | "EMAIL" | "NOT_REQUIRED">("NOT_REQUIRED");
  const [invoiceFileByReq, setInvoiceFileByReq] = useState<Record<number, File | null>>({});

  const loadData = async (equipmentId?: string, status?: string) => {
    setLoading(true);
    try {
      const eqRes = await apiClient.adminEquipmentList();
      const eq = (eqRes.data || []) as Eq[];
      setEquipments(eq);
      const effectiveEq = equipmentId || (eq[0] ? String(eq[0].equipment_id) : "");
      if (effectiveEq) setSelectedEquipmentId(effectiveEq);
      const res = await apiClient.getProcurementRequests({
        equipment_id: effectiveEq || undefined,
        status: status && status !== "ALL" ? status : undefined,
      });
      setRequests(res.data?.requests || []);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load procurement requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdminPanel) {
      toast.error("You are not authorized to access procurement workflow.");
      navigate("/dashboard");
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminPanel]);

  const createRequest = async () => {
    if (!selectedEquipmentId) return toast.error("Select equipment.");
    if (!manualItemName.trim()) return toast.error("Enter item name.");
    if (Number(quantity) <= 0) return toast.error("Quantity should be positive.");
    setCreating(true);
    const res = await apiClient.createProcurementRequest({
      equipment: Number(selectedEquipmentId),
      remarks,
      lines: [{
        manual_item_name: manualItemName.trim(),
        classification,
        quantity: String(quantity),
        tentative_unit_cost: String(tentativeCost || "0"),
      }],
    });
    setCreating(false);
    if (res.error) return toast.error(res.error);
    toast.success("Procurement request created.");
    setManualItemName("");
    setQuantity("1");
    setTentativeCost("0");
    setRemarks("");
    await loadData(selectedEquipmentId, statusFilter);
  };

  const doAction = async (requestId: number, action: () => Promise<any>, successMsg: string) => {
    setActionBusyId(requestId);
    const res = await action();
    setActionBusyId(null);
    if (res?.error) return toast.error(res.error);
    toast.success(successMsg);
    await loadData(selectedEquipmentId, statusFilter);
  };

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="rounded-2xl bg-gradient-to-r from-primary via-primary to-accent p-6 text-white shadow-xl">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="mb-3 -ml-2 text-white/90 hover:text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Procurement workflow</h1>
          <p className="mt-2 text-sm text-white/85 max-w-3xl">
            Lab Operator → Lab OIC → Office Superintendent → Store → HoD (when required) → purchase completion →
            office seen. Assign approvers in Django Admin → User equipment supply chain roles.
          </p>
        </div>

        <Card>
          <CardHeader><CardTitle>Create Procurement Request</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Equipment</Label>
                <Select value={selectedEquipmentId} onValueChange={setSelectedEquipmentId}>
                  <SelectTrigger><SelectValue placeholder="Select equipment" /></SelectTrigger>
                  <SelectContent>
                    {equipments.map((e) => (
                      <SelectItem key={e.equipment_id} value={String(e.equipment_id)}>
                        {(e.code || `#${e.equipment_id}`) + (e.name ? ` - ${e.name}` : "")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Classification</Label>
                <Select value={classification} onValueChange={(v: any) => setClassification(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MAS">Major Assets (MAS)</SelectItem>
                    <SelectItem value="MIA_LLTA">Minor Assets / LLTA</SelectItem>
                    <SelectItem value="CS">Consumable Stores (CS)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status Filter</Label>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); loadData(selectedEquipmentId, v); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["ALL","PENDING_OIC_REVIEW","UNDER_OFFICE_VERIFICATION","PENDING_STORE_APPROVAL","PENDING_HEAD_APPROVAL_EMAIL","PENDING_HEAD_APPROVAL_OFFLINE","HEAD_APPROVED","PURCHASE_COMPLETED_PENDING_OFFICE_SEEN","OFFICE_SEEN_COMPLETED","REJECTED_BY_OIC","REJECTED_BY_OFFICE","REJECTED_BY_STORE","REJECTED_BY_HEAD"].map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <Label>Manual Item Name</Label>
                <Input value={manualItemName} onChange={(e) => setManualItemName(e.target.value)} placeholder="Enter requested item name" />
              </div>
              <div>
                <Label>Quantity</Label>
                <Input value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
              <div>
                <Label>Tentative Unit Cost</Label>
                <Input value={tentativeCost} onChange={(e) => setTentativeCost(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Remarks</Label>
              <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Estimate notes, urgency, etc." />
            </div>
            <Button onClick={createRequest} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit Procurement Request
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Procurement Requests</CardTitle>
            <CardDescription>Run stage transitions from here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
            ) : requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No procurement requests.</p>
            ) : (
              requests.map((r) => (
                <div key={r.request_id} className="border rounded-md p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="font-medium">{r.request_no}</div>
                    <Badge>{r.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">Estimated total: {r.total_estimated_cost}</div>
                  <div className="flex flex-wrap gap-2">
                    {String(r.status) === "PENDING_OIC_REVIEW" ? (
                      <>
                        <Button
                          variant="outline"
                          disabled={actionBusyId === r.request_id}
                          onClick={() =>
                            doAction(
                              r.request_id,
                              () => apiClient.oicEndorseProcurementRequest(r.request_id, { decision: "ENDORSE" }),
                              "OIC endorsed",
                            )
                          }
                        >
                          OIC endorse
                        </Button>
                        <Button
                          variant="outline"
                          disabled={actionBusyId === r.request_id}
                          onClick={() =>
                            doAction(
                              r.request_id,
                              () => apiClient.oicEndorseProcurementRequest(r.request_id, { decision: "REJECT" }),
                              "OIC rejected",
                            )
                          }
                        >
                          OIC reject
                        </Button>
                      </>
                    ) : null}
                    <Button
                      variant="outline"
                      disabled={actionBusyId === r.request_id}
                      onClick={() => doAction(r.request_id, () => apiClient.officeVerifyProcurementRequest(r.request_id, { decision: "VERIFY" }), "Office verified")}
                    >Office Verify</Button>
                    <Button
                      variant="outline"
                      disabled={actionBusyId === r.request_id}
                      onClick={() => doAction(r.request_id, () => apiClient.storeApproveProcurementRequest(r.request_id, { decision: "APPROVE", head_approval_mode: headMode }), "Store approved")}
                    >Store Approve</Button>
                    <Select value={headMode} onValueChange={(v: any) => setHeadMode(v)}>
                      <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NOT_REQUIRED">Head: Not required</SelectItem>
                        <SelectItem value="EMAIL">Head: Email</SelectItem>
                        <SelectItem value="OFFLINE">Head: Offline</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      disabled={actionBusyId === r.request_id}
                      onClick={() => doAction(r.request_id, () => apiClient.headApproveProcurementRequest(r.request_id, { decision: "APPROVE" }), "Head approved")}
                    >Head Approve</Button>
                    <Input
                      type="file"
                      className="max-w-[220px]"
                      onChange={(e) => setInvoiceFileByReq((p) => ({ ...p, [r.request_id]: e.target.files?.[0] || null }))}
                    />
                    <Button
                      variant="outline"
                      disabled={actionBusyId === r.request_id}
                      onClick={() =>
                        doAction(
                          r.request_id,
                          () => apiClient.markProcurementPurchaseComplete(r.request_id, { invoice_file: invoiceFileByReq[r.request_id] || null }),
                          "Purchase marked complete",
                        )
                      }
                    >
                      Mark Purchase Complete
                    </Button>
                    <Button
                      disabled={actionBusyId === r.request_id}
                      onClick={() => doAction(r.request_id, () => apiClient.markProcurementOfficeSeen(r.request_id), "Office seen completed")}
                    >Office Seen</Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

