import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { ArrowLeft, Plus, Loader2, Eye, Paperclip, Search } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import TicketForm from "@/components/TicketForm";
import TicketDetailsDialog, { type TicketDetailsData } from "@/components/TicketDetailsDialog";
import {
  DEFAULT_TICKET_TYPE_OPTIONS,
  TicketPriorityBadge,
  TicketStatusBadge,
  TICKET_PRIORITY_OPTIONS,
} from "@/components/ticketUi";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type TicketRow = TicketDetailsData & {
  comments_count?: number;
};

const PAGE_SIZE = 25;

const AdminSettingsSupport = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isAdmin = userTypeStr === "admin";

  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("open");
  const [ticketTypeFilter, setTicketTypeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [ordering, setOrdering] = useState("-created_at");
  const [page, setPage] = useState(0);

  const [selectedTicket, setSelectedTicket] = useState<TicketRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    const params: {
      status?: string;
      ticket_type?: string;
      priority?: string;
      search?: string;
      ordering?: string;
      limit?: number;
      offset?: number;
    } = {
      ordering,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    };
    if (statusFilter && statusFilter !== "all") params.status = statusFilter;
    if (ticketTypeFilter) params.ticket_type = ticketTypeFilter;
    if (priorityFilter) params.priority = priorityFilter;
    if (search.trim()) params.search = search.trim();
    const res = await apiClient.getTickets(params);
    setLoading(false);
    if (res.error) {
      toast({ title: "Error", description: res.error, variant: "destructive" });
      setTickets([]);
      setTotalCount(0);
      return;
    }
    setTickets((res.data?.tickets ?? []) as TicketRow[]);
    setTotalCount(res.data?.count ?? 0);
  }, [statusFilter, ticketTypeFilter, priorityFilter, search, ordering, page, toast]);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !user)) {
      navigate("/auth");
      return;
    }
    if (!authLoading && !isAdmin) {
      toast({ title: "Access denied", description: "Only admin can access Support.", variant: "destructive" });
      navigate("/admin-settings");
    }
  }, [navigate, isAuthenticated, user, isAdmin, authLoading, toast]);

  useEffect(() => {
    if (isAdmin && isAuthenticated) void loadTickets();
  }, [isAdmin, isAuthenticated, loadTickets]);

  const getUserDisplay = (row: TicketRow) => {
    if (row.requester_name || row.requester_email) {
      return row.requester_name || row.requester_email || "—";
    }
    if (row.user_name || row.user_email) return row.user_name || row.user_email || "—";
    if (row.public_name || row.public_email) {
      return row.public_name
        ? `${row.public_name}${row.public_email ? ` (${row.public_email})` : ""}`
        : row.public_email || "—";
    }
    return "—";
  };

  const openTicket = (row: TicketRow) => {
    setSelectedTicket(row);
    setDetailOpen(true);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  if (!isAdmin && !authLoading) return null;

  return (
    <div className="page-shell">
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

        <Card className="shadow-[var(--shadow-card)] border-teal-100/80 dark:border-teal-900/40 rounded-2xl overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-2xl">Support desk</CardTitle>
                <CardDescription className="mt-1">
                  Manage tickets, reassign staff, and resolve requests. Requesters are emailed on resolution.
                </CardDescription>
              </div>
              <TicketForm
                trigger={
                  <Button className="bg-teal-700 hover:bg-teal-800">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Ticket
                  </Button>
                }
                onSuccess={() => void loadTickets()}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status tabs */}
            <div className="flex flex-wrap gap-1.5 rounded-xl border bg-muted/30 p-1.5">
              {[
                { value: "open", label: "Open" },
                { value: "in_progress", label: "In Progress" },
                { value: "resolved", label: "Resolved" },
                { value: "closed", label: "Closed" },
                { value: "cancelled", label: "Cancelled" },
                { value: "all", label: "All" },
              ].map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => {
                    setStatusFilter(tab.value);
                    setPage(0);
                  }}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    statusFilter === tab.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/20 p-3">
              <div className="flex-1 min-w-[200px] space-y-1">
                <p className="text-xs text-muted-foreground">Search</p>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="ID, subject, email, equipment…"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setSearch(searchInput);
                        setPage(0);
                      }
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Type</p>
                <Select
                  value={ticketTypeFilter || "all"}
                  onValueChange={(v) => {
                    setTicketTypeFilter(v === "all" ? "" : v);
                    setPage(0);
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {DEFAULT_TICKET_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Priority</p>
                <Select
                  value={priorityFilter || "all"}
                  onValueChange={(v) => {
                    setPriorityFilter(v === "all" ? "" : v);
                    setPage(0);
                  }}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {TICKET_PRIORITY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Sort</p>
                <Select
                  value={ordering}
                  onValueChange={(v) => {
                    setOrdering(v);
                    setPage(0);
                  }}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="-created_at">Newest first</SelectItem>
                    <SelectItem value="created_at">Oldest first</SelectItem>
                    <SelectItem value="-priority">Priority</SelectItem>
                    <SelectItem value="status">Status</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch(searchInput);
                  setPage(0);
                }}
                disabled={loading}
              >
                Apply
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : tickets.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center">
                No tickets in this view. Try another status tab or clear filters.
              </p>
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="w-[72px]">ID</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Requester</TableHead>
                        <TableHead>Assignee</TableHead>
                        <TableHead>Equipment</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="w-[80px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tickets.map((row) => (
                        <TableRow
                          key={row.ticket_id}
                          className="cursor-pointer hover:bg-teal-50/40 dark:hover:bg-teal-950/20"
                          onClick={() => openTicket(row)}
                        >
                          <TableCell className="font-mono text-muted-foreground">
                            #{row.ticket_id}
                          </TableCell>
                          <TableCell className="font-medium max-w-[200px] truncate" title={row.subject}>
                            {row.subject || "—"}
                          </TableCell>
                          <TableCell className="text-sm max-w-[140px] truncate">
                            {row.ticket_type_display || row.ticket_type || "—"}
                          </TableCell>
                          <TableCell>
                            <TicketStatusBadge status={row.status} label={row.status_display} />
                          </TableCell>
                          <TableCell>
                            <TicketPriorityBadge priority={row.priority} label={row.priority_display} />
                          </TableCell>
                          <TableCell className="max-w-[160px] truncate" title={getUserDisplay(row)}>
                            {getUserDisplay(row)}
                          </TableCell>
                          <TableCell className="max-w-[140px] truncate text-sm">
                            {row.assigned_to_name || row.assigned_to_email || (
                              <span className="text-muted-foreground">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[120px] truncate text-sm">
                            {row.related_equipment_code || row.related_equipment_name || "—"}
                            {row.attachment_url ? (
                              <Paperclip className="inline h-3.5 w-3.5 ml-1 text-teal-700" />
                            ) : null}
                          </TableCell>
                          <TableCell className="text-muted-foreground whitespace-nowrap text-sm">
                            {row.created_at ? format(new Date(row.created_at), "MMM d, yyyy") : "—"}
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
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    {totalCount} ticket{totalCount === 1 ? "" : "s"} · page {page + 1} of {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 0 || loading}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page + 1 >= totalPages || loading}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <TicketDetailsDialog
          ticket={selectedTicket}
          open={detailOpen}
          onOpenChange={(open) => {
            setDetailOpen(open);
            if (!open) setSelectedTicket(null);
          }}
          isStaff
          onUpdated={() => void loadTickets()}
        />
      </main>
    </div>
  );
};

export default AdminSettingsSupport;
