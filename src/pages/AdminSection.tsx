import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiClient, ADMIN_SECTION_ENDPOINTS } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { EquipmentForm, type EquipmentFormData } from "@/components/admin/EquipmentForm";
import { CmsBlockEditor } from "@/components/admin/CmsBlockEditor";

const SECTION_TITLES: Record<string, string> = {
  bookings: "Bookings",
  dailySlots: "Daily Slots",
  equipment: "Equipment",
  equipmentCategories: "Equipment Categories",
  equipmentGroups: "Equipment Groups",
  holidays: "Holidays",
  departments: "Departments",
  projects: "Projects",
  subWalletTransactions: "Sub-Wallet Transactions",
  subWallets: "Sub-Wallets",
  userDocuments: "User Documents",
  userGroupMembers: "User Group Members",
  userGroups: "User Groups",
  users: "Users",
  walletRazorpayOrders: "Wallet Razorpay Orders",
  walletRechargeRequests: "Wallet Recharge Requests",
  wallets: "Wallets",
  cmsMenu: "Menu (CMS)",
  cmsPages: "Pages (CMS)",
  cmsHome: "Home Page Content (CMS)",
};

/** Which field to use as row id for update/delete (varies by model). */
const SECTION_ID_FIELD: Record<string, string> = {
  bookings: "booking_id",
  equipment: "equipment_id",
  dailySlots: "id",
  equipmentCategories: "id",
  equipmentGroups: "equipment_group_id",
  holidays: "id",
  departments: "id",
  projects: "id",
  subWalletTransactions: "id",
  subWallets: "id",
  userDocuments: "id",
  userGroupMembers: "id",
  userGroups: "id",
  users: "id",
  walletRazorpayOrders: "id",
  walletRechargeRequests: "id",
  wallets: "id",
  cmsMenu: "id",
  cmsPages: "id",
  cmsHome: "id",
};

