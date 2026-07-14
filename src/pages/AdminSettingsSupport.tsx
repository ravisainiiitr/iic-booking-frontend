import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Plus,
  Loader2,
  Eye,
  CheckCircle,
  Paperclip,
  MessageSquare,
  Send,
} from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import TicketForm from "@/components/TicketForm";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const TICKET_TYPE_OPTIONS = [
  { value: "booking", label: "Booking" },
  { value: "equipment", label: "Equipment" },
  { value: "other", label: "Other" },
  { value: "quality_improvement", label: "Quality improvement suggestions/Bugs" },
];

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

type TicketComment = {
  comment_id: number;
  user_name: string | null;
  user_email: string | null;
  comment: string;
  is_internal: boolean;
  created_at: string;
};

type TicketRow = {
  ticket_id: number;
  subject: string;
  description?: string;
  ticket_type: string;
  ticket_type_display: string;
  status: string;
  status_display: string;
  priority: string;
  priority_display: string;
  user_name: string | null;
  user_email: string | null;
  public_name: string | null;
  public_email: string | null;
  assigned_to_name: string | null;
  assigned_to_email: string | null;
  resolution_notes?: string | null;
  attachment_url?: string | null;
  attachment_name?: string | null;
  comments_count?: number;
  created_at: string;
};

