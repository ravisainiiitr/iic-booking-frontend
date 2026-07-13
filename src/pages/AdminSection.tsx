import { useState, useEffect, useRef } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { apiClient, ADMIN_SECTION_ENDPOINTS } from "@/lib/api";
import { isExternalBookingUserType } from "@/lib/userTypes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Plus, Pencil, Trash2, FileText, ExternalLink } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { EquipmentForm, type EquipmentFormData } from "@/components/admin/EquipmentForm";
import { CmsBlockEditor } from "@/components/admin/CmsBlockEditor";

const SECTION_TITLES: Record<string, string> = {
  bookings: "Bookings",
  dailySlots: "Daily Slots",
  equipment: "Equipment",
  equipmentCategories: "Equipment Categories",
  equipmentGroups: "Equipment Groups",
  holidays: "Holidays",
  repeatSampleRequests: "Repeat sample requests",
  departments: "Departments",
  projects: "Projects",
  subWalletTransactions: "Sub-Wallet Transactions",
  subWallets: "Sub-Wallets",
  userDocuments: "User Documents",
  userGroupMembers: "User Group Members",
  userGroups: "User Groups",
  users: "Users",
  walletRazorpayOrders: "Wallet Razorpay Orders",
  walletRechargeRequests: "Wallet Recharge Requests",
  wallets: "Wallets",
  cmsMenu: "Menu (CMS)",
  cmsPages: "Pages (CMS)",
  cmsHome: "Home Page Content (CMS)",
};

/** Which field to use as row id for update/delete (varies by model). */
const SECTION_ID_FIELD: Record<string, string> = {
  bookings: "booking_id",
  equipment: "equipment_id",
  dailySlots: "id",
  equipmentCategories: "id",
  equipmentGroups: "equipment_group_id",
  holidays: "id",
  repeatSampleRequests: "id",
  departments: "id",
  projects: "id",
  subWalletTransactions: "id",
  subWallets: "id",
  userDocuments: "id",
  userGroupMembers: "id",
  userGroups: "id",
  users: "id",
  walletRazorpayOrders: "id",
  walletRechargeRequests: "id",
  wallets: "id",
  cmsMenu: "id",
  cmsPages: "id",
  cmsHome: "id",
};

/** Daily slot status options (matches Django admin /admin/equipment/dailyslot/). */
const DAILY_SLOT_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "AVAILABLE", label: "Available" },
  { value: "BOOKED", label: "Booked" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "UNDER_MAINTENANCE", label: "Under Maintenance" },
  { value: "OPERATOR_ABSENT", label: "Operator Absent" },
];

/** Booking status options (matches Django admin /admin/equipment/booking/). */
const BOOKING_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "PENDING", label: "Pending" },
  { value: "BOOKED", label: "Booked" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "ABSENT", label: "Operator Unavailable" },
  { value: "REFUNDED", label: "Refunded" },
];

/** Equipment status options (matches Django admin /admin/equipment/equipment/ list_filter). */
const EQUIPMENT_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "REPAIR", label: "Repair" },
  { value: "DISPOSED", label: "Disposed" },
  { value: "OTHER", label: "Other" },
];

/** Equipment profile type options (matches Django admin list_filter). */
const EQUIPMENT_PROFILE_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "SAMPLE", label: "Sample-based" },
  { value: "HOUR", label: "Hour-based" },
  { value: "SAMPLE_ELEMENT", label: "Sample + Element" },
  { value: "MULTI_PARAM", label: "Multi-parameter" },
];

/** Department type options (mirrors Django admin/users/department/ – DepartmentType.get_choices()). */
const DEPARTMENT_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "internal", label: "Internal Department" },
  { value: "external", label: "External Department" },
];

/** User type options (mirrors Django admin/users/user/ – UserType.get_choices()). */
const USER_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Officer In Charge" },
  { value: "operator", label: "Lab Incharge" },
  { value: "finance", label: "Accounts In Charge" },
  { value: "student", label: "Student" },
  { value: "individual_student", label: "Individual Student" },
  { value: "faculty", label: "Faculty" },
  { value: "external", label: "Educational Institute" },
  { value: "RND", label: "Govt R&D Organizations" },
  { value: "Industry", label: "Industry" },
  { value: "startup_incubated_iitr", label: "Startup Incubated at IIT Roorkee" },
  { value: "external_startup_msme", label: "External Startup/MSME" },
  { value: "other", label: "Other" },
];

/** User type filter options for manage/section/users (restricted list). */
const USER_TYPE_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Officer In Charge" },
  { value: "operator", label: "Lab Incharge" },
  { value: "finance", label: "Accounts In Charge" },
  { value: "faculty", label: "Faculty" },
  { value: "student", label: "Student" },
  { value: "individual_student", label: "Individual Student" },
  { value: "external", label: "External (Educational Institute)" },
  { value: "RND", label: "Govt R&D Organizations" },
  { value: "Industry", label: "Industry" },
  { value: "startup_incubated_iitr", label: "Startup Incubated at IIT Roorkee" },
  { value: "external_startup_msme", label: "External Startup/MSME" },
  { value: "other", label: "Other" },
  { value: "student|IITR Post Doctoral Fellows", label: "IITR Post Doctoral Fellows" },
  { value: "student|IITR Research Associates in Projects", label: "IITR Research Associates in Projects" },
  { value: "individual_student|IITR Startups", label: "IITR Startups" },
];

