import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { formatINR } from "@/lib/money";
import { isExternalBookingUserType } from "@/lib/userTypes";
import { exportWalletTransactionsExcel, exportWalletTransactionsPdf } from "@/lib/walletTransactionExport";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import UserProfile from "@/components/UserProfile";
import { ArrowDown, ArrowUp, Mail, Send, X, Clock, CheckCircle, XCircle, Wallet as WalletIcon, CreditCard, FileText, ChevronDown, ChevronUp, Building2, RefreshCw, Search, User, ExternalLink, Minus, Plus, Loader2, Landmark, Download, FileSpreadsheet, Trash2 } from "lucide-react";
import { toast } from "sonner";
import DashboardHeader from "@/components/DashboardHeader";
import { useAlert } from "@/hooks/use-alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const WALLET_RECHARGE_DRAFT_KEY = "walletRechargeDraft";

type OfflineRechargeMode = "project_grant" | "direct_cash_deposit";

type WalletRechargeDraft = {
  rechargeAmount: string;
  rechargeDepartmentId: number | null;
  selectedProjectId: number | null;
  rechargeType: "sbiepay" | "request";
  otpStep?: "form" | "otp" | "sric";
  studentReceiptUtr?: string;
  offlineRechargeMode?: OfflineRechargeMode;
  cashUndertakingAccepted?: boolean;
};

