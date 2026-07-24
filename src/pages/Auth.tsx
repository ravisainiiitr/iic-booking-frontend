import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { consumePostLoginRedirect } from "@/lib/authRedirect";
import { CHANNEL_I_DISPLAY_NAME } from "@/lib/constants";
import { storeOmniportState } from "@/lib/omniportAuth";
import { isExternalBookingUserType } from "@/lib/userTypes";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { z } from "zod";
import { Eye, EyeOff, Upload, X, FileText, User, Home, Mail, ArrowLeft, KeyRound, UserPlus, ChevronsUpDown, ListChecks, Building2, Calendar, FileSignature } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const authSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  password_confirm: z.string().min(8, "Password confirmation must be at least 8 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  user_type: z.string().min(1, "Please select a user type"),
  user_type_alias: z.string().optional(),
  emp_id: z.string().min(1, "Employee/Student ID is required").max(50, "ID must be less than 50 characters"),
  phone_number: z
    .string()
    .min(1, "Phone number is required")
    .max(20, "Phone number must be less than 20 characters")
    .refine(
      (val) => {
        const s = (val || "").replace(/\s/g, "");
        const digits = s.replace(/^\+91|^0+/, "");
        return /^[6-9]\d{9}$/.test(digits);
      },
      "Enter a valid 10-digit Indian mobile number (e.g. 9876543210). It must start with 6, 7, 8, or 9."
    ),
  department: z.number().int().positive("Department ID must be a positive number").optional(),
  gender: z.enum(["male", "female", "other"], { required_error: "Gender is required", invalid_type_error: "Please select gender" }),
  program_end_date: z.string().min(1, "Current Program/Employment Validity is required"),
}).refine((data) => data.password === data.password_confirm, {
  message: "Passwords do not match",
  path: ["password_confirm"],
});

// Public/free email domains: for Educational Institute and Govt R&D, documents are required when email uses these.
const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com",
  "yahoo.com", "yahoo.co.in", "yahoo.in", "ymail.com",
  "outlook.com", "hotmail.com", "hotmail.co.in", "live.com", "live.in", "msn.com",
  "rediffmail.com", "rediff.com",
  "icloud.com", "me.com", "mac.com",
  "mail.com", "protonmail.com", "pm.me", "aol.com", "zoho.com",
  "gmx.com", "gmx.net", "inbox.com", "mailinator.com",
]);

function isPublicEmailDomain(email: string): boolean {
  const part = email.trim().split("@")[1]?.toLowerCase();
  return !!part && PUBLIC_EMAIL_DOMAINS.has(part);
}

const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

interface Department {
  id: number;
  name: string;
  code: string;
  department_type?: string;
  department_type_display?: string;
  verified?: boolean;
}

interface PendingOrganizationRequest {
  id: number;
  name: string;
  verified: boolean;
}

interface UserType {
  code: string;
  name: string;
  description: string;
  alias?: string;
}

