import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  TicketPriorityBadge,
  TicketStatusBadge,
  TICKET_PRIORITY_OPTIONS,
  TICKET_STATUS_OPTIONS,
  withAuthToken,
} from "@/components/ticketUi";
import { cn } from "@/lib/utils";
import {
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Clock3,
  Loader2,
  MessageSquare,
  Paperclip,
  Send,
  UserRound,
} from "lucide-react";

export type TicketDetailsData = {
  ticket_id: number;
  subject: string;
  description?: string;
  ticket_type: string;
  ticket_type_display?: string;
  status: string;
  status_display?: string;
  priority: string;
  priority_display?: string;
  user_name?: string | null;
  user_email?: string | null;
  public_name?: string | null;
  public_email?: string | null;
  requester_name?: string | null;
  requester_email?: string | null;
  assigned_to?: number | null;
  assigned_to_name?: string | null;
  assigned_to_email?: string | null;
  related_equipment?: number | null;
  related_equipment_name?: string | null;
  related_equipment_code?: string | null;
  resolution_notes?: string | null;
  attachment_url?: string | null;
  attachment_name?: string | null;
  created_at: string;
};

type TicketComment = {
  comment_id: number;
  user_name: string | null;
  user_email: string | null;
  comment: string;
  is_internal: boolean;
  created_at: string;
};

type TicketEvent = {
  event_id: number;
  event_type: string;
  event_type_display: string;
  actor_name: string | null;
  message: string;
  from_value: string;
  to_value: string;
  is_internal: boolean;
  created_at: string;
};

type AssigneeOption = {
  id: number;
  name: string;
  email: string;
  user_type: string;
  user_type_display: string;
};

type TicketDetailsDialogProps = {
  ticket: TicketDetailsData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Staff can change status, reassign, add internal notes, resolve */
  isStaff?: boolean;
  onUpdated?: () => void;
};

function requesterLabel(t: TicketDetailsData) {
  return (
    t.requester_name ||
    t.user_name ||
    t.public_name ||
    t.requester_email ||
    t.user_email ||
    t.public_email ||
    "Anonymous"
  );
}

function requesterEmail(t: TicketDetailsData) {
  return t.requester_email || t.user_email || t.public_email || "";
}

