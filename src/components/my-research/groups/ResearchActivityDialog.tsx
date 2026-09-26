import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import type {
  GroupActivity,
  GroupActivityInput,
  GroupActivityPriority,
  GroupActivityStatus,
  GroupBookingRef,
  GroupCategory,
  GroupEquipmentRef,
  GroupLinkedWorkspace,
  GroupMember,
} from "@/lib/researchGroupTypes";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ACTIVITY_STATUS_OPTIONS, PRIORITY_OPTIONS } from "./groupLabels";

interface Props {
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity?: GroupActivity | null;
  members: GroupMember[];
  categories: GroupCategory[];
  onSaved: (activity: GroupActivity) => void;
}

const NONE = "none";

export function ResearchActivityDialog({ groupId, open, onOpenChange, activity, members, categories, onSaved }: Props) {
  const editing = Boolean(activity);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(NONE);
  const [priority, setPriority] = useState<GroupActivityPriority>("NORMAL");
  const [status, setStatus] = useState<GroupActivityStatus>("NOT_STARTED");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assignees, setAssignees] = useState<number[]>([]);
  const [workspaceId, setWorkspaceId] = useState(NONE);
  const [bookingId, setBookingId] = useState(NONE);
  const [equipment, setEquipment] = useState<GroupEquipmentRef | null>(null);
  const [equipmentQuery, setEquipmentQuery] = useState("");
  const [equipmentResults, setEquipmentResults] = useState<GroupEquipmentRef[]>([]);
  const [workspaces, setWorkspaces] = useState<GroupLinkedWorkspace[]>([]);
  const [bookings, setBookings] = useState<GroupBookingRef[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(activity?.title ?? "");
    setDescription(activity?.description ?? "");
    setCategoryId(activity?.category ? String(activity.category.id) : NONE);
    setPriority(activity?.priority ?? "NORMAL");
    setStatus(activity?.status ?? "NOT_STARTED");
    setStartDate(activity?.start_date ?? "");
    setDueDate(activity?.due_date ?? "");
    setAssignees(activity?.assignees.map((a) => a.user.id) ?? []);
    setWorkspaceId(activity?.workspace ? activity.workspace.id : NONE);
    setBookingId(activity?.booking ? String(activity.booking.booking_id) : NONE);
    setEquipment(activity?.equipment ?? null);
    setEquipmentQuery("");
    setEquipmentResults([]);
    void apiClient.listLinkableGroupWorkspaces(groupId).then((res) => setWorkspaces(res.data?.results ?? []));
    void apiClient.listLinkableGroupBookings(groupId).then((res) => setBookings(res.data?.results ?? []));
  }, [open, activity, groupId]);

  useEffect(() => {
    const q = equipmentQuery.trim();
    if (q.length < 2) {
      setEquipmentResults([]);
      return;
    }
    let alive = true;
    const timer = setTimeout(async () => {
      const res = await apiClient.listLinkableGroupEquipment(groupId, q);
      if (alive) setEquipmentResults(res.data?.results ?? []);
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [equipmentQuery, groupId]);

  const toggleAssignee = (userId: number, checked: boolean) =>
    setAssignees((prev) => (checked ? [...new Set([...prev, userId])] : prev.filter((id) => id !== userId)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (startDate && dueDate && dueDate < startDate) {
      toast.error("The due date cannot be before the start date.");
      return;
    }
    const payload: GroupActivityInput = {
      title: title.trim(),
      description: description.trim(),
      category_id: categoryId === NONE ? null : Number(categoryId),
      priority,
      start_date: startDate || null,
      due_date: dueDate || null,
      assignee_user_ids: assignees,
      workspace_id: workspaceId === NONE ? null : workspaceId,
      booking_id: bookingId === NONE ? null : Number(bookingId),
      equipment_id: equipment?.equipment_id ?? null,
      ...(editing ? { status } : {}),
    };
    setSaving(true);
    const res = activity
      ? await apiClient.updateResearchGroupActivity(activity.id, payload)
      : await apiClient.createResearchGroupActivity(groupId, payload);
    setSaving(false);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not save the activity.");
      return;
    }
    toast.success(editing ? "Activity updated" : "Activity created");
    onSaved(res.data);
    onOpenChange(false);
  };

  const activeCategories = categories.filter((c) => c.active || c.id === activity?.category?.id);
  const workspaceOptions =
    activity?.workspace && !workspaces.some((w) => w.id === activity.workspace?.id) ? [activity.workspace, ...workspaces] : workspaces;
  const bookingOptions =
    activity?.booking && !bookings.some((b) => b.booking_id === activity.booking?.booking_id) ? [activity.booking, ...bookings] : bookings;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl [&>*]:min-w-0">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit activity" : "New activity"}</DialogTitle>
            <DialogDescription>
              Each assigned member tracks their own status and progress. Linking a workspace does not share it with anyone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="rg-act-title">Title</Label>
            <Input id="rg-act-title" value={title} maxLength={250} autoFocus onChange={(e) => setTitle(e.target.value)} placeholder="e.g. XRD analysis of annealed samples" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rg-act-desc">Description (optional)</Label>
            <Textarea id="rg-act-desc" rows={3} maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="rg-act-cat">Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="rg-act-cat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No category</SelectItem>
                  {activeCategories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rg-act-priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as GroupActivityPriority)}>
                <SelectTrigger id="rg-act-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rg-act-start">Start date</Label>
              <Input id="rg-act-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rg-act-due">Due date</Label>
              <Input id="rg-act-due" type="date" value={dueDate} min={startDate || undefined} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            {editing ? (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="rg-act-status">Overall status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as GroupActivityStatus)}>
                  <SelectTrigger id="rg-act-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Assign to</legend>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add members to the group first.</p>
            ) : (
              <div className="grid max-h-48 gap-1 overflow-y-auto rounded-md border p-2 sm:grid-cols-2">
                {members.map((m) => {
                  const id = `rg-assignee-${m.user.id}`;
                  return (
                    <label key={m.id} htmlFor={id} className="flex min-h-[40px] cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-muted/50">
                      <Checkbox id={id} checked={assignees.includes(m.user.id)} onCheckedChange={(c) => toggleAssignee(m.user.id, c === true)} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm">{m.user.name}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {m.member_type_label}
                          {m.category ? ` · ${m.category.name}` : ""}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Links (optional)</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rg-act-ws">Workspace</Label>
                <Select value={workspaceId} onValueChange={setWorkspaceId}>
                  <SelectTrigger id="rg-act-ws">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {workspaceOptions.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                        {w.owner ? ` · ${w.owner.name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Only workspaces you can open, owned by you or a group member.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rg-act-booking">Booking</Label>
                <Select value={bookingId} onValueChange={setBookingId}>
                  <SelectTrigger id="rg-act-booking">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>None</SelectItem>
                    {bookingOptions.map((b) => (
                      <SelectItem key={b.booking_id} value={String(b.booking_id)}>
                        {b.display_id}
                        {b.equipment_name ? ` · ${b.equipment_name}` : ""}
                        {b.user ? ` · ${b.user.name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rg-act-eq">Equipment</Label>
              {equipment ? (
                <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    {equipment.name} <span className="text-muted-foreground">({equipment.code})</span>
                  </span>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEquipment(null)}>
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input id="rg-act-eq" className="pl-9" value={equipmentQuery} onChange={(e) => setEquipmentQuery(e.target.value)} placeholder="Search equipment by name or code" />
                  </div>
                  {equipmentResults.length > 0 ? (
                    <ul className="max-h-40 divide-y overflow-y-auto rounded-md border">
                      {equipmentResults.map((eq) => (
                        <li key={eq.equipment_id}>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                            onClick={() => {
                              setEquipment(eq);
                              setEquipmentQuery("");
                            }}
                          >
                            {eq.name} <span className="text-muted-foreground">({eq.code})</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              )}
            </div>
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !title.trim()} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {editing ? "Save changes" : "Create activity"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
