import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { z } from "zod";

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

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [userType, setUserType] = useState<"student" | "faculty" | "external" | "">("");
  const [empId, setEmpId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [department, setDepartment] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let hasRedirected = false;

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

    // Fetch departments for signup form
    fetchDepartments();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleOmniportLogin = async () => {
    setLoading(true);
    try {
      const redirectUri = `${window.location.origin}/auth/callback`;
      const response = await apiClient.getOmniportAuthUrl(redirectUri);

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.data) {
        // Store state for verification
        localStorage.setItem('omniport_state', response.data.state);
        // Redirect to Omniport
        window.location.href = response.data.auth_url;
      }
    } catch (error: any) {
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
        user_type: userType as "student" | "faculty" | "external",
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
        throw new Error(response.error);
      }

      if (response.data?.token) {
        toast.success("Account created successfully! Redirecting to dashboard...");
        setTimeout(() => {
          navigate("/dashboard");
        }, 1000);
      } else {
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
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message || "Failed to sign up");
      }
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
        toast.error(error.message || "Failed to sign in");
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

          <Tabs defaultValue="signin" className="w-full">
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
                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
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
                    onValueChange={(value) => setUserType(value as "student" | "faculty" | "external")}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select user type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="faculty">Faculty</SelectItem>
                      <SelectItem value="external">External</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Only students, faculty, and external users can create accounts
                  </p>
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
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                  <p className="text-xs text-muted-foreground">
                    Password must be at least 8 characters
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password-confirm">Confirm Password</Label>
                  <Input
                    id="signup-password-confirm"
                    type="password"
                    placeholder="••••••"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    required
                    minLength={8}
                  />
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