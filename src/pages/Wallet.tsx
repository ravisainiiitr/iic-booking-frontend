import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import UserProfile from "@/components/UserProfile";
import { ArrowDown, ArrowUp, Mail, Send, X, Clock, CheckCircle, XCircle, Wallet as WalletIcon, CreditCard, FileText, ChevronDown, ChevronUp, Building2 } from "lucide-react";
import { toast } from "sonner";
import DashboardHeader from "@/components/DashboardHeader";
import { useAlert } from "@/hooks/use-alert";

interface Transaction {
  id: number;
  transaction_type: "credit" | "debit";
  amount: string;
  description: string;
  created_at: string;
  department_name?: string;
  department_code?: string | null;
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
  const { alert, confirm, AlertComponent, ConfirmComponent } = useAlert();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<number | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [facultyEmail, setFacultyEmail] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [isFaculty, setIsFaculty] = useState(false);
  const [hasApprovedRequest, setHasApprovedRequest] = useState(false);
  const [isShared, setIsShared] = useState(false);
  const [walletOwner, setWalletOwner] = useState<{
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    profile_picture?: string | null;
  } | null>(null);
  const [facultyProfile, setFacultyProfile] = useState<{
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    profile_picture?: string | null;
    has_wallet?: boolean;
  } | null>(null);
  const [loadingFacultyProfile, setLoadingFacultyProfile] = useState(false);
  const [facultyProfileError, setFacultyProfileError] = useState<string | null>(null);
  const [isOtherUser, setIsOtherUser] = useState(false);
  const [isStudent, setIsStudent] = useState(false);
  const [isIndividualStudent, setIsIndividualStudent] = useState(false);
  const [showRechargeDialog, setShowRechargeDialog] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [recharging, setRecharging] = useState(false);
  const [rechargeType, setRechargeType] = useState<"razorpay" | "request">("razorpay");
  const [projectDetails, setProjectDetails] = useState("");
  const [requestingRecharge, setRequestingRecharge] = useState(false);
  const [otpStep, setOtpStep] = useState<"form" | "otp">("form");
  const [userOtp, setUserOtp] = useState("");
  const [tempRequestId, setTempRequestId] = useState<number | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [rechargeRequests, setRechargeRequests] = useState<any[]>([]);
  const [loadingRechargeRequests, setLoadingRechargeRequests] = useState(false);
  const [showRechargeHistory, setShowRechargeHistory] = useState(false);
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

  useEffect(() => {
    checkAuthAndFetchWallet();
    fetchRechargeRequests();
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
    if (!showRechargeDialog) {
      setRechargeDepartmentId(null);
    }
  }, [showRechargeDialog]);

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

    // Check if user can have wallet using the can_have_wallet field
    // Treat undefined/null as false (no wallet access)
    const userCanHaveWallet = userResponse.data?.can_have_wallet === true;
    const userType: any = userResponse.data?.user_type;
    
