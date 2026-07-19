import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient, extractAdminListItems, type EquipmentNomination } from "@/lib/api";
import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
import { hasRbacPermission } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "sonner";
import { ArrowLeft, Loader2, GraduationCap, RotateCcw } from "lucide-react";

interface SemesterOption {
  id: number;
  name: string;
  code: string;
}

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

const statusBadgeClass = (status: string) => {
  if (status === "APPROVED") return "bg-primary/10 text-primary border-primary/20";
  if (status === "REJECTED") return "bg-destructive/10 text-destructive border-destructive/20";
  return "bg-amber-100 text-amber-800 border-amber-200";
};

export default function AdminStudentNominations() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isAdmin = userTypeStr === "admin";
  const isDeptAdmin = userTypeStr === "dept_admin";
  const canAccess =
    isAdmin ||
    (isDeptAdmin &&
      (hasRbacPermission(user, "admin_settings.equipment") || hasRbacPermission(user, "equipment.manage")));

  const [rows, setRows] = useState<EquipmentNomination[]>([]);
  const [semesters, setSemesters] = useState<SemesterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [semesterFilter, setSemesterFilter] = useState<string>("__all__");
  const [statusFilter, setStatusFilter] = useState<string>("__all__");

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!canAccess) {
      toast.error("You do not have access to Student Equipment Operating Nominations.");
      navigate("/admin-settings/equipment");
    }
  }, [navigate, isAuthenticated, user, canAccess, authLoading]);

  const fetchRows = async () => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (semesterFilter !== "__all__") params.semester_id = semesterFilter;
    if (statusFilter !== "__all__") params.status = statusFilter;
    const res = await apiClient.adminList<EquipmentNomination>(
      "studentEquipmentNominations",
      Object.keys(params).length ? params : undefined
    );
    if (res.error) {
      toast.error(res.error);
      setRows([]);
    } else {
      setRows(extractAdminListItems<EquipmentNomination>(res.data));
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!canAccess) return;
    apiClient.adminList<SemesterOption>("semesters").then((res) => {
      if (!res.error) setSemesters(extractAdminListItems<SemesterOption>(res.data));
    });
  }, [canAccess]);

  useEffect(() => {
    if (!canAccess) return;
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess, semesterFilter, statusFilter]);

  if (!canAccess && !authLoading) return null;

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
            <GraduationCap className="h-8 w-8 text-primary" />
            Student Equipment Operating Nominations
          </h1>
          <p className="text-muted-foreground mt-1">
            Supervisor-nominated students allowed to operate equipment for a given semester. Read-only overview
            (approve/reject is handled via the nominations workflow).
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>All nominations</CardTitle>
              <CardDescription>Filter by semester or status.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={semesterFilter} onValueChange={setSemesterFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All semesters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All semesters</SelectItem>
                  {semesters.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All statuses</SelectItem>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={fetchRows} title="Refresh">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No nominations found for the selected filters.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Supervisor</TableHead>
                      <TableHead>Equipment</TableHead>
                      <TableHead>Semester</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Nominated</TableHead>
                      <TableHead>Resume</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="font-medium">{row.student_name}</div>
                          <div className="text-xs text-muted-foreground">{row.student_email}</div>
                        </TableCell>
                        <TableCell>{row.supervisor_name}</TableCell>
                        <TableCell>
                          {row.equipment_code} — {row.equipment_name}
                        </TableCell>
                        <TableCell>{row.semester_name}</TableCell>
                        <TableCell>
                          <Badge className={statusBadgeClass(row.status)}>{row.status}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.nominated_at ? new Date(row.nominated_at).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell>{row.has_resume ? "Yes" : "No"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