function saveWalletRechargeDraft(draft: WalletRechargeDraft) {
  try {
    const payload: WalletRechargeDraft = {
      rechargeAmount: draft.rechargeAmount,
      rechargeDepartmentId: draft.rechargeDepartmentId,
      selectedProjectId: draft.selectedProjectId,
      rechargeType: draft.rechargeType,
      studentReceiptUtr: draft.studentReceiptUtr ?? "",
      offlineRechargeMode: draft.offlineRechargeMode,
      cashUndertakingAccepted: Boolean(draft.cashUndertakingAccepted),
    };
    if (draft.otpStep === "form") {
      payload.otpStep = "form";
    }
    sessionStorage.setItem(WALLET_RECHARGE_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
}

function loadWalletRechargeDraft(): WalletRechargeDraft | null {
  try {
    const raw = sessionStorage.getItem(WALLET_RECHARGE_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WalletRechargeDraft;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function clearWalletRechargeDraft() {
  sessionStorage.removeItem(WALLET_RECHARGE_DRAFT_KEY);
  sessionStorage.removeItem("returnToWalletRecharge");
}

type DeptFacultyCreditStatus = {
  id: number | null;
  faculty_user_id: number;
  department_id: number;
  department_name: string;
  status: string;
  status_display: string;
  credit_limit: string;
  department_max_credit_limit?: string;
  wallet_balance: string;
  outstanding_credit: string;
  remaining_credit: string;
  availed_at: string | null;
  closed_at: string | null;
  eligible?: boolean;
  can_avail?: boolean;
  settings_enabled?: boolean;
};

interface Transaction {
  id: number;
  transaction_type: "credit" | "debit";
  amount: string;
  description: string;
  /** Backend: description with Ref first, student suffix removed when redundant */
  description_display?: string;
  created_at: string;
  department_name?: string;
  department_code?: string | null;
  balance_after?: string | null;
  equipment_name?: string | null;
  virtual_booking_id?: string | null;
  related_user_name?: string | null;
  related_user_email?: string | null;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: any) => void;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: {
    color: string;
  };
  modal?: {
    ondismiss: () => void;
  };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: string, handler: (response: any) => void) => void;
}

// Declare Razorpay on window object
declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

const Wallet = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { alert, confirm, AlertComponent, ConfirmComponent } = useAlert();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<number | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [facultyEmail, setFacultyEmail] = useState("");
  const [facultyName, setFacultyName] = useState("");
  const [facultySearchQuery, setFacultySearchQuery] = useState("");
  const [facultySearchResults, setFacultySearchResults] = useState<Array<{
    id: number;
    name: string;
    email: string;
    phone?: string | null;
    profile_picture?: string | null;
    has_wallet: boolean;
    department?: string | null;
    emp_id?: string | null;
  }>>([]);
  const [isSearchingFaculty, setIsSearchingFaculty] = useState(false);
  const [isFacultySelectionLocked, setIsFacultySelectionLocked] = useState(false);
  const facultySearchRequestSeq = useRef(0);
  const [requestMessage, setRequestMessage] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [selectedFacultyJoinRequestIds, setSelectedFacultyJoinRequestIds] = useState<number[]>([]);
  const [selectedFacultyCancelledJoinRequestIds, setSelectedFacultyCancelledJoinRequestIds] = useState<number[]>([]);
  const [bulkJoinActionLoading, setBulkJoinActionLoading] = useState<
    false | "approve" | "reject" | "remove" | "delete"
  >(false);
  const [resendingJoinRequestId, setResendingJoinRequestId] = useState<number | null>(null);
  const [isFaculty, setIsFaculty] = useState(false);
  /** Aligns with backend `is_faculty` / `user_type` so faculty-only wallet flows work after hydration. */
  const isFacultyEffective = useMemo(() => {
    return (
      isFaculty ||
      user?.is_faculty === true ||
      (typeof user?.user_type === "string" && String(user.user_type).toLowerCase() === "faculty") ||
      user?.user_type === 2
    );
  }, [isFaculty, user]);
  const [hasApprovedRequest, setHasApprovedRequest] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [walletOwner, setWalletOwner] = useState<{
    id?: number | null;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    profile_picture?: string | null;
  } | null>(null);
  const [facultyProfile, setFacultyProfile] = useState<{
    id?: number | null;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    profile_picture?: string | null;
    has_wallet?: boolean;
  } | null>(null);
  const [facultyProfileError, setFacultyProfileError] = useState<string | null>(null);
  const [isOtherUser, setIsOtherUser] = useState(false);
  const [isStudent, setIsStudent] = useState(false);
  const [isIndividualStudent, setIsIndividualStudent] = useState(false);
  const [iitrStudentRechargeEnabled, setIitrStudentRechargeEnabled] = useState(false);
  const [showRechargeDialog, setShowRechargeDialog] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [recharging, setRecharging] = useState(false);
  const [rechargeType, setRechargeType] = useState<"sbiepay" | "request">("sbiepay");
  const [offlineRechargeMode, setOfflineRechargeMode] = useState<OfflineRechargeMode>("direct_cash_deposit");
  const [cashUndertakingAccepted, setCashUndertakingAccepted] = useState(false);
  /** When IITR student receipt offline is enabled: choose receipt upload vs cash-deposit OTP. */
  const [studentOfflinePath, setStudentOfflinePath] = useState<"receipt" | "cash">("receipt");
  const [studentReceiptFile, setStudentReceiptFile] = useState<File | null>(null);
  const [studentReceiptUtr, setStudentReceiptUtr] = useState("");
  const [submittingStudentReceipt, setSubmittingStudentReceipt] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [projects, setProjects] = useState<Array<{
    id: number;
    name: string;
    project_code: string;
    agency: string;
    is_active: boolean;
  }>>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [requestingRecharge, setRequestingRecharge] = useState(false);
  const [otpStep, setOtpStep] = useState<"form" | "otp" | "sric">("form");
  const [userOtp, setUserOtp] = useState("");
  const [tempRequestId, setTempRequestId] = useState<number | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [sendingSric, setSendingSric] = useState(false);
  const [rechargeRequests, setRechargeRequests] = useState<any[]>([]);
  const [loadingRechargeRequests, setLoadingRechargeRequests] = useState(false);
  const [showRechargeHistory, setShowRechargeHistory] = useState(false);
  const [showTransactionHistoryExpanded, setShowTransactionHistoryExpanded] = useState(false);
  const [resendingNotification, setResendingNotification] = useState<number | null>(null);
  const [subWallets, setSubWallets] = useState<Array<{
    id: number;
    department_id: number;
    department_name: string;
    department_code: string | null;
    balance: string;
    created_at: string;
    updated_at: string;
  }>>([]);
  const [showAllSubWallets, setShowAllSubWallets] = useState(false);
  const SUB_WALLETS_PREVIEW_COUNT = 3;
  const [internalDepartments, setInternalDepartments] = useState<Array<{ id: number; name: string; code: string | null }>>([]);
  const [rechargeDepartmentId, setRechargeDepartmentId] = useState<number | null>(null);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const skipRechargeResetRef = useRef(false);
  const [deptFacultyCreditByDept, setDeptFacultyCreditByDept] = useState<
    Record<number, DeptFacultyCreditStatus>
  >({});
  const [availCreditOpen, setAvailCreditOpen] = useState(false);
  const [availCreditDeptId, setAvailCreditDeptId] = useState<number | null>(null);
  const [availCreditAmount, setAvailCreditAmount] = useState("");
  const [availingCredit, setAvailingCredit] = useState(false);

  // External user withdrawal (bank transfer)
  const [isExternalUser, setIsExternalUser] = useState(false);
  const [bankDetails, setBankDetails] = useState<any | null>(null);
  const [loadingBankDetails, setLoadingBankDetails] = useState(false);
  const [savingBankDetails, setSavingBankDetails] = useState(false);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawNote, setWithdrawNote] = useState("");
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);
  const [loadingWithdrawalRequests, setLoadingWithdrawalRequests] = useState(false);

  const [bankForm, setBankForm] = useState({
    account_holder_name: "",
    bank_name: "",
    account_number: "",
    ifsc_code: "",
    branch_name: "",
    account_type: "",
    upi_id: "",
  });

  // Transaction history filters
  const [txTypeFilter, setTxTypeFilter] = useState<"all" | "credit" | "debit">("all");
  const [txDateFrom, setTxDateFrom] = useState("");
  const [txDateTo, setTxDateTo] = useState("");
  const [txDepartmentFilter, setTxDepartmentFilter] = useState("");
  const [txSearchText, setTxSearchText] = useState("");
  const [txEquipmentFilter, setTxEquipmentFilter] = useState("");
  const [txBookedByFilter, setTxBookedByFilter] = useState("");

  const canShowWalletRecharge = !isShared || (isStudent && iitrStudentRechargeEnabled);
  const isIitrStudentReceiptOffline = isStudent && iitrStudentRechargeEnabled;
  const isProjectGrantMode = offlineRechargeMode === "project_grant";
  const isCashDepositMode = offlineRechargeMode === "direct_cash_deposit";
  const sricDestinationLabel = isCashDepositMode ? "SRIC Bill Section" : "SRIC Office";

  const openRechargeDialog = useCallback((departmentId?: number | null) => {
    skipRechargeResetRef.current = false;
    if (isFacultyEffective) {
      setRechargeType("request");
      setOfflineRechargeMode("project_grant");
    } else {
      setRechargeType("sbiepay");
      setOfflineRechargeMode("direct_cash_deposit");
    }
    setCashUndertakingAccepted(false);
    if (departmentId != null) {
      setRechargeDepartmentId(departmentId);
    }
    setShowRechargeDialog(true);
  }, [isFacultyEffective]);

  useEffect(() => {
    void (async () => {
      const res = await apiClient.getWalletStudentRechargeSettings();
      if (!res.error && res.data) {
        setIitrStudentRechargeEnabled(Boolean(res.data.enabled));
      }
    })();
  }, []);

  useEffect(() => {
    checkAuthAndFetchWallet();
    fetchRechargeRequests();

    const rechargeFromUrl = searchParams.get("recharge");
    if (rechargeFromUrl === "1") {
      const deptRaw = searchParams.get("department_id");
      let deptId: number | null = null;
      if (deptRaw) {
        const parsed = parseInt(deptRaw, 10);
        if (!Number.isNaN(parsed)) {
          deptId = parsed;
        }
      }
      navigate("/wallet", { replace: true });
      setTimeout(() => {
        openRechargeDialog(deptId);
      }, 300);
      return;
    }

    // Check if user returned from profile page and reopen recharge dialog with draft
    const returnToRecharge = sessionStorage.getItem("returnToWalletRecharge");
    if (returnToRecharge === "true") {
      const draft = loadWalletRechargeDraft();
      if (draft) {
        if (typeof draft.rechargeAmount === "string") setRechargeAmount(draft.rechargeAmount);
        if (draft.rechargeDepartmentId != null) setRechargeDepartmentId(draft.rechargeDepartmentId);
        if (draft.selectedProjectId != null) setSelectedProjectId(draft.selectedProjectId);
        if (draft.rechargeType === "sbiepay" || draft.rechargeType === "request") {
          setRechargeType(draft.rechargeType);
        }
        if (draft.offlineRechargeMode === "project_grant" || draft.offlineRechargeMode === "direct_cash_deposit") {
          setOfflineRechargeMode(draft.offlineRechargeMode);
        }
        if (typeof draft.cashUndertakingAccepted === "boolean") {
          setCashUndertakingAccepted(draft.cashUndertakingAccepted);
        }
        if (draft.otpStep === "form") setOtpStep("form");
        if (typeof draft.studentReceiptUtr === "string") setStudentReceiptUtr(draft.studentReceiptUtr);
      }
      clearWalletRechargeDraft();
      skipRechargeResetRef.current = false;
      // Small delay to ensure wallet data is loaded
      setTimeout(() => {
        setShowRechargeDialog(true);
      }, 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount for URL / session restore
  }, []);

  useEffect(() => {
    if (showRechargeDialog && isFacultyEffective) {
      setRechargeType("request");
      setOfflineRechargeMode((prev) => (prev === "direct_cash_deposit" ? prev : "project_grant"));
    }
  }, [showRechargeDialog, isFacultyEffective]);

  useEffect(() => {
    // Fetch active projects if user is faculty
    if (isFacultyEffective) {
      fetchActiveProjects();
    }
  }, [isFacultyEffective]);

  // Refresh projects when recharge dialog opens (in case user added/updated projects from profile)
  useEffect(() => {
    if (showRechargeDialog && isFacultyEffective) {
      fetchActiveProjects();
    }
  }, [showRechargeDialog, isFacultyEffective]);

  // Refresh projects when window regains focus (user navigated back from profile)
  useEffect(() => {
    const handleFocus = () => {
      if (isFacultyEffective && document.visibilityState === 'visible') {
        fetchActiveProjects();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [isFacultyEffective]);

  const fetchRechargeRequests = async () => {
    try {
      setLoadingRechargeRequests(true);
      const response = await apiClient.getWalletRechargeRequests();
      if (response.data) {
        setRechargeRequests(response.data.requests || []);
      }
    } catch (error) {
      console.error("Failed to fetch recharge requests:", error);
    } finally {
      setLoadingRechargeRequests(false);
    }
  };

  const fetchActiveProjects = async () => {
    try {
      setLoadingProjects(true);
      const response = await apiClient.getProjects();
      if (response.data) {
        // Filter only active projects
        const activeProjects = (response.data.projects || []).filter(
          (project: any) => project.is_active && !project.is_expired
        );
        setProjects(activeProjects);
      }
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchDeptFacultyCreditStatus = async () => {
    try {
      const res = await apiClient.getMyDepartmentFacultyCreditFacilityStatus();
      if (res.error || !res.data?.results) {
        setDeptFacultyCreditByDept({});
        return;
      }
      const byDept: Record<number, DeptFacultyCreditStatus> = {};
      for (const row of res.data.results) {
        byDept[row.department_id] = row;
      }
      setDeptFacultyCreditByDept(byDept);
    } catch (error) {
      console.error("Failed to fetch department faculty credit status:", error);
      setDeptFacultyCreditByDept({});
    }
  };

  const goToAddProjectFromRecharge = () => {
    skipRechargeResetRef.current = true;
    saveWalletRechargeDraft({
      rechargeAmount,
      rechargeDepartmentId,
      selectedProjectId,
      rechargeType,
      otpStep: otpStep === "form" ? "form" : undefined,
      studentReceiptUtr,
      offlineRechargeMode,
      cashUndertakingAccepted,
    });
    sessionStorage.setItem("returnToWalletRecharge", "true");
    setShowRechargeDialog(false);
    navigate("/profile#projects");
  };


  // Fetch join requests when request form is shown
  useEffect(() => {
    if (showRequestForm) {
      fetchJoinRequests();
    }
  }, [showRequestForm]);

  // Fetch departments with equipment (valid for sub-wallet recharge) when recharge dialog opens
  useEffect(() => {
    if (showRechargeDialog && internalDepartments.length === 0) {
      setLoadingDepartments(true);
      apiClient.getDepartmentsForRecharge().then((res) => {
        if (res.data?.departments) {
          setInternalDepartments(res.data.departments);
        }
        setLoadingDepartments(false);
      }).catch(() => setLoadingDepartments(false));
    }
  }, [showRechargeDialog]);

  // Auto-select department when exactly one internal department is available
  useEffect(() => {
    if (!showRechargeDialog || internalDepartments.length !== 1) {
      return;
    }
    const onlyId = internalDepartments[0].id;
    setRechargeDepartmentId((prev) => (prev === onlyId ? prev : onlyId));
  }, [showRechargeDialog, internalDepartments]);

  // When several recharge departments exist, default to the sub-wallet with the lowest balance.
  useEffect(() => {
    if (!showRechargeDialog || internalDepartments.length <= 1) return;
    setRechargeDepartmentId((prev) => {
      if (prev != null) return prev;
      const allowedIds = new Set(internalDepartments.map((d) => d.id));
      const candidates = subWallets.filter((sw) => allowedIds.has(sw.department_id));
      if (candidates.length === 0) return prev;
      let best = candidates[0];
      let bestBal = parseFloat(String(best.balance));
      for (let i = 1; i < candidates.length; i++) {
        const b = parseFloat(String(candidates[i].balance));
        if (b < bestBal) {
          bestBal = b;
          best = candidates[i];
        }
      }
      return best.department_id;
    });
  }, [showRechargeDialog, internalDepartments, subWallets]);

  const checkAuthAndFetchWallet = async () => {
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

    setUser(userResponse.data);

    const userTypeRaw: any = userResponse.data?.user_type;
    const userTypeStr = userTypeRaw != null ? String(userTypeRaw).toLowerCase() : "";
    const isExternal = isExternalBookingUserType(userTypeStr);
    setIsExternalUser(isExternal);

    // Check if user can have wallet using the can_have_wallet field
    // Treat undefined/null as false (no wallet access)
    const userCanHaveWallet = userResponse.data?.can_have_wallet === true;
    const userType: any = userResponse.data?.user_type;
    
    // Handle both string and number user_type (API may return either)
    // Regular STUDENT and OTHER users can request to join faculty wallet
    let isStudent = false;
    let isOtherUser = false;
    let isIndividualStudent = false;
    let isFacultyUser = userResponse.data?.is_faculty === true;
    if (userType !== undefined && userType !== null) {
      if (typeof userType === "string") {
        const userTypeLower = userType.toLowerCase();
        isStudent = userTypeLower === "student";
        isOtherUser = userTypeLower === "other";
        isIndividualStudent = userTypeLower === "individual_student";
        isFacultyUser = isFacultyUser || userTypeLower === "faculty";
      } else if (typeof userType === "number") {
        // Assuming 1 = student, 2 = faculty (adjust based on your mapping)
        isStudent = userType === 1;
        isFacultyUser = isFacultyUser || userType === 2;
      }
    }
    setIsFaculty(isFacultyUser);
    setIsOtherUser(isOtherUser);
    setIsStudent(isStudent);
    setIsIndividualStudent(isIndividualStudent);

    // Check if user can request to join faculty wallet (STUDENT or OTHER)
    const canRequestFacultyWallet = isStudent || isOtherUser;


    // If user can request faculty wallet (STUDENT or OTHER) and doesn't have their own wallet,
    // check for approved requests first
    // Individual students have their own wallets, so they don't need to request
    if (!userCanHaveWallet && canRequestFacultyWallet && !isIndividualStudent) {
      // Fetch join requests to check if user has approved request
      const requestsResponse = await apiClient.getWalletJoinRequests();
      if (requestsResponse.data && requestsResponse.data.requests) {
        setJoinRequests(requestsResponse.data.requests);
        const approvedRequest = requestsResponse.data.requests.find(
          (req: any) => req.status === "APPROVED"
        );
        if (approvedRequest) {
          // User has approved request, show wallet
          setHasApprovedRequest(true);
          setShowRequestForm(false);
          setUserId(userResponse.data.id);
          setLoading(false);
          await fetchWalletData();
          return;
        }
      }
      // No approved request, show request form
      setShowRequestForm(true);
      setLoading(false);
      return;
    }

    // For OTHER users: They have their own wallet by default, but can request to join a faculty wallet
    // If they have an approved faculty wallet request, prioritize that over their own wallet
    if (userCanHaveWallet && isOtherUser) {
      setHasApprovedRequest(false); // Reset to false initially
      const requestsResponse = await apiClient.getWalletJoinRequests();
      if (requestsResponse.data && requestsResponse.data.requests) {
        setJoinRequests(requestsResponse.data.requests);
        const approvedRequest = requestsResponse.data.requests.find(
          (req: any) => req.status === "APPROVED"
        );
        if (approvedRequest) {
          // Other user has approved faculty wallet request, use that wallet (prioritized)
          setHasApprovedRequest(true);
          setUserId(userResponse.data.id);
          setLoading(false);
          await fetchWalletData();
          // Still fetch join requests to show them in the UI
          await fetchJoinRequests();
          return;
        }
      }
      // Other user doesn't have approved request - use their own wallet by default
      // They can still request to join a faculty wallet from the wallet page
      setHasApprovedRequest(false); // Ensure it's false so button shows
      setUserId(userResponse.data.id);
      // Fetch wallet data first
      await fetchWalletData();
      // Fetch join requests to show them in the UI
      try {
        await fetchJoinRequests();
      } catch (error) {
        // Continue even if join requests fail
      }
      setLoading(false);
      return; // Return here to avoid duplicate fetching
    }

    // For other cases where wallet is not supported, redirect
    if (!userCanHaveWallet) {
      toast.error("Your account type does not support wallet functionality.");
      navigate("/dashboard");
      return;
    }

    // User has wallet access - fetch wallet data
    setUserId(userResponse.data.id);
    await fetchWalletData();

    // External-only: load bank details + withdrawal requests
    if (isExternal) {
      await Promise.all([fetchBankDetails(), fetchWithdrawalRequests()]);
    }
    
    // Fetch join requests:
    // - For faculty members: they see requests they received
    // - For regular students and Other users: they see requests they sent
    // Individual students have their own wallets, so they don't need join requests
    if (isFacultyUser || (canRequestFacultyWallet && !isIndividualStudent)) {
      await fetchJoinRequests();
    }
    setLoading(false);
  };

  const fetchBankDetails = async () => {
    try {
      setLoadingBankDetails(true);
      const res = await apiClient.getWalletBankDetails();
      if (!res.error) {
        setBankDetails(res.data?.bank_details ?? null);
        const bd = res.data?.bank_details;
        if (bd) {
          setBankForm({
            account_holder_name: bd.account_holder_name || "",
            bank_name: bd.bank_name || "",
            account_number: bd.account_number || "",
            ifsc_code: bd.ifsc_code || "",
            branch_name: bd.branch_name || "",
            account_type: bd.account_type || "",
            upi_id: bd.upi_id || "",
          });
        }
      }
    } finally {
      setLoadingBankDetails(false);
    }
  };

  const fetchWithdrawalRequests = async () => {
    try {
      setLoadingWithdrawalRequests(true);
      const res = await apiClient.getWalletWithdrawalRequests();
      if (!res.error) setWithdrawalRequests(res.data?.requests || []);
    } finally {
      setLoadingWithdrawalRequests(false);
    }
  };

  const handleSaveBankDetails = async () => {
    try {
      setSavingBankDetails(true);
      const res = await apiClient.upsertWalletBankDetails({
        account_holder_name: bankForm.account_holder_name,
        bank_name: bankForm.bank_name,
        account_number: bankForm.account_number,
        ifsc_code: bankForm.ifsc_code,
        branch_name: bankForm.branch_name,
        account_type: bankForm.account_type,
        upi_id: bankForm.upi_id,
      });
      if (res.error) {
        toast.error(res.error || "Failed to save bank details");
        return;
      }
      setBankDetails(res.data?.bank_details ?? null);
      toast.success("Bank details saved");
    } finally {
      setSavingBankDetails(false);
    }
  };

  const handleCreateWithdrawalRequest = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (amount > balance) {
      toast.error("Withdrawal amount cannot exceed wallet balance");
      return;
    }
    try {
      setSubmittingWithdraw(true);
      const res = await apiClient.createWalletWithdrawalRequest(amount, withdrawNote);
      if (res.error) {
        toast.error(res.error || "Failed to create withdrawal request");
        return;
      }
      toast.success("Withdrawal request submitted");
      setShowWithdrawDialog(false);
      setWithdrawAmount("");
      setWithdrawNote("");
      await fetchWalletData();
      await fetchWithdrawalRequests();
    } finally {
      setSubmittingWithdraw(false);
    }
  };


  // Debounced function to search faculty by name
  useEffect(() => {
    if (isFacultySelectionLocked) {
      setFacultySearchResults([]);
      setIsSearchingFaculty(false);
      return;
    }
    const timeoutId = setTimeout(() => {
      if (facultySearchQuery.trim().length >= 2) {
        searchFacultyByName(facultySearchQuery.trim());
      } else {
        setFacultySearchResults([]);
        setIsSearchingFaculty(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [facultySearchQuery, isFacultySelectionLocked]);

  const searchFacultyByName = async (query: string) => {
    const requestSeq = ++facultySearchRequestSeq.current;
    try {
      setIsSearchingFaculty(true);
      const response = await apiClient.searchFacultyByName(query, 10);
      if (requestSeq !== facultySearchRequestSeq.current || isFacultySelectionLocked) {
        return;
      }
      if (response.error) {
        setFacultySearchResults([]);
      } else if (response.data) {
        setFacultySearchResults(response.data.results || []);
      }
    } catch (error: any) {
      console.error("Error searching faculty:", error);
      setFacultySearchResults([]);
    } finally {
      setIsSearchingFaculty(false);
    }
  };

  const handleFacultySelect = (faculty: {
    id: number;
    name: string;
    email: string;
    phone?: string | null;
    profile_picture?: string | null;
    has_wallet: boolean;
    department?: string | null;
    emp_id?: string | null;
  }) => {
    setIsFacultySelectionLocked(true);
    facultySearchRequestSeq.current += 1; // invalidate in-flight search responses
    setFacultyEmail(faculty.email);
    setFacultyName(faculty.name);
    setFacultySearchQuery(faculty.name);
    setFacultyProfile({
      name: faculty.name,
      email: faculty.email,
      phone: faculty.phone,
      profile_picture: faculty.profile_picture,
      has_wallet: faculty.has_wallet,
    });
    setFacultyProfileError(null);
    setFacultySearchResults([]);
    setIsSearchingFaculty(false);
  };

  const fetchJoinRequests = async () => {
    try {
      setLoadingRequests(true);
      const response = await apiClient.getWalletJoinRequests();
      if (response.data && response.data.requests) {
        setJoinRequests(response.data.requests);
        setSelectedFacultyJoinRequestIds((prev) => {
          const validIds = new Set(response.data.requests.map((r: any) => r.id));
          return prev.filter((id) => validIds.has(id));
        });
        setSelectedFacultyCancelledJoinRequestIds((prev) => {
          const validIds = new Set(response.data.requests.map((r: any) => r.id));
          return prev.filter((id) => validIds.has(id));
        });
        
        // Check if student has an approved request
        const approvedRequest = response.data.requests.find(
          (req: any) => req.status === "APPROVED"
        );
        if (approvedRequest) {
          setHasApprovedRequest(true);
          // If student has approved request but was showing request form, fetch wallet data
          if (showRequestForm) {
            setShowRequestForm(false);
            setUserId(user?.id || null);
            await fetchWalletData();
          }
        }
      }
    } catch (error) {
      // Silently handle errors
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleRequestWalletAccess = async () => {
    if (!facultyEmail.trim()) {
      toast.error("Please select a faculty member");
      return;
    }

    if (!facultyProfile) {
      toast.error("Please select a faculty member");
      return;
    }

    try {
      setRequesting(true);
      const response = await apiClient.requestWalletJoin(facultyEmail, requestMessage);

      if (response.error) {
        toast.error(response.error || "Failed to send wallet join request");
        return;
      }

      toast.success(response.data?.message || "Wallet join request sent successfully!");
      setFacultyEmail("");
      setFacultyName("");
      setFacultySearchQuery("");
      setRequestMessage("");
      setFacultyProfile(null);
      setFacultyProfileError(null);
      setFacultySearchResults([]);
      // Refresh the requests list
      await fetchJoinRequests();
    } catch (error: any) {
      toast.error(error.message || "Failed to send wallet join request");
    } finally {
      setRequesting(false);
    }
  };

  const handleCancelRequest = async (requestId: number) => {
    const request = joinRequests.find(r => r.id === requestId);
    const isApproved = request?.status === "APPROVED";
    const confirmMessage = isApproved 
      ? "Are you sure you want to leave this wallet? You will lose access immediately and can request to join a different faculty wallet."
      : "Are you sure you want to cancel this request?";
    
    confirm(
      confirmMessage,
      async () => {
        try {
          const response = await apiClient.cancelWalletJoinRequest(requestId);
          if (response.error) {
            toast.error(response.error || "Failed to cancel request");
            return;
          }
          toast.success(response.data?.message || (isApproved ? "You have left the wallet" : "Request cancelled successfully"));
          await fetchJoinRequests();
          // If student left their wallet, refresh wallet data
          if (isApproved && userId) {
            await fetchWalletData();
          }
        } catch (error: any) {
          toast.error(error.message || "Failed to cancel request");
        }
      },
      {
        title: isApproved ? "Leave Wallet" : "Cancel Request",
        variant: isApproved ? "destructive" : "default",
      }
    );
  };

  const handleResendJoinRequest = async (requestId: number) => {
    try {
      setResendingJoinRequestId(requestId);
      const response = await apiClient.resendWalletJoinRequestNotification(requestId);
      if (response.error) {
        toast.error(response.error || "Failed to resend wallet join request.");
        return;
      }
      toast.success(response.data?.message || "Wallet join request resent successfully.");
    } catch (error: any) {
      toast.error(error.message || "Failed to resend wallet join request.");
    } finally {
      setResendingJoinRequestId(null);
    }
  };

  const handleApproveRequest = async (requestId: number) => {
    try {
      const response = await apiClient.approveWalletJoinRequest(requestId);
      if (response.error) {
        toast.error(response.error || "Failed to approve request");
        return;
      }
      toast.success("Request approved successfully");
      await fetchJoinRequests();
    } catch (error: any) {
      toast.error(error.message || "Failed to approve request");
    }
  };

  const handleRejectRequest = async (requestId: number) => {
    try {
      const response = await apiClient.rejectWalletJoinRequest(requestId);
      if (response.error) {
        toast.error(response.error || "Failed to reject request");
        return;
      }
      toast.success("Request rejected successfully");
      await fetchJoinRequests();
    } catch (error: any) {
      toast.error(error.message || "Failed to reject request");
    }
  };

  const handleRemoveStudent = async (requestId: number) => {
    confirm(
      "Are you sure you want to remove this user from your wallet? They will lose access immediately.",
      async () => {
        try {
          const response = await apiClient.removeStudentFromWallet(requestId);
          if (response.error) {
            toast.error(response.error);
            return;
          }
          toast.success(response.data?.message || "User removed from wallet");
          await fetchJoinRequests();
          // Refresh wallet data in case balance changed
          if (userId) {
            await fetchWalletData();
          }
        } catch (error: any) {
          toast.error(error.message || "Failed to remove student");
        }
      },
      {
        title: "Remove Student",
        variant: "destructive",
        confirmText: "Remove",
      }
    );
  };

  const handleDeleteCancelledJoinRequest = async (requestId: number) => {
    confirm(
      "Remove this cancelled request from your list? This cannot be undone.",
      async () => {
        try {
          const response = await apiClient.deleteWalletJoinRequest(requestId);
          if (response.error) {
            toast.error(response.error);
            return;
          }
          toast.success(response.data?.message || "Request removed from list");
          await fetchJoinRequests();
        } catch (error: any) {
          toast.error(error.message || "Failed to delete request");
        }
      },
      {
        title: "Delete cancelled request",
        variant: "destructive",
        confirmText: "Delete",
      }
    );
  };

  const facultyActionableJoinRequests = useMemo(
    () => joinRequests.filter((request) => request.status === "PENDING" || request.status === "APPROVED"),
    [joinRequests]
  );

  const facultyCancelledJoinRequests = useMemo(
    () => joinRequests.filter((request) => request.status === "CANCELLED"),
    [joinRequests]
  );

  const facultyCancelledSelectedCount = useMemo(
    () =>
      joinRequests.filter(
        (request) =>
          selectedFacultyCancelledJoinRequestIds.includes(request.id) && request.status === "CANCELLED"
      ).length,
    [joinRequests, selectedFacultyCancelledJoinRequestIds]
  );

  const facultyPendingSelectedCount = useMemo(
    () =>
      joinRequests.filter(
        (request) => selectedFacultyJoinRequestIds.includes(request.id) && request.status === "PENDING"
      ).length,
    [joinRequests, selectedFacultyJoinRequestIds]
  );

  const facultyApprovedSelectedCount = useMemo(
    () =>
      joinRequests.filter(
        (request) => selectedFacultyJoinRequestIds.includes(request.id) && request.status === "APPROVED"
      ).length,
    [joinRequests, selectedFacultyJoinRequestIds]
  );

  const toggleFacultyJoinRequestSelection = (requestId: number, checked: boolean) => {
    setSelectedFacultyJoinRequestIds((prev) => {
      if (checked) return prev.includes(requestId) ? prev : [...prev, requestId];
      return prev.filter((id) => id !== requestId);
    });
  };

  const handleSelectAllFacultyJoinRequests = (checked: boolean) => {
    if (!checked) {
      setSelectedFacultyJoinRequestIds([]);
      return;
    }
    setSelectedFacultyJoinRequestIds(facultyActionableJoinRequests.map((request) => request.id));
  };

  const toggleFacultyCancelledJoinRequestSelection = (requestId: number, checked: boolean) => {
    setSelectedFacultyCancelledJoinRequestIds((prev) => {
      if (checked) return prev.includes(requestId) ? prev : [...prev, requestId];
      return prev.filter((id) => id !== requestId);
    });
  };

  const handleSelectAllCancelledFacultyJoinRequests = (checked: boolean) => {
    if (!checked) {
      setSelectedFacultyCancelledJoinRequestIds([]);
      return;
    }
    setSelectedFacultyCancelledJoinRequestIds(facultyCancelledJoinRequests.map((request) => request.id));
  };

  const handleBulkDeleteCancelledJoinRequests = async () => {
    const cancelledIds = joinRequests
      .filter(
        (request) =>
          selectedFacultyCancelledJoinRequestIds.includes(request.id) && request.status === "CANCELLED"
      )
      .map((request) => request.id);

    if (cancelledIds.length === 0) {
      toast.error("Select at least one cancelled request to delete.");
      return;
    }

    confirm(
      `Remove ${cancelledIds.length} cancelled request${cancelledIds.length === 1 ? "" : "s"} from your list? This cannot be undone.`,
      async () => {
        setBulkJoinActionLoading("delete");
        try {
          const response = await apiClient.deleteWalletJoinRequestsBulk(cancelledIds);
          if (response.error) {
            toast.error(response.error);
            return;
          }
          const deleted = response.data?.deleted_count ?? cancelledIds.length;
          const requested = response.data?.requested_count ?? cancelledIds.length;
          if (deleted < requested) {
            toast.success(
              response.data?.message ||
                `Removed ${deleted} of ${requested} request(s). Some could not be deleted.`
            );
          } else {
            toast.success(response.data?.message || `Removed ${deleted} request(s) from your list.`);
          }
          await fetchJoinRequests();
        } catch (error: any) {
          toast.error(error.message || "Failed to delete requests");
        } finally {
          setBulkJoinActionLoading(false);
        }
      },
      {
        title: "Delete cancelled requests",
        variant: "destructive",
        confirmText: "Delete",
      }
    );
  };

  const handleBulkApproveJoinRequests = async () => {
    const pendingIds = joinRequests
      .filter((request) => selectedFacultyJoinRequestIds.includes(request.id) && request.status === "PENDING")
      .map((request) => request.id);

    if (pendingIds.length === 0) {
      toast.error("Select at least one pending request to approve.");
      return;
    }

    setBulkJoinActionLoading("approve");
    let successCount = 0;
    let failedCount = 0;

    for (const requestId of pendingIds) {
      const response = await apiClient.approveWalletJoinRequest(requestId);
      if (response.error) failedCount += 1;
      else successCount += 1;
    }

    if (successCount > 0 && failedCount === 0) {
      toast.success(`Approved ${successCount} request${successCount === 1 ? "" : "s"} successfully.`);
    } else if (successCount > 0 && failedCount > 0) {
      toast.error(`Approved ${successCount}, failed ${failedCount}. Please retry the failed requests.`);
    } else {
      toast.error("Failed to approve selected requests.");
    }

    setBulkJoinActionLoading(false);
    await fetchJoinRequests();
  };

  const handleBulkRejectJoinRequests = async () => {
    const pendingIds = joinRequests
      .filter((request) => selectedFacultyJoinRequestIds.includes(request.id) && request.status === "PENDING")
      .map((request) => request.id);

    if (pendingIds.length === 0) {
      toast.error("Select at least one pending request to reject.");
      return;
    }

    setBulkJoinActionLoading("reject");
    let successCount = 0;
    let failedCount = 0;

    for (const requestId of pendingIds) {
      const response = await apiClient.rejectWalletJoinRequest(requestId);
      if (response.error) failedCount += 1;
      else successCount += 1;
    }

    if (successCount > 0 && failedCount === 0) {
      toast.success(`Rejected ${successCount} request${successCount === 1 ? "" : "s"} successfully.`);
    } else if (successCount > 0 && failedCount > 0) {
      toast.error(`Rejected ${successCount}, failed ${failedCount}. Please retry the failed requests.`);
    } else {
      toast.error("Failed to reject selected requests.");
    }

    setBulkJoinActionLoading(false);
    await fetchJoinRequests();
  };

  const handleBulkRemoveStudents = async () => {
    const approvedIds = joinRequests
      .filter((request) => selectedFacultyJoinRequestIds.includes(request.id) && request.status === "APPROVED")
      .map((request) => request.id);

    if (approvedIds.length === 0) {
      toast.error("Select at least one approved user to remove.");
      return;
    }

    confirm(
      `Are you sure you want to remove ${approvedIds.length} selected user${approvedIds.length === 1 ? "" : "s"} from your wallet? They will lose access immediately.`,
      async () => {
        setBulkJoinActionLoading("remove");
        let successCount = 0;
        let failedCount = 0;

        for (const requestId of approvedIds) {
          const response = await apiClient.removeStudentFromWallet(requestId);
          if (response.error) failedCount += 1;
          else successCount += 1;
        }

        if (successCount > 0 && failedCount === 0) {
          toast.success(`Removed ${successCount} user${successCount === 1 ? "" : "s"} from wallet.`);
        } else if (successCount > 0 && failedCount > 0) {
          toast.error(`Removed ${successCount}, failed ${failedCount}. Please retry the failed requests.`);
        } else {
          toast.error("Failed to remove selected users.");
        }

        setBulkJoinActionLoading(false);
        await fetchJoinRequests();
        if (userId) await fetchWalletData();
      },
      {
        title: "Remove Selected Users",
        variant: "destructive",
        confirmText: "Remove",
      }
    );
  };

  const fetchWalletData = async () => {
    try {
      const walletResponse = await apiClient.getWallet();
      if (walletResponse.error) {
        if (walletResponse.error.includes("Only students, faculty, and external users")) {
          toast.error("Only students, faculty, and external users can have wallets.");
          navigate("/dashboard");
          return;
        }
        // If wallet doesn't exist yet, show empty state instead of error
        if (walletResponse.error.includes("404") || walletResponse.error.includes("Not found")) {
          setBalance(0);
          setTransactions([]);
          setWalletCreditFacilityItems([]);
          setLoading(false);
          return;
        }
        throw new Error(walletResponse.error);
      }
      
      if (walletResponse.data) {
        const newBalance = Number(walletResponse.data.balance);
        setBalance(newBalance);
        
        // Update localStorage cache for header
        const now = Date.now();
        localStorage.setItem('wallet_balance', String(newBalance));
        localStorage.setItem('wallet_balance_timestamp', String(now));
        
        // Dispatch custom event to notify header of balance update
        window.dispatchEvent(new CustomEvent('walletBalanceUpdated', {
          detail: { balance: newBalance }
        }));
        
        // Check if this is a shared wallet (student using faculty wallet)
        if (walletResponse.data.is_shared) {
          setIsShared(true);
          setWalletOwner(walletResponse.data.wallet_owner || null);
        } else {
          setIsShared(false);
          setWalletOwner(null);
        }
        
        // Sub-wallets (department-wise balances)
        const subWalletsData = walletResponse.data.sub_wallets ?? [];
        setSubWallets(subWalletsData);
        
        // Fetch transactions from all sub-wallets
        if (subWalletsData.length > 0) {
          // Fetch transactions from all sub-wallets in parallel
          const transactionPromises = subWalletsData.map(subWallet =>
            apiClient.getSubWalletTransactions(subWallet.department_id, 100, 0)
          );

          Promise.all(transactionPromises).then(responses => {
            // Aggregate all transactions with department info
            const allTransactions: Transaction[] = [];
            
            responses.forEach((response, index) => {
              if (response.data?.transactions) {
                const subWallet = subWalletsData[index];
                const transactionsWithDept = response.data.transactions.map((tx: any) => ({
                  ...tx,
                  department_name: subWallet.department_name,
                  department_code: subWallet.department_code,
                }));
                allTransactions.push(...transactionsWithDept);
              }
            });

            // Sort by created_at descending (most recent first)
            allTransactions.sort((a, b) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );

            setTransactions(allTransactions);
          }).catch(error => {
            console.error("Failed to fetch sub-wallet transactions:", error);
            setTransactions([]);
          });
        } else {
          setTransactions([]);
        }
        
        // If this is a shared wallet, fetch join requests to get the approved request
        if (walletResponse.data.is_shared) {
          await fetchJoinRequests();
        }

        await fetchDeptFacultyCreditStatus();
      }
    } catch (error: any) {
      // Don't redirect on error, just show empty state
      setBalance(0);
      setTransactions([]);
      setDeptFacultyCreditByDept({});
      toast.error(error.message || "Failed to load wallet data. Showing empty wallet.");
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    // Fetch transactions from all sub-wallets
    if (subWallets.length === 0) {
      setTransactions([]);
      return;
    }

    try {
      // Fetch transactions from all sub-wallets in parallel
      const transactionPromises = subWallets.map(subWallet =>
        apiClient.getSubWalletTransactions(subWallet.department_id, 100, 0)
      );

      const responses = await Promise.all(transactionPromises);
      
      // Aggregate all transactions with department info
      const allTransactions: Transaction[] = [];
      
      responses.forEach((response, index) => {
        if (response.data?.transactions) {
          const subWallet = subWallets[index];
          const transactionsWithDept = response.data.transactions.map((tx: any) => ({
            ...tx,
            department_name: subWallet.department_name,
            department_code: subWallet.department_code,
          }));
          allTransactions.push(...transactionsWithDept);
        }
      });

      // Sort by created_at descending (most recent first)
      allTransactions.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setTransactions(allTransactions);
    } catch (error) {
      console.error("Failed to fetch sub-wallet transactions:", error);
      // Fallback to empty array on error
      setTransactions([]);
    }
  };

  // Refetch transactions when sub-wallets change (e.g., after recharge)
  useEffect(() => {
    if (subWallets.length > 0 && !loading) {
      fetchTransactions();
    } else if (subWallets.length === 0) {
      setTransactions([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subWallets.length]);

  // Filtered transaction list for Transaction History table
  const filteredTransactions = useMemo(() => {
    let list = [...transactions];
    if (txTypeFilter !== "all") {
      list = list.filter((t) => t.transaction_type === txTypeFilter);
    }
    if (txDateFrom) {
      const from = new Date(txDateFrom);
      from.setHours(0, 0, 0, 0);
      list = list.filter((t) => new Date(t.created_at) >= from);
    }
    if (txDateTo) {
      const to = new Date(txDateTo);
      to.setHours(23, 59, 59, 999);
      list = list.filter((t) => new Date(t.created_at) <= to);
    }
    if (txDepartmentFilter) {
      list = list.filter(
        (t) => (t.department_name || "").trim() === txDepartmentFilter || (t.department_code || "").trim() === txDepartmentFilter
      );
    }
    if (txEquipmentFilter) {
      list = list.filter((t) => (t.equipment_name || "").trim() === txEquipmentFilter);
    }
    if (txBookedByFilter === "__booked_by_unassigned__") {
      list = list.filter((t) => !(t.related_user_name || "").trim());
    } else if (txBookedByFilter) {
      list = list.filter((t) => (t.related_user_name || "").trim() === txBookedByFilter);
    }
    if (txSearchText.trim()) {
      const q = txSearchText.trim().toLowerCase();
      list = list.filter(
        (t) =>
          (t.description || "").toLowerCase().includes(q) ||
          (t.description_display || "").toLowerCase().includes(q) ||
          (t.virtual_booking_id || "").toLowerCase().includes(q) ||
          (t.equipment_name || "").toLowerCase().includes(q) ||
          (t.related_user_name || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [transactions, txTypeFilter, txDateFrom, txDateTo, txDepartmentFilter, txEquipmentFilter, txBookedByFilter, txSearchText]);

  const uniqueDepartmentsForFilter = useMemo(() => {
    const names = new Set<string>();
    transactions.forEach((t) => {
      if (t.department_name) names.add(t.department_name);
    });
    return Array.from(names).sort();
  }, [transactions]);

  const uniqueEquipmentNamesForFilter = useMemo(() => {
    const names = new Set<string>();
    transactions.forEach((t) => {
      const name = (t.equipment_name || "").trim();
      if (name) names.add(name);
    });
    return Array.from(names).sort();
  }, [transactions]);

  const uniqueBookedByForFilter = useMemo(() => {
    const names = new Set<string>();
    transactions.forEach((t) => {
      const n = (t.related_user_name || "").trim();
      if (n) names.add(n);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [transactions]);

  const hasUnassignedBookedBy = useMemo(
    () => transactions.some((t) => !(t.related_user_name || "").trim()),
    [transactions]
  );

  // Load Razorpay script dynamically
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Cleanup script on unmount
      const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if (existingScript) {
        document.body.removeChild(existingScript);
      }
    };
  }, []);

  const handleRecharge = async () => {
    const amount = parseFloat(rechargeAmount);
    if (!rechargeDepartmentId) {
      toast.error("Please select a department (sub-wallet to credit)");
      return;
    }
    if (!amount || amount < 1) {
      toast.error("Please enter a valid amount (minimum ₹1)");
      return;
    }
    if (amount > 100000) {
      toast.error("Maximum recharge amount is ₹1,00,000");
      return;
    }
    try {
      setRecharging(true);
      const orderResponse = await apiClient.createRazorpayPaymentOrder({
        purpose: "WALLET_RECHARGE",
        amount,
        department_id: rechargeDepartmentId,
      });
      if (orderResponse.error || !orderResponse.data) {
        toast.error(orderResponse.error || "Failed to create payment order");
        setRecharging(false);
        return;
      }
      const RazorpayCtor = (window as any).Razorpay;
      if (!RazorpayCtor) {
        toast.error("Razorpay Checkout is not loaded. Please refresh and try again.");
        setRecharging(false);
        return;
      }
      const breakup = orderResponse.data.breakup;
      if (breakup && Number(breakup.convenience_fee) > 0) {
        toast.info(
          `Payable ${formatINR(Number(breakup.total_amount))} (includes convenience fee)`
        );
      }
      const options = {
        key: orderResponse.data.key || orderResponse.data.key_id,
        amount: orderResponse.data.amount,
        currency: orderResponse.data.currency || "INR",
        name: "IIC Wallet Recharge",
        description: `Wallet recharge ₹${amount}`,
        order_id: orderResponse.data.order_id,
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const verify = await apiClient.verifyRazorpayCheckout({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            if (verify.error) {
              toast.error(verify.error);
              return;
            }
            toast.success(verify.data?.message || "Wallet recharged successfully");
            setRechargeAmount("");
            await fetchWalletData();
          } catch (err: any) {
            toast.error(err?.message || "Payment verification failed");
          } finally {
            setRecharging(false);
          }
        },
        modal: {
          ondismiss: () => setRecharging(false),
        },
        theme: { color: "#1e4d8c" },
      };
      const rzp = new RazorpayCtor(options);
      rzp.open();
    } catch (error: any) {
      toast.error(error.message || "Failed to initiate payment");
      setRecharging(false);
    }
  };

  const completeRechargeOtpSend = async (creditFacilityOptedIn: boolean) => {
    const amount = parseFloat(rechargeAmount);
    if (!rechargeDepartmentId) {
      toast.error("Please select a department (sub-wallet to credit)");
      return;
    }
    if (!amount || amount < 100) {
      toast.error("Please enter a valid amount (minimum ₹100)");
      return;
    }
    const isProjectGrant = offlineRechargeMode === "project_grant";
    if (isProjectGrant && !selectedProjectId) {
      toast.error("Please select a project. Add projects from your profile if none are available.");
      return;
    }
    if (!isProjectGrant && !cashUndertakingAccepted) {
      toast.error("Please accept the undertaking before continuing.");
      return;
    }
    try {
      setSendingOtp(true);
      const response = await apiClient.sendUserOtpForRecharge(
        amount,
        rechargeDepartmentId,
        isProjectGrant ? selectedProjectId : null,
        creditFacilityOptedIn,
        {
          rechargeMode: offlineRechargeMode,
          undertakingAccepted: cashUndertakingAccepted,
        }
      );

      if (response.error) {
        toast.error(response.error || "Failed to send OTP");
        return;
      }

      toast.success(response.data?.message || "OTP has been sent to your email");
      setTempRequestId(response.data?.request_id || null);
      setOtpStep("otp");
    } catch (error: any) {
      toast.error(error.message || "Failed to send OTP");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleSendOtp = async () => {
    await completeRechargeOtpSend(false);
  };

  const resetRechargeDialog = () => {
    if (skipRechargeResetRef.current) {
      skipRechargeResetRef.current = false;
      setShowRechargeDialog(false);
      return;
    }
    setShowRechargeDialog(false);
    setRechargeAmount("");
    setRechargeDepartmentId(null);
    setSelectedProjectId(null);
    setRechargeType(isFacultyEffective ? "request" : "sbiepay");
    setOfflineRechargeMode(isFacultyEffective ? "project_grant" : "direct_cash_deposit");
    setCashUndertakingAccepted(false);
    setStudentOfflinePath("receipt");
    setOtpStep("form");
    setUserOtp("");
    setTempRequestId(null);
    setStudentReceiptFile(null);
    setStudentReceiptUtr("");
  };

  const openAvailCreditDialog = (departmentId: number) => {
    const status = deptFacultyCreditByDept[departmentId];
    const remaining =
      parseFloat(
        String(
          status?.remaining_credit ||
            status?.department_max_credit_limit ||
            status?.credit_limit ||
            "0"
        )
      ) || 0;
    setAvailCreditDeptId(departmentId);
    setAvailCreditAmount(remaining > 0 ? String(remaining) : "");
    setAvailCreditOpen(true);
  };

  const handleAvailCreditFacility = async () => {
    if (availCreditDeptId == null) return;
    const status = deptFacultyCreditByDept[availCreditDeptId];
    const remaining =
      parseFloat(
        String(
          status?.remaining_credit ||
            status?.department_max_credit_limit ||
            status?.credit_limit ||
            "0"
        )
      ) || 0;
    const amount = parseFloat(availCreditAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a credit amount greater than zero.");
      return;
    }
    if (amount > remaining) {
      toast.error(
        `Credit amount cannot exceed ₹${remaining.toLocaleString("en-IN", { maximumFractionDigits: 2 })}.`
      );
      return;
    }
    try {
      setAvailingCredit(true);
      const res = await apiClient.availDepartmentFacultyCreditFacility({
        department_id: availCreditDeptId,
        amount,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.data?.message || "Credit facility availed successfully.");
      setAvailCreditOpen(false);
      setAvailCreditDeptId(null);
      setAvailCreditAmount("");
      await fetchDeptFacultyCreditStatus();
      await fetchWalletData();
    } catch (e: any) {
      toast.error(e?.message || "Failed to avail credit facility");
    } finally {
      setAvailingCredit(false);
    }
  };

  const handleSubmitStudentReceipt = async () => {
    if (!rechargeDepartmentId || !rechargeAmount || !studentReceiptFile) {
      toast.error("Department, amount, and payment receipt file are required.");
      return;
    }
    const amount = parseFloat(rechargeAmount);
    if (Number.isNaN(amount) || amount < 1) {
      toast.error("Enter a valid amount.");
      return;
    }
    try {
      setSubmittingStudentReceipt(true);
      const res = await apiClient.submitWalletRechargeReceipt({
        amount,
        department_id: rechargeDepartmentId,
        receipt_file: studentReceiptFile,
        utr_reference: studentReceiptUtr.trim() || undefined,
      });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(
        res.data?.message ||
          "Payment receipt submitted. Funds will be parked in the faculty wallet after Department Account In-charge approval."
      );
      resetRechargeDialog();
      await fetchWalletData();
    } catch (e: any) {
      toast.error(e?.message || "Failed to submit payment receipt");
    } finally {
      setSubmittingStudentReceipt(false);
    }
  };

  const handleSendSricNotification = async (requestId: number, onSuccess?: () => void) => {
    try {
      setSendingSric(true);
      const response = await apiClient.sendSricWalletRechargeNotification(requestId);
      if (response.error) {
        toast.error(response.error);
        return;
      }
      toast.success(response.data?.message || `Request sent to ${sricDestinationLabel}.`);
      await fetchWalletData();
      await fetchRechargeRequests();
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || `Failed to send to ${sricDestinationLabel}`);
    } finally {
      setSendingSric(false);
    }
  };

  const handleRequestRecharge = async () => {
    if (!tempRequestId) {
      toast.error("Please request OTP first");
      return;
    }

    if (!userOtp || userOtp.length !== 6) {
      toast.error("Please enter a valid 6-digit OTP");
      return;
    }

    try {
      setRequestingRecharge(true);
      
      const response = await apiClient.createWalletRechargeRequest(
        tempRequestId,
        userOtp
      );

      if (response.error) {
        toast.error(response.error || "Failed to create recharge request");
        return;
      }

      const req = response.data?.request;
      const needsSric =
        isFacultyEffective &&
        req &&
        req.user_otp_verified &&
        !req.sric_notification_sent;

      if (needsSric) {
        toast.success(
          response.data?.message ||
            (isCashDepositMode
              ? `Recharge request created. You can now notify the ${sricDestinationLabel} (if auto-notify did not run).`
              : "Recharge request created. You can now notify the SRIC Office (if auto-notify did not run).")
        );
        setTempRequestId(req.id);
        setOtpStep("sric");
        setUserOtp("");
        await fetchWalletData();
        await fetchRechargeRequests();
        return;
      }

      toast.success(
        response.data?.message ||
          (isFacultyEffective && req?.sric_notification_sent
            ? isCashDepositMode
              ? `Recharge request submitted. ${sricDestinationLabel}, accounts, and staff have been notified where configured. You will receive email when the recharge is credited from the accounts file.`
              : "Recharge request submitted. SRIC Office, accounts, and staff have been notified where configured. You will receive email when the recharge is credited from the accounts file."
            : "Recharge request created successfully. The accounts team will review your request.")
      );
      resetRechargeDialog();
      
      // Refresh wallet data and recharge requests
      await fetchWalletData();
      await fetchRechargeRequests();
    } catch (error: any) {
      toast.error(error.message || "Failed to create recharge request");
    } finally {
      setRequestingRecharge(false);
    }
  };

  // Calculate if section should show (needed in multiple return statements)
  const shouldShowFacultyWalletSection = (isStudent || isOtherUser) && !isIndividualStudent;

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show request form for students without wallet access
  if (showRequestForm) {
    return (
      <div className="page-shell">
        <DashboardHeader />
        <main className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="mb-8 rounded-2xl bg-gradient-to-r from-primary via-primary to-accent p-6 text-white shadow-xl">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Request Wallet Access</h1>
            <p className="mt-2 text-white/85 text-sm">
              Link to a faculty wallet to fund equipment bookings.
            </p>
          </div>

          <Card className="border-border/70 shadow-[var(--shadow-card)] rounded-2xl">
            <CardHeader>
              <CardTitle>Request to Join Wallet</CardTitle>
              <CardDescription>
                {isOtherUser 
                  ? "As an 'Other' type user, you can either use your own wallet or join a faculty wallet. Search for a faculty member by name below to send a request to join their wallet."
                  : "As a student, you need to request a faculty member to add you to their wallet. Search for a faculty member by name below to send a request."
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="faculty-search">Search Faculty by Name</Label>
                <Popover open={facultySearchResults.length > 0 && facultySearchQuery.length >= 2}>
                  <PopoverTrigger asChild>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="faculty-search"
                        type="text"
                        placeholder="Type faculty name to search..."
                        value={facultySearchQuery}
                        onChange={(e) => {
                          setIsFacultySelectionLocked(false);
                          setFacultySearchQuery(e.target.value);
                          if (e.target.value.trim().length < 2) {
                            setFacultyProfile(null);
                            setFacultyEmail("");
                            setFacultyName("");
                          }
                        }}
                        className="pl-10"
                        required
                      />
                      {isSearchingFaculty && (
                        <div className="absolute right-3 top-3">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                        </div>
                      )}
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <style>{`
                      [cmdk-item][data-selected="true"] p,
                      [cmdk-item][data-selected="true"] span,
                      [cmdk-item][data-selected="true"] svg {
                        color: white !important;
                      }
                      [cmdk-item][data-selected="true"] span.bg-muted {
                        background-color: rgba(255, 255, 255, 0.2) !important;
                      }
                    `}</style>
                    <Command>
                      <CommandList>
                        <CommandEmpty>
                          {facultySearchQuery.length < 2 
                            ? "Type at least 2 characters to search" 
                            : isSearchingFaculty 
                              ? "Searching..." 
                              : "No faculty members found"}
                        </CommandEmpty>
                        <CommandGroup>
                          {facultySearchResults.map((faculty) => (
                            <CommandItem
                              key={faculty.id}
                              value={faculty.name}
                              onSelect={() => handleFacultySelect(faculty)}
                              onMouseDown={(e) => {
                                // Prevent cmdk focus-change from requiring a second click.
                                e.preventDefault();
                                handleFacultySelect(faculty);
                              }}
                              className="cursor-pointer data-[selected='true']:text-white data-[selected=true]:text-white [&[data-selected='true']_p]:!text-white [&[data-selected='true']_span]:!text-white/90 [&[data-selected='true']_svg]:!text-white"
                            >
                              <div className="flex items-center gap-3 w-full py-1">
                                {faculty.profile_picture ? (
                                  <img
                                    src={apiClient.getProfilePictureUrl(faculty.id)}
                                    alt={faculty.name}
                                    className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                                  />
                                ) : (
                                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 [&[data-selected='true']_&]:bg-white/20">
                                    <User className="h-4 w-4 text-foreground/70" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0 space-y-0.5">
                                  <p className="text-sm font-medium truncate text-foreground">{faculty.name}</p>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-xs truncate text-foreground/80">{faculty.email}</p>
                                    {faculty.emp_id && (
                                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-foreground/70">
                                        {faculty.emp_id}
                                      </span>
                                    )}
                                  </div>
                                  {faculty.department && (
                                    <p className="text-xs truncate text-foreground/70">{faculty.department}</p>
                                  )}
                                </div>
                                {faculty.has_wallet ? (
                                  <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {facultyProfileError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg mt-2">
                    <p className="text-sm text-red-600 dark:text-red-400">{facultyProfileError}</p>
                  </div>
                )}
                {facultyProfile && !facultyProfileError && (
                  <div className="p-4 bg-muted border rounded-lg space-y-3 mt-2">
                    <p className="text-sm font-medium">Selected Faculty:</p>
                    <UserProfile
                      name={facultyProfile.name}
                      email={facultyProfile.email}
                      phone={facultyProfile.phone}
                      profilePicture={facultyProfile.profile_picture ? apiClient.getProfilePictureUrl(facultyProfile.id) : undefined}
                      size="md"
                    />
                    {!facultyProfile.has_wallet && (
                      <div className="p-2 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded">
                        <p className="text-xs text-yellow-700 dark:text-yellow-400">
                          ⚠️ This faculty member does not have a wallet yet. They need to create one before you can join.
                        </p>
                      </div>
                    )}
                    {facultyProfile.has_wallet && (
                      <div className="p-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded">
                        <p className="text-xs text-green-700 dark:text-green-400">
                          ✓ This faculty member has a wallet. You can send a request to join.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="request-message">Message (Optional)</Label>
                <Textarea
                  id="request-message"
                  placeholder="Add a message to your request..."
                  value={requestMessage}
                  onChange={(e) => setRequestMessage(e.target.value)}
                  rows={4}
                />
              </div>

              <Button
                onClick={handleRequestWalletAccess}
                disabled={requesting || !facultyEmail.trim() || !facultyProfile || !facultyProfile.has_wallet}
                className="w-full"
                size="lg"
              >
                {requesting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Sending Request...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Request
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Join Requests List */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>My Join Requests</CardTitle>
              <CardDescription>
                View the status of your wallet join requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingRequests ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : joinRequests.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No join requests yet. Send a request above to get started.
                </p>
              ) : (
                <div className="space-y-3">
                  {joinRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <UserProfile
                          name={request.faculty_name}
                          email={request.faculty_email}
                          phone={request.faculty_phone}
                          profilePicture={request.faculty_profile_picture ? apiClient.getProfilePictureUrl(request.faculty) : undefined}
                          size="sm"
                          className="mb-2"
                        />
                        <div className="flex items-center gap-2 mb-1">
                          {request.status === "PENDING" && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {request.status_display || "Pending"}
                            </Badge>
                          )}
                          {request.status === "APPROVED" && (
                            <Badge variant="default" className="flex items-center gap-1 bg-green-600">
                              <CheckCircle className="h-3 w-3" />
                              {request.status_display || "Approved"}
                            </Badge>
                          )}
                          {request.status === "REJECTED" && (
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <XCircle className="h-3 w-3" />
                              {request.status_display || "Rejected"}
                            </Badge>
                          )}
                          {request.status === "CANCELLED" && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <X className="h-3 w-3" />
                              {request.status_display || "Cancelled"}
                            </Badge>
                          )}
                        </div>
                        {request.message && (
                          <p className="text-sm text-muted-foreground mt-1">{request.message}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(request.created_at).toLocaleString()}
                        </p>
                      </div>
                      {request.status === "PENDING" && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResendJoinRequest(request.id)}
                            disabled={resendingJoinRequestId === request.id}
                          >
                            <Send className="h-4 w-4 mr-1" />
                            {resendingJoinRequestId === request.id ? "Resending..." : "Resend Request"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancelRequest(request.id)}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      )}
                      {request.status === "APPROVED" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancelRequest(request.id)}
                          className="text-orange-600 hover:text-orange-700 border-orange-600 hover:border-orange-700"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Leave Wallet
                        </Button>
                      )}
                      {request.faculty_response && (
                        <div className="mt-2 p-2 bg-muted rounded text-sm">
                          <span className="font-medium">Faculty Response: </span>
                          <span>{request.faculty_response}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </main>
        {AlertComponent}
        {ConfirmComponent}
      </div>
    );
  }

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 rounded-2xl bg-gradient-to-r from-primary via-primary to-accent p-6 sm:p-8 text-white shadow-xl">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Wallet</h1>
          <p className="mt-2 text-white/85 text-sm sm:text-base max-w-2xl">
            View balance, recharge, manage join requests, and review transactions.
          </p>
        </div>

        <Card className="mb-8 border-border/70 shadow-[var(--shadow-card)] rounded-2xl overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border/50">
            <CardTitle>Current Balance</CardTitle>
            <CardDescription>
              {isShared
                ? isIitrStudentReceiptOffline
                  ? "Shared faculty wallet — you may recharge when enabled by admin; funds park in the faculty wallet."
                  : "Available funds in shared wallet"
                : "Consolidated balance across all department sub-wallets. Recharge a sub-wallet to add funds."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
              <div className="text-4xl font-bold text-primary">
                ₹{balance.toFixed(2)}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {isFacultyEffective && !isShared && (
                  <Button
                    variant="outline"
                    onClick={() => navigate("/wallet/transfer")}
                    className="flex items-center gap-2"
                  >
                    Transfer
                  </Button>
                )}
                {canShowWalletRecharge && (
                  <Button
                    onClick={() => openRechargeDialog()}
                    className="flex items-center gap-2"
                  >
                    <WalletIcon className="h-4 w-4" />
                    Recharge Wallet
                  </Button>
                )}
              </div>
            </div>

            {/* Recharge Dialog */}
            {showRechargeDialog && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[90]">
                <Card className="w-full max-w-md mx-4">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Recharge Wallet</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          resetRechargeDialog();
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <CardDescription>
                      {isIitrStudentReceiptOffline
                        ? "Select department and amount. Offline recharge requires a payment receipt. Funds credit the faculty wallet."
                        : "Recharge a department sub-wallet. Select department and amount."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {otpStep === "sric" ? (
                      <div className="space-y-4">
                        <div className="p-4 border rounded-lg bg-muted/30">
                          <p className="text-sm font-medium">OTP verified</p>
                          <p className="text-sm text-muted-foreground mt-2">
                            Your recharge request has been created. Send it to the {sricDestinationLabel} by email.
                          </p>
                        </div>
                        <Button
                          className="w-full"
                          size="lg"
                          onClick={() => {
                            if (tempRequestId != null) {
                              void handleSendSricNotification(tempRequestId, () => {
                                resetRechargeDialog();
                              });
                            }
                          }}
                          disabled={sendingSric || tempRequestId == null}
                        >
                          {sendingSric ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              Send to {sricDestinationLabel}
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            resetRechargeDialog();
                            void fetchWalletData();
                          }}
                          disabled={sendingSric}
                        >
                          I will Send the e-mail Manually
                        </Button>
                      </div>
                    ) : (
                    <>
                    {/* Recharge Type Tabs — faculty: offline default, online disabled; department follows */}
                    <div className="flex gap-2 border-b">
                      {isFacultyEffective ? (
                        <>
                          <Button
                            type="button"
                            variant={rechargeType === "request" ? "default" : "ghost"}
                            className="rounded-b-none border-b-2 border-transparent"
                            onClick={() => setRechargeType("request")}
                            disabled={recharging || requestingRecharge}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Offline Request
                          </Button>
                          <Button
                            type="button"
                            variant={rechargeType === "sbiepay" ? "default" : "ghost"}
                            className="rounded-b-none border-b-2 border-transparent opacity-60"
                            onClick={() => setRechargeType("sbiepay")}
                            disabled
                            title="Online payment is not available for faculty recharge"
                          >
                            <CreditCard className="h-4 w-4 mr-2" />
                            Razorpay (Online)
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant={rechargeType === "sbiepay" ? "default" : "ghost"}
                            className="rounded-b-none border-b-2 border-transparent"
                            onClick={() => setRechargeType("sbiepay")}
                            disabled={recharging || requestingRecharge}
                          >
                            <CreditCard className="h-4 w-4 mr-2" />
                            Razorpay (Online)
                          </Button>
                          <Button
                            type="button"
                            variant={rechargeType === "request" ? "default" : "ghost"}
                            className="rounded-b-none border-b-2 border-transparent"
                            onClick={() => {
                              setRechargeType("request");
                              setOfflineRechargeMode("direct_cash_deposit");
                              setCashUndertakingAccepted(false);
                            }}
                            disabled={recharging || requestingRecharge}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Offline Request
                          </Button>
                        </>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Department (sub-wallet to credit)</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={rechargeDepartmentId ?? ""}
                        onChange={(e) => setRechargeDepartmentId(e.target.value ? Number(e.target.value) : null)}
                      >
                        <option value="">Select department</option>
                        {internalDepartments.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}{d.code ? ` (${d.code})` : ""}</option>
                        ))}
                      </select>
                      {loadingDepartments && <p className="text-xs text-muted-foreground">Loading departments...</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="recharge-amount">Amount (₹)</Label>
                      <Input
                        id="recharge-amount"
                        type="number"
                        min={rechargeType === "sbiepay" ? "1" : "100"}
                        max={rechargeType === "sbiepay" ? "100000" : undefined}
                        step="0.01"
                        placeholder="Enter amount"
                        value={rechargeAmount}
                        onChange={(e) => setRechargeAmount(e.target.value)}
                        disabled={recharging || requestingRecharge}
                      />
                      <p className="text-xs text-muted-foreground">
                        {rechargeType === "sbiepay"
                          ? "Minimum: ₹1 | Maximum: ₹1,00,000"
                          : "Minimum ₹100 | Maximum: No Limit"}
                      </p>
                    </div>

                    {rechargeType === "sbiepay" && (
                      <>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => setRechargeAmount("500")}
                            variant="outline"
                            size="sm"
                            disabled={recharging}
                          >
                            ₹500
                          </Button>
                          <Button
                            onClick={() => setRechargeAmount("1000")}
                            variant="outline"
                            size="sm"
                            disabled={recharging}
                          >
                            ₹1,000
                          </Button>
                          <Button
                            onClick={() => setRechargeAmount("2000")}
                            variant="outline"
                            size="sm"
                            disabled={recharging}
                          >
                            ₹2,000
                          </Button>
                          <Button
                            onClick={() => setRechargeAmount("5000")}
                            variant="outline"
                            size="sm"
                            disabled={recharging}
                          >
                            ₹5,000
                          </Button>
                        </div>
                        <Button
                          onClick={handleRecharge}
                          disabled={recharging || !rechargeDepartmentId || !rechargeAmount || parseFloat(rechargeAmount) < 1}
                          className="w-full"
                          size="lg"
                        >
                          {recharging ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Processing...
                            </>
                          ) : (
                            <>
                              <WalletIcon className="h-4 w-4 mr-2" />
                              Proceed to Payment
                            </>
                          )}
                        </Button>
                      </>
                    )}

                    {rechargeType === "request" && otpStep === "form" && isIitrStudentReceiptOffline && (
                      <div className="space-y-2">
                        <Label>Offline recharge option</Label>
                        <div className="grid gap-2">
                          <button
                            type="button"
                            onClick={() => setStudentOfflinePath("receipt")}
                            className={`flex items-start gap-3 rounded-md border p-3 text-left text-sm transition-colors ${
                              studentOfflinePath === "receipt"
                                ? "border-primary bg-primary/5"
                                : "border-input hover:bg-muted/40"
                            }`}
                          >
                            <span className="font-medium">Upload payment receipt</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setStudentOfflinePath("cash");
                              setOfflineRechargeMode("direct_cash_deposit");
                              setCashUndertakingAccepted(false);
                            }}
                            className={`flex items-start gap-3 rounded-md border p-3 text-left text-sm transition-colors ${
                              studentOfflinePath === "cash"
                                ? "border-primary bg-primary/5"
                                : "border-input hover:bg-muted/40"
                            }`}
                          >
                            <span>
                              <span className="font-medium block">Direct Cash Deposit / Bank Transfer</span>
                              <span className="text-xs text-muted-foreground">
                                Request routed to SRIC Bill Section (OTP verification).
                              </span>
                            </span>
                          </button>
                        </div>
                      </div>
                    )}

                    {rechargeType === "request" &&
                      otpStep === "form" &&
                      isIitrStudentReceiptOffline &&
                      studentOfflinePath === "receipt" && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="student-receipt-file">Payment receipt *</Label>
                          <Input
                            id="student-receipt-file"
                            type="file"
                            accept="image/*,.pdf,application/pdf"
                            onChange={(e) => {
                              const f = e.target.files?.[0] ?? null;
                              setStudentReceiptFile(f);
                            }}
                            disabled={submittingStudentReceipt}
                          />
                          <p className="text-xs text-muted-foreground">
                            Attach a scan or photo of the payment receipt (PDF or image).
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="student-receipt-utr">UTR / reference (optional)</Label>
                          <Input
                            id="student-receipt-utr"
                            type="text"
                            placeholder="Bank UTR if available"
                            value={studentReceiptUtr}
                            onChange={(e) => setStudentReceiptUtr(e.target.value)}
                            disabled={submittingStudentReceipt}
                          />
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <p className="text-sm text-blue-700 dark:text-blue-400">
                            After the Department Account In-charge verifies the receipt, the amount is parked in your faculty member&apos;s wallet for the selected department. The Department Account In-charge monitors department financial activities including wallet recharges, grant utilization, transactions, and credit facility usage.
                          </p>
                        </div>
                        <Button
                          onClick={handleSubmitStudentReceipt}
                          disabled={
                            submittingStudentReceipt ||
                            !rechargeDepartmentId ||
                            !rechargeAmount ||
                            parseFloat(rechargeAmount) < 1 ||
                            !studentReceiptFile
                          }
                          className="w-full"
                          size="lg"
                        >
                          {submittingStudentReceipt ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Submitting...
                            </>
                          ) : (
                            <>
                              <FileText className="h-4 w-4 mr-2" />
                              Submit Payment Receipt
                            </>
                          )}
                        </Button>
                      </>
                    )}

                    {rechargeType === "request" &&
                      otpStep === "form" &&
                      (!isIitrStudentReceiptOffline || studentOfflinePath === "cash") && (
                      <>
                        {isFacultyEffective && (
                          <div className="space-y-2">
                            <Label>Offline recharge mode</Label>
                            <div className="grid gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setOfflineRechargeMode("project_grant");
                                  setCashUndertakingAccepted(false);
                                }}
                                disabled={sendingOtp}
                                className={`flex items-start gap-3 rounded-md border p-3 text-left text-sm transition-colors ${
                                  isProjectGrantMode
                                    ? "border-primary bg-primary/5"
                                    : "border-input hover:bg-muted/40"
                                }`}
                              >
                                <span
                                  className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border ${
                                    isProjectGrantMode ? "border-primary bg-primary" : "border-muted-foreground"
                                  }`}
                                  aria-hidden
                                />
                                <span>
                                  <span className="font-medium block">Recharge via Project Grant</span>
                                  <span className="text-xs text-muted-foreground">
                                    Fund from an active project. Project selection required.
                                  </span>
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOfflineRechargeMode("direct_cash_deposit");
                                  setSelectedProjectId(null);
                                }}
                                disabled={sendingOtp}
                                className={`flex items-start gap-3 rounded-md border p-3 text-left text-sm transition-colors ${
                                  isCashDepositMode
                                    ? "border-primary bg-primary/5"
                                    : "border-input hover:bg-muted/40"
                                }`}
                              >
                                <span
                                  className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border ${
                                    isCashDepositMode ? "border-primary bg-primary" : "border-muted-foreground"
                                  }`}
                                  aria-hidden
                                />
                                <span>
                                  <span className="font-medium block">Direct Cash Deposit / Bank Transfer</span>
                                  <span className="text-xs text-muted-foreground">
                                    Amount only — no project. Use when no project grant is available.
                                  </span>
                                </span>
                              </button>
                            </div>
                          </div>
                        )}

                        {isFacultyEffective && isProjectGrantMode && (
                          <div className="space-y-2">
                            <Label htmlFor="project-select">Project *</Label>
                            {loadingProjects ? (
                              <div className="text-sm text-muted-foreground">Loading projects...</div>
                            ) : projects.length === 0 ? (
                              <div className="p-4 border border-yellow-200 dark:border-yellow-800 rounded-lg bg-yellow-50 dark:bg-yellow-950/30">
                                <p className="text-sm text-yellow-800 dark:text-yellow-400 mb-3">
                                  No active projects found. You need to add at least one active project to create a recharge request.
                                </p>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={goToAddProjectFromRecharge}
                                  className="w-full"
                                >
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  Add Project
                                </Button>
                              </div>
                            ) : (
                              <>
                                <Select
                                  value={selectedProjectId ? String(selectedProjectId) : undefined}
                                  onValueChange={(value) => {
                                    setSelectedProjectId(parseInt(value));
                                  }}
                                  disabled={sendingOtp || loadingProjects}
                                  required
                                >
                                  <SelectTrigger id="project-select" className={!selectedProjectId ? "border-destructive" : ""}>
                                    <SelectValue placeholder="Select a project *" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {projects.map((project) => (
                                      <SelectItem key={project.id} value={String(project.id)}>
                                        {project.name} ({project.project_code})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                  Select an active project associated with this recharge request. Required for project grant recharge.
                                </p>
                                <button
                                  type="button"
                                  onClick={goToAddProjectFromRecharge}
                                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Add Project
                                </button>
                              </>
                            )}
                          </div>
                        )}

                        {isCashDepositMode && (
                          <div className="flex items-start gap-3 rounded-md border border-input p-3">
                            <Checkbox
                              id="cash-undertaking"
                              checked={cashUndertakingAccepted}
                              onCheckedChange={(checked) => setCashUndertakingAccepted(checked === true)}
                              disabled={sendingOtp}
                              className="mt-0.5"
                            />
                            <Label htmlFor="cash-undertaking" className="text-sm font-normal leading-snug cursor-pointer">
                              This option should be used only when no active project grant is available for funding the requested recharge. Direct Cash Deposit / Bank Transfer should be chosen only in such situations.
                            </Label>
                          </div>
                        )}

                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <p className="text-sm text-blue-700 dark:text-blue-400">
                            An OTP will be sent to your email for verification before submitting the request.
                            {isCashDepositMode
                              ? " After verification, send the request to the SRIC Bill Section."
                              : isFacultyEffective
                                ? " After verification, send the request to the SRIC Office."
                                : ""}
                          </p>
                        </div>
                        <Button
                          onClick={handleSendOtp}
                          disabled={
                            sendingOtp ||
                            !rechargeDepartmentId ||
                            !rechargeAmount ||
                            parseFloat(rechargeAmount) < 100 ||
                            (isProjectGrantMode && (!selectedProjectId || projects.length === 0)) ||
                            (isCashDepositMode && !cashUndertakingAccepted)
                          }
                          className="w-full"
                          size="lg"
                        >
                          {sendingOtp ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Sending OTP...
                            </>
                          ) : (
                            <>
                              <FileText className="h-4 w-4 mr-2" />
                              {isFacultyEffective && isProjectGrantMode ? "Submit request" : "Send OTP to Email"}
                            </>
                          )}
                        </Button>
                      </>
                    )}

                    {rechargeType === "request" && otpStep === "otp" && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="user-otp">Enter OTP from Email</Label>
                          <Input
                            id="user-otp"
                            type="text"
                            maxLength={6}
                            placeholder="Enter 6-digit OTP"
                            value={userOtp}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                              setUserOtp(value);
                            }}
                            disabled={requestingRecharge}
                            className="text-center text-2xl tracking-widest font-mono"
                          />
                          <p className="text-xs text-muted-foreground">
                            Check your email for the 6-digit OTP code. It expires in 10 minutes.
                          </p>
                        </div>
                        <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                          <p className="text-sm text-yellow-700 dark:text-yellow-400">
                            ⚠️ OTP has been sent to your email. Enter it above to complete your recharge request.
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setOtpStep("form");
                              setUserOtp("");
                              setTempRequestId(null);
                            }}
                            disabled={requestingRecharge}
                            className="flex-1"
                          >
                            Back
                          </Button>
                          <Button
                            onClick={handleRequestRecharge}
                            disabled={requestingRecharge || !userOtp || userOtp.length !== 6}
                            className="flex-1"
                            size="lg"
                          >
                            {requestingRecharge ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Verifying...
                              </>
                            ) : (
                              <>
                                <FileText className="h-4 w-4 mr-2" />
                                Submit Request
                              </>
                            )}
                          </Button>
                        </div>
                      </>
                    )}
                    </>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
            
            {/* Supervisor Profile for Students and Other Users */}
            {isShared && walletOwner && (
              <div className="mt-6 pt-6 border-t">
                <p className="text-sm font-medium mb-3">Supervisor:</p>
                <UserProfile
                  name={walletOwner.name}
                  email={walletOwner.email}
                  phone={walletOwner.phone}
                  profilePicture={walletOwner.profile_picture && walletOwner.id != null ? apiClient.getProfilePictureUrl(walletOwner.id) : undefined}
                  size="md"
                />
                <div className="mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      // Find the approved request to cancel
                      const approvedRequest = joinRequests.find(
                        (req: any) => req.status === "APPROVED"
                      );
                      if (approvedRequest) {
                        await handleCancelRequest(approvedRequest.id);
                      } else {
                        toast.error("No active wallet connection found to leave.");
                      }
                    }}
                    className="text-orange-600 hover:text-orange-700 border-orange-600 hover:border-orange-700"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Leave Wallet
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* External users: Withdraw/transfer wallet balance to bank */}
        {isExternalUser && !isShared && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="h-5 w-5" />
                Transfer wallet balance to bank
              </CardTitle>
              <CardDescription>
                External users can request a bank transfer of their available wallet balance. Funds are held in the system when you submit the request.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingBankDetails ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Account holder name</Label>
                      <Input value={bankForm.account_holder_name} onChange={(e) => setBankForm((p) => ({ ...p, account_holder_name: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Bank name</Label>
                      <Input value={bankForm.bank_name} onChange={(e) => setBankForm((p) => ({ ...p, bank_name: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Account number</Label>
                      <Input value={bankForm.account_number} onChange={(e) => setBankForm((p) => ({ ...p, account_number: e.target.value }))} />
                      {bankDetails?.masked_account_number && (
                        <p className="text-xs text-muted-foreground">Saved: {bankDetails.masked_account_number}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>IFSC code</Label>
                      <Input value={bankForm.ifsc_code} onChange={(e) => setBankForm((p) => ({ ...p, ifsc_code: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Branch (optional)</Label>
                      <Input value={bankForm.branch_name} onChange={(e) => setBankForm((p) => ({ ...p, branch_name: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Account type (optional)</Label>
                      <Input value={bankForm.account_type} onChange={(e) => setBankForm((p) => ({ ...p, account_type: e.target.value }))} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>UPI ID (optional)</Label>
                      <Input value={bankForm.upi_id} onChange={(e) => setBankForm((p) => ({ ...p, upi_id: e.target.value }))} />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleSaveBankDetails} disabled={savingBankDetails}>
                      {savingBankDetails ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save bank details"
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (!bankDetails && !bankForm.account_number.trim()) {
                          toast.error("Please save bank details first");
                          return;
                        }
                        setShowWithdrawDialog(true);
                      }}
                    >
                      Request transfer
                    </Button>
                  </div>

                  {showWithdrawDialog && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                      <Card className="w-full max-w-md mx-4">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle>Request bank transfer</CardTitle>
                            <Button variant="ghost" size="sm" onClick={() => setShowWithdrawDialog(false)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <CardDescription>Enter amount to transfer from wallet to your saved bank details.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="space-y-2">
                            <Label>Amount (₹)</Label>
                            <Input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={withdrawAmount}
                              onChange={(e) => setWithdrawAmount(e.target.value)}
                              disabled={submittingWithdraw}
                            />
                            <p className="text-xs text-muted-foreground">Available: ₹{balance.toFixed(2)}</p>
                          </div>
                          <div className="space-y-2">
                            <Label>Note (optional)</Label>
                            <Textarea value={withdrawNote} onChange={(e) => setWithdrawNote(e.target.value)} rows={3} />
                          </div>
                          <Button className="w-full" onClick={handleCreateWithdrawalRequest} disabled={submittingWithdraw}>
                            {submittingWithdraw ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Submitting...
                              </>
                            ) : (
                              "Submit request"
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium">My transfer requests</p>
                      <Button variant="outline" size="sm" onClick={fetchWithdrawalRequests} disabled={loadingWithdrawalRequests}>
                        {loadingWithdrawalRequests ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Refresh
                          </>
                        ) : (
                          "Refresh"
                        )}
                      </Button>
                    </div>
                    {loadingWithdrawalRequests ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : withdrawalRequests.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4">No transfer requests yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {withdrawalRequests.map((r) => (
                          <div key={r.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="space-y-1">
                              <p className="font-medium">₹{Number(r.amount).toFixed(2)}</p>
                              <p className="text-xs text-muted-foreground">
                                {r.status_display || r.status} • {r.created_at ? new Date(r.created_at).toLocaleString() : ""}
                              </p>
                              {r.response_message && <p className="text-sm text-muted-foreground">Response: {r.response_message}</p>}
                              {r.utr_reference && <p className="text-sm text-muted-foreground">UTR: {r.utr_reference}</p>}
                            </div>
                            {r.status === "PENDING" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  const ok = await new Promise<boolean>((resolve) =>
                                    confirm("Cancel this transfer request?", () => resolve(true), { title: "Cancel request" }) || resolve(false)
                                  );
                                  if (!ok) return;
                                  const res = await apiClient.cancelWalletWithdrawalRequest(r.id);
                                  if (res.error) toast.error(res.error || "Failed to cancel");
                                  else {
                                    toast.success("Request cancelled");
                                    await fetchWalletData();
                                    await fetchWithdrawalRequests();
                                  }
                                }}
                                className="text-orange-600 hover:text-orange-700 border-orange-600 hover:border-orange-700"
                              >
                                <X className="h-4 w-4 mr-1" />
                                Cancel
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Department Sub-Wallets */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Department Sub-Wallets
            </CardTitle>
            <CardDescription>
              Funds allocated by department. Equipment linked to a department deducts from the corresponding
              sub-wallet. Eligible faculty can avail a one-time Credit Facility here, and track limit,
              outstanding, and recovery after recharges.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {subWallets.length === 0 ? (
              <p className="text-muted-foreground text-center py-6">
                No department sub-wallets yet. Book equipment linked to a department or transfer from main wallet to create one.
              </p>
            ) : (
              <>
                <ul className="space-y-3">
                  {(showAllSubWallets ? subWallets : subWallets.slice(0, SUB_WALLETS_PREVIEW_COUNT)).map((sw) => {
                    const credit = deptFacultyCreditByDept[sw.department_id];
                    const statusLower = String(credit?.status || "").toLowerCase();
                    const showActiveBadges =
                      statusLower === "active" || statusLower === "exhausted";
                    const showClosed = statusLower === "closed";
                    const canAvail = Boolean(credit?.can_avail);
                    return (
                      <li
                        key={sw.id}
                        className="flex flex-col gap-2 p-3 rounded-lg border bg-muted/30"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium">{sw.department_name}</p>
                            {sw.department_code && (
                              <p className="text-xs text-muted-foreground">{sw.department_code}</p>
                            )}
                          </div>
                          <span className="text-lg font-semibold text-primary shrink-0">
                            ₹{Number(sw.balance).toFixed(2)}
                          </span>
                        </div>
                        {isFacultyEffective && credit && (
                          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50">
                            {canAvail && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => openAvailCreditDialog(sw.department_id)}
                              >
                                Avail Credit Facility
                              </Button>
                            )}
                            {showActiveBadges && (
                              <>
                                <Badge variant="secondary">
                                  Limit ₹{Number(credit.credit_limit).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                                </Badge>
                                <Badge variant="outline">
                                  Outstanding ₹{Number(credit.outstanding_credit).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                                </Badge>
                                <Badge variant="outline">
                                  Remaining ₹{Number(credit.remaining_credit).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                                </Badge>
                                {statusLower === "exhausted" && (
                                  <Badge variant="destructive">{credit.status_display || "Exhausted"}</Badge>
                                )}
                                {statusLower === "active" && (
                                  <Badge variant="default">{credit.status_display || "Active"}</Badge>
                                )}
                              </>
                            )}
                            {showClosed && (
                              <span className="text-xs text-muted-foreground">Credit facility closed</span>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {subWallets.length > SUB_WALLETS_PREVIEW_COUNT && (
                  <Button
                    variant="ghost"
                    className="w-full mt-4 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowAllSubWallets((v) => !v)}
                  >
                    {showAllSubWallets ? (
                      <>
                        <ChevronUp className="h-4 w-4 mr-2" />
                        View less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-2" />
                        View more ({subWallets.length - SUB_WALLETS_PREVIEW_COUNT} more)
                      </>
                    )}
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Join Requests for Students and Other Users */}
        {/* Show for students and Other users (not individual students) */}
        {shouldShowFacultyWalletSection && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Faculty Wallet Requests</CardTitle>
              <CardDescription>
                {isOtherUser 
                  ? "You have your own wallet by default. You can also request to join a faculty wallet below. If approved, the faculty wallet will be used instead of your own."
                  : "View the status of your wallet join requests"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!hasApprovedRequest && (
                <div className="mb-4">
                  <Button
                    onClick={() => {
                      setShowRequestForm(true);
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Request to Join Faculty Wallet
                  </Button>
                  {isOtherUser && (
                    <p className="text-sm text-muted-foreground mt-2 text-center">
                      Your current balance above is from your own wallet. Joining a faculty wallet will switch you to use their wallet instead.
                    </p>
                  )}
                </div>
              )}
              {hasApprovedRequest && isOtherUser && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    You are currently using a faculty wallet. You can leave it to return to your own wallet.
                  </p>
                </div>
              )}
              {loadingRequests ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : joinRequests.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No join requests yet. {isOtherUser ? "Click the button above to request joining a faculty wallet." : "Send a request to get started."}
                </p>
              ) : (
                <div className="space-y-3">
                  {joinRequests.map((request) => (
                    (() => {
                      const status = String(request.status || "").toUpperCase();
                      const isPending = status === "PENDING";
                      const isApproved = status === "APPROVED";
                      const isRejected = status === "REJECTED";
                      const isCancelled = status === "CANCELLED";
                      return (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <UserProfile
                            name={request.faculty_name}
                            email={request.faculty_email}
                            phone={request.faculty_phone}
                            profilePicture={request.faculty_profile_picture ? apiClient.getProfilePictureUrl(request.faculty) : undefined}
                            size="sm"
                          />
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          {isPending && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {request.status_display || "Pending"}
                            </Badge>
                          )}
                          {isApproved && (
                            <Badge variant="default" className="flex items-center gap-1 bg-green-600">
                              <CheckCircle className="h-3 w-3" />
                              {request.status_display || "Approved"}
                            </Badge>
                          )}
                          {isRejected && (
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <XCircle className="h-3 w-3" />
                              {request.status_display || "Rejected"}
                            </Badge>
                          )}
                          {isCancelled && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <X className="h-3 w-3" />
                              {request.status_display || "Cancelled"}
                            </Badge>
                          )}
                        </div>
                        {request.message && (
                          <p className="text-sm text-muted-foreground mt-1">Your message: {request.message}</p>
                        )}
                        {request.faculty_response && (
                          <p className="text-sm text-muted-foreground mt-1">Faculty response: {request.faculty_response}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(request.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {isPending && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResendJoinRequest(request.id)}
                            disabled={resendingJoinRequestId === request.id}
                          >
                            <Send className="h-4 w-4 mr-1" />
                            {resendingJoinRequestId === request.id ? "Resending..." : "Resend Request"}
                          </Button>
                        )}
                        {(isPending || isApproved) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancelRequest(request.id)}
                            className="text-orange-600 hover:text-orange-700 border-orange-600 hover:border-orange-700"
                          >
                            <X className="h-4 w-4 mr-1" />
                            {isApproved ? "Leave Wallet" : "Cancel Request"}
                          </Button>
                        )}
                      </div>
                    </div>
                      );
                    })()
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Join Requests for Faculty */}
        {isFacultyEffective && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Wallet Join Requests</CardTitle>
              <CardDescription>
                Requests from students and 'Other' users to join your wallet
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingRequests ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              ) : joinRequests.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No join requests yet
                </p>
              ) : (
                <div className="space-y-3">
                  {facultyActionableJoinRequests.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 p-3 border rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="faculty-join-select-all"
                          checked={
                            facultyActionableJoinRequests.length > 0 &&
                            selectedFacultyJoinRequestIds.length === facultyActionableJoinRequests.length
                          }
                          onCheckedChange={(checked) => handleSelectAllFacultyJoinRequests(checked === true)}
                        />
                        <Label htmlFor="faculty-join-select-all" className="text-sm">
                          Select all actionable requests
                        </Label>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="default"
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          disabled={bulkJoinActionLoading !== false || facultyPendingSelectedCount === 0}
                          onClick={handleBulkApproveJoinRequests}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {bulkJoinActionLoading === "approve"
                            ? "Approving..."
                            : `Approve Selected (${facultyPendingSelectedCount})`}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={bulkJoinActionLoading !== false || facultyPendingSelectedCount === 0}
                          onClick={handleBulkRejectJoinRequests}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          {bulkJoinActionLoading === "reject"
                            ? "Rejecting..."
                            : `Reject Selected (${facultyPendingSelectedCount})`}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={bulkJoinActionLoading !== false || facultyApprovedSelectedCount === 0}
                          onClick={handleBulkRemoveStudents}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          {bulkJoinActionLoading === "remove"
                            ? "Removing..."
                            : `Remove Selected (${facultyApprovedSelectedCount})`}
                        </Button>
                      </div>
                    </div>
                  )}
                  {facultyCancelledJoinRequests.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 p-3 border rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="faculty-join-select-all-cancelled"
                          checked={
                            facultyCancelledJoinRequests.length > 0 &&
                            selectedFacultyCancelledJoinRequestIds.length === facultyCancelledJoinRequests.length
                          }
                          onCheckedChange={(checked) =>
                            handleSelectAllCancelledFacultyJoinRequests(checked === true)
                          }
                        />
                        <Label htmlFor="faculty-join-select-all-cancelled" className="text-sm">
                          Select all cancelled requests
                        </Label>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={bulkJoinActionLoading !== false || facultyCancelledSelectedCount === 0}
                        onClick={handleBulkDeleteCancelledJoinRequests}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        {bulkJoinActionLoading === "delete"
                          ? "Deleting..."
                          : `Delete Selected (${facultyCancelledSelectedCount})`}
                      </Button>
                    </div>
                  )}
                  {joinRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1 flex items-start gap-3">
                        {(request.status === "PENDING" || request.status === "APPROVED") && (
                          <Checkbox
                            className="mt-1"
                            checked={selectedFacultyJoinRequestIds.includes(request.id)}
                            onCheckedChange={(checked) =>
                              toggleFacultyJoinRequestSelection(request.id, checked === true)
                            }
                            aria-label={`Select ${request.student_name}`}
                          />
                        )}
                        {request.status === "CANCELLED" && (
                          <Checkbox
                            className="mt-1"
                            checked={selectedFacultyCancelledJoinRequestIds.includes(request.id)}
                            onCheckedChange={(checked) =>
                              toggleFacultyCancelledJoinRequestSelection(request.id, checked === true)
                            }
                            aria-label={`Select cancelled request ${request.student_name}`}
                          />
                        )}
                        <div className="flex-1">
                        <UserProfile
                          name={request.student_name}
                          email={request.student_email}
                          phone={request.student_phone}
                          profilePicture={request.student_profile_picture ? apiClient.getProfilePictureUrl(request.student) : undefined}
                          size="sm"
                          className="mb-2"
                        />
                        <div className="flex items-center gap-2 mb-1">
                          {request.status === "PENDING" && (
                            <Badge variant="secondary" className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {request.status_display || "Pending"}
                            </Badge>
                          )}
                          {request.status === "APPROVED" && (
                            <Badge variant="default" className="flex items-center gap-1 bg-green-600">
                              <CheckCircle className="h-3 w-3" />
                              {request.status_display || "Approved"}
                            </Badge>
                          )}
                          {request.status === "REJECTED" && (
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <XCircle className="h-3 w-3" />
                              {request.status_display || "Rejected"}
                            </Badge>
                          )}
                          {request.status === "CANCELLED" && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <X className="h-3 w-3" />
                              {request.status_display || "Cancelled"}
                            </Badge>
                          )}
                        </div>
                        {request.message && (
                          <p className="text-sm text-muted-foreground mt-1">{request.message}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(request.created_at).toLocaleString()}
                        </p>
                        </div>
                      </div>
                      {request.status === "PENDING" && (
                        <div className="flex gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleApproveRequest(request.id)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRejectRequest(request.id)}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}
                      {request.status === "APPROVED" && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveStudent(request.id)}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Remove Student
                        </Button>
                      )}
                      {request.status === "CANCELLED" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteCancelledJoinRequest(request.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recharge Request History */}
        {!isShared && (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recharge Request History</CardTitle>
                  <CardDescription>View your previous wallet recharge requests</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRechargeHistory(!showRechargeHistory)}
                >
                  {showRechargeHistory ? "Hide" : "Show"} History
                </Button>
              </div>
            </CardHeader>
            {showRechargeHistory && (
              <CardContent>
                {loadingRechargeRequests ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                ) : rechargeRequests.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No recharge requests yet
                  </p>
                ) : (
                  <div className="rounded-lg border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead className="whitespace-nowrap font-semibold">S.No.</TableHead>
                          <TableHead className="whitespace-nowrap font-semibold">Requested</TableHead>
                          <TableHead className="text-right whitespace-nowrap font-semibold">Amount</TableHead>
                          <TableHead className="whitespace-nowrap font-semibold min-w-[120px]">Department</TableHead>
                          <TableHead className="min-w-[140px] font-semibold">Project</TableHead>
                          <TableHead className="whitespace-nowrap font-semibold">Status</TableHead>
                          <TableHead className="whitespace-nowrap font-semibold text-center">SRIC</TableHead>
                          <TableHead className="min-w-[160px] font-semibold">Response</TableHead>
                          <TableHead className="whitespace-nowrap font-semibold">Processed</TableHead>
                          <TableHead className="text-right whitespace-nowrap font-semibold w-[1%]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rechargeRequests.map((req, rowIndex) => (
                          <TableRow key={req.id}>
                            <TableCell className="text-sm tabular-nums w-[3rem]">{rowIndex + 1}</TableCell>
                            <TableCell className="text-sm whitespace-nowrap">
                              {new Date(req.created_at).toLocaleString(undefined, {
                                dateStyle: "short",
                                timeStyle: "short",
                              })}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              ₹{Number(req.amount).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {req.department_name || "—"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {req.project_name ? (
                                <span className="line-clamp-2" title={[req.project_name, req.project_code].filter(Boolean).join(" · ")}>
                                  {req.project_name}
                                  {req.project_code ? ` (${req.project_code})` : ""}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {req.status === "PENDING" && (
                                <Badge variant="secondary" className="gap-1">
                                  <Clock className="h-3 w-3" />
                                  {req.status_display || "Pending"}
                                </Badge>
                              )}
                              {req.status === "APPROVED" && (
                                <Badge className="bg-green-600 hover:bg-green-700 gap-1">
                                  <CheckCircle className="h-3 w-3" />
                                  {req.status_display || "Approved"}
                                </Badge>
                              )}
                              {req.status === "REJECTED" && (
                                <Badge variant="destructive" className="gap-1">
                                  <XCircle className="h-3 w-3" />
                                  {req.status_display || "Rejected"}
                                </Badge>
                              )}
                              {req.status === "CANCELLED" && (
                                <Badge variant="outline" className="gap-1">
                                  <X className="h-3 w-3" />
                                  {req.status_display || "Cancelled"}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center text-sm">
                              {isFacultyEffective ? (
                                req.sric_notification_sent ? (
                                  <span className="text-emerald-600 dark:text-emerald-400">Yes</span>
                                ) : (
                                  <span className="text-muted-foreground">No</span>
                                )
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[220px]">
                              <span className="line-clamp-2" title={req.response_message || ""}>
                                {req.response_message || "—"}
                              </span>
                            </TableCell>
                            <TableCell className="text-sm whitespace-nowrap align-top">
                              {req.responded_at ? (
                                <div className="flex flex-col gap-0.5">
                                  <span>
                                    {new Date(req.responded_at).toLocaleString(undefined, {
                                      dateStyle: "short",
                                      timeStyle: "short",
                                    })}
                                  </span>
                                  {req.approved_by_email && (
                                    <span className="text-xs text-muted-foreground max-w-[180px] truncate" title={req.approved_by_email}>
                                      {req.approved_by_email}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right align-top">
                              {req.status === "PENDING" ? (
                                <div className="flex flex-col gap-1 items-end">
                                  {isFacultyEffective && !req.sric_notification_sent && (
                                    <Button
                                      variant="default"
                                      size="sm"
                                      className="h-8"
                                      onClick={() =>
                                        void handleSendSricNotification(req.id, () => {
                                          void fetchWalletData();
                                        })
                                      }
                                      disabled={sendingSric}
                                    >
                                      {sendingSric ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <>
                                          <Send className="h-3.5 w-3.5 mr-1" />
                                          SRIC
                                        </>
                                      )}
                                    </Button>
                                  )}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-blue-600 border-blue-600"
                                    onClick={async () => {
                                      setResendingNotification(req.id);
                                      try {
                                        const response = await apiClient.resendWalletRechargeNotification(req.id);
                                        if (response.error) {
                                          toast.error(response.error || "Failed to resend notification");
                                        } else {
                                          toast.success(response.data?.message || "Notification resent successfully");
                                        }
                                      } catch (error: any) {
                                        toast.error(error.message || "Failed to resend notification");
                                      } finally {
                                        setResendingNotification(null);
                                      }
                                    }}
                                    disabled={resendingNotification === req.id}
                                  >
                                    {resendingNotification === req.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <>
                                        <RefreshCw className="h-3.5 w-3.5 mr-1" />
                                        Resend
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-orange-600 border-orange-600"
                                    onClick={async () => {
                                      const response = await apiClient.cancelWalletRechargeRequest(req.id);
                                      if (response.error) {
                                        toast.error(response.error || "Failed to cancel request");
                                      } else {
                                        toast.success(response.data?.message || "Request removed");
                                        await fetchRechargeRequests();
                                      }
                                    }}
                                  >
                                    <X className="h-3.5 w-3.5 mr-1" />
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1.5 min-w-0">
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>
                  All credit and debit transactions across department sub-wallets. Net balance after each transaction is shown.
                </CardDescription>
                {!loading && transactions.length > 0 && !showTransactionHistoryExpanded && (
                  <p className="text-sm text-muted-foreground pt-1">
                    {transactions.length} transaction{transactions.length !== 1 ? "s" : ""} on record.
                    Use <span className="font-medium text-foreground">Show full history</span> to open filters, search, and export.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {showTransactionHistoryExpanded && !loading && transactions.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="shrink-0 gap-2">
                        <Download className="h-4 w-4" />
                        Download
                        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          if (filteredTransactions.length === 0) {
                            toast.error("No transactions match the current filters.");
                            return;
                          }
                          exportWalletTransactionsExcel(filteredTransactions, {
                            sheetTitle: "Transactions",
                          });
                          toast.success("Excel file downloaded.");
                        }}
                      >
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Excel (.xlsx)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          if (filteredTransactions.length === 0) {
                            toast.error("No transactions match the current filters.");
                            return;
                          }
                          exportWalletTransactionsPdf(filteredTransactions, {
                            title: "Wallet transaction history",
                          });
                          toast.success("PDF downloaded.");
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {!loading && transactions.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setShowTransactionHistoryExpanded(!showTransactionHistoryExpanded)}
                  >
                    {showTransactionHistoryExpanded ? (
                      <>
                        <ChevronUp className="h-4 w-4" />
                        Minimize
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4" />
                        Show full history
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="font-medium">No transactions yet</p>
                <p className="text-sm mt-1">Transactions will appear here when you recharge or make bookings.</p>
              </div>
            ) : showTransactionHistoryExpanded ? (
              <>
                <div className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-lg bg-muted/40 border border-border/60">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Type</Label>
                    <Select value={txTypeFilter} onValueChange={(v) => setTxTypeFilter(v as "all" | "credit" | "debit")}>
                      <SelectTrigger className="w-[120px] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="credit">Credit</SelectItem>
                        <SelectItem value="debit">Debit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">From</Label>
                    <Input
                      type="date"
                      className="w-[140px] h-9"
                      value={txDateFrom}
                      onChange={(e) => setTxDateFrom(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">To</Label>
                    <Input
                      type="date"
                      className="w-[140px] h-9"
                      value={txDateTo}
                      onChange={(e) => setTxDateTo(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Department</Label>
                    <Select value={txDepartmentFilter || "__all__"} onValueChange={(v) => setTxDepartmentFilter(v === "__all__" ? "" : v)}>
                      <SelectTrigger className="w-[160px] h-9">
                        <SelectValue placeholder="All departments" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All departments</SelectItem>
                        {uniqueDepartmentsForFilter.map((dept) => (
                          <SelectItem key={dept} value={dept}>
                            {dept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Equipment</Label>
                    <Select value={txEquipmentFilter || "__all__"} onValueChange={(v) => setTxEquipmentFilter(v === "__all__" ? "" : v)}>
                      <SelectTrigger className="w-[180px] h-9">
                        <SelectValue placeholder="All equipment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All equipment</SelectItem>
                        {uniqueEquipmentNamesForFilter.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Booked by</Label>
                    <Select
                      value={txBookedByFilter || "__all__"}
                      onValueChange={(v) => setTxBookedByFilter(v === "__all__" ? "" : v)}
                    >
                      <SelectTrigger className="w-[180px] h-9">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">All</SelectItem>
                        {hasUnassignedBookedBy && (
                          <SelectItem value="__booked_by_unassigned__">Unassigned</SelectItem>
                        )}
                        {uniqueBookedByForFilter.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                    <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input
                      placeholder="Search description or equipment..."
                      className="h-9"
                      value={txSearchText}
                      onChange={(e) => setTxSearchText(e.target.value)}
                    />
                  </div>
                  {(txTypeFilter !== "all" || txDateFrom || txDateTo || txDepartmentFilter || txEquipmentFilter || txBookedByFilter || txSearchText.trim()) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9"
                      onClick={() => {
                        setTxTypeFilter("all");
                        setTxDateFrom("");
                        setTxDateTo("");
                        setTxDepartmentFilter("");
                        setTxEquipmentFilter("");
                        setTxBookedByFilter("");
                        setTxSearchText("");
                      }}
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
                <div className="rounded-xl border border-border/80 overflow-hidden shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border">
                      <TableHead className="font-semibold text-foreground min-w-[180px]">Equipment Name</TableHead>
                      <TableHead className="font-semibold text-foreground min-w-[140px]">Booked by</TableHead>
                      <TableHead className="font-semibold text-foreground w-[160px]">Date &amp; Time</TableHead>
                      <TableHead className="font-semibold text-foreground w-[100px]">Type</TableHead>
                      <TableHead className="font-semibold text-foreground min-w-[220px]">Description</TableHead>
                      <TableHead className="font-semibold text-foreground text-right w-[120px]">Amount</TableHead>
                      <TableHead className="font-semibold text-foreground text-right w-[130px]">Balance Remaining</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No transactions match the current filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTransactions.map((transaction) => (
                      <TableRow
                        key={transaction.id}
                        className="group hover:bg-muted/30 transition-colors border-b border-border/60 last:border-b-0"
                      >
                        <TableCell className="text-sm text-muted-foreground align-middle min-w-[180px]">
                          {transaction.equipment_name ? (
                            <span className="font-medium text-foreground" title={transaction.equipment_name}>
                              {transaction.equipment_name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/70">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground align-middle min-w-[140px]">
                          {transaction.related_user_name ? (
                            <span className="text-foreground" title={transaction.related_user_email || undefined}>
                              {transaction.related_user_name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/70">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground align-middle whitespace-nowrap">
                          {new Date(transaction.created_at).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </TableCell>
                        <TableCell className="align-middle">
                          {transaction.transaction_type === "credit" ? (
                            <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1">
                              <Plus className="h-3 w-3" />
                              Credit
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="font-medium gap-1">
                              <Minus className="h-3 w-3" />
                              Debit
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-foreground/90 align-middle max-w-[360px]">
                          <span className="line-clamp-2" title={(transaction.description_display || transaction.description) || ""}>
                            {transaction.description_display || transaction.description || "—"}
                          </span>
                          {transaction.department_name && (
                            <span className="text-xs text-muted-foreground block mt-0.5">
                              {transaction.department_name}
                              {transaction.department_code ? ` (${transaction.department_code})` : ""}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium align-middle">
                          {transaction.transaction_type === "credit" ? (
                            <span className="text-emerald-600 dark:text-emerald-400">+₹{Number(transaction.amount).toFixed(2)}</span>
                          ) : (
                            <span className="text-red-600 dark:text-red-400">−₹{Number(transaction.amount).toFixed(2)}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-foreground align-middle">
                          {transaction.balance_after != null && String(transaction.balance_after) !== "" ? (
                            <span>₹{Number(transaction.balance_after).toFixed(2)}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </main>

      <Dialog
        open={availCreditOpen}
        onOpenChange={(open) => {
          setAvailCreditOpen(open);
          if (!open) {
            setAvailCreditDeptId(null);
            setAvailCreditAmount("");
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Avail Credit Facility</DialogTitle>
            <DialogDescription>
              One-time department credit for your sub-wallet. Review the terms carefully before confirming.
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const status = availCreditDeptId != null ? deptFacultyCreditByDept[availCreditDeptId] : null;
            const max =
              parseFloat(String(status?.department_max_credit_limit || status?.credit_limit || "0")) || 0;
            const outstanding =
              parseFloat(String(status?.outstanding_credit || "0")) || 0;
            const remaining =
              parseFloat(String(status?.remaining_credit || max)) || max;
            const fmt = (n: number) =>
              n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
            return (
              <div className="space-y-4 py-1">
                {status && (
                  <p className="text-sm text-muted-foreground">
                    Department:{" "}
                    <span className="font-medium text-foreground">{status.department_name}</span>
                  </p>
                )}

                <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Maximum credit</span>
                    <span className="font-medium">₹{fmt(max)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Already utilized</span>
                    <span className="font-medium">₹{fmt(outstanding)}</span>
                  </div>
                  <div className="flex justify-between gap-2 border-t pt-1.5">
                    <span className="text-muted-foreground">Maximum additional credit available</span>
                    <span className="font-semibold text-primary">₹{fmt(remaining)}</span>
                  </div>
                </div>

                <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4 leading-relaxed">
                  <li>This is a one-time credit facility for this department only.</li>
                  <li>
                    Approved credit applies only to bookings against this department&apos;s sub-wallet — it
                    cannot be transferred or used for equipment in other departments.
                  </li>
                  <li>Each department independently manages its own credit policy.</li>
                  <li>Please recharge this sub-wallet at the earliest opportunity.</li>
                  <li>Future wallet recharges automatically recover the outstanding credit balance.</li>
                  <li>
                    Once outstanding credit is fully recovered, the facility is permanently closed and cannot
                    be availed again.
                  </li>
                </ul>

                <div className="space-y-2">
                  <Label htmlFor="avail-credit-amount">Credit amount required (₹)</Label>
                  <Input
                    id="avail-credit-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={remaining || undefined}
                    value={availCreditAmount}
                    onChange={(e) => setAvailCreditAmount(e.target.value)}
                    disabled={availingCredit}
                    placeholder="Enter amount"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter an amount greater than 0 and up to ₹{fmt(remaining)}.
                  </p>
                  {parseFloat(availCreditAmount) > remaining && remaining > 0 && (
                    <p className="text-xs text-destructive">
                      Amount exceeds the maximum additional credit available.
                    </p>
                  )}
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAvailCreditOpen(false)}
              disabled={availingCredit}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleAvailCreditFacility()}
              disabled={
                availingCredit ||
                !availCreditAmount ||
                parseFloat(availCreditAmount) <= 0 ||
                (availCreditDeptId != null &&
                  parseFloat(availCreditAmount) >
                    (parseFloat(
                      String(
                        deptFacultyCreditByDept[availCreditDeptId]?.remaining_credit ||
                          deptFacultyCreditByDept[availCreditDeptId]?.department_max_credit_limit ||
                          deptFacultyCreditByDept[availCreditDeptId]?.credit_limit ||
                          "0"
                      )
                    ) || 0))
              }
            >
              {availingCredit ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Confirming...
                </>
              ) : (
                "Confirm & Avail"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {AlertComponent}
      {ConfirmComponent}
    </div>
  );
};

export default Wallet;