    // Handle both string and number user_type (API may return either)
    // Regular STUDENT and OTHER users can request to join faculty wallet
    let isStudent = false;
    let isOtherUser = false;
    let isIndividualStudent = false;
    let isFacultyUser = false;
    if (userType !== undefined && userType !== null) {
      if (typeof userType === "string") {
        const userTypeLower = userType.toLowerCase();
        isStudent = userTypeLower === "student";
        isOtherUser = userTypeLower === "other";
        isIndividualStudent = userTypeLower === "individual_student";
        isFacultyUser = userTypeLower === "faculty";
      } else if (typeof userType === "number") {
        // Assuming 1 = student, 2 = faculty (adjust based on your mapping)
        isStudent = userType === 1;
        isFacultyUser = userType === 2;
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
    
    // Fetch join requests:
    // - For faculty members: they see requests they received
    // - For regular students and Other users: they see requests they sent
    // Individual students have their own wallets, so they don't need join requests
    if (isFacultyUser || (canRequestFacultyWallet && !isIndividualStudent)) {
      await fetchJoinRequests();
    }
    setLoading(false);
  };

  const fetchFacultyProfile = useCallback(async (email: string) => {
    setLoadingFacultyProfile(true);
    setFacultyProfileError(null);
    try {
      const response = await apiClient.getFacultyByEmail(email);
      if (response.error) {
        setFacultyProfileError(response.error);
        setFacultyProfile(null);
      } else if (response.data) {
        setFacultyProfile({
          name: response.data.faculty?.name,
          email: response.data.faculty?.email,
          phone: response.data.faculty?.phone,
          profile_picture: response.data.faculty?.profile_picture,
          has_wallet: response.data.has_wallet,
        });
        setFacultyProfileError(null);
      }
    } catch (error: any) {
      setFacultyProfileError(error.message || "Failed to fetch faculty profile");
      setFacultyProfile(null);
    } finally {
      setLoadingFacultyProfile(false);
    }
  }, []);

  // Debounced function to fetch faculty profile
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (facultyEmail.trim() && facultyEmail.includes('@')) {
        fetchFacultyProfile(facultyEmail.trim());
      } else {
        setFacultyProfile(null);
        setFacultyProfileError(null);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [facultyEmail, fetchFacultyProfile]);

  const fetchJoinRequests = async () => {
    try {
      setLoadingRequests(true);
      const response = await apiClient.getWalletJoinRequests();
      if (response.data && response.data.requests) {
        setJoinRequests(response.data.requests);
        
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
      toast.error("Please enter a faculty email address");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(facultyEmail)) {
      toast.error("Please enter a valid email address");
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
      setRequestMessage("");
      setFacultyProfile(null);
      setFacultyProfileError(null);
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
      }
    } catch (error: any) {
      // Don't redirect on error, just show empty state
      setBalance(0);
      setTransactions([]);
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
      const orderResponse = await apiClient.createRazorpayOrder(amount, rechargeDepartmentId);
      if (orderResponse.error) {
        toast.error(orderResponse.error || "Failed to create payment order");
        return;
      }

      const { order_id, key, amount: orderAmount } = orderResponse.data!;

      // Initialize Razorpay checkout
      const options = {
        key: key,
        amount: orderAmount,
        currency: 'INR',
        name: 'IIC Booking',
        description: `Wallet Recharge - ₹${amount.toFixed(2)}`,
        order_id: order_id,
        handler: async function (response: any) {
          try {
            // Verify payment
            const verifyResponse = await apiClient.verifyRazorpayPayment(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature,
              orderAmount
            );

            if (verifyResponse.error) {
              toast.error(verifyResponse.error || "Payment verification failed");
              return;
            }

            toast.success(verifyResponse.data?.message || `Successfully recharged ₹${amount.toFixed(2)}`);
            setShowRechargeDialog(false);
            setRechargeAmount("");
            setRechargeDepartmentId(null);
            // Refresh wallet data
            await fetchWalletData();
          } catch (error: any) {
            toast.error(error.message || "Failed to verify payment");
          }
        },
        prefill: {
          name: user?.name || user?.email || '',
          email: user?.email || '',
          contact: user?.phone_number || '',
        },
        theme: {
          color: '#2563eb',
        },
        modal: {
          ondismiss: function() {
            setRecharging(false);
          }
        }
      };

      // Check if Razorpay is loaded
      if (typeof window.Razorpay === 'undefined') {
        toast.error("Payment gateway is loading. Please try again in a moment.");
        setRecharging(false);
        return;
      }

      const razorpay = new window.Razorpay(options);
      razorpay.on('payment.failed', function (response: any) {
        toast.error(`Payment failed: ${response.error.description || 'Unknown error'}`);
        setRecharging(false);
      });
      
      razorpay.open();
    } catch (error: any) {
      toast.error(error.message || "Failed to initiate payment");
      setRecharging(false);
    }
  };

  const handleSendOtp = async () => {
    const amount = parseFloat(rechargeAmount);
    if (!rechargeDepartmentId) {
      toast.error("Please select a department (sub-wallet to credit)");
      return;
    }
    if (!amount || amount < 0.01) {
      toast.error("Please enter a valid amount (minimum ₹0.01)");
      return;
    }
    try {
      setSendingOtp(true);
      const response = await apiClient.sendUserOtpForRecharge(
        amount,
        rechargeDepartmentId,
        projectDetails.trim() || undefined
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

      toast.success(
        response.data?.message || 
        "Recharge request created successfully. The accounts team will review your request."
      );
      setShowRechargeDialog(false);
      setRechargeAmount("");
      setProjectDetails("");
      setRechargeType("razorpay");
      setOtpStep("form");
      setUserOtp("");
      setTempRequestId(null);
      
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show request form for students without wallet access
  if (showRequestForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
        <DashboardHeader />
        <main className="container mx-auto px-4 py-8 max-w-2xl">
          <h1 className="text-3xl font-bold mb-8">Request Wallet Access</h1>

          <Card>
            <CardHeader>
              <CardTitle>Request to Join Wallet</CardTitle>
              <CardDescription>
                {isOtherUser 
                  ? "As an 'Other' type user, you can either use your own wallet or join a faculty wallet. Enter the faculty member's email address below to send a request to join their wallet."
                  : "As a student, you need to request a faculty member to add you to their wallet. Enter the faculty member's email address below to send a request."
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="faculty-email">Faculty Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="faculty-email"
                    type="email"
                    placeholder="faculty@iicbooking.iitr.ac.in"
                    value={facultyEmail}
                    onChange={(e) => setFacultyEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
                {loadingFacultyProfile && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2 mt-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    Searching for faculty...
                  </p>
                )}
                {facultyProfileError && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg mt-2">
                    <p className="text-sm text-red-600 dark:text-red-400">{facultyProfileError}</p>
                  </div>
                )}
                {facultyProfile && !facultyProfileError && (
                  <div className="p-4 bg-muted border rounded-lg space-y-3 mt-2">
                    <p className="text-sm font-medium">Faculty Profile:</p>
                    <UserProfile
                      name={facultyProfile.name}
                      email={facultyProfile.email}
                      phone={facultyProfile.phone}
                      profilePicture={facultyProfile.profile_picture}
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
                          profilePicture={request.faculty_profile_picture}
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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancelRequest(request.id)}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/20">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Wallet</h1>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Current Balance</CardTitle>
            <CardDescription>
              {isShared ? "Available funds in shared wallet" : "Consolidated balance across all department sub-wallets. Recharge a sub-wallet to add funds."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div className="text-4xl font-bold text-primary">
                ₹{balance.toFixed(2)}
              </div>
              {!isShared && (
                <Button
                  onClick={() => setShowRechargeDialog(true)}
                  className="flex items-center gap-2"
                >
                  <WalletIcon className="h-4 w-4" />
                  Recharge Wallet
                </Button>
              )}
            </div>
            
            {/* Recharge Dialog */}
            {showRechargeDialog && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <Card className="w-full max-w-md mx-4">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Recharge Wallet</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowRechargeDialog(false);
                          setRechargeAmount("");
                          setRechargeDepartmentId(null);
                          setProjectDetails("");
                          setRechargeType("razorpay");
                          setOtpStep("form");
                          setUserOtp("");
                          setTempRequestId(null);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <CardDescription>
                      Recharge a department sub-wallet. Select department and amount.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
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
                    {/* Recharge Type Tabs */}
                    <div className="flex gap-2 border-b">
                      <Button
                        variant={rechargeType === "razorpay" ? "default" : "ghost"}
                        className="rounded-b-none border-b-2 border-transparent"
                        onClick={() => setRechargeType("razorpay")}
                        disabled={recharging || requestingRecharge}
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        Online Payment
                      </Button>
                      <Button
                        variant={rechargeType === "request" ? "default" : "ghost"}
                        className="rounded-b-none border-b-2 border-transparent"
                        onClick={() => setRechargeType("request")}
                        disabled={recharging || requestingRecharge}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Request Recharge
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="recharge-amount">Amount (₹)</Label>
                      <Input
                        id="recharge-amount"
                        type="number"
                        min="0.01"
                        max="100000"
                        step="0.01"
                        placeholder="Enter amount"
                        value={rechargeAmount}
                        onChange={(e) => setRechargeAmount(e.target.value)}
                        disabled={recharging || requestingRecharge}
                      />
                      <p className="text-xs text-muted-foreground">
                        {rechargeType === "razorpay" 
                          ? "Minimum: ₹1 | Maximum: ₹1,00,000"
                          : "Minimum: ₹0.01 | Maximum: ₹1,00,000"
                        }
                      </p>
                    </div>

                    {rechargeType === "razorpay" && (
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

                    {rechargeType === "request" && otpStep === "form" && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="project-details">Project Details (Optional)</Label>
                          <Textarea
                            id="project-details"
                            placeholder="Enter project details or reason for recharge request..."
                            value={projectDetails}
                            onChange={(e) => setProjectDetails(e.target.value)}
                            rows={3}
                            disabled={sendingOtp}
                          />
                          <p className="text-xs text-muted-foreground">
                            Provide project details or reason for the recharge request. This will be sent to the accounts team for approval.
                          </p>
                        </div>
                        <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <p className="text-sm text-blue-700 dark:text-blue-400">
                            ℹ️ An OTP will be sent to your email for verification before submitting the request.
                          </p>
                        </div>
                        <Button
                          onClick={handleSendOtp}
                          disabled={sendingOtp || !rechargeDepartmentId || !rechargeAmount || parseFloat(rechargeAmount) < 0.01}
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
                              <Mail className="h-4 w-4 mr-2" />
                              Send OTP to Email
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
                  </CardContent>
                </Card>
              </div>
            )}
            
            {/* Wallet Owner Profile for Students and Other Users */}
            {isShared && walletOwner && (
              <div className="mt-6 pt-6 border-t">
                <p className="text-sm font-medium mb-3">Wallet Owner:</p>
                <UserProfile
                  name={walletOwner.name}
                  email={walletOwner.email}
                  phone={walletOwner.phone}
                  profilePicture={walletOwner.profile_picture}
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

        {/* Department Sub-Wallets */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Department Sub-Wallets
            </CardTitle>
            <CardDescription>
              Funds allocated by department. Equipment linked to a department deducts from the corresponding sub-wallet.
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
                  {(showAllSubWallets ? subWallets : subWallets.slice(0, SUB_WALLETS_PREVIEW_COUNT)).map((sw) => (
                    <li
                      key={sw.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                    >
                      <div>
                        <p className="font-medium">{sw.department_name}</p>
                        {sw.department_code && (
                          <p className="text-xs text-muted-foreground">{sw.department_code}</p>
                        )}
                      </div>
                      <span className="text-lg font-semibold text-primary">
                        ₹{Number(sw.balance).toFixed(2)}
                      </span>
                    </li>
                  ))}
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
                            profilePicture={request.faculty_profile_picture}
                            size="sm"
                          />
                        </div>
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
                        {(request.status === "PENDING" || request.status === "APPROVED") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancelRequest(request.id)}
                            className="text-orange-600 hover:text-orange-700 border-orange-600 hover:border-orange-700"
                          >
                            <X className="h-4 w-4 mr-1" />
                            {request.status === "APPROVED" ? "Leave Wallet" : "Cancel Request"}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Join Requests for Faculty */}
        {isFaculty && (
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
                  {joinRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <UserProfile
                          name={request.student_name}
                          email={request.student_email}
                          phone={request.student_phone}
                          profilePicture={request.student_profile_picture}
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
                  <div className="space-y-3">
                    {rechargeRequests.map((req) => (
                      <div
                        key={req.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {req.status === "PENDING" && (
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {req.status_display || "Pending"}
                              </Badge>
                            )}
                            {req.status === "APPROVED" && (
                              <Badge variant="default" className="flex items-center gap-1 bg-green-600">
                                <CheckCircle className="h-3 w-3" />
                                {req.status_display || "Approved"}
                              </Badge>
                            )}
                            {req.status === "REJECTED" && (
                              <Badge variant="destructive" className="flex items-center gap-1">
                                <XCircle className="h-3 w-3" />
                                {req.status_display || "Rejected"}
                              </Badge>
                            )}
                            {req.status === "CANCELLED" && (
                              <Badge variant="outline" className="flex items-center gap-1">
                                <X className="h-3 w-3" />
                                {req.status_display || "Cancelled"}
                              </Badge>
                            )}
                            <span className="font-semibold">₹{Number(req.amount).toFixed(2)}</span>
                          </div>
                          {req.project_details && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Project: {req.project_details}
                            </p>
                          )}
                          {req.response_message && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Response: {req.response_message}
                            </p>
                          )}
                          {req.approved_by_email && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Processed by: {req.approved_by_email}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            Requested: {new Date(req.created_at).toLocaleString()}
                            {req.responded_at && ` • Processed: ${new Date(req.responded_at).toLocaleString()}`}
                          </p>
                        </div>
                        {req.status === "PENDING" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              const response = await apiClient.cancelWalletRechargeRequest(req.id);
                              if (response.error) {
                                toast.error(response.error || "Failed to cancel request");
                              } else {
                                toast.success("Request cancelled");
                                await fetchRechargeRequests();
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
              </CardContent>
            )}
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>
              Transactions are recorded per department. View balance and activity in the Department Sub-Wallets section above; use each department’s sub-wallet for recharges and bookings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">
                No transactions yet. Transactions will appear here when you recharge or make bookings.
              </p>
            ) : (
              <div className="space-y-3">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {transaction.transaction_type === "credit" ? (
                          <Badge variant="default" className="flex items-center gap-1 bg-green-600">
                            <ArrowUp className="h-3 w-3" />
                            Credit
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <ArrowDown className="h-3 w-3" />
                            Debit
                          </Badge>
                        )}
                        <span className="font-semibold">
                          ₹{Number(transaction.amount).toFixed(2)}
                        </span>
                        {transaction.department_name && (
                          <span className="text-sm text-muted-foreground">
                            ({transaction.department_name}{transaction.department_code ? ` - ${transaction.department_code}` : ''})
                          </span>
                        )}
                      </div>
                      {transaction.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {transaction.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(transaction.created_at).toLocaleString()}
                      </p>
                    </div>
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
};

export default Wallet;