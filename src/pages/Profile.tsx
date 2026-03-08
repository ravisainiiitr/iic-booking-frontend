import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Upload, Moon, Sun, Monitor, Plus, Trash2, Edit, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import DashboardHeader from "@/components/DashboardHeader";

const Profile = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { user, loading: authLoading, isAuthenticated, refreshUser, updateUser } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [projects, setProjects] = useState<Array<{
    id: number;
    name: string;
    project_code: string;
    agency: string;
    start_date: string | null;
    end_date: string | null;
    is_active: boolean;
    is_expired: boolean;
    created_at: string;
    updated_at: string;
  }>>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [projectForm, setProjectForm] = useState({
    name: "",
    project_code: "",
    agency: "",
    start_date: "",
    end_date: "",
    is_active: true,
  });
  const [addingProject, setAddingProject] = useState(false);
  const [updatingProject, setUpdatingProject] = useState(false);
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    gender: "" as string | null,
    user_type: 0,
    emp_id: "",
    phone_number: "",
    secondary_phone_number: "",
    profile_picture: "",
    department: null as any,
    department_name: "",
    department_code: "",
    supervisor: null as any,
    date_of_birth: "",
    branch_name: "",
    degree_name: "",
    designation: "",
    email_verified: false,
    admin_approved: false,
    is_active: false,
    date_joined: "",
    last_login: "",
    can_have_wallet: false,
    auto_slot_selection: false,
    wallet_low_balance_alert_enabled: false,
    wallet_low_balance_alert_threshold: null as number | string | null,
  });

  useEffect(() => {
    checkAuthAndLoadProfile();
  }, [navigate]);

  useEffect(() => {
    if (isFacultyUser()) {
      fetchProjects();
    }
  }, [user, profileData.user_type]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const checkAuthAndLoadProfile = async () => {
    // Check authentication using AuthContext
    if (!isAuthenticated) {
      navigate("/auth");
      return;
    }

    // If user is authenticated but user data is not loaded yet, wait for it
    if (authLoading) {
      return;
    }

    if (!user) {
      // Try to refresh user data
      await refreshUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      }

    try {
      await fetchProfile();
    } catch (error) {
      console.error("Error loading profile:", error);
      navigate("/auth");
    }
  };

  const fetchProfile = async () => {
    // Use /api/profiles/me/ endpoint to get complete user profile details
    const response = await apiClient.getProfileMe();
    
    if (response.error) {
      console.error("Error fetching profile:", response.error);
      setLoading(false);
      return;
    }
    
    if (response.data) {
      let departmentName = response.data.department_name || "";
      let departmentCode = response.data.department_code || "";
      const departmentId = response.data.department || null;

      // If department name is not available but department ID exists, fetch it
      if (!departmentName && departmentId) {
        try {
          const departmentsResponse = await apiClient.getDepartments();
          if (departmentsResponse.data?.departments) {
            const department = departmentsResponse.data.departments.find(
              (dept: { id: number; name: string; code: string }) => dept.id === departmentId
            );
            if (department) {
              departmentName = department.name;
              departmentCode = department.code;
            }
          }
        } catch (error) {
          console.error("Error fetching department details:", error);
        }
      }

      setProfileData({
        name: response.data.name || "",
        email: response.data.email || "",
        gender: response.data.gender ?? "",
        user_type: response.data.user_type || 0,
        emp_id: response.data.emp_id || "",
        phone_number: response.data.phone_number || "",
        secondary_phone_number: response.data.secondary_phone_number || "",
        profile_picture: response.data.profile_picture || "",
        department: departmentId,
        department_name: departmentName || response.data.department_name || "",
        department_code: departmentCode || response.data.department_code || "",
        supervisor: response.data.supervisor || null,
        date_of_birth: response.data.date_of_birth || "",
        branch_name: response.data.branch_name || "",
        degree_name: response.data.degree_name || "",
        designation: response.data.designation || "",
        email_verified: response.data.email_verified || false,
        admin_approved: response.data.admin_approved || false,
        is_active: response.data.is_active || false,
        date_joined: response.data.date_joined || "",
        last_login: response.data.last_login || "",
        can_have_wallet: response.data.can_have_wallet || false,
        auto_slot_selection: response.data.auto_slot_selection || false,
        wallet_low_balance_alert_enabled: response.data.wallet_low_balance_alert_enabled || false,
        wallet_low_balance_alert_threshold:
          response.data.wallet_low_balance_alert_threshold != null
            ? Number(response.data.wallet_low_balance_alert_threshold)
            : null,
      });
    }
    setLoading(false);
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow upload if no profile picture exists
    if (profileData.profile_picture || user?.profile_picture) {
      toast.error("Profile picture already exists. Cannot update.");
      return;
    }

    if (!event.target.files || !event.target.files[0] || !user) return;

    const file = event.target.files[0];
    setUploading(true);

    try {
      const response = await apiClient.uploadProfileAvatar(file);
      if (response.error) {
        throw new Error(response.error);
      }
      const data = response.data;
      setProfileData(prev => ({ ...prev, profile_picture: data?.profile_picture ?? data?.avatar_url ?? null }));
      await refreshUser();
      toast.success("Avatar uploaded successfully");
    } catch (error: any) {
      toast.error("Error uploading avatar: " + (error?.message ?? String(error)));
    } finally {
      setUploading(false);
    }
  };

  const isFacultyUser = (): boolean => {
    const userType = profileData.user_type || user?.user_type;
    if (userType === undefined || userType === null) return false;
    
    if (typeof userType === "string") {
      return userType.toLowerCase() === "faculty";
    } else if (typeof userType === "number") {
      // Assuming 2 = faculty (adjust based on your mapping)
      return userType === 2;
    }
    return false;
  };

  const fetchProjects = async () => {
    if (!isFacultyUser()) return;
    
    setLoadingProjects(true);
    try {
      const response = await apiClient.getProjects();
      if (response.error) {
        console.error("Error fetching projects:", response.error);
        // Don't show error toast if endpoint doesn't exist yet
        if (!response.error.includes("404")) {
          toast.error("Error loading projects");
        }
      } else if (response.data) {
        // Map projects to ensure they have all required fields
        const mappedProjects = (response.data.projects || []).map((project: any) => ({
          ...project,
          start_date: project.start_date || null,
          end_date: project.end_date || null,
          is_active: project.is_active !== undefined ? project.is_active : true,
          is_expired: project.is_expired !== undefined ? project.is_expired : false,
        }));
        setProjects(mappedProjects);
      }
    } catch (error: any) {
      console.error("Error fetching projects:", error);
      // Silently fail if endpoint doesn't exist
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleAddProject = async () => {
    if (!projectForm.name.trim() || !projectForm.project_code.trim() || !projectForm.agency.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate dates if provided
    if (projectForm.start_date && projectForm.end_date) {
      const startDate = new Date(projectForm.start_date);
      const endDate = new Date(projectForm.end_date);
      if (endDate < startDate) {
        toast.error("End date must be after start date");
        return;
      }
    }

    setAddingProject(true);
    try {
      const response = await apiClient.createProject({
        name: projectForm.name.trim(),
        project_code: projectForm.project_code.trim(),
        agency: projectForm.agency.trim(),
        start_date: projectForm.start_date || null,
        end_date: projectForm.end_date || null,
      });

      if (response.error) {
        throw new Error(response.error);
      }

      toast.success("Project added successfully");
      setProjectForm({ name: "", project_code: "", agency: "", start_date: "", end_date: "", is_active: true });
      setShowProjectForm(false);
      await fetchProjects();
    } catch (error: any) {
      toast.error("Error adding project: " + (error.message || "Unknown error"));
    } finally {
      setAddingProject(false);
    }
  };

  const handleEditProject = (project: typeof projects[0]) => {
    setEditingProjectId(project.id);
    setProjectForm({
      name: project.name,
      project_code: project.project_code,
      agency: project.agency,
      start_date: project.start_date ? project.start_date.split('T')[0] : "",
      end_date: project.end_date ? project.end_date.split('T')[0] : "",
      is_active: project.is_active,
    });
    setShowProjectForm(true);
  };

  const handleUpdateProject = async () => {
    if (!editingProjectId) return;
    
    if (!projectForm.name.trim() || !projectForm.project_code.trim() || !projectForm.agency.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Validate dates if provided
    if (projectForm.start_date && projectForm.end_date) {
      const startDate = new Date(projectForm.start_date);
      const endDate = new Date(projectForm.end_date);
      if (endDate < startDate) {
        toast.error("End date must be after start date");
        return;
      }
    }

    setUpdatingProject(true);
    try {
      const response = await apiClient.updateProject(editingProjectId, {
        name: projectForm.name.trim(),
        project_code: projectForm.project_code.trim(),
        agency: projectForm.agency.trim(),
        start_date: projectForm.start_date || null,
        end_date: projectForm.end_date || null,
        is_active: projectForm.is_active,
      });

      if (response.error) {
        throw new Error(response.error);
      }

      toast.success("Project updated successfully");
      setProjectForm({ name: "", project_code: "", agency: "", start_date: "", end_date: "", is_active: true });
      setShowProjectForm(false);
      setEditingProjectId(null);
      await fetchProjects();
    } catch (error: any) {
      toast.error("Error updating project: " + (error.message || "Unknown error"));
    } finally {
      setUpdatingProject(false);
    }
  };

  const handleDeleteProject = async (projectId: number) => {
    if (!confirm("Are you sure you want to delete this project?")) {
      return;
    }

    try {
      const response = await apiClient.deleteProject(projectId);
      if (response.error) {
        throw new Error(response.error);
      }

      toast.success("Project deleted successfully");
      await fetchProjects();
    } catch (error: any) {
      toast.error("Error deleting project: " + (error.message || "Unknown error"));
    }
  };

  const handleSave = async () => {
    if (!user) return;

    if (profileData.can_have_wallet && profileData.wallet_low_balance_alert_enabled) {
      const t =
        profileData.wallet_low_balance_alert_threshold !== null &&
        profileData.wallet_low_balance_alert_threshold !== ""
          ? Number(profileData.wallet_low_balance_alert_threshold)
          : null;
      if (t == null || Number.isNaN(t) || t <= 0) {
        toast.error("Please enter a positive amount for the low balance alert threshold.");
        return;
      }
    }

    setSaving(true);

    try {
      if (!profileData.gender || !["male", "female", "other"].includes(profileData.gender)) {
        toast.error("Gender is required");
        setSaving(false);
        return;
      }
      // Update profile using /api/users/{user_id}/
      const payload: Parameters<typeof apiClient.updateProfile>[0] = {
        name: profileData.name,
        phone_number: profileData.phone_number,
        gender: profileData.gender,
      };
      if (profileData.can_have_wallet) {
        payload.wallet_low_balance_alert_enabled = profileData.wallet_low_balance_alert_enabled;
        payload.wallet_low_balance_alert_threshold = profileData.wallet_low_balance_alert_enabled
          ? (profileData.wallet_low_balance_alert_threshold !== ""
            ? Number(profileData.wallet_low_balance_alert_threshold)
            : null)
          : null;
      }
      const response = await apiClient.updateProfile(payload);

      if (response.error) {
        throw new Error(response.error);
      }

      // Refresh user data after update using AuthContext
      await refreshUser();
      
      // Update local user state in AuthContext
      if (response.data) {
        updateUser(response.data);
      }

      toast.success("Profile updated successfully");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error("Error updating profile: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>My Profile</CardTitle>
            <CardDescription>Update your personal information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center gap-4">
              <Avatar className="h-24 w-24">
                <AvatarImage src={(profileData.profile_picture || user?.profile_picture) ? apiClient.getProfilePictureUrl(profileData.id ?? user?.id) : undefined} alt={profileData.name || user?.name} />
                <AvatarFallback className="text-3xl">
                  {(profileData.name || user?.name || profileData.email || "U")[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {/* Only show upload button if no profile picture exists */}
              {!profileData.profile_picture && !user?.profile_picture && (
                <div>
                  <Input
                    id="avatar"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={uploading}
                  />
                  <Label htmlFor="avatar">
                    <Button variant="outline" size="sm" asChild disabled={uploading}>
                      <span className="cursor-pointer">
                        <Upload className="h-4 w-4 mr-2" />
                        {uploading ? "Uploading..." : "Upload Avatar"}
                      </span>
                    </Button>
                  </Label>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={profileData.email}
                  disabled
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  type="text"
                  value={profileData.name}
                  onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                  maxLength={255}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gender">Gender <span className="text-destructive">*</span></Label>
                <Select
                  value={profileData.gender || ""}
                  onValueChange={(v) => setProfileData(prev => ({ ...prev, gender: v }))}
                >
                  <SelectTrigger id="gender">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="emp_id">Employee ID</Label>
                <Input
                  id="emp_id"
                  type="text"
                  value={profileData.emp_id}
                  disabled
                  maxLength={50}
                  placeholder="Employee/Student ID"
                />
                <p className="text-xs text-muted-foreground">Employee ID (read-only)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone_number">Phone Number</Label>
                <Input
                  id="phone_number"
                  type="tel"
                  value={profileData.phone_number}
                  onChange={(e) => setProfileData(prev => ({ ...prev, phone_number: e.target.value }))}
                  maxLength={20}
                  placeholder="Contact phone number"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="user_type">User Type</Label>
                <Select
                  value={String(profileData.user_type)}
                  disabled
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select user type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Officer In Charge</SelectItem>
                    <SelectItem value="operator">Lab Incharge</SelectItem>
                    <SelectItem value="finance">Accounts In Charge</SelectItem>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="individual_student">Individual Student</SelectItem>
                    <SelectItem value="faculty">Faculty</SelectItem>
                    <SelectItem value="external">Educational Institute</SelectItem>
                    <SelectItem value="RND">Govt R&D Organizations</SelectItem>
                    <SelectItem value="Industry">Industry</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="type_9">Type 9</SelectItem>
                    <SelectItem value="type_10">Type 10</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">User type (read-only)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="department_name">Department</Label>
                <Input
                  id="department_name"
                  type="text"
                  value={profileData.department_name || (profileData.department ? `Department ID: ${profileData.department}` : "Not assigned")}
                  disabled
                />
                <p className="text-xs text-muted-foreground">Department name (read-only)</p>
              </div>

              {profileData.department_code && (
                <div className="space-y-2">
                  <Label htmlFor="department_code">Department Code</Label>
                  <Input
                    id="department_code"
                    type="text"
                    value={profileData.department_code}
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">Department code (read-only)</p>
                </div>
              )}

              {profileData.secondary_phone_number && (
                <div className="space-y-2">
                  <Label htmlFor="secondary_phone_number">Secondary Phone Number</Label>
                  <Input
                    id="secondary_phone_number"
                    type="tel"
                    value={profileData.secondary_phone_number}
                    disabled
                    maxLength={20}
                  />
                  <p className="text-xs text-muted-foreground">Secondary phone number (read-only)</p>
                </div>
              )}

              {profileData.date_of_birth && (
                <div className="space-y-2">
                  <Label htmlFor="date_of_birth">Date of Birth</Label>
                  <Input
                    id="date_of_birth"
                    type="text"
                    value={profileData.date_of_birth ? new Date(profileData.date_of_birth).toLocaleDateString() : ""}
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">Date of birth (read-only)</p>
                </div>
              )}

              {profileData.branch_name && (
                <div className="space-y-2">
                  <Label htmlFor="branch_name">Branch Name</Label>
                  <Input
                    id="branch_name"
                    type="text"
                    value={profileData.branch_name}
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">Branch name (read-only)</p>
                </div>
              )}

              {profileData.degree_name && (
                <div className="space-y-2">
                  <Label htmlFor="degree_name">Degree Name</Label>
                  <Input
                    id="degree_name"
                    type="text"
                    value={profileData.degree_name}
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">Degree name (read-only)</p>
                </div>
              )}

              {profileData.designation && (
                <div className="space-y-2">
                  <Label htmlFor="designation">Designation</Label>
                  <Input
                    id="designation"
                    type="text"
                    value={profileData.designation}
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">Designation (read-only)</p>
                </div>
              )}

              {profileData.supervisor && (
                <div className="space-y-2">
                  <Label htmlFor="supervisor">Supervisor</Label>
                  <Input
                    id="supervisor"
                    type="text"
                    value={typeof profileData.supervisor === 'object' ? profileData.supervisor.name : String(profileData.supervisor)}
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">Supervisor (read-only)</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Account Status Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Account Status</h3>
                <p className="text-sm text-muted-foreground">Your account verification and approval status</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email Verified</Label>
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${profileData.email_verified ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-sm">{profileData.email_verified ? 'Verified' : 'Not Verified'}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Admin Approved</Label>
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${profileData.admin_approved ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    <span className="text-sm">{profileData.admin_approved ? 'Approved' : 'Pending Approval'}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Account Status</Label>
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${profileData.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-sm">{profileData.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Wallet Access</Label>
                  <div className="flex items-center gap-2">
                    <div className={`h-3 w-3 rounded-full ${profileData.can_have_wallet ? 'bg-green-500' : 'bg-gray-500'}`} />
                    <span className="text-sm">{profileData.can_have_wallet ? 'Eligible' : 'Not Eligible'}</span>
                  </div>
                </div>
              </div>

              {profileData.date_joined && (
                <div className="space-y-2">
                  <Label>Member Since</Label>
                  <Input
                    type="text"
                    value={profileData.date_joined ? new Date(profileData.date_joined).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    }) : ""}
                    disabled
                  />
                </div>
              )}

              {profileData.last_login && (
                <div className="space-y-2">
                  <Label>Last Login</Label>
                  <Input
                    type="text"
                    value={profileData.last_login ? new Date(profileData.last_login).toLocaleString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : "Never"}
                    disabled
                  />
                </div>
              )}
            </div>

            <Separator />

            {/* Wallet low balance alert - only for users who can have a wallet */}
            {profileData.can_have_wallet && (
              <>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Wallet className="h-5 w-5" />
                      Wallet low balance notification
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Get an email every day at 11:00 AM when your wallet balance falls below a threshold. Disabled by default.
                    </p>
                  </div>
                  <div className="flex flex-col gap-4 rounded-lg border p-4 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="wallet-low-balance-enable" className="cursor-pointer">
                        Enable low balance alert
                      </Label>
                      <Switch
                        id="wallet-low-balance-enable"
                        checked={profileData.wallet_low_balance_alert_enabled}
                        onCheckedChange={(checked) =>
                          setProfileData((prev) => ({
                            ...prev,
                            wallet_low_balance_alert_enabled: !!checked,
                            wallet_low_balance_alert_threshold: checked ? prev.wallet_low_balance_alert_threshold : null,
                          }))
                        }
                      />
                    </div>
                    {profileData.wallet_low_balance_alert_enabled && (
                      <div className="space-y-2">
                        <Label htmlFor="wallet-low-balance-threshold">Alert when balance is below (₹)</Label>
                        <Input
                          id="wallet-low-balance-threshold"
                          type="number"
                          min={0}
                          step={0.01}
                          placeholder="e.g. 500"
                          value={
                            profileData.wallet_low_balance_alert_threshold !== null &&
                            profileData.wallet_low_balance_alert_threshold !== ""
                              ? String(profileData.wallet_low_balance_alert_threshold)
                              : ""
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            setProfileData((prev) => ({
                              ...prev,
                              wallet_low_balance_alert_threshold: v === "" ? null : v,
                            }));
                          }}
                        />
                        <p className="text-xs text-muted-foreground">
                          You will receive an email each day at 11:00 AM if your wallet balance is below this amount.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Projects Section - Only for Faculty */}
            {isFacultyUser() && (
              <>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Projects</h3>
                      <p className="text-sm text-muted-foreground">Manage your research projects</p>
                    </div>
                    {!showProjectForm && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowProjectForm(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Project
                      </Button>
                    )}
                  </div>

                  {showProjectForm && (
                    <Card className="border-primary/50">
                      <CardHeader>
                        <CardTitle className="text-base">
                          {editingProjectId ? "Edit Project" : "Add New Project"}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="project_name">Project Name *</Label>
                          <Input
                            id="project_name"
                            type="text"
                            value={projectForm.name}
                            onChange={(e) => setProjectForm(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Enter project name"
                            maxLength={255}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="project_code">Project Code *</Label>
                          <Input
                            id="project_code"
                            type="text"
                            value={projectForm.project_code}
                            onChange={(e) => setProjectForm(prev => ({ ...prev, project_code: e.target.value }))}
                            placeholder="Enter project code"
                            maxLength={100}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="agency">Agency *</Label>
                          <Input
                            id="agency"
                            type="text"
                            value={projectForm.agency}
                            onChange={(e) => setProjectForm(prev => ({ ...prev, agency: e.target.value }))}
                            placeholder="Enter funding agency"
                            maxLength={255}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="start_date">Start Date</Label>
                            <Input
                              id="start_date"
                              type="date"
                              value={projectForm.start_date}
                              onChange={(e) => setProjectForm(prev => ({ ...prev, start_date: e.target.value }))}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="end_date">End Date</Label>
                            <Input
                              id="end_date"
                              type="date"
                              value={projectForm.end_date}
                              onChange={(e) => setProjectForm(prev => ({ ...prev, end_date: e.target.value }))}
                              min={projectForm.start_date || undefined}
                            />
                          </div>
                        </div>

                        {editingProjectId && (
                          <div className="space-y-2">
                            <Label htmlFor="is_active">Status</Label>
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="is_active"
                                checked={projectForm.is_active}
                                onChange={(e) => setProjectForm(prev => ({ ...prev, is_active: e.target.checked }))}
                                className="h-4 w-4 rounded border-gray-300"
                              />
                              <Label htmlFor="is_active" className="text-sm font-normal cursor-pointer">
                                Active
                              </Label>
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button
                            onClick={editingProjectId ? handleUpdateProject : handleAddProject}
                            disabled={addingProject || updatingProject}
                            size="sm"
                          >
                            {addingProject ? "Adding..." : updatingProject ? "Updating..." : editingProjectId ? "Update Project" : "Add Project"}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setShowProjectForm(false);
                              setEditingProjectId(null);
                              setProjectForm({ name: "", project_code: "", agency: "", start_date: "", end_date: "", is_active: true });
                            }}
                            size="sm"
                            disabled={addingProject || updatingProject}
                          >
                            Cancel
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {loadingProjects ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : projects.length > 0 ? (
                    <div className="space-y-3">
                      {projects.map((project) => (
                        <Card key={project.id} className={`border ${!project.is_active ? 'opacity-60' : ''}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <h4 className="font-semibold text-base">{project.name}</h4>
                                      {project.is_expired && (
                                        <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                          Expired
                                        </span>
                                      )}
                                      {!project.is_active && !project.is_expired && (
                                        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">
                                          Inactive
                                        </span>
                                      )}
                                      {project.is_active && !project.is_expired && (
                                        <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                          Active
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground">Code: {project.project_code}</p>
                                    <p className="text-sm text-muted-foreground">Agency: {project.agency}</p>
                                    {project.start_date && (
                                      <p className="text-sm text-muted-foreground">
                                        Start Date: {new Date(project.start_date).toLocaleDateString()}
                                      </p>
                                    )}
                                    {project.end_date && (
                                      <p className="text-sm text-muted-foreground">
                                        End Date: {new Date(project.end_date).toLocaleDateString()}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Created: {new Date(project.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditProject(project)}
                                  className="text-primary hover:text-primary"
                                  title="Edit project"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteProject(project.id)}
                                  className="text-destructive hover:text-destructive"
                                  title="Delete project"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    !showProjectForm && (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No projects added yet.</p>
                        <p className="text-sm">Click "Add Project" to get started.</p>
                      </div>
                    )
                  )}
                </div>
                <Separator />
              </>
            )}

            {/* Change Appearance Section */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Change Appearance</h3>
                <p className="text-sm text-muted-foreground">Customize how the app looks and feels</p>
              </div>

              <div className="space-y-3">
                <Label htmlFor="theme">Theme</Label>
                {mounted && (
                  <RadioGroup
                    value={theme || "system"}
                    onValueChange={(value) => setTheme(value)}
                    className="space-y-3"
                  >
                    <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors">
                      <RadioGroupItem value="light" id="light" />
                      <Label htmlFor="light" className="flex items-center gap-2 cursor-pointer flex-1">
                        <Sun className="h-4 w-4" />
                        <div>
                          <div className="font-medium">Light</div>
                          <div className="text-xs text-muted-foreground">Use light theme</div>
                        </div>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors">
                      <RadioGroupItem value="dark" id="dark" />
                      <Label htmlFor="dark" className="flex items-center gap-2 cursor-pointer flex-1">
                        <Moon className="h-4 w-4" />
                        <div>
                          <div className="font-medium">Dark</div>
                          <div className="text-xs text-muted-foreground">Use dark theme</div>
                        </div>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors">
                      <RadioGroupItem value="system" id="system" />
                      <Label htmlFor="system" className="flex items-center gap-2 cursor-pointer flex-1">
                        <Monitor className="h-4 w-4" />
                        <div>
                          <div className="font-medium">System</div>
                          <div className="text-xs text-muted-foreground">Match system preference</div>
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>
                )}
                {!mounted && (
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3 rounded-lg border p-3">
                      <div className="h-4 w-4 rounded-full border border-primary" />
                      <div className="flex items-center gap-2 flex-1">
                        <Sun className="h-4 w-4" />
                        <div>
                          <div className="font-medium">Light</div>
                          <div className="text-xs text-muted-foreground">Use light theme</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-4">
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button variant="outline" onClick={() => navigate("/dashboard")} className="flex-1">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Profile;
