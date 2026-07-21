import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/api";
import { useVisibilityPolling } from "@/hooks/use-visibility-polling";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Package, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Eq = { equipment_id: number; code?: string; name?: string };

export default function EquipmentLifecycleHub() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userType = String(user?.user_type ?? "").toLowerCase();
  const isAdminPanel = ["admin", "manager", "operator", "finance"].includes(userType);
  const canEditLifecycle = userType === "admin" || userType === "manager";

  const [loading, setLoading] = useState(true);
  const [equipments, setEquipments] = useState<Eq[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>("");
  const [lifecyclePayload, setLifecyclePayload] = useState<Record<string, unknown> | null>(null);

  const [amcVendor, setAmcVendor] = useState("");
  const [amcRef, setAmcRef] = useState("");
  const [amcStart, setAmcStart] = useState("");
  const [amcEnd, setAmcEnd] = useState("");
  const [amcValue, setAmcValue] = useState("0");
  const [amcNotes, setAmcNotes] = useState("");
  const [amcFile, setAmcFile] = useState<File | null>(null);
  const [amcBusy, setAmcBusy] = useState(false);

  const [exType, setExType] = useState("OTHER");
  const [exClass, setExClass] = useState("");
  const [exAmount, setExAmount] = useState("");
  const [exDate, setExDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [exDesc, setExDesc] = useState("");
  const [exBusy, setExBusy] = useState(false);

  const [woReason, setWoReason] = useState("");
  const [woClass, setWoClass] = useState("");
  const [woResidual, setWoResidual] = useState("");
  const [woBusy, setWoBusy] = useState(false);
  const [woActionBusy, setWoActionBusy] = useState<number | null>(null);

  const loadEquipment = useCallback(async () => {
    const eqRes = await apiClient.getEquipmentLifecycleEquipmentChoices();
    const eq = (eqRes.data?.equipments || []) as Eq[];
    setEquipments(eq);
    setSelectedEquipmentId((prev) => (prev ? prev : eq[0] ? String(eq[0].equipment_id) : ""));
  }, []);

  const loadLifecycle = useCallback(async (opts?: { silent?: boolean }) => {
    if (!selectedEquipmentId) return;
    if (!opts?.silent) setLoading(true);
    try {
      const res = await apiClient.getEquipmentLifecycle(selectedEquipmentId);
      if (res.error) {
        if (!opts?.silent) toast.error(String(res.error));
        if (!opts?.silent) setLifecyclePayload(null);
        return;
      }
      setLifecyclePayload((res.data as Record<string, unknown>) || null);
    } catch (e: unknown) {
      if (!opts?.silent) {
        toast.error(e instanceof Error ? e.message : "Failed to load lifecycle.");
        setLifecyclePayload(null);
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [selectedEquipmentId]);

  useEffect(() => {
    if (!isAdminPanel) {
      toast.error("You are not authorized.");
      navigate("/dashboard");
      return;
    }
    loadEquipment();
  }, [isAdminPanel, navigate, loadEquipment]);

  useEffect(() => {
    if (selectedEquipmentId) loadLifecycle();
  }, [selectedEquipmentId, loadLifecycle]);

  useVisibilityPolling({
    enabled: Boolean(selectedEquipmentId) && isAdminPanel,
    intervalMs: 15000,
    onPoll: () => loadLifecycle({ silent: true }),
  });

  const lifecycle = (lifecyclePayload?.lifecycle as Record<string, string | null> | undefined) || {};
  const accessories = (lifecyclePayload?.accessories as Array<Record<string, unknown>>) || [];
  const amcs = (lifecyclePayload?.amc_contracts as Array<Record<string, unknown>>) || [];
  const expenses = (lifecyclePayload?.expenses as Array<Record<string, unknown>>) || [];
  const writeOffs = (lifecyclePayload?.write_off_requests as Array<Record<string, unknown>>) || [];

  const saveLifecycle = async () => {
    if (!selectedEquipmentId || !canEditLifecycle) return;
    const res = await apiClient.patchEquipmentLifecycle(selectedEquipmentId, {
      supplier_name: lifecycle.supplier_name ?? "",
      supplier_contact: lifecycle.supplier_contact ?? "",
      purchase_order_ref: lifecycle.purchase_order_ref ?? "",
      purchase_invoice_ref: lifecycle.purchase_invoice_ref ?? "",
      purchase_date: lifecycle.purchase_date || null,
      warranty_start: lifecycle.warranty_start || null,
      warranty_end: lifecycle.warranty_end || null,
      commissioning_date: lifecycle.commissioning_date || null,
      asset_serial_number: lifecycle.asset_serial_number ?? "",
      lifecycle_notes: lifecycle.lifecycle_notes ?? "",
    });
    if (res.error) return toast.error(String(res.error));
    toast.success("Lifecycle details saved.");
    await loadLifecycle();
  };

  const updateLifecycleField = (key: string, value: string | null) => {
    setLifecyclePayload((prev) => {
      if (!prev) return prev;
      const next = { ...prev, lifecycle: { ...(prev.lifecycle as object), [key]: value } };
      return next;
    });
  };

  const submitAmc = async () => {
    if (!selectedEquipmentId || !amcVendor.trim() || !amcStart || !amcEnd) {
      toast.error("Vendor, start date and end date are required for AMC.");
      return;
    }
    setAmcBusy(true);
    const fd = new FormData();
    fd.append("vendor_name", amcVendor.trim());
    fd.append("contract_reference", amcRef.trim());
    fd.append("start_date", amcStart);
    fd.append("end_date", amcEnd);
    fd.append("contract_value", amcValue || "0");
    fd.append("coverage_notes", amcNotes);
    fd.append("is_active", "true");
    if (amcFile) fd.append("contract_document", amcFile);
    const res = await apiClient.createEquipmentAmcContract(selectedEquipmentId, fd);
    setAmcBusy(false);
    if (res.error) return toast.error(String(res.error));
    toast.success("AMC contract recorded.");
    setAmcVendor("");
    setAmcRef("");
    setAmcNotes("");
    setAmcValue("0");
    setAmcFile(null);
    await loadLifecycle();
  };

  const submitExpense = async () => {
    if (!selectedEquipmentId || !exAmount || Number(exAmount) <= 0) {
      toast.error("Valid amount required.");
      return;
    }
    setExBusy(true);
    const body: Record<string, unknown> = {
      expense_type: exType,
      amount: exAmount,
      expense_date: exDate,
      description: exDesc,
    };
    if (exClass) body.classification = exClass;
    const res = await apiClient.createEquipmentExpense(selectedEquipmentId, body);
    setExBusy(false);
    if (res.error) return toast.error(String(res.error));
    toast.success("Expense recorded.");
    setExAmount("");
    setExDesc("");
    await loadLifecycle();
  };

  const submitWriteOff = async () => {
    if (!selectedEquipmentId || !woReason.trim()) {
      toast.error("Reason is required.");
      return;
    }
    setWoBusy(true);
    const res = await apiClient.createEquipmentWriteOffRequest({
      equipment: Number(selectedEquipmentId),
      reason: woReason.trim(),
      asset_classification: woClass || undefined,
      estimated_residual_value: woResidual.trim() || null,
    });
    setWoBusy(false);
    if (res.error) return toast.error(String(res.error));
    toast.success("Write-off request submitted.");
    setWoReason("");
    setWoResidual("");
    await loadLifecycle();
  };

  const runWo = async (id: number, fn: () => Promise<{ error?: string }>, ok: string) => {
    setWoActionBusy(id);
    const res = await fn();
    setWoActionBusy(null);
    if (res.error) return toast.error(String(res.error));
    toast.success(ok);
    await loadLifecycle();
  };

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8 space-y-6 max-w-5xl">
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
          <h1 className="text-2xl font-semibold tracking-tight">Equipment lifecycle &amp; expenses</h1>
          <p className="mt-2 text-sm text-white/85 max-w-3xl">
            Track purchase and supplier data, warranty, AMC, classified expenses, and accessories. Write-off follows Lab
            OIC → Office Superintendent → Store → HoD → execution.
          </p>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate("/procurement-workflow")}
              className="bg-white/15 text-white border-white/20 hover:bg-white/25"
            >
              <Package className="h-4 w-4 mr-2" />
              Procurement
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate("/inventory-management")}
              className="bg-white/15 text-white border-white/20 hover:bg-white/25"
            >
              <FileText className="h-4 w-4 mr-2" />
              Inventory
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Equipment</CardTitle>
            <CardDescription>Select an instrument to view and update lifecycle data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Equipment</Label>
              <Select value={selectedEquipmentId} onValueChange={setSelectedEquipmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select equipment" />
                </SelectTrigger>
                <SelectContent>
                  {equipments.map((e) => (
                    <SelectItem key={e.equipment_id} value={String(e.equipment_id)}>
                      {(e.code || `#${e.equipment_id}`) + (e.name ? ` — ${e.name}` : "")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Purchase, supplier &amp; warranty</CardTitle>
                <CardDescription>
                  {canEditLifecycle ? "Edit and save master data." : "Read-only (Admin or Lab OIC may edit via this hub)."}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  ["supplier_name", "Supplier name"],
                  ["purchase_order_ref", "PO reference"],
                  ["purchase_invoice_ref", "Invoice reference"],
                  ["asset_serial_number", "Asset / serial"],
                ].map(([k, label]) => (
                  <div key={k}>
                    <Label>{label}</Label>
                    <Input
                      value={(lifecycle[k] as string) || ""}
                      onChange={(e) => updateLifecycleField(k, e.target.value)}
                      disabled={!canEditLifecycle}
                    />
                  </div>
                ))}
                <div className="md:col-span-2">
                  <Label>Supplier contact</Label>
                  <Textarea
                    value={(lifecycle.supplier_contact as string) || ""}
                    onChange={(e) => updateLifecycleField("supplier_contact", e.target.value)}
                    disabled={!canEditLifecycle}
                    rows={2}
                  />
                </div>
                {[
                  ["purchase_date", "Purchase date"],
                  ["warranty_start", "Warranty start"],
                  ["warranty_end", "Warranty end"],
                  ["commissioning_date", "Commissioning date"],
                ].map(([k, label]) => (
                  <div key={k}>
                    <Label>{label}</Label>
                    <Input
                      type="date"
                      value={(lifecycle[k] as string)?.slice(0, 10) || ""}
                      onChange={(e) => updateLifecycleField(k, e.target.value || null)}
                      disabled={!canEditLifecycle}
                    />
                  </div>
                ))}
                <div className="md:col-span-2">
                  <Label>Lifecycle notes</Label>
                  <Textarea
                    value={(lifecycle.lifecycle_notes as string) || ""}
                    onChange={(e) => updateLifecycleField("lifecycle_notes", e.target.value)}
                    disabled={!canEditLifecycle}
                    rows={3}
                  />
                </div>
                {canEditLifecycle ? (
                  <Button onClick={saveLifecycle} className="md:col-span-2 w-fit">
                    Save lifecycle fields
                  </Button>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Accessories</CardTitle>
                <CardDescription>Configured on the equipment (read-only here; edit in equipment admin).</CardDescription>
              </CardHeader>
              <CardContent>
                {accessories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No accessories recorded.</p>
                ) : (
                  <ul className="text-sm space-y-2">
                    {accessories.map((a) => (
                      <li key={String(a.equipment_accessory_id)} className="border rounded-md p-2">
                        <span className="font-medium">{String(a.accessory_name)}</span>
                        {a.is_optional ? <Badge variant="secondary" className="ml-2">Optional</Badge> : null}
                        <span className="text-muted-foreground ml-2">Qty {String(a.quantity ?? 1)}</span>
                        {a.serial_number ? (
                          <span className="text-muted-foreground ml-2">SN {String(a.serial_number)}</span>
                        ) : null}
                        {a.notes ? <p className="text-xs text-muted-foreground mt-1">{String(a.notes)}</p> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AMC / service contracts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {canEditLifecycle ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-b pb-4">
                    <div>
                      <Label>Vendor</Label>
                      <Input value={amcVendor} onChange={(e) => setAmcVendor(e.target.value)} />
                    </div>
                    <div>
                      <Label>Contract ref</Label>
                      <Input value={amcRef} onChange={(e) => setAmcRef(e.target.value)} />
                    </div>
                    <div>
                      <Label>Start</Label>
                      <Input type="date" value={amcStart} onChange={(e) => setAmcStart(e.target.value)} />
                    </div>
                    <div>
                      <Label>End</Label>
                      <Input type="date" value={amcEnd} onChange={(e) => setAmcEnd(e.target.value)} />
                    </div>
                    <div>
                      <Label>Contract value</Label>
                      <Input value={amcValue} onChange={(e) => setAmcValue(e.target.value)} />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Coverage notes</Label>
                      <Textarea value={amcNotes} onChange={(e) => setAmcNotes(e.target.value)} rows={2} />
                    </div>
                    <div>
                      <Label>Attachment</Label>
                      <Input type="file" onChange={(e) => setAmcFile(e.target.files?.[0] || null)} />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={submitAmc} disabled={amcBusy}>
                        {amcBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Add AMC
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mb-2">Only Admin / OIC can add AMC records.</p>
                )}
                {amcs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No AMC rows.</p>
                ) : (
                  <ul className="text-sm space-y-2">
                    {amcs.map((c) => (
                      <li key={String(c.id)} className="border rounded-md p-2 flex justify-between gap-2">
                        <div>
                          <div className="font-medium">{String(c.vendor_name)}</div>
                          <div className="text-muted-foreground text-xs">
                            {String(c.start_date)} → {String(c.end_date)} · Value {String(c.contract_value)}
                          </div>
                        </div>
                        {c.contract_document ? (
                          <Badge variant="outline">Has file</Badge>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Expenses</CardTitle>
                <CardDescription>Log AMC payments, calibration, repair, consumables, etc.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-b pb-4">
                  <div>
                    <Label>Type</Label>
                    <Select value={exType} onValueChange={setExType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["AMC", "CALIBRATION", "REPAIR", "CONSUMABLE", "PROCUREMENT_LINKED", "OTHER"].map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Classification (optional)</Label>
                    <Select value={exClass || "__"} onValueChange={(v) => setExClass(v === "__" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__">—</SelectItem>
                        <SelectItem value="CS">Consumable (CS)</SelectItem>
                        <SelectItem value="MIA_LLTA">Minor / LLTA</SelectItem>
                        <SelectItem value="MAS">Major (MAS)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Date</Label>
                    <Input type="date" value={exDate} onChange={(e) => setExDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>Amount</Label>
                    <Input value={exAmount} onChange={(e) => setExAmount(e.target.value)} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Description</Label>
                    <Input value={exDesc} onChange={(e) => setExDesc(e.target.value)} />
                  </div>
                  <Button onClick={submitExpense} disabled={exBusy}>
                    {exBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Add expense
                  </Button>
                </div>
                {expenses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No expenses yet.</p>
                ) : (
                  <ul className="text-sm space-y-1">
                    {expenses.map((x) => (
                      <li key={String(x.id)} className="flex flex-wrap gap-2 border-b py-1">
                        <span>{String(x.expense_date)}</span>
                        <Badge variant="secondary">{String(x.expense_type)}</Badge>
                        {x.classification ? <Badge variant="outline">{String(x.classification)}</Badge> : null}
                        <span className="font-medium">{String(x.amount)}</span>
                        <span className="text-muted-foreground">{String(x.description || "")}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Write-off requests (OIC-initiated)</CardTitle>
                <CardDescription>
                  Chain: Office Superintendent → Store → HoD → Execute (sets equipment status to Disposed).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {userType === "manager" || userType === "admin" ? (
                  <div className="grid gap-2 border-b pb-4">
                    <Label>Reason</Label>
                    <Textarea value={woReason} onChange={(e) => setWoReason(e.target.value)} rows={2} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <Label>Asset class (optional)</Label>
                        <Select value={woClass || "__"} onValueChange={(v) => setWoClass(v === "__" ? "" : v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__">—</SelectItem>
                            <SelectItem value="CS">CS</SelectItem>
                            <SelectItem value="MIA_LLTA">MIA_LLTA</SelectItem>
                            <SelectItem value="MAS">MAS</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Est. residual value</Label>
                        <Input value={woResidual} onChange={(e) => setWoResidual(e.target.value)} />
                      </div>
                    </div>
                    <Button className="w-fit" onClick={submitWriteOff} disabled={woBusy}>
                      {woBusy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Submit write-off request
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Only Lab OIC or Admin can initiate write-off.</p>
                )}
                {writeOffs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No write-off requests.</p>
                ) : (
                  <div className="space-y-3">
                    {writeOffs.map((w) => {
                      const id = Number(w.id);
                      const st = String(w.status);
                      return (
                        <div key={id} className="border rounded-md p-3 space-y-2">
                          <div className="flex flex-wrap justify-between gap-2">
                            <span className="font-mono text-sm">{String(w.request_no)}</span>
                            <Badge>{st}</Badge>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{String(w.reason)}</p>
                          <div className="flex flex-wrap gap-2">
                            {st === "PENDING_OFFICE" ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={woActionBusy === id}
                                  onClick={() =>
                                    runWo(id, () => apiClient.equipmentWriteOffOfficeAction(id, { decision: "FORWARD" }), "Forwarded by office")
                                  }
                                >
                                  Office forward
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={woActionBusy === id}
                                  onClick={() =>
                                    runWo(id, () => apiClient.equipmentWriteOffOfficeAction(id, { decision: "REJECT" }), "Rejected")
                                  }
                                >
                                  <Trash2 className="h-3 w-3 mr-1" /> Office reject
                                </Button>
                              </>
                            ) : null}
                            {st === "PENDING_STORE" ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={woActionBusy === id}
                                  onClick={() =>
                                    runWo(id, () => apiClient.equipmentWriteOffStoreAction(id, { decision: "FORWARD" }), "Forwarded by store")
                                  }
                                >
                                  Store forward
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={woActionBusy === id}
                                  onClick={() =>
                                    runWo(id, () => apiClient.equipmentWriteOffStoreAction(id, { decision: "REJECT" }), "Rejected")
                                  }
                                >
                                  Store reject
                                </Button>
                              </>
                            ) : null}
                            {st === "PENDING_HEAD" ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={woActionBusy === id}
                                  onClick={() =>
                                    runWo(id, () => apiClient.equipmentWriteOffHeadAction(id, { decision: "APPROVE" }), "Head approved")
                                  }
                                >
                                  HoD approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={woActionBusy === id}
                                  onClick={() =>
                                    runWo(id, () => apiClient.equipmentWriteOffHeadAction(id, { decision: "REJECT" }), "Rejected")
                                  }
                                >
                                  HoD reject
                                </Button>
                              </>
                            ) : null}
                            {st === "APPROVED" ? (
                              <Button
                                size="sm"
                                disabled={woActionBusy === id}
                                onClick={() => runWo(id, () => apiClient.equipmentWriteOffExecute(id), "Write-off executed")}
                              >
                                Execute write-off
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
