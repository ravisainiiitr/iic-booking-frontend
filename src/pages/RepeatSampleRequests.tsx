import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { ArrowLeft, Check, Loader2, RotateCcw, X } from "lucide-react";

import DashboardHeader from "@/components/DashboardHeader";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type RepeatRow = {
  id: number;
  booking_id: string;
  real_booking_id: number;
  equipment_name: string;
  equipment_code: string;
  user_name: string;
  user_email: string;
  completed_at: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  status_display: string;
  user_notes: string;
  admin_notes: string;
  requested_at: string;
  responded_at: string | null;
  new_booking_id: string | null;
  new_real_booking_id: number | null;
};

type StatusFilter = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return format(new Date(iso), "dd MMM yyyy, HH:mm");
  } catch {
    return iso;
  }
}

function statusBadge(status: RepeatRow["status"]) {
  if (status === "APPROVED") return <Badge className="bg-emerald-600 hover:bg-emerald-600">Approved</Badge>;
  if (status === "REJECTED") return <Badge variant="destructive">Rejected</Badge>;
  return <Badge className="bg-amber-500 hover:bg-amber-500">Pending</Badge>;
}

export default function RepeatSampleRequests() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<StatusFilter>("PENDING");
  const [rows, setRows] = useState<RepeatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [approveTarget, setApproveTarget] = useState<RepeatRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<RepeatRow | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await apiClient.listRepeatSampleRequests(filter === "ALL" ? undefined : { status: filter });
    if (res.error) {
      setError(res.error);
      setRows([]);
    } else {
      setRows((res.data?.repeat_sample_requests ?? []) as RepeatRow[]);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = async () => {
    if (!approveTarget) return;
    setBusyId(approveTarget.id);
    const res = await apiClient.approveRepeatSampleRequest(approveTarget.id);
    setBusyId(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(res.data?.message || "Repeat sample approved. A complimentary booking was created.");
    setApproveTarget(null);
    void load();
  };

  const reject = async () => {
    if (!rejectTarget) return;
    setBusyId(rejectTarget.id);
    const res = await apiClient.rejectRepeatSampleRequest(rejectTarget.id, rejectNotes.trim());
    setBusyId(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Repeat sample request rejected. The user has been notified.");
    setRejectTarget(null);
    setRejectNotes("");
    void load();
  };

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/booking-management")} className="-ml-2 mb-3">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Booking Management
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2">
            <RotateCcw className="h-6 w-6 text-violet-600" />
            Repeat sample requests
          </h1>
          <p className="text-muted-foreground mt-1 text-sm max-w-2xl">
            Users can ask for a complimentary repeat of a completed booking. Approving creates a free booking in the
            first available slots and notifies the user; rejecting notifies the user with your reason.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Requests</CardTitle>
                <CardDescription>Only requests for equipment you manage are listed.</CardDescription>
              </div>
              <Tabs value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
                <TabsList>
                  <TabsTrigger value="PENDING">Pending</TabsTrigger>
                  <TabsTrigger value="APPROVED">Approved</TabsTrigger>
                  <TabsTrigger value="REJECTED">Rejected</TabsTrigger>
                  <TabsTrigger value="ALL">All</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 py-10 justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading…
              </div>
            ) : error ? (
              <p className="py-8 text-center text-destructive">{error}</p>
            ) : rows.length === 0 ? (
              <p className="py-10 text-center text-muted-foreground">
                {filter === "PENDING" ? "No repeat sample requests are waiting for you." : "No requests found."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Booking</TableHead>
                      <TableHead>Requested by</TableHead>
                      <TableHead>Equipment</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>User's note</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">
                          <button
                            type="button"
                            className="text-primary hover:underline"
                            onClick={() => navigate(`/booking-management?expand=${r.real_booking_id}`)}
                          >
                            {r.booking_id || r.real_booking_id}
                          </button>
                          {r.new_booking_id ? (
                            <div className="text-muted-foreground mt-1">
                              New:{" "}
                              <button
                                type="button"
                                className="text-primary hover:underline"
                                onClick={() => navigate(`/booking-management?expand=${r.new_real_booking_id}`)}
                              >
                                {r.new_booking_id}
                              </button>
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{r.user_name || r.user_email}</div>
                          {r.user_name ? <div className="text-xs text-muted-foreground">{r.user_email}</div> : null}
                        </TableCell>
                        <TableCell>
                          <div>{r.equipment_name}</div>
                          <div className="text-xs text-muted-foreground">{r.equipment_code}</div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{fmt(r.completed_at)}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{fmt(r.requested_at)}</TableCell>
                        <TableCell className="max-w-[16rem] text-sm">
                          {r.user_notes || <span className="text-muted-foreground">—</span>}
                          {r.admin_notes ? (
                            <div className="mt-1 text-xs text-muted-foreground">Officer in charge: {r.admin_notes}</div>
                          ) : null}
                        </TableCell>
                        <TableCell>{statusBadge(r.status)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {r.status === "PENDING" ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                disabled={busyId === r.id}
                                onClick={() => setApproveTarget(r)}
                              >
                                <Check className="h-4 w-4 mr-1" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={busyId === r.id}
                                onClick={() => {
                                  setRejectNotes("");
                                  setRejectTarget(r);
                                }}
                              >
                                <X className="h-4 w-4 mr-1" /> Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">{fmt(r.responded_at)}</span>
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
      </main>

      <Dialog open={!!approveTarget} onOpenChange={(o) => !o && setApproveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve repeat sample?</DialogTitle>
            <DialogDescription>
              A complimentary (no charge) booking for {approveTarget?.equipment_name} will be created for{" "}
              {approveTarget?.user_name || approveTarget?.user_email} in the first available slots, and the user will be
              notified.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={busyId != null}
              onClick={() => void approve()}
            >
              {busyId != null ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject repeat sample request</DialogTitle>
            <DialogDescription>
              {rejectTarget?.booking_id} — {rejectTarget?.equipment_name}. The user will see your reason in their
              notifications.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="repeat-reject-notes">Reason (optional)</Label>
            <Textarea
              id="repeat-reject-notes"
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Results are within specification"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={busyId != null} onClick={() => void reject()}>
              {busyId != null ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <X className="h-4 w-4 mr-1" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