export default function TicketDetailsDialog({
  ticket,
  open,
  onOpenChange,
  isStaff = false,
  onUpdated,
}: TicketDetailsDialogProps) {
  const { toast } = useToast();
  const [detail, setDetail] = useState<TicketDetailsData | null>(ticket);
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [internalNote, setInternalNote] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [resolveNotes, setResolveNotes] = useState("");
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [assigneeQuery, setAssigneeQuery] = useState("");
  const [assignees, setAssignees] = useState<AssigneeOption[]>([]);
  const [assigneeLoading, setAssigneeLoading] = useState(false);
  const [reassigning, setReassigning] = useState(false);

  const loadAll = useCallback(async () => {
    if (!ticket?.ticket_id) return;
    setLoading(true);
    const [detailRes, commentsRes, eventsRes] = await Promise.all([
      apiClient.getTicket(ticket.ticket_id),
      apiClient.getTicketComments(ticket.ticket_id),
      apiClient.getTicketEvents(ticket.ticket_id),
    ]);
    setLoading(false);
    if (detailRes.data) setDetail(detailRes.data as TicketDetailsData);
    else if (detailRes.error) {
      toast({ title: "Error", description: detailRes.error, variant: "destructive" });
    }
    setComments(commentsRes.data?.comments ?? []);
    setEvents(eventsRes.data?.events ?? []);
    if (detailRes.data?.resolution_notes) {
      setResolveNotes(String(detailRes.data.resolution_notes));
    }
  }, [ticket?.ticket_id, toast]);

  useEffect(() => {
    setDetail(ticket);
    if (open && ticket?.ticket_id) {
      void loadAll();
    }
  }, [open, ticket, loadAll]);

  useEffect(() => {
    if (!isStaff || !assigneeOpen) return;
    let cancelled = false;
    const t = window.setTimeout(async () => {
      setAssigneeLoading(true);
      const res = await apiClient.searchTicketAssignees(assigneeQuery);
      if (cancelled) return;
      setAssigneeLoading(false);
      setAssignees(res.data?.assignees ?? []);
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [assigneeOpen, assigneeQuery, isStaff]);

  const conversationComments = useMemo(() => {
    // Keep human conversation; system lifecycle lines still show but styled quieter
    return comments;
  }, [comments]);

  const patchTicket = async (data: {
    status?: string;
    priority?: string;
    assigned_to?: number | null;
    resolution_notes?: string;
  }) => {
    if (!detail) return;
    setStatusSaving(true);
    const res = await apiClient.updateTicket(detail.ticket_id, data);
    setStatusSaving(false);
    if (res.error) {
      toast({ title: "Update failed", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: "Ticket updated" });
    await loadAll();
    onUpdated?.();
  };

  const handleAddComment = async () => {
    if (!detail || !commentText.trim()) return;
    setCommentSubmitting(true);
    const res = await apiClient.createTicketComment(
      detail.ticket_id,
      commentText.trim(),
      isStaff ? internalNote : false
    );
    setCommentSubmitting(false);
    if (res.error) {
      toast({ title: "Error", description: res.error, variant: "destructive" });
      return;
    }
    setCommentText("");
    setInternalNote(false);
    await loadAll();
    onUpdated?.();
  };

  const handleReassign = async (assigneeId: number | null) => {
    if (!detail) return;
    setReassigning(true);
    const res = await apiClient.updateTicket(detail.ticket_id, { assigned_to: assigneeId });
    setReassigning(false);
    setAssigneeOpen(false);
    if (res.error) {
      toast({ title: "Reassign failed", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: assigneeId ? "Ticket reassigned" : "Assignee cleared" });
    await loadAll();
    onUpdated?.();
  };

  const handleResolve = async () => {
    if (!detail) return;
    await patchTicket({
      status: "resolved",
      resolution_notes: resolveNotes.trim() || detail.resolution_notes || "",
    });
  };

  if (!detail) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-teal-50/80 to-background dark:from-teal-950/30">
          <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-xl font-semibold tracking-tight">
                Ticket #{detail.ticket_id}
              </DialogTitle>
              <DialogDescription className="text-base text-foreground/80 font-medium">
                {detail.subject}
              </DialogDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <TicketStatusBadge status={detail.status} label={detail.status_display} />
              <TicketPriorityBadge priority={detail.priority} label={detail.priority_display} />
            </div>
          </div>
        </DialogHeader>

        <div className="grid lg:grid-cols-[1fr_240px] max-h-[calc(92vh-5.5rem)] overflow-hidden">
          <ScrollArea className="max-h-[calc(92vh-5.5rem)]">
            <div className="px-6 py-5 space-y-5">
              {loading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading conversation…
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Type</p>
                  <p className="font-medium">{detail.ticket_type_display || detail.ticket_type}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Created</p>
                  <p className="font-medium">
                    {format(new Date(detail.created_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Raised by</p>
                  <p className="font-medium">{requesterLabel(detail)}</p>
                  {requesterEmail(detail) && (
                    <p className="text-xs text-muted-foreground">{requesterEmail(detail)}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Assigned to</p>
                  <p className="font-medium">
                    {detail.assigned_to_name || detail.assigned_to_email || "— Unassigned —"}
                  </p>
                </div>
                {(detail.related_equipment_code || detail.related_equipment_name) && (
                  <div className="sm:col-span-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Equipment</p>
                    <p className="font-medium">
                      {[detail.related_equipment_code, detail.related_equipment_name]
                        .filter(Boolean)
                        .join(" — ")}
                    </p>
                  </div>
                )}
              </div>

              {/* Original request */}
              <section className="rounded-xl border-2 border-teal-200/80 bg-teal-50/40 dark:border-teal-900 dark:bg-teal-950/20 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-teal-700" />
                    Original request
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(detail.created_at), "MMM d, yyyy h:mm a")}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">
                  {detail.description || "—"}
                </p>
                {detail.attachment_url && (
                  <a
                    href={withAuthToken(detail.attachment_url)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-teal-800 dark:text-teal-200 underline-offset-2 hover:underline"
                  >
                    <Paperclip className="h-4 w-4" />
                    {detail.attachment_name || "Download attachment"}
                  </a>
                )}
              </section>

              {/* Conversation */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Conversation</h3>
                <div className="space-y-3">
                  {conversationComments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No replies yet.</p>
                  ) : (
                    conversationComments.map((c) => {
                      const isSystem =
                        !c.user_name &&
                        (c.comment.startsWith("Ticket raised") ||
                          c.comment.startsWith("Status updated") ||
                          c.comment.startsWith("Assignment"));
                      return (
                        <div
                          key={c.comment_id}
                          className={cn(
                            "rounded-xl border px-3.5 py-3",
                            c.is_internal
                              ? "border-dashed border-amber-300 bg-amber-50/60 dark:bg-amber-950/20"
                              : isSystem
                                ? "border-border/60 bg-muted/30 text-muted-foreground"
                                : "border-border bg-background shadow-sm"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <UserRound className="h-3.5 w-3.5 shrink-0 opacity-70" />
                              <span className="text-sm font-medium truncate">
                                {c.user_name || c.user_email || "System"}
                              </span>
                              {c.is_internal && (
                                <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-800">
                                  Internal
                                </Badge>
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                              {format(new Date(c.created_at), "MMM d, yyyy h:mm a")}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{c.comment}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              {/* Reply box */}
              <section className="space-y-2 rounded-xl border bg-muted/20 p-4">
                <Label htmlFor="ticket-reply">Add comment</Label>
                <Textarea
                  id="ticket-reply"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={
                    isStaff
                      ? "Reply to the requester (or mark as internal note)…"
                      : "Add a comment for the support team…"
                  }
                  rows={3}
                />
                {isStaff && (
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox
                      checked={internalNote}
                      onCheckedChange={(v) => setInternalNote(!!v)}
                    />
                    Internal note (staff only)
                  </label>
                )}
                <Button
                  type="button"
                  onClick={() => void handleAddComment()}
                  disabled={commentSubmitting || !commentText.trim()}
                  className="bg-teal-700 hover:bg-teal-800"
                >
                  {commentSubmitting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Add comment
                </Button>
              </section>

              {isStaff && (
                <section className="space-y-3 rounded-xl border border-emerald-200/70 bg-emerald-50/30 dark:border-emerald-900 dark:bg-emerald-950/20 p-4">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                    Staff actions
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Status</Label>
                      <Select
                        value={detail.status}
                        onValueChange={(v) => void patchTicket({ status: v })}
                        disabled={statusSaving}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TICKET_STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Priority</Label>
                      <Select
                        value={detail.priority}
                        onValueChange={(v) => void patchTicket({ priority: v })}
                        disabled={statusSaving}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TICKET_PRIORITY_OPTIONS.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Reassign to</Label>
                    <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full justify-between font-normal"
                          disabled={reassigning}
                        >
                          {detail.assigned_to_name ||
                            detail.assigned_to_email ||
                            "Search Admin / OIC / Operator / Finance…"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Search by name or email…"
                            value={assigneeQuery}
                            onValueChange={setAssigneeQuery}
                          />
                          <CommandList>
                            <CommandEmpty>
                              {assigneeLoading ? "Searching…" : "No staff found."}
                            </CommandEmpty>
                            <CommandGroup>
                              <CommandItem
                                value="unassign"
                                onSelect={() => void handleReassign(null)}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    !detail.assigned_to ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                Unassigned
                              </CommandItem>
                              {assignees.map((a) => (
                                <CommandItem
                                  key={a.id}
                                  value={`${a.id}-${a.email}`}
                                  onSelect={() => void handleReassign(a.id)}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      detail.assigned_to === a.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">
                                      {a.name || a.email}
                                    </p>
                                    <p className="truncate text-xs text-muted-foreground">
                                      {a.email} · {a.user_type_display}
                                    </p>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="resolution-notes">Resolution comments</Label>
                    <Textarea
                      id="resolution-notes"
                      value={resolveNotes}
                      onChange={(e) => setResolveNotes(e.target.value)}
                      placeholder="Shared with the requester when marked resolved…"
                      rows={3}
                    />
                  </div>
                  <Button
                    type="button"
                    className="bg-emerald-700 hover:bg-emerald-800"
                    disabled={statusSaving || detail.status === "resolved"}
                    onClick={() => void handleResolve()}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Mark resolved
                  </Button>
                </section>
              )}
            </div>
          </ScrollArea>

          {/* Timeline */}
          <aside className="border-t lg:border-t-0 lg:border-l bg-muted/20 max-h-[calc(92vh-5.5rem)] overflow-auto p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              Timeline
            </h3>
            {events.length === 0 ? (
              <p className="text-xs text-muted-foreground">No events yet.</p>
            ) : (
              <ol className="relative space-y-4 border-l border-border/80 ml-2 pl-4">
                {[...events].reverse().map((ev) => (
                  <li key={ev.event_id} className="relative">
                    <span className="absolute -left-[1.3rem] top-1 h-2.5 w-2.5 rounded-full bg-teal-600 ring-2 ring-background" />
                    <p className="text-xs font-semibold capitalize">
                      {(ev.event_type_display || ev.event_type).replace(/_/g, " ")}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {format(new Date(ev.created_at), "MMM d, h:mm a")}
                      {ev.actor_name ? ` · ${ev.actor_name}` : ""}
                    </p>
                    {ev.message && (
                      <p className="text-xs mt-1 text-foreground/80 whitespace-pre-wrap">
                        {ev.message}
                      </p>
                    )}
                    {(ev.from_value || ev.to_value) && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {ev.from_value || "—"} → {ev.to_value || "—"}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
