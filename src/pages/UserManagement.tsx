import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import DashboardHeader from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, Edit, CheckCircle, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

type UserRole = 'admin' | 'iitr_student' | 'iitr_faculty' | 'officer_in_charge' | 'operator' | 'accounts' | 'external_academic' | 'external_rnd' | 'industrial_user';

interface UserData {
  id: string;
  email: string;
  name?: string;
  full_name?: string;
  role: UserRole;
  department?: number | null;
  department_code?: string | null;
  department_name?: string | null;
  email_verified?: boolean;
  admin_approved?: boolean;
  is_active?: boolean;
}

const roleLabels: Record<UserRole, string> = {
  admin: 'Admin',
  iitr_student: 'IITR Student',
  iitr_faculty: 'IITR Faculty',
  officer_in_charge: 'Officer in Charge',
  operator: 'Operator',
  accounts: 'Accounts',
  external_academic: 'External Academic',
  external_rnd: 'External R&D',
  industrial_user: 'Industrial User'
};

export default function UserManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserData[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: number; name: string; code: string }>>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'iitr_student' as UserRole,
    department: '' as string | number | null,
  });

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const token = apiClient.getToken();
      if (!token) {
        navigate('/auth');
        return;
      }

      const userResponse = await apiClient.getCurrentUser();
      if (userResponse.error || !userResponse.data) {
        navigate('/auth');
        return;
      }

      const isAdminByType = apiClient.isAdminPanelUser(userResponse.data.user_type);
      const adminCheck = await apiClient.checkAdminRole(String(userResponse.data.id));
      if (!isAdminByType && adminCheck.data?.is_admin !== true) {
        toast({
          title: "Access Denied",
          description: "You don't have permission to access this page.",
          variant: "destructive"
        });
        navigate('/');
        return;
      }

      loadUsers();
      loadDepartments();
    } catch (error) {
      console.error('Error checking admin access:', error);
      navigate('/auth');
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
      // non-blocking
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const usersResponse = await apiClient.getUsers();
      if (usersResponse.data && Array.isArray(usersResponse.data)) {
        const usersWithRoles = await Promise.all(
          usersResponse.data.map(async (user: any) => {
            const rolesResponse = await apiClient.getUserRoles(String(user.id));
            return {
              id: String(user.id),
              email: user.email,
              name: user.name,
              full_name: user.name || user.full_name || '',
              role: (rolesResponse.data?.[0]?.role as UserRole) || 'iitr_student',
              department: user.department ?? null,
              department_code: user.department_code ?? null,
              department_name: user.department_name ?? null,
              email_verified: !!user.email_verified,
              admin_approved: !!user.admin_approved,
              is_active: user.is_active !== false,
            } as UserData;
          })
        );
        setUsers(usersWithRoles);
      }
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!formData.email || !formData.password || !formData.full_name) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    try {
      const response = await apiClient.createUser({
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
        role: formData.role,
        department: formData.department === '' || formData.department == null ? undefined : Number(formData.department),
      });

      if (response.error) {
        throw new Error(response.error);
      }

      toast({
        title: "Success",
        description: "User created successfully"
      });

      setIsDialogOpen(false);
      setFormData({ email: '', password: '', full_name: '', role: 'iitr_student', department: '' });
      loadUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleEditUser = async () => {
    if (!editingUser) return;

    try {
      await apiClient.updateUser(editingUser.id, {
        full_name: formData.full_name,
        role: formData.role,
        department: formData.department === '' || formData.department == null ? null : Number(formData.department),
      });

      toast({
        title: "Success",
        description: "User updated successfully"
      });

      setIsDialogOpen(false);
      setEditingUser(null);
      setFormData({ email: '', password: '', full_name: '', role: 'iitr_student', department: '' });
      loadUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const openEditDialog = (user: UserData) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: '',
      full_name: user.full_name || user.name || '',
      role: user.role,
      department: user.department ?? '',
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingUser(null);
    setFormData({ email: '', password: '', full_name: '', role: 'iitr_student', department: '' });
  };

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const handleApprove = async (user: UserData) => {
    if (!user.email_verified) {
      toast({
        title: "Cannot approve",
        description: "User must verify email before approval.",
        variant: "destructive",
      });
      return;
    }
    setActionLoadingId(user.id);
    try {
      const response = await apiClient.approveUser(user.id);
      if (response.error) throw new Error(response.error);
      toast({ title: "Success", description: response.data?.message || "User approved successfully." });
      loadUsers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to approve user", variant: "destructive" });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (user: UserData) => {
    setActionLoadingId(user.id);
    try {
      const response = await apiClient.rejectUser(user.id);
      if (response.error) throw new Error(response.error);
      toast({ title: "Success", description: response.data?.message || "User rejected successfully." });
      loadUsers();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to reject user", variant: "destructive" });
    } finally {
      setActionLoadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-accent/20">
      <DashboardHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold">User Management</h1>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setEditingUser(null);
                  setFormData({ email: '', password: '', full_name: '', role: 'iitr_student', department: '' });
                }}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingUser ? 'Edit User' : 'Create New User'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    disabled={!!editingUser}
                  />
                </div>
                {!editingUser && (
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>
                )}
                <div>
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value as UserRole })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(roleLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="department">Department</Label>
                  <Select
                    value={formData.department === '' || formData.department == null ? 'none' : String(formData.department)}
                    onValueChange={(value) => setFormData({ ...formData, department: value === 'none' ? null : Number(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No department</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>
                          {d.name} ({d.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={editingUser ? handleEditUser : handleCreateUser} className="w-full">
                  {editingUser ? 'Update User' : 'Create User'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Dept</TableHead>
                  <TableHead>Email Verified</TableHead>
                  <TableHead>Admin Approved</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>{user.full_name || user.name || "—"}</TableCell>
                    <TableCell>{roleLabels[user.role] ?? user.role}</TableCell>
                    <TableCell>{user.department_code || user.department_name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={user.email_verified ? "default" : "secondary"}>
                        {user.email_verified ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.admin_approved ? "default" : "secondary"}>
                        {user.admin_approved ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? "default" : "destructive"}>
                        {user.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {user.email_verified && !user.admin_approved && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-green-600 border-green-600 hover:bg-green-50"
                            onClick={() => handleApprove(user)}
                            disabled={actionLoadingId === user.id}
                          >
                            {actionLoadingId === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                            <span className="ml-1">Approve</span>
                          </Button>
                        )}
                        {user.admin_approved && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-600 hover:bg-red-50"
                            onClick={() => handleReject(user)}
                            disabled={actionLoadingId === user.id}
                          >
                            {actionLoadingId === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                            <span className="ml-1">Reject</span>
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => openEditDialog(user)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
