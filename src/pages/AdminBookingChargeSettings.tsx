import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient, extractAdminListItems } from "@/lib/api";
import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
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
import { toast } from "sonner";
import { ArrowLeft, Loader2, Pencil, Receipt } from "lucide-react";

interface BookingChargeSettingRow {
  id: number;
  key: string;
  value: string;
}

export default function AdminBookingChargeSettings() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isAdmin = userTypeStr === "admin";

  const [rows, setRows] = useState<BookingChargeSettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<BookingChargeSettingRow | null>(null);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!isAdmin) {
      toast.error("Only admin can access Booking Charge Settings.");
      navigate("/admin-settings/equipment");
    }
  }, [navigate, isAuthenticated, user, isAdmin, authLoading]);

  const fetchRows = async () => {
    setLoading(true);
    const res = await apiClient.adminList<BookingChargeSettingRow>("bookingChargeSettings");
    if (res.error) {
      toast.error(res.error);
      setRows([]);
    } else {
      setRows(extractAdminListItems<BookingChargeSettingRow>(res.data));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!isAdmin) return;
    fetchRows();
  }, [isAdmin]);

  const openEdit = (row: BookingChargeSettingRow) => {
    setEditingRow(row);
    setValue(row.value);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!editingRow) return;
    setSaving(true);
    const res = await apiClient.adminUpdate<BookingChargeSettingRow>("bookingChargeSettings", editingRow.id, { value: value.trim() });
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Setting updated.");
    setModalOpen(false);
    fetchRows();
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
            <Receipt className="h-8 w-8 text-primary" />
            Booking Charge Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Admin-configurable key-value booking charge settings (e.g. GST percentage applied on top of base charge
            for external users).
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All settings</CardTitle>
            <CardDescription>Edit the value for each setting key.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No settings found.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono font-medium">{row.key}</TableCell>
                        <TableCell>{row.value}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(row)}>
                            <Pencil className="h-4 w-4" />
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
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit setting</DialogTitle>
            <DialogDescription>{editingRow?.key}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="charge-value">Value</Label>
              <Input id="charge-value" value={value} onChange={(e) => setValue(e.target.value)} />
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
