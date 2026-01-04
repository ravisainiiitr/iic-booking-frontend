import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Mail } from "lucide-react";
import { toast } from "sonner";

const EmailVerificationCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const processVerification = async () => {
      // Get parameters from URL
      const token = searchParams.get('token');
      const verificationToken = searchParams.get('verification_token');
      const errorParam = searchParams.get('error');
      const success = searchParams.get('success');
      const statusParam = searchParams.get('status');
      const messageParam = searchParams.get('message');
      const emailVerified = searchParams.get('email_verified');
      const adminApproved = searchParams.get('admin_approved');

      // Handle error case from server redirect
      if (errorParam) {
        setStatus('error');
        setError(errorParam);
        toast.error(`Email verification failed: ${errorParam}`);
        return;
      }

      // Handle pending admin approval case
      if (statusParam === 'pending' || (emailVerified === 'true' && adminApproved === 'false')) {
        const pendingMessage = messageParam 
          ? decodeURIComponent(messageParam.replace(/\+/g, ' ')) 
          : "Email verified successfully. Your account is pending admin approval. You will be notified once approved.";
        
        setStatus('success');
        setMessage(pendingMessage);
        toast.success("Email verified! Waiting for admin approval.", {
          duration: 6000,
        });
        
        setTimeout(() => {
          navigate("/auth?pending=true");
        }, 3000);
        return;
      }

      // Handle success message from server redirect
      if (success === 'true' || success === '1') {
        const verificationTokenToUse = token || verificationToken;
        
        if (verificationTokenToUse) {
          // If token is provided, try to auto-login
          try {
            // The server might have already logged the user in via redirect
            // Check if we have a token in localStorage or need to exchange verification token
            const existingToken = apiClient.getToken();
            
            if (existingToken) {
              // Verify the token is valid
              const userResponse = await apiClient.getCurrentUser();
              if (userResponse.data) {
                setStatus('success');
                setMessage(messageParam || "Email verified successfully! You are now logged in.");
                toast.success("Email verified and logged in successfully!");
                
                setTimeout(() => {
                  navigate("/dashboard");
                }, 2000);
                return;
              }
            }

            // If no existing token, the server should have provided login credentials
            // For now, redirect to login with success message
            setStatus('success');
            setMessage(messageParam || "Email verified successfully! You can now log in.");
            toast.success("Email verified successfully! Please log in.");
            
            setTimeout(() => {
              navigate("/auth?verified=true");
            }, 2000);
          } catch (err: any) {
            // Token exchange failed, but verification might still be successful
            setStatus('success');
            setMessage(messageParam || "Email verified successfully! Please log in.");
            toast.success("Email verified successfully! Please log in.");
            
            setTimeout(() => {
              navigate("/auth?verified=true");
            }, 2000);
          }
        } else {
          // Success but no token - verification completed, need to login
          setStatus('success');
          setMessage(messageParam || "Email verified successfully! You can now log in.");
          toast.success("Email verified successfully! Please log in.");
          
          setTimeout(() => {
            navigate("/auth?verified=true");
          }, 2000);
        }
        return;
      }

      // Handle verification token if provided
      if (token || verificationToken) {
        try {
          // If the server redirects here with a token, it means verification succeeded
          // The server might have already created a session, so we try to get current user
          const userResponse = await apiClient.getCurrentUser();
          
          if (userResponse.data) {
            // User is already logged in (server-side session)
            setStatus('success');
            setMessage("Email verified successfully! You are now logged in.");
            toast.success("Email verified and logged in successfully!");
            
            setTimeout(() => {
              navigate("/dashboard");
            }, 2000);
          } else {
            // Verification succeeded but need to login
            setStatus('success');
            setMessage("Email verified successfully! Please log in.");
            toast.success("Email verified successfully! Please log in.");
            
            setTimeout(() => {
              navigate("/auth?verified=true");
            }, 2000);
          }
        } catch (err: any) {
          // Couldn't verify login, but verification might still be successful
          setStatus('success');
          setMessage("Email verified successfully! Please log in.");
          toast.success("Email verified successfully! Please log in.");
          
          setTimeout(() => {
            navigate("/auth?verified=true");
          }, 2000);
        }
        return;
      }

      // No parameters - invalid verification link
      setStatus('error');
      setError('Invalid verification link. The link may have expired or is invalid.');
      toast.error('Invalid verification link');
    };

    processVerification();
  }, [searchParams, navigate]);

  if (status === 'processing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/20 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-center">
                <p className="text-lg font-semibold">Verifying your email...</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Please wait while we verify your email address
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/20 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-6 w-6" />
              Email Verification Failed
            </CardTitle>
            <CardDescription>
              There was a problem verifying your email address
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
              <p className="text-sm text-destructive">{error}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => navigate("/auth")}
                className="w-full"
              >
                Go to Login
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/auth?resend=true")}
                className="w-full"
              >
                Request New Verification Email
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if it's a pending approval case
  const isPendingApproval = message?.toLowerCase().includes('pending') || 
                            message?.toLowerCase().includes('admin approval') ||
                            message?.toLowerCase().includes('will be notified');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/20 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center space-y-4">
            {isPendingApproval ? (
              <>
                <div className="rounded-full bg-yellow-100 dark:bg-yellow-900/20 p-3">
                  <Mail className="h-12 w-12 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold">Email Verified!</p>
                  {message && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {message}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground mt-4">
                    Redirecting to login...
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-full bg-green-100 dark:bg-green-900/20 p-3">
                  <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold">Email Verified Successfully!</p>
                  {message && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {message}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground mt-2">
                    Redirecting...
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailVerificationCallback;

