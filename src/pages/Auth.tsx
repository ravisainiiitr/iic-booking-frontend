import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
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
import { Eye, EyeOff, Upload, X, FileText, User, Home, Mail, ArrowLeft, KeyRound, UserPlus, ChevronsUpDown } from "lucide-react";
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
  department: z.number().int().positive("Department ID must be a positive number"),
  gender: z.enum(["male", "female", "other"], { required_error: "Gender is required", invalid_type_error: "Please select gender" }),
  program_end_date: z.string().min(1, "Program valid until is required"),
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
  const { login, isAuthenticated, refreshUser } = useAuth();
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
  const [indianStates, setIndianStates] = useState<Array<{ value: string; label: string }>>([]);
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
  const [documentTypes, setDocumentTypes] = useState<string[]>([]);
  const [documentErrors, setDocumentErrors] = useState<string[]>([]);
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState<string | null>(null);
  const [supervisorId, setSupervisorId] = useState<number | "">("");
  const [supervisorDisplay, setSupervisorDisplay] = useState<FacultySearchResult | null>(null);
  const [facultySearchQuery, setFacultySearchQuery] = useState("");
  const [facultySearchResults, setFacultySearchResults] = useState<FacultySearchResult[]>([]);
  const [loadingFacultySearch, setLoadingFacultySearch] = useState(false);
  const facultySearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          navigate("/dashboard");
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
    const useInternalDepartments = Boolean(selectedType?.alias);
    setDepartment("");

    const resolvedCode = userType.includes("|") ? userType.split("|")[0]! : userType;
    const externalSubcategoryByCode: Record<string, string> = {
      external: "educational_institute",   // Educational Institute
      RND: "govt_rnd",                     // Govt R&D Organizations
      Industry: "industries",               // Industry
    };
    const externalSubcategory = externalSubcategoryByCode[resolvedCode];
    const needsStateForDepts = Boolean(!useInternalDepartments && externalSubcategory);

    if (useInternalDepartments) {
      const selectedName = selectedType?.name ?? "";
      const internalSubcategory =
        selectedName === "IITR Startups"
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
      })
      .catch(() => {
        toast.error("Failed to load departments");
        setDepartments([]);
      })
      .finally(() => setLoadingDepartments(false));
  }, [activeTab, userType, userTypes, selectedStateUt]);

  // Fetch user types only when signup tab is active
  useEffect(() => {
    if (activeTab === "signup" && userTypes.length === 0 && !loadingUserTypes) {
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
      if (response.data?.user_types) {
        setUserTypes(response.data.user_types);
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
        // Store state for verification
        if (response.data.state) {
          localStorage.setItem('omniport_state', response.data.state);
        }
        // Redirect to Omniport
        window.location.href = response.data.auth_url;
      } else {
        throw new Error('No auth_url received from backend');
      }
    } catch (error: any) {
      console.error('Omniport login error:', error);
      toast.error(error.message || "Failed to initiate login with Omniport");
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
    if ((resolvedCode === "external" || resolvedCode === "RND" || resolvedCode === "Industry") && !selectedStateUt) {
      toast.error("State/Union Territory is required for Educational Institute, Govt R&D Organizations, and Industry");
      return;
    }
    if ((resolvedCode === "external" || resolvedCode === "RND") && isPublicEmailDomain(email) && documents.length === 0) {
      toast.error("Documents are required when using a public email (e.g. Gmail, Yahoo) for Educational Institute or Govt R&D Organizations. Upload at least one document or use your institution/organization email.");
      return;
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
        department: parseInt(department, 10),
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
        validated.department,
        documents.length > 0 ? documents : undefined,
        documents.length > 0 && documentTypes.length > 0 ? documentTypes : undefined,
        profilePicture,
        validated.user_type_alias,
        supervisorId ? (supervisorId as number) : undefined,
        validated.program_end_date,
        undefined,
        validated.gender
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
          toast.success("Account created successfully! Redirecting to dashboard...");
          setTimeout(() => {
            navigate("/dashboard");
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
          setDocumentTypes([]);
          setDocumentErrors([]);
          
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
      // Refresh user data to ensure we have the latest
      await refreshUser();
        navigate("/dashboard");
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
      await refreshUser();
      navigate("/dashboard");
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,hsl(var(--primary)/0.12),transparent)] dark:bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,hsl(var(--primary)/0.18),transparent)]">
      <div className="w-full max-w-md">
        {/* Card */}
        <Card className="overflow-hidden border-0 shadow-[var(--shadow-elegant)] bg-card/95 backdrop-blur-sm rounded-2xl">
          {/* Header */}
          <div className="relative px-6 pt-6 pb-4 text-center border-b border-border/50 bg-gradient-to-b from-muted/30 to-transparent">
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 top-6 rounded-full text-muted-foreground hover:text-foreground"
              onClick={() => navigate("/")}
              title="Go to Home"
            >
              <Home className="h-5 w-5" />
            </Button>
            <a
              href="https://en.wikipedia.org/wiki/IIT_Roorkee"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-lg"
              title="IIT Roorkee (Wikipedia)"
            >
              <img
                src="https://en.wikipedia.org/wiki/Special:FilePath/Indian_Institute_of_Technology_Roorkee_Logo.svg"
                alt="IIT Roorkee logo"
                className="h-14 w-auto mx-auto object-contain"
              />
            </a>
            <p className="mt-2 text-base font-bold tracking-tight text-foreground">
              Indian Institute of Technology Roorkee
            </p>
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              Institute Instrumentation Centre
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Sign in or create an account
            </p>
          </div>

          <CardContent className="p-6 sm:p-8">
            {/* Channel i — primary CTA */}
            <div className="mb-6">
              <Button
                onClick={handleOmniportLogin}
                disabled={loading}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/25 text-primary-foreground font-medium transition-[var(--transition-smooth)]"
                size="lg"
              >
                <span className="flex items-center justify-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
                      <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" />
                    </svg>
                  </span>
                  {loading ? "Connecting..." : "Sign in with Channel i IITR"}
                </span>
              </Button>
              <p className="mt-3 text-xs text-muted-foreground text-center leading-relaxed">
                Official IIT Roorkee authentication. You will be redirected to Channel i to sign in.
              </p>
            </div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/80" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
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
                <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-4">
                  <p className="text-sm font-semibold text-foreground">Who can register</p>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                    External users and IITR Post Doctoral Fellows, Research Associates in Projects, and IITR Startups can register here.
                  </p>
                  <p className="mt-3 rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary dark:text-primary">
                    IITR Students, Faculty, and Officer in Charge / Lab in charge → sign in with Channel i IITR above.
                  </p>
                </div>
                <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-2">
                  <p className="text-sm font-semibold text-foreground">Registration requirements</p>
                  <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
                    <li><strong>Gender</strong> and <strong>Program Valid Until</strong> are required for all.</li>
                    <li><strong>Educational Institute, Govt R&D Organizations, Industry:</strong> Select <strong>State/Union Territory</strong> first; departments will be filtered by your type and state.</li>
                    <li><strong>Educational Institute &amp; Govt R&D Organizations:</strong> If you use a <strong>public email</strong> (e.g. Gmail, Yahoo, Outlook), you must upload <strong>at least one document</strong>. Using your institution/organization email makes documents optional.</li>
                    <li><strong>IITR Post Doctoral Fellows &amp; Research Associates:</strong> Select a department under IIT Roorkee Department/Centres and an <strong>IITR Faculty supervisor</strong>.</li>
                    <li><strong>IITR Startups:</strong> Select a department under <strong>Startups</strong>.</li>
                  </ul>
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
                    State / Union Territory
                    {userType && (() => {
                      const code = userType.includes("|") ? userType.split("|")[0] : userType;
                      if (code === "external" || code === "RND" || code === "Industry") {
                        return <span className="text-destructive"> *</span>;
                      }
                      return null;
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
                        <CommandInput placeholder="Search state or UT..." />
                        <CommandList>
                          <CommandEmpty>No state or UT found.</CommandEmpty>
                          <CommandGroup>
                            {indianStates.map((s) => (
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
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">
                    {(() => {
                      const code = userType.includes("|") ? userType.split("|")[0] : userType;
                      const needsState = code === "external" || code === "RND" || code === "Industry";
                      return needsState
                        ? "Required for Educational Institute, Govt R&D Organizations, and Industry. Departments are filtered by this state/UT."
                        : "You can search by name.";
                    })()}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-department" className="text-foreground font-medium">Department</Label>
                  <Select
                    value={department}
                    onValueChange={(value) => setDepartment(value)}
                    required
                    disabled={
                      loadingDepartments ||
                      !userType ||
                      (() => {
                        const code = userType.includes("|") ? userType.split("|")[0] : userType;
                        const needsState = code === "external" || code === "RND" || code === "Industry";
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
                                const needsState = code === "external" || code === "RND" || code === "Industry";
                                if (needsState && !selectedStateUt) return "Select State/UT first";
                                const selected = userTypes.find((t) => (t.alias ? `${t.code}|${t.name}` === userType : t.code === userType));
                                if (selected?.alias) {
                                  return selected.name === "IITR Startups" ? "Select internal Startup" : "Select internal department";
                                }
                                return loadingDepartments ? "Loading departments..." : "Select department";
                              })()
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id.toString()}>
                          {dept.name} {dept.code ? `(${dept.code})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {userType && (() => {
                    const code = userType.includes("|") ? userType.split("|")[0] : userType;
                    const needsState = code === "external" || code === "RND" || code === "Industry";
                    if (needsState && !selectedStateUt) {
                      return (
                        <p className="text-xs text-muted-foreground">
                          Select State/UT above to load departments for your type and location.
                        </p>
                      );
                    }
                    if (departments.length === 0 && !loadingDepartments) {
                      return (
                        <p className="text-xs text-muted-foreground">
                          No departments available for this user type and state
                        </p>
                      );
                    }
                    return null;
                  })()}
                  {!userType && (
                    <p className="text-xs text-muted-foreground">
                      Select user type to load departments
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-program-end-date" className="text-foreground font-medium">
                    Program Valid Until <span className="text-destructive">*</span>
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
                <div className="space-y-2">
                  <Label htmlFor="signup-documents" className="text-foreground font-medium">
                    Documents
                    {(() => {
                      const code = userType.includes("|") ? userType.split("|")[0] : userType;
                      if ((code === "external" || code === "RND") && isPublicEmailDomain(email)) {
                        return <span className="text-destructive"> *</span>;
                      }
                      return " (Optional)";
                    })()}
                  </Label>
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
                            // Initialize document types for new files (default to empty string)
                            setDocumentTypes((prev) => [...prev, ...Array(validFiles.length).fill("")]);
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
                                  setDocumentTypes((prev) => prev.filter((_, i) => i !== index));
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`doc-type-${index}`} className="text-xs font-medium text-muted-foreground">Document type (optional)</Label>
                              <Select
                                value={documentTypes[index] || ""}
                                onValueChange={(value) => {
                                  const newTypes = [...documentTypes];
                                  newTypes[index] = value;
                                  setDocumentTypes(newTypes);
                                }}
                              >
                                <SelectTrigger id={`doc-type-${index}`} className="h-9 rounded-lg text-sm border-border/80">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="identity_proof">Identity Proof</SelectItem>
                                  <SelectItem value="address_proof">Address Proof</SelectItem>
                                  <SelectItem value="qualification">Qualification</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                              </Select>
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
                          ? "Required for Educational Institute and Govt R&D Organizations when using a public email (e.g. Gmail, Yahoo). Use your institution/organization email to make documents optional."
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