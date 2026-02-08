import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { z } from "zod";
import { Eye, EyeOff, Upload, X, FileText, User } from "lucide-react";

const authSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  password_confirm: z.string().min(8, "Password confirmation must be at least 8 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  user_type: z.enum(["external", "RND", "Institutes", "other"], {
    errorMap: () => ({ message: "Please select a user type" }),
  }),
  emp_id: z.string().min(1, "Employee/Student ID is required").max(50, "ID must be less than 50 characters"),
  phone_number: z.string().min(10, "Phone number must be at least 10 digits").max(20, "Phone number must be less than 20 characters").optional(),
  department: z.number().int().positive("Department ID must be a positive number"),
}).refine((data) => data.password === data.password_confirm, {
  message: "Passwords do not match",
  path: ["password_confirm"],
});

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
  const [userType, setUserType] = useState<string>("");
  const [empId, setEmpId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [department, setDepartment] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
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

  // Fetch departments and user types only when signup tab is active
  useEffect(() => {
    if (activeTab === "signup") {
      if (departments.length === 0 && !loadingDepartments) {
        fetchDepartments();
      }
      if (userTypes.length === 0 && !loadingUserTypes) {
        fetchUserTypes();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const fetchDepartments = async () => {
    setLoadingDepartments(true);
    try {
      // Only fetch external departments for signup (since only external users can register)
      const response = await apiClient.getDepartments('external', false);
      if (response.data?.departments) {
        setDepartments(response.data.departments);
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
      toast.error("Failed to load departments");
    } finally {
      setLoadingDepartments(false);
    }
  };

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
    
    try {
      const validated = authSchema.parse({ 
        email, 
        password,
        password_confirm: passwordConfirm,
        name,
        user_type: userType,
        emp_id: empId,
        phone_number: phoneNumber || undefined,
        department: parseInt(department, 10),
      });
      setLoading(true);

      const response = await apiClient.signUp(
        validated.email,
        validated.password,
        validated.password_confirm,
        validated.name,
        validated.user_type,
        validated.emp_id,
        validated.phone_number,
        validated.department,
        documents.length > 0 ? documents : undefined,
        documents.length > 0 && documentTypes.length > 0 ? documentTypes : undefined,
        profilePicture
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
          setEmpId("");
          setPhoneNumber("");
          setDepartment("");
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
        setEmpId("");
        setPhoneNumber("");
        setDepartment("");
        setProfilePicture(null);
        setProfilePicturePreview(null);
        setDocuments([]);
        setDocumentErrors([]);
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
      if (errorMessage.includes("pending approval") || errorMessage.includes("Account pending approval") || errorMessage.includes("admin approval")) {
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

  // Show loading while checking authentication
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/20 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="text-sm text-muted-foreground">Checking authentication...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">INSTITUTE INSTRUMENTATION CENTRE - IIC</CardTitle>
          <CardDescription className="text-center">
            Sign in with Omniport (IIT Roorkee) or create an account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Omniport OAuth Login */}
          <div className="mb-6">
            <Button
              onClick={handleOmniportLogin}
              disabled={loading}
              className="w-full gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
              size="lg"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/>
              </svg>
              {loading ? "Connecting..." : "Sign in with Omniport"}
            </Button>
            
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> Omniport is the official IIT Roorkee authentication system.
                <br/>You will be redirected to Omniport to complete the login process.
              </p>
            </div>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="signin-password"
                      type={showSignInPassword ? "text" : "password"}
                      placeholder="••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pr-10"
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
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={255}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-user-type">User Type</Label>
                  <Select
                    value={userType}
                    onValueChange={(value) => setUserType(value)}
                    required
                    disabled={loadingUserTypes}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingUserTypes ? "Loading user types..." : "Select user type"} />
                    </SelectTrigger>
                    <SelectContent>
                      {userTypes.map((type) => (
                        <SelectItem key={type.code} value={type.code}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-blue-800 dark:text-blue-200">
                      <strong>Note:</strong> Only external users can register via this portal. 
                      <br/>Students, Faculty, and Management users must sign in with Omniport.
                    </p>
                  </div>
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
                  <Label htmlFor="signup-emp-id">Employee/Student ID</Label>
                  <Input
                    id="signup-emp-id"
                    type="text"
                    placeholder="EMP001 or STUDENT123"
                    value={empId}
                    onChange={(e) => setEmpId(e.target.value)}
                    required
                    maxLength={50}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-phone">Phone Number (Optional)</Label>
                  <Input
                    id="signup-phone"
                    type="tel"
                    placeholder="8979322490"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    maxLength={20}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showSignUpPassword ? "text" : "password"}
                      placeholder="••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="pr-10"
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
                  <p className="text-xs text-muted-foreground">
                    Password must be at least 8 characters
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password-confirm">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="signup-password-confirm"
                      type={showPasswordConfirm ? "text" : "password"}
                      placeholder="••••••"
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      required
                      minLength={8}
                      className="pr-10"
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
                  <Label htmlFor="signup-department">Department</Label>
                  <Select
                    value={department}
                    onValueChange={(value) => setDepartment(value)}
                    required
                    disabled={loadingDepartments}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingDepartments ? "Loading departments..." : "Select department"} />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Only show external departments (since only external users can register) */}
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id.toString()}>
                          {dept.name} {dept.code ? `(${dept.code})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {departments.length === 0 && !loadingDepartments && (
                    <p className="text-xs text-muted-foreground">
                      No departments available
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-profile-picture">
                    Profile Picture <span className="text-destructive">*</span>
                  </Label>
                  <div className="space-y-3">
                    {profilePicturePreview && (
                      <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-primary">
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
                    <div className="flex items-center gap-2">
                      <Input
                        id="signup-profile-picture"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            // Validate it's an image
                            if (!file.type.startsWith('image/')) {
                              toast.error("Please select an image file");
                              return;
                            }
                            setProfilePicture(file);
                            // Create preview
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setProfilePicturePreview(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="cursor-pointer"
                        required
                      />
                      {!profilePicturePreview && (
                        <div className="flex items-center justify-center w-24 h-24 border-2 border-dashed rounded-full bg-muted">
                          <User className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Upload your profile picture (JPG, PNG, GIF, WEBP)
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-documents">Documents (Optional)</Label>
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
                            className="p-3 border rounded-lg bg-muted/50 space-y-2"
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
                                className="h-8 w-8 p-0 flex-shrink-0"
                                onClick={() => {
                                  setDocuments((prev) => prev.filter((_, i) => i !== index));
                                  setDocumentTypes((prev) => prev.filter((_, i) => i !== index));
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`doc-type-${index}`} className="text-xs">
                                Document Type (Optional)
                              </Label>
                              <Select
                                value={documentTypes[index] || ""}
                                onValueChange={(value) => {
                                  const newTypes = [...documentTypes];
                                  newTypes[index] = value;
                                  setDocumentTypes(newTypes);
                                }}
                              >
                                <SelectTrigger id={`doc-type-${index}`} className="h-8 text-sm">
                                  <SelectValue placeholder="Select document type" />
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
                      Accepted formats: Images (JPG, PNG, GIF, WEBP), PDF, DOC, DOCX
                    </p>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating account..." : "Sign Up"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;