import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, Edit, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type UserRole = 'admin' | 'iitr_student' | 'iitr_faculty' | 'officer_in_charge' | 'operator' | 'accounts' | 'external_academic' | 'external_rnd' | 'industrial_user';

interface UserData {
  id: string;
  email: string;
  name?: string;
  full_name?: string;
  role: UserRole;
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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'iitr_student' as UserRole
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

      const adminCheck = await apiClient.checkAdminRole(userResponse.data.id);
      if (adminCheck.error || !adminCheck.data) {
        toast({
          title: "Access Denied",
          description: "You don't have permission to access this page.",
          variant: "destructive"
        });
        navigate('/');
        return;
      }

      loadUsers();
    } catch (error) {
      console.error('Error checking admin access:', error);
      navigate('/auth');
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const usersResponse = await apiClient.getUsers();
      if (usersResponse.data) {
        const usersWithRoles = await Promise.all(
          usersResponse.data.map(async (user: any) => {
            const rolesResponse = await apiClient.getUserRoles(user.id);
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              full_name: user.full_name || user.name || '',
              role: rolesResponse.data?.[0]?.role || 'iitr_student'
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
        role: formData.role
      });

      if (response.error) {
        throw new Error(response.error);
      }

      toast({
        title: "Success",
        description: "User created successfully"
      });

      setIsDialogOpen(false);
      setFormData({ email: '', password: '', full_name: '', role: 'iitr_student' });
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
        role: formData.role
      });

      toast({
        title: "Success",
        description: "User updated successfully"
      });

      setIsDialogOpen(false);
      setEditingUser(null);
      setFormData({ email: '', password: '', full_name: '', role: 'iitr_student' });
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
      role: user.role
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingUser(null);
    setFormData({ email: '', password: '', full_name: '', role: 'iitr_student' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold">User Management</h1>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingUser(null)}>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Full Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.full_name || user.name || 'N/A'}</TableCell>
                    <TableCell>{roleLabels[user.role]}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(user)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
