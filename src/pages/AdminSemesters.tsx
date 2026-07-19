import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient, extractAdminListItems } from "@/lib/api";
import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
import { ArrowLeft, Loader2, Plus, Pencil, Trash2, CalendarRange } from "lucide-react";

interface SemesterRow {
  id: number;
  name: string;
  code: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface SemesterFormState {
  name: string;
  code: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

const EMPTY_FORM: SemesterFormState = {
  name: "",
  code: "",
  start_date: "",
  end_date: "",
  is_active: true,
};

export default function AdminSemesters() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isAdmin = userTypeStr === "admin";

  const [rows, setRows] = useState<SemesterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<SemesterFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!isAdmin) {
      toast.error("Only admin can access Semesters.");
      navigate("/admin-settings/equipment");
    }
  }, [navigate, isAuthenticated, user, isAdmin, authLoading]);

  const fetchRows = async () => {
    setLoading(true);
    const res = await apiClient.adminList<SemesterRow>("semesters");
    if (res.error) {
      toast.error(res.error);
      setRows([]);
    } else {
      setRows(extractAdminListItems<SemesterRow>(res.data));
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

  const openEdit = (row: SemesterRow) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      code: row.code,
      start_date: row.start_date,
      end_date: row.end_date,
      is_active: row.is_active,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim() || !form.start_date || !form.end_date) {
      toast.error("Name, code, start date and end date are required.");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      start_date: form.start_date,
      end_date: form.end_date,
      is_active: form.is_active,
    };
    const res =
      editingId === null
        ? await apiClient.adminCreate<SemesterRow>("semesters", payload)
        : await apiClient.adminUpdate<SemesterRow>("semesters", editingId, payload);
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(editingId === null ? "Semester created." : "Semester updated.");
    setModalOpen(false);
    fetchRows();
  };

  const handleDelete = async (row: SemesterRow) => {
    if (!confirm(`Delete semester "${row.name}"?`)) return;
    const res = await apiClient.adminDelete("semesters", row.id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Semester deleted.");
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
            <CalendarRange className="h-8 w-8 text-primary" />
            Semesters
          </h1>
          <p className="text-muted-foreground mt-1">
            Academic semesters used for TA nomination calls and student equipment operating nominations.
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>All semesters</CardTitle>
              <CardDescription>Create, edit, or remove semesters.</CardDescription>
            </div>
            <Button onClick={openAdd} className="gap-2">
              <Plus className="h-4 w-4" />
              Add semester
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No semesters yet. Add one to get started.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>End</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell>{row.code}</TableCell>
                        <TableCell>{row.start_date}</TableCell>
                        <TableCell>{row.end_date}</TableCell>
                        <TableCell>
                          {row.is_active ? (
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId === null ? "Add semester" : "Edit semester"}</DialogTitle>
            <DialogDescription>e.g. name "2024-25 Odd", code "2024-25-Odd".</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="sem-name">Name</Label>
              <Input
                id="sem-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="2024-25 Odd"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sem-code">Code</Label>
              <Input
                id="sem-code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="2024-25-Odd"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sem-start">Start date</Label>
                <Input
                  id="sem-start"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sem-end">End date</Label>
                <Input
                  id="sem-end"
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="sem-active"
                checked={form.is_active}
                onCheckedChange={(c) => setForm((f) => ({ ...f, is_active: c === true }))}
              />
              <Label htmlFor="sem-active">Active for nominations</Label>
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
