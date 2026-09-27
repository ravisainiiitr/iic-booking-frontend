import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { isExternalBookingUserType } from "@/lib/userTypes";
import { formatMoney, rechargeModeLabel, summarizeRechargeRequests } from "@/lib/walletRecharge";
import RechargeWalletDialog from "@/components/wallet/RechargeWalletDialog";
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
import { AlertTriangle, ArrowUp, Send, X, Clock, CheckCircle, XCircle, CreditCard, FileText, ChevronDown, ChevronUp, Building2, RefreshCw, Search, User, Minus, Plus, Loader2, Landmark, Download, FileSpreadsheet, Trash2, Upload } from "lucide-react";
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

const RECENT_TRANSACTIONS_COUNT = 5;
const RECENT_RECHARGE_REQUESTS_COUNT = 3;
const SUB_WALLET_SEARCH_THRESHOLD = 8;

/** Legacy "add project on Profile" round-trip keys; recharge no longer leaves the Wallet page. */
function clearLegacyRechargeDraft() {
  sessionStorage.removeItem("walletRechargeDraft");
  sessionStorage.removeItem("returnToWalletRecharge");
}

type RechargeDialogState = { departmentId: number | null; amount: string | null };

function RechargeStatusBadge({ request }: { request: { status?: string; status_display?: string; user_otp_verified?: boolean } }) {
  const status = String(request.status || "").toUpperCase();
  if (status === "PENDING" && request.user_otp_verified === false) {
    return <Badge variant="outline" className="shrink-0">Awaiting OTP</Badge>;
  }
  if (status === "APPROVED") {
    return <Badge className="shrink-0 bg-green-600 hover:bg-green-600">{request.status_display || "Approved"}</Badge>;
  }
  if (status === "REJECTED") {
    return <Badge variant="destructive" className="shrink-0">{request.status_display || "Rejected"}</Badge>;
  }
  if (status === "CANCELLED") {
    return <Badge variant="outline" className="shrink-0">{request.status_display || "Cancelled"}</Badge>;
  }
  return <Badge variant="secondary" className="shrink-0">{request.status_display || "Pending"}</Badge>;
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
  id: number | string;
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
  provenance?: string;
  source_system?: string;
  immutable?: boolean;
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
  /** Non-null while the recharge dialog is open; the dialog is remounted (fresh state) on every open. */
  const [rechargeDialog, setRechargeDialog] = useState<RechargeDialogState | null>(null);
  const [sendingSric, setSendingSric] = useState(false);
  const [rechargeRequests, setRechargeRequests] = useState<any[]>([]);
  const [loadingRechargeRequests, setLoadingRechargeRequests] = useState(false);
  const [showRechargeHistory, setShowRechargeHistory] = useState(false);
  const [receiptAttachRow, setReceiptAttachRow] = useState<any | null>(null);
  const [receiptAttachUtr, setReceiptAttachUtr] = useState("");
  const [receiptAttachFile, setReceiptAttachFile] = useState<File | null>(null);
  const [submittingReceiptAttach, setSubmittingReceiptAttach] = useState(false);
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
  const [subWalletSearch, setSubWalletSearch] = useState("");
  const SUB_WALLETS_PREVIEW_COUNT = 5;
  const [transactionsTotal, setTransactionsTotal] = useState(0);
  const [fullTransactionsLoaded, setFullTransactionsLoaded] = useState(false);
  const [loadingFullTransactions, setLoadingFullTransactions] = useState(false);
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

  const openRechargeDialog = useCallback((departmentId?: number | null, amount?: string | null) => {
    setRechargeDialog({ departmentId: departmentId ?? null, amount: amount ?? null });
  }, []);

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
      const amountRaw = searchParams.get("amount");
      const amount = amountRaw && /^\d{1,8}(\.\d{1,2})?$/.test(amountRaw) ? amountRaw : null;
      navigate("/wallet", { replace: true });
      clearLegacyRechargeDraft();
      openRechargeDialog(deptId, amount);
      return;
    }

    // Older builds sent faculty to Profile to add a project and restored a draft on return.
    if (sessionStorage.getItem("returnToWalletRecharge") === "true") {
      clearLegacyRechargeDraft();
      openRechargeDialog();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount for URL / session restore
  }, []);

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

  // Fetch join requests when request form is shown
  useEffect(() => {
    if (showRequestForm) {
      fetchJoinRequests();
    }
  }, [showRequestForm]);

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
        localStorage.setItem(
          'wallet_balance_cache_v2',
          JSON.stringify({ balance: newBalance, ts: now })
        );
        
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

  /** Recent rows + total count only; the full list (for filters/export) loads when history is expanded. */
  const fetchTransactions = async (full = fullTransactionsLoaded) => {
    try {
      if (full) setLoadingFullTransactions(true);
      const txnResponse = await apiClient.getWalletTransactions(full ? 5000 : RECENT_TRANSACTIONS_COUNT, 0);
      if (txnResponse.data?.transactions) {
        const rows = txnResponse.data.transactions;
        const total = Number(txnResponse.data.total_count);
        setTransactionsTotal(Number.isFinite(total) && total > 0 ? total : rows.length);
        if (full) setFullTransactionsLoaded(true);
        const mapped: Transaction[] = rows.map((tx: any) => ({
          id: tx.id,
          transaction_type: tx.transaction_type,
          amount: String(tx.amount),
          description: tx.description || "",
          description_display: tx.description_display || tx.description || "",
          created_at: tx.created_at,
          department_name: tx.department_name,
          department_code: tx.department_code ?? null,
          balance_after: tx.balance_after ?? null,
          equipment_name: tx.equipment_name ?? null,
          virtual_booking_id: tx.virtual_booking_id ?? null,
          related_user_name: tx.related_user_name ?? null,
          related_user_email: tx.related_user_email ?? null,
          provenance: tx.provenance,
          source_system: tx.source_system,
          immutable: Boolean(tx.immutable),
        }));
        setTransactions(mapped);
      } else {
        setTransactions([]);
        setTransactionsTotal(0);
      }
    } catch (error) {
      console.error("Failed to fetch wallet transactions:", error);
      setTransactions([]);
    } finally {
      if (full) setLoadingFullTransactions(false);
    }
  };

  const toggleFullTransactionHistory = () => {
    const next = !showTransactionHistoryExpanded;
    setShowTransactionHistoryExpanded(next);
    if (next && !fullTransactionsLoaded) {
      void fetchTransactions(true);
    }
  };

  // Refetch transactions when sub-wallets change (e.g., after recharge)
  useEffect(() => {
    if (!loading) {
      fetchTransactions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subWallets.length, loading]);

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

  const handleSendSricNotification = async (requestId: number, onSuccess?: () => void) => {
    try {
      setSendingSric(true);
      const response = await apiClient.sendSricWalletRechargeNotification(requestId);
      if (response.error) {
        toast.error(response.error);
        return;
      }
      toast.success(response.data?.message || "Request sent to SRIC.");
      await fetchWalletData();
      await fetchRechargeRequests();
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to send to SRIC");
    } finally {
      setSendingSric(false);
    }
  };

  const handleRechargeSubmitted = () => {
    void fetchWalletData();
    void fetchRechargeRequests();
  };

  const filteredSubWallets = useMemo(() => {
    const q = subWalletSearch.trim().toLowerCase();
    if (!q) return subWallets;
    return subWallets.filter(
      (sw) =>
        sw.department_name.toLowerCase().includes(q) ||
        (sw.department_code || "").toLowerCase().includes(q)
    );
  }, [subWallets, subWalletSearch]);

  const visibleSubWallets =
    showAllSubWallets || subWalletSearch.trim()
      ? filteredSubWallets
      : filteredSubWallets.slice(0, SUB_WALLETS_PREVIEW_COUNT);

  const rechargeSummary = useMemo(() => summarizeRechargeRequests(rechargeRequests), [rechargeRequests]);

  const recentRechargeRequests = useMemo(
    () =>
      [...rechargeRequests]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, RECENT_RECHARGE_REQUESTS_COUNT),
    [rechargeRequests]
  );

  const creditFacilityRows = useMemo(
    () =>
      Object.values(deptFacultyCreditByDept)
        .filter((c) => {
          const s = String(c.status || "").toLowerCase();
          return s === "active" || s === "exhausted" || Boolean(c.can_avail);
        })
        .sort((a, b) => a.department_name.localeCompare(b.department_name)),
    [deptFacultyCreditByDept]
  );

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
        <main className="container mx-auto px-4 py-5">
          <div className="mb-5 border-b border-border pb-4">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Request Wallet Access</h1>
            <p className="mt-1 text-sm text-muted-foreground">
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
              {isStudent && (
                <div
                  role="note"
                  className="flex items-start gap-3 rounded-lg border-2 border-amber-500 bg-amber-50 p-4 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
                >
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                  <p className="text-sm sm:text-base font-bold leading-snug">
                    Note: If your Faculty / Supervisor&apos;s name is not visible in the search, please ask your
                    Supervisor to log in to the new portal using Channel I.
                  </p>
                </div>
              )}
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
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="mb-5 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Wallet</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isShared
                ? "View the shared faculty wallet balance, sub-wallets and transactions."
                : "Manage your wallet balance, recharge requests, transfers and credit."}
            </p>
          </div>
          {canShowWalletRecharge && (
            <Button onClick={() => openRechargeDialog()} className="w-full sm:w-auto shrink-0" data-testid="wallet-recharge-button">
              <Plus className="h-4 w-4 mr-1.5" />
              Recharge Wallet
            </Button>
          )}
        </div>

        <div className="mb-5 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
          <div className="min-w-0 space-y-5">
            <Card className="rounded-lg border-border shadow-sm">
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-muted-foreground">Current Balance</p>
                    <p
                      className="mt-1 text-3xl sm:text-4xl font-semibold tabular-nums tracking-tight text-foreground"
                      data-testid="wallet-balance"
                    >
                      {formatMoney(balance)}
                    </p>
                    <p className="mt-1.5 text-sm text-muted-foreground">
                      {isShared
                        ? isIitrStudentReceiptOffline
                          ? "Funds sit in your faculty supervisor’s wallet. Recharges you submit credit that wallet for the department you choose."
                          : "Available funds in the shared faculty wallet."
                        : "Consolidated balance across your department sub-wallets."}
                    </p>
                  </div>
                  {!isShared && (
                    <div className="flex flex-wrap gap-2 shrink-0">
                      {isFacultyEffective && (
                        <Button variant="outline" size="sm" onClick={() => navigate("/wallet/transfer")}>
                          <ArrowUp className="h-4 w-4 mr-1.5 rotate-45" />
                          Transfer
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => navigate("/wallet/credit-facility")}>
                        <CreditCard className="h-4 w-4 mr-1.5" />
                        Credit Facility
                      </Button>
                    </div>
                  )}
                </div>
                {canShowWalletRecharge && isStudent && isShared && (
                  <p className="mt-4 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    Use <span className="font-medium text-foreground">Recharge Wallet</span> to submit a cash / bank
                    transfer or payment-receipt request. Funds park in your faculty wallet after approval.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-lg border-border shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    Department sub-wallets
                  </CardTitle>
                  <CardDescription className="mt-1 text-xs">
                    {isShared
                      ? "Equipment bookings deduct from the matching department sub-wallet."
                      : "Funds allocated by department. Bookings deduct from the matching sub-wallet."}
                  </CardDescription>
                </div>
                {subWallets.length > 0 && (
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {subWallets.length} {subWallets.length === 1 ? "department" : "departments"}
                  </span>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                {subWallets.length === 0 ? (
                  <p className="py-4 text-sm text-muted-foreground">
                    No department sub-wallets yet. A sub-wallet is created when a recharge is credited to a department.
                  </p>
                ) : (
                  <>
                    {subWallets.length > SUB_WALLET_SEARCH_THRESHOLD && (
                      <div className="relative mb-3">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={subWalletSearch}
                          onChange={(e) => setSubWalletSearch(e.target.value)}
                          placeholder="Search department or code"
                          className="h-9 pl-8"
                          aria-label="Search sub-wallets"
                        />
                      </div>
                    )}
                    <div className="overflow-hidden rounded-md border border-border">
                      <div className="grid grid-cols-[minmax(0,1fr)_3rem_6.5rem] gap-2 bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground sm:grid-cols-[minmax(0,1fr)_5.5rem_8rem]">
                        <span>Department</span>
                        <span>Code</span>
                        <span className="text-right">Balance</span>
                      </div>
                      {visibleSubWallets.length === 0 ? (
                        <p className="px-3 py-4 text-sm text-muted-foreground">No departments match your search.</p>
                      ) : (
                        <ul className="divide-y divide-border">
                          {visibleSubWallets.map((sw) => (
                            <li
                              key={sw.id}
                              className="grid grid-cols-[minmax(0,1fr)_3rem_6.5rem] items-center gap-2 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_5.5rem_8rem]"
                            >
                              <span className="break-words font-medium leading-snug text-foreground sm:truncate" title={sw.department_name}>
                                {sw.department_name}
                              </span>
                              <span className="truncate text-muted-foreground">{sw.department_code || "—"}</span>
                              <span className="text-right font-medium tabular-nums text-foreground">
                                {formatMoney(sw.balance)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {!subWalletSearch.trim() && filteredSubWallets.length > SUB_WALLETS_PREVIEW_COUNT && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 w-full text-muted-foreground hover:text-foreground"
                        onClick={() => setShowAllSubWallets((v) => !v)}
                      >
                        {showAllSubWallets ? (
                          <>
                            <ChevronUp className="h-4 w-4 mr-1.5" />
                            Show fewer
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4 mr-1.5" />
                            Show all {filteredSubWallets.length}
                          </>
                        )}
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="min-w-0 space-y-5">
            {isShared && walletOwner && (
              <Card className="rounded-lg border-border shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Supervisor</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <UserProfile
                    name={walletOwner.name}
                    email={walletOwner.email}
                    phone={walletOwner.phone}
                    profilePicture={
                      walletOwner.profile_picture && walletOwner.id != null
                        ? apiClient.getProfilePictureUrl(walletOwner.id)
                        : undefined
                    }
                    size="md"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const approvedRequest = joinRequests.find(
                        (req: any) => req.status === "APPROVED"
                      );
                      if (approvedRequest) {
                        await handleCancelRequest(approvedRequest.id);
                      } else {
                        toast.error("No active wallet connection found to leave.");
                      }
                    }}
                    className="w-full text-orange-600 hover:text-orange-700 border-orange-600/70 hover:border-orange-700"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Leave Wallet
                  </Button>
                </CardContent>
              </Card>
            )}

            {!isShared && (
              <Card className="rounded-lg border-border shadow-sm" data-testid="recharge-requests-summary">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Recharge requests</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Pending", value: rechargeSummary.pending },
                      { label: "Approved", value: rechargeSummary.approved },
                      { label: "Rejected", value: rechargeSummary.rejected },
                    ].map((s) => (
                      <div key={s.label} className="rounded-md border border-border px-3 py-2">
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                        <p className="text-lg font-semibold tabular-nums text-foreground">{s.value}</p>
                      </div>
                    ))}
                  </div>
                  {rechargeSummary.awaitingOtp > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {rechargeSummary.awaitingOtp} request{rechargeSummary.awaitingOtp === 1 ? " is" : "s are"} awaiting OTP
                      verification and {rechargeSummary.awaitingOtp === 1 ? "has" : "have"} not been submitted.
                    </p>
                  )}
                  {loadingRechargeRequests && rechargeRequests.length === 0 ? (
                    <div className="flex justify-center py-3">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : recentRechargeRequests.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No recharge requests yet.</p>
                  ) : (
                    <ul className="divide-y divide-border rounded-md border border-border">
                      {recentRechargeRequests.map((req) => (
                        <li key={req.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                          <div className="min-w-0">
                            <p className="font-medium tabular-nums text-foreground">{formatMoney(req.amount)}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {new Date(req.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
                              {" · "}
                              {rechargeModeLabel(req.recharge_mode)}
                              {req.project_code ? ` · ${req.project_code}` : ""}
                            </p>
                          </div>
                          <RechargeStatusBadge request={req} />
                        </li>
                      ))}
                    </ul>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setShowRechargeHistory(true);
                      window.setTimeout(() => {
                        document.getElementById("recharge-history")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }, 50);
                    }}
                  >
                    View recharge history
                  </Button>
                </CardContent>
              </Card>
            )}

            {isFacultyEffective && !isShared && creditFacilityRows.length > 0 && (
              <Card className="rounded-lg border-border shadow-sm" data-testid="credit-facility-summary">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Credit facility</CardTitle>
                  <CardDescription className="text-xs">Temporary department credit, where eligible.</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {creditFacilityRows.map((credit) => {
                      const statusLower = String(credit.status || "").toLowerCase();
                      const isOpen = statusLower === "active" || statusLower === "exhausted";
                      return (
                        <li key={credit.department_id} className="space-y-1.5 px-3 py-2 text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-medium text-foreground">{credit.department_name}</span>
                            {isOpen ? (
                              <Badge variant={statusLower === "exhausted" ? "destructive" : "secondary"}>
                                {credit.status_display || (statusLower === "exhausted" ? "Exhausted" : "Active")}
                              </Badge>
                            ) : (
                              <Badge variant="outline">Available</Badge>
                            )}
                          </div>
                          {isOpen && (
                            <p className="text-xs text-muted-foreground tabular-nums">
                              Outstanding {formatMoney(credit.outstanding_credit)} · Remaining{" "}
                              {formatMoney(credit.remaining_credit)} of {formatMoney(credit.credit_limit)}
                            </p>
                          )}
                          {credit.can_avail && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8"
                              onClick={() => openAvailCreditDialog(credit.department_id)}
                            >
                              Avail credit
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Recharge Request History */}
        {!isShared && showRechargeHistory && (
          <Card id="recharge-history" className="mb-5 scroll-mt-20 rounded-lg border-border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-base">Recharge request history</CardTitle>
                  <CardDescription className="text-xs">
                    All wallet recharge requests
                    {isStudent
                      ? ". For approved requests you may optionally add or update a receipt number / upload."
                      : "."}
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowRechargeHistory(false)}>
                  <ChevronUp className="h-4 w-4 mr-1.5" />
                  Hide
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
                          <TableHead className="whitespace-nowrap font-semibold">Transaction</TableHead>
                          <TableHead className="whitespace-nowrap font-semibold">Requested</TableHead>
                          <TableHead className="text-right whitespace-nowrap font-semibold">Amount</TableHead>
                          <TableHead className="whitespace-nowrap font-semibold">Mode</TableHead>
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
                            <TableCell className="text-sm font-medium whitespace-nowrap">
                              {req.transaction_number || req.request_id || `#${req.id}`}
                            </TableCell>
                            <TableCell className="text-sm whitespace-nowrap">
                              {new Date(req.created_at).toLocaleString(undefined, {
                                dateStyle: "short",
                                timeStyle: "short",
                              })}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              ₹{Number(req.amount).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-sm whitespace-nowrap">
                              {rechargeModeLabel(req.recharge_mode)}
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
                              <RechargeStatusBadge request={req} />
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
                              ) : req.status === "APPROVED" ? (
                                <div className="flex flex-col gap-1 items-end">
                                  {req.utr_reference ? (
                                    <span
                                      className="text-xs text-muted-foreground max-w-[140px] truncate"
                                      title={String(req.utr_reference)}
                                    >
                                      Receipt: {req.utr_reference}
                                    </span>
                                  ) : null}
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8"
                                    onClick={() => {
                                      setReceiptAttachRow(req);
                                      setReceiptAttachUtr(String(req.utr_reference || ""));
                                      setReceiptAttachFile(null);
                                    }}
                                  >
                                    <Upload className="h-3.5 w-3.5 mr-1" />
                                    {req.utr_reference || (req.payment_receipts?.length ?? 0) > 0
                                      ? "Update receipt"
                                      : "Upload receipt"}
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

        <Card className="mb-5 rounded-lg border-border shadow-sm" data-testid="transaction-history">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-base">Transaction history</CardTitle>
                <CardDescription className="text-xs">
                  {transactionsTotal > 0
                    ? `${transactionsTotal.toLocaleString("en-IN")} transaction${transactionsTotal !== 1 ? "s" : ""} across department sub-wallets.`
                    : "Credits and debits across department sub-wallets."}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {showTransactionHistoryExpanded && fullTransactionsLoaded && transactions.length > 0 && (
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
                          void (async () => {
                            if (filteredTransactions.length === 0) {
                              toast.error("No transactions match the current filters.");
                              return;
                            }
                            try {
                              await exportWalletTransactionsPdf(filteredTransactions, {
                                title: "Wallet transaction history",
                              });
                              toast.success("PDF downloaded.");
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "PDF export failed");
                            }
                          })();
                        }}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {transactionsTotal > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={toggleFullTransactionHistory}
                  >
                    {showTransactionHistoryExpanded ? (
                      <>
                        <ChevronUp className="h-4 w-4" />
                        Show recent only
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4" />
                        View full history
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {transactions.length === 0 && !loadingFullTransactions ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No transactions yet. Transactions appear here after recharges and bookings.
              </p>
            ) : showTransactionHistoryExpanded && loadingFullTransactions ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading full history…
              </div>
            ) : !showTransactionHistoryExpanded ? (
              <ul className="divide-y divide-border rounded-md border border-border" data-testid="recent-transactions">
                {transactions.slice(0, RECENT_TRANSACTIONS_COUNT).map((transaction) => (
                  <li key={transaction.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate text-foreground" title={transaction.description_display || transaction.description}>
                        {transaction.equipment_name || transaction.description_display || transaction.description || "—"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {new Date(transaction.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                        {transaction.department_name ? ` · ${transaction.department_name}` : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 font-medium tabular-nums ${
                        transaction.transaction_type === "credit"
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-red-700 dark:text-red-400"
                      }`}
                    >
                      {transaction.transaction_type === "credit" ? "+" : "−"}
                      {formatMoney(transaction.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-3 mb-4 p-3 rounded-lg bg-muted/40 border border-border/60">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Type</Label>
                    <Select value={txTypeFilter} onValueChange={(v) => setTxTypeFilter(v as "all" | "credit" | "debit")}>
                      <SelectTrigger className="w-full sm:w-[120px] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="credit">Credit</SelectItem>
                        <SelectItem value="debit">Debit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">From</Label>
                    <Input
                      type="date"
                      className="w-full sm:w-[140px] h-9"
                      value={txDateFrom}
                      onChange={(e) => setTxDateFrom(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">To</Label>
                    <Input
                      type="date"
                      className="w-full sm:w-[140px] h-9"
                      value={txDateTo}
                      onChange={(e) => setTxDateTo(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Department</Label>
                    <Select value={txDepartmentFilter || "__all__"} onValueChange={(v) => setTxDepartmentFilter(v === "__all__" ? "" : v)}>
                      <SelectTrigger className="w-full sm:w-[160px] h-9">
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
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Equipment</Label>
                    <Select value={txEquipmentFilter || "__all__"} onValueChange={(v) => setTxEquipmentFilter(v === "__all__" ? "" : v)}>
                      <SelectTrigger className="w-full sm:w-[180px] h-9">
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
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Booked by</Label>
                    <Select
                      value={txBookedByFilter || "__all__"}
                      onValueChange={(v) => setTxBookedByFilter(v === "__all__" ? "" : v)}
                    >
                      <SelectTrigger className="w-full sm:w-[180px] h-9">
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
                  <div className="flex items-center gap-2 flex-1 min-w-0 sm:min-w-[180px] w-full">
                    <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input
                      placeholder="Search description or equipment..."
                      className="h-9 w-full"
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
                  <div className="table-scroll overflow-x-auto">                <Table>
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
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            {transaction.provenance ? (
                              <Badge
                                variant="outline"
                                className={
                                  transaction.provenance === "Legacy Portal"
                                    ? "border-amber-400/70 bg-amber-50 text-amber-900 text-[10px] px-1.5 py-0"
                                    : "border-sky-400/70 bg-sky-50 text-sky-900 text-[10px] px-1.5 py-0"
                                }
                              >
                                {transaction.provenance}
                              </Badge>
                            ) : null}
                            {transaction.department_name ? (
                              <span className="text-xs text-muted-foreground">
                                {transaction.department_name}
                                {transaction.department_code ? ` (${transaction.department_code})` : ""}
                              </span>
                            ) : null}
                          </div>
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
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* External users: Withdraw/transfer wallet balance to bank */}
        {isExternalUser && !isShared && (
          <Card className="mb-6">
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
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 safe-pad">
                      <Card className="w-full max-w-md max-h-[90dvh] overflow-y-auto mx-0">
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

        {/* Join Requests for Students and Other Users */}
        {/* Show for students and Other users (not individual students) */}
        {shouldShowFacultyWalletSection && (
          <Card className="mb-6">
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
                        {(isPending || (isApproved && !(isShared && walletOwner))) && (
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
          <Card className="mb-6">
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

      </main>

      {rechargeDialog && canShowWalletRecharge && (
        <RechargeWalletDialog
          onClose={() => setRechargeDialog(null)}
          onSubmitted={handleRechargeSubmitted}
          isFaculty={isFacultyEffective}
          userType={user?.user_type}
          isStudentReceiptOffline={isIitrStudentReceiptOffline}
          subWallets={subWallets}
          initialDepartmentId={rechargeDialog.departmentId}
          initialAmount={rechargeDialog.amount}
        />
      )}

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

      <Dialog
        open={!!receiptAttachRow}
        onOpenChange={(open) => {
          if (!open) {
            setReceiptAttachRow(null);
            setReceiptAttachUtr("");
            setReceiptAttachFile(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add / update receipt</DialogTitle>
            <DialogDescription>
              Optional for approved recharge{" "}
              {receiptAttachRow?.transaction_number ||
                receiptAttachRow?.request_id ||
                (receiptAttachRow ? `#${receiptAttachRow.id}` : "")}{" "}
              — ₹
              {receiptAttachRow ? Number(receiptAttachRow.amount).toFixed(2) : ""}. Enter a receipt / UTR
              number and/or upload a scan for Accounts reconciliation. At least one is required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="approved-receipt-utr">Receipt / UTR number (optional)</Label>
              <Input
                id="approved-receipt-utr"
                value={receiptAttachUtr}
                onChange={(e) => setReceiptAttachUtr(e.target.value)}
                placeholder="e.g. bank UTR or physical receipt number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="approved-receipt-file">Upload receipt file (optional)</Label>
              <Input
                id="approved-receipt-file"
                type="file"
                accept="image/*,.pdf,application/pdf"
                onChange={(e) => setReceiptAttachFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">PDF or image. Leave blank to keep the existing file.</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReceiptAttachRow(null);
                setReceiptAttachUtr("");
                setReceiptAttachFile(null);
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={
                submittingReceiptAttach ||
                (!receiptAttachUtr.trim() && !receiptAttachFile)
              }
              onClick={async () => {
                if (!receiptAttachRow) return;
                if (!receiptAttachUtr.trim() && !receiptAttachFile) {
                  toast.error("Enter a receipt number and/or choose a file.");
                  return;
                }
                setSubmittingReceiptAttach(true);
                try {
                  const res = await apiClient.attachReceiptToApprovedRechargeRequest(receiptAttachRow.id, {
                    utr_reference: receiptAttachUtr.trim() || undefined,
                    receipt_file: receiptAttachFile,
                  });
                  if (res.error) {
                    toast.error(res.error);
                    return;
                  }
                  toast.success(res.data?.message || "Receipt saved");
                  setReceiptAttachRow(null);
                  setReceiptAttachUtr("");
                  setReceiptAttachFile(null);
                  await fetchRechargeRequests();
                } catch (e: any) {
                  toast.error(e?.message || "Failed to save receipt");
                } finally {
                  setSubmittingReceiptAttach(false);
                }
              }}
            >
              {submittingReceiptAttach ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Save
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