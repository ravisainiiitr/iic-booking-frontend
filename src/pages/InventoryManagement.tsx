import { useEffect, useMemo, useState } from "react";
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
type Item = { item_id: number; item_code: string; name: string; category: "MAS" | "MIA_LLTA" | "CS"; uom: string };
type ReqLine = {
  id: number;
  item: number;
  item_detail?: { item_id: number; item_code: string; name: string; uom: string };
  requested_qty: string;
  approved_qty: string;
  issued_qty: string;
};
type InvReq = {
  request_id: number;
  request_no: string;
  equipment: number;
  request_type: "CONSUMABLE" | "NON_CONSUMABLE" | "MIXED";
  status: string;
  justification: string;
  required_by_date: string | null;
  lines: ReqLine[];
};

export default function InventoryManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userType = String(user?.user_type ?? "").toLowerCase();
  const isAdmin = userType === "admin";

  const [loading, setLoading] = useState(true);
  const [equipmentList, setEquipmentList] = useState<Eq[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>("");
  const [stockRows, setStockRows] = useState<Array<{ item: Item; current_qty: string }>>([]);
  const [requests, setRequests] = useState<InvReq[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const [requestType, setRequestType] = useState<"CONSUMABLE" | "NON_CONSUMABLE" | "MIXED">("MIXED");
  const [requestJustification, setRequestJustification] = useState("");
  const [requestRequiredDate, setRequestRequiredDate] = useState("");
  const [lineItemId, setLineItemId] = useState<string>("");
  const [lineQty, setLineQty] = useState<string>("1.000");
  const [draftLines, setDraftLines] = useState<Array<{ item: number; requested_qty: string }>>([]);
  const [savingRequest, setSavingRequest] = useState(false);
  const [creatingItem, setCreatingItem] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState<"MAS" | "MIA_LLTA" | "CS">("CS");
  const COMMON_UOM = ["Nos", "Kg", "g", "L", "mL", "m", "cm", "box", "set"] as const;
  const [newItemUomChoice, setNewItemUomChoice] = useState<string>(COMMON_UOM[0]);
  const [newItemUomOther, setNewItemUomOther] = useState("");
  const [newItemSpecification, setNewItemSpecification] = useState("");

  const [issueInputs, setIssueInputs] = useState<Record<number, string>>({});
  const [issuingRequestId, setIssuingRequestId] = useState<number | null>(null);
  const [stockItemId, setStockItemId] = useState<string>("");
  const [stockQty, setStockQty] = useState<string>("0.000");
  const [stockUnitCost, setStockUnitCost] = useState<string>("");
  const [stockRemarks, setStockRemarks] = useState<string>("");
  const [addingStock, setAddingStock] = useState(false);
  const CATEGORY_HELPER: Record<"MAS" | "MIA_LLTA" | "CS", { title: string; description: string; examples: string }> = {
    MAS: {
      title: "Major Assets (MAS)",
      description: "Long-term assets intended for prolonged use and not quickly worn out or obsolete. Typically high-value or durable equipment.",
      examples: "Examples: Laboratory instruments, servers, heavy machinery, networking devices, workshop equipment.",
    },
    MIA_LLTA: {
      title: "Minor Assets (MIA) / Limited Life Time Assets (LLTA)",
      description: "Assets with limited useful life (typically 4-5 years), less durable than major assets but still tracked as inventory items.",
      examples: "Examples: Computers, printers, UPS, furniture, projectors, lab equipment, CCTV cameras, mobile phones.",
    },
    CS: {
      title: "Consumable Stores (CS)",
      description: "Items used up over time, wear out quickly, or have negligible resale value. Not long-term assets.",
      examples: "Examples: Chemicals, stationery, batteries, cables, electronic components, printer cartridges, tools, lab supplies.",
    },
  };

  const itemMap = useMemo(() => new Map(items.map((i) => [i.item_id, i])), [items]);

  const loadAll = async (equipmentId?: string, status?: string) => {
    setLoading(true);
    try {
      const [eqRes, itemRes] = await Promise.all([apiClient.adminEquipmentList(), apiClient.getInventoryItems(true)]);
      const eq = (eqRes.data || []) as Eq[];
      const itemList = itemRes.data?.items || [];
      setEquipmentList(eq);
      setItems(itemList);

      const effectiveEqId = equipmentId || (eq[0] ? String(eq[0].equipment_id) : "");
      if (effectiveEqId) setSelectedEquipmentId(effectiveEqId);

      if (effectiveEqId) {
        const [stockRes, reqRes] = await Promise.all([
          apiClient.getInventoryEquipmentStock(effectiveEqId),
          apiClient.getInventoryRequests({
            equipment_id: effectiveEqId,
            status: status && status !== "ALL" ? status : undefined,
          }),
        ]);
        const stock = (stockRes.data?.stock || []).map((s: any) => ({ item: s.item as Item, current_qty: s.current_qty }));
        setStockRows(stock);
        setRequests(reqRes.data?.requests || []);
      } else {
        setStockRows([]);
        setRequests([]);
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to load inventory data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) {
      toast.error("Only admin can access inventory management.");
      navigate("/dashboard");
      return;
    }
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const refreshForEquipment = async (equipmentId: string, status = statusFilter) => {
    setLoading(true);
    try {
      const [stockRes, reqRes] = await Promise.all([
        apiClient.getInventoryEquipmentStock(equipmentId),
        apiClient.getInventoryRequests({ equipment_id: equipmentId, status: status !== "ALL" ? status : undefined }),
      ]);
      const stock = (stockRes.data?.stock || []).map((s: any) => ({ item: s.item as Item, current_qty: s.current_qty }));
      setStockRows(stock);
      setRequests(reqRes.data?.requests || []);
    } finally {
      setLoading(false);
    }
  };

  const addDraftLine = () => {
    const itemId = Number(lineItemId);
    if (!itemId || !lineQty) {
      toast.error("Select item and quantity.");
      return;
    }
    setDraftLines((p) => [...p, { item: itemId, requested_qty: lineQty }]);
    setLineItemId("");
    setLineQty("1.000");
  };

  const createRequest = async () => {
    if (!selectedEquipmentId) return toast.error("Select equipment.");
    if (draftLines.length === 0) return toast.error("Add at least one line.");
    setSavingRequest(true);
    const res = await apiClient.createInventoryRequest({
      equipment: Number(selectedEquipmentId),
      request_type: requestType,
      status: "SUBMITTED",
      justification: requestJustification,
      required_by_date: requestRequiredDate || undefined,
      lines: draftLines.map((l) => ({ item: l.item, requested_qty: l.requested_qty, approved_qty: "0.000", issued_qty: "0.000" })),
    });
    setSavingRequest(false);
    if (res.error) return toast.error(res.error);
    toast.success("Inventory request submitted.");
    setDraftLines([]);
    setRequestJustification("");
    setRequestRequiredDate("");
    await refreshForEquipment(selectedEquipmentId);
  };

  const createItem = async () => {
    const resolvedUom = newItemUomChoice === "OTHER" ? newItemUomOther.trim() : newItemUomChoice;
    if (!newItemName.trim() || !resolvedUom) {
      toast.error("Item name and UOM are required.");
      return;
    }
    setCreatingItem(true);
    const res = await apiClient.createInventoryItem({
      name: newItemName.trim(),
      category: newItemCategory,
      uom: resolvedUom,
      specification: newItemSpecification.trim(),
      active: true,
    });
    setCreatingItem(false);
    if (res.error) return toast.error(res.error);
    toast.success(`Inventory item created with code ${res.data?.item_code || ""}`.trim());
    setNewItemName("");
    setNewItemUomChoice(COMMON_UOM[0]);
    setNewItemUomOther("");
    setNewItemSpecification("");
    const itemRes = await apiClient.getInventoryItems(true);
    setItems(itemRes.data?.items || []);
  };

  const decide = async (requestId: number, action: "APPROVE" | "REJECT") => {
    const res = await apiClient.decideInventoryRequest(requestId, { action });
    if (res.error) return toast.error(res.error);
    toast.success(`Request ${action === "APPROVE" ? "approved" : "rejected"}.`);
    if (selectedEquipmentId) await refreshForEquipment(selectedEquipmentId);
  };

  const issue = async (req: InvReq) => {
    const lines = req.lines
      .map((l) => ({ line_id: l.id, issue_qty: issueInputs[l.id] }))
      .filter((x) => x.issue_qty && Number(x.issue_qty) > 0)
      .map((x) => ({ ...x, issue_qty: String(x.issue_qty) }));
    if (!lines.length) return toast.error("Enter at least one issue quantity.");
    setIssuingRequestId(req.request_id);
    const res = await apiClient.issueInventoryRequest(req.request_id, { lines });
    setIssuingRequestId(null);
    if (res.error) return toast.error(res.error);
    toast.success("Items issued successfully.");
    setIssueInputs({});
    if (selectedEquipmentId) await refreshForEquipment(selectedEquipmentId);
  };

  const addStock = async () => {
    if (!selectedEquipmentId) return toast.error("Select equipment.");
    if (!stockItemId || Number(stockQty) <= 0) return toast.error("Select item and enter positive quantity.");
    setAddingStock(true);
    const res = await apiClient.addInventoryStock({
      equipment: Number(selectedEquipmentId),
      item: Number(stockItemId),
      quantity: String(stockQty),
      unit_cost: stockUnitCost || undefined,
      remarks: stockRemarks || undefined,
    });
    setAddingStock(false);
    if (res.error) return toast.error(res.error);
    toast.success("Stock added successfully.");
    setStockItemId("");
    setStockQty("0.000");
    setStockUnitCost("");
    setStockRemarks("");
    await refreshForEquipment(selectedEquipmentId);
  };

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="rounded-2xl bg-gradient-to-r from-teal-800 via-teal-700 to-cyan-700 p-6 text-white shadow-xl">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="mb-3 -ml-2 text-white/90 hover:text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory management</h1>
          <p className="mt-2 text-sm text-white/85">
            Stock visibility, request approval, and issue tracking for instruments you manage.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Equipment and Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Equipment</Label>
              <Select
                value={selectedEquipmentId}
                onValueChange={(v) => {
                  setSelectedEquipmentId(v);
                  refreshForEquipment(v, statusFilter);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select equipment" /></SelectTrigger>
                <SelectContent>
                  {equipmentList.map((e) => (
                    <SelectItem key={e.equipment_id} value={String(e.equipment_id)}>
                      {(e.code || `#${e.equipment_id}`) + (e.name ? ` - ${e.name}` : "")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Request Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v);
                  if (selectedEquipmentId) refreshForEquipment(selectedEquipmentId, v);
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["ALL", "DRAFT", "SUBMITTED", "APPROVED", "PARTIALLY_FULFILLED", "FULFILLED", "REJECTED", "CANCELLED"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Stock</CardTitle>
            <CardDescription>Live balances by item for selected equipment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading stock...</div>
            ) : stockRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stock records found.</p>
            ) : (
              stockRows.map((s) => (
                <div key={s.item.item_id} className="flex justify-between border rounded-md px-3 py-2">
                  <div>
                    <div className="font-medium">{s.item.item_code} - {s.item.name}</div>
                    <div className="text-xs text-muted-foreground">{s.item.category} | UOM: {s.item.uom}</div>
                  </div>
                  <Badge variant="secondary">{s.current_qty}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add Current Stock</CardTitle>
            <CardDescription>Enter available stock for selected equipment item (creates receipt entry).</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div className="md:col-span-2">
              <Label>Item</Label>
              <Select value={stockItemId} onValueChange={setStockItemId}>
                <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                <SelectContent>
                  {items.map((it) => (
                    <SelectItem key={it.item_id} value={String(it.item_id)}>
                      {it.item_code} - {it.name} ({it.uom})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantity</Label>
              <Input value={stockQty} onChange={(e) => setStockQty(e.target.value)} />
            </div>
            <div>
              <Label>Unit Cost (optional)</Label>
              <Input value={stockUnitCost} onChange={(e) => setStockUnitCost(e.target.value)} />
            </div>
            <div>
              <Label>Remarks (optional)</Label>
              <Input value={stockRemarks} onChange={(e) => setStockRemarks(e.target.value)} />
            </div>
            <div className="md:col-span-5">
              <Button onClick={addStock} disabled={addingStock || !selectedEquipmentId}>
                {addingStock ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Add Stock
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Create Inventory Request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Request Type</Label>
                <Select value={requestType} onValueChange={(v: any) => setRequestType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CONSUMABLE">CONSUMABLE</SelectItem>
                    <SelectItem value="NON_CONSUMABLE">NON_CONSUMABLE</SelectItem>
                    <SelectItem value="MIXED">MIXED</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Required by</Label>
                <Input type="date" value={requestRequiredDate} onChange={(e) => setRequestRequiredDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Justification</Label>
              <Textarea value={requestJustification} onChange={(e) => setRequestJustification(e.target.value)} placeholder="Reason for request..." />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="md:col-span-2">
                <Label>Item</Label>
                <Select value={lineItemId} onValueChange={setLineItemId}>
                  <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                  <SelectContent>
                    {items.map((it) => (
                      <SelectItem key={it.item_id} value={String(it.item_id)}>
                        {it.item_code} - {it.name} ({it.uom})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Qty</Label>
                <Input value={lineQty} onChange={(e) => setLineQty(e.target.value)} />
              </div>
              <Button onClick={addDraftLine} variant="outline">Add Line</Button>
            </div>
            {draftLines.length > 0 && (
              <div className="space-y-2">
                {draftLines.map((l, idx) => {
                  const it = itemMap.get(l.item);
                  return (
                    <div key={`${l.item}-${idx}`} className="flex justify-between border rounded-md px-3 py-2 text-sm">
                      <span>{it ? `${it.item_code} - ${it.name}` : `Item ${l.item}`}</span>
                      <span>{l.requested_qty}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <Button onClick={createRequest} disabled={savingRequest || !selectedEquipmentId}>
              {savingRequest ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit Request
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add Inventory Item (Admin)</CardTitle>
            <CardDescription>Create item master records directly from frontend. Item code is auto-generated (IIC prefix).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Item Name</Label>
                <Input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Nitric Acid" />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={newItemCategory} onValueChange={(v: any) => setNewItemCategory(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MAS">Major Asset (MAS)</SelectItem>
                    <SelectItem value="MIA_LLTA">Minor Asset (MIA) / LLTA</SelectItem>
                    <SelectItem value="CS">Consumable Stores (CS)</SelectItem>
                  </SelectContent>
                </Select>
                <div className="mt-2 rounded-md border bg-muted/30 p-3 text-xs">
                  <p className="font-semibold">{CATEGORY_HELPER[newItemCategory].title}</p>
                  <p className="mt-1 text-muted-foreground">{CATEGORY_HELPER[newItemCategory].description}</p>
                  <p className="mt-1 text-muted-foreground">{CATEGORY_HELPER[newItemCategory].examples}</p>
                </div>
              </div>
              <div>
                <Label>UOM</Label>
                <Select value={newItemUomChoice} onValueChange={setNewItemUomChoice}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COMMON_UOM.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {newItemUomChoice === "OTHER" && (
              <div>
                <Label>Other UOM</Label>
                <Input value={newItemUomOther} onChange={(e) => setNewItemUomOther(e.target.value)} placeholder="Enter custom unit" />
              </div>
            )}
            <div>
              <Label>Specification (optional)</Label>
              <Textarea value={newItemSpecification} onChange={(e) => setNewItemSpecification(e.target.value)} placeholder="AR grade, brand, size..." />
            </div>
            <Button onClick={createItem} disabled={creatingItem}>
              {creatingItem ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Inventory Item
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Requests</CardTitle>
            <CardDescription>Approve/reject and issue quantities for approved requests.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading requests...</div>
            ) : requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No requests found.</p>
            ) : (
              requests.map((r) => (
                <div key={r.request_id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{r.request_no}</div>
                      <div className="text-xs text-muted-foreground">{r.request_type} | Required by: {r.required_by_date || "NA"}</div>
                    </div>
                    <Badge>{r.status}</Badge>
                  </div>
                  <p className="text-sm">{r.justification || "-"}</p>
                  <div className="space-y-2">
                    {r.lines.map((ln) => {
                      const remaining = Number(ln.approved_qty) - Number(ln.issued_qty);
                      return (
                        <div key={ln.id} className="grid grid-cols-1 md:grid-cols-5 gap-2 text-sm border rounded-md p-2 items-center">
                          <div className="md:col-span-2">{ln.item_detail ? `${ln.item_detail.item_code} - ${ln.item_detail.name}` : `Item #${ln.item}`}</div>
                          <div>Req: {ln.requested_qty}</div>
                          <div>Appr: {ln.approved_qty} | Issued: {ln.issued_qty}</div>
                          <Input
                            placeholder={remaining > 0 ? `Issue <= ${remaining}` : "No balance"}
                            value={issueInputs[ln.id] || ""}
                            onChange={(e) => setIssueInputs((p) => ({ ...p, [ln.id]: e.target.value }))}
                            disabled={remaining <= 0 || !(r.status === "APPROVED" || r.status === "PARTIALLY_FULFILLED")}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(r.status === "SUBMITTED" || r.status === "DRAFT") && (
                      <>
                        <Button variant="outline" onClick={() => decide(r.request_id, "REJECT")}>Reject</Button>
                        <Button onClick={() => decide(r.request_id, "APPROVE")}>Approve</Button>
                      </>
                    )}
                    {(r.status === "APPROVED" || r.status === "PARTIALLY_FULFILLED") && (
                      <Button onClick={() => issue(r)} disabled={issuingRequestId === r.request_id}>
                        {issuingRequestId === r.request_id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Issue Selected Quantities
                      </Button>
                    )}
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