export default function AdminSection() {
  const { section } = useParams<{ section: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [list, setList] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userActivateLoadingId, setUserActivateLoadingId] = useState<number | string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  /** Only Admin user_type may manage/update users (Actions / Update). */
  const [isStrictAdmin, setIsStrictAdmin] = useState(false);
  const [menuDocumentFile, setMenuDocumentFile] = useState<File | null>(null);
  const [pagesList, setPagesList] = useState<Record<string, unknown>[]>([]);
  const [fetchUrl, setFetchUrl] = useState("");
  const [fetchUrlLoading, setFetchUrlLoading] = useState(false);
  const [fetchProgress, setFetchProgress] = useState(0);
  const fetchProgressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [listPage, setListPage] = useState(1);
  const [listPagination, setListPagination] = useState<{ count: number; next: string | null; previous: string | null } | null>(null);
  const [dailySlotStatusFilter, setDailySlotStatusFilter] = useState("");
  const [dailySlotDateFilter, setDailySlotDateFilter] = useState("");
  const [dailySlotEquipmentFilter, setDailySlotEquipmentFilter] = useState("");
  const [equipmentListForSlots, setEquipmentListForSlots] = useState<Array<{ equipment_id: number; code: string; name: string }>>([]);
  const [equipmentListForGroups, setEquipmentListForGroups] = useState<Array<{ equipment_id: number; code: string; name: string; equipment_group_id: number | null }>>([]);
  const [equipmentSearchFilter, setEquipmentSearchFilter] = useState("");
  const [equipmentStatusFilter, setEquipmentStatusFilter] = useState("");
  const [equipmentProfileTypeFilter, setEquipmentProfileTypeFilter] = useState("");
  const [equipmentCategoryFilter, setEquipmentCategoryFilter] = useState("");
  const [equipmentGroupFilter, setEquipmentGroupFilter] = useState("");
  const [equipmentCategoriesList, setEquipmentCategoriesList] = useState<Array<{ id: number; name: string; code?: string }>>([]);
  const [equipmentGroupsListForFilter, setEquipmentGroupsListForFilter] = useState<Array<{ equipment_group_id: number; name: string; code: string }>>([]);
  const [bookingStatusFilter, setBookingStatusFilter] = useState("");
  const [bookingDateFilter, setBookingDateFilter] = useState("");
  const [bookingEquipmentFilter, setBookingEquipmentFilter] = useState("");
  const [repeatSampleStatusFilter, setRepeatSampleStatusFilter] = useState("");
  const [repeatSampleDateFromFilter, setRepeatSampleDateFromFilter] = useState("");
  const [repeatSampleDateToFilter, setRepeatSampleDateToFilter] = useState("");
  const [repeatSampleSearchFilter, setRepeatSampleSearchFilter] = useState("");
  const [rejectRepeatId, setRejectRepeatId] = useState<number | null>(null);
  const [rejectRepeatNotes, setRejectRepeatNotes] = useState("");
  const [repeatActionLoading, setRepeatActionLoading] = useState(false);
  const [projectUsersList, setProjectUsersList] = useState<Array<{ id: number; name?: string; email?: string }>>([]);
  const [userDepartmentsList, setUserDepartmentsList] = useState<Array<{ id: number; name: string; code?: string | null; department_type?: string | null }>>([]);
  const [userTypeFilter, setUserTypeFilter] = useState("");
  const [emailVerifiedFilter, setEmailVerifiedFilter] = useState("");
  const [adminApprovedFilter, setAdminApprovedFilter] = useState("");
  const [isActiveFilter, setIsActiveFilter] = useState("");
  const [editUserNewPassword, setEditUserNewPassword] = useState("");
  const [editUserNewPasswordConfirm, setEditUserNewPasswordConfirm] = useState("");
  const [editUserPasswordLoading, setEditUserPasswordLoading] = useState(false);
  const [walletsListForSubWallets, setWalletsListForSubWallets] = useState<Array<{ id: number; user_email?: string; user_name?: string }>>([]);
  const [internalDepartmentsList, setInternalDepartmentsList] = useState<Array<{ id: number; name: string; code?: string | null }>>([]);
  const [subWalletCreditDebitOpen, setSubWalletCreditDebitOpen] = useState(false);
  const [subWalletCreditDebitMode, setSubWalletCreditDebitMode] = useState<"credit" | "debit">("credit");
  const [subWalletCreditDebitRow, setSubWalletCreditDebitRow] = useState<Record<string, unknown> | null>(null);
  const [subWalletCreditDebitAmount, setSubWalletCreditDebitAmount] = useState("");
  const [subWalletCreditDebitDescription, setSubWalletCreditDebitDescription] = useState("");
  const [subWalletCreditDebitLoading, setSubWalletCreditDebitLoading] = useState(false);
  const [userDocumentsList, setUserDocumentsList] = useState<Array<{ id: number; document_type: string; file_url: string | null; description?: string; uploaded_at?: string }>>([]);

  // Faculty wallet student bulk discounted charge profile support.
  const [facultyWalletStudents, setFacultyWalletStudents] = useState<
    Array<{
      id: number;
      email: string;
      name: string;
      user_type: string;
      use_discounted_charge_profile: boolean;
    }>
  >([]);
  const [facultyWalletStudentsLoading, setFacultyWalletStudentsLoading] = useState(false);
  const [applyDiscountedChargeProfileToAllWalletStudents, setApplyDiscountedChargeProfileToAllWalletStudents] = useState(false);

  // Equipment scope for discounted charge profile.
  const [discountedEquipmentScopeAll, setDiscountedEquipmentScopeAll] = useState(true);
  const [discountedEquipmentScopeIds, setDiscountedEquipmentScopeIds] = useState<number[]>([]);
  const [discountedEquipmentScopeLoading, setDiscountedEquipmentScopeLoading] = useState(false);
  const [equipmentSimpleList, setEquipmentSimpleList] = useState<Array<{ equipment_id: number; code: string; name: string }>>([]);
  const [equipmentSimpleListLoading, setEquipmentSimpleListLoading] = useState(false);

  const sectionKey = section || "";
  const title = SECTION_TITLES[sectionKey] || sectionKey;
  const idField = SECTION_ID_FIELD[sectionKey] ?? "id";
  const hasEndpoint = sectionKey && ADMIN_SECTION_ENDPOINTS[sectionKey];

  // Allows other pages (e.g. External User Management) to open this page with filters pre-selected.
  // We store them in a ref so the initial fetch can use them immediately.
  const initialUserFiltersRef = useRef<{
    userType?: string;
    emailVerified?: string;
    adminApproved?: string;
    isActive?: string;
  } | null>(null);

  // Auto-refresh users list when any filter changes (no "Apply filters" needed).
  const didInitialUsersFetchRef = useRef(false);

  useEffect(() => {
    if (sectionKey === "users") didInitialUsersFetchRef.current = false;
  }, [sectionKey]);

  useEffect(() => {
    if (sectionKey !== "users") return;
    const initialFilters = (location.state as any)?.initialFilters as
      | { userType?: string; emailVerified?: string; adminApproved?: string; isActive?: string }
      | undefined;
    if (!initialFilters) return;
    initialUserFiltersRef.current = {
      userType: initialFilters.userType != null ? String(initialFilters.userType) : undefined,
      emailVerified: initialFilters.emailVerified != null ? String(initialFilters.emailVerified) : undefined,
      adminApproved: initialFilters.adminApproved != null ? String(initialFilters.adminApproved) : undefined,
      isActive: initialFilters.isActive != null ? String(initialFilters.isActive) : undefined,
    };
    // Clear navigation state so reload/back doesn't keep reapplying it.
    navigate(location.pathname, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionKey]);

  useEffect(() => {
    const check = async () => {
      const token = apiClient.getToken();
      if (!token) {
        navigate("/auth");
        return;
      }
      const userRes = await apiClient.getCurrentUser();
      if (userRes.error || !userRes.data) {
        navigate("/auth");
        return;
      }
      const isAdmin = apiClient.isAdminPanelUser(userRes.data.user_type);
      const roleRes = await apiClient.checkAdminRole(String(userRes.data.id));
      if (!isAdmin && roleRes.data?.is_admin !== true) {
        toast({ title: "Access Denied", variant: "destructive" });
        navigate("/admin");
        return;
      }
      setIsStrictAdmin(String(userRes.data.user_type ?? "").toLowerCase() === "admin");
      setAuthChecked(true);
    };
    check();
  }, [navigate, toast]);

  useEffect(() => {
    if (!authChecked || !hasEndpoint) {
      if (!hasEndpoint && sectionKey) {
        setError("Invalid section");
        setLoading(false);
      }
      return;
    }
    loadList(sectionKey === "dailySlots" || sectionKey === "bookings" || sectionKey === "repeatSampleRequests" ? 1 : undefined);
  }, [authChecked, sectionKey, hasEndpoint]);

  useEffect(() => {
    if (!authChecked || !hasEndpoint) return;
    if (sectionKey !== "users") return;
    // Avoid double-fetch on initial load (including navigation-provided initial filters).
    if (!didInitialUsersFetchRef.current) return;
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userTypeFilter, emailVerifiedFilter, adminApprovedFilter, isActiveFilter, authChecked, sectionKey, hasEndpoint]);

  useEffect(() => {
    if (sectionKey !== "dailySlots" && sectionKey !== "bookings" && sectionKey !== "repeatSampleRequests") setListPagination(null);
  }, [sectionKey]);

  useEffect(() => {
    if (sectionKey === "dailySlots" || sectionKey === "bookings") {
      apiClient.adminList("equipment").then((res) => {
        if (!res.error && Array.isArray(res.data)) {
          const raw = res.data as Array<{ equipment_id?: number; id?: number; code?: string; name?: string }>;
          setEquipmentListForSlots(
            raw.map((e) => ({
              equipment_id: e.equipment_id ?? (e.id as number),
              code: String(e.code ?? ""),
              name: String(e.name ?? e.code ?? ""),
            }))
          );
        } else setEquipmentListForSlots([]);
      });
    }
    if (sectionKey === "equipmentGroups") {
      apiClient.adminList("equipment").then((res) => {
        if (!res.error && Array.isArray(res.data)) {
          const raw = res.data as Array<{ equipment_id?: number; id?: number; code?: string; name?: string; equipment_group_id?: number | null }>;
          setEquipmentListForGroups(
            raw.map((e) => ({
              equipment_id: e.equipment_id ?? (e.id as number),
              code: String(e.code ?? ""),
              name: String(e.name ?? e.code ?? ""),
              equipment_group_id: e.equipment_group_id ?? null,
            }))
          );
        } else setEquipmentListForGroups([]);
      });
    }
    if (sectionKey === "equipment") {
      apiClient.adminList("equipmentCategories").then((res) => {
        if (!res.error && Array.isArray(res.data)) {
          const raw = res.data as Array<{ id?: number; name?: string; code?: string }>;
          setEquipmentCategoriesList(raw.map((c) => ({ id: c.id ?? 0, name: String(c.name ?? ""), code: c.code })));
        } else setEquipmentCategoriesList([]);
      });
      apiClient.adminList("equipmentGroups").then((res) => {
        if (!res.error && Array.isArray(res.data)) {
          const raw = res.data as Array<{ equipment_group_id?: number; name?: string; code?: string }>;
          setEquipmentGroupsListForFilter(
            raw.map((g) => ({
              equipment_group_id: g.equipment_group_id ?? (g as Record<string, unknown>).id as number,
              name: String(g.name ?? ""),
              code: String(g.code ?? ""),
            }))
          );
        } else setEquipmentGroupsListForFilter([]);
      });
    }
    if (sectionKey === "projects" || sectionKey === "wallets") {
      apiClient.adminList("users").then((res) => {
        if (!res.error && Array.isArray(res.data)) {
          const raw = res.data as Array<{ id?: number; name?: string; email?: string }>;
          setProjectUsersList(raw.map((u) => ({ id: u.id ?? 0, name: u.name, email: u.email })));
        } else setProjectUsersList([]);
      });
    }
    if (sectionKey === "users") {
      apiClient.adminList("departments").then((res) => {
        if (!res.error && Array.isArray(res.data)) {
          const raw = res.data as Array<{ id?: number; name?: string; code?: string | null; department_type?: string | null }>;
          setUserDepartmentsList(
            raw.map((d) => ({
              id: d.id ?? 0,
              name: String(d.name ?? ""),
              code: d.code ?? null,
              department_type: d.department_type ?? null,
            }))
          );
        } else setUserDepartmentsList([]);
      });
    }
    if (sectionKey === "subWallets") {
      apiClient.adminList("wallets").then((res) => {
        if (!res.error && Array.isArray(res.data)) {
          const raw = res.data as Array<{ id?: number; user_email?: string; user_name?: string }>;
          setWalletsListForSubWallets(raw.map((w) => ({ id: w.id ?? 0, user_email: w.user_email, user_name: w.user_name })));
        } else setWalletsListForSubWallets([]);
      });
      apiClient.adminList("departments").then((res) => {
        if (!res.error && Array.isArray(res.data)) {
          const raw = res.data as Array<{ id?: number; name?: string; code?: string | null; department_type?: string }>;
          setInternalDepartmentsList(
            raw.filter((d) => d.department_type === "internal").map((d) => ({ id: d.id ?? 0, name: String(d.name ?? ""), code: d.code ?? null }))
          );
        } else setInternalDepartmentsList([]);
      });
    }
  }, [sectionKey]);

  const getDepartmentTypeForUserType = (userTypeRaw: unknown): "internal" | "external" | null => {
    const ut = String(userTypeRaw ?? "").trim();
    if (!ut) return null;
    const key = ut.toLowerCase();
    // Backend user_type codes include: external, RND, Industry, other
    const externalCodes = new Set([
      "external",
      "rnd",
      "industry",
      "other",
      "external_startup_msme",
    ]);
    return externalCodes.has(key) ? "external" : "internal";
  };

  useEffect(() => {
    if (sectionKey === "cmsMenu" && modalOpen) {
      apiClient.adminList("cmsPages").then((res) => {
        if (!res.error && Array.isArray(res.data)) setPagesList(res.data as Record<string, unknown>[]);
        else setPagesList([]);
      });
    }
  }, [sectionKey, modalOpen]);

  useEffect(() => {
    return () => {
      if (fetchProgressIntervalRef.current) {
        clearInterval(fetchProgressIntervalRef.current);
        fetchProgressIntervalRef.current = null;
      }
    };
  }, []);

  const loadList = async (requestedPage?: number) => {
    if (!sectionKey) return;
    setLoading(true);
    setError(null);
    const params: Record<string, string> = {};
    if (sectionKey === "dailySlots" || sectionKey === "bookings" || sectionKey === "repeatSampleRequests") {
      params.page = String(requestedPage ?? listPage);
    }
    if (sectionKey === "dailySlots") {
      if (dailySlotStatusFilter) params.status = dailySlotStatusFilter;
      if (dailySlotDateFilter) params.date = dailySlotDateFilter;
      if (dailySlotEquipmentFilter) params.equipment = dailySlotEquipmentFilter;
    }
    if (sectionKey === "bookings") {
      if (bookingStatusFilter) params.status = bookingStatusFilter;
      if (bookingDateFilter) params.date = bookingDateFilter;
      if (bookingEquipmentFilter) params.equipment = bookingEquipmentFilter;
    }
    if (sectionKey === "repeatSampleRequests") {
      if (repeatSampleStatusFilter) params.status = repeatSampleStatusFilter;
      if (repeatSampleDateFromFilter) params.date_from = repeatSampleDateFromFilter;
      if (repeatSampleDateToFilter) params.date_to = repeatSampleDateToFilter;
      if (repeatSampleSearchFilter) params.search = repeatSampleSearchFilter;
    }
    if (sectionKey === "equipment") {
      if (equipmentSearchFilter) params.search = equipmentSearchFilter;
      if (equipmentStatusFilter) params.status = equipmentStatusFilter;
      if (equipmentProfileTypeFilter) params.profile_type = equipmentProfileTypeFilter;
      if (equipmentCategoryFilter) params.category = equipmentCategoryFilter;
      if (equipmentGroupFilter) params.equipment_group = equipmentGroupFilter;
    }
    if (sectionKey === "users") {
      const initial = initialUserFiltersRef.current;
      const effectiveUserType = (userTypeFilter || initial?.userType || "").trim();
      const effectiveEmailVerified = (emailVerifiedFilter || initial?.emailVerified || "").trim();
      const effectiveAdminApproved = (adminApprovedFilter || initial?.adminApproved || "").trim();
      const effectiveIsActive = (isActiveFilter || initial?.isActive || "").trim();

      if (initial) {
        if (initial.userType != null) setUserTypeFilter(initial.userType);
        if (initial.emailVerified != null) setEmailVerifiedFilter(initial.emailVerified);
        if (initial.adminApproved != null) setAdminApprovedFilter(initial.adminApproved);
        if (initial.isActive != null) setIsActiveFilter(initial.isActive);
        initialUserFiltersRef.current = null;
      }

      if (effectiveUserType) {
        if (effectiveUserType.includes("|")) {
          const [ut, alias] = effectiveUserType.split("|");
          if (ut) params.user_type = ut;
          if (alias) params.user_type_alias = alias;
        } else {
          params.user_type = effectiveUserType;
        }
      } else {
        // Default "All" should include everyone (do not send `restricted` param).
      }
      if (effectiveEmailVerified) params.email_verified = effectiveEmailVerified;
      if (effectiveAdminApproved) params.admin_approved = effectiveAdminApproved;
      if (effectiveIsActive) params.is_active = effectiveIsActive;
    }
    const res = await apiClient.adminList(sectionKey, Object.keys(params).length ? params : undefined);
    if (res.error) {
      setError(res.error);
      setList([]);
      setListPagination(null);
      toast({ title: "Error", description: res.error, variant: "destructive" });
    } else {
      const data = res.data;
      if (data && typeof data === "object" && "results" in data && Array.isArray((data as { results: unknown[] }).results)) {
        const paginated = data as { results: Record<string, unknown>[]; count: number; next: string | null; previous: string | null };
        setList(paginated.results);
        setListPagination({
          count: paginated.count,
          next: paginated.next ?? null,
          previous: paginated.previous ?? null,
        });
        if ((sectionKey === "dailySlots" || sectionKey === "bookings" || sectionKey === "repeatSampleRequests") && requestedPage != null) setListPage(requestedPage);
      } else {
        setList(Array.isArray(data) ? data : []);
        setListPagination(null);
      }
    }
    if (sectionKey === "users" && !didInitialUsersFetchRef.current) {
      didInitialUsersFetchRef.current = true;
    }
    setLoading(false);
  };

  const openCreate = () => {
    setEditingId(null);
    if (sectionKey === "users") {
      setUserDocumentsList([]);
      setFacultyWalletStudents([]);
      setApplyDiscountedChargeProfileToAllWalletStudents(false);
      setFacultyWalletStudentsLoading(false);
      setDiscountedEquipmentScopeAll(true);
      setDiscountedEquipmentScopeIds([]);
      setDiscountedEquipmentScopeLoading(false);
      setEquipmentSimpleList([]);
      setEquipmentSimpleListLoading(false);
    }
    setFormData(
      sectionKey === "departments"
        ? { name: "", code: "", department_type: "internal", description: "" }
        : sectionKey === "wallets"
        ? { user: "" }
        : sectionKey === "projects"
        ? { faculty: "", name: "", project_code: "", agency: "", start_date: "", end_date: "", is_active: true }
        : sectionKey === "users"
        ? { email: "", name: "", password: "", password2: "", user_type: "", user_type_alias: "", emp_id: "", phone_number: "", department: "", use_discounted_charge_profile: false }
        : sectionKey === "holidays"
        ? { date: "", reason: "", is_active: true, color: "#fef3c7" }
        : sectionKey === "cmsMenu"
        ? { label: "", link_type: "internal_anchor", url: "", parent: "", priority: 0, is_active: true, open_in_new_tab: false }
        : sectionKey === "cmsPages"
          ? { title: "", slug: "", content: [], is_published: false }
          : sectionKey === "subWallets"
          ? { wallet: "", department: "" }
          : {}
    );
    setMenuDocumentFile(null);
    setModalOpen(true);
  };

  const openEdit = async (row: Record<string, unknown>) => {
    const id = row[idField];
    if (id === undefined) return;
    setEditingId(id as number | string);
    if (sectionKey === "equipment") {
      const res = await apiClient.adminGet<Record<string, unknown>>("equipment", id as number | string);
      if (res.error || !res.data) {
        toast({ title: "Error", description: res.error ?? "Failed to load equipment", variant: "destructive" });
        return;
      }
      setFormData(res.data);
    } else if (sectionKey === "equipmentGroups") {
      const res = await apiClient.adminGet<Record<string, unknown>>("equipmentGroups", id as number | string);
      if (res.error || !res.data) {
        toast({ title: "Error", description: res.error ?? "Failed to load equipment group", variant: "destructive" });
        return;
      }
      setFormData(res.data);
    } else if (sectionKey === "users") {
      const res = await apiClient.adminGet<Record<string, unknown>>("users", id as number | string);
      if (res.error || !res.data) {
        toast({ title: "Error", description: res.error ?? "Failed to load user", variant: "destructive" });
        return;
      }
      const u = res.data;
      setFormData({
        id: u.id,
        email: u.email ?? "",
        name: u.name ?? "",
        user_type: u.user_type ?? "",
        user_type_alias: u.user_type_alias ?? "",
        emp_id: u.emp_id ?? "",
        phone_number: u.phone_number ?? "",
        department: u.department ?? "",
        email_verified: u.email_verified === true || u.email_verified === "true",
        admin_approved: u.admin_approved === true || u.admin_approved === "true",
        force_inactive: u.force_inactive === true || u.force_inactive === "true",
        is_active: u.is_active === true || u.is_active === "true",
          use_discounted_charge_profile: u.use_discounted_charge_profile === true || u.use_discounted_charge_profile === "true",
      });

        // Load per-equipment scope for Discounted Charge Profile.
        const openedUserTypeStr = String(u.user_type ?? "").trim().toLowerCase();
        setDiscountedEquipmentScopeLoading(true);
        setDiscountedEquipmentScopeAll(true);
        setDiscountedEquipmentScopeIds([]);
        setEquipmentSimpleList([]);
        try {
          const scopeRes = await apiClient.adminGetDiscountedChargeEquipment(id as number | string);
          if (!scopeRes.error && scopeRes.data) {
            const d = scopeRes.data;
            const useDiscounted = !!d.use_discounted_charge_profile;
            setFormData((prev) => ({ ...prev, use_discounted_charge_profile: useDiscounted }));
            if (!useDiscounted && openedUserTypeStr === "faculty") {
              // For faculty bulk-apply UI: default student discount equipment scope to ALL.
              setDiscountedEquipmentScopeAll(true);
              setDiscountedEquipmentScopeIds([]);
            } else {
              setDiscountedEquipmentScopeAll(!!d.apply_all_equipment);
              setDiscountedEquipmentScopeIds(Array.isArray(d.equipment_ids) ? d.equipment_ids.map((x: any) => Number(x)).filter((x: number) => x > 0) : []);
            }
            if (useDiscounted && !d.apply_all_equipment) {
              setEquipmentSimpleListLoading(true);
              const eqRes = await apiClient.adminEquipmentSimpleList();
              if (!eqRes.error && Array.isArray(eqRes.data)) {
                setEquipmentSimpleList(eqRes.data.map((e: any) => ({
                  equipment_id: Number(e.equipment_id),
                  code: String(e.code ?? ""),
                  name: String(e.name ?? ""),
                })));
              }
              setEquipmentSimpleListLoading(false);
            }
          }
        } catch (e: any) {
          toast({ title: "Error", description: e?.message ?? "Failed to load discounted charge equipment scope", variant: "destructive" });
        } finally {
          setDiscountedEquipmentScopeLoading(false);
        }

        // Faculty wallet student list (for discounted profile bulk actions)
        const userTypeStr = String(u.user_type ?? "").trim().toLowerCase();
        if (userTypeStr === "faculty") {
          setFacultyWalletStudentsLoading(true);
          setFacultyWalletStudents([]);
          setApplyDiscountedChargeProfileToAllWalletStudents(false);
          try {
            const studsRes = await apiClient.adminWalletStudentsList(id as number | string);
            if (studsRes.error) {
              toast({ title: "Error", description: studsRes.error, variant: "destructive" });
            } else {
              const students = Array.isArray(studsRes.data?.students) ? studsRes.data?.students : Array.isArray((studsRes as any)?.students) ? (studsRes as any).students : [];
              const mapped = (students as any[]).map((s) => ({
                id: Number(s.id),
                email: String(s.email ?? ""),
                name: String(s.name ?? ""),
                user_type: String(s.user_type ?? ""),
                use_discounted_charge_profile: !!s.use_discounted_charge_profile,
              }));
              setFacultyWalletStudents(mapped);
              setApplyDiscountedChargeProfileToAllWalletStudents(mapped.length > 0 && mapped.every((x) => x.use_discounted_charge_profile));
            }
          } catch (e: any) {
            toast({ title: "Error", description: e?.message ?? "Failed to load wallet students", variant: "destructive" });
          } finally {
            setFacultyWalletStudentsLoading(false);
          }
        } else {
          setFacultyWalletStudents([]);
          setApplyDiscountedChargeProfileToAllWalletStudents(false);
          setFacultyWalletStudentsLoading(false);
        }

      const docRes = await apiClient.adminList("userDocuments", { user: String(id) });
      if (!docRes.error && docRes.data) {
        const raw = docRes.data;
        const docs = Array.isArray(raw) ? raw : (raw && typeof raw === "object" && "results" in raw ? (raw as { results: unknown[] }).results : []);
        setUserDocumentsList((docs as Record<string, unknown>[]).map((d) => ({
          id: Number(d.id),
          document_type: String(d.document_type ?? ""),
          file_url: d.file_url != null ? String(d.file_url) : null,
          description: d.description != null ? String(d.description) : undefined,
          uploaded_at: d.uploaded_at != null ? String(d.uploaded_at) : undefined,
        })));
      } else {
        setUserDocumentsList([]);
      }
    } else {
      setFormData(
        sectionKey === "holidays"
          ? {
              date: row.date != null ? String(row.date).slice(0, 10) : "",
              reason: row.reason != null ? String(row.reason) : "",
              is_active: row.is_active === true || row.is_active === "true",
              color: row.color != null && String(row.color).trim() !== "" ? String(row.color).trim() : "#fef3c7",
            }
          : sectionKey === "projects"
          ? {
              ...row,
              faculty: row.faculty ?? (row.faculty as Record<string, unknown>)?.id ?? "",
              start_date: row.start_date != null ? String(row.start_date).slice(0, 10) : "",
              end_date: row.end_date != null ? String(row.end_date).slice(0, 10) : "",
            }
          : sectionKey === "cmsMenu"
          ? { ...row, parent: (row.parent as Record<string, unknown>)?.id ?? row.parent ?? "" }
          : sectionKey === "cmsPages"
            ? { ...row, content: Array.isArray(row.content) ? row.content : [] }
            : { ...row }
      );
    }
    setMenuDocumentFile(null);
    setModalOpen(true);
  };

  const handleSave = async (payload?: Record<string, unknown>, documentFile?: File | null): Promise<Record<string, unknown> | null> => {
    if (!sectionKey) return null;
    let data: Record<string, unknown> = payload ?? formData;
    if (sectionKey === "cmsMenu" && !documentFile && !menuDocumentFile) {
      const { document: _d, ...rest } = data as { document?: unknown; [k: string]: unknown };
      data = rest;
    }
    if (sectionKey === "dailySlots") {
      data = { status: formData.status ?? "AVAILABLE", blocked_label: formData.blocked_label ?? null };
    }
    if (sectionKey === "equipmentGroups" && editingId !== null) {
      const equipment = (formData.equipment || []) as Array<{ equipment_id: number }>;
      const quotasRaw = (formData.quotas || []) as Array<Record<string, unknown>>;
      const getQuota = (quotaType: string) =>
        quotasRaw.find((q) => String(q.quota_type) === quotaType) ?? {};
      data = {
        name: formData.name,
        code: formData.code,
        description: formData.description ?? "",
        equipment_ids: equipment.map((e) => e.equipment_id),
        quotas: ["WEEKLY", "MONTHLY"].map((quotaType) => {
          const q = getQuota(quotaType);
          return {
            id: q.id,
            quota_type: quotaType,
            internal_individual_quota_minutes: q.internal_individual_quota_minutes ?? 0,
            internal_faculty_quota_minutes: q.internal_faculty_quota_minutes ?? 0,
            external_individual_quota_minutes: q.external_individual_quota_minutes ?? 0,
            external_faculty_quota_minutes: q.external_faculty_quota_minutes ?? 0,
            is_enforced: q.is_enforced ?? true,
          };
        }),
      };
    }
    if (sectionKey === "projects") {
      const facultyId = formData.faculty !== "" && formData.faculty != null ? Number(formData.faculty) : undefined;
      data = {
        faculty: facultyId,
        name: formData.name,
        project_code: formData.project_code,
        agency: formData.agency,
        start_date: formData.start_date && String(formData.start_date).trim() !== "" ? String(formData.start_date).trim() : null,
        end_date: formData.end_date && String(formData.end_date).trim() !== "" ? String(formData.end_date).trim() : null,
        is_active: formData.is_active === true || formData.is_active === "true",
      };
    }
    if (sectionKey === "wallets" && editingId === null) {
      const userId = formData.user !== "" && formData.user != null && formData.user !== undefined ? Number(formData.user) : undefined;
      data = { user: userId };
    }
    if (sectionKey === "subWallets" && editingId === null) {
      const walletId = formData.wallet !== "" && formData.wallet != null && formData.wallet !== undefined ? Number(formData.wallet) : undefined;
      const departmentId = formData.department !== "" && formData.department != null && formData.department !== undefined ? Number(formData.department) : undefined;
      data = { wallet: walletId, department: departmentId };
    }
    if (sectionKey === "users" && editingId === null) {
      const deptId = formData.department !== "" && formData.department != null && formData.department !== undefined ? Number(formData.department) : null;
      data = {
        email: String(formData.email ?? "").trim(),
        name: String(formData.name ?? "").trim(),
        password: formData.password,
        user_type: formData.user_type && String(formData.user_type).trim() !== "" ? String(formData.user_type).trim() : null,
        user_type_alias: formData.user_type === "student" && formData.user_type_alias != null && String(formData.user_type_alias).trim() !== "" ? String(formData.user_type_alias).trim() : null,
        emp_id: formData.emp_id && String(formData.emp_id).trim() !== "" ? String(formData.emp_id).trim() : null,
        phone_number: formData.phone_number && String(formData.phone_number).trim() !== "" ? String(formData.phone_number).trim() : null,
        department: deptId,
      };
    }
    if (sectionKey === "users" && editingId !== null) {
      const deptId = formData.department !== "" && formData.department != null && formData.department !== undefined ? Number(formData.department) : null;
      data = {
        name: String(formData.name ?? "").trim(),
        user_type: formData.user_type && String(formData.user_type).trim() !== "" ? String(formData.user_type).trim() : null,
        user_type_alias: String(formData.user_type ?? "").toLowerCase() === "student"
          ? (formData.user_type_alias != null && String(formData.user_type_alias).trim() !== "" ? String(formData.user_type_alias).trim() : null)
          : null,
        emp_id: formData.emp_id != null && String(formData.emp_id).trim() !== "" ? String(formData.emp_id).trim() : null,
        phone_number: formData.phone_number != null && String(formData.phone_number).trim() !== "" ? String(formData.phone_number).trim() : null,
        department: deptId,
        email_verified: formData.email_verified === true || formData.email_verified === "true",
        admin_approved: formData.admin_approved === true || formData.admin_approved === "true",
        force_inactive: formData.force_inactive === true || formData.force_inactive === "true",
        use_discounted_charge_profile: formData.use_discounted_charge_profile === true || formData.use_discounted_charge_profile === "true",
      };
    }
    setSaving(true);
    let result: Record<string, unknown> | null = null;
    if (sectionKey === "cmsMenu" && (documentFile || (data.link_type === "document" && menuDocumentFile))) {
      const file = documentFile ?? menuDocumentFile;
      if (editingId !== null) {
        const res = await apiClient.adminCmsMenuUpdate(editingId, data, file ?? undefined);
        if (res.error) {
          toast({ title: "Error", description: res.error, variant: "destructive" });
        } else {
          toast({ title: "Saved", description: "Record updated successfully." });
          setModalOpen(false);
          setMenuDocumentFile(null);
          loadList();
          result = (res.data as Record<string, unknown>) ?? null;
        }
      } else {
        const res = await apiClient.adminCmsMenuCreate(data, file ?? undefined);
        if (res.error) {
          toast({ title: "Error", description: res.error, variant: "destructive" });
        } else {
          toast({ title: "Created", description: "Record created successfully." });
          setModalOpen(false);
          setMenuDocumentFile(null);
          loadList();
          result = (res.data as Record<string, unknown>) ?? null;
        }
      }
    } else if (editingId !== null) {
      const res = await apiClient.adminUpdate(sectionKey, editingId, data);
      if (res.error) {
        toast({ title: "Error", description: res.error, variant: "destructive" });
      } else {
        toast({ title: "Saved", description: "Record updated successfully." });
        setModalOpen(false);
        loadList();
        result = (res.data as Record<string, unknown>) ?? null;
      }
    } else {
      const res = await apiClient.adminCreate(sectionKey, data);
      if (res.error) {
        toast({ title: "Error", description: res.error, variant: "destructive" });
      } else {
        toast({ title: "Created", description: "Record created successfully." });
        setModalOpen(false);
        loadList();
        result = (res.data as Record<string, unknown>) ?? null;
      }
    }
    setSaving(false);
    return result;
  };

  const handleUsersUpdateWithDiscountedProfiles = async () => {
    if (editingId == null || sectionKey !== "users") return;
    const userTypeStr = String(formData.user_type ?? "").trim().toLowerCase();
    const useDiscounted = formData.use_discounted_charge_profile === true || formData.use_discounted_charge_profile === "true";
    if (useDiscounted && !discountedEquipmentScopeAll && discountedEquipmentScopeIds.length === 0) {
      toast({ title: "Error", description: "Select at least one equipment or enable “All equipment”.", variant: "destructive" });
      return;
    }
    if (userTypeStr === "faculty") {
      const anyStudentEnabled = facultyWalletStudents.some((s) => s.use_discounted_charge_profile);
      if (anyStudentEnabled && !discountedEquipmentScopeAll && discountedEquipmentScopeIds.length === 0) {
        toast({ title: "Error", description: "Select at least one equipment or enable “All equipment” for student bulk apply.", variant: "destructive" });
        return;
      }
    }

    const deptId = formData.department !== "" && formData.department != null && formData.department !== undefined ? Number(formData.department) : null;
    const userData = {
      name: String(formData.name ?? "").trim(),
      user_type: formData.user_type && String(formData.user_type).trim() !== "" ? String(formData.user_type).trim() : null,
      user_type_alias: String(formData.user_type ?? "").toLowerCase() === "student"
        ? (formData.user_type_alias != null && String(formData.user_type_alias).trim() !== "" ? String(formData.user_type_alias).trim() : null)
        : null,
      emp_id: formData.emp_id != null && String(formData.emp_id).trim() !== "" ? String(formData.emp_id).trim() : null,
      phone_number: formData.phone_number != null && String(formData.phone_number).trim() !== "" ? String(formData.phone_number).trim() : null,
      department: deptId,
      email_verified: formData.email_verified === true || formData.email_verified === "true",
      admin_approved: formData.admin_approved === true || formData.admin_approved === "true",
      force_inactive: formData.force_inactive === true || formData.force_inactive === "true",
      use_discounted_charge_profile: formData.use_discounted_charge_profile === true || formData.use_discounted_charge_profile === "true",
    };

    setSaving(true);
    try {
      const res = await apiClient.adminUpdate("users", editingId, userData);
      if (res.error) {
        toast({ title: "Error", description: res.error, variant: "destructive" });
        return;
      }

      // Persist per-equipment discounted scope.
      const scopeRes = await apiClient.adminSetDiscountedChargeEquipment(editingId, {
        use_discounted_charge_profile: useDiscounted,
        apply_all_equipment: discountedEquipmentScopeAll,
        equipment_ids: discountedEquipmentScopeIds,
      });
      if (scopeRes.error) {
        toast({ title: "Error", description: scopeRes.error, variant: "destructive" });
        return;
      }

      // If editing internal faculty: apply per-student discounted flag for students on their wallet.
      if (userTypeStr === "faculty") {
        if (facultyWalletStudentsLoading) {
          toast({ title: "Please wait", description: "Loading wallet students...", variant: "destructive" });
          return;
        }

        const student_updates = facultyWalletStudents.map((s) => ({
          student_id: s.id,
          use_discounted_charge_profile: s.use_discounted_charge_profile,
        }));

        if (student_updates.length > 0) {
          const bulkRes = await apiClient.adminApplyDiscountedChargeProfileToWalletStudents(editingId, {
            student_updates,
            apply_all_equipment: discountedEquipmentScopeAll,
            equipment_ids: discountedEquipmentScopeIds,
          });
          if (bulkRes.error) {
            toast({ title: "Error", description: bulkRes.error, variant: "destructive" });
            return;
          }
        }
      }

      toast({ title: "Saved", description: "Record updated successfully." });
      setModalOpen(false);
      loadList();
    } finally {
      setSaving(false);
    }
  };

  const handleEquipmentSave = async (
    data: EquipmentFormData,
    options?: { imageFile?: File; videoFile?: File }
  ) => {
    const saved = await handleSave(data as Record<string, unknown>);
    if (saved && (options?.imageFile || options?.videoFile)) {
      const id = (saved.equipment_id ?? editingId) as number | undefined;
      if (id != null && typeof id === "number") {
        if (options.imageFile) {
          const up = await apiClient.uploadEquipmentImage(id, options.imageFile);
          if (up.error) toast({ title: "Image upload failed", description: up.error, variant: "destructive" });
        }
        if (options.videoFile) {
          const up = await apiClient.uploadEquipmentVideo(id, options.videoFile);
          if (up.error) toast({ title: "Video upload failed", description: up.error, variant: "destructive" });
        }
        if (options.imageFile || options.videoFile) loadList();
      }
    }
  };

  const handleDelete = async (row: Record<string, unknown>) => {
    const id = row[idField];
    if (id === undefined) return;
    if (!window.confirm("Delete this record?")) return;
    const res = await apiClient.adminDelete(sectionKey, id as number | string);
    if (res.error) {
      toast({ title: "Error", description: res.error, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Record deleted." });
      loadList();
    }
  };

  if (!hasEndpoint) {
    return (
      <div className="min-h-screen flex flex-col">
        <DashboardHeader />
        <main className="flex-1 container mx-auto px-4 py-8">
          <p className="text-destructive">Invalid section.</p>
          <Button variant="outline" onClick={() => navigate("/admin")}>Back to Admin</Button>
        </main>
      </div>
    );
  }

  const columns = list.length > 0 ? Object.keys(list[0]).filter((k) => typeof list[0][k] !== "object" || list[0][k] === null) : [];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-accent/20">
      <DashboardHeader />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <CardDescription>View, add, edit, and delete records. No Django Admin login required.</CardDescription>
            <div className="flex justify-end">
              {sectionKey !== "repeatSampleRequests" &&
                !(sectionKey === "users" && !isStrictAdmin) && (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {sectionKey === "holidays" && (
              <div className="mb-6 p-4 rounded-lg border bg-muted/30 space-y-3">
                <Label className="text-sm font-medium">Fetch from URL</Label>
                <p className="text-muted-foreground text-sm">
                  Enter a URL to a page with a table that has <strong>Holidays</strong> and <strong>Date</strong> columns (e.g. S. No., Holidays, Date, Days of Week). Rows will be imported as holidays; you can edit them after.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="url"
                    placeholder="https://example.com/holidays"
                    value={fetchUrl}
                    onChange={(e) => setFetchUrl(e.target.value)}
                    className="max-w-md"
                    disabled={fetchUrlLoading}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={fetchUrlLoading || !fetchUrl.trim()}
                    onClick={async () => {
                      const url = fetchUrl.trim();
                      if (!url) return;
                      setFetchUrlLoading(true);
                      setFetchProgress(0);
                      if (fetchProgressIntervalRef.current) {
                        clearInterval(fetchProgressIntervalRef.current);
                        fetchProgressIntervalRef.current = null;
                      }
                      fetchProgressIntervalRef.current = setInterval(() => {
                        setFetchProgress((p) => Math.min(p + 4, 90));
                      }, 150);
                      try {
                        const res = await apiClient.adminHolidaysFetchFromUrl(url);
                        if (fetchProgressIntervalRef.current) {
                          clearInterval(fetchProgressIntervalRef.current);
                          fetchProgressIntervalRef.current = null;
                        }
                        setFetchProgress(100);
                        setTimeout(() => {
                          setFetchUrlLoading(false);
                          setFetchProgress(0);
                        }, 400);
                        if (res.error) {
                          toast({
                            title: "Fetch failed",
                            description: res.error,
                            variant: "destructive",
                          });
                          return;
                        }
                        const data = res.data as { added?: number; skipped?: number; errors?: string[]; year_used?: number };
                        const added = data?.added ?? 0;
                        const skipped = data?.skipped ?? 0;
                        const errs = data?.errors?.length ?? 0;
                        const yearUsed = data?.year_used;
                        toast({
                          title: "Import complete",
                          description: `Added ${added} holiday(s), ${skipped} already existed.${yearUsed != null ? ` Year used: ${yearUsed}.` : ""}${errs ? ` ${errs} date parse warning(s).` : ""}`,
                        });
                        loadList();
                      } catch {
                        if (fetchProgressIntervalRef.current) {
                          clearInterval(fetchProgressIntervalRef.current);
                          fetchProgressIntervalRef.current = null;
                        }
                        setFetchUrlLoading(false);
                        setFetchProgress(0);
                        toast({
                          title: "Fetch failed",
                          description: "Network or unexpected error.",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    {fetchUrlLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Fetch from URL
                  </Button>
                </div>
                {(fetchUrlLoading || fetchProgress > 0) && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {fetchUrlLoading ? "Fetching and importing holidays…" : "Complete"}
                    </p>
                    <Progress value={fetchProgress} className="h-2" />
                  </div>
                )}
              </div>
            )}
            {sectionKey === "equipment" && (
              <div className="mb-6 p-4 rounded-lg border bg-muted/30 space-y-3">
                <Label className="text-sm font-medium">Filters</Label>
                <p className="text-xs text-muted-foreground">Search and filter equipment (mirrors Django admin /admin/equipment/equipment/).</p>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-muted-foreground whitespace-nowrap text-xs">Search</Label>
                    <Input
                      placeholder="Code, name, category, group..."
                      value={equipmentSearchFilter}
                      onChange={(e) => setEquipmentSearchFilter(e.target.value)}
                      className="w-[200px]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-muted-foreground whitespace-nowrap text-xs">Status</Label>
                    <Select
                      value={equipmentStatusFilter || "all"}
                      onValueChange={(v) => setEquipmentStatusFilter(v === "all" ? "" : v)}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {EQUIPMENT_STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-muted-foreground whitespace-nowrap text-xs">Profile type</Label>
                    <Select
                      value={equipmentProfileTypeFilter || "all"}
                      onValueChange={(v) => setEquipmentProfileTypeFilter(v === "all" ? "" : v)}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {EQUIPMENT_PROFILE_TYPE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-muted-foreground whitespace-nowrap text-xs">Category</Label>
                    <Select
                      value={equipmentCategoryFilter || "all"}
                      onValueChange={(v) => setEquipmentCategoryFilter(v === "all" ? "" : v)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="All categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All categories</SelectItem>
                        {equipmentCategoriesList.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>{c.name}{c.code ? ` (${c.code})` : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-muted-foreground whitespace-nowrap text-xs">Equipment group</Label>
                    <Select
                      value={equipmentGroupFilter || "all"}
                      onValueChange={(v) => setEquipmentGroupFilter(v === "all" ? "" : v)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="All groups" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All groups</SelectItem>
                        {equipmentGroupsListForFilter.map((g) => (
                          <SelectItem key={g.equipment_group_id} value={String(g.equipment_group_id)}>{g.name} ({g.code})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => loadList()}
                    disabled={loading}
                  >
                    Apply filters
                  </Button>
                  {(equipmentSearchFilter || equipmentStatusFilter || equipmentProfileTypeFilter || equipmentCategoryFilter || equipmentGroupFilter) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEquipmentSearchFilter("");
                        setEquipmentStatusFilter("");
                        setEquipmentProfileTypeFilter("");
                        setEquipmentCategoryFilter("");
                        setEquipmentGroupFilter("");
                        loadList();
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            )}
            {sectionKey === "users" && (
              <div className="mb-6 p-4 rounded-lg border bg-muted/30 space-y-3">
                <Label className="text-sm font-medium">Filters</Label>
                <p className="text-xs text-muted-foreground">Filter users (mirrors Django admin /admin/users/user/ list filters).</p>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-muted-foreground whitespace-nowrap text-xs">User type</Label>
                    <Select
                      value={userTypeFilter || "all"}
                      onValueChange={(v) => setUserTypeFilter(v === "all" ? "" : v)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {USER_TYPE_FILTER_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-muted-foreground whitespace-nowrap text-xs">Email verified</Label>
                    <Select
                      value={emailVerifiedFilter || "all"}
                      onValueChange={(v) => setEmailVerifiedFilter(v === "all" ? "" : v)}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-muted-foreground whitespace-nowrap text-xs">Admin approved</Label>
                    <Select
                      value={adminApprovedFilter || "all"}
                      onValueChange={(v) => setAdminApprovedFilter(v === "all" ? "" : v)}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-muted-foreground whitespace-nowrap text-xs">Active</Label>
                    <Select
                      value={isActiveFilter || "all"}
                      onValueChange={(v) => setIsActiveFilter(v === "all" ? "" : v)}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(userTypeFilter || emailVerifiedFilter || adminApprovedFilter || isActiveFilter) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setUserTypeFilter("");
                        setEmailVerifiedFilter("");
                        setAdminApprovedFilter("");
                        setIsActiveFilter("");
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            )}
            {sectionKey === "dailySlots" && (
              <div className="mb-6 p-4 rounded-lg border bg-muted/30 space-y-3">
                <Label className="text-sm font-medium">Filters</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-muted-foreground whitespace-nowrap text-xs">Status</Label>
                    <Select
                      value={dailySlotStatusFilter || "all"}
                      onValueChange={(v) => setDailySlotStatusFilter(v === "all" ? "" : v)}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        {DAILY_SLOT_STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-muted-foreground whitespace-nowrap text-xs">Date</Label>
                    <Input
                      type="date"
                      value={dailySlotDateFilter}
                      onChange={(e) => setDailySlotDateFilter(e.target.value)}
                      className="w-[160px]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-muted-foreground whitespace-nowrap text-xs">Equipment</Label>
                    <Select
                      value={dailySlotEquipmentFilter || "all"}
                      onValueChange={(v) => setDailySlotEquipmentFilter(v === "all" ? "" : v)}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="All equipment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All equipment</SelectItem>
                        {equipmentListForSlots.map((eq) => (
                          <SelectItem key={eq.equipment_id} value={String(eq.equipment_id)}>
                            {eq.code} {eq.name ? `– ${eq.name}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setListPage(1);
                      loadList(1);
                    }}
                    disabled={loading}
                  >
                    Apply filters
                  </Button>
                  {(dailySlotStatusFilter || dailySlotDateFilter || dailySlotEquipmentFilter) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDailySlotStatusFilter("");
                        setDailySlotDateFilter("");
                        setDailySlotEquipmentFilter("");
                        setListPage(1);
                        loadList(1);
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            )}
            {sectionKey === "bookings" && (
              <div className="mb-6 p-4 rounded-lg border bg-muted/30 space-y-3">
                <Label className="text-sm font-medium">Filters</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-muted-foreground whitespace-nowrap text-xs">Status</Label>
                    <Select
                      value={bookingStatusFilter || "all"}
                      onValueChange={(v) => setBookingStatusFilter(v === "all" ? "" : v)}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        {BOOKING_STATUS_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-muted-foreground whitespace-nowrap text-xs">Created date</Label>
                    <Input
                      type="date"
                      value={bookingDateFilter}
                      onChange={(e) => setBookingDateFilter(e.target.value)}
                      className="w-[160px]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-muted-foreground whitespace-nowrap text-xs">Equipment</Label>
                    <Select
                      value={bookingEquipmentFilter || "all"}
                      onValueChange={(v) => setBookingEquipmentFilter(v === "all" ? "" : v)}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="All equipment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All equipment</SelectItem>
                        {equipmentListForSlots.map((eq) => (
                          <SelectItem key={eq.equipment_id} value={String(eq.equipment_id)}>
                            {eq.code} {eq.name ? `– ${eq.name}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setListPage(1);
                      loadList(1);
                    }}
                    disabled={loading}
                  >
                    Apply filters
                  </Button>
                  {(bookingStatusFilter || bookingDateFilter || bookingEquipmentFilter) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setBookingStatusFilter("");
                        setBookingDateFilter("");
                        setBookingEquipmentFilter("");
                        setListPage(1);
                        loadList(1);
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            )}
            {sectionKey === "repeatSampleRequests" && (
              <div className="mb-6 p-4 rounded-lg border bg-muted/30 space-y-3">
                <Label className="text-sm font-medium">Filters</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-muted-foreground whitespace-nowrap text-xs">Status</Label>
                    <Select
                      value={repeatSampleStatusFilter || "all"}
                      onValueChange={(v) => setRepeatSampleStatusFilter(v === "all" ? "" : v)}
                    >
                      <SelectTrigger className="w-[140px]">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="PENDING">Pending</SelectItem>
                        <SelectItem value="APPROVED">Approved</SelectItem>
                        <SelectItem value="REJECTED">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-muted-foreground whitespace-nowrap text-xs">From date</Label>
                    <Input
                      type="date"
                      value={repeatSampleDateFromFilter}
                      onChange={(e) => setRepeatSampleDateFromFilter(e.target.value)}
                      className="w-[140px]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-muted-foreground whitespace-nowrap text-xs">To date</Label>
                    <Input
                      type="date"
                      value={repeatSampleDateToFilter}
                      onChange={(e) => setRepeatSampleDateToFilter(e.target.value)}
                      className="w-[140px]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-muted-foreground whitespace-nowrap text-xs">Search</Label>
                    <Input
                      placeholder="Booking ID, email, equipment"
                      value={repeatSampleSearchFilter}
                      onChange={(e) => setRepeatSampleSearchFilter(e.target.value)}
                      className="w-[200px]"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => { setListPage(1); loadList(1); }}
                    disabled={loading}
                  >
                    Apply filters
                  </Button>
                  {(repeatSampleStatusFilter || repeatSampleDateFromFilter || repeatSampleDateToFilter || repeatSampleSearchFilter) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setRepeatSampleStatusFilter("");
                        setRepeatSampleDateFromFilter("");
                        setRepeatSampleDateToFilter("");
                        setRepeatSampleSearchFilter("");
                        setListPage(1);
                        loadList(1);
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            )}
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : error ? (
              <p className="text-destructive">{error}</p>
            ) : list.length === 0 ? (
              <p className="text-muted-foreground">
                {sectionKey === "repeatSampleRequests" ? "No repeat sample requests." : sectionKey === "wallets" ? "No wallets." : sectionKey === "users" ? "No users." : sectionKey === "subWallets" ? "No sub-wallets." : "No records. Click Add to create one."}
              </p>
            ) : (
              <>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      {sectionKey === "repeatSampleRequests" ? (
                        <TableRow>
                          <TableHead>ID</TableHead>
                          <TableHead>Booking</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Equipment</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Requested</TableHead>
                          <TableHead>Responded</TableHead>
                          <TableHead>New booking</TableHead>
                          <TableHead className="w-[140px]">Actions</TableHead>
                        </TableRow>
                      ) : sectionKey === "equipment" ? (
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Profile Type</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Equipment Group</TableHead>
                          <TableHead>Reschedule (hrs)</TableHead>
                          <TableHead>Booking Not Utilize Window (hrs)</TableHead>
                          <TableHead className="w-[120px]">Actions</TableHead>
                        </TableRow>
                      ) : sectionKey === "departments" ? (
                        <TableRow>
                          <TableHead>Department Name</TableHead>
                          <TableHead>Department Code</TableHead>
                          <TableHead>Department Type</TableHead>
                          <TableHead>User Count</TableHead>
                          <TableHead>Equipment Count</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      ) : sectionKey === "wallets" ? (
                        <TableRow>
                          <TableHead>User Email</TableHead>
                          <TableHead>User Name</TableHead>
                          <TableHead>User Type</TableHead>
                          <TableHead>Total Balance</TableHead>
                          <TableHead>Sub-wallets</TableHead>
                        </TableRow>
                      ) : sectionKey === "subWallets" ? (
                        <TableRow>
                          <TableHead>Wallet (User)</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Balance</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="w-[200px]">Actions</TableHead>
                        </TableRow>
                      ) : sectionKey === "users" ? (
                        <TableRow>
                          <TableHead>User Email</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>User Type</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Email Verified</TableHead>
                          <TableHead>Admin Approved</TableHead>
                          <TableHead>Active</TableHead>
                          {isStrictAdmin && <TableHead className="w-[100px]">Actions</TableHead>}
                        </TableRow>
                      ) : (
                        <TableRow>
                        {columns.slice(0, 8).map((col) => (
                          <TableHead key={col}>{col}</TableHead>
                        ))}
                        <TableHead className="w-[120px]">Actions</TableHead>
                      </TableRow>
                      )}
                    </TableHeader>
                    <TableBody>
                      {sectionKey === "repeatSampleRequests"
                        ? list.map((row, idx) => {
                            const id = row.id ?? idx;
                            const status = String(row.status ?? "").toUpperCase();
                            const isPending = status === "PENDING";
                            return (
                              <TableRow key={String(id)}>
                                <TableCell>{row.id != null ? String(row.id) : "—"}</TableCell>
                                <TableCell>{row.virtual_booking_id != null ? String(row.virtual_booking_id) : "—"}</TableCell>
                                <TableCell>{row.user_email != null ? String(row.user_email) : "—"}</TableCell>
                                <TableCell>{row.equipment_code != null ? String(row.equipment_code) : "—"}</TableCell>
                                <TableCell>{row.status_display != null ? String(row.status_display) : String(row.status ?? "—")}</TableCell>
                                <TableCell>{row.requested_at != null ? String(row.requested_at).slice(0, 19).replace("T", " ") : "—"}</TableCell>
                                <TableCell>{row.responded_at != null ? String(row.responded_at).slice(0, 19).replace("T", " ") : "—"}</TableCell>
                                <TableCell>{row.new_virtual_booking_id != null ? String(row.new_virtual_booking_id) : "—"}</TableCell>
                                <TableCell>
                                  {isPending ? (
                                    <div className="flex gap-2">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={repeatActionLoading}
                                        onClick={async () => {
                                          setRepeatActionLoading(true);
                                          const res = await apiClient.adminRepeatSampleRequestApprove(id as number);
                                          setRepeatActionLoading(false);
                                          if (res.error) {
                                            toast({ title: "Error", description: res.error, variant: "destructive" });
                                          } else {
                                            toast({ title: "Approved", description: "Repeat sample request approved; new booking created." });
                                            loadList(listPage);
                                          }
                                        }}
                                      >
                                        Approve
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive"
                                        disabled={repeatActionLoading}
                                        onClick={() => {
                                          setRejectRepeatId(id as number);
                                          setRejectRepeatNotes("");
                                        }}
                                      >
                                        Reject
                                      </Button>
                                    </div>
                                  ) : (
                                    "—"
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        : sectionKey === "equipment"
                        ? list.map((row) => (
                            <TableRow key={row[idField] ?? row.id}>
                              <TableCell>
                                <button
                                  type="button"
                                  onClick={() => openEdit(row)}
                                  className="text-primary font-medium underline underline-offset-2 hover:no-underline text-left"
                                >
                                  {row.code != null && row.code !== "" ? String(row.code) : "—"}
                                </button>
                              </TableCell>
                              <TableCell>
                                <button
                                  type="button"
                                  onClick={() => openEdit(row)}
                                  className="text-primary font-medium underline underline-offset-2 hover:no-underline text-left"
                                >
                                  {row.name != null && row.name !== "" ? String(row.name) : "—"}
                                </button>
                              </TableCell>
                              <TableCell>
                                {row.status_display != null && row.status_display !== ""
                                  ? String(row.status_display)
                                  : row.status != null && row.status !== ""
                                    ? String(row.status)
                                    : "—"}
                              </TableCell>
                              <TableCell>
                                {row.profile_type_display != null && row.profile_type_display !== ""
                                  ? String(row.profile_type_display)
                                  : row.profile_type != null && row.profile_type !== ""
                                    ? String(row.profile_type)
                                    : "—"}
                              </TableCell>
                              <TableCell>
                                {row.category_name != null && row.category_name !== ""
                                  ? String(row.category_name)
                                  : "—"}
                              </TableCell>
                              <TableCell>
                                {row.equipment_group_name != null && row.equipment_group_name !== ""
                                  ? String(row.equipment_group_name)
                                  : "—"}
                              </TableCell>
                              <TableCell>
                                {row.reschedule_hours_threshold != null && row.reschedule_hours_threshold !== ""
                                  ? String(row.reschedule_hours_threshold)
                                  : "—"}
                              </TableCell>
                              <TableCell>
                                {row.booking_not_utilize_window_hours != null && row.booking_not_utilize_window_hours !== ""
                                  ? String(row.booking_not_utilize_window_hours)
                                  : "—"}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleDelete(row)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        : sectionKey === "departments"
                        ? list.map((row) => (
                            <TableRow key={row[idField] ?? row.id}>
                              <TableCell>
                                <button
                                  type="button"
                                  onClick={() => openEdit(row)}
                                  className="text-primary font-medium underline underline-offset-2 hover:no-underline text-left"
                                >
                                  {row.name != null && row.name !== "" ? String(row.name) : "—"}
                                </button>
                              </TableCell>
                              <TableCell>{row.code != null && row.code !== "" ? String(row.code) : "—"}</TableCell>
                              <TableCell>{row.department_type_display != null ? String(row.department_type_display) : (row.department_type != null ? String(row.department_type) : "—")}</TableCell>
                              <TableCell>{row.user_count != null ? String(row.user_count) : "—"}</TableCell>
                              <TableCell>{row.equipment_count != null ? String(row.equipment_count) : "—"}</TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button variant="ghost" size="sm" onClick={() => handleDelete(row)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        : sectionKey === "wallets"
                        ? list.map((row) => (
                            <TableRow key={row[idField] ?? row.id}>
                              <TableCell>{row.user_email != null && row.user_email !== "" ? String(row.user_email) : "—"}</TableCell>
                              <TableCell>{row.user_name != null && row.user_name !== "" ? String(row.user_name) : "—"}</TableCell>
                              <TableCell>{row.user_type_display != null ? String(row.user_type_display) : "—"}</TableCell>
                              <TableCell>
                                <span className="font-semibold text-green-600">
                                  ₹{row.total_balance_display != null ? String(row.total_balance_display) : "0.00"}
                                </span>
                              </TableCell>
                              <TableCell>{row.sub_wallet_count != null ? String(row.sub_wallet_count) : "—"}</TableCell>
                            </TableRow>
                          ))
                        : sectionKey === "subWallets"
                        ? list.map((row) => (
                            <TableRow key={row[idField] ?? row.id}>
                              <TableCell>{row.wallet_user_email != null && row.wallet_user_email !== "" ? String(row.wallet_user_email) : "—"}</TableCell>
                              <TableCell>{row.department_name != null && row.department_name !== "" ? String(row.department_name) : (row.department_code != null ? String(row.department_code) : "—")}</TableCell>
                              <TableCell>
                                <span className="font-semibold text-green-600">
                                  ₹{row.balance != null ? String(row.balance) : "0.00"}
                                </span>
                              </TableCell>
                              <TableCell>{row.created_at != null ? String(row.created_at).slice(0, 10) : "—"}</TableCell>
                              <TableCell>
                                <div className="flex gap-2 flex-wrap">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => {
                                      setSubWalletCreditDebitRow(row);
                                      setSubWalletCreditDebitMode("credit");
                                      setSubWalletCreditDebitAmount("");
                                      setSubWalletCreditDebitDescription("");
                                      setSubWalletCreditDebitOpen(true);
                                    }}
                                  >
                                    Credit
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                    onClick={() => {
                                      setSubWalletCreditDebitRow(row);
                                      setSubWalletCreditDebitMode("debit");
                                      setSubWalletCreditDebitAmount("");
                                      setSubWalletCreditDebitDescription("");
                                      setSubWalletCreditDebitOpen(true);
                                    }}
                                  >
                                    Debit
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleDelete(row)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        : sectionKey === "users"
                        ? list.map((row) => (
                            <TableRow key={row[idField] ?? row.id}>
                              <TableCell>
                                {isStrictAdmin ? (
                                  <button
                                    type="button"
                                    onClick={() => openEdit(row)}
                                    className="text-primary font-medium underline underline-offset-2 hover:no-underline text-left"
                                  >
                                    {row.email != null && row.email !== "" ? String(row.email) : "—"}
                                  </button>
                                ) : (
                                  <span>{row.email != null && row.email !== "" ? String(row.email) : "—"}</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {isStrictAdmin ? (
                                  <button
                                    type="button"
                                    onClick={() => openEdit(row)}
                                    className="text-primary font-medium underline underline-offset-2 hover:no-underline text-left"
                                  >
                                    {row.name != null && row.name !== "" ? String(row.name) : "—"}
                                  </button>
                                ) : (
                                  <span>{row.name != null && row.name !== "" ? String(row.name) : "—"}</span>
                                )}
                              </TableCell>
                              <TableCell>{row.user_type_display != null ? String(row.user_type_display) : (row.user_type != null ? String(row.user_type) : "—")}</TableCell>
                              <TableCell>
                                {row.department_name != null && row.department_name !== ""
                                  ? String(row.department_name)
                                  : row.department_code != null && row.department_code !== ""
                                    ? String(row.department_code)
                                    : "—"}
                              </TableCell>
                              <TableCell>{row.email_verified === true || row.email_verified === "true" ? "Yes" : "No"}</TableCell>
                              <TableCell>{row.admin_approved === true || row.admin_approved === "true" ? "Yes" : "No"}</TableCell>
                              <TableCell>{row.is_active === true || row.is_active === "true" ? "Yes" : "No"}</TableCell>
                              {isStrictAdmin && (
                              <TableCell>
                                <div className="flex gap-2">
                                  {!(row.is_active === true || row.is_active === "true") && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={userActivateLoadingId === (row[idField] ?? row.id)}
                                      onClick={async () => {
                                        const id = (row[idField] ?? row.id) as number | string | undefined;
                                        if (id == null) return;
                                        setUserActivateLoadingId(id);
                                        const res = await apiClient.adminPatch("users", id, {
                                          admin_approved: true,
                                          email_verified: true,
                                          force_inactive: false,
                                          send_activation_email: true,
                                        });
                                        if (res.error) {
                                          toast({ title: "Error", description: res.error, variant: "destructive" });
                                        } else {
                                          toast({ title: "Activated", description: "User is now active." });
                                          loadList();
                                        }
                                        setUserActivateLoadingId(null);
                                      }}
                                    >
                                      {userActivateLoadingId === (row[idField] ?? row.id) ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        "Activate"
                                      )}
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleDelete(row)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                              )}
                            </TableRow>
                          ))
                        : list.map((row, idx) => (
                            <TableRow key={row[idField] ?? idx}>
                              {columns.slice(0, 8).map((col) => (
                                <TableCell key={col}>
                                  {row[col] !== null && row[col] !== undefined
                                    ? String(typeof row[col] === "object" ? JSON.stringify(row[col]) : row[col])
                                    : "—"}
                                </TableCell>
                              ))}
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleDelete(row)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                    </TableBody>
                  </Table>
                </div>
                {(sectionKey === "dailySlots" || sectionKey === "bookings" || sectionKey === "repeatSampleRequests") && listPagination && (
                <div className="flex items-center justify-between gap-3 mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing page {listPage} • Total {listPagination.count}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!listPagination.previous || loading}
                      onClick={() => loadList(Math.max(1, listPage - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!listPagination.next || loading}
                      onClick={() => loadList(listPage + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) { setEditUserNewPassword(""); setEditUserNewPasswordConfirm(""); } setModalOpen(open); }}>
            <DialogContent className={
              sectionKey === "equipment"
                ? "max-w-6xl w-[95vw] max-h-[92vh] overflow-hidden flex flex-col"
                : sectionKey === "equipmentGroups"
                  ? "max-w-4xl max-h-[90vh] overflow-y-auto"
                  : sectionKey === "cmsPages"
                  ? "max-w-5xl w-[90vw] max-h-[90vh] overflow-y-auto"
                  : "max-w-lg max-h-[90vh] overflow-y-auto"
            }>
            <DialogHeader className={sectionKey === "equipment" ? "shrink-0 pb-3 border-b" : undefined}>
              <DialogTitle>{editingId !== null ? "Edit" : "Add"} {title}</DialogTitle>
              <DialogDescription>
                {sectionKey === "equipment"
                  ? "All options match Django Admin: category, equipment group, internal department, visibility group, profile type, status, slot configuration."
                  : sectionKey === "equipmentGroups"
                    ? "Basic info, equipment in this group, and quota configurations (mirrors Django admin /admin/equipment/equipmentgroup/change/)."
                    : sectionKey === "departments"
                    ? "Add or edit a department (mirrors Django admin/users/department/add/)."
                    : sectionKey === "projects"
                    ? "Add or edit a project (mirrors Django admin/users/project/add/). Faculty, name, code, agency, dates, active."
                    : sectionKey === "wallets"
                    ? "Add a wallet for a user (mirrors Django admin/users/wallet/add/)."
                    : sectionKey === "users"
                    ? "Add a user (mirrors Django admin/users/user/add/). Email, name, password, user type, department."
                    : "Fields are sent as-is to the API. Use IDs for foreign keys."}
              </DialogDescription>
            </DialogHeader>
            {sectionKey === "equipment" ? (
              <div className="flex-1 overflow-hidden">
                <EquipmentForm
                  initialData={editingId !== null ? (formData as EquipmentFormData) : undefined}
                  equipmentId={editingId !== null ? (editingId as number) : null}
                  onSave={handleEquipmentSave}
                  onCancel={() => setModalOpen(false)}
                  saving={saving}
                />
              </div>
            ) : sectionKey === "equipmentGroups" ? (
              <>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Basic Information</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-muted-foreground text-xs">Name</Label>
                        <Input
                          value={String(formData.name ?? "")}
                          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                          placeholder="Group name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground text-xs">Code</Label>
                        <Input
                          value={String(formData.code ?? "")}
                          onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
                          placeholder="Unique code"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground text-xs">Description</Label>
                      <textarea
                        className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={String(formData.description ?? "")}
                        onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                        placeholder="Optional description"
                      />
                    </div>
                  </div>
                  {(formData.created_at != null || formData.updated_at != null) && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">Timestamps</Label>
                      <p className="text-xs text-muted-foreground">
                        Created: {formData.created_at != null ? String(formData.created_at).slice(0, 19).replace("T", " ") : "—"} • Updated: {formData.updated_at != null ? String(formData.updated_at).slice(0, 19).replace("T", " ") : "—"}
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Equipment in this group</Label>
                    <p className="text-xs text-muted-foreground">Add or remove equipment. Only equipment with no group or already in this group can be added.</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        value="__add__"
                        onValueChange={(equipmentId) => {
                          if (!equipmentId || equipmentId === "__add__") return;
                          const current = (formData.equipment || []) as Array<{ equipment_id: number; code?: string; name?: string }>;
                          if (current.some((e) => e.equipment_id === Number(equipmentId))) return;
                          const eq = equipmentListForGroups.find((e) => e.equipment_id === Number(equipmentId));
                          if (!eq) return;
                          setFormData((prev) => ({
                            ...prev,
                            equipment: [...((prev.equipment || []) as Array<unknown>), { equipment_id: eq.equipment_id, code: eq.code, name: eq.name }],
                          }));
                        }}
                      >
                        <SelectTrigger className="w-[220px]">
                          <SelectValue placeholder="Select equipment to add" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__add__" disabled>Select equipment to add</SelectItem>
                          {equipmentListForGroups
                            .filter(
                              (e) =>
                                e.equipment_group_id == null || e.equipment_group_id === editingId
                            )
                            .filter(
                              (e) =>
                                !((formData.equipment || []) as Array<{ equipment_id: number }>).some(
                                  (x) => x.equipment_id === e.equipment_id
                                )
                            )
                            .map((e) => (
                              <SelectItem key={e.equipment_id} value={String(e.equipment_id)}>
                                {e.code} – {e.name || "—"}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="rounded-md border divide-y">
                      {((formData.equipment || []) as Array<{ equipment_id: number; code?: string; name?: string; status_display?: string }>).length === 0 ? (
                        <p className="p-3 text-sm text-muted-foreground">No equipment in this group.</p>
                      ) : (
                        ((formData.equipment || []) as Array<{ equipment_id: number; code?: string; name?: string; status_display?: string }>).map((eq) => (
                          <div key={eq.equipment_id} className="flex items-center justify-between gap-2 p-2">
                            <span className="text-sm">
                              <strong>{eq.code}</strong> – {eq.name ?? "—"}
                              {eq.status_display != null ? ` (${eq.status_display})` : ""}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() =>
                                setFormData((prev) => ({
                                  ...prev,
                                  equipment: ((prev.equipment || []) as Array<{ equipment_id: number }>).filter((e) => e.equipment_id !== eq.equipment_id),
                                }))
                              }
                            >
                              Remove
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Quota configurations</Label>
                    <p className="text-xs text-muted-foreground">Weekly and monthly quotas (minutes). Internal vs external, individual vs faculty.</p>
                    <div className="overflow-x-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead className="w-[100px]">Int. individual (min)</TableHead>
                            <TableHead className="w-[100px]">Int. faculty (min)</TableHead>
                            <TableHead className="w-[100px]">Ext. individual (min)</TableHead>
                            <TableHead className="w-[100px]">Ext. faculty (min)</TableHead>
                            <TableHead className="w-[80px]">Enforced</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {["WEEKLY", "MONTHLY"].map((quotaType) => {
                            const row = ((formData.quotas || []) as Array<Record<string, unknown>>).find((q) => String(q.quota_type) === quotaType) ?? {
                              quota_type: quotaType,
                              internal_individual_quota_minutes: 0,
                              internal_faculty_quota_minutes: 0,
                              external_individual_quota_minutes: 0,
                              external_faculty_quota_minutes: 0,
                              is_enforced: true,
                            };
                            return (
                              <TableRow key={quotaType}>
                                <TableCell className="font-medium">{quotaType === "WEEKLY" ? "Weekly" : "Monthly"}</TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={Number(row.internal_individual_quota_minutes ?? 0)}
                                    onChange={(e) =>
                                      setFormData((prev) => {
                                        const quotas = [...((prev.quotas || []) as Array<Record<string, unknown>>)];
                                        const idx = quotas.findIndex((q) => String(q.quota_type) === quotaType);
                                        const val = parseInt(e.target.value, 10) || 0;
                                        if (idx >= 0) quotas[idx] = { ...quotas[idx], internal_individual_quota_minutes: val };
                                        else quotas.push({ quota_type: quotaType, internal_individual_quota_minutes: val, internal_faculty_quota_minutes: 0, external_individual_quota_minutes: 0, external_faculty_quota_minutes: 0, is_enforced: true });
                                        return { ...prev, quotas };
                                      })
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={Number(row.internal_faculty_quota_minutes ?? 0)}
                                    onChange={(e) =>
                                      setFormData((prev) => {
                                        const quotas = [...((prev.quotas || []) as Array<Record<string, unknown>>)];
                                        const idx = quotas.findIndex((q) => String(q.quota_type) === quotaType);
                                        const val = parseInt(e.target.value, 10) || 0;
                                        if (idx >= 0) quotas[idx] = { ...quotas[idx], internal_faculty_quota_minutes: val };
                                        else quotas.push({ quota_type: quotaType, internal_individual_quota_minutes: 0, internal_faculty_quota_minutes: val, external_individual_quota_minutes: 0, external_faculty_quota_minutes: 0, is_enforced: true });
                                        return { ...prev, quotas };
                                      })
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={Number(row.external_individual_quota_minutes ?? 0)}
                                    onChange={(e) =>
                                      setFormData((prev) => {
                                        const quotas = [...((prev.quotas || []) as Array<Record<string, unknown>>)];
                                        const idx = quotas.findIndex((q) => String(q.quota_type) === quotaType);
                                        const val = parseInt(e.target.value, 10) || 0;
                                        if (idx >= 0) quotas[idx] = { ...quotas[idx], external_individual_quota_minutes: val };
                                        else quotas.push({ quota_type: quotaType, internal_individual_quota_minutes: 0, internal_faculty_quota_minutes: 0, external_individual_quota_minutes: val, external_faculty_quota_minutes: 0, is_enforced: true });
                                        return { ...prev, quotas };
                                      })
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={Number(row.external_faculty_quota_minutes ?? 0)}
                                    onChange={(e) =>
                                      setFormData((prev) => {
                                        const quotas = [...((prev.quotas || []) as Array<Record<string, unknown>>)];
                                        const idx = quotas.findIndex((q) => String(q.quota_type) === quotaType);
                                        const val = parseInt(e.target.value, 10) || 0;
                                        if (idx >= 0) quotas[idx] = { ...quotas[idx], external_faculty_quota_minutes: val };
                                        else quotas.push({ quota_type: quotaType, internal_individual_quota_minutes: 0, internal_faculty_quota_minutes: 0, external_individual_quota_minutes: 0, external_faculty_quota_minutes: val, is_enforced: true });
                                        return { ...prev, quotas };
                                      })
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <Checkbox
                                    checked={row.is_enforced === true || row.is_enforced === "true"}
                                    onCheckedChange={(c) =>
                                      setFormData((prev) => {
                                        const quotas = [...((prev.quotas || []) as Array<Record<string, unknown>>)];
                                        const idx = quotas.findIndex((q) => String(q.quota_type) === quotaType);
                                        const val = !!c;
                                        if (idx >= 0) quotas[idx] = { ...quotas[idx], is_enforced: val };
                                        else quotas.push({ quota_type: quotaType, internal_individual_quota_minutes: 0, internal_faculty_quota_minutes: 0, external_individual_quota_minutes: 0, external_faculty_quota_minutes: 0, is_enforced: val });
                                        return { ...prev, quotas };
                                      })
                                    }
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                  <Button onClick={() => handleSave()} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save
                  </Button>
                </DialogFooter>
              </>
            ) : sectionKey === "cmsMenu" ? (
              <>
                <DialogDescription>
                  Add or edit a menu or submenu item. Link to a CMS page, document (PDF), or URL.
                </DialogDescription>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Label</Label>
                    <div className="col-span-3">
                      <Input
                        value={String(formData.label ?? "")}
                        onChange={(e) => setFormData((prev) => ({ ...prev, label: e.target.value }))}
                        placeholder="Menu label"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Link type</Label>
                    <div className="col-span-3">
                      <Select
                        value={String(formData.link_type ?? "internal_anchor")}
                        onValueChange={(v) => setFormData((prev) => ({ ...prev, link_type: v }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Link type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="internal_anchor">Internal anchor (#section)</SelectItem>
                          <SelectItem value="internal_route">Internal route (/path)</SelectItem>
                          <SelectItem value="external_url">External URL</SelectItem>
                          <SelectItem value="trigger">Trigger (e.g. Contact)</SelectItem>
                          <SelectItem value="document">Document (PDF upload)</SelectItem>
                          <SelectItem value="page">CMS page</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {formData.link_type === "page" ? (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right">Page</Label>
                      <div className="col-span-3">
                        <Select
                          value={formData.page === null || formData.page === undefined || formData.page === "" ? "__none__" : String(formData.page)}
                          onValueChange={(v) => setFormData((prev) => ({ ...prev, page: v === "__none__" ? "" : Number(v) }))}
                        >
                          <SelectTrigger><SelectValue placeholder="Select page" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Select page —</SelectItem>
                            {pagesList.map((p) => (
                              <SelectItem key={String(p.id)} value={String(p.id)}>
                                {String(p.title ?? p.slug ?? p.id)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ) : formData.link_type !== "document" ? (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right">URL / path</Label>
                      <div className="col-span-3">
                        <Input
                          value={String(formData.url ?? "")}
                          onChange={(e) => setFormData((prev) => ({ ...prev, url: e.target.value }))}
                          placeholder="#section or /path or https://..."
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right">PDF / document</Label>
                      <div className="col-span-3">
                        <Input
                          type="file"
                          accept=".pdf,application/pdf"
                          onChange={(e) => setMenuDocumentFile(e.target.files?.[0] ?? null)}
                        />
                        {editingId !== null && !menuDocumentFile && formData.document ? (
                          <p className="text-xs text-muted-foreground mt-1">Current file attached. Choose a new file to replace.</p>
                        ) : null}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Parent (submenu of)</Label>
                    <div className="col-span-3">
                      <Select
                        value={formData.parent === null || formData.parent === undefined || formData.parent === "" ? "__none__" : String(formData.parent)}
                        onValueChange={(v) => setFormData((prev) => ({ ...prev, parent: v === "__none__" ? "" : v }))}
                      >
                        <SelectTrigger><SelectValue placeholder="None (top-level)" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None (top-level menu)</SelectItem>
                          {list
                            .filter((item) => item.id !== editingId)
                            .map((item) => (
                              <SelectItem key={String(item.id)} value={String(item.id)}>
                                {String(item.label ?? item.id)}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Priority</Label>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        value={String(formData.priority ?? 0)}
                        onChange={(e) => setFormData((prev) => ({ ...prev, priority: Number(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <div className="col-span-4 flex items-center gap-2">
                      <Checkbox
                        id="cms-is_active"
                        checked={formData.is_active === true || formData.is_active === "true"}
                        onCheckedChange={(c) => setFormData((prev) => ({ ...prev, is_active: !!c }))}
                      />
                      <Label htmlFor="cms-is_active">Active</Label>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <div className="col-span-4 flex items-center gap-2">
                      <Checkbox
                        id="cms-open_in_new_tab"
                        checked={formData.open_in_new_tab === true || formData.open_in_new_tab === "true"}
                        onCheckedChange={(c) => setFormData((prev) => ({ ...prev, open_in_new_tab: !!c }))}
                      />
                      <Label htmlFor="cms-open_in_new_tab">Open in new tab</Label>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => handleSave(undefined, formData.link_type === "document" ? menuDocumentFile : undefined)}
                    disabled={
                      saving ||
                      (formData.link_type === "document" && editingId === null && !menuDocumentFile) ||
                      (formData.link_type === "page" && editingId === null && (formData.page === "" || formData.page === undefined || formData.page === null))
                    }
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save
                  </Button>
                </DialogFooter>
              </>
            ) : sectionKey === "cmsPages" ? (
              <>
                <DialogDescription>
                  Add a page with blocks: heading, paragraph, image, list, quote, divider. Link this page from Menu via link type &quot;CMS page&quot;.
                </DialogDescription>
                <div className="grid gap-4 py-4 max-h-[75vh] overflow-y-auto">
                  <div className="grid grid-cols-[auto_1fr] items-center gap-4">
                    <Label className="text-right whitespace-nowrap">Title</Label>
                    <Input
                      value={String(formData.title ?? "")}
                      onChange={(e) => {
                        const title = e.target.value;
                        setFormData((prev) => ({
                          ...prev,
                          title,
                          slug: prev.slug === undefined || prev.slug === "" ? title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") : prev.slug,
                        }));
                      }}
                      placeholder="Page title"
                    />
                  </div>
                  <div className="grid grid-cols-[auto_1fr] items-center gap-4">
                    <Label className="text-right whitespace-nowrap">Slug (URL)</Label>
                    <Input
                      value={String(formData.slug ?? "")}
                      onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                      placeholder="page-slug"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="cms-page-published"
                      checked={formData.is_published === true || formData.is_published === "true"}
                      onCheckedChange={(c) => setFormData((prev) => ({ ...prev, is_published: !!c }))}
                    />
                    <Label htmlFor="cms-page-published">Published</Label>
                  </div>
                  <div className="grid grid-cols-[auto_1fr] items-start gap-4">
                    <Label className="text-right pt-2 whitespace-nowrap">Content blocks</Label>
                    <div className="min-w-0 w-full">
                      <CmsBlockEditor
                        content={(Array.isArray(formData.content) ? formData.content : []) as Record<string, unknown>[]}
                        onChange={(content) => setFormData((prev) => ({ ...prev, content }))}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                  <Button onClick={() => handleSave()} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save
                  </Button>
                </DialogFooter>
              </>
            ) : sectionKey === "holidays" ? (
              <>
                <DialogDescription>
                  Add or edit a holiday. Date, reason, active flag, and color (shown in weekly calendar). Saturdays and Sundays are treated as holidays automatically.
                </DialogDescription>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right" htmlFor="holiday-date">Date</Label>
                    <div className="col-span-3">
                      <Input
                        id="holiday-date"
                        type="date"
                        value={formData.date != null && formData.date !== undefined ? String(formData.date).slice(0, 10) : ""}
                        onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value || "" }))}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right" htmlFor="holiday-reason">Reason</Label>
                    <div className="col-span-3">
                      <Input
                        id="holiday-reason"
                        value={formData.reason != null && formData.reason !== undefined ? String(formData.reason) : ""}
                        onChange={(e) => setFormData((prev) => ({ ...prev, reason: e.target.value }))}
                        placeholder="e.g. National holiday, Maintenance"
                        maxLength={255}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <div className="col-span-4 flex items-center gap-2">
                      <Checkbox
                        id="holiday-is_active"
                        checked={formData.is_active === true || formData.is_active === "true"}
                        onCheckedChange={(c) => setFormData((prev) => ({ ...prev, is_active: !!c }))}
                      />
                      <Label htmlFor="holiday-is_active">Active</Label>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right" htmlFor="holiday-color">Color</Label>
                    <div className="col-span-3 flex items-center gap-2">
                      <input
                        id="holiday-color"
                        type="color"
                        value={formData.color != null && /^#[0-9A-Fa-f]{6}$/.test(String(formData.color)) ? String(formData.color) : "#fef3c7"}
                        onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))}
                        className="h-9 w-14 cursor-pointer rounded border border-input bg-background"
                      />
                      <Input
                        value={formData.color != null && formData.color !== undefined ? String(formData.color) : "#fef3c7"}
                        onChange={(e) => {
                          const v = e.target.value.trim();
                          setFormData((prev) => ({ ...prev, color: v || "#fef3c7" }));
                        }}
                        placeholder="#fef3c7"
                        className="max-w-[100px] font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => handleSave()}
                    disabled={saving || (formData.date === "" || formData.date === undefined || formData.date === null)}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {editingId !== null ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </>
            ) : sectionKey === "dailySlots" ? (
              <>
                <DialogDescription>
                  Edit daily slot. Change status to match Django admin options (Available, Booked, Blocked, Under Maintenance, Operator Absent).
                </DialogDescription>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">ID</Label>
                    <div className="col-span-3 text-sm text-muted-foreground">{String(formData.id ?? "—")}</div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Date</Label>
                    <div className="col-span-3 text-sm text-muted-foreground">
                      {formData.date != null ? String(formData.date).slice(0, 10) : "—"}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Time</Label>
                    <div className="col-span-3 text-sm text-muted-foreground">
                      {formData.start_datetime != null && formData.end_datetime != null
                        ? `${String(formData.start_datetime).slice(11, 16)} – ${String(formData.end_datetime).slice(11, 16)}`
                        : "—"}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Equipment</Label>
                    <div className="col-span-3 text-sm text-muted-foreground">{String(formData.equipment_code ?? "—")}</div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Status</Label>
                    <div className="col-span-3">
                      <Select
                        value={String(formData.status ?? "AVAILABLE")}
                        onValueChange={(v) => setFormData((prev) => ({ ...prev, status: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {DAILY_SLOT_STATUS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right" htmlFor="dailyslot-blocked_label">Blocked label (optional)</Label>
                    <div className="col-span-3">
                      <Input
                        id="dailyslot-blocked_label"
                        value={formData.blocked_label != null ? String(formData.blocked_label) : ""}
                        onChange={(e) => setFormData((prev) => ({ ...prev, blocked_label: e.target.value || null }))}
                        placeholder="e.g. Maintenance, Operator Training"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                  <Button onClick={() => handleSave()} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save
                  </Button>
                </DialogFooter>
              </>
            ) : sectionKey === "cmsHome" ? (
              <>
                <DialogDescription>
                  Edit home page text. Optionally set a font size for this key (e.g. 16px, 1.2rem, 120%). Leave blank for default.
                </DialogDescription>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Key</Label>
                    <div className="col-span-3">
                      <Input value={String(formData.key ?? "")} readOnly disabled className="bg-muted" />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Value</Label>
                    <div className="col-span-3">
                      <Input
                        value={formData.value !== null && formData.value !== undefined ? String(formData.value) : ""}
                        onChange={(e) => setFormData((prev) => ({ ...prev, value: e.target.value }))}
                        placeholder="Content text"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Font size</Label>
                    <div className="col-span-3">
                      <Input
                        value={formData.font_size !== null && formData.font_size !== undefined ? String(formData.font_size) : ""}
                        onChange={(e) => setFormData((prev) => ({ ...prev, font_size: e.target.value }))}
                        placeholder="e.g. 16px, 1.2rem, 120%"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                  <Button onClick={() => handleSave()} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save
                  </Button>
                </DialogFooter>
              </>
            ) : sectionKey === "departments" ? (
              <>
                <DialogDescription>
                  Add or edit a department (mirrors Django admin/users/department/add/). Name and code must be unique.
                </DialogDescription>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right" htmlFor="dept-name">Department name</Label>
                    <div className="col-span-3">
                      <Input
                        id="dept-name"
                        value={String(formData.name ?? "")}
                        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="Name of the department"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right" htmlFor="dept-code">Department code</Label>
                    <div className="col-span-3">
                      <Input
                        id="dept-code"
                        value={String(formData.code ?? "")}
                        onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value }))}
                        placeholder="Short code (optional)"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Department type</Label>
                    <div className="col-span-3">
                      <Select
                        value={String(formData.department_type ?? "internal")}
                        onValueChange={(v) => setFormData((prev) => ({ ...prev, department_type: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          {DEPARTMENT_TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right" htmlFor="dept-description">Description</Label>
                    <div className="col-span-3">
                      <textarea
                        id="dept-description"
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={String(formData.description ?? "")}
                        onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                        placeholder="Optional description"
                      />
                    </div>
                  </div>
                  {(formData.created_at != null || formData.updated_at != null) && (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right text-muted-foreground">Timestamps</Label>
                      <div className="col-span-3 text-sm text-muted-foreground">
                        Created: {formData.created_at != null ? String(formData.created_at).slice(0, 19).replace("T", " ") : "—"} • Updated: {formData.updated_at != null ? String(formData.updated_at).slice(0, 19).replace("T", " ") : "—"}
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => handleSave()}
                    disabled={saving || !String(formData.name ?? "").trim()}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {editingId !== null ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </>
            ) : sectionKey === "projects" ? (
              <>
                <DialogDescription>
                  Add or edit a project (mirrors Django admin/users/project/add/). Faculty owns the project; name, code, agency, and optional dates.
                </DialogDescription>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right" htmlFor="project-faculty">Faculty</Label>
                    <div className="col-span-3">
                      <Select
                        value={formData.faculty !== null && formData.faculty !== undefined && formData.faculty !== "" ? String(formData.faculty) : "__none__"}
                        onValueChange={(v) => setFormData((prev) => ({ ...prev, faculty: v === "__none__" ? "" : Number(v) }))}
                      >
                        <SelectTrigger id="project-faculty">
                          <SelectValue placeholder="Select faculty (user)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Select faculty —</SelectItem>
                          {projectUsersList.map((u) => (
                            <SelectItem key={u.id} value={String(u.id)}>
                              {u.name ? `${u.name} (${u.email ?? u.id})` : String(u.email ?? u.id)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right" htmlFor="project-name">Project name</Label>
                    <div className="col-span-3">
                      <Input
                        id="project-name"
                        value={String(formData.name ?? "")}
                        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="Name of the research project"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right" htmlFor="project-code">Project code</Label>
                    <div className="col-span-3">
                      <Input
                        id="project-code"
                        value={String(formData.project_code ?? "")}
                        onChange={(e) => setFormData((prev) => ({ ...prev, project_code: e.target.value }))}
                        placeholder="Unique code for the project"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right" htmlFor="project-agency">Funding agency</Label>
                    <div className="col-span-3">
                      <Input
                        id="project-agency"
                        value={String(formData.agency ?? "")}
                        onChange={(e) => setFormData((prev) => ({ ...prev, agency: e.target.value }))}
                        placeholder="Name of the funding agency"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right" htmlFor="project-start">Start date</Label>
                    <div className="col-span-3">
                      <Input
                        id="project-start"
                        type="date"
                        value={formData.start_date != null && formData.start_date !== "" ? String(formData.start_date).slice(0, 10) : ""}
                        onChange={(e) => setFormData((prev) => ({ ...prev, start_date: e.target.value || "" }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right" htmlFor="project-end">End date</Label>
                    <div className="col-span-3">
                      <Input
                        id="project-end"
                        type="date"
                        value={formData.end_date != null && formData.end_date !== "" ? String(formData.end_date).slice(0, 10) : ""}
                        onChange={(e) => setFormData((prev) => ({ ...prev, end_date: e.target.value || "" }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <div className="col-span-4 flex items-center gap-2">
                      <Checkbox
                        id="project-is_active"
                        checked={formData.is_active === true || formData.is_active === "true"}
                        onCheckedChange={(c) => setFormData((prev) => ({ ...prev, is_active: !!c }))}
                      />
                      <Label htmlFor="project-is_active">Is active</Label>
                    </div>
                  </div>
                  {(formData.created_at != null || formData.updated_at != null) && (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right text-muted-foreground">Timestamps</Label>
                      <div className="col-span-3 text-sm text-muted-foreground">
                        Created: {formData.created_at != null ? String(formData.created_at).slice(0, 19).replace("T", " ") : "—"} • Updated: {formData.updated_at != null ? String(formData.updated_at).slice(0, 19).replace("T", " ") : "—"}
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => handleSave()}
                    disabled={
                      saving ||
                      !String(formData.name ?? "").trim() ||
                      !String(formData.project_code ?? "").trim() ||
                      !String(formData.agency ?? "").trim() ||
                      (formData.faculty !== 0 && formData.faculty !== "0" && (formData.faculty === "" || formData.faculty == null))
                    }
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    {editingId !== null ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </>
            ) : sectionKey === "wallets" ? (
              <>
                <DialogDescription>
                  Add a wallet for a user (mirrors Django admin/users/wallet/add/). Select the user who will own the wallet. Total balance will start at ₹0.00. Only users who can have a wallet (e.g. Faculty, Individual Student, External) are eligible.
                </DialogDescription>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right" htmlFor="wallet-user">User</Label>
                    <div className="col-span-3">
                      <Select
                        value={formData.user !== null && formData.user !== undefined && formData.user !== "" ? String(formData.user) : "__none__"}
                        onValueChange={(v) => setFormData((prev) => ({ ...prev, user: v === "__none__" ? "" : Number(v) }))}
                      >
                        <SelectTrigger id="wallet-user">
                          <SelectValue placeholder="Select user" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Select user —</SelectItem>
                          {projectUsersList.map((u) => (
                            <SelectItem key={u.id} value={String(u.id)}>
                              {u.name ? `${u.name} (${u.email ?? u.id})` : String(u.email ?? u.id)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right text-muted-foreground">Total balance</Label>
                    <div className="col-span-3 text-sm text-muted-foreground">
                      New wallet will have total balance <span className="font-semibold text-green-600">₹0.00</span> until sub-wallets are credited.
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => handleSave()}
                    disabled={
                      saving ||
                      (formData.user !== 0 && formData.user !== "0" && (formData.user === "" || formData.user == null))
                    }
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Create
                  </Button>
                </DialogFooter>
              </>
            ) : sectionKey === "subWallets" ? (
              <>
                <DialogDescription>
                  Add a sub-wallet (mirrors Django admin/users/subwallet/add/). Select the wallet and an internal department. The sub-wallet will start with balance ₹0.00. Only one sub-wallet per wallet–department pair.
                </DialogDescription>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right" htmlFor="subwallet-wallet">Wallet</Label>
                    <div className="col-span-3">
                      <Select
                        value={formData.wallet !== null && formData.wallet !== undefined && formData.wallet !== "" ? String(formData.wallet) : "__none__"}
                        onValueChange={(v) => setFormData((prev) => ({ ...prev, wallet: v === "__none__" ? "" : Number(v) }))}
                      >
                        <SelectTrigger id="subwallet-wallet">
                          <SelectValue placeholder="Select wallet (user)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Select wallet —</SelectItem>
                          {walletsListForSubWallets.map((w) => (
                            <SelectItem key={w.id} value={String(w.id)}>
                              {w.user_name ? `${w.user_name} (${w.user_email ?? w.id})` : String(w.user_email ?? w.id)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right" htmlFor="subwallet-department">Department (internal)</Label>
                    <div className="col-span-3">
                      <Select
                        value={formData.department !== null && formData.department !== undefined && formData.department !== "" ? String(formData.department) : "__none__"}
                        onValueChange={(v) => setFormData((prev) => ({ ...prev, department: v === "__none__" ? "" : Number(v) }))}
                      >
                        <SelectTrigger id="subwallet-department">
                          <SelectValue placeholder="Select internal department" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Select department —</SelectItem>
                          {internalDepartmentsList.map((d) => (
                            <SelectItem key={d.id} value={String(d.id)}>
                              {d.name}{d.code ? ` (${d.code})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right text-muted-foreground">Initial balance</Label>
                    <div className="col-span-3 text-sm text-muted-foreground">
                      New sub-wallet will have balance <span className="font-semibold text-green-600">₹0.00</span>. Use credit/debit in Django admin or recharge flow to add funds.
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => handleSave()}
                    disabled={
                      saving ||
                      (formData.wallet !== 0 && formData.wallet !== "0" && (formData.wallet === "" || formData.wallet == null)) ||
                      (formData.department !== 0 && formData.department !== "0" && (formData.department === "" || formData.department == null))
                    }
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Create
                  </Button>
                </DialogFooter>
              </>
            ) : sectionKey === "users" ? (editingId === null ? (
              <>
                <DialogDescription>
                  Add a new user (mirrors Django admin/users/user/add/). Email and password are required. User type and department can be set now or later.
                </DialogDescription>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right" htmlFor="user-email">Email</Label>
                    <div className="col-span-3">
                      <Input
                        id="user-email"
                        type="email"
                        value={String(formData.email ?? "")}
                        onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                        placeholder="user@example.com"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right" htmlFor="user-name">Name</Label>
                    <div className="col-span-3">
                      <Input
                        id="user-name"
                        value={String(formData.name ?? "")}
                        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="Full name"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right" htmlFor="user-password">Password</Label>
                    <div className="col-span-3">
                      <Input
                        id="user-password"
                        type="password"
                        value={String(formData.password ?? "")}
                        onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                        placeholder="Min 8 characters"
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right" htmlFor="user-password2">Confirm password</Label>
                    <div className="col-span-3">
                      <Input
                        id="user-password2"
                        type="password"
                        value={String(formData.password2 ?? "")}
                        onChange={(e) => setFormData((prev) => ({ ...prev, password2: e.target.value }))}
                        placeholder="Repeat password"
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">User type</Label>
                    <div className="col-span-3">
                      <Select
                        value={formData.user_type && String(formData.user_type).trim() !== "" ? String(formData.user_type) : "__none__"}
                        onValueChange={(v) =>
                          setFormData((prev) => {
                            const nextUserType = v === "__none__" ? "" : v;
                            const desiredDeptType = getDepartmentTypeForUserType(nextUserType);
                            const currentDeptId = prev.department;
                            if (desiredDeptType && currentDeptId) {
                              const dept = userDepartmentsList.find((d) => d.id === Number(currentDeptId));
                              if (dept?.department_type && dept.department_type !== desiredDeptType) {
                                return { ...prev, user_type: nextUserType, department: "" };
                              }
                            }
                            return { ...prev, user_type: nextUserType };
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select user type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Select user type —</SelectItem>
                          {USER_TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {String(formData.user_type ?? "").toLowerCase() === "student" && (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right" htmlFor="user-type-alias">User type alias (virtual)</Label>
                      <div className="col-span-3">
                        <Input
                          id="user-type-alias"
                          value={String(formData.user_type_alias ?? "")}
                          onChange={(e) => setFormData((prev) => ({ ...prev, user_type_alias: e.target.value }))}
                          placeholder="e.g. Guest Student (display only; internally IITR Student)"
                        />
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right" htmlFor="user-emp_id">Employee / Student ID</Label>
                    <div className="col-span-3">
                      <Input
                        id="user-emp_id"
                        value={String(formData.emp_id ?? "")}
                        onChange={(e) => setFormData((prev) => ({ ...prev, emp_id: e.target.value }))}
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right" htmlFor="user-phone">Phone number</Label>
                    <div className="col-span-3">
                      <Input
                        id="user-phone"
                        value={String(formData.phone_number ?? "")}
                        onChange={(e) => setFormData((prev) => ({ ...prev, phone_number: e.target.value }))}
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Department</Label>
                    <div className="col-span-3">
                      {(() => {
                        const desiredDeptType = getDepartmentTypeForUserType(formData.user_type);
                        const departmentsFiltered =
                          desiredDeptType == null ? [] : userDepartmentsList.filter((d) => d.department_type === desiredDeptType);
                        return (
                          <Select
                            value={formData.department !== null && formData.department !== undefined && formData.department !== "" ? String(formData.department) : "__none__"}
                            onValueChange={(v) => setFormData((prev) => ({ ...prev, department: v === "__none__" ? "" : Number(v) }))}
                            disabled={desiredDeptType == null}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={desiredDeptType == null ? "Select user type first" : "Optional"} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— No department —</SelectItem>
                              {departmentsFiltered.map((d) => (
                                <SelectItem key={d.id} value={String(d.id)}>
                                  {d.name}{d.code ? ` (${d.code})` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        );
                      })()}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => handleSave()}
                    disabled={
                      saving ||
                      !String(formData.email ?? "").trim() ||
                      !String(formData.password ?? "") ||
                      String(formData.password ?? "") !== String(formData.password2 ?? "") ||
                      (String(formData.password ?? "").length > 0 && String(formData.password).length < 8)
                    }
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Create
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogDescription>
                  Edit user (mirrors Django admin/users/user/[id]/change/). Name, user type, department, and verification flags can be updated. Email is read-only.
                </DialogDescription>
                <div className="grid gap-4 py-4">
                  {userDocumentsList.length > 0 ? (
                    <div className="space-y-2 rounded-lg border p-4 bg-muted/30">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Uploaded documents (KYC / registration)
                      </Label>
                      <ul className="space-y-2">
                        {userDocumentsList.map((doc) => (
                          <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                            <span>
                              {doc.document_type || "Document"}
                              {doc.uploaded_at ? ` · ${new Date(doc.uploaded_at).toLocaleDateString()}` : ""}
                              {doc.description ? ` — ${doc.description}` : ""}
                            </span>
                            {doc.file_url ? (
                              <a
                                href={doc.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary hover:underline"
                              >
                                View / Download
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No documents uploaded by this user.</p>
                  )}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right" htmlFor="user-edit-email">Email</Label>
                    <div className="col-span-3">
                      <Input
                        id="user-edit-email"
                        type="email"
                        value={String(formData.email ?? "")}
                        readOnly
                        className="bg-muted"
                        placeholder="Read-only"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right" htmlFor="user-edit-name">Name</Label>
                    <div className="col-span-3">
                      <Input
                        id="user-edit-name"
                        value={String(formData.name ?? "")}
                        onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="Full name"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">User type</Label>
                    <div className="col-span-3">
                      <Select
                        value={formData.user_type && String(formData.user_type).trim() !== "" ? String(formData.user_type) : "__none__"}
                        onValueChange={(v) =>
                          setFormData((prev) => {
                            const nextUserType = v === "__none__" ? "" : v;
                            const desiredDeptType = getDepartmentTypeForUserType(nextUserType);
                            const currentDeptId = prev.department;
                            if (desiredDeptType && currentDeptId) {
                              const dept = userDepartmentsList.find((d) => d.id === Number(currentDeptId));
                              if (dept?.department_type && dept.department_type !== desiredDeptType) {
                                return { ...prev, user_type: nextUserType, department: "" };
                              }
                            }
                            return { ...prev, user_type: nextUserType };
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select user type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Select user type —</SelectItem>
                          {USER_TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {String(formData.user_type ?? "").toLowerCase() === "student" && (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right" htmlFor="user-edit-type-alias">User type alias (virtual)</Label>
                      <div className="col-span-3">
                        <Input
                          id="user-edit-type-alias"
                          value={String(formData.user_type_alias ?? "")}
                          onChange={(e) => setFormData((prev) => ({ ...prev, user_type_alias: e.target.value }))}
                          placeholder="e.g. Guest Student (display only; internally IITR Student)"
                        />
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right" htmlFor="user-edit-emp_id">Employee / Student ID</Label>
                    <div className="col-span-3">
                      <Input
                        id="user-edit-emp_id"
                        value={String(formData.emp_id ?? "")}
                        onChange={(e) => setFormData((prev) => ({ ...prev, emp_id: e.target.value }))}
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right" htmlFor="user-edit-phone">Phone number</Label>
                    <div className="col-span-3">
                      <Input
                        id="user-edit-phone"
                        value={String(formData.phone_number ?? "")}
                        onChange={(e) => setFormData((prev) => ({ ...prev, phone_number: e.target.value }))}
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Department</Label>
                    <div className="col-span-3">
                      {(() => {
                        const desiredDeptType = getDepartmentTypeForUserType(formData.user_type);
                        const departmentsFiltered =
                          desiredDeptType == null ? [] : userDepartmentsList.filter((d) => d.department_type === desiredDeptType);
                        return (
                          <Select
                            value={formData.department !== null && formData.department !== undefined && formData.department !== "" ? String(formData.department) : "__none__"}
                            onValueChange={(v) => setFormData((prev) => ({ ...prev, department: v === "__none__" ? "" : Number(v) }))}
                            disabled={desiredDeptType == null}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={desiredDeptType == null ? "Select user type first" : "Optional"} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">— No department —</SelectItem>
                              {departmentsFiltered.map((d) => (
                                <SelectItem key={d.id} value={String(d.id)}>
                                  {d.name}{d.code ? ` (${d.code})` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <div className="col-span-4 flex items-center gap-2">
                      <Checkbox
                        id="user-edit-email_verified"
                        checked={formData.email_verified === true || formData.email_verified === "true"}
                        onCheckedChange={(c) => setFormData((prev) => ({ ...prev, email_verified: !!c }))}
                      />
                      <Label htmlFor="user-edit-email_verified">Email verified</Label>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <div className="col-span-4 flex items-center gap-2">
                      <Checkbox
                        id="user-edit-admin_approved"
                        checked={formData.admin_approved === true || formData.admin_approved === "true"}
                        onCheckedChange={(c) => setFormData((prev) => ({ ...prev, admin_approved: !!c }))}
                      />
                      <Label htmlFor="user-edit-admin_approved">Admin approved</Label>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <div className="col-span-4 flex items-center gap-2">
                      <Checkbox
                        id="user-edit-is_active"
                        checked={formData.is_active === true || formData.is_active === "true"}
                        onCheckedChange={(c) =>
                          setFormData((prev) => {
                            const nextActive = !!c;
                            return {
                              ...prev,
                              // Active ON implies approved+verified (per business rule) and not force-inactive.
                              admin_approved: nextActive ? true : prev.admin_approved,
                              email_verified: nextActive ? true : prev.email_verified,
                              force_inactive: nextActive ? false : true,
                              is_active: nextActive,
                            };
                          })
                        }
                      />
                      <Label htmlFor="user-edit-is_active">Active</Label>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 items-center gap-4">
                    <div className="col-span-4 flex items-center gap-2">
                      <Checkbox
                        id="user-edit-use_discounted_charge_profile"
                        checked={formData.use_discounted_charge_profile === true || formData.use_discounted_charge_profile === "true"}
                        onCheckedChange={(c) => setFormData((prev) => ({ ...prev, use_discounted_charge_profile: !!c }))}
                      />
                      <Label htmlFor="user-edit-use_discounted_charge_profile">
                        Use Discounted Charge Profile
                      </Label>
                    </div>
                  </div>

                  {(formData.use_discounted_charge_profile === true || formData.use_discounted_charge_profile === "true") ||
                  String(formData.user_type ?? "").trim().toLowerCase() === "faculty" ? (
                    <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
                      <Label className="text-sm font-medium">Equipment scope</Label>
                      <p className="text-xs text-muted-foreground">
                        Choose which equipment should use discounted charge pricing for this user.
                      </p>

                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="discounted-scope-all-eq"
                          checked={discountedEquipmentScopeAll}
                          onCheckedChange={(c) => {
                            const next = !!c;
                            setDiscountedEquipmentScopeAll(next);
                            if (!next && equipmentSimpleList.length === 0) {
                              setEquipmentSimpleListLoading(true);
                              apiClient
                                .adminEquipmentSimpleList()
                                .then((eqRes) => {
                                  if (!eqRes.error && Array.isArray(eqRes.data)) {
                                    setEquipmentSimpleList(
                                      eqRes.data.map((e: any) => ({
                                        equipment_id: Number(e.equipment_id),
                                        code: String(e.code ?? ""),
                                        name: String(e.name ?? ""),
                                      }))
                                    );
                                  }
                                })
                                .catch(() => {
                                  toast({ title: "Error", description: "Failed to load equipment list.", variant: "destructive" });
                                })
                                .finally(() => setEquipmentSimpleListLoading(false));
                            }
                          }}
                        />
                        <Label htmlFor="discounted-scope-all-eq">All equipment</Label>
                      </div>

                      {!discountedEquipmentScopeAll && (
                        <div className="max-h-56 overflow-y-auto rounded-md border bg-background/60 p-2">
                          {discountedEquipmentScopeLoading ? (
                            <div className="text-sm text-muted-foreground">Loading scope...</div>
                          ) : equipmentSimpleListLoading ? (
                            <div className="text-sm text-muted-foreground">Loading equipment...</div>
                          ) : equipmentSimpleList.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {equipmentSimpleList.map((eq) => {
                                const isChecked = discountedEquipmentScopeIds.includes(eq.equipment_id);
                                return (
                                  <div key={eq.equipment_id} className="flex items-center gap-2">
                                    <Checkbox
                                      id={`discounted-eq-${eq.equipment_id}`}
                                      checked={isChecked}
                                      onCheckedChange={(c) => {
                                        const next = !!c;
                                        setDiscountedEquipmentScopeIds((prev) => {
                                          const set = new Set(prev);
                                          if (next) set.add(eq.equipment_id);
                                          else set.delete(eq.equipment_id);
                                          return Array.from(set.values());
                                        });
                                      }}
                                    />
                                    <Label htmlFor={`discounted-eq-${eq.equipment_id}`} className="font-normal">
                                      {eq.code || eq.name}
                                    </Label>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">
                              No equipment loaded. Turn on “All equipment” or try again.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : null}

                  {String(formData.user_type ?? "").trim().toLowerCase() === "faculty" && (
                    <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
                      <Label className="text-sm font-medium">
                        Faculty wallet students
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Tick to apply the Discounted Charge Profile for these students on this faculty wallet.
                      </p>

                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="faculty-apply-discounted-to-all"
                          checked={applyDiscountedChargeProfileToAllWalletStudents}
                          onCheckedChange={(c) => {
                            const next = !!c;
                            setApplyDiscountedChargeProfileToAllWalletStudents(next);
                            setFacultyWalletStudents((prev) => prev.map((s) => ({ ...s, use_discounted_charge_profile: next })));
                          }}
                        />
                        <Label htmlFor="faculty-apply-discounted-to-all">
                          Apply to all wallet students
                        </Label>
                      </div>

                      {facultyWalletStudentsLoading ? (
                        <div className="text-sm text-muted-foreground">Loading wallet students...</div>
                      ) : facultyWalletStudents.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Student</TableHead>
                              <TableHead className="w-64">Discounted charge profile</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {facultyWalletStudents.map((s) => (
                              <TableRow key={s.id}>
                                <TableCell>
                                  <div className="font-medium">{s.name || s.email}</div>
                                  <div className="text-xs text-muted-foreground">{s.email}</div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      id={`student-discount-${s.id}`}
                                      checked={s.use_discounted_charge_profile}
                                      onCheckedChange={(c) => {
                                        const next = !!c;
                                        setFacultyWalletStudents((prev) => {
                                          const updated = prev.map((x) =>
                                            x.id === s.id ? { ...x, use_discounted_charge_profile: next } : x
                                          );
                                          const all = updated.length > 0 && updated.every((x) => x.use_discounted_charge_profile);
                                          setApplyDiscountedChargeProfileToAllWalletStudents(all);
                                          return updated;
                                        });
                                      }}
                                    />
                                    <Label htmlFor={`student-discount-${s.id}`} className="font-normal">
                                      {s.use_discounted_charge_profile ? "Enabled" : "Disabled"}
                                    </Label>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          No approved wallet students found for this faculty.
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
                    <Label className="text-sm font-medium">Reset password</Label>
                    <p className="text-xs text-muted-foreground">
                      Set a new password for this user (mirrors Django admin /admin/users/user/[id]/password/). Min 8 characters; Django password rules apply.
                    </p>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right" htmlFor="user-edit-new-password">New password</Label>
                      <div className="col-span-3">
                        <Input
                          id="user-edit-new-password"
                          type="password"
                          value={editUserNewPassword}
                          onChange={(e) => setEditUserNewPassword(e.target.value)}
                          placeholder="Min 8 characters"
                          autoComplete="new-password"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label className="text-right" htmlFor="user-edit-new-password-confirm">Confirm password</Label>
                      <div className="col-span-3">
                        <Input
                          id="user-edit-new-password-confirm"
                          type="password"
                          value={editUserNewPasswordConfirm}
                          onChange={(e) => setEditUserNewPasswordConfirm(e.target.value)}
                          placeholder="Repeat new password"
                          autoComplete="new-password"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={
                          editUserPasswordLoading ||
                          editUserNewPassword.length < 8 ||
                          editUserNewPassword !== editUserNewPasswordConfirm
                        }
                        onClick={async () => {
                          if (editingId == null || sectionKey !== "users") return;
                          if (editUserNewPassword.length < 8 || editUserNewPassword !== editUserNewPasswordConfirm) return;
                          setEditUserPasswordLoading(true);
                          const res = await apiClient.adminUserSetPassword(editingId, {
                            password: editUserNewPassword,
                            password_confirm: editUserNewPasswordConfirm,
                          });
                          setEditUserPasswordLoading(false);
                          if (res.error) {
                            toast({ title: "Error", description: res.error, variant: "destructive" });
                            return;
                          }
                          toast({ title: "Password set", description: "The user's password has been updated." });
                          setEditUserNewPassword("");
                          setEditUserNewPasswordConfirm("");
                        }}
                      >
                        {editUserPasswordLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Set password
                      </Button>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
                  {isStrictAdmin && (
                  <Button
                    onClick={() => handleUsersUpdateWithDiscountedProfiles()}
                    disabled={saving || !String(formData.name ?? "").trim()}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Update
                  </Button>
                  )}
                </DialogFooter>
              </>
            )) : (
              <>
            <div className="grid gap-4 py-4">
              {Object.keys(formData).length === 0 && editingId === null ? (
                <p className="text-sm text-muted-foreground">Click Save to create with empty data, or add fields below.</p>
              ) : null}
              {Object.entries(formData).map(([key, value]) => (
                <div key={key} className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">{key}</Label>
                  <div className="col-span-3">
                    <Input
                      value={value !== null && value !== undefined ? String(value) : ""}
                      onChange={(e) => setFormData((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder={key}
                    />
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Add field</Label>
                <div className="col-span-3 flex gap-2">
                  <Input
                    id="newFieldName"
                    placeholder="Field name"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const name = (e.target as HTMLInputElement).value.trim();
                        if (name && !formData[name]) {
                          setFormData((prev) => ({ ...prev, [name]: "" }));
                          (e.target as HTMLInputElement).value = "";
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save
              </Button>
            </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
        <Dialog open={subWalletCreditDebitOpen} onOpenChange={(open) => { if (!open) { setSubWalletCreditDebitRow(null); setSubWalletCreditDebitAmount(""); setSubWalletCreditDebitDescription(""); } setSubWalletCreditDebitOpen(open); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{subWalletCreditDebitMode === "credit" ? "Credit" : "Debit"} Sub-Wallet</DialogTitle>
              <DialogDescription>
                {subWalletCreditDebitRow && (
                  <>
                    {subWalletCreditDebitMode === "credit" ? "Add" : "Deduct"} amount to/from{" "}
                    <strong>{String(subWalletCreditDebitRow.department_name ?? subWalletCreditDebitRow.department_code ?? "—")}</strong> for{" "}
                    <strong>{String(subWalletCreditDebitRow.wallet_user_email ?? "—")}</strong>.
                    {subWalletCreditDebitMode === "debit" && (
                      <> Current balance: ₹{subWalletCreditDebitRow.balance != null ? String(subWalletCreditDebitRow.balance) : "0.00"}. Amount must not exceed balance.</>
                    )}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="subwallet-cd-amount">Amount (₹)</Label>
                <Input
                  id="subwallet-cd-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={subWalletCreditDebitAmount}
                  onChange={(e) => setSubWalletCreditDebitAmount(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="subwallet-cd-description">Description (optional)</Label>
                <Input
                  id="subwallet-cd-description"
                  placeholder="e.g. Admin credit / Recharge"
                  value={subWalletCreditDebitDescription}
                  onChange={(e) => setSubWalletCreditDebitDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setSubWalletCreditDebitOpen(false); setSubWalletCreditDebitRow(null); setSubWalletCreditDebitAmount(""); setSubWalletCreditDebitDescription(""); }}>
                Cancel
              </Button>
              <Button
                disabled={
                  subWalletCreditDebitLoading ||
                  !subWalletCreditDebitAmount ||
                  Number(subWalletCreditDebitAmount) < 0.01 ||
                  (subWalletCreditDebitMode === "debit" && subWalletCreditDebitRow != null && Number(subWalletCreditDebitAmount) > Number(subWalletCreditDebitRow.balance ?? 0))
                }
                onClick={async () => {
                  if (!subWalletCreditDebitRow || subWalletCreditDebitRow.id == null) return;
                  const amount = Number(subWalletCreditDebitAmount);
                  if (amount < 0.01) return;
                  if (subWalletCreditDebitMode === "debit" && subWalletCreditDebitRow.balance != null && amount > Number(subWalletCreditDebitRow.balance)) return;
                  setSubWalletCreditDebitLoading(true);
                  const res = subWalletCreditDebitMode === "credit"
                    ? await apiClient.adminSubWalletCredit(subWalletCreditDebitRow.id, { amount, description: subWalletCreditDebitDescription.trim() || undefined })
                    : await apiClient.adminSubWalletDebit(subWalletCreditDebitRow.id, { amount, description: subWalletCreditDebitDescription.trim() || undefined });
                  setSubWalletCreditDebitLoading(false);
                  if (res.error) {
                    toast({ title: "Error", description: res.error, variant: "destructive" });
                    return;
                  }
                  toast({ title: subWalletCreditDebitMode === "credit" ? "Credited" : "Debited", description: res.data?.detail ?? (subWalletCreditDebitMode === "credit" ? "Amount added to sub-wallet." : "Amount deducted from sub-wallet.") });
                  setSubWalletCreditDebitOpen(false);
                  setSubWalletCreditDebitRow(null);
                  setSubWalletCreditDebitAmount("");
                  setSubWalletCreditDebitDescription("");
                  loadList();
                }}
              >
                {subWalletCreditDebitLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {subWalletCreditDebitMode === "credit" ? "Credit" : "Debit"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={rejectRepeatId !== null} onOpenChange={(open) => !open && setRejectRepeatId(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Reject repeat sample request</DialogTitle>
              <DialogDescription>
                Optionally add admin notes (visible to the user). The request will be marked as rejected.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="reject-admin-notes">Admin notes</Label>
                <textarea
                  id="reject-admin-notes"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Optional reason or notes"
                  value={rejectRepeatNotes}
                  onChange={(e) => setRejectRepeatNotes(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setRejectRepeatId(null); setRejectRepeatNotes(""); }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={repeatActionLoading}
                onClick={async () => {
                  if (rejectRepeatId == null) return;
                  setRepeatActionLoading(true);
                  const res = await apiClient.adminRepeatSampleRequestReject(rejectRepeatId, rejectRepeatNotes);
                  setRepeatActionLoading(false);
                  if (res.error) {
                    toast({ title: "Error", description: res.error, variant: "destructive" });
                  } else {
                    toast({ title: "Rejected", description: "Repeat sample request rejected." });
                    setRejectRepeatId(null);
                    setRejectRepeatNotes("");
                    loadList(listPage);
                  }
                }}
              >
                {repeatActionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Reject request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
