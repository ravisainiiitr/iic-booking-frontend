import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { isExternalBookingUserType } from "@/lib/userTypes";
import { INDIAN_MOBILE_ERROR, INDIAN_MOBILE_HINT, isValidMobileNumber } from "@/lib/mobileNumber";
import { useAuth } from "@/contexts/AuthContext";
import ProgrammeEndDateFields from "@/components/accountLifecycle/ProgrammeEndDateFields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Plus, Trash2, Edit, Wallet } from "lucide-react";
import { toast } from "sonner";
import DashboardHeader from "@/components/DashboardHeader";
import { formatUserDisplayName, getNameInitial } from "@/lib/displayName";
import LoginPasswordCard from "@/components/profile/LoginPasswordCard";
import MobileDevicesCard from "@/components/profile/MobileDevicesCard";
import WhatsAppCard from "@/components/profile/WhatsAppCard";
import IstemLinkCard from "@/components/profile/IstemLinkCard";
import { IstemProfileReadinessNotice } from "@/components/istem/IstemProfileReadinessNotice";
import { formatDMY } from "@/lib/dateFormat";

const Profile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // The tab a link points at: /profile#external-billing, #projects or #istem-portal-ack open their tab.
  const [tab, setTab] = useState(() =>
    location.hash === "#external-billing" ? "billing"
      : location.hash === "#projects" ? "projects"
        : location.hash === "#istem-portal-ack" ? "istem"
          : location.hash === "#whatsapp" ? "notifications"
            : "details",
  );
  const { user, loading: authLoading, isAuthenticated, refreshUser, updateUser } = useAuth();
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
  const [externalBilling, setExternalBilling] = useState({
    billing_name: "",
    gstin: "",
    billing_address_line1: "",
    billing_address_line2: "",
    billing_city: "",
    billing_state: "",
    billing_pincode: "",
    billing_country: "India",
    shipping_same_as_billing: true,
    shipping_name: "",
    shipping_phone: "",
    shipping_address_line1: "",
    shipping_address_line2: "",
    shipping_city: "",
    shipping_state: "",
    shipping_pincode: "",
    shipping_country: "India",
  });
  const [loadingExternalBilling, setLoadingExternalBilling] = useState(false);
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
    joining_date: "",
    graduation_date: "",
    email_verified: false,
    admin_approved: false,
    is_active: false,
    date_joined: "",
    last_login: "",
    can_have_wallet: false,
    auto_slot_selection: false,
    wallet_low_balance_alert_enabled: false,
    wallet_low_balance_alert_threshold: null as number | string | null,
    istem_portal_acknowledged: false,
  });

  // Right after a reload the auth check is still running: wait for it, then load the profile once.
  const profileLoadStarted = useRef(false);
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate("/auth");
      return;
    }
    if (profileLoadStarted.current) return;
    profileLoadStarted.current = true;
    void loadProfile();
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (isFacultyUser()) {
      fetchProjects();
    }
  }, [user, profileData.user_type]);

  useEffect(() => {
    if (window.location.hash === "#external-billing") {
      setTimeout(() => {
        document.getElementById("external-billing")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    }
    if (window.location.hash === "#istem-portal-ack") {
      setTimeout(() => {
        document.getElementById("istem-portal-ack")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
    }
    if (window.location.hash === "#projects") {
      setTimeout(() => {
        document.getElementById("projects")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
      if (sessionStorage.getItem("returnToWalletRecharge") === "true") {
        setShowProjectForm(true);
      }
    }
  }, []);

  // External users: billing/shipping profile (invoice / shipping label); reloaded after linking I-STEM fills blanks.
  const loadExternalBilling = () => {
    setLoadingExternalBilling(true);
    apiClient
      .getExternalBillingProfileMe()
      .then((r) => {
        if (r.error || !r.data) return;
        setExternalBilling((p) => ({ ...p, ...r.data }));
      })
      .finally(() => setLoadingExternalBilling(false));
  };

  const loadProfile = async () => {
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
        joining_date: response.data.joining_date || "",
        graduation_date: response.data.graduation_date || "",
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
        istem_portal_acknowledged: Boolean(response.data.istem_portal_acknowledged),
      });

      // External users: prefill billing/shipping profile (invoice / shipping label)
      const ut = response.data.user_type;
      const utStr = typeof ut === "string" ? ut.toLowerCase() : "";
      const isExternal = isExternalBookingUserType(utStr);
      if (isExternal) loadExternalBilling();
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
      if (sessionStorage.getItem("returnToWalletRecharge") === "true") {
        navigate("/wallet");
      }
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

    const phone = (profileData.phone_number || "").trim();
    if (phone && phone !== (user.phone_number || "").trim() && !isValidMobileNumber(phone)) {
      toast.error(INDIAN_MOBILE_ERROR);
      return;
    }

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
      // Save external billing/shipping details first (if applicable)
      const ut = profileData.user_type ?? user?.user_type;
      const utStr = typeof ut === "string" ? ut.toLowerCase() : "";
      const isExternal = isExternalBookingUserType(utStr);
      if (isExternal) {
        const resBilling = await apiClient.updateExternalBillingProfileMe(externalBilling);
        if (resBilling.error) {
          toast.error(resBilling.error);
          setSaving(false);
          return;
        }
      }

      if (!(user as { gender_from_channel_i?: boolean })?.gender_from_channel_i) {
        if (!profileData.gender || !["male", "female", "other"].includes(profileData.gender)) {
          toast.error("Gender is required");
          setSaving(false);
          return;
        }
      }
      // Update profile using /api/users/{user_id}/
      const payload: Parameters<typeof apiClient.updateProfile>[0] = {
        name: profileData.name,
        phone_number: profileData.phone_number,
      };
      if (!(user as { gender_from_channel_i?: boolean })?.gender_from_channel_i) {
        payload.gender = profileData.gender;
      }
      if (profileData.can_have_wallet) {
        payload.wallet_low_balance_alert_enabled = profileData.wallet_low_balance_alert_enabled;
        payload.wallet_low_balance_alert_threshold = profileData.wallet_low_balance_alert_enabled
          ? (profileData.wallet_low_balance_alert_threshold !== ""
            ? Number(profileData.wallet_low_balance_alert_threshold)
            : null)
          : null;
      }
      if (isExternal) {
        payload.istem_portal_acknowledged = profileData.istem_portal_acknowledged;
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

  const utLower = String(profileData.user_type ?? user?.user_type ?? "").toLowerCase();
  const isExternalUser = isExternalBookingUserType(utLower);
  const statusChips: Array<{ label: string; ok: boolean; warn?: boolean }> = [
    { label: profileData.email_verified ? "Email verified" : "Email not verified", ok: !!profileData.email_verified },
    { label: profileData.admin_approved ? "Approved" : "Approval pending", ok: !!profileData.admin_approved, warn: !profileData.admin_approved },
    { label: profileData.is_active ? "Active" : "Inactive", ok: !!profileData.is_active },
    { label: profileData.can_have_wallet ? "Wallet eligible" : "No wallet", ok: !!profileData.can_have_wallet, warn: !profileData.can_have_wallet },
  ];
  const tabs = [
    { value: "details", label: "Personal details", show: true },
    { value: "billing", label: "Billing & shipping", show: isExternalUser },
    { value: "notifications", label: "Notifications", show: !!user },
    { value: "security", label: "Sign-in & devices", show: !!user },
    { value: "istem", label: "I-STEM", show: !!user },
    { value: "projects", label: "Projects", show: isFacultyUser() },
  ].filter((t) => t.show);
  const saveBar = (
    <div className="sticky bottom-0 z-20 -mx-4 mt-4 border-t border-border/70 bg-background/90 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:mx-0 sm:rounded-2xl sm:border">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <p className="mr-auto hidden text-xs text-muted-foreground sm:block">Changes on every tab are saved together.</p>
        <Button variant="outline" onClick={() => navigate("/dashboard")}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving} className="min-w-[9rem]">
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6">
        {/* Summary: who you are and the state of your account, across the full width */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-brand via-brand to-brand-accent p-5 text-white shadow-lg sm:px-6 sm:py-5" data-testid="profile-summary">
          <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-center">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 shrink-0 ring-4 ring-white/25">
                <AvatarImage src={(profileData.profile_picture || user?.profile_picture) ? apiClient.getProfilePictureUrl(profileData.id ?? user?.id) : undefined} alt={formatUserDisplayName({ name: profileData.name, email: profileData.email, user_type: profileData.user_type ?? user?.user_type, display_name: user?.display_name })} />
                <AvatarFallback className="bg-white/15 text-2xl text-white">
                  {getNameInitial(profileData.name || user?.name, profileData.email || user?.email, "U")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">My Profile</p>
                <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
                  {formatUserDisplayName({ name: profileData.name, email: profileData.email, user_type: profileData.user_type ?? user?.user_type, display_name: user?.display_name })}
                </h1>
                <p className="truncate text-sm text-white/85">{profileData.email}</p>
                <p className="truncate text-sm text-white/75">
                  {[profileData.department_name, profileData.designation].filter(Boolean).join(" · ") || "Update your personal information and preferences"}
                </p>
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
                      <Button variant="secondary" size="sm" className="mt-2 h-8" asChild disabled={uploading}>
                        <span className="cursor-pointer">
                          <Upload className="h-4 w-4 mr-2" />
                          {uploading ? "Uploading..." : "Upload Avatar"}
                        </span>
                      </Button>
                    </Label>
                  </div>
                )}
              </div>
            </div>
            <div className="md:ml-auto md:text-right">
              <div className="flex flex-wrap gap-1.5 md:justify-end" data-testid="profile-status">
                {statusChips.map((c) => (
                  <span
                    key={c.label}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                      c.ok ? "bg-emerald-400/20 text-white ring-emerald-200/40" : c.warn ? "bg-amber-400/20 text-white ring-amber-200/40" : "bg-rose-400/25 text-white ring-rose-200/40"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${c.ok ? "bg-emerald-300" : c.warn ? "bg-amber-300" : "bg-rose-300"}`} aria-hidden />
                    {c.label}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-white/75">
                {profileData.date_joined ? `Member since ${new Date(profileData.date_joined).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                {profileData.date_joined && profileData.last_login ? " · " : ""}
                {profileData.last_login ? `Last sign-in ${new Date(profileData.last_login).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}` : ""}
              </p>
            </div>
          </div>
        </section>

        {user ? (
          <div className="mt-4">
            <IstemProfileReadinessNotice onProfile />
          </div>
        ) : null}

        <Tabs value={tab} onValueChange={setTab} className="mt-4">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 rounded-2xl bg-muted/60 p-1">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="rounded-xl px-4 py-2 data-[state=active]:shadow-sm">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="details" className="mt-4">
            <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Personal details</CardTitle>
                <CardDescription>Your name, gender and mobile number can be changed here; the rest comes from your registration or Channel i.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileData.email}
                      disabled
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="name">Name</Label>
                    {String(profileData.user_type || user?.user_type || "").toLowerCase() === "faculty" ? (
                      <p className="text-xs text-muted-foreground">
                        Displayed as{" "}
                        <strong>
                          {formatUserDisplayName({
                            name: profileData.name,
                            user_type: "faculty",
                            display_name: user?.display_name,
                          })}
                        </strong>{" "}
                        across the portal (Prof. is added automatically).
                      </p>
                    ) : null}
                    <Input
                      id="name"
                      type="text"
                      value={profileData.name}
                      onChange={(e) => setProfileData(prev => ({ ...prev, name: e.target.value }))}
                      maxLength={255}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="gender">
                      Gender{" "}
                      {(user as { gender_from_channel_i?: boolean })?.gender_from_channel_i ? (
                        <span className="text-muted-foreground font-normal">(Channel-I / read-only)</span>
                      ) : (
                        <span className="text-destructive">*</span>
                      )}
                    </Label>
                    {(user as { gender_from_channel_i?: boolean })?.gender_from_channel_i ? (
                      <>
                        <Input
                          id="gender"
                          value={
                            profileData.gender === "male"
                              ? "Male"
                              : profileData.gender === "female"
                                ? "Female"
                                : profileData.gender === "other"
                                  ? "Other"
                                  : profileData.gender || "—"
                          }
                          disabled
                          readOnly
                        />
                        <p className="text-xs text-muted-foreground">
                          Gender is supplied by Channel-I and cannot be edited here.
                        </p>
                      </>
                    ) : (
                      <Select
                        value={profileData.gender || ""}
                        onValueChange={(v) => setProfileData((prev) => ({ ...prev, gender: v }))}
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
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="emp_id">Employee ID</Label>
                    <Input
                      id="emp_id"
                      type="text"
                      value={profileData.emp_id}
                      disabled
                      maxLength={50}
                      placeholder="Employee/Student ID"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="phone_number">Mobile number</Label>
                    <Input
                      id="phone_number"
                      type="tel"
                      value={profileData.phone_number}
                      onChange={(e) => setProfileData(prev => ({ ...prev, phone_number: e.target.value }))}
                      maxLength={20}
                      placeholder="Contact phone number"
                    />
                    <p className="text-xs text-muted-foreground">{INDIAN_MOBILE_HINT}</p>
                  </div>

                  <div className="space-y-1.5">
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
                        <SelectItem value="operator">Lab Operator</SelectItem>
                        <SelectItem value="finance">Accounts In Charge</SelectItem>
                        <SelectItem value="student">Student</SelectItem>
                        <SelectItem value="individual_student">Individual Student</SelectItem>
                        <SelectItem value="faculty">Faculty</SelectItem>
                        <SelectItem value="external">Educational Institute</SelectItem>
                        <SelectItem value="RND">Govt R&D Organizations</SelectItem>
                        <SelectItem value="Industry">Industry</SelectItem>
                        <SelectItem value="startup_incubated_iitr">IITR Startup</SelectItem>
                        <SelectItem value="external_startup_msme">External Startup/MSME</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="department_name">Department</Label>
                    <Input
                      id="department_name"
                      type="text"
                      value={profileData.department_name || (profileData.department ? `Department ID: ${profileData.department}` : "Not assigned")}
                      disabled
                    />
                  </div>

                  {profileData.department_code && (
                    <div className="space-y-1.5">
                      <Label htmlFor="department_code">Department Code</Label>
                      <Input
                        id="department_code"
                        type="text"
                        value={profileData.department_code}
                        disabled
                      />
                    </div>
                  )}

                  {profileData.secondary_phone_number && (
                    <div className="space-y-1.5">
                      <Label htmlFor="secondary_phone_number">Secondary Phone Number</Label>
                      <Input
                        id="secondary_phone_number"
                        type="tel"
                        value={profileData.secondary_phone_number}
                        disabled
                        maxLength={20}
                      />
                    </div>
                  )}

                  {profileData.date_of_birth && (
                    <div className="space-y-1.5">
                      <Label htmlFor="date_of_birth">Date of Birth</Label>
                      <Input
                        id="date_of_birth"
                        type="text"
                        value={profileData.date_of_birth ? formatDMY(profileData.date_of_birth) : ""}
                        disabled
                      />
                    </div>
                  )}

                  {profileData.branch_name && (
                    <div className="space-y-1.5">
                      <Label htmlFor="branch_name">Branch Name</Label>
                      <Input
                        id="branch_name"
                        type="text"
                        value={profileData.branch_name}
                        disabled
                      />
                    </div>
                  )}

                  {profileData.degree_name && (
                    <div className="space-y-1.5">
                      <Label htmlFor="degree_name">Degree Name</Label>
                      <Input
                        id="degree_name"
                        type="text"
                        value={profileData.degree_name}
                        disabled
                      />
                    </div>
                  )}

                  {profileData.designation && (
                    <div className="space-y-1.5">
                      <Label htmlFor="designation">Designation</Label>
                      <Input
                        id="designation"
                        type="text"
                        value={profileData.designation}
                        disabled
                      />
                    </div>
                  )}

                  {profileData.joining_date && (
                    <div className="space-y-1.5">
                      <Label htmlFor="joining_date">Joining Date</Label>
                      <Input
                        id="joining_date"
                        type="text"
                        value={formatDMY(profileData.joining_date)}
                        disabled
                      />
                      <p className="text-xs text-muted-foreground">Institute joining / programme start (from Channel i)</p>
                    </div>
                  )}

                  {profileData.graduation_date && (
                    <div className="space-y-1.5">
                      <Label htmlFor="graduation_date">Graduation Date</Label>
                      <Input
                        id="graduation_date"
                        type="text"
                        value={formatDMY(profileData.graduation_date)}
                        disabled
                      />
                      <p className="text-xs text-muted-foreground">Programme end / graduation (from Channel i)</p>
                    </div>
                  )}

                  {user?.account_lifecycle ? (
                    <ProgrammeEndDateFields showDegree={!profileData.degree_name} endDate={user.account_lifecycle.programme_end_date} />
                  ) : null}

                  {profileData.supervisor && (
                    <div className="space-y-1.5">
                      <Label htmlFor="supervisor">Supervisor</Label>
                      <Input
                        id="supervisor"
                        type="text"
                        value={typeof profileData.supervisor === 'object' ? profileData.supervisor.name : String(profileData.supervisor)}
                        disabled
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {isExternalUser ? (
            <TabsContent value="billing" className="mt-4">
              <div id="external-billing" className="grid scroll-mt-24 gap-4 lg:grid-cols-2">
                <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Billing</CardTitle>
                    <CardDescription>Used on invoices and receipts.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                    <div className="space-y-2">
                      <Label htmlFor="billing_name">Billing name / company</Label>
                      <Input
                        id="billing_name"
                        value={externalBilling.billing_name}
                        onChange={(e) => setExternalBilling((p) => ({ ...p, billing_name: e.target.value }))}
                        maxLength={255}
                        placeholder="e.g. ABC Pvt Ltd / IIT XYZ"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="gstin">GSTIN</Label>
                      <Input
                        id="gstin"
                        value={externalBilling.gstin}
                        onChange={(e) => setExternalBilling((p) => ({ ...p, gstin: e.target.value }))}
                        maxLength={30}
                        placeholder="Optional"
                      />
                    </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="billing_address_line1">Billing address line 1</Label>
                        <Input
                          id="billing_address_line1"
                          value={externalBilling.billing_address_line1}
                          onChange={(e) => setExternalBilling((p) => ({ ...p, billing_address_line1: e.target.value }))}
                          maxLength={255}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="billing_address_line2">Billing address line 2</Label>
                        <Input
                          id="billing_address_line2"
                          value={externalBilling.billing_address_line2}
                          onChange={(e) => setExternalBilling((p) => ({ ...p, billing_address_line2: e.target.value }))}
                          maxLength={255}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-4">
                      <div className="space-y-2">
                        <Label htmlFor="billing_city">City</Label>
                        <Input
                          id="billing_city"
                          value={externalBilling.billing_city}
                          onChange={(e) => setExternalBilling((p) => ({ ...p, billing_city: e.target.value }))}
                          maxLength={120}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="billing_state">State</Label>
                        <Input
                          id="billing_state"
                          value={externalBilling.billing_state}
                          onChange={(e) => setExternalBilling((p) => ({ ...p, billing_state: e.target.value }))}
                          maxLength={120}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="billing_pincode">Pincode</Label>
                        <Input
                          id="billing_pincode"
                          value={externalBilling.billing_pincode}
                          onChange={(e) => setExternalBilling((p) => ({ ...p, billing_pincode: e.target.value }))}
                          maxLength={20}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="billing_country">Country</Label>
                        <Input
                          id="billing_country"
                          value={externalBilling.billing_country}
                          onChange={(e) => setExternalBilling((p) => ({ ...p, billing_country: e.target.value }))}
                          maxLength={120}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Shipping</CardTitle>
                    <CardDescription>Where results and samples are sent back; prefilled on shipping labels.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                      <div className="space-y-0.5">
                        <Label>Shipping same as billing</Label>
                        <p className="text-xs text-muted-foreground">If enabled, the shipping label will use billing address.</p>
                      </div>
                      <Switch
                        checked={externalBilling.shipping_same_as_billing}
                        onCheckedChange={(checked) => setExternalBilling((p) => ({ ...p, shipping_same_as_billing: !!checked }))}
                      />
                    </div>

                    {!externalBilling.shipping_same_as_billing && (
                      <>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="shipping_name">Shipping name / contact</Label>
                            <Input
                              id="shipping_name"
                              value={externalBilling.shipping_name}
                              onChange={(e) => setExternalBilling((p) => ({ ...p, shipping_name: e.target.value }))}
                              maxLength={255}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="shipping_phone">MOB</Label>
                            <Input
                              id="shipping_phone"
                              value={externalBilling.shipping_phone}
                              onChange={(e) => setExternalBilling((p) => ({ ...p, shipping_phone: e.target.value }))}
                              maxLength={30}
                            />
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="shipping_address_line1">Shipping address line 1</Label>
                            <Input
                              id="shipping_address_line1"
                              value={externalBilling.shipping_address_line1}
                              onChange={(e) => setExternalBilling((p) => ({ ...p, shipping_address_line1: e.target.value }))}
                              maxLength={255}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="shipping_address_line2">Shipping address line 2</Label>
                            <Input
                              id="shipping_address_line2"
                              value={externalBilling.shipping_address_line2}
                              onChange={(e) => setExternalBilling((p) => ({ ...p, shipping_address_line2: e.target.value }))}
                              maxLength={255}
                            />
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-4">
                          <div className="space-y-2">
                            <Label htmlFor="shipping_city">City</Label>
                            <Input
                              id="shipping_city"
                              value={externalBilling.shipping_city}
                              onChange={(e) => setExternalBilling((p) => ({ ...p, shipping_city: e.target.value }))}
                              maxLength={120}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="shipping_state">State</Label>
                            <Input
                              id="shipping_state"
                              value={externalBilling.shipping_state}
                              onChange={(e) => setExternalBilling((p) => ({ ...p, shipping_state: e.target.value }))}
                              maxLength={120}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="shipping_pincode">Pincode</Label>
                            <Input
                              id="shipping_pincode"
                              value={externalBilling.shipping_pincode}
                              onChange={(e) => setExternalBilling((p) => ({ ...p, shipping_pincode: e.target.value }))}
                              maxLength={20}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="shipping_country">Country</Label>
                            <Input
                              id="shipping_country"
                              value={externalBilling.shipping_country}
                              onChange={(e) => setExternalBilling((p) => ({ ...p, shipping_country: e.target.value }))}
                              maxLength={120}
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {loadingExternalBilling && (
                      <p className="text-sm text-muted-foreground">Loading billing profile…</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          ) : null}

          {user ? (
            <TabsContent value="notifications" className="mt-4">
              <div className="grid items-start gap-4 lg:grid-cols-2">
                <WhatsAppCard className="mx-0 mt-0 max-w-none" />
                {profileData.can_have_wallet ? (
                  <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
                    <CardContent className="pt-6">
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
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            </TabsContent>
          ) : null}

          {user ? (
            <TabsContent value="security" className="mt-4">
              <div className="grid items-start gap-4 lg:grid-cols-[3fr_2fr]">
                <LoginPasswordCard className="mx-0 mt-0 max-w-none" />
                <MobileDevicesCard className="mx-0 mt-0 max-w-none" />
              </div>
            </TabsContent>
          ) : null}

          {user ? (
            <TabsContent value="istem" className="mt-4">
              <div className="grid items-start gap-4 lg:grid-cols-2">
                <IstemLinkCard className="mx-0 mt-0 max-w-none" onLinked={loadExternalBilling} />
                {isExternalUser ? (
                  <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
                    <CardContent className="pt-6">
                      <div id="istem-portal-ack" className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-4 scroll-mt-24">
                        <div>
                          <h3 className="text-lg font-semibold">I-STEM national portal</h3>
                          <p className="text-sm text-muted-foreground">
                            External bookings are aligned with the Government of India I-STEM facility map. Register or log in at{" "}
                            <a
                              href="https://www.istem.gov.in/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-primary underline"
                            >
                              https://www.istem.gov.in/
                            </a>
                            , raise your facility booking there, then enter the FBR number on your booking in this portal after you confirm a slot here.
                          </p>
                        </div>
                        <div className="flex flex-row items-center justify-between gap-4 rounded-lg border border-border/50 bg-background/80 p-3">
                          <div className="space-y-1">
                            <Label htmlFor="istem-portal-ack-switch" className="text-sm font-medium">
                              I confirm I have an I-STEM portal account
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Required before you can confirm equipment bookings as an external user.
                            </p>
                          </div>
                          <Switch
                            id="istem-portal-ack-switch"
                            checked={profileData.istem_portal_acknowledged}
                            onCheckedChange={(v) =>
                              setProfileData((p) => ({ ...p, istem_portal_acknowledged: v === true }))
                            }
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            </TabsContent>
          ) : null}

          {isFacultyUser() ? (
            <TabsContent value="projects" className="mt-4">
              <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
                <CardContent className="pt-6">
                  <div id="projects" className="space-y-4 scroll-mt-24">
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
                              <DateInput
                                id="start_date"
                                value={projectForm.start_date}
                                onChange={(e) => setProjectForm(prev => ({ ...prev, start_date: e.target.value }))}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="end_date">End Date</Label>
                              <DateInput
                                id="end_date"
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
                                          Start Date: {formatDMY(project.start_date)}
                                        </p>
                                      )}
                                      {project.end_date && (
                                        <p className="text-sm text-muted-foreground">
                                          End Date: {formatDMY(project.end_date)}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    Created: {formatDMY(project.created_at)}
                                  </p>
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                    aria-label="Edit project"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditProject(project)}
                                    className="text-primary hover:text-primary"
                                    title="Edit project"
                                  >
                                    <Edit className="h-4 w-4" aria-hidden />
                                  </Button>
                                  <Button
                                    aria-label="Delete project"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteProject(project.id)}
                                    className="text-destructive hover:text-destructive"
                                    title="Delete project"
                                  >
                                    <Trash2 className="h-4 w-4" aria-hidden />
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
                </CardContent>
              </Card>
            </TabsContent>
          ) : null}
        </Tabs>

        {saveBar}
      </main>
    </div>
  );
};

export default Profile;
