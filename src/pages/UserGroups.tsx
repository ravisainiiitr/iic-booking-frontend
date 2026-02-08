import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient, type UserGroupSummary, type UserGroupDetail, type UserGroupMember } from "@/lib/api";
import DashboardHeader from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, Plus, Edit, Trash2, UserPlus, Wrench, Unlink, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

const USER_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Officer In Charge" },
  { value: "operator", label: "Lab Incharge" },
  { value: "finance", label: "Accounts" },
  { value: "student", label: "Student" },
  { value: "individual_student", label: "Individual Student" },
  { value: "faculty", label: "Faculty" },
  { value: "external", label: "External" },
  { value: "RND", label: "R&D" },
  { value: "Industry", label: "Industry" },
  { value: "other", label: "Other" },
];

const BOOKING_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "ABSENT", label: "Absent" },
  { value: "REFUNDED", label: "Refunded" },
];

/** Non-empty value for "Any" in Select; Radix Select.Item cannot use value="". */
const CRITERIA_ANY = "__any__";

interface UserOption {
  id: number;
  email: string;
  name?: string;
  user_type?: string | null;
  department?: number | null;
  department_code?: string | null;
  department_name?: string | null;
}

export default function UserGroups() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<UserGroupSummary[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: number; name: string; code: string }>>([]);
  const [equipmentList, setEquipmentList] = useState<Array<{ equipment_id: number; code: string; name: string }>>([]);
  const [selectedGroup, setSelectedGroup] = useState<UserGroupDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addByCriteriaOpen, setAddByCriteriaOpen] = useState(false);
  const [assignEquipmentOpen, setAssignEquipmentOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", code: "", description: "" });
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [criteriaFilters, setCriteriaFilters] = useState({
    role: CRITERIA_ANY,
    department: CRITERIA_ANY,
    bookingStatus: CRITERIA_ANY,
    equipmentId: CRITERIA_ANY,
  });
  const [criteriaFilteredUsers, setCriteriaFilteredUsers] = useState<UserOption[]>([]);
  const [criteriaSearching, setCriteriaSearching] = useState(false);
  const [selectedIdsToAdd, setSelectedIdsToAdd] = useState<Set<number>>(new Set());
  const [addingBulk, setAddingBulk] = useState(false);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const token = apiClient.getToken();
      if (!token) {
        navigate("/auth");
        return;
      }
      const userResponse = await apiClient.getCurrentUser();
      if (userResponse.error || !userResponse.data) {
        navigate("/auth");
        return;
      }
      const isAdminByType = apiClient.isAdminPanelUser(userResponse.data.user_type);
      const adminCheck = await apiClient.checkAdminRole(userResponse.data.id.toString());
      if (!isAdminByType && adminCheck.data?.is_admin !== true) {
        toast({
          title: "Access Denied",
          description: "Only admins, managers, and operators can manage user groups.",
          variant: "destructive",
        });
        navigate("/");
        return;
      }
      loadGroups();
      loadUsers();
      loadDepartments();
    } catch (error) {
      console.error("Error checking access:", error);
      navigate("/");
    }
  };

  const loadDepartments = async () => {
    try {
      const res = await apiClient.getDepartments();
      if (res.data?.departments) {
        setDepartments(
          res.data.departments.map((d: { id: number; name: string; code: string }) => ({
            id: d.id,
            name: d.name,
            code: d.code,
          }))
        );
      }
    } catch {
      // ignore
    }
  };

  const loadGroups = async () => {
    setLoading(true);
    try {
      const res = await apiClient.getUserGroups();
      if (res.error) throw new Error(res.error);
      setGroups(res.data?.user_groups || []);
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message || "Failed to load user groups",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await apiClient.getUsers();
      if (res.data && Array.isArray(res.data)) {
        setUsers(
          res.data.map((u: any) => ({
            id: u.id,
            email: u.email,
            name: u.name || u.full_name || "",
            user_type: u.user_type ?? null,
            department: u.department ?? null,
            department_code: u.department_code ?? null,
            department_name: u.department_name ?? null,
          }))
        );
      }
    } catch {
      // ignore
    }
  };

  const loadGroupDetail = async (id: number) => {
    setDetailLoading(true);
    try {
      const res = await apiClient.getUserGroup(id);
      if (res.error) throw new Error(res.error);
      setSelectedGroup(res.data || null);
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message || "Failed to load group details",
        variant: "destructive",
      });
      setSelectedGroup(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const loadEquipmentForAssign = async (groupId: number) => {
    try {
      const res = await apiClient.getEquipments(undefined, "ACTIVE");
      if (res.data?.equipments) {
        setEquipmentList(
          res.data.equipments.map((e: any) => ({
            equipment_id: e.equipment_id,
            code: e.code,
            name: e.name,
          }))
        );
      }
      const groupRes = await apiClient.getUserGroupEquipment(groupId);
      if (groupRes.data?.equipment) {
        setSelectedEquipmentIds(groupRes.data.equipment.map((eq) => eq.equipment_id));
      } else {
        setSelectedEquipmentIds([]);
      }
    } catch {
      setEquipmentList([]);
    }
  };

  const handleCreateGroup = async () => {
    if (!formData.name.trim() || !formData.code.trim()) {
      toast({
        title: "Validation",
        description: "Name and code are required.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiClient.createUserGroup({
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        description: formData.description.trim() || undefined,
      });
      if (res.error) throw new Error(res.error);
      toast({ title: "Success", description: "User group created." });
      setCreateOpen(false);
      setFormData({ name: "", code: "", description: "" });
      loadGroups();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message || "Failed to create group",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateGroup = async () => {
    const id = editingGroupId ?? selectedGroup?.id;
    if (id == null) return;
    setSubmitting(true);
    try {
      const res = await apiClient.updateUserGroup(id, {
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        description: formData.description.trim() || undefined,
      });
      if (res.error) throw new Error(res.error);
      toast({ title: "Success", description: "Group updated." });
      setEditOpen(false);
      setEditingGroupId(null);
      loadGroups();
      if (selectedGroup?.id === id) loadGroupDetail(id);
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message || "Failed to update group",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteGroup = async (group: UserGroupSummary) => {
    if (!confirm(`Delete group "${group.name}"? This will make its equipment visible to everyone.`)) return;
    try {
      const res = await apiClient.deleteUserGroup(group.id);
      if (res.error) throw new Error(res.error);
      toast({ title: "Success", description: "Group deleted." });
      if (selectedGroup?.id === group.id) setSelectedGroup(null);
      loadGroups();
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message || "Failed to delete group",
        variant: "destructive",
      });
    }
  };

  const handleAddMember = async () => {
    if (!selectedGroup || !selectedUserId) return;
    setSubmitting(true);
    try {
      const res = await apiClient.addUserGroupMember(selectedGroup.id, parseInt(selectedUserId, 10));
      if (res.error) throw new Error(res.error);
      toast({ title: "Success", description: "Member added." });
      setAddMemberOpen(false);
      setSelectedUserId("");
      loadGroupDetail(selectedGroup.id);
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message || "Failed to add member",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!selectedGroup) return;
    try {
      const res = await apiClient.removeUserGroupMember(selectedGroup.id, userId);
      if (res.error) throw new Error(res.error);
      toast({ title: "Success", description: "Member removed." });
      loadGroupDetail(selectedGroup.id);
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message || "Failed to remove member",
        variant: "destructive",
      });
    }
  };

  const handleAssignEquipment = async () => {
    if (!selectedGroup) return;
    setSubmitting(true);
    try {
      const currentRes = await apiClient.getUserGroupEquipment(selectedGroup.id);
      const currentIds = (currentRes.data?.equipment || []).map((e) => e.equipment_id);
      const toAdd = selectedEquipmentIds.filter((id) => !currentIds.includes(id));
      const toRemove = currentIds.filter((id) => !selectedEquipmentIds.includes(id));
      if (toRemove.length > 0) {
        await apiClient.unassignEquipmentFromUserGroup(selectedGroup.id, toRemove);
      }
      if (toAdd.length > 0) {
        await apiClient.assignEquipmentToUserGroup(selectedGroup.id, toAdd);
      }
      toast({ title: "Success", description: "Equipment assignment updated." });
      setAssignEquipmentOpen(false);
      loadGroups();
      loadGroupDetail(selectedGroup.id);
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message || "Failed to update equipment",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (group: UserGroupSummary | UserGroupDetail) => {
    setEditingGroupId(group.id);
    setFormData({
      name: group.name,
      code: group.code,
      description: group.description || "",
    });
    setEditOpen(true);
  };

  const findUsersByCriteria = async () => {
    if (!selectedGroup) return;
    setCriteriaSearching(true);
    setCriteriaFilteredUsers([]);
    setSelectedIdsToAdd(new Set());
    try {
      const memberIds = new Set((selectedGroup.members || []).map((m) => m.user_id));
      let filtered: UserOption[] = users.filter((u) => !memberIds.has(u.id));

      if (criteriaFilters.role && criteriaFilters.role !== CRITERIA_ANY) {
        filtered = filtered.filter((u) => String(u.user_type ?? "") === criteriaFilters.role);
      }
      if (criteriaFilters.department && criteriaFilters.department !== CRITERIA_ANY) {
        const deptId = parseInt(criteriaFilters.department, 10);
        filtered = filtered.filter((u) => u.department != null && u.department === deptId);
      }

      const hasBookingFilter =
        (criteriaFilters.bookingStatus && criteriaFilters.bookingStatus !== CRITERIA_ANY) ||
        (criteriaFilters.equipmentId && criteriaFilters.equipmentId !== CRITERIA_ANY);
      if (hasBookingFilter) {
        const res = await apiClient.getBookings({
          status:
            criteriaFilters.bookingStatus && criteriaFilters.bookingStatus !== CRITERIA_ANY
              ? criteriaFilters.bookingStatus
              : undefined,
          equipment_id:
            criteriaFilters.equipmentId && criteriaFilters.equipmentId !== CRITERIA_ANY
              ? criteriaFilters.equipmentId
              : undefined,
        });
        const bookingUserIds = new Set(
          (res.data?.bookings ?? []).map((b: { user: number }) => b.user)
        );
        filtered = filtered.filter((u) => bookingUserIds.has(u.id));
      }

      setCriteriaFilteredUsers(filtered);
    } catch {
      setCriteriaFilteredUsers([]);
      toast({
        title: "Error",
        description: "Failed to find users by criteria.",
        variant: "destructive",
      });
    } finally {
      setCriteriaSearching(false);
    }
  };

  const handleAddSelectedByCriteria = async () => {
    if (!selectedGroup || selectedIdsToAdd.size === 0) return;
    setAddingBulk(true);
    try {
      let added = 0;
      let failed = 0;
      for (const userId of selectedIdsToAdd) {
        const res = await apiClient.addUserGroupMember(selectedGroup.id, userId);
        if (res.error) failed += 1;
        else added += 1;
      }
      toast({
        title: "Done",
        description: `Added ${added} member(s)${failed ? `; ${failed} failed.` : "."}`,
      });
      setAddByCriteriaOpen(false);
      setSelectedIdsToAdd(new Set());
      setCriteriaFilteredUsers([]);
      setCriteriaFilters({
        role: CRITERIA_ANY,
        department: CRITERIA_ANY,
        bookingStatus: CRITERIA_ANY,
        equipmentId: CRITERIA_ANY,
      });
      loadGroupDetail(selectedGroup.id);
    } catch (e: any) {
      toast({
        title: "Error",
        description: e.message || "Failed to add some members",
        variant: "destructive",
      });
    } finally {
      setAddingBulk(false);
    }
  };

  const toggleCriteriaUser = (id: number) => {
    setSelectedIdsToAdd((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const memberIds = (selectedGroup?.members || []).map((m) => m.user_id);
  const availableUsers = users.filter((u) => !memberIds.includes(u.id));

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-accent/20">
      <DashboardHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            User Groups
          </h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/admin")}>
              Equipment Management
            </Button>
            <Button variant="outline" onClick={() => navigate("/user-management")}>
              User Management
            </Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Group
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create User Group</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g. Lab A Team"
                    />
                  </div>
                  <div>
                    <Label>Code (unique)</Label>
                    <Input
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder="e.g. LAB-A"
                    />
                  </div>
                  <div>
                    <Label>Description (optional)</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Optional description"
                      rows={2}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateGroup} disabled={submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <p className="text-muted-foreground mb-6">
          User groups control equipment visibility. Equipment assigned to a group is only visible to its members.
          Equipment not assigned to any group is visible to everyone.
        </p>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>All Groups</CardTitle>
              </CardHeader>
              <CardContent>
                {groups.length === 0 ? (
                  <p className="text-muted-foreground">No user groups yet. Create one to restrict equipment visibility.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Members</TableHead>
                        <TableHead>Equipment</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groups.map((g) => (
                        <TableRow
                          key={g.id}
                          className={selectedGroup?.id === g.id ? "bg-muted/50" : ""}
                        >
                          <TableCell className="font-mono">{g.code}</TableCell>
                          <TableCell>{g.name}</TableCell>
                          <TableCell>{g.member_count}</TableCell>
                          <TableCell>{g.equipment_count}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => loadGroupDetail(g.id)}
                            >
                              View
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(g)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteGroup(g)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {selectedGroup ? selectedGroup.name : "Select a group"}
                  {selectedGroup && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedGroup.code}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedGroup ? (
                  <p className="text-muted-foreground">Click &quot;View&quot; on a group to see members and equipment.</p>
                ) : detailLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(selectedGroup)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <UserPlus className="h-4 w-4 mr-1" />
                            Add Member
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add member to {selectedGroup.name}</DialogTitle>
                          </DialogHeader>
                          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select user" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableUsers.map((u) => (
                                <SelectItem key={u.id} value={String(u.id)}>
                                  {u.email} {u.name ? `(${u.name})` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setAddMemberOpen(false)}>
                              Cancel
                            </Button>
                            <Button onClick={handleAddMember} disabled={!selectedUserId || submitting}>
                              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      <Dialog
                        open={addByCriteriaOpen}
                        onOpenChange={(open) => {
                          setAddByCriteriaOpen(open);
                          if (open) {
                            setCriteriaFilteredUsers([]);
                            setSelectedIdsToAdd(new Set());
                            apiClient.getEquipments(undefined, "ACTIVE").then((res) => {
                              if (res.data?.equipments) {
                                setEquipmentList(
                                  res.data.equipments.map((e: any) => ({
                                    equipment_id: e.equipment_id,
                                    code: e.code,
                                    name: e.name,
                                  }))
                                );
                              }
                            });
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <Filter className="h-4 w-4 mr-1" />
                            Add by criteria
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[85vh] overflow-hidden flex flex-col">
                          <DialogHeader>
                            <DialogTitle>Add users by criteria to {selectedGroup.name}</DialogTitle>
                          </DialogHeader>
                          <p className="text-sm text-muted-foreground">
                            Filter by role, department, booking status, or equipment booked. Then select users to add.
                          </p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <Label>Role (user type)</Label>
                              <Select
                                value={criteriaFilters.role}
                                onValueChange={(v) => setCriteriaFilters((f) => ({ ...f, role: v }))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Any" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={CRITERIA_ANY}>Any</SelectItem>
                                  {USER_TYPE_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                      {o.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Department</Label>
                              <Select
                                value={criteriaFilters.department}
                                onValueChange={(v) => setCriteriaFilters((f) => ({ ...f, department: v }))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Any" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={CRITERIA_ANY}>Any</SelectItem>
                                  {departments.map((d) => (
                                    <SelectItem key={d.id} value={String(d.id)}>
                                      {d.code} – {d.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Booking status</Label>
                              <Select
                                value={criteriaFilters.bookingStatus}
                                onValueChange={(v) => setCriteriaFilters((f) => ({ ...f, bookingStatus: v }))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Any" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={CRITERIA_ANY}>Any</SelectItem>
                                  {BOOKING_STATUS_OPTIONS.map((o) => (
                                    <SelectItem key={o.value} value={o.value}>
                                      {o.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label>Equipment booked</Label>
                              <Select
                                value={criteriaFilters.equipmentId}
                                onValueChange={(v) => setCriteriaFilters((f) => ({ ...f, equipmentId: v }))}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Any" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value={CRITERIA_ANY}>Any</SelectItem>
                                  {equipmentList.map((eq) => (
                                    <SelectItem key={eq.equipment_id} value={String(eq.equipment_id)}>
                                      {eq.code} – {eq.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={findUsersByCriteria}
                            disabled={criteriaSearching}
                          >
                            {criteriaSearching ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <Filter className="h-4 w-4 mr-2" />
                            )}
                            Find users
                          </Button>
                          <div className="flex-1 min-h-0 overflow-auto rounded border">
                            {criteriaFilteredUsers.length === 0 && !criteriaSearching && (
                              <p className="p-4 text-sm text-muted-foreground">
                                Set filters and click &quot;Find users&quot; to see results. Only users not already in this group are shown.
                              </p>
                            )}
                            {criteriaFilteredUsers.length > 0 && (
                              <>
                                <div className="flex items-center gap-2 p-2 border-b bg-muted/30">
                                  <Checkbox
                                    checked={
                                      criteriaFilteredUsers.length > 0 &&
                                      criteriaFilteredUsers.every((u) => selectedIdsToAdd.has(u.id))
                                    }
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedIdsToAdd(new Set(criteriaFilteredUsers.map((u) => u.id)));
                                      } else {
                                        setSelectedIdsToAdd(new Set());
                                      }
                                    }}
                                  />
                                  <span className="text-xs text-muted-foreground">
                                    Select all ({criteriaFilteredUsers.length})
                                  </span>
                                </div>
                                <ul className="divide-y max-h-48 overflow-y-auto">
                                  {criteriaFilteredUsers.map((u) => (
                                    <li key={u.id}>
                                      <label className="flex items-center gap-2 p-2 cursor-pointer hover:bg-muted/50">
                                        <Checkbox
                                          checked={selectedIdsToAdd.has(u.id)}
                                          onCheckedChange={() => toggleCriteriaUser(u.id)}
                                        />
                                        <span className="text-sm">
                                          {u.email}
                                          {u.name && ` (${u.name})`}
                                          {u.user_type && (
                                            <Badge variant="outline" className="ml-1 text-xs">
                                              {USER_TYPE_OPTIONS.find((o) => o.value === u.user_type)?.label ?? u.user_type}
                                            </Badge>
                                          )}
                                        </span>
                                      </label>
                                    </li>
                                  ))}
                                </ul>
                              </>
                            )}
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setAddByCriteriaOpen(false)}>
                              Cancel
                            </Button>
                            <Button
                              onClick={handleAddSelectedByCriteria}
                              disabled={selectedIdsToAdd.size === 0 || addingBulk}
                            >
                              {addingBulk ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : null}
                              Add selected ({selectedIdsToAdd.size}) to group
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      <Dialog
                        open={assignEquipmentOpen}
                        onOpenChange={(open) => {
                          setAssignEquipmentOpen(open);
                          if (open) loadEquipmentForAssign(selectedGroup.id);
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <Wrench className="h-4 w-4 mr-1" />
                            Assign Equipment
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Assign equipment to {selectedGroup.name}</DialogTitle>
                          </DialogHeader>
                          <p className="text-sm text-muted-foreground">
                            Select equipment that should be visible only to this group. Unselected equipment will be visible to everyone.
                          </p>
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {equipmentList.map((eq) => (
                              <label
                                key={eq.equipment_id}
                                className="flex items-center gap-2 cursor-pointer rounded border p-2 hover:bg-muted/50"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedEquipmentIds.includes(eq.equipment_id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedEquipmentIds((prev) => [...prev, eq.equipment_id]);
                                    } else {
                                      setSelectedEquipmentIds((prev) => prev.filter((id) => id !== eq.equipment_id));
                                    }
                                  }}
                                />
                                <span className="font-mono text-sm">{eq.code}</span>
                                <span>{eq.name}</span>
                              </label>
                            ))}
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setAssignEquipmentOpen(false)}>
                              Cancel
                            </Button>
                            <Button onClick={handleAssignEquipment} disabled={submitting}>
                              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Members ({selectedGroup.members?.length ?? 0})</h4>
                      {selectedGroup.members?.length ? (
                        <ul className="space-y-1">
                          {selectedGroup.members.map((m) => (
                            <li key={m.id} className="flex items-center justify-between rounded border px-3 py-2">
                              <span>
                                {m.email} {m.name && `(${m.name})`}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() => handleRemoveMember(m.user_id)}
                              >
                                <Unlink className="h-4 w-4" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-muted-foreground text-sm">No members. Add members to restrict equipment to this group.</p>
                      )}
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Assigned equipment ({selectedGroup.equipment_ids?.length ?? 0})</h4>
                      {selectedGroup.equipment_ids?.length ? (
                        <p className="text-sm text-muted-foreground">
                          Equipment IDs: {selectedGroup.equipment_ids.join(", ")}. Use &quot;Assign Equipment&quot; to change.
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">No equipment assigned. Equipment in this group is visible to everyone until assigned here.</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Edit dialog */}
        <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) setEditingGroupId(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Group</DialogTitle>
            </DialogHeader>
            {(editingGroupId || selectedGroup) && (
              <>
                <div className="space-y-4">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Code</Label>
                    <Input
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={2}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleUpdateGroup} disabled={submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
