import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import DashboardHeader from "@/components/DashboardHeader";
import { ArrowLeft, Building2, Loader2, Pencil, Check, X, ThumbsUp, ThumbsDown, Upload, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";

const EXTERNAL_SUBCATEGORIES = [
  { value: "educational_institute", label: "Educational Institute" },
  { value: "govt_rnd", label: "Govt R&D Organizations" },
  { value: "industries", label: "Industry" },
  { value: "external_startup_msme", label: "External Startup/MSME" },
] as const;

/** Row from API: either an organization request or a standalone (admin-added) external department. */
type OrganizationRequestRow = {
  id: number | string;
  type?: "standalone_department";
  department_id?: number;
  name: string;
  approved_name: string;
  state: string;
  state_display: string;
  external_subcategory: string;
  email: string | null;
  requester_name?: string;
  web_page?: string;
  notes: string;
  status: string;
  status_display: string;
  created_department: number | null;
  approved_by: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type StateOption = { value: string; label: string; type?: "state" | "union_territory" };

const getOrganizationTypeLabel = (v: string | null | undefined) => {
  const key = String(v ?? "").trim();
  const opt = EXTERNAL_SUBCATEGORIES.find((o) => o.value === key);
  if (opt) return opt.label;
  if (!key) return "—";
  return key;
};

const ExternalDepartmentAdditionVerification = () => {
  const navigate = useNavigate();
  const [orgRequests, setOrgRequests] = useState<OrganizationRequestRow[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [editingTarget, setEditingTarget] = useState<{ kind: "org_request" | "department"; id: number } | null>(null);
  const [editName, setEditName] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [actionId, setActionId] = useState<number | null>(null);
  const [deletingDeptId, setDeletingDeptId] = useState<number | null>(null);

  // Add external department form
  const [addName, setAddName] = useState("");
  const [addState, setAddState] = useState("");
  const [addSubcategory, setAddSubcategory] = useState<string>("");
  const [states, setStates] = useState<StateOption[]>([]);
  const [loadingStates, setLoadingStates] = useState(true);
  const [submittingAdd, setSubmittingAdd] = useState(false);

  // Bulk upload
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ created: number; errors: Array<{ row: number; message: string }>; message: string } | null>(null);

  const loadOrganizationRequests = async () => {
    setLoadingOrgs(true);
    try {
      const res = await apiClient.listOrganizationRequests();
      if (res.error) {
        toast.error(res.error || "Failed to load organization requests");
        setOrgRequests([]);
        return;
      }
      const data = res.data;
      const results = Array.isArray(data) ? [] : (data as { results?: OrganizationRequestRow[] })?.results ?? [];
      const standalone = Array.isArray(data) ? [] : (data as { standalone_departments?: OrganizationRequestRow[] })?.standalone_departments ?? [];
      setOrgRequests([...results, ...standalone]);
    } catch {
      toast.error("Failed to load organization requests");
      setOrgRequests([]);
    } finally {
      setLoadingOrgs(false);
    }
  };

  useEffect(() => {
    loadOrganizationRequests();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingStates(true);
    apiClient
      .getIndianStates()
      .then((res) => {
        if (cancelled) return;
        if (res.data?.states?.length) {
          setStates(res.data.states);
        } else {
          setStates([]);
        }
      })
      .catch(() => {
        if (!cancelled) setStates([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingStates(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const startEdit = (row: OrganizationRequestRow) => {
    if (row.type === "standalone_department") {
      if (row.department_id == null) return;
      setEditingId(row.id);
      setEditingTarget({ kind: "department", id: row.department_id });
      setEditName((row.name || "").trim());
      return;
    }
    setEditingId(row.id);
    if (row.status === "approved" && row.created_department != null) {
      setEditingTarget({ kind: "department", id: Number(row.created_department) });
      setEditName((row.approved_name || row.name || "").trim());
      return;
    }
    if (typeof row.id !== "number") return;
    setEditingTarget({ kind: "org_request", id: row.id });
    setEditName((row.approved_name || row.name || "").trim());
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingTarget(null);
    setEditName("");
  };

  const saveName = async () => {
    if (!editingTarget) return;
    const name = editName.trim();
    if (!name) {
      toast.error("Name is required");
      return;
    }
    setSavingId(editingTarget.id);
    try {
      const res =
        editingTarget.kind === "org_request"
          ? await apiClient.updateOrganizationRequest(editingTarget.id, { approved_name: name })
          : await apiClient.adminUpdate("departments", editingTarget.id, { name });
      if (res.error) {
        toast.error(res.error || "Failed to update name");
        return;
      }
      toast.success("Name updated");
      setEditingId(null);
      setEditingTarget(null);
      setEditName("");
      await loadOrganizationRequests();
    } catch {
      toast.error("Failed to update name");
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteStandaloneDepartment = async (row: OrganizationRequestRow) => {
    if (row.type !== "standalone_department") return;
    if (row.department_id == null) return;
    const deptName = (row.name || row.approved_name || "").trim() || "this department";
    const ok = window.confirm(`Delete "${deptName}"? This will remove the external department.`);
    if (!ok) return;
    setDeletingDeptId(row.department_id);
    try {
      const res = await apiClient.adminDelete("departments", row.department_id);
      if (res.error) {
        toast.error(res.error || "Failed to delete department");
        return;
      }
      toast.success("Department deleted");
      if (editingTarget?.kind === "department" && editingTarget.id === row.department_id) cancelEdit();
      await loadOrganizationRequests();
    } catch {
      toast.error("Failed to delete department");
    } finally {
      setDeletingDeptId(null);
    }
  };

  const handleDeleteApprovedOrganizationDepartment = async (row: OrganizationRequestRow) => {
    if (row.type === "standalone_department") return;
    if (row.status !== "approved") return;
    if (row.created_department == null) return;
    const deptId = Number(row.created_department);
    const deptName = (row.approved_name || row.name || "").trim() || "this department";
    const ok = window.confirm(`Delete "${deptName}"? This will remove the external department.`);
    if (!ok) return;
    setDeletingDeptId(deptId);
    try {
      const res = await apiClient.adminDelete("departments", deptId);
      if (res.error) {
        toast.error(res.error || "Failed to delete department");
        return;
      }
      toast.success("Department deleted");
      if (editingTarget?.kind === "department" && editingTarget.id === deptId) cancelEdit();
      await loadOrganizationRequests();
    } catch {
      toast.error("Failed to delete department");
    } finally {
      setDeletingDeptId(null);
    }
  };

  const handleApprove = async (id: number | string) => {
    if (typeof id !== "number") return;
    setActionId(id);
    try {
      const res = await apiClient.approveOrganizationRequest(id);
      if (res.error) {
        toast.error(res.error || "Failed to approve");
        return;
      }
      toast.success("Organization approved and department created.");
      await loadOrganizationRequests();
    } catch {
      toast.error("Failed to approve");
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (id: number | string) => {
    if (typeof id !== "number") return;
    setActionId(id);
    try {
      const res = await apiClient.rejectOrganizationRequest(id);
      if (res.error) {
        toast.error(res.error || "Failed to reject");
        return;
      }
      toast.success("Organization request rejected.");
      await loadOrganizationRequests();
    } catch {
      toast.error("Failed to reject");
    } finally {
      setActionId(null);
    }
  };

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = addName.trim();
    if (!name) {
      toast.error("Department name is required");
      return;
    }
    if (!addState) {
      toast.error("State/Union Territory is required");
      return;
    }
    if (!addSubcategory) {
      toast.error("Department type is required");
      return;
    }
    setSubmittingAdd(true);
    try {
      const res = await apiClient.createExternalDepartment({
        name,
        state: addState,
        external_subcategory: addSubcategory,
      });
      if (res.error) {
        toast.error(res.error || "Failed to create department");
        return;
      }
      toast.success("External department added and approved.");
      setAddName("");
      setAddState("");
      setAddSubcategory("");
      await loadOrganizationRequests();
    } catch {
      toast.error("Failed to create department");
    } finally {
      setSubmittingAdd(false);
    }
  };

  const pendingOrgs = orgRequests.filter((r) => r.status === "pending");

  const handleDownloadTemplate = async () => {
    const res = await apiClient.downloadExternalDepartmentsTemplate();
    if (res.error) toast.error(res.error);
  };

  const handleBulkUpload = async () => {
    if (!bulkFile) {
      toast.error("Please select an Excel file.");
      return;
    }
    setBulkUploading(true);
    setBulkResult(null);
    try {
      const res = await apiClient.bulkUploadExternalDepartments(bulkFile);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (res.data) {
        setBulkResult(res.data);
        if (res.data.created > 0) toast.success(res.data.message);
        if (res.data.errors?.length) toast.warning(`${res.data.errors.length} row(s) had errors.`);
        setBulkFile(null);
        if (bulkFileInputRef.current) bulkFileInputRef.current.value = "";
        await loadOrganizationRequests();
      }
    } catch {
      toast.error("Upload failed.");
    } finally {
      setBulkUploading(false);
    }
  };

  return (
    <div className="page-shell flex flex-col">
      <DashboardHeader />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-teal-800 via-teal-700 to-cyan-700 p-6 text-white shadow-xl">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/manage/external-user-management")}
            className="mb-3 -ml-2 text-white/90 hover:text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            External user management
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">External department addition / verification</h1>
          <p className="mt-2 text-sm text-white/85">
            Add external departments with State/Union Territory and type, or verify departments added during registration.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-1">
          {/* Add external department */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Building2 className="h-6 w-6" />
                Add External Department
              </CardTitle>
              <CardDescription>
                Add any type of external department with State/Union Territory. Departments added here are approved.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddDepartment} className="space-y-4 max-w-xl">
                <div className="space-y-2">
                  <Label htmlFor="add-dept-name">Department name</Label>
                  <Input
                    id="add-dept-name"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    placeholder="e.g. ABC University"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-dept-state">State / Union Territory</Label>
                  <Select value={addState} onValueChange={setAddState} disabled={loadingStates}>
                    <SelectTrigger id="add-dept-state">
                      <SelectValue placeholder={loadingStates ? "Loading…" : "Select State/UT"} />
                    </SelectTrigger>
                    <SelectContent>
                      {states.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-dept-type">Department type</Label>
                  <Select value={addSubcategory} onValueChange={setAddSubcategory}>
                    <SelectTrigger id="add-dept-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXTERNAL_SUBCATEGORIES.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={submittingAdd}>
                  {submittingAdd ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adding…
                    </>
                  ) : (
                    "Add department"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Bulk upload via Excel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Upload className="h-6 w-6" />
                Bulk upload departments
              </CardTitle>
              <CardDescription>
                Upload an Excel (.xlsx) file to add multiple external departments at once. Use the template for the correct columns: Department Name, State/Union Territory, Type.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-4">
                <Button type="button" variant="outline" onClick={handleDownloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Download template
                </Button>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="bulk-file">Excel file</Label>
                  <Input
                    ref={bulkFileInputRef}
                    id="bulk-file"
                    type="file"
                    accept=".xlsx"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      setBulkFile(f || null);
                      setBulkResult(null);
                    }}
                    className="max-w-xs"
                  />
                </div>
                <Button
                  type="button"
                  onClick={handleBulkUpload}
                  disabled={bulkUploading || !bulkFile}
                >
                  {bulkUploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </>
                  )}
                </Button>
              </div>
              {bulkResult && (
                <div className="mt-4 space-y-2 rounded-md border p-3 text-sm">
                  <p className="font-medium text-muted-foreground">{bulkResult.message}</p>
                  {bulkResult.errors && bulkResult.errors.length > 0 && (
                    <ul className="list-inside list-disc space-y-1 text-amber-600 dark:text-amber-400">
                      {bulkResult.errors.map((err, i) => (
                        <li key={i}>
                          Row {err.row}: {err.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Organization requests from signup */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Organization requests from registration</CardTitle>
              <CardDescription>
                List of external departments/organizations added by users during registration. Edit the name and Approve or Reject.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingOrgs ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : orgRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6">No organization requests found.</p>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name (requested)</TableHead>
                        <TableHead>Approved name / Edit</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead>Organization Type</TableHead>
                        <TableHead>Requester name</TableHead>
                        <TableHead>Requester email</TableHead>
                        <TableHead>Webpage</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orgRequests.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">
                            {row.name || "—"}
                          </TableCell>
                          <TableCell>
                            {editingId === row.id ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="h-9 max-w-[200px]"
                                  placeholder="Name"
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-9 w-9 p-0"
                                  onClick={saveName}
                                  disabled={savingId !== null}
                                >
                                  {savingId !== null ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Check className="h-4 w-4 text-green-600" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-9 w-9 p-0"
                                  onClick={cancelEdit}
                                  disabled={savingId !== null}
                                >
                                  <X className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">
                                {(row.approved_name || row.name || "—").trim() || "—"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{row.state_display || row.state || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{getOrganizationTypeLabel(row.external_subcategory)}</TableCell>
                          <TableCell className="text-muted-foreground">{row.requester_name && String(row.requester_name).trim() !== "" ? String(row.requester_name) : "—"}</TableCell>
                          <TableCell className="text-muted-foreground">{row.email || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.web_page ? (
                              <a
                                href={row.web_page}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                {row.web_page}
                              </a>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>
                            <span
                              className={
                                row.status === "pending"
                                  ? "text-amber-600 dark:text-amber-400"
                                  : row.status === "approved"
                                    ? "text-green-600 dark:text-green-400"
                                    : "text-red-600 dark:text-red-400"
                              }
                            >
                              {row.status_display || row.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {row.status === "pending" && row.type !== "standalone_department" && (
                              <div className="flex items-center justify-end gap-1">
                                {editingId !== row.id && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                    onClick={() => startEdit(row)}
                                    title="Edit name"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="h-8 gap-1 bg-green-600 hover:bg-green-700"
                                  onClick={() => handleApprove(row.id)}
                                  disabled={actionId !== null}
                                  title="Approve"
                                >
                                  {actionId === row.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <ThumbsUp className="h-4 w-4" />
                                      Approve
                                    </>
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-8 gap-1"
                                  onClick={() => handleReject(row.id)}
                                  disabled={actionId !== null}
                                  title="Reject"
                                >
                                  {actionId === row.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <ThumbsDown className="h-4 w-4" />
                                      Reject
                                    </>
                                  )}
                                </Button>
                              </div>
                            )}
                            {row.status === "approved" && row.type !== "standalone_department" && row.created_department != null && (
                              <div className="flex items-center justify-end gap-1">
                                {editingId !== row.id && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                    onClick={() => startEdit(row)}
                                    title="Edit department name"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  onClick={() => handleDeleteApprovedOrganizationDepartment(row)}
                                  disabled={deletingDeptId === Number(row.created_department)}
                                  title="Delete department"
                                >
                                  {deletingDeptId === Number(row.created_department) ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  )}
                                </Button>
                              </div>
                            )}
                            {row.type === "standalone_department" && (
                              <div className="flex items-center justify-end gap-1">
                                {editingId !== row.id && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 w-8 p-0"
                                    onClick={() => startEdit(row)}
                                    title="Edit department name"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  onClick={() => handleDeleteStandaloneDepartment(row)}
                                  disabled={deletingDeptId === row.department_id}
                                  title="Delete department"
                                >
                                  {deletingDeptId === row.department_id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  )}
                                </Button>
                              </div>
                            )}
                            {row.status !== "pending" && row.status !== "approved" && row.type !== "standalone_department" && (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {pendingOrgs.length > 0 && (
                <p className="text-xs text-muted-foreground mt-3">
                  {pendingOrgs.length} pending request{pendingOrgs.length !== 1 ? "s" : ""}. Edit the approved name if needed, then Approve to create the department and link users.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default ExternalDepartmentAdditionVerification;