function withAuthToken(url: string): string {
  const token = apiClient.getToken?.() || localStorage.getItem("auth_token");
  if (!token) return url;
  try {
    const u = new URL(url, window.location.origin);
    u.searchParams.set("token", token);
    return u.toString();
  } catch {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}token=${encodeURIComponent(token)}`;
  }
}

const AdminSettingsSupport = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isAdmin = userTypeStr === "admin";

  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [ticketTypeFilter, setTicketTypeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const [selectedTicket, setSelectedTicket] = useState<TicketRow | null>(null);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolveSubmitting, setResolveSubmitting] = useState(false);

  const loadTickets = async () => {
    setLoading(true);
    const params: { status?: string; ticket_type?: string; priority?: string } = {};
    if (statusFilter) params.status = statusFilter;
    if (ticketTypeFilter) params.ticket_type = ticketTypeFilter;
    if (priorityFilter) params.priority = priorityFilter;
    const res = await apiClient.getTickets(params);
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
      toast({ title: "Access denied", description: "Only admin can access Support.", variant: "destructive" });
      navigate("/admin-settings");
      return;
    }
  }, [navigate, isAuthenticated, user, isAdmin, authLoading]);

  useEffect(() => {
    if (isAdmin && isAuthenticated) loadTickets();
  }, [isAdmin, isAuthenticated]);

  const getUserDisplay = (row: TicketRow) => {
    if (row.user_name || row.user_email) return row.user_name || row.user_email || "—";
    if (row.public_name || row.public_email) {
      return row.public_name
        ? `${row.public_name} (${row.public_email || ""})`
        : row.public_email || "—";
    }
    return "—";
  };

  const openTicket = async (row: TicketRow) => {
    setSelectedTicket(row);
    setCommentText("");
    setDetailLoading(true);
    const [ticketRes, commentsRes] = await Promise.all([
      apiClient.getTicket(row.ticket_id),
      apiClient.getTicketComments(row.ticket_id),
    ]);
    setDetailLoading(false);
    if (ticketRes.error) {
      toast({ title: "Error", description: ticketRes.error, variant: "destructive" });
      return;
    }
    if (ticketRes.data) setSelectedTicket(ticketRes.data as TicketRow);
    if (!commentsRes.error && commentsRes.data) {
      setComments(commentsRes.data.comments || []);
    } else {
      setComments([]);
    }
  };

  const closeDetail = () => {
    setSelectedTicket(null);
    setComments([]);
    setCommentText("");
    setResolveOpen(false);
    setResolutionNotes("");
  };

  const handleAddComment = async () => {
    if (!selectedTicket || !commentText.trim()) return;
    setCommentSubmitting(true);
    const res = await apiClient.createTicketComment(selectedTicket.ticket_id, commentText.trim(), false);
    setCommentSubmitting(false);
    if (res.error) {
      toast({ title: "Error", description: res.error || "Failed to add comment", variant: "destructive" });
      return;
    }
    toast({ title: "Comment added", description: "The requester will be notified by email." });
    setCommentText("");
    openTicket(selectedTicket);
    loadTickets();
  };

  const handleMarkResolved = async () => {
    if (!selectedTicket) return;
    setResolveSubmitting(true);
    const notes = resolutionNotes.trim();
    const res = await apiClient.updateTicket(selectedTicket.ticket_id, {
      status: "resolved",
      resolution_notes: notes || undefined,
    });
    setResolveSubmitting(false);
    if (res.error) {
      toast({ title: "Error", description: res.error || "Failed to resolve ticket", variant: "destructive" });
      return;
    }
    toast({
      title: "Ticket resolved",
      description: "The requester has been notified by email.",
    });
    setResolveOpen(false);
    setResolutionNotes("");
    openTicket(selectedTicket);
    loadTickets();
  };

  if (!isAdmin && !authLoading) return null;

  const canResolve =
    selectedTicket &&
    selectedTicket.status !== "resolved" &&
    selectedTicket.status !== "closed" &&
    selectedTicket.status !== "cancelled";

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate("/admin-settings")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin Settings
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            Dashboard
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Support Tickets</CardTitle>
            <CardDescription>
              Review tickets, open attachments, add comments, and mark issues resolved (user is emailed).
            </CardDescription>
            <div className="flex justify-end pt-2">
              <TicketForm
                trigger={
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Ticket
                  </Button>
                }
                onSuccess={() => loadTickets()}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-6 p-4 rounded-lg border bg-muted/30 space-y-3">
              <p className="text-sm font-medium">Filters</p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs whitespace-nowrap">Status</span>
                  <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {STATUS_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs whitespace-nowrap">Type</span>
                  <Select
                    value={ticketTypeFilter || "all"}
                    onValueChange={(v) => setTicketTypeFilter(v === "all" ? "" : v)}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {TICKET_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs whitespace-nowrap">Priority</span>
                  <Select
                    value={priorityFilter || "all"}
                    onValueChange={(v) => setPriorityFilter(v === "all" ? "" : v)}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {PRIORITY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="secondary" size="sm" onClick={() => loadTickets()} disabled={loading}>
                  Apply
                </Button>
                {(statusFilter || ticketTypeFilter || priorityFilter) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStatusFilter("");
                      setTicketTypeFilter("");
                      setPriorityFilter("");
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : tickets.length === 0 ? (
              <p className="text-muted-foreground py-8">No tickets found. Click Add Ticket to create one.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">ID</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Attachment</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-[90px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.map((row) => (
                      <TableRow
                        key={row.ticket_id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => openTicket(row)}
                      >
                        <TableCell className="font-mono text-muted-foreground">#{row.ticket_id}</TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate" title={row.subject}>
                          {row.subject || "—"}
                        </TableCell>
                        <TableCell>{row.ticket_type_display || row.ticket_type || "—"}</TableCell>
                        <TableCell>{row.status_display || row.status || "—"}</TableCell>
                        <TableCell>{row.priority_display || row.priority || "—"}</TableCell>
                        <TableCell className="max-w-[180px] truncate" title={getUserDisplay(row)}>
                          {getUserDisplay(row)}
                        </TableCell>
                        <TableCell>
                          {row.attachment_url ? (
                            <Paperclip className="h-4 w-4 text-primary" aria-label="Has attachment" />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {row.created_at ? new Date(row.created_at).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openTicket(row);
                            }}
                          >
                            <Eye className="h-4 w-4" />
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

        <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && closeDetail()}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            {selectedTicket && (
              <>
                <DialogHeader>
                  <DialogTitle>Ticket #{selectedTicket.ticket_id}</DialogTitle>
                  <DialogDescription>{selectedTicket.subject}</DialogDescription>
                </DialogHeader>

                {detailLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Type</p>
                        <p>{selectedTicket.ticket_type_display || selectedTicket.ticket_type}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Status</p>
                        <Badge variant="secondary">{selectedTicket.status_display || selectedTicket.status}</Badge>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Priority</p>
                        <p>{selectedTicket.priority_display || selectedTicket.priority}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Raised by</p>
                        <p className="truncate">{getUserDisplay(selectedTicket)}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Created</p>
                        <p>
                          {selectedTicket.created_at
                            ? format(new Date(selectedTicket.created_at), "MMM d, yyyy 'at' h:mm a")
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Assigned to</p>
                        <p>
                          {selectedTicket.assigned_to_name || selectedTicket.assigned_to_email || "—"}
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Description</p>
                      <p className="whitespace-pre-wrap text-sm">{selectedTicket.description || "—"}</p>
                    </div>

                    {selectedTicket.attachment_url && (
                      <div className="rounded-md border bg-muted/20 p-3">
                        <p className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                          <Paperclip className="h-4 w-4" />
                          Attachment
                        </p>
                        <a
                          href={withAuthToken(selectedTicket.attachment_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline break-all"
                        >
                          {selectedTicket.attachment_name || "View / Download attachment"}
                        </a>
                      </div>
                    )}

                    {selectedTicket.resolution_notes && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Resolution notes</p>
                        <p className="whitespace-pre-wrap text-sm">{selectedTicket.resolution_notes}</p>
                      </div>
                    )}

                    {canResolve && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => {
                            setResolutionNotes("");
                            setResolveOpen(true);
                          }}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Mark resolved
                        </Button>
                      </div>
                    )}

                    <div className="border-t pt-4">
                      <p className="text-sm font-medium mb-2 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Updates & comments
                      </p>
                      <div className="space-y-3 max-h-[240px] overflow-y-auto">
                        {comments.map((c) => (
                          <div key={c.comment_id} className="border rounded-lg p-3">
                            <div className="flex justify-between items-start mb-1">
                              <p className="font-medium text-sm">
                                {c.user_name || c.user_email || "System"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(c.created_at), "MMM d, yyyy h:mm a")}
                              </p>
                            </div>
                            {c.is_internal && (
                              <Badge variant="outline" className="text-xs mb-1">
                                Internal
                              </Badge>
                            )}
                            <p className="text-sm whitespace-pre-wrap">{c.comment}</p>
                          </div>
                        ))}
                        {comments.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">No updates yet</p>
                        )}
                      </div>
                    </div>

                    <div className="border-t pt-4 space-y-2">
                      <Label htmlFor="admin_ticket_comment">Add comment</Label>
                      <Textarea
                        id="admin_ticket_comment"
                        placeholder="Comment is visible to the requester and emailed..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        className="min-h-[90px]"
                      />
                      <Button
                        onClick={handleAddComment}
                        disabled={!commentText.trim() || commentSubmitting}
                      >
                        {commentSubmitting ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4 mr-2" />
                        )}
                        Add comment
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={resolveOpen} onOpenChange={(open) => !open && setResolveOpen(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark ticket as resolved</DialogTitle>
              <DialogDescription>
                Optional notes are emailed to the requester with the resolution notification.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label htmlFor="resolve_notes">Resolution notes / comment</Label>
              <Textarea
                id="resolve_notes"
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="e.g. Slot restored; booking updated as requested."
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResolveOpen(false)} disabled={resolveSubmitting}>
                Cancel
              </Button>
              <Button onClick={handleMarkResolved} disabled={resolveSubmitting}>
                {resolveSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Resolve & notify
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default AdminSettingsSupport;
