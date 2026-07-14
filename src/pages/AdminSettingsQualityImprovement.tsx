import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Loader2, CheckCircle, XCircle } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type TicketRow = {
  ticket_id: number;
  subject: string;
  description?: string;
  ticket_type: string;
  ticket_type_display: string;
  status: string;
  status_display: string;
  resolution_notes: string | null;
  user_name: string | null;
  user_email: string | null;
  public_name: string | null;
  public_email: string | null;
  created_at: string;
};

const AdminSettingsQualityImprovement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isAdmin = userTypeStr === "admin";

  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionTicket, setActionTicket] = useState<TicketRow | null>(null);
  const [actionType, setActionType] = useState<"resolved" | "unresolved" | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadTickets = async () => {
    setLoading(true);
    const res = await apiClient.getTickets({ ticket_type: "quality_improvement" });
    setLoading(false);
    if (res.error) {
      toast({ title: "Error", description: res.error, variant: "destructive" });
      setTickets([]);
      return;
    }
    setTickets(res.data?.tickets ?? []);
  };

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !user)) {
      navigate("/auth");
      return;
    }
    if (!authLoading && !isAdmin) {
      toast({ title: "Access denied", description: "Only admin can access Quality Improvement.", variant: "destructive" });
      navigate("/admin-settings");
      return;
    }
  }, [navigate, isAuthenticated, user, isAdmin, authLoading]);

  useEffect(() => {
    if (isAdmin && isAuthenticated) loadTickets();
  }, [isAdmin, isAuthenticated]);

  const openResolved = (ticket: TicketRow) => {
    setActionTicket(ticket);
    setActionType("resolved");
    setResolutionNotes("");
  };

  const openUnresolved = (ticket: TicketRow) => {
    setActionTicket(ticket);
    setActionType("unresolved");
    setResolutionNotes("");
  };

  const closeDialog = () => {
    setActionTicket(null);
    setActionType(null);
    setResolutionNotes("");
  };

  const submitAction = async () => {
    if (!actionTicket || !actionType) return;
    if (actionType === "unresolved" && !resolutionNotes.trim()) {
      toast({ title: "Reason required", description: "Please provide a reason when marking as unresolved.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const status = actionType === "resolved" ? "resolved" : "closed";
    const res = await apiClient.updateTicket(actionTicket.ticket_id, {
      status,
      resolution_notes: resolutionNotes.trim() || undefined,
    });
    setSubmitting(false);
    if (res.error) {
      toast({ title: "Error", description: res.error || "Failed to update ticket", variant: "destructive" });
      return;
    }
    toast({
      title: actionType === "resolved" ? "Marked as Resolved" : "Marked as Unresolved",
      description: actionType === "unresolved" ? "The user will receive an email with the reason." : "The user will be notified by email.",
    });
    closeDialog();
    loadTickets();
  };

  const getUserDisplay = (row: TicketRow) => {
    if (row.user_name || row.user_email) return row.user_name || row.user_email || "—";
    if (row.public_name || row.public_email) return row.public_name ? `${row.public_name} (${row.public_email || ""})` : (row.public_email || "—");
    return "—";
  };

  if (!isAdmin && !authLoading) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate("/admin-settings")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin Settings
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quality Improvement</CardTitle>
            <CardDescription>
              Bugs and suggestions for the booking website. Mark as Resolved or Unresolved (with reason); the user will be notified by email.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : tickets.length === 0 ? (
              <p className="text-muted-foreground py-8">No quality improvement tickets yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">ID</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Raised by</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right w-[240px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.map((row) => (
                      <TableRow key={row.ticket_id}>
                        <TableCell className="font-mono text-muted-foreground">#{row.ticket_id}</TableCell>
                        <TableCell className="font-medium max-w-[220px]" title={row.subject}>
                          <span className="line-clamp-2">{row.subject || "—"}</span>
                        </TableCell>
                        <TableCell>{row.status_display || row.status || "—"}</TableCell>
                        <TableCell className="max-w-[180px] truncate" title={getUserDisplay(row)}>
                          {getUserDisplay(row)}
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          {row.status !== "resolved" && row.status !== "closed" && (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                className="gap-1"
                                onClick={() => openResolved(row)}
                              >
                                <CheckCircle className="h-3.5 w-3.5" />
                                Resolved
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="gap-1"
                                onClick={() => openUnresolved(row)}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Unresolved
                              </Button>
                            </>
                          )}
                          {(row.status === "resolved" || row.status === "closed") && row.resolution_notes && (
                            <span className="text-xs text-muted-foreground" title={row.resolution_notes}>
                              Note: {row.resolution_notes.slice(0, 40)}…
                            </span>
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

        <Dialog open={!!actionTicket} onOpenChange={(open) => !open && closeDialog()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionType === "resolved" ? "Mark as Resolved" : "Mark as Unresolved"}
              </DialogTitle>
              <DialogDescription>
                {actionType === "resolved"
                  ? "Optionally add a note. The user will receive an email with the outcome."
                  : "Please provide the reason for marking as unresolved. This will be sent to the user by email."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label htmlFor="resolution_notes">
                {actionType === "unresolved" ? "Reason (required)" : "Notes (optional)"}
              </Label>
              <Textarea
                id="resolution_notes"
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder={actionType === "unresolved" ? "e.g. Duplicate report; cannot reproduce." : "e.g. Fixed in latest release."}
                rows={3}
                className="resize-none"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog} disabled={submitting}>
                Cancel
              </Button>
              <Button onClick={submitAction} disabled={submitting || (actionType === "unresolved" && !resolutionNotes.trim())}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {submitting ? "Updating…" : actionType === "resolved" ? "Mark Resolved" : "Mark Unresolved"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default AdminSettingsQualityImprovement;
