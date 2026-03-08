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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Loader2 } from "lucide-react";
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

type TicketRow = {
  ticket_id: number;
  subject: string;
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
  created_at: string;
};

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
    setTickets((res as { tickets?: TicketRow[] }).tickets ?? []);
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
            <CardTitle>Support (Tickets)</CardTitle>
            <CardDescription>
              View and add support tickets. Mirrors Django admin /admin/support/ticket/ and add form.
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
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs whitespace-nowrap">Type</span>
                  <Select value={ticketTypeFilter || "all"} onValueChange={(v) => setTicketTypeFilter(v === "all" ? "" : v)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {TICKET_TYPE_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs whitespace-nowrap">Priority</span>
                  <Select value={priorityFilter || "all"} onValueChange={(v) => setPriorityFilter(v === "all" ? "" : v)}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {PRIORITY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
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
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.map((row) => (
                      <TableRow key={row.ticket_id}>
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
                        <TableCell className="max-w-[140px] truncate">
                          {row.assigned_to_name || row.assigned_to_email || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {row.created_at ? new Date(row.created_at).toLocaleDateString() : "—"}
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
    </div>
  );
};

export default AdminSettingsSupport;
