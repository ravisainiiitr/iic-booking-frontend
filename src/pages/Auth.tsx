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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { z } from "zod";
import { Eye, EyeOff, X, FileText, User, Home, Mail, ArrowLeft, KeyRound, UserPlus, ChevronsUpDown, Building2, Calendar, AlertTriangle, CheckCircle2, FlaskConical, Loader2, LogIn, ShieldCheck, Wallet, UserRound, LockKeyhole, UserCheck, Paperclip, Search } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { cn } from "@/lib/utils";
import { SignUpAside } from "@/components/auth/SignUpAside";
import { RegistrationRequirements } from "@/components/auth/RegistrationRequirements";
import { SignupField, SignupSection } from "@/components/auth/SignupFormParts";
import { SIGNUP_INPUT_CLASS, describedBy } from "@/components/auth/signupFieldUtils";
import {
  departmentLabel,
  findUserType,
  groupUserTypes,
  iitrDepartmentOptions,
  isIitrKind,
  matchesDepartmentSearch,
  isPublicEmailDomain,
  kindNeedsKycForPublicEmail,
  kindNeedsState,
  requirementsFor,
  signupKind,
  supervisorLabel,
  userTypeValue,
  validateSignup,
  type RegisterUserType,
  type SignupField as SignupFieldName,
} from "@/lib/signupForm";

const SIGNUP_FIELD_ORDER: Array<[SignupFieldName, string]> = [
  ["userType", "signup-user-type"],
  ["name", "signup-name"],
  ["gender", "signup-gender"],
  ["phone", "signup-phone"],
  ["empId", "signup-emp-id"],
  ["email", "signup-email"],
  ["password", "signup-password"],
  ["passwordConfirm", "signup-password-confirm"],
  ["state", "signup-state-ut"],
  ["department", "signup-department"],
  ["programEndDate", "signup-program-end-date"],
  ["supervisor", "signup-supervisor"],
  ["documents", "signup-documents"],
];

function PasswordInput({
  id,
  value,
  onChange,
  show,
  onToggleShow,
  autoComplete,
  required,
  minLength,
  className,
  invalid,
  describedBy: ariaDescribedBy,
  onBlur,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggleShow: () => void;
  autoComplete: string;
  required?: boolean;
  minLength?: number;
  className?: string;
  invalid?: boolean;
  describedBy?: string;
  onBlur?: () => void;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        placeholder="••••••••"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        aria-invalid={invalid || undefined}
        aria-describedby={ariaDescribedBy}
        className={cn("h-11 rounded-xl bg-background pr-10", className)}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
        onClick={onToggleShow}
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
      </Button>
    </div>
  );
}

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

const EMAIL_LOGIN_DISABLED_CODE = "email_login_disabled";

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
  internal_subcategory?: string | null;
  verified?: boolean;
}

interface PendingOrganizationRequest {
  id: number;
  name: string;
  verified: boolean;
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
  const [departmentComboboxOpen, setDepartmentComboboxOpen] = useState(false);
  const [departmentSearch, setDepartmentSearch] = useState("");
  const [loadingStates, setLoadingStates] = useState(false);
  const [programEndDate, setProgramEndDate] = useState("");
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [userTypes, setUserTypes] = useState<RegisterUserType[]>([]);
  const [loadingUserTypes, setLoadingUserTypes] = useState(false);
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState(() => (searchParams.get("mode") === "register" ? "signup" : "signin"));
  const [requirementsOpen, setRequirementsOpen] = useState(true);
  const [touched, setTouched] = useState<Partial<Record<SignupFieldName, boolean>>>({});
  const [signupSubmitAttempted, setSignupSubmitAttempted] = useState(false);
  const [signupDone, setSignupDone] = useState<{ email: string; iitr: boolean; supervisor: string; message: string } | null>(null);
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
  const [emailLoginBlocked, setEmailLoginBlocked] = useState<string | null>(null);
  const [programmeExpired, setProgrammeExpired] = useState<{ message: string; token: string; supervisor: string } | null>(null);

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

