import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import { Eye, MessageSquare, Paperclip } from "lucide-react";
import { format } from "date-fns";
import TicketDetailsDialog, { type TicketDetailsData } from "@/components/TicketDetailsDialog";
import {
  DEFAULT_TICKET_TYPE_OPTIONS,
  TicketPriorityBadge,
  TicketStatusBadge,
} from "@/components/ticketUi";
import { cn } from "@/lib/utils";

type Ticket = TicketDetailsData & { comments_count?: number };

const TicketManagement = () => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const userTypeLower = String(user?.user_type ?? "").toLowerCase();
  const isTicketStaff = userTypeLower === "admin" || userTypeLower === "dept_admin";
  const isTicketHandler = userTypeLower === "manager" || userTypeLower === "operator";
  const [scope, setScope] = useState<"assigned" | "mine">(isTicketHandler ? "assigned" : "mine");
  const showAssignedColumns = isTicketHandler && scope === "assigned";

  const loadTickets = async () => {
    setLoading(true);
    try {
      const params: { status?: string; ticket_type?: string; scope?: "mine" | "assigned" } = {};
      if (statusFilter && statusFilter !== "all") params.status = statusFilter;
      if (isTicketHandler) params.scope = scope;
      if (typeFilter && typeFilter !== "all") params.ticket_type = typeFilter;

      const response = await apiClient.getTickets(params);
      if (response.error) {
        toast({
          title: "Error",
          description: response.error || "Failed to load tickets",
          variant: "destructive",
        });
        setTickets([]);
      } else {
        setTickets((response.data?.tickets || []) as Ticket[]);
      }
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load tickets",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) void loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, statusFilter, typeFilter, scope]);

  const deepLinkTicketId = searchParams.get("ticket");
  useEffect(() => {
    if (!isAuthenticated || !deepLinkTicketId || !/^\d+$/.test(deepLinkTicketId)) return;
    let cancelled = false;
    void (async () => {
      const res = await apiClient.getTicket(deepLinkTicketId);
      if (cancelled) return;
      if (res.data) {
        setSelectedTicket(res.data as unknown as Ticket);
        setDetailOpen(true);
      } else {
        toast({ title: "Ticket not found", description: res.error || "This ticket could not be opened.", variant: "destructive" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, deepLinkTicketId, toast]);

  const handleViewTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setDetailOpen(true);
  };

  if (!isAuthenticated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Tickets</CardTitle>
          <CardDescription>Please log in to view your tickets</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{showAssignedColumns ? "Tickets marked to me" : "My Tickets"}</CardTitle>
          <CardDescription>
            {showAssignedColumns
              ? "Tickets assigned to you or raised for equipment you look after. Open a ticket to read it and reply."
              : "Track support requests and conversation history"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isTicketHandler && (
            <div className="inline-flex rounded-xl border bg-muted/30 p-1.5" role="tablist" aria-label="Ticket scope">
              {[
                { value: "assigned" as const, label: "Marked to me" },
                { value: "mine" as const, label: "Raised by me" },
              ].map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={scope === tab.value}
                  onClick={() => setScope(tab.value)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    scope === tab.value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5 rounded-xl border bg-muted/30 p-1.5">
            {[
              { value: "open", label: "Open" },
              { value: "in_progress", label: "In Progress" },
              { value: "resolved", label: "Resolved" },
              { value: "closed", label: "Closed" },
              { value: "all", label: "All" },
            ].map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatusFilter(tab.value)}
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

          <div className="flex flex-wrap gap-3">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {DEFAULT_TICKET_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading tickets…</div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No tickets found</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>ID</TableHead>
                    <TableHead>Subject</TableHead>
                    {showAssignedColumns && <TableHead>Raised by</TableHead>}
                    {showAssignedColumns && <TableHead>Equipment</TableHead>}
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Comments</TableHead>
                    <TableHead>Attachment</TableHead>
                    <TableHead className="w-[90px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((ticket) => (
                    <TableRow
                      key={ticket.ticket_id}
                      className="cursor-pointer hover:bg-primary/5 dark:hover:bg-primary/10"
                      onClick={() => handleViewTicket(ticket)}
                    >
                      <TableCell className="font-mono text-muted-foreground">
                        #{ticket.ticket_id}
                      </TableCell>
                      <TableCell className="max-w-[220px] font-medium truncate" title={ticket.subject}>
                        {ticket.subject || "—"}
                      </TableCell>
                      {showAssignedColumns && (
                        <TableCell className="max-w-[180px] truncate text-sm">
                          {ticket.user_name || ticket.public_name || ticket.user_email || "—"}
                        </TableCell>
                      )}
                      {showAssignedColumns && (
                        <TableCell className="max-w-[200px] truncate text-sm">
                          {ticket.related_equipment_name || ticket.related_equipment_code || "—"}
                        </TableCell>
                      )}
                      <TableCell className="text-sm">
                        {ticket.ticket_type_display || ticket.ticket_type}
                      </TableCell>
                      <TableCell>
                        <TicketStatusBadge status={ticket.status} label={ticket.status_display} />
                      </TableCell>
                      <TableCell>
                        <TicketPriorityBadge priority={ticket.priority} label={ticket.priority_display} />
                      </TableCell>
                      <TableCell>
                        {format(new Date(ticket.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <MessageSquare className="h-4 w-4" />
                          {ticket.comments_count ?? 0}
                        </div>
                      </TableCell>
                      <TableCell>
                        {ticket.attachment_url ? (
                          <Paperclip className="h-4 w-4 text-primary" aria-label="Has attachment" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewTicket(ticket);
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

      <TicketDetailsDialog
        ticket={selectedTicket}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setSelectedTicket(null);
            if (searchParams.has("ticket")) {
              const next = new URLSearchParams(searchParams);
              next.delete("ticket");
              setSearchParams(next, { replace: true });
            }
          }
        }}
        isStaff={isTicketStaff}
        onUpdated={() => void loadTickets()}
      />
    </div>
  );
};

export default TicketManagement;
