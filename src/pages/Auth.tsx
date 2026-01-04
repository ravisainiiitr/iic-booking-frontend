import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";

const authSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  password_confirm: z.string().min(8, "Password confirmation must be at least 8 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  user_type: z.enum(["student", "faculty", "external"], {
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
}

interface UserType {
  code: string;
  name: string;
  description: string;
}

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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

    // Check if user is already authenticated
    const token = apiClient.getToken();
    if (token && !hasRedirected) {
      apiClient.getCurrentUser().then((response) => {
        if (!isMounted) return;
        
        if (response.data && !hasRedirected) {
          // Update stored user data
          localStorage.setItem('user', JSON.stringify(response.data));
          hasRedirected = true;
          navigate("/dashboard");
        } else {
          apiClient.setToken(null);
          localStorage.removeItem('user');
          if (isMounted) {
            setCheckingAuth(false);
          }
        }
      }).catch(() => {
        if (!isMounted) return;
        apiClient.setToken(null);
        localStorage.removeItem('user');
        if (isMounted) {
          setCheckingAuth(false);
        }
      });
    } else {
      // No token, show login form
      if (isMounted) {
        setCheckingAuth(false);
      }
    }

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const response = await apiClient.getDepartments();
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
        validated.department
      );

      if (response.error) {
        // Check if it's an email already exists error
        const emailError = response.fieldErrors?.email;
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

      if (response.data) {
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
      toast.error("Please enter your email address first");
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.resendVerificationEmail(email);
      if (response.error) {
        toast.error(response.error || "Failed to resend verification email");
      } else {
        toast.success(response.data?.message || "Verification email sent! Please check your inbox.");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to resend verification email");
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validated = signInSchema.parse({ email, password });
      setLoading(true);

      const response = await apiClient.signIn(validated.email, validated.password);

      if (response.error) {
        // Check if it's an email verification error or pending approval error
        const errorData = response.fieldErrors as any;
        
        // Check if it's a pending admin approval error
        const isPendingApprovalError = 
          errorData?.admin_approved === false ||
          errorData?.admin_approved === 'false' ||
          response.error.includes("pending approval") ||
          response.error.includes("Account pending approval") ||
          (errorData?.email_verified === true && errorData?.admin_approved === false);
        
        // Check if it's an email verification error
        const isEmailVerificationError = 
          errorData?.email_verified === false || 
          response.error.includes("Email not verified") || 
          response.error.includes("email not verified") ||
          response.error.toLowerCase().includes("verify your email");
        
        if (isPendingApprovalError) {
          const errorMessage = errorData?.message || response.error || "Your account is pending admin approval. You will be notified once approved.";
          toast.info(errorMessage, {
            duration: 8000,
          });
          return;
        }
        
        if (isEmailVerificationError) {
          const errorMessage = errorData?.message || response.error || "Please verify your email address before logging in.";
          toast.error(errorMessage, {
            action: {
              label: "Resend Verification Email",
              onClick: handleResendVerification,
            },
            duration: 8000,
          });
          return;
        }
        
        throw new Error(response.error);
      }

      if (response.data?.token) {
        toast.success("Signed in successfully!");
        navigate("/dashboard");
      } else {
        throw new Error("No token received");
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        // Check if error message contains email verification or pending approval
        const errorMessage = error.message || "Failed to sign in";
        if (errorMessage.includes("pending approval") || errorMessage.includes("Account pending approval") || errorMessage.includes("admin approval")) {
          toast.info(errorMessage, {
            duration: 8000,
          });
        } else if (errorMessage.includes("Email not verified") || errorMessage.includes("email not verified") || errorMessage.includes("verify your email")) {
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
          <CardTitle className="text-2xl text-center">IIC Booking</CardTitle>
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
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id.toString()}>
                          {dept.name} ({dept.code})
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