  // IITR Post-docs, Research Associates and IITR Startup choose from the IIT Roorkee departments and centres.
  // Educational Institute, Govt R&D, Industry and External Startup/MSME: external list filtered by category and state.
  useEffect(() => {
    if (activeTab !== "signup" || !userType) {
      if (!userType) setDepartments([]);
      return;
    }
    const resolvedCode = userType.includes("|") ? userType.split("|")[0]! : userType;
    const useInternalDepartments = isIitrKind(signupKind(userType));
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
      setLoadingDepartments(true);
      setPendingOrganizationRequests([]);
      apiClient
        .getDepartments("internal", false, undefined, undefined, "iit_roorkee_dept_centres")
        .then((response) => {
          setDepartments(iitrDepartmentOptions(response.data?.departments ?? []));
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
  }, [activeTab, userType, selectedStateUt]);

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

  const needsSupervisor = useCallback(() => isIitrKind(signupKind(userType)), [userType]);

  useEffect(() => {
    setRequirementsOpen(!userType);
  }, [userType]);

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

  const signupKindValue = signupKind(userType);
  const signupIsIitr = isIitrKind(signupKindValue);
  const signupNeedsState = kindNeedsState(signupKindValue);
  const signupKycRequired = kindNeedsKycForPublicEmail(signupKindValue) && isPublicEmailDomain(email);
  const selectedUserType = findUserType(userTypes, userType);
  const groupedUserTypes = groupUserTypes(userTypes);
  const todayIso = new Date().toLocaleDateString("en-CA");
  const signupErrors = validateSignup(
    {
      userType,
      name,
      gender,
      phone: phoneNumber,
      empId,
      email,
      password,
      passwordConfirm,
      state: selectedStateUt,
      department,
      hasOrganisationRequest: pendingOrganizationRequestId != null,
      programEndDate,
      supervisorId,
      documentCount: documents.length,
    },
    todayIso,
  );
  const fieldError = (field: SignupFieldName) =>
    signupSubmitAttempted || touched[field] ? signupErrors[field] : undefined;
  const touch = (field: SignupFieldName) => () => setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupSubmitAttempted(true);
    const firstInvalid = SIGNUP_FIELD_ORDER.find(([field]) => signupErrors[field]);
    if (firstInvalid) {
      const [field, elementId] = firstInvalid;
      const count = Object.keys(signupErrors).length;
      toast.error(count > 1 ? `Please check the ${count} highlighted fields.` : signupErrors[field]!);
      const el = document.getElementById(elementId);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
      return;
    }
    const resolvedCode = userType.includes("|") ? userType.split("|")[0]! : userType;
    const isReqFromDropdown = resolvedCode === "RND" && department.startsWith("req-");

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
          toast.success("Account created. Check your email to continue.", { duration: 6000 });
          setSignupDone({ email: validated.email, iitr: signupIsIitr, supervisor: supervisorDisplay?.name ?? "", message });
          
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
          
          setTouched({});
          setSignupSubmitAttempted(false);
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
        setTouched({});
        setSignupSubmitAttempted(false);
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
    setProgrammeExpired(null);

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

      if (response.errorCode === EMAIL_LOGIN_DISABLED_CODE) {
        setEmailLoginBlocked(response.error || "Email sign-in is turned off for this account.");
        return;
      }

      if (response.error) {
        const errorData = response.fieldErrors as any;
        const adminApproved = errorData?.admin_approved ?? (response as any).admin_approved;
        const emailVerified = errorData?.email_verified ?? (response as any).email_verified;
        const errorMessage = errorData?.message ?? (response as any).message ?? response.error;
        
        const isPendingApprovalError = String(adminApproved).toLowerCase() === 'false';
        const isEmailVerificationError = String(emailVerified).toLowerCase() === 'false';

        const extensionToken = typeof errorData?.extension_token === "string" ? errorData.extension_token : "";
        if (extensionToken) {
          setProgrammeExpired({
            message: errorMessage || "Your programme validity has passed, so access is disabled. Your supervisor can extend it by up to six months at a time.",
            token: extensionToken,
            supervisor: typeof errorData?.supervisor_name === "string" ? errorData.supervisor_name : "",
          });
          return;
        }

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
      if (res.errorCode === EMAIL_LOGIN_DISABLED_CODE) {
        setEmailLoginBlocked(res.error || "Email sign-in is turned off for this account.");
        return;
      }
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
      if (res.errorCode === EMAIL_LOGIN_DISABLED_CODE) {
        setEmailLoginBlocked(res.error || "Email sign-in is turned off for this account.");
        return;
      }
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

  const switchEmailMethod = (method: "password" | "otp") => {
    setEmailLoginBlocked(null);
    if (method === "otp") {
      setLoginOtpEmail(email.trim() || loginOtpEmail);
      setLoginOtpValue("");
      setLoginViaOtpStep("email");
      return;
    }
    if (loginOtpEmail.trim()) setEmail(loginOtpEmail.trim());
    setLoginOtpValue("");
    setLoginViaOtpStep(null);
  };

  const openForgotPassword = () => {
    setEmailLoginBlocked(null);
    setForgotEmail((loginViaOtpStep !== null ? loginOtpEmail : email).trim() || forgotEmail);
    setForgotPasswordStep("email");
  };

  const closeForgotPassword = () => {
    setForgotPasswordStep(null);
    setForgotEmail("");
    setForgotOtp("");
    setForgotNewPassword("");
    setForgotNewPasswordConfirm("");
    setEmailLoginBlocked(null);
  };

  const emailLoginBlockedNotice = emailLoginBlocked ? (
    <div
      role="alert"
      className="rounded-xl border border-amber-300/70 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="space-y-3">
          <p className="leading-relaxed">{emailLoginBlocked}</p>
          <Button type="button" size="sm" className="rounded-lg" onClick={handleOmniportLogin} disabled={loading}>
            Sign in with {CHANNEL_I_DISPLAY_NAME}
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  const programmeExpiredNotice = programmeExpired ? (
    <div
      role="alert"
      className="rounded-xl border border-amber-300/70 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div className="space-y-3">
          <p className="leading-relaxed">{programmeExpired.message}</p>
          {programmeExpired.supervisor ? (
            <p className="text-xs leading-relaxed">The request goes to {programmeExpired.supervisor}.</p>
          ) : null}
          <Button
            type="button"
            size="sm"
            className="rounded-lg"
            onClick={() => navigate(`/programme-extension?token=${encodeURIComponent(programmeExpired.token)}&from=login`)}
          >
            Request an extension
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  const brandLogo = (
    <a
      href="https://en.wikipedia.org/wiki/IIT_Roorkee"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex rounded-2xl bg-white p-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      title="IIT Roorkee (Wikipedia)"
    >
      <img
        src="https://en.wikipedia.org/wiki/Special:FilePath/Indian_Institute_of_Technology_Roorkee_Logo.svg"
        alt="IIT Roorkee logo"
        className="h-14 w-14 object-contain"
      />
    </a>
  );

  return (
    <div
      className={cn(
        "page-shell grid min-h-screen",
        activeTab === "signup"
          ? "lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]"
          : "lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]",
      )}
    >
      {/* Brand panel (desktop): the gradient fills the whole column; the content stays pinned beside the long Create account form */}
      <aside className="relative hidden bg-gradient-to-b from-[hsl(215_62%_20%)] via-brand to-[hsl(200_65%_30%)] text-white lg:block">
        <div className="relative overflow-hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-sky-300/10 blur-3xl" aria-hidden />
        <div className="relative flex h-full flex-col justify-between gap-8 overflow-y-auto p-10 xl:p-12">
          <div className="flex items-center gap-4">
            {brandLogo}
            <div>
              <p className="text-lg font-semibold leading-tight">Indian Institute of Technology Roorkee</p>
              <p className="text-sm text-white/75">Institute Equipment Booking Portal</p>
            </div>
          </div>

          {activeTab === "signup" ? (
            <SignUpAside />
          ) : (
          <>
          <div className="space-y-8">
            <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">
              Book research equipment, track your samples and manage your wallet in one place.
            </h2>
            <ul className="space-y-4 text-sm text-white/85">
              {[
                { icon: Calendar, text: "Live slot availability and instant booking for institute equipment" },
                { icon: FlaskConical, text: "Sample submission, analysis status and results sharing" },
                { icon: Wallet, text: "Department wallets, recharges and transparent charges" },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="pt-1.5 leading-relaxed">{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/70">How to sign in</p>
            <dl className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
                <div>
                  <dt className="font-medium">IITR students, faculty, OIC and Lab Operator</dt>
                  <dd className="text-white/75">{CHANNEL_I_DISPLAY_NAME} (recommended). Email sign-in only if turned on in My Profile.</dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-sky-200" aria-hidden />
                <div>
                  <dt className="font-medium">External users, IITR Post-docs, Research Associates and Startups</dt>
                  <dd className="text-white/75">Email with password or one-time code.</dd>
                </div>
              </div>
            </dl>
          </div>
          </>
          )}
        </div>
        </div>
      </aside>

      {/* Form panel */}
      <main className="relative flex min-w-0 flex-col items-center bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,hsl(215_50%_40%/0.10),transparent)] px-4 py-6 sm:px-8 sm:py-10 lg:justify-center dark:bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,hsl(215_40%_30%/0.18),transparent)]">
        <Button
          variant="outline"
          size="icon"
          className="absolute right-6 top-6 hidden h-14 w-14 rounded-2xl border-primary/30 text-primary shadow-sm hover:bg-primary/10 hover:text-primary lg:inline-flex"
          onClick={() => navigate("/")}
          title="Go to Home"
          aria-label="Go to Home"
        >
          <Home className="!h-8 !w-8" />
        </Button>
        {/* Mobile header */}
        <div className="mb-6 flex w-full max-w-lg items-center justify-between gap-3 lg:hidden">
          <div className="flex items-center gap-3">
            {brandLogo}
            <div>
              <p className="text-base font-semibold leading-tight">IIT Roorkee</p>
              <p className="text-xs text-muted-foreground">Institute Equipment Booking Portal</p>
            </div>
          </div>
          <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl text-primary" onClick={() => navigate("/")} aria-label="Go to Home">
            <Home className="!h-7 !w-7" />
          </Button>
        </div>

        <div className={cn("w-full transition-[max-width]", activeTab === "signup" ? "max-w-[54rem]" : "max-w-lg")}>
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {activeTab === "signin" ? "Welcome back" : "Create your account"}
            </h1>
            <p className={cn("mt-1 text-muted-foreground", activeTab === "signup" ? "text-base" : "text-sm")}>
              {activeTab === "signin"
                ? "Sign in to book equipment and manage your requests."
                : "For IITR Post-docs, Research Associates and Startups, and external users."}
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl bg-muted/60 p-1">
              <TabsTrigger
                value="signin"
                className="rounded-lg font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <LogIn className="mr-2 h-4 w-4 opacity-70" />
                Sign in
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                className="rounded-lg font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <UserPlus className="mr-2 h-4 w-4 opacity-70" />
                Create account
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-6 focus-visible:outline-none">
              {forgotPasswordStep !== null ? (
                <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
                  <CardContent className="space-y-5 p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold">Reset your password</p>
                        <p className="text-sm text-muted-foreground">
                          {forgotPasswordStep === "email" && "Step 1 of 2 · We will email you a 6-digit code."}
                          {forgotPasswordStep === "otp-password" && "Step 2 of 2 · Enter the code and choose a new password."}
                          {forgotPasswordStep === "done" && "All done."}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="-mr-2 shrink-0 gap-1.5 text-muted-foreground hover:text-foreground"
                        onClick={closeForgotPassword}
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Back
                      </Button>
                    </div>
                    {forgotPasswordStep !== "done" && (
                      <div className="grid grid-cols-2 gap-1.5" aria-hidden>
                        <span className="h-1 rounded-full bg-primary" />
                        <span className={cn("h-1 rounded-full", forgotPasswordStep === "otp-password" ? "bg-primary" : "bg-muted")} />
                      </div>
                    )}
                    {emailLoginBlockedNotice}
                    {forgotPasswordStep === "email" && (
                      <form onSubmit={handleRequestForgotPasswordOtp} className="space-y-5">
                        <div className="space-y-2">
                          <Label htmlFor="forgot-email" className="font-medium">Email</Label>
                          <Input
                            id="forgot-email"
                            type="email"
                            autoComplete="email"
                            placeholder="you@example.com"
                            value={forgotEmail}
                            onChange={(e) => {
                              setForgotEmail(e.target.value);
                              setEmailLoginBlocked(null);
                            }}
                            required
                            className="h-11 rounded-xl bg-background"
                          />
                        </div>
                        <Button type="submit" className="h-11 w-full rounded-xl font-medium" disabled={loadingForgotPassword}>
                          {loadingForgotPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {loadingForgotPassword ? "Sending..." : "Send code"}
                        </Button>
                      </form>
                    )}
                    {forgotPasswordStep === "otp-password" && (
                      <form onSubmit={handleVerifyForgotPasswordAndSetPassword} className="space-y-5">
                        <p className="text-sm text-muted-foreground">
                          Code sent to <span className="font-medium text-foreground">{forgotEmail}</span>.{" "}
                          <button
                            type="button"
                            className="font-medium text-primary hover:underline"
                            onClick={() => setForgotPasswordStep("email")}
                          >
                            Change
                          </button>
                        </p>
                        <div className="space-y-2">
                          <Label className="font-medium">6-digit code</Label>
                          <InputOTP maxLength={6} value={forgotOtp} onChange={setForgotOtp}>
                            <InputOTPGroup className="gap-1.5">
                              {[0, 1, 2, 3, 4, 5].map((i) => (
                                <InputOTPSlot key={i} index={i} className="h-11 w-11 rounded-lg border text-base" />
                              ))}
                            </InputOTPGroup>
                          </InputOTP>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="forgot-new-password" className="font-medium">New password</Label>
                            <PasswordInput
                              id="forgot-new-password"
                              value={forgotNewPassword}
                              onChange={setForgotNewPassword}
                              show={showForgotNewPassword}
                              onToggleShow={() => setShowForgotNewPassword(!showForgotNewPassword)}
                              autoComplete="new-password"
                              minLength={8}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="forgot-new-password-confirm" className="font-medium">Confirm password</Label>
                            <PasswordInput
                              id="forgot-new-password-confirm"
                              value={forgotNewPasswordConfirm}
                              onChange={setForgotNewPasswordConfirm}
                              show={showForgotNewPasswordConfirm}
                              onToggleShow={() => setShowForgotNewPasswordConfirm(!showForgotNewPasswordConfirm)}
                              autoComplete="new-password"
                              minLength={8}
                            />
                          </div>
                        </div>
                        <p className="-mt-2 text-xs text-muted-foreground">At least 8 characters.</p>
                        <Button type="submit" className="h-11 w-full rounded-xl font-medium" disabled={loadingForgotPassword}>
                          {loadingForgotPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {loadingForgotPassword ? "Saving..." : "Set new password"}
                        </Button>
                      </form>
                    )}
                    {forgotPasswordStep === "done" && (
                      <div className="space-y-5 py-2 text-center">
                        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden />
                        <p className="text-sm text-muted-foreground">
                          Your password has been reset. You can now sign in with your new password.
                        </p>
                        <Button
                          type="button"
                          className="h-11 w-full rounded-xl font-medium"
                          onClick={() => {
                            setEmail(forgotEmail.trim() || email);
                            closeForgotPassword();
                            setLoginViaOtpStep(null);
                            setActiveTab("signin");
                          }}
                        >
                          Back to sign in
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-5">
                  {/* Channel i — preferred */}
                  <Card className="rounded-2xl border-primary/25 bg-gradient-to-br from-primary/[0.06] to-transparent shadow-[var(--shadow-card)]">
                    <CardContent className="space-y-3 p-5 sm:p-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">Recommended</span>
                        <span className="text-sm text-muted-foreground">IITR students, faculty, OIC and Lab Operator</span>
                      </div>
                      <Button
                        onClick={handleOmniportLogin}
                        disabled={loading}
                        className="h-12 w-full rounded-xl bg-brand text-base font-medium text-white shadow-lg shadow-primary/20 hover:bg-brand/90"
                        size="lg"
                      >
                        <span className="flex items-center justify-center gap-2.5">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                            {loading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
                                <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" />
                              </svg>
                            )}
                          </span>
                          {loading ? "Connecting..." : `Sign in with ${CHANNEL_I_DISPLAY_NAME} IITR`}
                        </span>
                      </Button>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        You will be redirected to {CHANNEL_I_DISPLAY_NAME}. First time here? Sign in with{" "}
                        {CHANNEL_I_DISPLAY_NAME}; you can turn on email sign-in later in My Profile.
                      </p>
                    </CardContent>
                  </Card>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center" aria-hidden>
                      <div className="w-full border-t border-border/80" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-background px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Or sign in with email
                      </span>
                    </div>
                  </div>

                  {/* Email — password or one-time code */}
                  <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
                    <CardContent className="space-y-5 p-5 sm:p-6">
                      <div role="tablist" aria-label="Email sign-in method" className="grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1">
                        {(["password", "otp"] as const).map((method) => {
                          const active = method === "otp" ? loginViaOtpStep !== null : loginViaOtpStep === null;
                          return (
                            <button
                              key={method}
                              type="button"
                              role="tab"
                              aria-selected={active}
                              onClick={() => switchEmailMethod(method)}
                              className={cn(
                                "flex h-9 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors",
                                active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              {method === "password" ? <KeyRound className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                              {method === "password" ? "Password" : "One-time code"}
                            </button>
                          );
                        })}
                      </div>

                      {emailLoginBlockedNotice}
                      {programmeExpiredNotice}

                      {loginViaOtpStep === null && (
                        <form onSubmit={handleSignIn} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="signin-email" className="font-medium">Email</Label>
                            <Input
                              id="signin-email"
                              type="email"
                              autoComplete="email"
                              placeholder="you@example.com"
                              value={email}
                              onChange={(e) => {
                                setEmail(e.target.value);
                                setEmailLoginBlocked(null);
                              }}
                              required
                              className="h-11 rounded-xl bg-background"
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="signin-password" className="font-medium">Password</Label>
                              <button
                                type="button"
                                className="text-xs font-medium text-primary hover:underline"
                                onClick={openForgotPassword}
                              >
                                Forgot password?
                              </button>
                            </div>
                            <PasswordInput
                              id="signin-password"
                              value={password}
                              onChange={setPassword}
                              show={showSignInPassword}
                              onToggleShow={() => setShowSignInPassword(!showSignInPassword)}
                              autoComplete="current-password"
                              required
                            />
                          </div>
                          <Button type="submit" className="h-11 w-full rounded-xl font-medium" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {loading ? "Signing in..." : "Sign in"}
                          </Button>
                        </form>
                      )}

                      {loginViaOtpStep === "email" && (
                        <form onSubmit={handleRequestLoginOtp} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="login-otp-email" className="font-medium">Email</Label>
                            <Input
                              id="login-otp-email"
                              type="email"
                              autoComplete="email"
                              placeholder="you@example.com"
                              value={loginOtpEmail}
                              onChange={(e) => {
                                setLoginOtpEmail(e.target.value);
                                setEmailLoginBlocked(null);
                              }}
                              required
                              className="h-11 rounded-xl bg-background"
                            />
                            <p className="text-xs text-muted-foreground">We will email you a 6-digit code. No password needed.</p>
                          </div>
                          <Button type="submit" className="h-11 w-full rounded-xl font-medium" disabled={loadingLoginOtp}>
                            {loadingLoginOtp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {loadingLoginOtp ? "Sending code..." : "Send code"}
                          </Button>
                        </form>
                      )}

                      {loginViaOtpStep === "otp" && (
                        <form onSubmit={handleVerifyLoginOtp} className="space-y-4">
                          <p className="text-sm text-muted-foreground">
                            Code sent to <span className="font-medium text-foreground">{loginOtpEmail}</span>.{" "}
                            <button
                              type="button"
                              className="font-medium text-primary hover:underline"
                              onClick={() => {
                                setLoginViaOtpStep("email");
                                setLoginOtpValue("");
                              }}
                            >
                              Change
                            </button>
                          </p>
                          <div className="space-y-2">
                            <Label className="font-medium">6-digit code</Label>
                            <InputOTP maxLength={6} value={loginOtpValue} onChange={setLoginOtpValue}>
                              <InputOTPGroup className="gap-1.5">
                                {[0, 1, 2, 3, 4, 5].map((i) => (
                                  <InputOTPSlot key={i} index={i} className="h-11 w-11 rounded-lg border text-base" />
                                ))}
                              </InputOTPGroup>
                            </InputOTP>
                          </div>
                          <Button
                            type="submit"
                            className="h-11 w-full rounded-xl font-medium"
                            disabled={loadingLoginOtp || loginOtpValue.length !== 6}
                          >
                            {loadingLoginOtp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {loadingLoginOtp ? "Verifying..." : "Verify and sign in"}
                          </Button>
                          <button
                            type="button"
                            className="w-full text-center text-xs font-medium text-muted-foreground hover:text-primary"
                            onClick={(e) => void handleRequestLoginOtp(e as unknown as React.FormEvent)}
                            disabled={loadingLoginOtp}
                          >
                            Resend code
                          </button>
                        </form>
                      )}
                    </CardContent>
                  </Card>

                  <p className="text-center text-sm text-muted-foreground">
                    New to the portal?{" "}
                    <button type="button" className="font-medium text-primary hover:underline" onClick={() => setActiveTab("signup")}>
                      Create an account
                    </button>
                  </p>
                </div>
              )}
            </TabsContent>
            <TabsContent value="signup" className="mt-6 focus-visible:outline-none">
              {signupDone ? (
                <div role="status" className="rounded-2xl border border-emerald-300/70 bg-emerald-50/70 p-6 text-emerald-950 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-50 sm:p-8">
                  <div className="flex items-start gap-4">
                    <CheckCircle2 className="mt-0.5 h-7 w-7 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                    <div className="space-y-3 text-base leading-relaxed">
                      <h2 className="text-xl font-semibold">Check your email</h2>
                      <p>
                        We have sent a verification link to <strong>{signupDone.email}</strong>. Open it to confirm your details.
                      </p>
                      {signupDone.iitr ? (
                        <p>
                          Once you confirm, your request goes to {signupDone.supervisor || "your IITR faculty supervisor"}, who has{" "}
                          <strong>24 hours</strong> to approve it. If they decline or do not respond in time, the request is cancelled and you can register again. We email you at each step.
                        </p>
                      ) : (
                        <p className="text-emerald-900/80 dark:text-emerald-100/80">{signupDone.message}</p>
                      )}
                      <div className="flex flex-wrap gap-3 pt-2">
                        <Button
                          type="button"
                          className="h-11 rounded-xl px-6 text-base"
                          onClick={() => {
                            setSignupDone(null);
                            setActiveTab("signin");
                          }}
                        >
                          Go to sign in
                        </Button>
                        <Button type="button" variant="outline" className="h-11 rounded-xl px-6 text-base" onClick={() => setSignupDone(null)}>
                          Register another account
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
              <form onSubmit={handleSignUp} noValidate className="space-y-6">
                <div className="flex flex-col gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                    <p className="text-base leading-relaxed text-foreground">
                      <strong>IITR Students, Faculty, Officers in Charge and Lab Operators do not need to register.</strong>{" "}
                      <span className="text-muted-foreground">Use {CHANNEL_I_DISPLAY_NAME} IITR on the Sign in tab.</span>
                    </p>
                  </div>
                  <Button type="button" variant="outline" className="h-11 shrink-0 rounded-xl border-primary/40 text-base text-primary hover:bg-primary/10" onClick={() => setActiveTab("signin")}>
                    Sign in with {CHANNEL_I_DISPLAY_NAME}
                  </Button>
                </div>

                <SignupSection icon={UserRound} title="About you" description="Choose who you are registering as; the form adapts to it.">
                  <SignupField
                    id="signup-user-type"
                    label="I am registering as"
                    required
                    wide
                    error={fieldError("userType")}
                    hint={selectedUserType?.description || (loadingUserTypes ? "Loading user types…" : undefined)}
                  >
                    <Select
                      value={userType}
                      onValueChange={(value) => {
                        setUserType(value);
                        const type = findUserType(userTypes, value);
                        if (type) setUserTypeAlias(type.alias ?? type.name ?? "");
                      }}
                      disabled={loadingUserTypes}
                    >
                      <SelectTrigger
                        id="signup-user-type"
                        className={SIGNUP_INPUT_CLASS}
                        aria-invalid={Boolean(fieldError("userType")) || undefined}
                        aria-describedby={describedBy("signup-user-type", selectedUserType?.description, fieldError("userType"))}
                      >
                        <SelectValue placeholder={loadingUserTypes ? "Loading user types..." : "Select user type"} />
                      </SelectTrigger>
                      <SelectContent>
                        {groupedUserTypes.iitr.length > 0 && (
                          <SelectGroup>
                            <SelectLabel className="text-xs uppercase tracking-wider text-muted-foreground">IIT Roorkee</SelectLabel>
                            {groupedUserTypes.iitr.map((type) => (
                              <SelectItem key={userTypeValue(type)} value={userTypeValue(type)} className="py-2.5 text-base">
                                {type.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                        {groupedUserTypes.iitr.length > 0 && groupedUserTypes.external.length > 0 && <SelectSeparator />}
                        {groupedUserTypes.external.length > 0 && (
                          <SelectGroup>
                            <SelectLabel className="text-xs uppercase tracking-wider text-muted-foreground">External</SelectLabel>
                            {groupedUserTypes.external.map((type) => (
                              <SelectItem key={userTypeValue(type)} value={userTypeValue(type)} className="py-2.5 text-base">
                                {type.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                      </SelectContent>
                    </Select>
                    {userTypes.length === 0 && !loadingUserTypes && (
                      <p className="text-sm text-muted-foreground">No user types available. Please reload the page.</p>
                    )}
                  </SignupField>

                  <div className="md:col-span-2">
                    <RegistrationRequirements
                      items={requirementsFor(signupKindValue)}
                      typeName={selectedUserType?.name}
                      open={requirementsOpen}
                      onOpenChange={setRequirementsOpen}
                    />
                  </div>

                  <SignupField id="signup-name" label="Full name" required error={fieldError("name")}>
                    <Input
                      id="signup-name"
                      type="text"
                      autoComplete="name"
                      placeholder="As on your ID card"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={touch("name")}
                      maxLength={255}
                      aria-invalid={Boolean(fieldError("name")) || undefined}
                      aria-describedby={describedBy("signup-name", undefined, fieldError("name"))}
                      className={SIGNUP_INPUT_CLASS}
                    />
                  </SignupField>
                  <SignupField id="signup-gender" label="Gender" required error={fieldError("gender")}>
                    <Select value={gender || ""} onValueChange={(v) => setGender(v)}>
                      <SelectTrigger
                        id="signup-gender"
                        className={SIGNUP_INPUT_CLASS}
                        aria-invalid={Boolean(fieldError("gender")) || undefined}
                        aria-describedby={describedBy("signup-gender", undefined, fieldError("gender"))}
                      >
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male" className="text-base">Male</SelectItem>
                        <SelectItem value="female" className="text-base">Female</SelectItem>
                        <SelectItem value="other" className="text-base">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </SignupField>
                  <SignupField
                    id="signup-phone"
                    label="Mobile number"
                    required
                    hint="10-digit Indian mobile number"
                    error={fieldError("phone")}
                  >
                    <Input
                      id="signup-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="9876543210"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      onBlur={touch("phone")}
                      maxLength={20}
                      aria-invalid={Boolean(fieldError("phone")) || undefined}
                      aria-describedby={describedBy("signup-phone", "hint", fieldError("phone"))}
                      className={SIGNUP_INPUT_CLASS}
                    />
                  </SignupField>
                  <SignupField
                    id="signup-emp-id"
                    label={signupKindValue === "iitr_startup" ? "Startup or incubation ID" : "Employee / Student ID"}
                    required
                    hint={signupIsIitr ? "As issued by IIT Roorkee or your incubator" : "As issued by your institution or organisation"}
                    error={fieldError("empId")}
                  >
                    <Input
                      id="signup-emp-id"
                      type="text"
                      placeholder={signupKindValue === "iitr_startup" ? "e.g. TIDES-2026-014" : "e.g. EMP001"}
                      value={empId}
                      onChange={(e) => setEmpId(e.target.value)}
                      onBlur={touch("empId")}
                      maxLength={50}
                      aria-invalid={Boolean(fieldError("empId")) || undefined}
                      aria-describedby={describedBy("signup-emp-id", "hint", fieldError("empId"))}
                      className={SIGNUP_INPUT_CLASS}
                    />
                  </SignupField>
                </SignupSection>

                <SignupSection icon={LockKeyhole} title="Account" description="You will sign in with this email and password.">
                  <SignupField
                    id="signup-email"
                    label="Email"
                    required
                    wide
                    hint={
                      signupIsIitr
                        ? "We send a verification link to this address."
                        : "Use your institution or organisation email (not @iitr.ac.in)."
                    }
                    error={fieldError("email")}
                  >
                    <Input
                      id="signup-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onBlur={touch("email")}
                      aria-invalid={Boolean(fieldError("email")) || undefined}
                      aria-describedby={describedBy("signup-email", "hint", fieldError("email"))}
                      className={SIGNUP_INPUT_CLASS}
                    />
                  </SignupField>
                  <SignupField id="signup-password" label="Password" required hint="At least 8 characters" error={fieldError("password")}>
                    <PasswordInput
                      id="signup-password"
                      value={password}
                      onChange={setPassword}
                      onBlur={touch("password")}
                      show={showSignUpPassword}
                      onToggleShow={() => setShowSignUpPassword(!showSignUpPassword)}
                      autoComplete="new-password"
                      minLength={8}
                      invalid={Boolean(fieldError("password"))}
                      describedBy={describedBy("signup-password", "hint", fieldError("password"))}
                      className={cn(SIGNUP_INPUT_CLASS, "pr-11")}
                    />
                  </SignupField>
                  <SignupField id="signup-password-confirm" label="Confirm password" required error={fieldError("passwordConfirm")}>
                    <PasswordInput
                      id="signup-password-confirm"
                      value={passwordConfirm}
                      onChange={setPasswordConfirm}
                      onBlur={touch("passwordConfirm")}
                      show={showPasswordConfirm}
                      onToggleShow={() => setShowPasswordConfirm(!showPasswordConfirm)}
                      autoComplete="new-password"
                      minLength={8}
                      invalid={Boolean(fieldError("passwordConfirm"))}
                      describedBy={describedBy("signup-password-confirm", undefined, fieldError("passwordConfirm"))}
                      className={cn(SIGNUP_INPUT_CLASS, "pr-11")}
                    />
                  </SignupField>
                </SignupSection>

                <SignupSection
                  icon={Building2}
                  title="Organisation"
                  description={
                    signupIsIitr
                      ? "Your department or centre at IIT Roorkee."
                      : signupNeedsState
                        ? "Select your state first; the list is filtered by your category and state."
                        : "Choose your user type above to load the list."
                  }
                >
                  {signupNeedsState && (
                    <SignupField
                      id="signup-state-ut"
                      label="State / Union Territory"
                      required
                      error={fieldError("state")}
                    >
                      <Popover open={stateComboboxOpen} onOpenChange={setStateComboboxOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            id="signup-state-ut"
                            variant="outline"
                            role="combobox"
                            aria-expanded={stateComboboxOpen}
                            aria-invalid={Boolean(fieldError("state")) || undefined}
                            aria-describedby={describedBy("signup-state-ut", undefined, fieldError("state"))}
                            className={cn(SIGNUP_INPUT_CLASS, "w-full justify-between font-normal")}
                            disabled={loadingStates}
                          >
                            <span className={cn(!selectedStateUt && "text-muted-foreground")}>
                              {loadingStates
                                ? "Loading..."
                                : selectedStateUt
                                  ? indianStates.find((s) => s.value === selectedStateUt)?.label ?? selectedStateUt
                                  : "Select State / Union Territory"}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search state or union territory..." className="text-base" />
                            <CommandList>
                              <CommandEmpty>No state or union territory found.</CommandEmpty>
                              {(["state", "union_territory"] as const).map((kind) => {
                                const items = indianStates.filter((s) => (s.type ?? "state") === kind);
                                if (items.length === 0) return null;
                                return (
                                  <CommandGroup key={kind} heading={kind === "state" ? "States" : "Union Territories"}>
                                    {items.map((s) => (
                                      <CommandItem
                                        key={s.value}
                                        value={s.label}
                                        className="text-base"
                                        onSelect={() => {
                                          setSelectedStateUt(s.value);
                                          setStateComboboxOpen(false);
                                        }}
                                      >
                                        {s.label}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                );
                              })}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </SignupField>
                  )}
                  {(() => {
                    const code = userType.includes("|") ? userType.split("|")[0] : userType;
                    const listEmpty = departments.length === 0 && pendingOrganizationRequests.length === 0;
                    const waitingForState = signupNeedsState && !selectedStateUt;
                    const placeholder = !userType
                      ? "Choose your user type first"
                      : waitingForState
                        ? "Select State / Union Territory first"
                        : loadingDepartments
                          ? "Loading..."
                          : signupIsIitr
                            ? "Select your department or centre"
                            : code === "external"
                              ? "Select department / institute"
                              : "Select organisation";
                    const hint = !userType || waitingForState
                      ? undefined
                      : !loadingDepartments && listEmpty
                        ? code === "RND"
                          ? "No organisations listed for this state yet. Request yours below."
                          : "Nothing is listed for this category and state yet. Contact iic@iitr.ac.in."
                        : signupIsIitr
                          ? "IIT Roorkee departments and centres"
                          : undefined;
                    return (
                      <SignupField
                        id="signup-department"
                        label={departmentLabel(signupKindValue)}
                        required
                        wide={!signupNeedsState}
                        hint={hint}
                        error={fieldError("department")}
                      >
                        {signupIsIitr ? (
                          <Popover
                            open={departmentComboboxOpen}
                            onOpenChange={(open) => {
                              setDepartmentComboboxOpen(open);
                              if (!open) setDepartmentSearch("");
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button
                                id="signup-department"
                                variant="outline"
                                role="combobox"
                                aria-expanded={departmentComboboxOpen}
                                aria-invalid={Boolean(fieldError("department")) || undefined}
                                aria-describedby={describedBy("signup-department", hint, fieldError("department"))}
                                className={cn(SIGNUP_INPUT_CLASS, "w-full justify-between font-normal")}
                                disabled={loadingDepartments || !userType}
                              >
                                {(() => {
                                  const selected = departments.find((d) => d.id.toString() === department);
                                  return (
                                    <span className={cn("truncate", !selected && "text-muted-foreground")}>
                                      {selected ? `${selected.name}${selected.code ? ` (${selected.code})` : ""}` : placeholder}
                                    </span>
                                  );
                                })()}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                              <Command shouldFilter={false}>
                                <CommandInput
                                  placeholder="Search department or centre..."
                                  className="text-base"
                                  value={departmentSearch}
                                  onValueChange={setDepartmentSearch}
                                />
                                <CommandList>
                                  <CommandEmpty>No department or centre found.</CommandEmpty>
                                  <CommandGroup heading={`IIT Roorkee departments and centres (${departments.length})`}>
                                    {departments.filter((dept) => matchesDepartmentSearch(dept, departmentSearch)).map((dept) => (
                                      <CommandItem
                                        key={`dept-${dept.id}`}
                                        value={`${dept.name} ${dept.code ?? ""} ${dept.id}`}
                                        className="text-base"
                                        onSelect={() => {
                                          setDepartment(dept.id.toString());
                                          setDepartmentComboboxOpen(false);
                                        }}
                                      >
                                        {dept.name} {dept.code ? `(${dept.code})` : ""}
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        ) : (
                        <Select
                          value={department}
                          onValueChange={(value) => {
                            setDepartment(value);
                            if (value && !value.startsWith("req-")) {
                              setPendingOrganizationRequestId(null);
                              setPendingOrganizationName("");
                            }
                          }}
                          disabled={loadingDepartments || !userType || waitingForState}
                        >
                          <SelectTrigger
                            id="signup-department"
                            className={SIGNUP_INPUT_CLASS}
                            aria-invalid={Boolean(fieldError("department")) || undefined}
                            aria-describedby={describedBy("signup-department", hint, fieldError("department"))}
                          >
                            <SelectValue placeholder={placeholder} />
                          </SelectTrigger>
                          <SelectContent>
                            {departments.map((dept) => (
                              <SelectItem key={`dept-${dept.id}`} value={dept.id.toString()} className="text-base">
                                <span className="flex items-center gap-2">
                                  {dept.name} {dept.code ? `(${dept.code})` : ""}
                                  {!signupIsIitr && (code === "RND" || dept.verified !== false) && (
                                    <span className="text-xs font-medium text-green-600 dark:text-green-500">Verified</span>
                                  )}
                                </span>
                              </SelectItem>
                            ))}
                            {pendingOrganizationRequests.map((r) => (
                              <SelectItem key={`req-${r.id}`} value={`req-${r.id}`} className="text-base">
                                <span className="flex items-center gap-2">
                                  {r.name}
                                  <span className="text-xs font-medium text-muted-foreground">Unverified</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        )}
                      </SignupField>
                    );
                  })()}
                  {signupKindValue === "rnd" && (
                    <div className="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-4 md:col-span-2">
                      <p className="text-base font-medium text-foreground">Can’t find your organisation?</p>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="signup-org-request-name" className="text-sm font-medium text-foreground">
                            Organisation name
                          </Label>
                          <Input
                            id="signup-org-request-name"
                            type="text"
                            value={orgRequestName}
                            onChange={(e) => setOrgRequestName(e.target.value)}
                            placeholder="Full organisation name"
                            className="h-11 rounded-xl border-border/80 bg-background text-base"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="signup-org-request-notes" className="text-sm font-medium text-foreground">
                            Website (optional)
                          </Label>
                          <Input
                            id="signup-org-request-notes"
                            type="url"
                            value={orgRequestNotes}
                            onChange={(e) => setOrgRequestNotes(e.target.value)}
                            placeholder="https://..."
                            className="h-11 rounded-xl border-border/80 bg-background text-base"
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-muted-foreground">
                          An administrator checks the request; you can finish registering meanwhile.
                        </p>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setOrgRequestName("");
                              setOrgRequestNotes("");
                            }}
                          >
                            Clear
                          </Button>
                          <Button
                            type="button"
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
                              } catch (err) {
                                toast.error(err instanceof Error && err.message ? err.message : "Failed to submit organization request");
                              }
                            }}
                          >
                            Submit request
                          </Button>
                        </div>
                      </div>
                      {pendingOrganizationRequestId != null && pendingOrganizationName && (
                        <p className="text-sm font-medium text-primary">
                          Registering with requested organisation <strong>{pendingOrganizationName}</strong>. It is linked to your account once approved.
                        </p>
                      )}
                    </div>
                  )}
                </SignupSection>

                <SignupSection
                  icon={UserCheck}
                  title={signupIsIitr ? "Supervisor and validity" : "Validity"}
                  description={
                    signupIsIitr
                      ? "Your supervisor gets an email with Approve and Decline buttons and has 24 hours to decide."
                      : "Your access to the portal ends on this date."
                  }
                >
                  <SignupField
                    id="signup-program-end-date"
                    label="Programme or employment end date"
                    required
                    hint={signupIsIitr ? "Access ends on this date; your supervisor can extend it later." : "You can request an extension later."}
                    error={fieldError("programEndDate")}
                  >
                    <Input
                      id="signup-program-end-date"
                      type="date"
                      min={todayIso}
                      value={programEndDate}
                      onChange={(e) => setProgramEndDate(e.target.value)}
                      onBlur={touch("programEndDate")}
                      aria-invalid={Boolean(fieldError("programEndDate")) || undefined}
                      aria-describedby={describedBy("signup-program-end-date", "hint", fieldError("programEndDate"))}
                      className={SIGNUP_INPUT_CLASS}
                    />
                  </SignupField>
                  {signupIsIitr && (
                    <SignupField
                      id="signup-supervisor"
                      label={supervisorLabel(signupKindValue)}
                      required
                      wide
                      hint={supervisorDisplay ? undefined : "Search by name or email (at least 2 letters)."}
                      error={fieldError("supervisor")}
                    >
                      {supervisorDisplay ? (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
                          <div className="min-w-0">
                            <p className="text-base font-medium">{supervisorDisplay.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {supervisorDisplay.department || "—"} · {supervisorDisplay.email}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-lg"
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
                        <div className="space-y-2">
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                            <Input
                              id="signup-supervisor"
                              type="search"
                              autoComplete="off"
                              placeholder="Search faculty by name or email"
                              value={facultySearchQuery}
                              onChange={(e) => setFacultySearchQuery(e.target.value)}
                              onBlur={touch("supervisor")}
                              aria-invalid={Boolean(fieldError("supervisor")) || undefined}
                              aria-describedby={describedBy("signup-supervisor", "hint", fieldError("supervisor"))}
                              className={cn(SIGNUP_INPUT_CLASS, "pl-10")}
                            />
                          </div>
                          {loadingFacultySearch && <p className="text-sm text-muted-foreground">Searching…</p>}
                          {facultySearchResults.length > 0 && (
                            <ul className="max-h-56 divide-y divide-border/80 overflow-y-auto rounded-xl border border-border/80" aria-label="Matching faculty">
                              {facultySearchResults.map((f) => (
                                <li key={f.id}>
                                  <button
                                    type="button"
                                    className="w-full px-4 py-3 text-left transition-colors hover:bg-muted/60 focus:bg-muted/60 focus:outline-none"
                                    onClick={() => {
                                      setSupervisorId(f.id);
                                      setSupervisorDisplay(f);
                                      setFacultySearchQuery("");
                                      setFacultySearchResults([]);
                                    }}
                                  >
                                    <p className="text-base font-medium">{f.name}</p>
                                    <p className="text-sm text-muted-foreground">{f.department || "—"} · {f.email}</p>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                          {facultySearchQuery.length >= 2 && !loadingFacultySearch && facultySearchResults.length === 0 && (
                            <p className="text-sm text-muted-foreground">No faculty found. Try a different name or email.</p>
                          )}
                        </div>
                      )}
                    </SignupField>
                  )}
                </SignupSection>

                <SignupSection
                  icon={Paperclip}
                  title={signupKycRequired ? "Documents" : "Documents (optional)"}
                  description={
                    signupKycRequired
                      ? "With a public email, the signed IIT Roorkee KYC form is required."
                      : "You can skip this section and add a profile picture later from your profile."
                  }
                >
                  <SignupField id="signup-profile-picture" label="Profile picture" optional hint="You can add it later from your profile. JPG, PNG, GIF or WEBP.">
                    <div className="flex items-center gap-4">
                      {profilePicturePreview ? (
                        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-primary/50 shadow-sm">
                          <img src={profilePicturePreview} alt="Profile preview" className="h-full w-full object-cover" />
                          <Button
                            aria-label="Remove profile picture"
                            title="Remove profile picture"
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="absolute right-0 top-0 h-5 w-5 rounded-full p-0"
                            onClick={() => {
                              setProfilePicture(null);
                              setProfilePicturePreview(null);
                            }}
                          >
                            <X className="h-3 w-3" aria-hidden />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-border/80 bg-muted/50">
                          <User className="h-7 w-7 text-muted-foreground" aria-hidden />
                        </div>
                      )}
                      <Input
                        id="signup-profile-picture"
                        type="file"
                        accept="image/*"
                        aria-describedby="signup-profile-picture-hint"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (!file.type.startsWith("image/")) {
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
                        className="h-12 cursor-pointer rounded-xl pt-2.5 text-base file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1 file:text-sm file:font-medium file:text-primary-foreground"
                      />
                    </div>
                  </SignupField>
                  <SignupField
                    id="signup-documents"
                    label={
                      signupIsIitr
                        ? "Proof of employment or enrolment in a programme"
                        : signupKycRequired
                          ? "Signed KYC form (scan)"
                          : "Supporting documents"
                    }
                    required={signupKycRequired}
                    optional={!signupKycRequired}
                    hint={
                      signupIsIitr
                        ? "For example an appointment letter, project offer letter or incubation letter. Images, PDF, DOC or DOCX."
                        : signupKycRequired
                          ? "Download the IIT Roorkee KYC form, sign it and upload the scan, or register with your institution email instead."
                          : "Only needed with a public email such as Gmail or Yahoo. Images, PDF, DOC or DOCX."
                    }
                    error={fieldError("documents")}
                  >
                    <Input
                      id="signup-documents"
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx"
                      aria-invalid={Boolean(fieldError("documents")) || undefined}
                      aria-describedby={describedBy("signup-documents", "hint", fieldError("documents"))}
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        const errors: string[] = [];
                        const validFiles: File[] = [];
                        files.forEach((file) => {
                          const fileExtension = file.name.split(".").pop()?.toLowerCase();
                          const validExtensions = ["jpg", "jpeg", "png", "gif", "webp", "pdf", "doc", "docx"];
                          const isValidImage = file.type.startsWith("image/");
                          const isValidPdf = file.type === "application/pdf";
                          const isValidDoc =
                            file.type === "application/msword" ||
                            file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
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
                        e.target.value = "";
                      }}
                      className="h-12 cursor-pointer rounded-xl pt-2.5 text-base file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm file:font-medium"
                    />
                    {signupKycRequired && (
                      <a
                        href="/IIC_IIT_Roorkee_KYC_Form.pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                      >
                        <FileText className="h-4 w-4" aria-hidden />
                        Download IIT Roorkee KYC Form (PDF)
                      </a>
                    )}
                    {documents.length > 0 && (
                      <ul className="space-y-2">
                        {documents.map((file, index) => (
                          <li key={index} className="flex items-center justify-between gap-2 rounded-xl border border-border/80 bg-muted/30 px-3 py-2">
                            <span className="flex min-w-0 items-center gap-2">
                              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                              <span className="truncate text-sm">{file.name}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span>
                            </span>
                            <Button
                              aria-label={`Remove ${file.name}`}
                              title="Remove document"
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 shrink-0 rounded-lg p-0"
                              onClick={() => setDocuments((prev) => prev.filter((_, i) => i !== index))}
                            >
                              <X className="h-4 w-4" aria-hidden />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {documentErrors.length > 0 && (
                      <div className="space-y-1 text-sm text-destructive">
                        {documentErrors.map((error, index) => (
                          <p key={index}>{error}</p>
                        ))}
                      </div>
                    )}
                  </SignupField>
                </SignupSection>

                <div className="space-y-3 rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
                  {signupSubmitAttempted && Object.keys(signupErrors).length > 0 && (
                    <p role="alert" className="flex items-center gap-2 text-sm font-medium text-destructive">
                      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                      Please check the {Object.keys(signupErrors).length === 1 ? "highlighted field" : `${Object.keys(signupErrors).length} highlighted fields`}.
                    </p>
                  )}
                  {signupIsIitr && (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      After you verify your email, your request goes to your supervisor, who has 24 hours to approve it.
                    </p>
                  )}
                  <Button type="submit" className="h-12 w-full rounded-xl text-base font-semibold" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                        Creating account…
                      </>
                    ) : (
                      "Create account"
                    )}
                  </Button>
                  <p className="text-center text-sm text-muted-foreground">
                    Already registered?{" "}
                    <button type="button" className="font-medium text-primary hover:underline" onClick={() => setActiveTab("signin")}>
                      Sign in
                    </button>
                  </p>
                </div>
              </form>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Auth;