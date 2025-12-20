import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Upload } from "lucide-react";
import { toast } from "sonner";

const Profile = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    user_type: "",
    emp_id: "",
    phone_number: "",
    profile_picture: "",
    department: null as any,
    department_name: "",
    department_code: "",
    supervisor: null as any,
  });

  useEffect(() => {
    checkAuthAndLoadProfile();
  }, [navigate]);

  const checkAuthAndLoadProfile = async () => {
    const token = apiClient.getToken();
    if (!token) {
      navigate("/auth");
      return;
    }

    try {
      const userResponse = await apiClient.getCurrentUser();
      if (userResponse.error || !userResponse.data) {
        navigate("/auth");
        return;
      }

      setUser(userResponse.data);
      await fetchProfile();
    } catch (error) {
      console.error("Error loading profile:", error);
      navigate("/auth");
    }
  };

  const fetchProfile = async () => {
    // Use getCurrentUser since profiles/me/ returns the same data
    const response = await apiClient.getCurrentUser();
    
    if (response.data) {
      setProfileData({
        name: response.data.name || "",
        email: response.data.email || "",
        user_type: response.data.user_type || "",
        emp_id: response.data.emp_id || "",
        phone_number: response.data.phone_number || "",
        profile_picture: response.data.profile_picture || "",
        department: response.data.department || null,
        department_name: response.data.department_name || "",
        department_code: response.data.department_code || "",
        supervisor: response.data.supervisor || null,
      });
    }
    setLoading(false);
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
          'Authorization': `Bearer ${apiClient.getToken()}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload avatar');
      }

      const data = await response.json();
      setProfileData(prev => ({ ...prev, profile_picture: data.profile_picture || data.avatar_url }));
      // Update user in localStorage if available
      const userResponse = await apiClient.getCurrentUser();
      if (userResponse.data) {
        localStorage.setItem('user', JSON.stringify(userResponse.data));
      }
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
      // Only send writable fields: name, user_type, emp_id, phone_number, profile_picture, department
      const response = await apiClient.updateProfile({
        name: profileData.name,
        user_type: profileData.user_type,
        emp_id: profileData.emp_id,
        phone_number: profileData.phone_number,
        profile_picture: profileData.profile_picture,
        department: profileData.department, // Department ID if changing
      });

      if (response.error) {
        throw new Error(response.error);
      }

      // Refresh user data after update
      const userResponse = await apiClient.getCurrentUser();
      if (userResponse.data) {
        localStorage.setItem('user', JSON.stringify(userResponse.data));
      }

      toast.success("Profile updated successfully");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error("Error updating profile: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </header>

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
                  onChange={(e) => setProfileData(prev => ({ ...prev, emp_id: e.target.value }))}
                  maxLength={50}
                  placeholder="Employee/Student ID"
                />
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
                  value={profileData.user_type}
                  onValueChange={(value) => setProfileData(prev => ({ ...prev, user_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select user type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="faculty">Faculty</SelectItem>
                    <SelectItem value="external">External</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="operator">Operator</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="type_8">Type 8</SelectItem>
                    <SelectItem value="type_9">Type 9</SelectItem>
                    <SelectItem value="type_10">Type 10</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="department_name">Department</Label>
                <Input
                  id="department_name"
                  type="text"
                  value={profileData.department_name || ""}
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
