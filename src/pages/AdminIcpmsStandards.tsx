import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient, extractAdminListItems } from "@/lib/api";
import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Plus, Pencil, Trash2, FlaskConical, Search } from "lucide-react";

interface IcpmsStandardRow {
  id: number;
  s_no: string;
  part_no: string;
  name_of_std: string;
  list_of_elements: string;
  concentration: string;
  status: number;
  created_at?: string;
  updated_at?: string;
}

interface IcpmsStandardFormState {
  s_no: string;
  part_no: string;
  name_of_std: string;
  list_of_elements: string;
  concentration: string;
  status: string;
}

const EMPTY_FORM: IcpmsStandardFormState = {
  s_no: "",
  part_no: "",
  name_of_std: "",
  list_of_elements: "",
  concentration: "",
  status: "1",
};

export default function AdminIcpmsStandards() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isAdmin = userTypeStr === "admin";

  const [rows, setRows] = useState<IcpmsStandardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<IcpmsStandardFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!isAdmin) {
      toast.error("Only admin can access ICPMS Standards.");
      navigate("/admin-settings/equipment");
    }
  }, [navigate, isAuthenticated, user, isAdmin, authLoading]);

  const fetchRows = async (searchTerm?: string) => {
    setLoading(true);
    const params = searchTerm?.trim() ? { search: searchTerm.trim() } : undefined;
    const res = await apiClient.adminList<IcpmsStandardRow>("icpmsStandards", params);
    if (res.error) {
      toast.error(res.error);
      setRows([]);
    } else {
      setRows(extractAdminListItems<IcpmsStandardRow>(res.data));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchRows();
  }, [isAdmin]);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (row: IcpmsStandardRow) => {
    setEditingId(row.id);
    setForm({
      s_no: row.s_no ?? "",
      part_no: row.part_no ?? "",
      name_of_std: row.name_of_std ?? "",
      list_of_elements: row.list_of_elements ?? "",
      concentration: row.concentration ?? "",
      status: String(row.status ?? 1),
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.s_no.trim() || !form.name_of_std.trim()) {
      toast.error("S.No. and Name of Std are required.");
      return;
    }
    setSaving(true);
    const payload = {
      s_no: form.s_no.trim(),
      part_no: form.part_no.trim(),
      name_of_std: form.name_of_std.trim(),
      list_of_elements: form.list_of_elements.trim(),
      concentration: form.concentration.trim(),
      status: parseInt(form.status, 10) || 0,
    };
    const res =
      editingId === null
        ? await apiClient.adminCreate<IcpmsStandardRow>("icpmsStandards", payload)
        : await apiClient.adminUpdate<IcpmsStandardRow>("icpmsStandards", editingId, payload);
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(editingId === null ? "Standard created." : "Standard updated.");
    setModalOpen(false);
    fetchRows(search);
  };

  const handleDelete = async (row: IcpmsStandardRow) => {
    if (!confirm(`Delete standard "${row.name_of_std}"?`)) return;
    const res = await apiClient.adminDelete("icpmsStandards", row.id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Standard deleted.");
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  };

  if (!isAdmin && !authLoading) return null;

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin-settings/equipment")} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Equipment settings
          </Button>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FlaskConical className="h-8 w-8 text-primary" />
            ICPMS Standard Sample Database
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage ICPMS calibration standard samples used to compute minimum standards coverage for a set of elements.
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>All standards</CardTitle>
              <CardDescription>Create, edit, or remove ICPMS standard samples.</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") fetchRows(search);
                  }}
                  placeholder="Search s.no, name, elements…"
                  className="pl-8 w-56"
                />
              </div>
              <Button variant="outline" onClick={() => fetchRows(search)}>
                Search
              </Button>
              <Button onClick={openAdd} className="gap-2">
                <Plus className="h-4 w-4" />
                Add standard
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No standards found.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>S.No.</TableHead>
                      <TableHead>Part No.</TableHead>
                      <TableHead>Name of Std</TableHead>
                      <TableHead>Elements</TableHead>
                      <TableHead>Concentration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.s_no}</TableCell>
                        <TableCell>{row.part_no || "—"}</TableCell>
                        <TableCell>{row.name_of_std}</TableCell>
                        <TableCell className="max-w-[280px] truncate" title={row.list_of_elements}>
                          {row.list_of_elements || "—"}
                        </TableCell>
                        <TableCell>{row.concentration || "—"}</TableCell>
                        <TableCell>
                          {row.status === 1 ? (
                            <Badge className="bg-primary/10 text-primary border-primary/20">Active</Badge>
                          ) : (
                            <Badge variant="outline">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(row)}>
                            <Trash2 className="h-4 w-4" />
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
      </main>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId === null ? "Add standard" : "Edit standard"}</DialogTitle>
            <DialogDescription>Mirrors the ICPMS Standard Sample Database.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="std-sno">S.No.</Label>
                <Input id="std-sno" value={form.s_no} onChange={(e) => setForm((f) => ({ ...f, s_no: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="std-partno">Part No.</Label>
                <Input id="std-partno" value={form.part_no} onChange={(e) => setForm((f) => ({ ...f, part_no: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="std-name">Name of Std</Label>
              <Input id="std-name" value={form.name_of_std} onChange={(e) => setForm((f) => ({ ...f, name_of_std: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="std-elements">List of Elements</Label>
              <Textarea
                id="std-elements"
                value={form.list_of_elements}
                onChange={(e) => setForm((f) => ({ ...f, list_of_elements: e.target.value }))}
                placeholder="e.g. Al, As, B, Ba, Be, Cd, …"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="std-conc">Concentration</Label>
                <Input id="std-conc" value={form.concentration} onChange={(e) => setForm((f) => ({ ...f, concentration: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="std-status">Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger id="std-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Active</SelectItem>
                    <SelectItem value="0">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