export default function AdminSection() {
  const { section } = useParams<{ section: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [list, setList] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [menuDocumentFile, setMenuDocumentFile] = useState<File | null>(null);
  const [pagesList, setPagesList] = useState<Record<string, unknown>[]>([]);

  const sectionKey = section || "";
  const title = SECTION_TITLES[sectionKey] || sectionKey;
  const idField = SECTION_ID_FIELD[sectionKey] ?? "id";
  const hasEndpoint = sectionKey && ADMIN_SECTION_ENDPOINTS[sectionKey];

  useEffect(() => {
    const check = async () => {
      const token = apiClient.getToken();
      if (!token) {
        navigate("/auth");
        return;
      }
      const userRes = await apiClient.getCurrentUser();
      if (userRes.error || !userRes.data) {
        navigate("/auth");
        return;
      }
      const isAdmin = apiClient.isAdminPanelUser(userRes.data.user_type);
      const roleRes = await apiClient.checkAdminRole(String(userRes.data.id));
      if (!isAdmin && roleRes.data?.is_admin !== true) {
        toast({ title: "Access Denied", variant: "destructive" });
        navigate("/admin");
        return;
      }
      setAuthChecked(true);
    };
    check();
  }, [navigate, toast]);

  useEffect(() => {
    if (!authChecked || !hasEndpoint) {
      if (!hasEndpoint && sectionKey) {
        setError("Invalid section");
        setLoading(false);
      }
      return;
    }
    loadList();
  }, [authChecked, sectionKey, hasEndpoint]);

  useEffect(() => {
    if (sectionKey === "cmsMenu" && modalOpen) {
      apiClient.adminList("cmsPages").then((res) => {
        if (!res.error && Array.isArray(res.data)) setPagesList(res.data as Record<string, unknown>[]);
        else setPagesList([]);
      });
    }
  }, [sectionKey, modalOpen]);

  const loadList = async () => {
    if (!sectionKey) return;
    setLoading(true);
    setError(null);
    const res = await apiClient.adminList(sectionKey);
    if (res.error) {
      setError(res.error);
      setList([]);
      toast({ title: "Error", description: res.error, variant: "destructive" });
    } else {
      const data = res.data;
      setList(Array.isArray(data) ? data : (data && typeof data === "object" && "results" in data ? (data as { results: Record<string, unknown>[] }).results : []));
    }
    setLoading(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setFormData(
      sectionKey === "cmsMenu"
        ? { label: "", link_type: "internal_anchor", url: "", parent: "", priority: 0, is_active: true, open_in_new_tab: false }
        : sectionKey === "cmsPages"
          ? { title: "", slug: "", content: [], is_published: false }
          : {}
    );
    setMenuDocumentFile(null);
    setModalOpen(true);
  };

  const openEdit = (row: Record<string, unknown>) => {
    const id = row[idField];
    if (id === undefined) return;
    setEditingId(id as number | string);
    setFormData(
      sectionKey === "cmsMenu"
        ? { ...row, parent: (row.parent as Record<string, unknown>)?.id ?? row.parent ?? "" }
        : sectionKey === "cmsPages"
          ? { ...row, content: Array.isArray(row.content) ? row.content : [] }
          : { ...row }
    );
    setMenuDocumentFile(null);
    setModalOpen(true);
  };

  const handleSave = async (payload?: Record<string, unknown>, documentFile?: File | null): Promise<Record<string, unknown> | null> => {
    if (!sectionKey) return null;
    let data: Record<string, unknown> = payload ?? formData;
    if (sectionKey === "cmsMenu" && !documentFile && !menuDocumentFile) {
      const { document: _d, ...rest } = data as { document?: unknown; [k: string]: unknown };
      data = rest;
    }
    setSaving(true);
    let result: Record<string, unknown> | null = null;
    if (sectionKey === "cmsMenu" && (documentFile || (data.link_type === "document" && menuDocumentFile))) {
      const file = documentFile ?? menuDocumentFile;
      if (editingId !== null) {
        const res = await apiClient.adminCmsMenuUpdate(editingId, data, file ?? undefined);
        if (res.error) {
          toast({ title: "Error", description: res.error, variant: "destructive" });
        } else {
          toast({ title: "Saved", description: "Record updated successfully." });
          setModalOpen(false);
          setMenuDocumentFile(null);
          loadList();
          result = (res.data as Record<string, unknown>) ?? null;
        }
      } else {
        const res = await apiClient.adminCmsMenuCreate(data, file ?? undefined);
        if (res.error) {
          toast({ title: "Error", description: res.error, variant: "destructive" });
        } else {
          toast({ title: "Created", description: "Record created successfully." });
          setModalOpen(false);
          setMenuDocumentFile(null);
          loadList();
          result = (res.data as Record<string, unknown>) ?? null;
        }
      }
    } else if (editingId !== null) {
      const res = await apiClient.adminUpdate(sectionKey, editingId, data);
      if (res.error) {
        toast({ title: "Error", description: res.error, variant: "destructive" });
      } else {
        toast({ title: "Saved", description: "Record updated successfully." });
        setModalOpen(false);
        loadList();
        result = (res.data as Record<string, unknown>) ?? null;
      }
    } else {
      const res = await apiClient.adminCreate(sectionKey, data);
      if (res.error) {
        toast({ title: "Error", description: res.error, variant: "destructive" });
      } else {
        toast({ title: "Created", description: "Record created successfully." });
        setModalOpen(false);
        loadList();
        result = (res.data as Record<string, unknown>) ?? null;
      }
    }
    setSaving(false);
    return result;
  };

  const handleEquipmentSave = async (
    data: EquipmentFormData,
    options?: { imageFile?: File; videoFile?: File }
  ) => {
    const saved = await handleSave(data as Record<string, unknown>);
    if (saved && (options?.imageFile || options?.videoFile)) {
      const id = (saved.equipment_id ?? editingId) as number | undefined;
      if (id != null && typeof id === "number") {
        if (options.imageFile) {
          const up = await apiClient.uploadEquipmentImage(id, options.imageFile);
          if (up.error) toast({ title: "Image upload failed", description: up.error, variant: "destructive" });
        }
        if (options.videoFile) {
          const up = await apiClient.uploadEquipmentVideo(id, options.videoFile);
          if (up.error) toast({ title: "Video upload failed", description: up.error, variant: "destructive" });
        }
        if (options.imageFile || options.videoFile) loadList();
      }
    }
  };

  const handleDelete = async (row: Record<string, unknown>) => {
    const id = row[idField];
    if (id === undefined) return;
    if (!window.confirm("Delete this record?")) return;
    const res = await apiClient.adminDelete(sectionKey, id as number | string);
    if (res.error) {
      toast({ title: "Error", description: res.error, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Record deleted." });
      loadList();
    }
  };

  if (!hasEndpoint) {
    return (
      <div className="min-h-screen flex flex-col">
        <DashboardHeader />
        <main className="flex-1 container mx-auto px-4 py-8">
          <p className="text-destructive">Invalid section.</p>
          <Button variant="outline" onClick={() => navigate("/admin")}>Back to Admin</Button>
        </main>
      </div>
    );
  }

  const columns = list.length > 0 ? Object.keys(list[0]).filter((k) => typeof list[0][k] !== "object" || list[0][k] === null) : [];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-accent/20">
      <DashboardHeader />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>View, add, edit, and delete records. No Django Admin login required.</CardDescription>
            <div className="flex justify-end">
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : error ? (
              <p className="text-destructive">{error}</p>
            ) : list.length === 0 ? (
              <p className="text-muted-foreground">No records. Click Add to create one.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.slice(0, 8).map((col) => (
                        <TableHead key={col}>{col}</TableHead>
                      ))}
                      <TableHead className="w-[120px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map((row, idx) => (
                      <TableRow key={row[idField] ?? idx}>
                        {columns.slice(0, 8).map((col) => (
                          <TableCell key={col}>
                            {row[col] !== null && row[col] !== undefined
                              ? String(typeof row[col] === "object" ? JSON.stringify(row[col]) : row[col])
                              : "—"}
                          </TableCell>
                        ))}
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(row)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className={
              sectionKey === "equipment"
                ? "max-w-2xl max-h-[90vh] overflow-y-auto"
                : sectionKey === "cmsPages"
                  ? "max-w-5xl w-[90vw] max-h-[90vh] overflow-y-auto"
                  : "max-w-lg max-h-[90vh] overflow-y-auto"
            }>
            <DialogHeader>
              <DialogTitle>{editingId !== null ? "Edit" : "Add"} {title}</DialogTitle>
              <DialogDescription>
                {sectionKey === "equipment"
                  ? "All options match Django Admin: category, equipment group, internal department, visibility group, profile type, status, slot configuration."
                  : "Fields are sent as-is to the API. Use IDs for foreign keys."}
              </DialogDescription>
            </DialogHeader>
            {sectionKey === "equipment" ? (
              <EquipmentForm
                initialData={editingId !== null ? (formData as EquipmentFormData) : undefined}
                equipmentId={editingId !== null ? (editingId as number) : null}
                onSave={handleEquipmentSave}
                onCancel={() => setModalOpen(false)}
                saving={saving}
              />
            ) : sectionKey === "cmsMenu" ? (
              <>
                <DialogDescription>
                  Add or edit a menu or submenu item. Link to a CMS page, document (PDF), or URL.
                </DialogDescription>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Label</Label>
                    <div className="col-span-3">
                      <Input
                        value={String(formData.label ?? "")}
                        onChange={(e) => setFormData((prev) => ({ ...prev, label: e.target.value }))}
                        placeholder="Menu label"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Link type</Label>
                    <div className="col-span-3">
                      <Select
                        value={String(formData.link_type ?? "internal_anchor")}
                        onValueChange={(v) => setFormData((prev) => ({ ...prev, link_type: v }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Link type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="internal_anchor">Internal anchor (#section)</SelectItem>
                          <SelectItem value="internal_route">Internal route (/path)</SelectItem>
                          <SelectItem value="external_url">External URL</SelectItem>
                          <SelectItem value="trigger">Trigger (e.g. Contact)</SelectItem>
                          <SelectItem value="document">Document (PDF upload)</SelectItem>
                          <SelectItem value="page">CMS page</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {formData.link_type === "page" ? (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right">Page</Label>
                      <div className="col-span-3">
                        <Select
                          value={formData.page === null || formData.page === undefined || formData.page === "" ? "__none__" : String(formData.page)}
                          onValueChange={(v) => setFormData((prev) => ({ ...prev, page: v === "__none__" ? "" : Number(v) }))}
                        >
                          <SelectTrigger><SelectValue placeholder="Select page" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Select page —</SelectItem>
                            {pagesList.map((p) => (
                              <SelectItem key={String(p.id)} value={String(p.id)}>
                                {String(p.title ?? p.slug ?? p.id)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : formData.link_type !== "document" ? (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right">URL / path</Label>
                      <div className="col-span-3">
                        <Input
                          value={String(formData.url ?? "")}
                          onChange={(e) => setFormData((prev) => ({ ...prev, url: e.target.value }))}
                          placeholder="#section or /path or https://..."
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right">PDF / document</Label>
                      <div className="col-span-3">
                        <Input
                          type="file"
                          accept=".pdf,application/pdf"
                          onChange={(e) => setMenuDocumentFile(e.target.files?.[0] ?? null)}
                        />
                        {editingId !== null && !menuDocumentFile && formData.document ? (
                          <p className="text-xs text-muted-foreground mt-1">Current file attached. Choose a new file to replace.</p>
                        ) : null}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Parent (submenu of)</Label>
                    <div className="col-span-3">
                      <Select
                        value={formData.parent === null || formData.parent === undefined || formData.parent === "" ? "__none__" : String(formData.parent)}
                        onValueChange={(v) => setFormData((prev) => ({ ...prev, parent: v === "__none__" ? "" : v }))}
                      >
                        <SelectTrigger><SelectValue placeholder="None (top-level)" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None (top-level menu)</SelectItem>
                          {list
                            .filter((item) => item.id !== editingId)
                            .map((item) => (
                              <SelectItem key={String(item.id)} value={String(item.id)}>
                                {String(item.label ?? item.id)}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Priority</Label>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        value={String(formData.priority ?? 0)}
                        onChange={(e) => setFormData((prev) => ({ ...prev, priority: Number(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <div className="col-span-4 flex items-center gap-2">
                      <Checkbox
                        id="cms-is_active"
                        checked={formData.is_active === true || formData.is_active === "true"}
                        onCheckedChange={(c) => setFormData((prev) => ({ ...prev, is_active: !!c }))}
                      />
                      <Label htmlFor="cms-is_active">Active</Label>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <div className="col-span-4 flex items-center gap-2">
                      <Checkbox
                        id="cms-open_in_new_tab"
                        checked={formData.open_in_new_tab === true || formData.open_in_new_tab === "true"}
                        onCheckedChange={(c) => setFormData((prev) => ({ ...prev, open_in_new_tab: !!c }))}
                      />
                      <Label htmlFor="cms-open_in_new_tab">Open in new tab</Label>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => handleSave(undefined, formData.link_type === "document" ? menuDocumentFile : undefined)}
                    disabled={
                      saving ||
                      (formData.link_type === "document" && editingId === null && !menuDocumentFile) ||
                      (formData.link_type === "page" && editingId === null && (formData.page === "" || formData.page === undefined || formData.page === null))
                    }
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save
                  </Button>
                </DialogFooter>
              </>
            ) : sectionKey === "cmsPages" ? (
              <>
                <DialogDescription>
                  Add a page with blocks: heading, paragraph, image, list, quote, divider. Link this page from Menu via link type &quot;CMS page&quot;.
                </DialogDescription>
                <div className="grid gap-4 py-4 max-h-[75vh] overflow-y-auto">
                  <div className="grid grid-cols-[auto_1fr] items-center gap-4">
                    <Label className="text-right whitespace-nowrap">Title</Label>
                    <Input
                      value={String(formData.title ?? "")}
                      onChange={(e) => {
                        const title = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          title,
                          slug: prev.slug === undefined || prev.slug === "" ? title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") : prev.slug,
                        }));
                      }}
                      placeholder="Page title"
                    />
                  </div>
                  <div className="grid grid-cols-[auto_1fr] items-center gap-4">
                    <Label className="text-right whitespace-nowrap">Slug (URL)</Label>
                    <Input
                      value={String(formData.slug ?? "")}
                      onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                      placeholder="page-slug"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="cms-page-published"
                      checked={formData.is_published === true || formData.is_published === "true"}
                      onCheckedChange={(c) => setFormData((prev) => ({ ...prev, is_published: !!c }))}
                    />
                    <Label htmlFor="cms-page-published">Published</Label>
                  </div>
                  <div className="grid grid-cols-[auto_1fr] items-start gap-4">
                    <Label className="text-right pt-2 whitespace-nowrap">Content blocks</Label>
                    <div className="min-w-0 w-full">
                      <CmsBlockEditor
                        content={(Array.isArray(formData.content) ? formData.content : []) as Record<string, unknown>[]}
                        onChange={(content) => setFormData((prev) => ({ ...prev, content }))}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                  <Button onClick={() => handleSave()} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
            <div className="grid gap-4 py-4">
              {Object.keys(formData).length === 0 && editingId === null ? (
                <p className="text-sm text-muted-foreground">Click Save to create with empty data, or add fields below.</p>
              ) : null}
              {Object.entries(formData).map(([key, value]) => (
                <div key={key} className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">{key}</Label>
                  <div className="col-span-3">
                    <Input
                      value={value !== null && value !== undefined ? String(value) : ""}
                      onChange={(e) => setFormData((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder={key}
                    />
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Add field</Label>
                <div className="col-span-3 flex gap-2">
                  <Input
                    id="newFieldName"
                    placeholder="Field name"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const name = (e.target as HTMLInputElement).value.trim();
                        if (name && !formData[name]) {
                          setFormData((prev) => ({ ...prev, [name]: "" }));
                          (e.target as HTMLInputElement).value = "";
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save
              </Button>
            </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
