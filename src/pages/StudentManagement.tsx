import { Fragment, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import type { TANominationCall, StudentSpendingLimit } from "@/lib/api";
import { Switch } from "@/components/ui/switch";
import { StudentSpendingLimitForm } from "@/components/wallet/StudentSpendingLimitForm";
import { formatINRWithPaise as formatInr } from "@/lib/money";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { UserIdentityCardDialog } from "@/components/UserIdentityCardDialog";
import { formatProgramme } from "@/lib/programmeLabel";
import { getNameInitial } from "@/lib/displayName";
import DashboardHeader from "@/components/DashboardHeader";
import { WorkspaceHeaderActions } from "@/components/WorkspaceHeaderActions";
import { Users, Loader2, Send, IdCard, GraduationCap } from "lucide-react";
import { TrainingBadgeChips } from "@/components/training/TrainingBadgeChips";
import { useTrainingAvailability } from "@/components/training/useTrainingAvailability";
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
  return formatProgramme(row.student_degree_name, row.student_branch_name) || "—";
}

function ProgramCell({ row }: { row: WalletStudentRow }) {
  return (
    <>
      <p className="text-foreground">{programLabel(row)}</p>
      {row.student_department_name ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{row.student_department_name}</p>
      ) : null}
    </>
  );
}

