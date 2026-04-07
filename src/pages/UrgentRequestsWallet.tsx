import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import DashboardHeader from "@/components/DashboardHeader";
import { ArrowLeft, Loader2, Check, X, FileText, ExternalLink, AlertTriangle, Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

type WalletRequestRow = {
  id: number;
  user_name: string;
  user_email: string;
  equipment_name: string;
  equipment_code: string;
  requested_at: string;
  status: string;
  wallet_status: "pending" | "approved" | "rejected";
  wallet_approved_at: string | null;
  wallet_approved_by_name: string | null;
  wallet_notes: string;
  evidence_file_url: string | null;
  evidence_original_name: string;
};

/** Full detail (same as Urgent request details for admin/OIC). Used when Supervisor clicks View/Decide. */
type UrgentRequestDetail = {
  id: number;
  request_type: string;
  user_id: number;
  user_name: string;
  user_email: string;
  equipment_id: number;
  equipment_code: string;
  equipment_name: string;
  requested_at: string;
  disclaimer_accepted: boolean;
  number_of_samples: number;
  slots_requested: number;
  duration_minutes: number | null;
  evidence_file_url: string | null;
  evidence_original_name: string;
  reviewer_comment?: string;
  wallet_approved_at: string | null;
  wallet_approved_by_name: string | null;
  wallet_notes: string;
  pending_wallet_approval: boolean;
  status: string;
  admin_notes: string;
  decided_at: string | null;
  decided_by_name: string | null;
  no_slot_log_count: number;
  no_slot_log_entries: Array<{
    requested_at: string;
    number_of_samples: number;
    slots_requested: number;
    duration_minutes: number | null;
  }>;
  hold_booking_id: number | null;
  hold_booking_summary: {
    booking_id: string | number;
    real_booking_id?: number;
    total_charge: string | null;
    total_time_minutes: number;
    slot_times: Array<{ start: string | null; end: string | null; label?: string | null }>;
    input_values: Record<string, unknown>;
    charge_breakdown?: Array<{ description: string; amount: number }> | null;
  } | null;
};

const WALLET_DISCLAIMER =
  "As the supervisor, you are requested to verify the documentary evidence before approving. " +
  "Your approval confirms that you have reviewed the attachment and find the urgent request genuine. " +
  "After your approval, the request will be forwarded to Admin/OIC for final decision.";

/** Shown above the faculty urgent form on this page (submit path). */
const FACULTY_URGENT_SUBMIT_DISCLAIMER =
  "This form is for faculty raising an “Urgent comment from reviewer” request. You must enter a clear reviewer comment " +
  "(summary of the reviewer’s feedback, deadline, or why a standard booking does not meet the need) and upload documentary evidence " +
  "(for example a reviewer email or written note). By checking the box below, you confirm that the comment and evidence are accurate and genuine. " +
  "The request is subject to final decision by Admin or Officer in charge. " +
  "Submitting false or misleading information may affect your future access to the facility.";

type TabValue = "pending" | "approved" | "rejected";

/** Safe download filename for evidence (PDF etc.). */
function sanitizeEvidenceFilename(name: string | undefined, requestId: number): string {
  const raw = (name || "").trim();
  const cleaned = raw.replace(/[/\\?%*:|"<>]/g, "_");
  if (cleaned) return cleaned;
  return `evidence-${requestId}.pdf`;
}

const UrgentRequestsWallet = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const isFacultyUser = String(user?.user_type || "").toLowerCase() === "faculty";
  const [tab, setTab] = useState<TabValue>("pending");
  const [list, setList] = useState<WalletRequestRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailRow, setDetailRow] = useState<UrgentRequestDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [walletNotes, setWalletNotes] = useState("");
  const [viewParamsOpen, setViewParamsOpen] = useState(false);

  // Faculty: submit new REVIEWER_URGENT from this page
  const [facultyEquipList, setFacultyEquipList] = useState<Array<{ equipment_id: number; code: string; name: string }>>([]);
  const [facultyEquipLoading, setFacultyEquipLoading] = useState(false);
  const [facultyEquipId, setFacultyEquipId] = useState("");
  const [facultyReviewerComment, setFacultyReviewerComment] = useState("");
  const [facultyDisclaimerOk, setFacultyDisclaimerOk] = useState(false);
  const [facultyEvidence, setFacultyEvidence] = useState<File | null>(null);
  const [facultyHoldId, setFacultyHoldId] = useState<number | null>(null);
  const [facultyHoldVirtualId, setFacultyHoldVirtualId] = useState<string | null>(null);
  const [facultySubmitting, setFacultySubmitting] = useState(false);

  useEffect(() => {
    const eqId = searchParams.get("urgent_equipment_id");
    const holdId = searchParams.get("hold_booking_id");
    const holdVirtualId = searchParams.get("hold_virtual_booking_id");
    if (eqId) setFacultyEquipId(eqId);
    if (holdId) setFacultyHoldId(parseInt(holdId, 10) || null);
    if (holdVirtualId) setFacultyHoldVirtualId(holdVirtualId);
    if (eqId || holdId || holdVirtualId) {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.delete("urgent_equipment_id");
          p.delete("hold_booking_id");
          p.delete("hold_virtual_booking_id");
          return p;
        },
        { replace: true }
      );
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user || !isFacultyUser) return;
    setFacultyEquipLoading(true);
    apiClient
      .getEquipments(undefined, "ACTIVE")
      .then((res) => {
        const raw = (res as { data?: unknown })?.data ?? res;
        const data = Array.isArray(raw) ? raw : (raw as { equipments?: unknown[] })?.equipments ?? (raw as { results?: unknown[] })?.results ?? [];
        setFacultyEquipList(
          (data as Array<{ equipment_id?: number; id?: number; code?: string; equipment_code?: string; name?: string; equipment_name?: string }>).map((e) => ({
            equipment_id: e.equipment_id ?? e.id ?? 0,
            code: e.code ?? e.equipment_code ?? "",
            name: e.name ?? e.equipment_name ?? "",
          }))
        );
      })
      .catch(() => setFacultyEquipList([]))
      .finally(() => setFacultyEquipLoading(false));
  }, [isAuthenticated, user, isFacultyUser]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    const internalFaculty =
      isFacultyUser && String(user?.department_type ?? "").toLowerCase() === "internal";
    if (internalFaculty) {
      navigate("/dashboard", { replace: true });
      return;
    }
    fetchList(tab);
  }, [navigate, isAuthenticated, user, authLoading, tab, isFacultyUser]);

  const fetchList = async (statusFilter: TabValue) => {
    setLoading(true);
    try {
      const res = await apiClient.listUrgentRequestsWallet({
        status: statusFilter,
        limit: 100,
        offset: 0,
      });
      if (res.data && "urgent_requests" in res.data) {
        const data = res.data as {
          urgent_requests: WalletRequestRow[];
          total_count: number;
        };
        setList(data.urgent_requests);
        setTotalCount(data.total_count ?? 0);
      } else {
        setList([]);
        setTotalCount(0);
      }
    } catch (e) {
      toast.error("Failed to load urgent requests.");
      setList([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveReject = async (requestId: number, action: "APPROVE" | "REJECT") => {
    setActionLoading(true);
    try {
      await apiClient.walletApproveUrgentBookingRequest(requestId, {
        action,
        wallet_notes: walletNotes.trim() || undefined,
      });
      toast.success(action === "APPROVE" ? "Request approved." : "Request rejected.");
      setDetailRow(null);
      setWalletNotes("");
      fetchList("pending");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Action failed.";
      toast.error(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const renderEvidenceCell = (row: WalletRequestRow) => {
    if (!row.evidence_file_url && !row.evidence_original_name) return "—";
    return (
      <Button
        type="button"
        variant="link"
        className="h-auto p-0 text-primary inline-flex items-center gap-1"
        onClick={async () => {
          setEvidenceLoading(true);
          try {
            const blobUrl = await apiClient.fetchUrgentRequestEvidenceBlobUrl(row.id);
            const filename = sanitizeEvidenceFilename(row.evidence_original_name, row.id);
            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = filename;
            a.target = "_blank";
            a.rel = "noopener";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Failed to open evidence");
          } finally {
            setEvidenceLoading(false);
          }
        }}
      >
        <FileText className="h-4 w-4" />
        {row.evidence_original_name || "View"}
        <ExternalLink className="h-3 w-3" />
      </Button>
    );
  };

  const emptyMessage = {
    pending: "No urgent requests pending your approval.",
    approved: "No requests you have approved yet.",
    rejected: "No requests you have rejected.",
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-6">
        <Button variant="ghost" className="mb-4 -ml-2" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        {isFacultyUser && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Submit new urgent request</CardTitle>
              <CardDescription>
                Raise an &quot;Urgent comment from reviewer&quot; request from this page. You may select slot(s) on the booking page first, then return here to attach your comment, evidence, and submit.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground rounded-md border bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 p-3">
                {FACULTY_URGENT_SUBMIT_DISCLAIMER}
              </p>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Select equipment</Label>
                <Select
                  value={facultyEquipId || "__none__"}
                  onValueChange={(v) => {
                    const next = v === "__none__" ? "" : v;
                    setFacultyEquipId(next);
                    setFacultyDisclaimerOk(false);
                    setFacultyEvidence(null);
                    setFacultyReviewerComment("");
                    setFacultyHoldId(null);
                    setFacultyHoldVirtualId(null);
                  }}
                >
                  <SelectTrigger className="w-full max-w-md">
                    <SelectValue placeholder={facultyEquipLoading ? "Loading…" : "Choose equipment"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Select equipment —</SelectItem>
                    {facultyEquipList.map((eq) => (
                      <SelectItem key={eq.equipment_id} value={String(eq.equipment_id)}>
                        {eq.name} ({eq.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {facultyEquipId && (
                <div className="space-y-4 rounded-lg border border-border p-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="faculty-urgent-disclaimer-wallet"
                      checked={facultyDisclaimerOk}
                      onChange={(e) => setFacultyDisclaimerOk(e.target.checked)}
                      className="h-4 w-4 rounded border-input"
                    />
                    <Label htmlFor="faculty-urgent-disclaimer-wallet" className="text-sm cursor-pointer">
                      I have read the disclaimer above and confirm my reviewer comment and documentary evidence are genuine and accurate.
                    </Label>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="faculty-reviewer-comment" className="text-sm font-medium">
                      Reviewer comment (required)
                    </Label>
                    <Textarea
                      id="faculty-reviewer-comment"
                      value={facultyReviewerComment}
                      onChange={(e) => setFacultyReviewerComment(e.target.value)}
                      placeholder="Summarize reviewer feedback, deadlines, or why standard booking is insufficient (minimum 10 characters)."
                      rows={4}
                      className="max-w-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="faculty-evidence-wallet" className="text-sm">
                      Documentary evidence (required)
                    </Label>
                    <Input
                      id="faculty-evidence-wallet"
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                      className="h-9 text-sm max-w-md"
                      onChange={(e) => setFacultyEvidence(e.target.files?.[0] ?? null)}
                    />
                    {facultyEvidence && <p className="text-xs text-muted-foreground">Selected: {facultyEvidence.name}</p>}
                  </div>
                  <div className="space-y-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/book-equipment?equipment_id=${facultyEquipId}&urgent=1&return_to=urgent-requests-wallet`)}
                    >
                      Select slot
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Optional: hold slot(s) on the booking page, then return here to submit. If you skip this, you can still submit without a held slot.
                    </p>
                    {facultyHoldId != null && (
                      <p className="text-xs text-green-600 dark:text-green-500 font-medium">
                        Slot held ({facultyHoldVirtualId || `Booking #${facultyHoldId}`}).
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700"
                    disabled={
                      !facultyDisclaimerOk ||
                      facultySubmitting ||
                      !facultyEvidence ||
                      facultyReviewerComment.trim().length < 10
                    }
                    onClick={async () => {
                      const eqId = parseInt(facultyEquipId, 10);
                      if (Number.isNaN(eqId) || !facultyEvidence) {
                        toast.error("Choose equipment and upload evidence.");
                        return;
                      }
                      if (facultyReviewerComment.trim().length < 10) {
                        toast.error("Reviewer comment must be at least 10 characters.");
                        return;
                      }
                      setFacultySubmitting(true);
                      try {
                        const res = await apiClient.createUrgentBookingRequest({
                          equipment_id: eqId,
                          request_type: "REVIEWER_URGENT",
                          disclaimer_accepted: true,
                          number_of_samples: 1,
                          slots_requested: 1,
                          evidence_file: facultyEvidence,
                          evidence_original_name: facultyEvidence.name,
                          reviewer_comment: facultyReviewerComment.trim(),
                          hold_booking_id: facultyHoldId ?? undefined,
                        });
                        if (res.error) {
                          toast.error(res.error);
                          return;
                        }
                        toast.success(res.data?.message || "Urgent request submitted.");
                        setFacultyDisclaimerOk(false);
                        setFacultyEvidence(null);
                        setFacultyReviewerComment("");
                        setFacultyHoldId(null);
                        setFacultyHoldVirtualId(null);
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed to submit.");
                      } finally {
                        setFacultySubmitting(false);
                      }
                    }}
                  >
                    {facultySubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Submit urgent request
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Urgent requests – Supervisor approval</CardTitle>
            <CardDescription>
              As supervisor, review &quot;Urgent comment from reviewer&quot; requests from users under your supervision. 
              View the documentary evidence and approve or reject. After your approval, Admin/OIC will take the final decision.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground rounded-md border bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 p-3 mb-6 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              {WALLET_DISCLAIMER}
            </p>

            <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
              <TabsList className="grid w-full max-w-md grid-cols-3">
                <TabsTrigger value="pending" className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  Pending
                </TabsTrigger>
                <TabsTrigger value="approved" className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4" />
                  Approved
                </TabsTrigger>
                <TabsTrigger value="rejected" className="flex items-center gap-1.5">
                  <XCircle className="h-4 w-4" />
                  Rejected
                </TabsTrigger>
              </TabsList>
              <TabsContent value={tab} className="mt-4">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : list.length === 0 ? (
                  <p className="text-muted-foreground py-8 text-center">
                    {totalCount === 0 ? emptyMessage[tab] : "No results."}
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Equipment</TableHead>
                        <TableHead>Requested at</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Evidence</TableHead>
                        {tab === "pending" && <TableHead className="text-right">Action</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {list.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <div className="font-medium">{row.user_name}</div>
                            <div className="text-xs text-muted-foreground">{row.user_email}</div>
                          </TableCell>
                          <TableCell>
                            {row.equipment_name} ({row.equipment_code})
                          </TableCell>
                          <TableCell>
                            {row.requested_at ? format(new Date(row.requested_at), "dd MMM yyyy, HH:mm") : "—"}
                          </TableCell>
                          <TableCell>
                            {tab === "pending" ? (
                              <Badge variant="secondary">Pending your approval</Badge>
                            ) : tab === "approved" ? (
                              <div className="text-sm">
                                <Badge className="bg-green-600">Approved by you</Badge>
                                {row.wallet_approved_at && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {format(new Date(row.wallet_approved_at), "dd MMM yyyy")}
                                    {row.status === "APPROVED" ? " · Final: Approved by Admin/OIC" : " · With Admin/OIC"}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-sm">
                                <Badge variant="destructive">Rejected by you</Badge>
                                {row.wallet_approved_at && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {format(new Date(row.wallet_approved_at), "dd MMM yyyy")}
                                  </div>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{renderEvidenceCell(row)}</TableCell>
                          {tab === "pending" && (
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={detailLoading}
                                onClick={async () => {
                                  setWalletNotes("");
                                  setDetailLoading(true);
                                  try {
                                    const res = await apiClient.getUrgentRequestDetail(row.id);
                                    if (res.data) setDetailRow(res.data as UrgentRequestDetail);
                                    else toast.error("Failed to load request details.");
                                  } catch (e) {
                                    toast.error(e instanceof Error ? e.message : "Failed to load request details.");
                                  } finally {
                                    setDetailLoading(false);
                                  }
                                }}
                              >
                                {detailLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "View / Decide"}
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Dialog open={!!detailRow} onOpenChange={(open) => { if (!open) { setDetailRow(null); setViewParamsOpen(false); } }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Urgent request details</DialogTitle>
              <DialogDescription>
                {detailRow?.status === "EXPIRED"
                  ? "This request has expired. No further action is possible."
                  : detailRow?.pending_wallet_approval
                    ? "Urgent comment from reviewer: verify the documentary evidence and approve or reject. Your approval forwards the request to Admin/OIC for final decision."
                    : "Urgent comment from reviewer: Supervisor has approved. View the attachment if needed."}
              </DialogDescription>
            </DialogHeader>
            {detailRow && (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground rounded-md border bg-muted/30 p-2">
                  As the supervisor, verify the documentary evidence before approving. Your approval forwards the request to Admin/OIC.
                </p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Type:</span>{" "}
                    {detailRow.request_type === "REVIEWER_URGENT" ? "Urgent comment from reviewer" : "Unable to get slot despite trials"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">User:</span> {detailRow.user_name} ({detailRow.user_email})
                  </div>
                  <div>
                    <span className="text-muted-foreground">Equipment:</span> {detailRow.equipment_name} ({detailRow.equipment_code})
                  </div>
                  <div>
                    <span className="text-muted-foreground">Requested at:</span>{" "}
                    {detailRow.requested_at ? format(new Date(detailRow.requested_at), "dd MMM yyyy, HH:mm") : "—"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Samples / Slots:</span> {detailRow.number_of_samples} / {detailRow.slots_requested}
                    {detailRow.duration_minutes != null ? `, ${detailRow.duration_minutes} min` : ""}
                  </div>
                  {detailRow.request_type === "REVIEWER_URGENT" && (
                    <>
                      <div className="col-span-2 flex items-center gap-2">
                        <span className="text-muted-foreground">Evidence:</span>
                        {detailRow.evidence_file_url || detailRow.evidence_original_name ? (
                          <Button
                            type="button"
                            variant="link"
                            className="h-auto p-0 text-primary inline-flex items-center gap-1"
                            disabled={evidenceLoading}
                            onClick={async () => {
                              setEvidenceLoading(true);
                              try {
                                const blobUrl = await apiClient.fetchUrgentRequestEvidenceBlobUrl(detailRow.id);
                                const filename = sanitizeEvidenceFilename(detailRow.evidence_original_name, detailRow.id);
                                const a = document.createElement("a");
                                a.href = blobUrl;
                                a.download = filename;
                                a.target = "_blank";
                                a.rel = "noopener";
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
                              } catch (e) {
                                toast.error(e instanceof Error ? e.message : "Failed to open evidence");
                              } finally {
                                setEvidenceLoading(false);
                              }
                            }}
                          >
                            {evidenceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                            {detailRow.evidence_original_name || "View attachment"}
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        ) : (
                          "—"
                        )}
                      </div>
                      {detailRow.reviewer_comment ? (
                        <div className="col-span-2 space-y-1">
                          <span className="text-muted-foreground text-sm">Reviewer comment:</span>
                          <p className="text-sm whitespace-pre-wrap rounded-md border bg-muted/20 p-2">{detailRow.reviewer_comment}</p>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
                {detailRow.hold_booking_id != null && detailRow.hold_booking_summary && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setViewParamsOpen(true)}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      View user parameters
                    </Button>
                    <span className="text-xs text-muted-foreground">Slot(s) and inputs selected by the user for this request.</span>
                  </div>
                )}
                <div>
                  <Label className="text-sm font-medium">Booking requests by users ({detailRow.no_slot_log_entries?.length ?? 0} recent)</Label>
                  <div className="mt-2 border rounded-md overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>Samples</TableHead>
                          <TableHead>Slots</TableHead>
                          <TableHead>Duration (min)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(detailRow.no_slot_log_entries || []).map((e, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-sm">
                              {e.requested_at ? format(new Date(e.requested_at), "dd MMM HH:mm") : "—"}
                            </TableCell>
                            <TableCell>{e.number_of_samples}</TableCell>
                            <TableCell>{e.slots_requested}</TableCell>
                            <TableCell>{e.duration_minutes ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wallet-notes">Your notes (optional)</Label>
                  <Textarea
                    id="wallet-notes"
                    value={walletNotes}
                    onChange={(e) => setWalletNotes(e.target.value)}
                    placeholder="Add a note for admin/OIC..."
                    rows={3}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailRow(null)}>
                Close
              </Button>
              {detailRow?.status === "PENDING" && (
                <>
                  <Button
                    variant="outline"
                    className="text-red-600 border-red-600 hover:bg-red-50"
                    disabled={actionLoading}
                    onClick={() => detailRow && handleApproveReject(detailRow.id, "REJECT")}
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <X className="h-4 w-4 mr-2" />}
                    Reject
                  </Button>
                  <Button
                    disabled={actionLoading}
                    onClick={() => detailRow && handleApproveReject(detailRow.id, "APPROVE")}
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                    Approve
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={viewParamsOpen} onOpenChange={setViewParamsOpen}>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg">User slot & parameters</DialogTitle>
              <DialogDescription>
                Parameters and slot(s) selected by the user when they used &quot;Select Slot&quot; for this urgent request.
              </DialogDescription>
            </DialogHeader>
            {detailRow?.hold_booking_summary && (() => {
              const summary = detailRow.hold_booking_summary;
              const inputValues = summary.input_values || {};
              const chargeBreakdown = summary.charge_breakdown || [];
              const slotTimes = summary.slot_times || [];
              const totalCharge = summary.total_charge != null ? Number(summary.total_charge) : null;
              return (
                <div className="space-y-6 text-base">
                  {Object.keys(inputValues).length > 0 && (
                    <div className="rounded-xl bg-muted/30 dark:bg-muted/20 border border-border/60 shadow-sm overflow-hidden">
                      <div className="flex items-center gap-2.5 px-5 py-4 bg-primary/5 dark:bg-primary/10 border-b border-border/60">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 dark:bg-primary/20 text-primary">
                          <FileText className="h-5 w-5" />
                        </div>
                        <p className="text-base font-semibold text-foreground tracking-tight">User Inputs</p>
                      </div>
                      <ul className="divide-y divide-border/50">
                        {Object.entries(inputValues).map(([label, value]) => (
                          <li key={label} className="flex items-center justify-between gap-4 px-5 py-4 bg-background/50 dark:bg-background/30">
                            <span className="text-sm font-semibold text-muted-foreground shrink-0">{label}</span>
                            <span className="text-base font-medium text-foreground text-right break-words">
                              {value === undefined || value === null ? "—" : Array.isArray(value) ? (value as unknown[]).join(", ") : String(value)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div>
                    <p className="text-base font-medium mb-2">Charge Breakdown:</p>
                    {chargeBreakdown.length > 0 ? (
                      <ul className="space-y-1">
                        {chargeBreakdown
                          .filter((c) => String(c.description || "").trim().toLowerCase() !== "total")
                          .map((charge, index) => (
                            <li key={index} className="text-base text-muted-foreground flex justify-between gap-4 items-start">
                              <span className="whitespace-pre-line min-w-0 shrink">{charge.description}</span>
                              <span className="shrink-0 tabular-nums">{charge.amount >= 0 ? `₹${Number(charge.amount).toFixed(2)}` : `-₹${Number(-charge.amount).toFixed(2)}`}</span>
                            </li>
                          ))}
                        <li className="text-base font-medium flex justify-between pt-2 mt-2 border-t border-border/60">
                          <span>Total</span>
                          <span className="text-primary">{totalCharge != null ? `₹${totalCharge.toFixed(2)}` : "—"}</span>
                        </li>
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Total: {totalCharge != null ? `₹${totalCharge.toFixed(2)}` : "—"}
                        {summary.total_time_minutes != null && ` · ${summary.total_time_minutes} min`}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-base font-medium mb-2">Booked Slots:</p>
                    <div className="flex flex-wrap gap-2">
                      {slotTimes.length > 0 ? (
                        slotTimes.map((st, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center rounded-full border border-border/80 bg-muted/50 px-4 py-1.5 text-sm font-medium text-foreground"
                          >
                            {st.label || (st.start && st.end ? `${format(new Date(st.start), "dd MMM HH:mm")} – ${format(new Date(st.end), "HH:mm")}` : "—")}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default UrgentRequestsWallet;
