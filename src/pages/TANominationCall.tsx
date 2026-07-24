import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import type { EquipmentNomination, TANominationCall } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Send, Loader2, ClipboardList, Check, X, Download } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { format } from "date-fns";

type SemesterOption = { id: number; code: string; name: string };
type EquipmentOption = { equipment_id: number; code: string; name: string };

function extractAcademicYearLabel(s: SemesterOption): string {
  const text = `${s.code || ""} ${s.name || ""}`;
  const yyyyShort = text.match(/\b(\d{4}-\d{2})\b/);
  if (yyyyShort?.[1]) return yyyyShort[1];
  const yyyyFull = text.match(/\b(\d{4}-\d{4})\b/);
  if (yyyyFull?.[1]) {
    const [a, b] = yyyyFull[1].split("-");
    return `${a}-${b.slice(-2)}`;
  }
  const single = text.match(/\b(20\d{2})\b/);
  if (single?.[1]) return single[1];
  return s.name || s.code || `Year-${s.id}`;
}

export default function TANominationCall() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userType = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isOperatorOrManager = userType === "operator" || userType === "manager" || userType === "admin";

  const [semesters, setSemesters] = useState<SemesterOption[]>([]);
  const [equipments, setEquipments] = useState<EquipmentOption[]>([]);
  const [loadingSemesters, setLoadingSemesters] = useState(true);
  const [loadingEquipments, setLoadingEquipments] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [equipmentId, setEquipmentId] = useState<string>("");
  const [semesterId, setSemesterId] = useState<string>("");
  const [numberOfOperators, setNumberOfOperators] = useState<string>("1");
  const [eligibilityCriteria, setEligibilityCriteria] = useState("");
  const [expectedDutyHours, setExpectedDutyHours] = useState("");
  const [expectedDutyTimeFrom, setExpectedDutyTimeFrom] = useState("");
  const [expectedDutyTimeTo, setExpectedDutyTimeTo] = useState("");
  const [benefits, setBenefits] = useState("");
  const [nominationDeadline, setNominationDeadline] = useState("");

  const [taCalls, setTaCalls] = useState<TANominationCall[]>([]);
  const [selectedTaCallId, setSelectedTaCallId] = useState<string>("");
  const [nominations, setNominations] = useState<EquipmentNomination[]>([]);
  const [loadingCalls, setLoadingCalls] = useState(false);
  const [loadingNominations, setLoadingNominations] = useState(false);
  const [actioningId, setActioningId] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; nominationId: number | null; remarks: string }>({
    open: false,
    nominationId: null,
    remarks: "",
  });

  const academicYearOptions = useMemo(() => {
    const byYear = new Map<string, SemesterOption>();
    for (const s of semesters) {
      const year = extractAcademicYearLabel(s);
      const existing = byYear.get(year);
      // Prefer latest row (higher id) for that year.
      if (!existing || s.id > existing.id) byYear.set(year, s);
    }
    return Array.from(byYear.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([year, sem]) => ({ year, semesterId: String(sem.id) }));
  }, [semesters]);

  useEffect(() => {
    if (!isOperatorOrManager) {
      navigate("/dashboard");
      return;
    }
    apiClient.getSemesters({ active_only: true }).then((res) => {
      setLoadingSemesters(false);
      if (res.error) {
        toast.error(res.error);
        setSemesters([]);
      } else {
        setSemesters(res.data?.semesters ?? []);
      }
    });
    apiClient.getEquipments().then((res) => {
      setLoadingEquipments(false);
      if (res.error) {
        toast.error(res.error);
        setEquipments([]);
      } else {
        setEquipments(res.data?.equipments ?? []);
      }
    });
  }, [isOperatorOrManager, navigate]);

  useEffect(() => {
    if (!isOperatorOrManager) return;
    setLoadingCalls(true);
    apiClient
      .listTANominationCalls()
      .then((res) => {
        if (res.data?.ta_calls) setTaCalls(res.data.ta_calls);
        else setTaCalls([]);
      })
      .catch(() => setTaCalls([]))
      .finally(() => setLoadingCalls(false));
  }, [isOperatorOrManager]);

  useEffect(() => {
    if (!isOperatorOrManager || !selectedTaCallId) {
      setNominations([]);
      return;
    }
    setLoadingNominations(true);
    apiClient
      .listEquipmentNominationsAdmin({ ta_call_id: parseInt(selectedTaCallId, 10) })
      .then((res) => {
        if (res.data?.nominations) setNominations(res.data.nominations);
        else setNominations([]);
      })
      .catch(() => setNominations([]))
      .finally(() => setLoadingNominations(false));
  }, [isOperatorOrManager, selectedTaCallId]);

  const fetchNominationsForCurrentCall = () => {
    if (!selectedTaCallId) return;
    apiClient
      .listEquipmentNominationsAdmin({ ta_call_id: parseInt(selectedTaCallId, 10) })
      .then((res) => {
        if (res.data?.nominations) setNominations(res.data.nominations);
      });
  };

  const handleApprove = async (id: number) => {
    setActioningId(id);
    try {
      const res = await apiClient.approveEquipmentNomination(id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Nomination approved. Student has been intimated via email.");
      fetchNominationsForCurrentCall();
    } catch {
      toast.error("Failed to approve.");
    } finally {
      setActioningId(null);
    }
  };

  const handleRejectClick = (nominationId: number) => {
    setRejectDialog({ open: true, nominationId, remarks: "" });
  };

  const handleRejectConfirm = async () => {
    const { nominationId, remarks } = rejectDialog;
    if (nominationId == null) return;
    setActioningId(nominationId);
    try {
      const res = await apiClient.rejectEquipmentNomination(nominationId, remarks ? { remarks } : undefined);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success("Nomination rejected. Student has been intimated via email.");
      setRejectDialog({ open: false, nominationId: null, remarks: "" });
      fetchNominationsForCurrentCall();
    } catch {
      toast.error("Failed to reject.");
    } finally {
      setActioningId(null);
    }
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipmentId || !semesterId || !nominationDeadline) {
      toast.error("Please select equipment, academic year, and nomination deadline.");
      return;
    }
    const num = parseInt(numberOfOperators, 10);
    if (isNaN(num) || num < 1) {
      toast.error("Number of operators required must be at least 1.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiClient.createTANominationCall({
        equipment_id: parseInt(equipmentId, 10),
        semester_id: parseInt(semesterId, 10),
        number_of_operators_required: num,
        eligibility_criteria: eligibilityCriteria.trim() || undefined,
        expected_duty_hours: expectedDutyHours.trim() || undefined,
        expected_duty_time: expectedDutyTimeFrom && expectedDutyTimeTo
          ? `${expectedDutyTimeFrom} to ${expectedDutyTimeTo}`
          : (expectedDutyTimeFrom || expectedDutyTimeTo) || undefined,
        benefits: benefits.trim() || undefined,
        nomination_deadline: nominationDeadline,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const count = (res.data as { emails_sent_count?: number })?.emails_sent_count ?? 0;
      toast.success(`TA nomination call created. Email sent to ${count} faculty member(s).`);
      navigate("/dashboard");
    } catch (err) {
      toast.error("Failed to create TA nomination call.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOperatorOrManager) {
    return null;
  }

  return (
    <div className="page-shell flex flex-col">
      <DashboardHeader />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-primary via-primary to-accent p-6 text-white shadow-xl">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="mb-3 -ml-2 text-white/90 hover:text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Initiate TA nomination call</h1>
          <p className="mt-2 text-sm text-white/85">
            Send a request to Internal (Faculty) users to nominate students for operating equipment. OIC can select only equipment they manage; Admin can select any.
          </p>
        </div>

        <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-lg">
                <Send className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl">New call</CardTitle>
                <CardDescription className="text-sm mt-0.5">
                  Choose equipment, semester, and operators required, then notify faculty.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="equipment">Equipment *</Label>
                  <Select value={equipmentId} onValueChange={setEquipmentId} required>
                    <SelectTrigger id="equipment">
                      <SelectValue placeholder={loadingEquipments ? "Loading…" : "Select equipment"} />
                    </SelectTrigger>
                    <SelectContent>
                      {equipments.map((eq) => (
                        <SelectItem key={eq.equipment_id} value={String(eq.equipment_id)}>
                          {eq.name} ({eq.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="semester">Academic Year *</Label>
                  <Select value={semesterId} onValueChange={setSemesterId} required>
                    <SelectTrigger id="semester">
                      <SelectValue placeholder={loadingSemesters ? "Loading…" : "Select academic year"} />
                    </SelectTrigger>
                    <SelectContent>
                      {academicYearOptions.map((opt) => (
                        <SelectItem key={opt.semesterId} value={opt.semesterId}>
                          {opt.year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="operators">Number of operators required *</Label>
                  <Input
                    id="operators"
                    type="number"
                    min={1}
                    value={numberOfOperators}
                    onChange={(e) => setNumberOfOperators(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deadline">Nomination deadline *</Label>
                  <Input
                    id="deadline"
                    type="date"
                    value={nominationDeadline}
                    onChange={(e) => setNominationDeadline(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="eligibility">Eligibility criteria</Label>
                <Textarea
                  id="eligibility"
                  placeholder="e.g. Enrolled M.Tech/Ph.D. students; prior training on similar equipment"
                  value={eligibilityCriteria}
                  onChange={(e) => setEligibilityCriteria(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="duty_hours">Expected duty hours</Label>
                <Textarea
                  id="duty_hours"
                  placeholder="e.g. 4–6 hours per week during academic year"
                  value={expectedDutyHours}
                  onChange={(e) => setExpectedDutyHours(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label>Expected duty time (from – to)</Label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="duty_time_from" className="text-xs font-normal text-muted-foreground">From</Label>
                    <Input
                      id="duty_time_from"
                      type="time"
                      value={expectedDutyTimeFrom}
                      onChange={(e) => setExpectedDutyTimeFrom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="duty_time_to" className="text-xs font-normal text-muted-foreground">To</Label>
                    <Input
                      id="duty_time_to"
                      type="time"
                      value={expectedDutyTimeTo}
                      onChange={(e) => setExpectedDutyTimeTo(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="benefits">Benefits</Label>
                <Textarea
                  id="benefits"
                  placeholder="e.g. Certificate on completion; priority instrument booking support"
                  value={benefits}
                  onChange={(e) => setBenefits(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <Button type="submit" disabled={submitting} className="bg-sky-600 hover:bg-sky-700">
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Initiate call & email faculty
                    </>
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate("/dashboard")}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="mt-8 border-0 shadow-lg overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-lg">
                <ClipboardList className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <CardTitle className="text-xl">Nominations received</CardTitle>
                <CardDescription className="mt-0.5">
                  View requests for a TA call, check resume, and accept or reject. Student is intimated via email on action.
                </CardDescription>
              </div>
              <div className="w-[220px]">
                <Label className="text-xs text-muted-foreground">Select TA call</Label>
                <Select value={selectedTaCallId} onValueChange={setSelectedTaCallId} disabled={loadingCalls}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={loadingCalls ? "Loading…" : "Select a call"} />
                  </SelectTrigger>
                  <SelectContent>
                    {taCalls.map((call) => (
                      <SelectItem key={call.id} value={String(call.id)}>
                        {call.equipment_name} · {call.semester_name}
                        {call.nomination_deadline ? ` (deadline ${format(new Date(call.nomination_deadline), "dd MMM")})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!selectedTaCallId ? (
              <div className="py-12 text-center text-muted-foreground">
                <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Select a TA call above to view nominations received.</p>
              </div>
            ) : loadingNominations ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : nominations.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <p>No nominations received for this call yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead className="hidden md:table-cell">Email</TableHead>
                      <TableHead>Supervisor</TableHead>
                      <TableHead>Equipment</TableHead>
                      <TableHead>Academic Year</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Resume</TableHead>
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
                        <TableCell className="text-sm">{n.supervisor_name || "—"}</TableCell>
                        <TableCell>
                          <p className="font-medium text-sm">{n.equipment_name}</p>
                          <p className="text-xs text-muted-foreground">{n.equipment_code}</p>
                        </TableCell>
                        <TableCell className="text-sm">{n.semester_name}</TableCell>
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
                                onClick={() => handleRejectClick(n.id)}
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

        <Dialog open={rejectDialog.open} onOpenChange={(open) => !open && setRejectDialog((p) => ({ ...p, open: false, nominationId: null, remarks: "" }))}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject nomination</DialogTitle>
              <DialogDescription>Optionally add remarks for the student. They will be intimated via email with the outcome.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label>Remarks (optional)</Label>
              <Textarea
                placeholder="e.g. Resume did not meet eligibility criteria"
                value={rejectDialog.remarks}
                onChange={(e) => setRejectDialog((p) => ({ ...p, remarks: e.target.value }))}
                rows={3}
                className="resize-none"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectDialog({ open: false, nominationId: null, remarks: "" })}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleRejectConfirm} disabled={actioningId !== null}>
                {actioningId === rejectDialog.nominationId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reject"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