const StudentManagement = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const { menu: trainingMenu } = useTrainingAvailability(isAuthenticated);
  const [students, setStudents] = useState<WalletStudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openTACalls, setOpenTACalls] = useState<TANominationCall[]>([]);
  const [loadingOpenCalls, setLoadingOpenCalls] = useState(true);
  const [nominateDialogCall, setNominateDialogCall] = useState<TANominationCall | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [submittingNomination, setSubmittingNomination] = useState(false);
  const [spendingLimits, setSpendingLimits] = useState<Record<number, StudentSpendingLimit>>({});
  const [limitFormOpen, setLimitFormOpen] = useState<Record<number, boolean>>({});
  const [togglingLimitId, setTogglingLimitId] = useState<number | null>(null);
  const [idCardStudent, setIdCardStudent] = useState<WalletStudentRow | null>(null);
  const [delinkStudent, setDelinkStudent] = useState<WalletStudentRow | null>(null);
  const [delinkMessage, setDelinkMessage] = useState("");
  const [delinking, setDelinking] = useState(false);

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
    fetchSpendingLimits();
    fetchOpenTACalls();
  }, [navigate, isAuthenticated, user?.id, authLoading, isFaculty]);

  const fetchSpendingLimits = async () => {
    try {
      const res = await apiClient.getStudentSpendingLimits();
      const byId: Record<number, StudentSpendingLimit> = {};
      for (const row of res.data?.limits ?? []) byId[row.join_request_id] = row;
      setSpendingLimits(byId);
      setLimitFormOpen(
        Object.fromEntries(Object.values(byId).map((row) => [row.join_request_id, row.spending_limit_enabled])),
      );
    } catch {
      setSpendingLimits({});
    }
  };

  const onLimitSaved = (row: StudentSpendingLimit) => {
    setSpendingLimits((prev) => ({ ...prev, [row.join_request_id]: row }));
    setLimitFormOpen((prev) => ({ ...prev, [row.join_request_id]: row.spending_limit_enabled }));
  };

  const toggleSpendingLimit = async (joinRequestId: number, on: boolean) => {
    if (on) {
      setLimitFormOpen((prev) => ({ ...prev, [joinRequestId]: true }));
      return;
    }
    if (!spendingLimits[joinRequestId]?.spending_limit_enabled) {
      setLimitFormOpen((prev) => ({ ...prev, [joinRequestId]: false }));
      return;
    }
    setTogglingLimitId(joinRequestId);
    try {
      const res = await apiClient.updateStudentSpendingLimit(joinRequestId, { spending_limit_enabled: false });
      if (res.error || !res.data?.limit) {
        toast.error(res.error || "Could not turn off the spending limit.");
        return;
      }
      toast.success("Spending limit turned off.");
      onLimitSaved(res.data.limit);
    } catch {
      toast.error("Could not turn off the spending limit.");
    } finally {
      setTogglingLimitId(null);
    }
  };

  const confirmDelink = async () => {
    if (!delinkStudent) return;
    const row = delinkStudent;
    setDelinking(true);
    try {
      const res = await apiClient.removeStudentFromWallet(row.id, delinkMessage.trim() || undefined);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`${row.student_name || row.student_email} has been delinked from your wallet.`);
      setStudents((prev) => prev.filter((s) => s.id !== row.id));
      setSpendingLimits((prev) => {
        const next = { ...prev };
        delete next[row.id];
        return next;
      });
      setLimitFormOpen((prev) => ({ ...prev, [row.id]: false }));
      setDelinkStudent(null);
    } catch {
      toast.error("Could not delink the student.");
    } finally {
      setDelinking(false);
    }
  };

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
      <main className="container mx-auto px-4 py-5">
        <div className="flex flex-col gap-6">
          <WorkspaceHeaderActions
            fallback={(actions) => (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold">Student Management</h1>
                {actions}
              </div>
            )}
          >
            {trainingMenu("training_events") ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-primary/25 dark:border-primary/40"
                onClick={() => navigate("/training/nominations?tab=students")}
              >
                <GraduationCap className="h-4 w-4" />
                Training &amp; demos
              </Button>
            ) : null}
          </WorkspaceHeaderActions>

          {/* TA operating nominations – only when there are open calls */}
          {!loadingOpenCalls && hasOpenCalls && (
            <Card className="overflow-hidden rounded-2xl border-primary/25 shadow-[var(--shadow-card)] dark:border-primary/40">
              <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10 dark:from-primary/20 dark:to-accent/20">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-lg">
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

          <Card className="overflow-hidden border-0 shadow-lg">
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
                        <TableHead className="whitespace-nowrap">Linked</TableHead>
                        <TableHead className="min-w-[170px] whitespace-nowrap">Spending limit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((row) => {
                        const limit = spendingLimits[row.id];
                        const limitOpen = !!limitFormOpen[row.id];
                        return (
                        <Fragment key={row.id}>
                        <TableRow className={limitOpen ? "border-b-0" : undefined}>
                          <TableCell className="w-[56px]">
                            <Avatar className="h-9 w-9 rounded-lg">
                              <AvatarImage
                                src={row.student_profile_picture ? apiClient.getProfilePictureUrl(row.student) : undefined}
                                alt={row.student_name}
                                className="object-cover"
                              />
                              <AvatarFallback className="rounded-lg bg-primary/10 dark:bg-primary/20 text-primary dark:text-sky-200 text-sm">
                                {getNameInitial(row.student_name, row.student_email)}
                              </AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell>
                            <button
                              type="button"
                              onClick={() => setIdCardStudent(row)}
                              className="group inline-flex items-center gap-1 rounded-sm text-left font-medium text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              title="View student details"
                            >
                              {row.student_name || row.student_email || "—"}
                              <IdCard className="h-3.5 w-3.5 opacity-60" />
                            </button>
                            <TrainingBadgeChips userId={row.student} max={3} className="mt-1 flex" />
                          </TableCell>
                          <TableCell>
                            <p className="text-muted-foreground text-sm">{row.student_email || "—"}</p>
                          </TableCell>
                          <TableCell className="text-sm">
                            <ProgramCell row={row} />
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
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked
                                disabled={delinking && delinkStudent?.id === row.id}
                                onCheckedChange={(on) => {
                                  if (!on) {
                                    setDelinkMessage("");
                                    setDelinkStudent(row);
                                  }
                                }}
                                aria-label={`Delink ${row.student_name || row.student_email} from your wallet`}
                              />
                              <span className="text-xs text-muted-foreground">Linked</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={limitOpen}
                                disabled={togglingLimitId === row.id}
                                onCheckedChange={(on) => toggleSpendingLimit(row.id, on)}
                                aria-label={`Spending limit for ${row.student_name || row.student_email}`}
                              />
                              <span className="text-xs text-muted-foreground">
                                {limit?.spending_limit_enabled
                                  ? [
                                      limit.weekly_limit_inr != null ? `${formatInr(limit.weekly_limit_inr)}/wk` : null,
                                      limit.monthly_limit_inr != null ? `${formatInr(limit.monthly_limit_inr)}/mo` : null,
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")
                                  : limitOpen
                                    ? "Not saved yet"
                                    : "Off"}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                        {limitOpen && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={8} className="pt-0">
                              <StudentSpendingLimitForm
                                joinRequestId={row.id}
                                limit={limit}
                                onSaved={onLimitSaved}
                              />
                            </TableCell>
                          </TableRow>
                        )}
                        </Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <UserIdentityCardDialog
        userId={idCardStudent?.student}
        open={!!idCardStudent}
        onOpenChange={(open) => !open && setIdCardStudent(null)}
        fallbackName={idCardStudent?.student_name}
        fallbackEmail={idCardStudent?.student_email}
        title="Student identity card"
      />

      <AlertDialog
        open={!!delinkStudent}
        onOpenChange={(open) => {
          if (!open && !delinking) setDelinkStudent(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delink student from your wallet?</AlertDialogTitle>
            <AlertDialogDescription>
              {delinkStudent?.student_name || delinkStudent?.student_email} will no longer be able to
              charge bookings to your wallet, and their spending limit will no longer apply. Existing
              bookings are not affected. The student can send a new join request later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label htmlFor="delink-message" className="text-sm font-medium">
              Message to the student (optional)
            </label>
            <Textarea
              id="delink-message"
              value={delinkMessage}
              onChange={(e) => setDelinkMessage(e.target.value)}
              placeholder="You have been removed from this wallet."
              rows={3}
              maxLength={500}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={delinking}>Keep linked</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={delinking}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelink();
              }}
            >
              {delinking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Delinking…
                </>
              ) : (
                "Delink student"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Nominate student dialog */}
      <Dialog open={!!nominateDialogCall} onOpenChange={(open) => !open && setNominateDialogCall(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nominate student for TA operating</DialogTitle>
            <DialogDescription>
              {nominateDialogCall && (
                <>
                  {nominateDialogCall.equipment_name} – {nominateDialogCall.semester_name}.
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
