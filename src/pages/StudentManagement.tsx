import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import type { TANominationCall, EquipmentNomination } from "@/lib/api";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Badge } from "@/components/ui/badge";
import DashboardHeader from "@/components/DashboardHeader";
import { ArrowLeft, Users, Loader2, Wallet, Send, ClipboardList, Calendar } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type WalletStudentRow = {
  id: number;
  student: number;
  student_name: string;
  student_email: string;
  student_phone?: string | null;
  student_profile_picture?: string | null;
  student_branch_name?: string | null;
  student_degree_name?: string | null;
  student_department_name?: string | null;
  status: string;
  status_display: string;
  created_at: string;
  updated_at: string;
  responded_at: string | null;
};

function programLabel(row: WalletStudentRow): string {
  const parts = [
    row.student_degree_name,
    row.student_branch_name,
    row.student_department_name,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

function nominationProgramLabel(n: EquipmentNomination): string {
  const parts = [
    n.student_degree_name,
    n.student_branch_name,
    n.student_department_name,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

const StudentManagement = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [students, setStudents] = useState<WalletStudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openTACalls, setOpenTACalls] = useState<TANominationCall[]>([]);
  const [nominations, setNominations] = useState<EquipmentNomination[]>([]);
  const [loadingOpenCalls, setLoadingOpenCalls] = useState(true);
  const [loadingNominations, setLoadingNominations] = useState(true);
  const [nominateDialogCall, setNominateDialogCall] = useState<TANominationCall | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [submittingNomination, setSubmittingNomination] = useState(false);

  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isFaculty = userTypeStr === "faculty";
  const hasOpenCalls = openTACalls.length > 0;

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!isFaculty) {
      navigate("/dashboard");
      return;
    }
    fetchStudents();
    fetchOpenTACalls();
    fetchNominations();
  }, [navigate, isAuthenticated, user, authLoading, isFaculty]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await apiClient.getWalletJoinRequests();
      if (res.data?.requests) {
        const approved = res.data.requests.filter(
          (r: { status: string }) => r.status === "APPROVED"
        ) as WalletStudentRow[];
        setStudents(approved);
      } else {
        setStudents([]);
      }
    } catch {
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchOpenTACalls = async () => {
    setLoadingOpenCalls(true);
    try {
      const res = await apiClient.getOpenTANominationCallsForFaculty();
      if (res.data?.ta_calls) {
        setOpenTACalls(res.data.ta_calls);
      } else {
        setOpenTACalls([]);
      }
    } catch {
      setOpenTACalls([]);
    } finally {
      setLoadingOpenCalls(false);
    }
  };

  const fetchNominations = async () => {
    setLoadingNominations(true);
    try {
      const res = await apiClient.listMyNominationsAsSupervisor();
      if (res.data?.nominations) {
        setNominations(res.data.nominations);
      } else {
        setNominations([]);
      }
    } catch {
      setNominations([]);
    } finally {
      setLoadingNominations(false);
    }
  };

  const openNominateDialog = (call: TANominationCall) => {
    setNominateDialogCall(call);
    setSelectedStudentId("");
  };

  const submitNomination = async () => {
    if (!nominateDialogCall || !selectedStudentId) return;
    setSubmittingNomination(true);
    try {
      const res = await apiClient.createEquipmentNomination({
        student_id: parseInt(selectedStudentId, 10),
        equipment_id: nominateDialogCall.equipment_id,
        semester_id: nominateDialogCall.semester_id,
        ta_call_id: nominateDialogCall.id,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Nomination submitted. It will be reviewed by Admin/OIC.");
      setNominateDialogCall(null);
      setSelectedStudentId("");
      fetchNominations();
    } catch {
      toast.error("Failed to submit nomination.");
    } finally {
      setSubmittingNomination(false);
    }
  };

  if (authLoading || (!user && isAuthenticated)) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl bg-gradient-to-r from-teal-800 via-teal-700 to-cyan-700 p-6 text-white shadow-xl">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
              className="mb-3 -ml-2 gap-2 text-white/90 hover:text-white hover:bg-white/20"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Button>
            <h1 className="text-2xl font-semibold tracking-tight">Student management</h1>
            <p className="mt-2 text-sm text-white/85">
              Supervise students, respond to TA nomination calls, and track nomination outcomes.
            </p>
          </div>

          {/* TA operating nominations – only when there are open calls */}
          {!loadingOpenCalls && hasOpenCalls && (
            <Card className="overflow-hidden rounded-2xl border-teal-200/80 shadow-[var(--shadow-card)] dark:border-teal-800">
              <CardHeader className="bg-gradient-to-r from-teal-500/10 to-cyan-500/10 dark:from-teal-500/20 dark:to-cyan-500/20">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-cyan-700 text-white shadow-lg">
                    <Send className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">TA operating nominations</CardTitle>
                    <CardDescription className="mt-0.5">
                      Active calls for nominating students to operate equipment. Nominate from your supervised students below before the deadline.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Instrument</TableHead>
                        <TableHead>Semester</TableHead>
                        <TableHead>Operators required</TableHead>
                        <TableHead className="whitespace-nowrap">Deadline</TableHead>
                        <TableHead className="w-[140px]"> </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {openTACalls.map((call) => (
                        <TableRow key={call.id}>
                          <TableCell>
                            <p className="font-medium">{call.equipment_name}</p>
                            <p className="text-xs text-muted-foreground">{call.equipment_code}</p>
                          </TableCell>
                          <TableCell>{call.semester_name}</TableCell>
                          <TableCell>{call.number_of_operators_required}</TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                            {call.nomination_deadline
                              ? format(new Date(call.nomination_deadline), "dd MMM yyyy")
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              className="bg-sky-600 hover:bg-sky-700"
                              onClick={() => openNominateDialog(call)}
                            >
                              Nominate student
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Nominations log – always visible for faculty who have nominations */}
          <Card className="overflow-hidden border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-teal-500/10 to-cyan-500/10 dark:from-teal-500/20 dark:to-cyan-500/20">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-600 to-cyan-700 text-white shadow-lg">
                  <ClipboardList className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-xl">Nominations log</CardTitle>
                  <CardDescription className="mt-0.5">
                    Students you nominated for equipment operation and their outcome (Faculty, Admin and OIC can view this log).
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingNominations ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : nominations.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>No nominations yet. Use an active TA call above to nominate a student.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead className="hidden md:table-cell">Email</TableHead>
                        <TableHead className="min-w-[140px]">Program</TableHead>
                        <TableHead>Equipment</TableHead>
                        <TableHead className="hidden sm:table-cell">Semester</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="min-w-[160px]">Outcome</TableHead>
                        <TableHead className="whitespace-nowrap">Nominated at</TableHead>
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
                            {nominationProgramLabel(n)}
                          </TableCell>
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
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Students table – with program details */}
          <Card className="overflow-hidden border-0 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-teal-500/10 to-cyan-500/10 dark:from-teal-500/20 dark:to-cyan-500/20">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-lg">
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Student Management</CardTitle>
                    <CardDescription className="mt-0.5">
                      Students for whom you are the supervisor (use in TA nomination above)
                    </CardDescription>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="gap-2 border-teal-200 dark:border-teal-800"
                  onClick={() => navigate("/wallet")}
                >
                  <Wallet className="h-4 w-4" />
                  Manage in Wallet
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : students.length === 0 ? (
                <div className="py-16 text-center">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground font-medium">No students in your wallet yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Students who request to join your wallet will appear here after you approve them.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => navigate("/wallet")}
                  >
                    Go to Wallet
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[56px]"> </TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="min-w-[160px]">Program</TableHead>
                        <TableHead className="hidden sm:table-cell">Phone</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Approved at</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="w-[56px]">
                            <Avatar className="h-9 w-9 rounded-lg">
                              <AvatarImage
                                src={row.student_profile_picture ? apiClient.getProfilePictureUrl(row.student) : undefined}
                                alt={row.student_name}
                                className="object-cover"
                              />
                              <AvatarFallback className="rounded-lg bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 text-sm">
                                {(row.student_name || row.student_email || "?").charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium">{row.student_name || "—"}</p>
                          </TableCell>
                          <TableCell>
                            <p className="text-muted-foreground text-sm">{row.student_email || "—"}</p>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {programLabel(row)}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                            {row.student_phone || "—"}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground text-sm whitespace-nowrap">
                            {row.responded_at
                              ? format(new Date(row.responded_at), "dd MMM yyyy, HH:mm")
                              : row.updated_at
                                ? format(new Date(row.updated_at), "dd MMM yyyy")
                                : "—"}
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

      {/* Nominate student dialog */}
      <Dialog open={!!nominateDialogCall} onOpenChange={(open) => !open && setNominateDialogCall(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nominate student for TA operating</DialogTitle>
            <DialogDescription>
              {nominateDialogCall && (
                <>
                  {nominateDialogCall.equipment_name} ({nominateDialogCall.equipment_code}) – {nominateDialogCall.semester_name}.
                  Deadline: {nominateDialogCall.nomination_deadline ? format(new Date(nominateDialogCall.nomination_deadline), "dd MMM yyyy") : "—"}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Select student</label>
            <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a student" />
              </SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={String(s.student)}>
                    {s.student_name || s.student_email} – {programLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNominateDialogCall(null)}>
              Cancel
            </Button>
            <Button
              onClick={submitNomination}
              disabled={!selectedStudentId || submittingNomination}
              className="bg-sky-600 hover:bg-sky-700"
            >
              {submittingNomination ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting…
                </>
              ) : (
                "Submit nomination"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentManagement;
