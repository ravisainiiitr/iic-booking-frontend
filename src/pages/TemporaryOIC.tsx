import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, CalendarClock, Loader2, UserCheck, X, Pencil } from "lucide-react";
import { format } from "date-fns";
import DashboardHeader from "@/components/DashboardHeader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type EquipmentOption = { id: number; code: string; name: string };
type OicUser = { id: number; name: string; email: string };
type Delegation = {
  id: number;
  equipment_id: number;
  equipment_code: string;
  equipment_name: string;
  temporary_oic_id: number;
  temporary_oic_name: string;
  temporary_oic_email: string;
  resume_at: string;
  created_at: string;
};

export default function TemporaryOIC() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userType = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isManager = userType === "manager";

  const [equipments, setEquipments] = useState<EquipmentOption[]>([]);
  const [oicUsers, setOicUsers] = useState<OicUser[]>([]);
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [loadingEquipments, setLoadingEquipments] = useState(true);
  const [loadingOicUsers, setLoadingOicUsers] = useState(true);
  const [loadingDelegations, setLoadingDelegations] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [editingDelegationId, setEditingDelegationId] = useState<number | null>(null);
  const [editResumeAt, setEditResumeAt] = useState("");
  const [savingEditId, setSavingEditId] = useState<number | null>(null);

  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>("");
  const [selectedTemporaryOicId, setSelectedTemporaryOicId] = useState<string>("");
  const [oicComboboxOpen, setOicComboboxOpen] = useState(false);
  const [oicSearchQuery, setOicSearchQuery] = useState("");
  const [resumeAt, setResumeAt] = useState("");

  useEffect(() => {
    if (!isManager) {
      navigate("/dashboard");
      return;
    }
    apiClient.getTemporaryOicMyEquipments().then((res) => {
      setLoadingEquipments(false);
      if (res.error) {
        toast.error(res.error);
        setEquipments([]);
      } else {
        setEquipments(res.data?.equipments ?? []);
      }
    });
    apiClient.getTemporaryOicOicUsers().then((res) => {
      setLoadingOicUsers(false);
      if (res.error) {
        toast.error(res.error);
        setOicUsers([]);
      } else {
        setOicUsers(res.data?.oic_users ?? []);
      }
    });
    apiClient.getTemporaryOicMine().then((res) => {
      setLoadingDelegations(false);
      if (res.error) {
        toast.error(res.error);
        setDelegations([]);
      } else {
        setDelegations(res.data?.delegations ?? []);
      }
    });
  }, [isManager, navigate]);

  const refreshDelegations = () => {
    apiClient.getTemporaryOicMine().then((res) => {
      if (!res.error && res.data?.delegations) setDelegations(res.data.delegations);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const eqId = selectedEquipmentId ? parseInt(selectedEquipmentId, 10) : 0;
    const oicId = selectedTemporaryOicId ? parseInt(selectedTemporaryOicId, 10) : 0;
    if (!eqId || !oicId || !resumeAt.trim()) {
      toast.error("Please select equipment, temporary OIC, and resume date & time.");
      return;
    }
    const dt = new Date(resumeAt);
    if (isNaN(dt.getTime()) || dt <= new Date()) {
      toast.error("Resume date and time must be in the future.");
      return;
    }
    const resumeAtIso = dt.toISOString();
    setSubmitting(true);
    try {
      const res = await apiClient.createTemporaryOic(eqId, oicId, resumeAtIso);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.data?.message ?? "Temporary OIC assigned.");
        setSelectedEquipmentId("");
        setSelectedTemporaryOicId("");
        setResumeAt("");
        refreshDelegations();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (delegationId: number) => {
    setCancellingId(delegationId);
    try {
      const res = await apiClient.cancelTemporaryOic(delegationId);
      if (res.error) toast.error(res.error);
      else {
        toast.success(res.data?.message ?? "Delegation cancelled.");
        refreshDelegations();
      }
    } finally {
      setCancellingId(null);
    }
  };

  const openEditDialog = (d: Delegation) => {
    const dt = new Date(d.resume_at);
    setEditResumeAt(format(dt, "yyyy-MM-dd'T'HH:mm"));
    setEditingDelegationId(d.id);
  };

  const handleSaveEdit = async () => {
    if (editingDelegationId == null || !editResumeAt.trim()) return;
    const dt = new Date(editResumeAt);
    if (isNaN(dt.getTime()) || dt <= new Date()) {
      toast.error("Resume date and time must be in the future.");
      return;
    }
    setSavingEditId(editingDelegationId);
    try {
      const res = await apiClient.updateTemporaryOic(editingDelegationId, dt.toISOString());
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(res.data?.message ?? "Date and time updated.");
        setEditingDelegationId(null);
        setEditResumeAt("");
        refreshDelegations();
      }
    } finally {
      setSavingEditId(null);
    }
  };

  if (!isManager) return null;

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container max-w-4xl mx-auto p-4 pb-8 space-y-6">
        <div className="rounded-2xl bg-gradient-to-r from-teal-800 via-teal-700 to-cyan-700 p-6 text-white shadow-xl">
          <Button
            variant="ghost"
            size="sm"
            className="mb-3 -ml-2 gap-2 text-white/90 hover:text-white hover:bg-white/20"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Temporary OIC (Leave)</h1>
              <p className="mt-1 text-sm text-white/85 max-w-2xl">
                When you go on leave, assign another Officer in Charge to manage an equipment until you resume.
                After the resume date and time, they will no longer be able to manage that equipment.
              </p>
            </div>
          </div>
        </div>

        <Card className="mb-6 rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Assign temporary coverage
            </CardTitle>
            <CardDescription>
              Choose equipment, temporary OIC, and the leave window.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Equipment</Label>
                  <Select
                    value={selectedEquipmentId}
                    onValueChange={setSelectedEquipmentId}
                    disabled={loadingEquipments}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingEquipments ? "Loading..." : "Select equipment"} />
                    </SelectTrigger>
                    <SelectContent>
                      {equipments.map((e) => (
                        <SelectItem key={e.id} value={String(e.id)}>
                          {e.code} – {e.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Temporary OIC</Label>
                  <Popover open={oicComboboxOpen} onOpenChange={setOicComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={oicComboboxOpen}
                        disabled={loadingOicUsers}
                        className="w-full justify-between font-normal"
                      >
                        {loadingOicUsers
                          ? "Loading..."
                          : selectedTemporaryOicId
                            ? (() => {
                                const u = oicUsers.find((x) => String(x.id) === selectedTemporaryOicId);
                                return u ? `${u.name || u.email} (${u.email})` : "Select OIC";
                              })()
                            : "Select OIC (search by name)…"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Search by name or email…"
                          value={oicSearchQuery}
                          onValueChange={setOicSearchQuery}
                        />
                        <CommandList>
                          <CommandEmpty>
                            {oicUsers.length === 0
                              ? "No other OIC users found. Only users marked as Officer in Charge (OIC) at creation are listed."
                              : "No match."}
                          </CommandEmpty>
                          <CommandGroup>
                            {oicUsers
                              .filter((u) => {
                                const q = oicSearchQuery.trim().toLowerCase();
                                if (!q) return true;
                                return (
                                  (u.name || "").toLowerCase().includes(q) ||
                                  (u.email || "").toLowerCase().includes(q)
                                );
                              })
                              .map((u) => (
                                <CommandItem
                                  key={u.id}
                                  value={String(u.id)}
                                  onSelect={() => {
                                    setSelectedTemporaryOicId(String(u.id));
                                    setOicComboboxOpen(false);
                                    setOicSearchQuery("");
                                  }}
                                >
                                  {u.name || u.email} ({u.email})
                                </CommandItem>
                              ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {!loadingOicUsers && oicUsers.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No other OIC users in the system. Only users created as Officer in Charge (OIC) appear here.
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4" />
                  Resume date & time (when you will take over again)
                </Label>
                <Input
                  type="datetime-local"
                  value={resumeAt}
                  onChange={(e) => setResumeAt(e.target.value)}
                  min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                />
                <p className="text-xs text-muted-foreground">
                  After this date and time, the temporary OIC will no longer be able to manage this equipment.
                </p>
              </div>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  "Assign temporary OIC"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active delegations</CardTitle>
            <CardDescription>
              Delegations you have created. Edit to change the resume date and time, or Cancel to revoke the temporary OIC before the resume time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingDelegations ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : delegations.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No active temporary OIC delegations.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equipment</TableHead>
                    <TableHead>Temporary OIC</TableHead>
                    <TableHead>Resume at</TableHead>
                    <TableHead className="w-[120px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {delegations.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <span className="font-medium">{d.equipment_code}</span>
                        <span className="text-muted-foreground"> – {d.equipment_name}</span>
                      </TableCell>
                      <TableCell>
                        {d.temporary_oic_name}
                        <span className="text-muted-foreground text-xs block">{d.temporary_oic_email}</span>
                      </TableCell>
                      <TableCell>
                        {format(new Date(d.resume_at), "PPp")}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Edit date & time"
                            onClick={() => openEditDialog(d)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleCancel(d.id)}
                            disabled={cancellingId === d.id}
                          >
                            {cancellingId === d.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={editingDelegationId != null} onOpenChange={(open) => !open && setEditingDelegationId(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit resume date & time</DialogTitle>
              <DialogDescription>
                Change when you will take over again. After this date and time, the temporary OIC will no longer be able to manage the equipment.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                Resume date & time
              </Label>
              <Input
                type="datetime-local"
                value={editResumeAt}
                onChange={(e) => setEditResumeAt(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                className="w-full"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingDelegationId(null)} disabled={savingEditId != null}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit} disabled={savingEditId != null || !editResumeAt.trim()}>
                {savingEditId != null ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