interface FacultySearchResult {
  id: number;
  name: string;
  email: string;
  department: string | null;
}

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated, refreshUser, setUserFromAuth } = useAuth();
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [userType, setUserType] = useState<string>("");
  const [userTypeAlias, setUserTypeAlias] = useState<string>("");
  const [empId, setEmpId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [department, setDepartment] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [pendingOrganizationRequests, setPendingOrganizationRequests] = useState<PendingOrganizationRequest[]>([]);
  const [indianStates, setIndianStates] = useState<Array<{ value: string; label: string; type?: "state" | "union_territory" }>>([]);
  const [selectedStateUt, setSelectedStateUt] = useState("");
  const [stateComboboxOpen, setStateComboboxOpen] = useState(false);
  const [loadingStates, setLoadingStates] = useState(false);
  const [programEndDate, setProgramEndDate] = useState("");
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [userTypes, setUserTypes] = useState<UserType[]>([]);
  const [loadingUserTypes, setLoadingUserTypes] = useState(false);
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState("signin");
  const [documents, setDocuments] = useState<File[]>([]);
  const [documentErrors, setDocumentErrors] = useState<string[]>([]);
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);
  const [supervisorId, setSupervisorId] = useState<number | "">("");
  const [supervisorDisplay, setSupervisorDisplay] = useState<FacultySearchResult | null>(null);
  const [facultySearchQuery, setFacultySearchQuery] = useState("");
  const [facultySearchResults, setFacultySearchResults] = useState<FacultySearchResult[]>([]);
  const [loadingFacultySearch, setLoadingFacultySearch] = useState(false);
  const facultySearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [orgRequestName, setOrgRequestName] = useState("");
  const [orgRequestNotes, setOrgRequestNotes] = useState("");
  const [pendingOrganizationRequestId, setPendingOrganizationRequestId] = useState<number | null>(null);
  const [pendingOrganizationName, setPendingOrganizationName] = useState<string>("");

  // Login via OTP (email)
  const [loginViaOtpStep, setLoginViaOtpStep] = useState<null | "email" | "otp">(null);
  const [loginOtpEmail, setLoginOtpEmail] = useState("");
  const [loginOtpValue, setLoginOtpValue] = useState("");
  const [loadingLoginOtp, setLoadingLoginOtp] = useState(false);

  // Forgot password via OTP
  const [forgotPasswordStep, setForgotPasswordStep] = useState<null | "email" | "otp-password" | "done">(null);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotNewPasswordConfirm, setForgotNewPasswordConfirm] = useState("");
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotNewPasswordConfirm, setShowForgotNewPasswordConfirm] = useState(false);
  const [loadingForgotPassword, setLoadingForgotPassword] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let hasRedirected = false;

    // Check for email verification success message
    if (searchParams.get('verified') === 'true') {
      toast.success("Email verified successfully! You can now log in.");
    }

    // Check for pending admin approval message
    if (searchParams.get('pending') === 'true') {
      toast.info("Your email is verified. Your account is pending admin approval. You will be notified once approved.", {
        duration: 8000,
      });
    }

    // Check for inactivity logout redirect
    if (searchParams.get('reason') === 'inactivity') {
      toast.warning("You were logged out due to inactivity. Please sign in again.", { duration: 6000 });
    }

    // Check if user is already authenticated using AuthContext
    if (isAuthenticated && !hasRedirected) {
          hasRedirected = true;
          navigate(consumePostLoginRedirect());
    }
    
    // Set checking auth to false
        if (isMounted) {
          setCheckingAuth(false);
    }

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Fetch departments when signup tab is active and user type is selected.
  // For IITR Post Doctoral Fellows, IITR Research Associates in Projects, IITR Startups → internal departments.
  // For Educational Institute, Govt R&D Organizations, Industry → external departments filtered by external_subcategory and state.
  // For Other → all external departments.
  useEffect(() => {
    if (activeTab !== "signup" || !userType) {
      if (!userType) setDepartments([]);
      return;
    }
    const selectedType = userTypes.find((t) =>
      t.alias ? `${t.code}|${t.name}` === userType : t.code === userType
    );
    const resolvedCode = userType.includes("|") ? userType.split("|")[0]! : userType;
    const useInternalDepartments =
      Boolean(selectedType?.alias) || resolvedCode === "startup_incubated_iitr";
    setDepartment("");

    const externalSubcategoryByCode: Record<string, string> = {
      external: "educational_institute",   // Educational Institute
      RND: "govt_rnd",                     // Govt R&D Organizations
      Industry: "industries",               // Industry
      external_startup_msme: "external_startup_msme",
    };
    const externalSubcategory = externalSubcategoryByCode[resolvedCode];
    const needsStateForDepts = Boolean(!useInternalDepartments && externalSubcategory);

    if (useInternalDepartments) {
      const selectedName = selectedType?.name ?? "";
      const internalSubcategory =
        selectedName === "IITR Startups" || resolvedCode === "startup_incubated_iitr"
          ? "startups"
          : selectedName === "IITR Post Doctoral Fellows" || selectedName === "IITR Research Associates in Projects"
            ? "iit_roorkee_dept_centres"
            : undefined;
      setLoadingDepartments(true);
      apiClient
        .getDepartments("internal", false, undefined, undefined, internalSubcategory)
        .then((response) => {
          if (response.data?.departments) setDepartments(response.data.departments);
          else setDepartments([]);
        })
        .catch(() => {
          toast.error("Failed to load departments");
          setDepartments([]);
        })
        .finally(() => setLoadingDepartments(false));
      return;
    }

    if (needsStateForDepts && !selectedStateUt) {
      setDepartments([]);
      setLoadingDepartments(false);
      return;
    }

    setLoadingDepartments(true);
    apiClient
      .getDepartments(
        "external",
        false,
        externalSubcategory || undefined,
        selectedStateUt || undefined
      )
      .then((response) => {
        if (response.data?.departments) setDepartments(response.data.departments);
        else setDepartments([]);
        if (response.data?.pending_organization_requests) {
          setPendingOrganizationRequests(response.data.pending_organization_requests);
        } else {
          setPendingOrganizationRequests([]);
        }
      })
      .catch(() => {
        toast.error("Failed to load departments");
        setDepartments([]);
        setPendingOrganizationRequests([]);
      })
      .finally(() => setLoadingDepartments(false));
  }, [activeTab, userType, userTypes, selectedStateUt]);

  // Fetch user types when Auth mounts and when signup tab is active (so list is ready when user opens signup)
  useEffect(() => {
    if (userTypes.length === 0 && !loadingUserTypes) {
      fetchUserTypes();
    }
  }, [activeTab]);

  // Fetch Indian states/UTs when signup tab is active (for State/UT dropdown)
  useEffect(() => {
    if (activeTab !== "signup" || indianStates.length > 0 || loadingStates) return;
    setLoadingStates(true);
    apiClient
      .getIndianStates()
      .then((res) => {
        if (res.data?.states) setIndianStates(res.data.states);
      })
      .catch(() => toast.error("Failed to load states"))
      .finally(() => setLoadingStates(false));
  }, [activeTab]);

  const needsSupervisor = useCallback(() => {
    const selected = userTypes.find((t) =>
      t.alias ? `${t.code}|${t.name}` === userType : t.code === userType
    );
    return selected?.name === "IITR Post Doctoral Fellows" || selected?.name === "IITR Research Associates in Projects";
  }, [userType, userTypes]);

  useEffect(() => {
    if (!needsSupervisor()) {
      setSupervisorId("");
      setSupervisorDisplay(null);
      setFacultySearchQuery("");
      setFacultySearchResults([]);
    }
  }, [needsSupervisor]);

  useEffect(() => {
    const code = userType.includes("|") ? userType.split("|")[0] : userType;
    if (code !== "RND") {
      setPendingOrganizationRequestId(null);
      setPendingOrganizationName("");
    }
  }, [userType]);

  useEffect(() => {
    if (!facultySearchQuery.trim() || facultySearchQuery.length < 2) {
      setFacultySearchResults([]);
      return;
    }
    if (facultySearchDebounceRef.current) clearTimeout(facultySearchDebounceRef.current);
    facultySearchDebounceRef.current = setTimeout(() => {
      setLoadingFacultySearch(true);
      apiClient
        .searchFacultyForSignup(facultySearchQuery.trim(), 20)
        .then((res) => {
          if (res.data?.results) setFacultySearchResults(res.data.results);
          else setFacultySearchResults([]);
        })
        .catch(() => setFacultySearchResults([]))
        .finally(() => setLoadingFacultySearch(false));
    }, 300);
    return () => {
      if (facultySearchDebounceRef.current) clearTimeout(facultySearchDebounceRef.current);
    };
  }, [facultySearchQuery]);

  const fetchUserTypes = async () => {
    setLoadingUserTypes(true);
    try {
      const response = await apiClient.getUserTypes();
      if (response.error) {
        toast.error(response.error || "Failed to load user types");
        return;
      }
      const list = response.data?.user_types ?? (response.data as Record<string, unknown>)?.user_types;
      if (Array.isArray(list) && list.length > 0) {
        setUserTypes(list);
      } else if (response.data && typeof response.data === "object") {
        console.warn("User types response missing or empty:", response.data);
        toast.error("No user types available. Please try again later.");
      }
    } catch (error) {
      console.error("Error fetching user types:", error);
      toast.error("Failed to load user types");
    } finally {
      setLoadingUserTypes(false);
    }
  };

  const handleOmniportLogin = async () => {
    setLoading(true);
    try {
      const response = await apiClient.getOmniportAuthUrl();

      if (response.error) {
        console.error('Error getting Omniport auth URL:', response.error);
        throw new Error(response.error);
      }

      if (response.data?.auth_url) {
        console.log('Received auth_url from backend:', response.data.auth_url);
        storeOmniportState(response.data.auth_url, response.data.state);
        // Redirect to Omniport
        window.location.href = response.data.auth_url;
      } else {
        throw new Error('No auth_url received from backend');
      }
    } catch (error: any) {
      console.error('Omniport login error:', error);
      toast.error(error.message || `Failed to initiate login with ${CHANNEL_I_DISPLAY_NAME}`);
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate profile picture is selected
    if (!profilePicture) {
      toast.error("Profile picture is required");
      return;
    }
    if (needsSupervisor() && !supervisorId) {
      toast.error("Please select your IITR Faculty supervisor");
      return;
    }
    const resolvedCode = userType.includes("|") ? userType.split("|")[0]! : userType;
    const isExternalType =
      resolvedCode === "external" ||
      resolvedCode === "RND" ||
      resolvedCode === "Industry" ||
      resolvedCode === "external_startup_msme";
    if (isExternalType && !selectedStateUt) {
      toast.error("State/Union Territory is required for Educational Institute, Govt R&D Organizations, Industry, and External Startup/MSME");
      return;
    }
    if (isExternalType && email.trim().toLowerCase().endsWith("@iitr.ac.in")) {
      toast.error("External users cannot register with an IIT Roorkee (iitr.ac.in) email. Please use your institution or organization email.");
      return;
    }
    const needsKycForm = (resolvedCode === "external" || resolvedCode === "RND") && isPublicEmailDomain(email);
    if (needsKycForm && documents.length === 0) {
      toast.error("A signed and filled KYC form (scan) is required when using a public email. Download the form below, fill it, sign it, scan it, and upload it—or use your institution/organization email.");
      return;
    }
    // Document type selection is not required; any uploaded document is treated as the KYC scan for this validation.
    const isReqFromDropdown = resolvedCode === "RND" && department.startsWith("req-");
    const hasOrgSelection = department || pendingOrganizationRequestId != null;
    if (resolvedCode === "RND" && !hasOrgSelection) {
      toast.error("Select an organization from the list or request a new organization name, then proceed with signup.");
      return;
    }
    if (resolvedCode !== "RND" && !department) {
      toast.error("Please select a department.");
      return;
    }

    let signupDepartment: number | null = null;
    let signupOrgRequestId: number | undefined;
    if (resolvedCode === "RND" && (isReqFromDropdown || pendingOrganizationRequestId != null)) {
      signupOrgRequestId = isReqFromDropdown
        ? parseInt(department.slice(4), 10)
        : (pendingOrganizationRequestId ?? undefined);
    } else if (department && !department.startsWith("req-")) {
      signupDepartment = parseInt(department, 10);
    }

    try {
      const resolvedAlias = userType.includes("|") ? userType.split("|")[1]! : (userTypeAlias || "");
      const validated = authSchema.parse({ 
        email, 
        password,
        password_confirm: passwordConfirm,
        name,
        user_type: resolvedCode,
        user_type_alias: (resolvedCode === "student" || resolvedCode === "individual_student") ? (resolvedAlias || userTypeAlias) : undefined,
        emp_id: empId,
        phone_number: phoneNumber?.trim() || undefined,
        department: signupDepartment ?? undefined,
        gender: gender && gender !== "none" ? gender : undefined,
        program_end_date: programEndDate || undefined,
      });
      setLoading(true);

      const response = await apiClient.signUp(
        validated.email,
        validated.password,
        validated.password_confirm,
        validated.name,
        validated.user_type,
        validated.emp_id,
        validated.phone_number!,
        signupDepartment,
        documents.length > 0 ? documents : undefined,
        undefined,
        profilePicture,
        validated.user_type_alias,
        supervisorId ? (supervisorId as number) : undefined,
        validated.program_end_date,
        undefined,
        validated.gender,
        signupOrgRequestId
      );

      if ('error' in response && response.error) {
        // Check if it's an email already exists error
        const emailError = 'fieldErrors' in response ? response.fieldErrors?.email : undefined;
        if (emailError) {
          const emailErrorMessage = Array.isArray(emailError) ? emailError[0] : emailError;
          if (emailErrorMessage.includes("already exists") || emailErrorMessage.includes("already registered")) {
            toast.error(emailErrorMessage, {
              action: {
                label: "Sign In Instead",
                onClick: () => {
                  setActiveTab("signin");
                  // Pre-fill email in signin form
                  // The email state is already set, so it will be available in signin tab
                },
              },
              duration: 5000,
            });
            return;
          }
        }
        throw new Error(response.error);
      }

      if ('data' in response && response.data) {
        // Check if token is provided (immediate login) or if email verification is required
        if (response.data.token) {
          // Token provided - user is logged in immediately
          toast.success("Account created successfully! Redirecting…");
          setTimeout(() => {
            navigate(consumePostLoginRedirect());
          }, 1000);
        } else {
          // No token - email verification required
          const message = response.data.message || "Account created successfully! Please check your email to verify your account before logging in.";
          toast.success(message, {
            duration: 8000, // Show longer since it's important
          });
          
          // Reset form
          setEmail("");
          setPassword("");
          setPasswordConfirm("");
          setName("");
          setUserType("");
          setUserTypeAlias("");
          setEmpId("");
          setPhoneNumber("");
          setDepartment("");
    setSelectedStateUt("");
          setSupervisorId("");
          setSupervisorDisplay(null);
          setProgramEndDate("");
          setGender("");
          setProfilePicture(null);
          setProfilePicturePreview(null);
          setDocuments([]);
          setDocumentErrors([]);
          setPendingOrganizationRequestId(null);
          setPendingOrganizationName("");
          
          // Switch to signin tab to guide user
          setActiveTab("signin");
        }
      } else {
        // Fallback if no data
        toast.success("Account created successfully! You can now sign in.");
        // Reset form
        setEmail("");
        setPassword("");
        setPasswordConfirm("");
        setName("");
        setUserType("");
        setUserTypeAlias("");
        setEmpId("");
        setPhoneNumber("");
        setDepartment("");
    setSelectedStateUt("");
        setSupervisorId("");
        setPendingOrganizationRequestId(null);
        setPendingOrganizationName("");
        setSupervisorDisplay(null);
        setProfilePicture(null);
        setProfilePicturePreview(null);
        setDocuments([]);
        setDocumentErrors([]);
        setProgramEndDate("");
        setGender("");
        setActiveTab("signin");
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        // Check if error message contains email already exists
        const errorMessage = error.message || "Failed to sign up";
        if (errorMessage.includes("already exists") || errorMessage.includes("already registered")) {
          toast.error(errorMessage, {
            action: {
              label: "Sign In Instead",
              onClick: () => {
                setActiveTab("signin");
              },
            },
            duration: 5000,
          });
        } else {
          toast.error(errorMessage);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      toast.error("Please enter your email address first", {
        duration: 5000,
      });
      return;
    }

    // Create a promise that resolves/rejects based on the API response
    const resendPromise = apiClient.resendVerificationEmail(email).then((response) => {
      if (response.error) {
        throw new Error(response.error || "Failed to resend verification email");
      }
      return response.data?.message || "Verification email sent! Please check your inbox.";
    });
    
    toast.promise(resendPromise, {
      loading: "Sending verification email...",
      success: (message) => message,
      error: (error: any) => {
        if (error?.message) {
          return error.message;
        }
        return "Failed to resend verification email";
      },
      duration: 6000,
    });

    try {
      await resendPromise;
      // The toast.promise will handle the notification display
    } catch (error: any) {
      // Error is already handled by toast.promise
      console.error("Error resending verification email:", error);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validated = signInSchema.parse({ email, password });
      setLoading(true);

      // Use AuthContext login method which handles token and user data
      const loginResult = await login(validated.email, validated.password);

      if (!loginResult.success) {
        // Already logged in elsewhere: show message and do not call API again
        if (loginResult.error && (loginResult.error.toLowerCase().includes("already logged in") || loginResult.error.includes("log out there first"))) {
          toast.warning(loginResult.error, { duration: 8000 });
          return;
        }
        // Check if it's an email verification error or pending approval error
        // We need to call the API directly to get detailed error information
      const response = await apiClient.signIn(validated.email, validated.password);

      if (response.error) {
        const errorData = response.fieldErrors as any;
        const adminApproved = errorData?.admin_approved ?? (response as any).admin_approved;
        const emailVerified = errorData?.email_verified ?? (response as any).email_verified;
        const errorMessage = errorData?.message ?? (response as any).message ?? response.error;
        
        const isPendingApprovalError = String(adminApproved).toLowerCase() === 'false';
        const isEmailVerificationError = String(emailVerified).toLowerCase() === 'false';

        if (isEmailVerificationError) {
          const message = errorMessage || "Please verify your email address before logging in.";
          toast.error(message, {
            action: {
              label: "Resend Verification Email",
              onClick: handleResendVerification,
            },
            duration: 8000,
          });
          return;
        }
        
        if (isPendingApprovalError) {
          const message = errorMessage || "Your account is pending admin approval. You will be notified once approved.";
          toast.info(message, {
            duration: 8000,
          });
          return;
        }
      }

        throw new Error(loginResult.error || "Login failed");
      }

      // Login successful
        toast.success("Signed in successfully!");
      // User already set from login response; skip refresh to avoid 401 redirect race
        navigate(consumePostLoginRedirect());
    } catch (error: any) {
      // Check if error message contains email verification or pending approval
      const errorMessage = error.message || "Failed to sign in";
      if (errorMessage.toLowerCase().includes("already logged in") || errorMessage.includes("log out there first")) {
        toast.warning(errorMessage, { duration: 8000 });
      } else if (errorMessage.includes("pending approval") || errorMessage.includes("Account pending approval") || errorMessage.includes("admin approval")) {
        toast.info(errorMessage, {
          duration: 8000,
        });
      } else if (
        errorMessage.includes("Email not verified") || 
        errorMessage.includes("email not verified") || 
        errorMessage.toLowerCase().includes("verify your email") ||
        errorMessage.toLowerCase().includes("verification link") ||
        errorMessage.toLowerCase().includes("request a new one")
      ) {
        toast.error(errorMessage, {
          action: {
            label: "Resend Verification Email",
            onClick: handleResendVerification,
          },
          duration: 8000,
        });
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRequestLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailVal = loginOtpEmail.trim().toLowerCase();
    if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      toast.error("Enter a valid email address.");
      return;
    }
    setLoadingLoginOtp(true);
    try {
      const res = await apiClient.requestLoginOtp(emailVal);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.data?.message || "OTP sent to your email.");
      setLoginViaOtpStep("otp");
      setLoginOtpValue("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to send OTP.");
    } finally {
      setLoadingLoginOtp(false);
    }
  };

  const handleVerifyLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginOtpValue.length !== 6) {
      toast.error("Enter the 6-digit OTP.");
      return;
    }
    setLoadingLoginOtp(true);
    try {
      const res = await apiClient.verifyLoginOtp(loginOtpEmail.trim().toLowerCase(), loginOtpValue);
      if (res.error) {
        if (res.error.toLowerCase().includes("already logged in") || res.error.includes("log out there first")) {
          toast.warning(res.error, { duration: 8000 });
        } else {
          toast.error(res.error);
        }
        return;
      }
      toast.success("Signed in successfully!");
      if (res.data?.user) setUserFromAuth(res.data.user);
      navigate(consumePostLoginRedirect());
    } catch (err: any) {
      toast.error(err?.message || "Verification failed.");
    } finally {
      setLoadingLoginOtp(false);
    }
  };

  const handleRequestForgotPasswordOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailVal = forgotEmail.trim().toLowerCase();
    if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      toast.error("Enter a valid email address.");
      return;
    }
    setLoadingForgotPassword(true);
    try {
      const res = await apiClient.requestForgotPasswordOtp(emailVal);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.data?.message || "OTP sent to your email.");
      setForgotPasswordStep("otp-password");
      setForgotOtp("");
      setForgotNewPassword("");
      setForgotNewPasswordConfirm("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to send OTP.");
    } finally {
      setLoadingForgotPassword(false);
    }
  };

  const handleVerifyForgotPasswordAndSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotOtp.length !== 6) {
      toast.error("Enter the 6-digit OTP.");
      return;
    }
    if (forgotNewPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    if (forgotNewPassword !== forgotNewPasswordConfirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoadingForgotPassword(true);
    try {
      const res = await apiClient.verifyForgotPasswordOtpAndSetPassword(
        forgotEmail.trim().toLowerCase(),
        forgotOtp,
        forgotNewPassword,
        forgotNewPasswordConfirm
      );
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(res.data?.message || "Password reset successfully. You can sign in with your new password.");
      setForgotPasswordStep("done");
    } catch (err: any) {
      toast.error(err?.message || "Failed to set password.");
    } finally {
      setLoadingForgotPassword(false);
    }
  };

  // Show loading while checking authentication
  if (checkingAuth) {
    return (
      <div className="page-shell flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell flex items-center justify-center p-4 sm:p-6 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,hsl(215_50%_40%/0.14),transparent)] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,hsl(215_40%_30%/0.2),transparent)]">
      <div className="w-full max-w-2xl">
        {/* Card */}
        <Card className="overflow-hidden border border-border/60 shadow-[var(--shadow-elegant)] bg-card/95 backdrop-blur-sm rounded-2xl">
          {/* Header */}
          <div className="relative px-6 sm:px-8 pt-6 pb-4 text-center border-b border-border/50 bg-gradient-to-b from-primary/5 to-transparent dark:from-primary/15">
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-3 top-4 h-12 w-12 rounded-xl text-muted-foreground hover:text-foreground"
              onClick={() => navigate("/")}
              title="Go to Home"
            >
              <Home className="h-8 w-8" strokeWidth={2.25} />
            </Button>
            <a
              href="https://en.wikipedia.org/wiki/IIT_Roorkee"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block focus:outline-none focus:ring-2 focus:ring-primary/40 rounded-lg"
              title="IIT Roorkee (Wikipedia)"
            >
              <img
                src="https://en.wikipedia.org/wiki/Special:FilePath/Indian_Institute_of_Technology_Roorkee_Logo.svg"
                alt="IIT Roorkee logo"
                className="h-14 w-auto mx-auto object-contain"
              />
            </a>
            <p className="mt-3 text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
              Indian Institute of Technology Roorkee
            </p>
            <p className="mt-1 text-sm text-primary/80 dark:text-sky-200/90 font-medium">
              Institute Equipment Booking Portal
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in or create an account
            </p>
          </div>

          <CardContent className="p-6 sm:p-8 text-base">
            {/* Channel i — primary CTA */}
            <div className="mb-6">
              <Button
                onClick={handleOmniportLogin}
                disabled={loading}
                className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 text-white font-medium transition-[var(--transition-smooth)]"
                size="lg"
              >
                <span className="flex items-center justify-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
                      <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" />
                    </svg>
                  </span>
                  {loading ? "Connecting..." : `Sign in with ${CHANNEL_I_DISPLAY_NAME} IITR`}
                </span>
              </Button>
              <p className="mt-3 text-xs text-muted-foreground text-center leading-relaxed">
                Official IIT Roorkee authentication. You will be redirected to {CHANNEL_I_DISPLAY_NAME} to sign in.
              </p>
            </div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/80" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
                  Or continue with email
                </span>
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-11 p-1 rounded-xl bg-muted/60">
                <TabsTrigger
                  value="signin"
                  className="rounded-lg font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm transition-[var(--transition-smooth)]"
                >
                  <KeyRound className="h-4 w-4 mr-2 opacity-70" />
                  Sign In
                </TabsTrigger>
                <TabsTrigger
                  value="signup"
                  className="rounded-lg font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm transition-[var(--transition-smooth)]"
                >
                  <UserPlus className="h-4 w-4 mr-2 opacity-70" />
                  Sign Up
                </TabsTrigger>
              </TabsList>
            
            <TabsContent value="signin" className="mt-6 focus-visible:outline-none">
              {forgotPasswordStep !== null ? (
                <div className="space-y-5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground -ml-1 gap-1.5"
                    onClick={() => {
                      setForgotPasswordStep(null);
                      setForgotEmail("");
                      setForgotOtp("");
                      setForgotNewPassword("");
                      setForgotNewPasswordConfirm("");
                    }}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Sign In
                  </Button>
                  {forgotPasswordStep === "email" && (
                    <form onSubmit={handleRequestForgotPasswordOtp} className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="forgot-email" className="text-foreground font-medium">Email</Label>
                        <Input
                          id="forgot-email"
                          type="email"
                          placeholder="you@example.com"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          required
                          className="h-11 rounded-xl border-border/80 bg-background"
                        />
                      </div>
                      <Button type="submit" className="w-full h-11 rounded-xl font-medium" disabled={loadingForgotPassword}>
                        {loadingForgotPassword ? "Sending..." : "Send OTP to email"}
                      </Button>
                    </form>
                  )}
                  {forgotPasswordStep === "otp-password" && (
                    <form onSubmit={handleVerifyForgotPasswordAndSetPassword} className="space-y-5">
                      <div className="space-y-2">
                        <Label className="text-foreground font-medium">Email</Label>
                        <Input type="email" value={forgotEmail} readOnly className="h-11 rounded-xl bg-muted/80 border-border/80" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-foreground font-medium">Enter 6-digit OTP</Label>
                        <div className="flex justify-center">
                          <InputOTP maxLength={6} value={forgotOtp} onChange={setForgotOtp}>
                            <InputOTPGroup className="gap-1.5">
                              <InputOTPSlot index={0} />
                              <InputOTPSlot index={1} />
                              <InputOTPSlot index={2} />
                              <InputOTPSlot index={3} />
                              <InputOTPSlot index={4} />
                              <InputOTPSlot index={5} />
                            </InputOTPGroup>
                          </InputOTP>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="forgot-new-password" className="text-foreground font-medium">New password</Label>
                        <div className="relative">
                          <Input
                            id="forgot-new-password"
                            type={showForgotNewPassword ? "text" : "password"}
                            placeholder="••••••••"
                            value={forgotNewPassword}
                            onChange={(e) => setForgotNewPassword(e.target.value)}
                            minLength={8}
                            className="h-11 rounded-xl pr-10 border-border/80 bg-background"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                            aria-label={showForgotNewPassword ? "Hide password" : "Show password"}
                          >
                            {showForgotNewPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">At least 8 characters</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="forgot-new-password-confirm" className="text-foreground font-medium">Confirm new password</Label>
                        <div className="relative">
                          <Input
                            id="forgot-new-password-confirm"
                            type={showForgotNewPasswordConfirm ? "text" : "password"}
                            placeholder="••••••••"
                            value={forgotNewPasswordConfirm}
                            onChange={(e) => setForgotNewPasswordConfirm(e.target.value)}
                            minLength={8}
                            className="h-11 rounded-xl pr-10 border-border/80 bg-background"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowForgotNewPasswordConfirm(!showForgotNewPasswordConfirm)}
                            aria-label={showForgotNewPasswordConfirm ? "Hide password" : "Show password"}
                          >
                            {showForgotNewPasswordConfirm ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                          </Button>
                        </div>
                      </div>
                      <Button type="submit" className="w-full h-11 rounded-xl font-medium" disabled={loadingForgotPassword}>
                        {loadingForgotPassword ? "Setting password..." : "Set new password"}
                      </Button>
                    </form>
                  )}
                  {forgotPasswordStep === "done" && (
                    <div className="space-y-5 text-center py-2">
                      <p className="text-sm text-muted-foreground">Your password has been reset. You can now sign in with your new password.</p>
                      <Button
                        type="button"
                        className="w-full h-11 rounded-xl font-medium"
                        onClick={() => {
                          setForgotPasswordStep(null);
                          setActiveTab("signin");
                        }}
                      >
                        Sign In
                      </Button>
                    </div>
                  )}
                </div>
              ) : loginViaOtpStep !== null ? (
                <div className="space-y-5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground -ml-1 gap-1.5"
                    onClick={() => {
                      setLoginViaOtpStep(null);
                      setLoginOtpValue("");
                    }}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Sign In
                  </Button>
                  {loginViaOtpStep === "email" && (
                    <form onSubmit={handleRequestLoginOtp} className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="login-otp-email" className="text-foreground font-medium">Email</Label>
                        <Input
                          id="login-otp-email"
                          type="email"
                          placeholder="you@example.com"
                          value={loginOtpEmail}
                          onChange={(e) => setLoginOtpEmail(e.target.value)}
                          required
                          className="h-11 rounded-xl border-border/80 bg-background"
                        />
                      </div>
                      <Button type="submit" className="w-full h-11 rounded-xl font-medium" disabled={loadingLoginOtp}>
                        {loadingLoginOtp ? "Sending OTP..." : "Send OTP to email"}
                      </Button>
                    </form>
                  )}
                  {loginViaOtpStep === "otp" && (
                    <form onSubmit={handleVerifyLoginOtp} className="space-y-5">
                      <div className="space-y-2">
                        <Label className="text-foreground font-medium">Email</Label>
                        <Input type="email" value={loginOtpEmail} readOnly className="h-11 rounded-xl bg-muted/80 border-border/80" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-foreground font-medium">Enter 6-digit OTP</Label>
                        <div className="flex justify-center">
                          <InputOTP maxLength={6} value={loginOtpValue} onChange={setLoginOtpValue}>
                            <InputOTPGroup className="gap-1.5">
                              <InputOTPSlot index={0} />
                              <InputOTPSlot index={1} />
                              <InputOTPSlot index={2} />
                              <InputOTPSlot index={3} />
                              <InputOTPSlot index={4} />
                              <InputOTPSlot index={5} />
                            </InputOTPGroup>
                          </InputOTP>
                        </div>
                      </div>
                      <Button type="submit" className="w-full h-11 rounded-xl font-medium" disabled={loadingLoginOtp || loginOtpValue.length !== 6}>
                        {loadingLoginOtp ? "Verifying..." : "Verify & sign in"}
                      </Button>
                    </form>
                  )}
                </div>
              ) : (
                <>
                  <form onSubmit={handleSignIn} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email" className="text-foreground font-medium">Email</Label>
                      <Input
                        id="signin-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="h-11 rounded-xl border-border/80 bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="signin-password" className="text-foreground font-medium">Password</Label>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-primary hover:underline transition-colors"
                          onClick={() => {
                            setForgotEmail(email.trim() || forgotEmail);
                            setForgotPasswordStep("email");
                          }}
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <Input
                          id="signin-password"
                          type={showSignInPassword ? "text" : "password"}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="h-11 rounded-xl pr-10 border-border/80 bg-background"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowSignInPassword(!showSignInPassword)}
                          aria-label={showSignInPassword ? "Hide password" : "Show password"}
                        >
                          {showSignInPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <Button type="submit" className="w-full h-11 rounded-xl font-medium" disabled={loading}>
                      {loading ? "Signing in..." : "Sign In"}
                    </Button>
                  </form>
                  <div className="relative my-5">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border/80" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-card px-3 text-xs text-muted-foreground">Or</span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11 rounded-xl gap-2 border-border/80 font-medium hover:bg-muted/50"
                    onClick={() => {
                      setLoginOtpEmail(email.trim() || loginOtpEmail);
                      setLoginViaOtpStep("email");
                    }}
                  >
                    <Mail className="h-4 w-4" />
                    Login via OTP (email)
                  </Button>
                </>
              )}
            </TabsContent>
            
            <TabsContent value="signup" className="mt-6 focus-visible:outline-none">
              <form onSubmit={handleSignUp} className="space-y-6">
                {/* Who can register — elegant info box */}
                <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-5">
                  <p className="text-base font-semibold text-foreground">Who can register</p>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    External users and IITR Post Doctoral Fellows, Research Associates in Projects, and IITR Startups can register here.
                  </p>
                  <p className="mt-3 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium text-primary dark:text-primary">
                    IITR Students, Faculty, and Officer in Charge / Lab in charge → sign in with {CHANNEL_I_DISPLAY_NAME} IITR above.
                  </p>
                </div>
                <div className="rounded-xl border border-border/80 bg-muted/20 dark:bg-muted/30 overflow-hidden">
                  <div className="px-5 py-4 border-b border-border/60 bg-muted/40">
                    <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
                      <ListChecks className="h-5 w-5 text-primary" />
                      Registration requirements
                    </h3>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="flex gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <User className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">For everyone</p>
                        <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed"><strong>Gender</strong> and <strong>Current Program/Employment Validity</strong> are required.</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Building2 className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">Educational Institute, Govt R&amp;D, Industry</p>
                        <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">Select <strong>State/Union Territory</strong> first; departments are filtered by type and state. Use your <strong>institution or organization email</strong> (not @iitr.ac.in).</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Mail className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-foreground">Institution/organization email</p>
                        <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">With a non-public email you get a <strong>self-verification link</strong>—no admin approval. Confirm your details and accept to start using the portal.</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                        <FileSignature className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">Public email (Gmail, Yahoo, etc.)</p>
                        <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">Download the <strong>KYC form</strong>, fill it, sign it, and upload a <strong>scan</strong> (choose &quot;KYC Form (signed &amp; scanned)&quot; as document type). Or use your institution email to skip this.</p>
                        <a
                          href="/IIC_IIT_Roorkee_KYC_Form.pdf"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 mt-2 text-sm font-medium text-primary hover:underline"
                        >
                          <FileText className="h-4 w-4 shrink-0" />
                          Download IIT Roorkee KYC Form (PDF)
                        </a>
                      </div>
                    </div>

                    <div className="border-t border-border/60 pt-4 space-y-3">
                      <div className="flex gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Building2 className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-sm font-medium text-foreground">IITR Post Doctoral Fellows &amp; Research Associates</p>
                          <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">Select a department under IIT Roorkee Department/Centres and an <strong>IITR Faculty supervisor</strong>.</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Building2 className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-sm font-medium text-foreground">IITR Startups</p>
                          <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">Select a department under <strong>Startups</strong>.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name" className="text-foreground font-medium">Full Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={255}
                    className="h-11 rounded-xl border-border/80 bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-gender" className="text-foreground font-medium">Gender <span className="text-destructive">*</span></Label>
                  <Select
                    value={gender || ""}
                    onValueChange={(v) => setGender(v)}
                    required
                  >
                    <SelectTrigger id="signup-gender" className="h-11 rounded-xl border-border/80 bg-background">
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
                  <Label htmlFor="signup-email" className="text-foreground font-medium">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11 rounded-xl border-border/80 bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-user-type" className="text-foreground font-medium">User Type</Label>
                  <Select
                    value={userType}
                    onValueChange={(value) => {
                      setUserType(value);
                      const type = userTypes.find((t) =>
                        t.alias ? `${t.code}|${t.name}` === value : t.code === value
                      );
                      if (type) setUserTypeAlias(type.alias ?? type.name ?? "");
                    }}
                    required
                    disabled={loadingUserTypes}
                  >
                    <SelectTrigger className="h-11 rounded-xl border-border/80 bg-background">
                      <SelectValue placeholder={loadingUserTypes ? "Loading user types..." : "Select user type"} />
                    </SelectTrigger>
                    <SelectContent>
                      {userTypes.map((type) => {
                        const value = type.alias ? `${type.code}|${type.name}` : type.code;
                        return (
                          <SelectItem key={value} value={value}>
                            {type.name}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {userType && userTypes.find(t => t.code === userType)?.description && (
                    <p className="text-xs text-muted-foreground">
                      {userTypes.find(t => t.code === userType)?.description}
                    </p>
                  )}
                  {userTypes.length === 0 && !loadingUserTypes && (
                    <p className="text-xs text-muted-foreground">
                      No user types available
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-emp-id" className="text-foreground font-medium">Employee / Student ID</Label>
                  <Input
                    id="signup-emp-id"
                    type="text"
                    placeholder="EMP001 or STUDENT123"
                    value={empId}
                    onChange={(e) => setEmpId(e.target.value)}
                    required
                    maxLength={50}
                    className="h-11 rounded-xl border-border/80 bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-phone" className="text-foreground font-medium">Phone Number</Label>
                  <Input
                    id="signup-phone"
                    type="tel"
                    placeholder="e.g. 9876543210 or +91 9876543210"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    required
                    maxLength={20}
                    className="h-11 rounded-xl border-border/80 bg-background"
                  />
                  <p className="text-xs text-muted-foreground">10-digit Indian mobile (starts with 6, 7, 8, or 9)</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password" className="text-foreground font-medium">Password</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showSignUpPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="h-11 rounded-xl pr-10 border-border/80 bg-background"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                      aria-label={showSignUpPassword ? "Hide password" : "Show password"}
                    >
                      {showSignUpPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">At least 8 characters</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password-confirm" className="text-foreground font-medium">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="signup-password-confirm"
                      type={showPasswordConfirm ? "text" : "password"}
                      placeholder="••••••••"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      required
                      minLength={8}
                      className="h-11 rounded-xl pr-10 border-border/80 bg-background"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                      aria-label={showPasswordConfirm ? "Hide password" : "Show password"}
                    >
                      {showPasswordConfirm ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-state-ut" className="text-foreground font-medium">
                    {(() => {
                      const code = userType.includes("|") ? userType.split("|")[0] : userType;
                      const needsState = code === "external" || code === "RND" || code === "Industry";
                      const requiredMark = needsState ? <span className="text-destructive"> *</span> : null;
                      if (selectedStateUt) {
                        const selected = indianStates.find((s) => s.value === selectedStateUt);
                        const label = selected?.type === "union_territory" ? "Union Territory" : "State";
                        return <>{label}{requiredMark}</>;
                      }
                      return <>State / Union Territory{requiredMark}</>;
                    })()}
                  </Label>
                  <Popover open={stateComboboxOpen} onOpenChange={setStateComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="signup-state-ut"
                        variant="outline"
                        role="combobox"
                        aria-expanded={stateComboboxOpen}
                        className="h-11 w-full justify-between rounded-xl border-border/80 bg-background font-normal"
                        disabled={loadingStates}
                      >
                        {loadingStates
                          ? "Loading..."
                          : selectedStateUt
                            ? indianStates.find((s) => s.value === selectedStateUt)?.label ?? selectedStateUt
                            : "Select State / Union Territory..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search state or union territory..." />
                        <CommandList>
                          <CommandEmpty>No state or union territory found.</CommandEmpty>
                          {(() => {
                            const states = indianStates.filter((s) => (s.type ?? "state") === "state");
                            const uts = indianStates.filter((s) => s.type === "union_territory");
                            return (
                              <>
                                {states.length > 0 && (
                                  <CommandGroup heading="States">
                                    {states.map((s) => (
                                      <CommandItem
                                        key={s.value}
                                        value={s.label}
                                        onSelect={() => {
                                          setSelectedStateUt(s.value);
                                          setStateComboboxOpen(false);
                                        }}
                                      >
                                        {s.label}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                )}
                                {uts.length > 0 && (
                                  <CommandGroup heading="Union Territories">
                                    {uts.map((s) => (
                                      <CommandItem
                                        key={s.value}
                                        value={s.label}
                                        onSelect={() => {
                                          setSelectedStateUt(s.value);
                                          setStateComboboxOpen(false);
                                        }}
                                      >
                                        {s.label}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                )}
                              </>
                            );
                          })()}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">
                    {(() => {
                      const code = userType.includes("|") ? userType.split("|")[0] : userType;
                      const needsState = code === "external" || code === "RND" || code === "Industry";
                      return needsState
                        ? "Required for Educational Institute, Govt R&D Organizations, and Industry. The list below is filtered by your selection."
                        : "Optional. You can search by name.";
                    })()}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-department" className="text-foreground font-medium">
                    {(() => {
                      const code = userType.includes("|") ? userType.split("|")[0] : userType;
                      if (code === "RND") return "Organization";
                      if (code === "Industry") return "Organization";
                      if (code === "external") return "Department / Institute";
                      return "Department";
                    })()}
                  </Label>
                  <Select
                    value={department}
                    onValueChange={(value) => {
                      setDepartment(value);
                      if (value && !value.startsWith("req-")) {
                        setPendingOrganizationRequestId(null);
                        setPendingOrganizationName("");
                      }
                    }}
                    required={!(() => {
                      const code = userType.includes("|") ? userType.split("|")[0] : userType;
                      return code === "RND" && (department || pendingOrganizationRequestId != null);
                    })()}
                    disabled={
                      loadingDepartments ||
                      !userType ||
                      (() => {
                        const code = userType.includes("|") ? userType.split("|")[0] : userType;
                        const needsState =
                          code === "external" ||
                          code === "RND" ||
                          code === "Industry" ||
                          code === "external_startup_msme";
                        return needsState && !selectedStateUt;
                      })()
                    }
                  >
                    <SelectTrigger className="h-11 rounded-xl border-border/80 bg-background">
                      <SelectValue
                        placeholder={
                          !userType
                            ? "Select user type first"
                            : (() => {
                                const code = userType.includes("|") ? userType.split("|")[0] : userType;
                                const needsState =
                          code === "external" ||
                          code === "RND" ||
                          code === "Industry" ||
                          code === "external_startup_msme";
                                if (needsState && !selectedStateUt) {
                                  return "Select State / Union Territory first";
                                }
                                const selected = userTypes.find((t) => (t.alias ? `${t.code}|${t.name}` === userType : t.code === userType));
                                if (selected?.alias || code === "startup_incubated_iitr") {
                                  return code === "startup_incubated_iitr" || selected?.name === "IITR Startups"
                                    ? "Select internal Startup"
                                    : "Select internal department";
                                }
                                if (code === "RND" || code === "Industry" || code === "external_startup_msme") {
                                  return loadingDepartments ? "Loading organizations..." : "Select organization";
                                }
                                if (code === "external") {
                                  return loadingDepartments ? "Loading departments..." : "Select department / institute";
                                }
                                return loadingDepartments ? "Loading departments..." : "Select department";
                              })()
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {(() => {
                        const code = userType.includes("|") ? userType.split("|")[0] : userType;
                        if (code === "RND") {
                          return (
                            <>
                              {departments.map((dept) => (
                                <SelectItem key={`dept-${dept.id}`} value={dept.id.toString()}>
                                  <span className="flex items-center gap-2">
                                    {dept.name} {dept.code ? `(${dept.code})` : ""}
                                    <span className="text-xs font-medium text-green-600 dark:text-green-500">Verified</span>
                                  </span>
                                </SelectItem>
                              ))}
                              {pendingOrganizationRequests.map((r) => (
                                <SelectItem key={`req-${r.id}`} value={`req-${r.id}`}>
                                  <span className="flex items-center gap-2">
                                    {r.name}
                                    <span className="text-xs font-medium text-muted-foreground">Unverified</span>
                                  </span>
                                </SelectItem>
                              ))}
                            </>
                          );
                        }
                        return (
                          <>
                            {departments.map((dept) => (
                              <SelectItem key={`dept-${dept.id}`} value={dept.id.toString()}>
                                <span className="flex items-center gap-2">
                                  {dept.name} {dept.code ? `(${dept.code})` : ""}
                                  {dept.verified !== false && (
                                    <span className="text-xs font-medium text-green-600 dark:text-green-500">Verified</span>
                                  )}
                                </span>
                              </SelectItem>
                            ))}
                            {pendingOrganizationRequests.map((r) => (
                              <SelectItem key={`req-${r.id}`} value={`req-${r.id}`}>
                                <span className="flex items-center gap-2">
                                  {r.name}
                                  <span className="text-xs font-medium text-muted-foreground">Unverified</span>
                                </span>
                              </SelectItem>
                            ))}
                          </>
                        );
                      })()}
                    </SelectContent>
                  </Select>
                  {userType && (() => {
                    const code = userType.includes("|") ? userType.split("|")[0] : userType;
                    const needsState = code === "external" || code === "RND" || code === "Industry";
                    if (needsState && !selectedStateUt) {
                      return (
                        <p className="text-xs text-muted-foreground">
                          {code === "RND" || code === "Industry"
                            ? "Select State / Union Territory above to load organizations for your type and location."
                            : "Select State / Union Territory above to load departments for your type and location."}
                        </p>
                      );
                    }
                    if (code === "RND" || code === "Industry") {
                      const hasAny = departments.length > 0 || pendingOrganizationRequests.length > 0;
                      if (!hasAny && !loadingDepartments && code === "RND") {
                        return (
                          <p className="text-xs text-muted-foreground">
                            No organizations available for this user type and state. Request a new organization below.
                          </p>
                        );
                      }
                      if (!hasAny && !loadingDepartments && code === "Industry") {
                        return (
                          <p className="text-xs text-muted-foreground">
                            No organizations available for this user type and state.
                          </p>
                        );
                      }
                    } else if (departments.length === 0 && !loadingDepartments) {
                      return (
                        <p className="text-xs text-muted-foreground">
                          {code === "external"
                            ? "No departments / institutes available for this user type and state."
                            : "No departments available for this user type and state."}
                        </p>
                      );
                    }
                    return null;
                  })()}
                  {!userType && (
                    <p className="text-xs text-muted-foreground">
                      Select user type to load the appropriate list
                    </p>
                  )}
                </div>
                {(() => {
                  const code = userType.includes("|") ? userType.split("|")[0] : userType;
                  if (code === "RND") {
                    return (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          Can’t find your organization in the list?
                        </p>
                        <div className="space-y-2 rounded-lg border border-border/70 bg-muted/30 p-3">
                          <div className="space-y-1">
                            <Label htmlFor="signup-org-request-name" className="text-xs font-medium text-foreground">
                              Request new Organization name
                            </Label>
                            <Input
                              id="signup-org-request-name"
                              type="text"
                              value={orgRequestName}
                              onChange={(e) => setOrgRequestName(e.target.value)}
                              placeholder="Enter full organization name"
                              className="h-9 rounded-lg border-border/80 bg-background text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="signup-org-request-notes" className="text-xs font-medium text-foreground">
                              Webpage (optional)
                            </Label>
                            <Input
                              id="signup-org-request-notes"
                              type="url"
                              value={orgRequestNotes}
                              onChange={(e) => setOrgRequestNotes(e.target.value)}
                              placeholder="https://..."
                              className="h-9 rounded-lg border-border/80 bg-background text-sm"
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setOrgRequestName("");
                                setOrgRequestNotes("");
                              }}
                            >
                              Clear
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              disabled={!orgRequestName.trim() || !selectedStateUt}
                              onClick={async () => {
                                if (!selectedStateUt) {
                                  toast.error("Select State/UT before requesting a new organization.");
                                  return;
                                }
                                try {
                                  const res = await apiClient.requestOrganization({
                                    name: orgRequestName.trim(),
                                    state: selectedStateUt,
                                    email: email.trim() || undefined,
                                    web_page: orgRequestNotes.trim() || undefined,
                                  });
                                  if (res.error) {
                                    throw new Error(res.error);
                                  }
                                  const requestId = res.data?.id;
                                  const requestedName = orgRequestName.trim();
                                  if (requestId != null && selectedStateUt) {
                                    setPendingOrganizationRequestId(requestId);
                                    setPendingOrganizationName(requestedName);
                                    setDepartment(`req-${requestId}`);
                                    apiClient
                                      .getDepartments("external", false, "govt_rnd", selectedStateUt)
                                      .then((response) => {
                                        if (response.data?.pending_organization_requests) {
                                          setPendingOrganizationRequests(response.data.pending_organization_requests);
                                        }
                                      })
                                      .catch(() => {});
                                  }
                                  toast.success(
                                    requestId != null
                                      ? `Organization "${requestedName}" requested. You can proceed with signup below using this organization; it will be linked once admin approves.`
                                      : (res.data?.message || "Organization request submitted. Admin will review and add it to the list.")
                                  );
                                  setOrgRequestName("");
                                  setOrgRequestNotes("");
                                } catch (err: any) {
                                  toast.error(err?.message || "Failed to submit organization request");
                                }
                              }}
                            >
                              Submit request
                            </Button>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Your request will be validated by an administrator. Once approved, the organization
                            will appear in this list for all users.
                          </p>
                          {pendingOrganizationRequestId != null && pendingOrganizationName && (
                            <p className="text-xs font-medium text-primary">
                              You are signing up with requested organization: <strong>{pendingOrganizationName}</strong>. You can proceed with &quot;Create account&quot; below; your account will be linked once admin approves.
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
                <div className="space-y-2">
                  <Label htmlFor="signup-program-end-date" className="text-foreground font-medium">
                    Current Program/Employment Validity <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="signup-program-end-date"
                    type="date"
                    value={programEndDate}
                    onChange={(e) => setProgramEndDate(e.target.value)}
                    required
                    className="h-11 rounded-xl border-border/80 bg-background"
                  />
                </div>
                {needsSupervisor() && (
                  <div className="space-y-2">
                    <Label htmlFor="signup-supervisor" className="text-foreground font-medium">Supervisor (IITR Internal Faculty)</Label>
                    <p className="text-xs text-muted-foreground">Search by name or email. Select your supervisor.</p>
                    {supervisorDisplay ? (
                      <div className="rounded-xl border border-border/80 bg-muted/40 p-3 space-y-1">
                        <p className="font-medium text-sm">{supervisorDisplay.name}</p>
                        <p className="text-xs text-muted-foreground">Department: {supervisorDisplay.department || "—"}</p>
                        <p className="text-xs text-muted-foreground">Email: {supervisorDisplay.email}</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-lg mt-1"
                          onClick={() => {
                            setSupervisorId("");
                            setSupervisorDisplay(null);
                            setFacultySearchQuery("");
                            setFacultySearchResults([]);
                          }}
                        >
                          Change
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Input
                          id="signup-supervisor"
                          type="text"
                          placeholder="Search by supervisor name or email..."
                          value={facultySearchQuery}
                          onChange={(e) => setFacultySearchQuery(e.target.value)}
                          className="h-11 rounded-xl border-border/80 bg-background mb-1"
                        />
                        {loadingFacultySearch && (
                          <p className="text-xs text-muted-foreground">Searching...</p>
                        )}
                        {facultySearchResults.length > 0 && (
                          <div className="border border-border/80 rounded-xl divide-y divide-border/80 max-h-48 overflow-y-auto">
                            {facultySearchResults.map((f) => (
                              <button
                                key={f.id}
                                type="button"
                                className="w-full text-left px-3 py-2.5 hover:bg-muted/60 transition-colors"
                                onClick={() => {
                                  setSupervisorId(f.id);
                                  setSupervisorDisplay(f);
                                  setFacultySearchQuery("");
                                  setFacultySearchResults([]);
                                }}
                              >
                                <p className="font-medium text-sm">{f.name}</p>
                                <p className="text-xs text-muted-foreground">{f.department || "—"} · {f.email}</p>
                              </button>
                            ))}
                          </div>
                        )}
                        {facultySearchQuery.length >= 2 && !loadingFacultySearch && facultySearchResults.length === 0 && (
                          <p className="text-xs text-muted-foreground">No faculty found. Try a different search.</p>
                        )}
                      </>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="signup-profile-picture" className="text-foreground font-medium">
                    Profile Picture <span className="text-destructive">*</span>
                  </Label>
                  <div className="space-y-3">
                    {profilePicturePreview && (
                      <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-primary/50 shadow-md">
                        <img
                          src={profilePicturePreview}
                          alt="Profile preview"
                          className="w-full h-full object-cover"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute top-0 right-0 h-6 w-6 rounded-full p-0"
                          onClick={() => {
                            setProfilePicture(null);
                            setProfilePicturePreview(null);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <Input
                        id="signup-profile-picture"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (!file.type.startsWith('image/')) {
                              toast.error("Please select an image file");
                              return;
                            }
                            setProfilePicture(file);
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setProfilePicturePreview(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="cursor-pointer file:rounded-lg file:border-0 file:bg-primary file:text-primary-foreground file:text-sm file:font-medium"
                        required
                      />
                      {!profilePicturePreview && (
                        <div className="flex items-center justify-center w-24 h-24 border-2 border-dashed border-border/80 rounded-full bg-muted/50">
                          <User className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">JPG, PNG, GIF, or WEBP</p>
                  </div>
                </div>
                {(() => {
                  const code = userType.includes("|") ? userType.split("|")[0] : userType;
                  const showKycSection = (code === "external" || code === "RND") && isPublicEmailDomain(email);
                  return showKycSection ? (
                    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 p-4 space-y-2">
                      <p className="text-sm font-semibold text-foreground">KYC form required (public email)</p>
                      <p className="text-xs text-muted-foreground">
                        Download the IIT Roorkee KYC form below, fill it, sign it, and upload a scan of the signed form. One of your document uploads must be this KYC form with type &quot;KYC Form (signed &amp; scanned)&quot;.
                      </p>
                      <a
                        href="/IIC_IIT_Roorkee_KYC_Form.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                      >
                        <FileText className="h-4 w-4" />
                        Download IIT Roorkee KYC Form (PDF)
                      </a>
                    </div>
                  ) : null;
                })()}
                <div className="space-y-2">
                  <Label htmlFor="signup-documents" className="text-foreground font-medium">
                    Upload KYC
                    {(() => {
                      const code = userType.includes("|") ? userType.split("|")[0] : userType;
                      if ((code === "external" || code === "RND") && isPublicEmailDomain(email)) {
                        return <span className="text-destructive"> *</span>;
                      }
                      return "";
                    })()}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Only required if public emails (e.g. Gmail, Yahoo) are used for registration.
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        id="signup-documents"
                        type="file"
                        multiple
                        accept="image/*,.pdf,.doc,.docx"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          const errors: string[] = [];
                          const validFiles: File[] = [];
                          
                          files.forEach((file) => {
                            const fileExtension = file.name.split('.').pop()?.toLowerCase();
                            const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx'];
                            const isValidImage = file.type.startsWith('image/');
                            const isValidPdf = file.type === 'application/pdf';
                            const isValidDoc = file.type === 'application/msword' || 
                                             file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                            
                            if (isValidImage || isValidPdf || isValidDoc || (fileExtension && validExtensions.includes(fileExtension))) {
                              validFiles.push(file);
                            } else {
                              errors.push(`${file.name}: Invalid file type. Only images, PDF, and DOC files are allowed.`);
                            }
                          });
                          
                          if (errors.length > 0) {
                            setDocumentErrors(errors);
                            toast.error(errors[0]);
                          } else {
                            setDocumentErrors([]);
                            setDocuments((prev) => [...prev, ...validFiles]);
                          }
                          
                          // Reset input
                          e.target.value = '';
                        }}
                        className="cursor-pointer"
                      />
                    </div>
                    {documents.length > 0 && (
                      <div className="space-y-3">
                        {documents.map((file, index) => (
                          <div
                            key={index}
                            className="p-3 rounded-xl border border-border/80 bg-muted/30 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="text-sm truncate">{file.name}</span>
                                <span className="text-xs text-muted-foreground flex-shrink-0">
                                  ({(file.size / 1024).toFixed(1)} KB)
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 flex-shrink-0 rounded-lg"
                                onClick={() => {
                                  setDocuments((prev) => prev.filter((_, i) => i !== index));
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {documentErrors.length > 0 && (
                      <div className="text-xs text-destructive space-y-1">
                        {documentErrors.map((error, index) => (
                          <p key={index}>{error}</p>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {(() => {
                        const code = userType.includes("|") ? userType.split("|")[0] : userType;
                        const required = (code === "external" || code === "RND") && isPublicEmailDomain(email);
                        return required
                          ? "Required: upload a scan of the signed KYC form (select 'KYC Form (signed & scanned)' as type). Use your institution/organization email to skip this."
                          : "Images, PDF, DOC, DOCX";
                      })()}
                    </p>
                  </div>
                </div>
                </div>
                <Button type="submit" className="w-full h-11 rounded-xl font-medium" disabled={loading}>
                  {loading ? "Creating account..." : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-6 pt-6 border-t border-border/50">
            <Button
              variant="outline"
              className="w-full h-11 rounded-xl border-border/80 font-medium hover:bg-muted/50"
              onClick={() => navigate("/")}
            >
              <Home className="h-4 w-4 mr-2" />
              Go to Home
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default Auth;