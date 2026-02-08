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
import { Upload, Moon, Sun, Monitor } from "lucide-react";
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
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
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
  });

  useEffect(() => {
    checkAuthAndLoadProfile();
  }, [navigate]);

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
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch('http://127.0.0.1:8000/api/profiles/me/avatar/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${apiClient.getToken()}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload avatar');
      }

      const data = await response.json();
      setProfileData(prev => ({ ...prev, profile_picture: data.profile_picture || data.avatar_url }));
      // Refresh user data after avatar upload using AuthContext
      await refreshUser();
      toast.success("Avatar uploaded successfully");
    } catch (error: any) {
      toast.error("Error uploading avatar: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);

    try {
      // Update profile using /api/users/{user_id}/
      // Only send name and phone_number as per requirements
      const response = await apiClient.updateProfile({
        name: profileData.name,
        phone_number: profileData.phone_number,
      });

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
                <AvatarImage src={profileData.profile_picture || user?.profile_picture} alt={profileData.name || user?.name} />
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
                    <SelectItem value="RND">Govt R&D Center</SelectItem>
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
