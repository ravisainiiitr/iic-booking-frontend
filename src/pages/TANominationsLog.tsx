import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import type { EquipmentNomination } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import DashboardHeader from "@/components/DashboardHeader";
import { ArrowLeft, Loader2, ClipboardList, Check, X, Download } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

function programLabel(n: EquipmentNomination): string {
  const parts = [
    n.student_degree_name,
    n.student_branch_name,
    n.student_department_name,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

export default function TANominationsLog() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const canAccess = userTypeStr === "admin" || userTypeStr === "manager" || userTypeStr === "operator";

  const [nominations, setNominations] = useState<EquipmentNomination[]>([]);
  const [semesters, setSemesters] = useState<Array<{ id: number; code: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [filterSemesterId, setFilterSemesterId] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [actioningId, setActioningId] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const handleDownloadResume = async (id: number) => {
    setDownloadingId(id);
    try {
      const res = await apiClient.getNominationResumeBlob(id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      if (res.blob) {
        const url = URL.createObjectURL(res.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "resume";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      toast.error("Failed to download resume.");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleApprove = async (id: number) => {
    setActioningId(id);
    try {
      const res = await apiClient.approveEquipmentNomination(id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Nomination approved.");
      fetchNominations();
    } catch {
      toast.error("Failed to approve.");
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async (id: number) => {
    setActioningId(id);
    try {
      const res = await apiClient.rejectEquipmentNomination(id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Nomination rejected.");
      fetchNominations();
    } catch {
      toast.error("Failed to reject.");
    } finally {
      setActioningId(null);
    }
  };

  const fetchNominations = () => {
    const params: { semester_id?: number; status?: "PENDING" | "APPROVED" | "REJECTED" } = {};
    if (filterSemesterId) params.semester_id = parseInt(filterSemesterId, 10);
    if (filterStatus) params.status = filterStatus as "PENDING" | "APPROVED" | "REJECTED";
    apiClient
      .listEquipmentNominationsAdmin(params)
      .then((res) => {
        if (res.data?.nominations) setNominations(res.data.nominations);
        else setNominations([]);
      })
      .catch(() => setNominations([]));
  };

  useEffect(() => {
    if (!canAccess) {
      navigate("/dashboard");
      return;
    }
    apiClient.getSemesters().then((res) => {
      if (res.data?.semesters) setSemesters(res.data.semesters);
    });
  }, [canAccess, navigate]);

  useEffect(() => {
    if (!canAccess) return;
    setLoading(true);
    const params: { semester_id?: number; status?: "PENDING" | "APPROVED" | "REJECTED" } = {};
    if (filterSemesterId) params.semester_id = parseInt(filterSemesterId, 10);
    if (filterStatus) params.status = filterStatus as "PENDING" | "APPROVED" | "REJECTED";
    apiClient
      .listEquipmentNominationsAdmin(params)
      .then((res) => {
        if (res.data?.nominations) setNominations(res.data.nominations);
        else setNominations([]);
      })
      .catch(() => setNominations([]))
      .finally(() => setLoading(false));
  }, [canAccess, filterSemesterId, filterStatus]);

  if (!canAccess) return null;

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl bg-gradient-to-r from-primary via-primary to-accent p-6 text-white shadow-xl">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="mb-3 -ml-2 gap-2 text-white/90 hover:text-white hover:bg-white/20"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight">TA nominations log</h1>
            <p className="mt-2 text-sm text-white/85">
              All student nominations for equipment operation and their outcome. Visible to Admin and OICs.
            </p>
          </div>

          <Card className="overflow-hidden rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
            <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-lg">
                    <ClipboardList className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Nominations</CardTitle>
                    <CardDescription className="mt-0.5">
                      Filter by semester and status, then review outcomes.
                    </CardDescription>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Select value={filterSemesterId} onValueChange={setFilterSemesterId}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="All semesters" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All semesters</SelectItem>
                      {semesters.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[130px]">
                      <SelectValue placeholder="All status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All status</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                      <SelectItem value="APPROVED">Approved</SelectItem>
                      <SelectItem value="REJECTED">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : nominations.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No nominations match the filters.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead className="hidden md:table-cell">Email</TableHead>
                        <TableHead className="min-w-[140px]">Program</TableHead>
                        <TableHead>Supervisor</TableHead>
                        <TableHead>Equipment</TableHead>
                        <TableHead className="hidden sm:table-cell">Semester</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="min-w-[160px]">Outcome</TableHead>
                        <TableHead className="whitespace-nowrap">Nominated at</TableHead>
                        <TableHead className="min-w-[100px]">Resume</TableHead>
                        <TableHead className="w-[120px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {nominations.map((n) => (
                        <TableRow key={n.id}>
                          <TableCell>
                            <p className="font-medium">{n.student_name || "—"}</p>
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                            {n.student_email || "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {programLabel(n)}
                          </TableCell>
                          <TableCell className="text-sm">{n.supervisor_name || "—"}</TableCell>
                          <TableCell>
                            <p className="font-medium text-sm">{n.equipment_name}</p>
                            <p className="text-xs text-muted-foreground">{n.equipment_code}</p>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-sm">
                            {n.semester_name}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                n.status === "APPROVED"
                                  ? "default"
                                  : n.status === "REJECTED"
                                    ? "destructive"
                                    : "secondary"
                              }
                            >
                              {n.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {n.outcome_summary || "Pending"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                            {n.nominated_at
                              ? format(new Date(n.nominated_at), "dd MMM yyyy, HH:mm")
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {n.has_resume ? (
                              <div className="flex items-center gap-1">
                                <span className="text-sm text-muted-foreground">Submitted</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-1.5"
                                  disabled={downloadingId !== null}
                                  onClick={() => handleDownloadResume(n.id)}
                                >
                                  {downloadingId === n.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Download className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {n.status === "PENDING" && (
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="h-8 bg-green-600 hover:bg-green-700"
                                  disabled={actioningId !== null}
                                  onClick={() => handleApprove(n.id)}
                                >
                                  {actioningId === n.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-8"
                                  disabled={actioningId !== null}
                                  onClick={() => handleReject(n.id)}
                                >
                                  {actioningId === n.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
