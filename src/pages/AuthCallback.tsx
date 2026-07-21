import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { consumePostLoginRedirect } from "@/lib/authRedirect";
import { formatOmniportCallbackError, storeOmniportState } from "@/lib/omniportAuth";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUserFromAuth } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const token = searchParams.get('token');
      const errorParam = searchParams.get('error');
      const errorCode = searchParams.get('error_code');

      // Handle OAuth errors
      if (errorParam) {
        const message = formatOmniportCallbackError(errorParam, errorCode);
        setStatus('error');
        setError(message);
        toast.error(`Authentication failed: ${message}`);
        return;
      }

      // Handle direct token-based authentication (server redirects with token)
      if (token) {
        try {
          apiClient.setToken(token);

          // Always fetch the full user (includes admin_panel_enabled / modules).
          // URL params are incomplete and must not be the sole source of truth.
          const userResponse = await apiClient.getCurrentUser();
          if (userResponse.error || !userResponse.data) {
            throw new Error(userResponse.error || "Failed to load user profile");
          }
          setUserFromAuth(userResponse.data);

          setStatus('success');
          toast.success('Authentication successful!');

          setTimeout(() => {
            navigate(consumePostLoginRedirect());
          }, 1500);
          return;
        } catch (err: any) {
          setStatus('error');
          const errorMessage = err.message || 'Authentication failed';
          setError(errorMessage);
          toast.error(errorMessage);
          return;
        }
      }

      // Handle OAuth code flow (existing logic)
      if (!code) {
        setStatus('error');
        setError('No authorization code or token received');
        toast.error('No authorization code or token received');
        return;
      }

      // Verify state
      const storedState = localStorage.getItem('omniport_state');
      if (state && storedState && state !== storedState) {
        setStatus('error');
        setError('Invalid state token. Security check failed.');
        toast.error('Invalid state token. Please try logging in again.');
        localStorage.removeItem('omniport_state');
        return;
      }

      try {
        const response = await apiClient.exchangeOmniportCode(code, state || '');

        if (response.error) {
          throw new Error(response.error);
        }

        if (response.data?.token) {
          apiClient.setToken(response.data.token);
        }

        // Prefer a fresh /auth/user/ payload so Admin Panel flags are correct.
        const userResponse = await apiClient.getCurrentUser();
        if (userResponse.data) {
          setUserFromAuth(userResponse.data);
        } else if (response.data?.user) {
          setUserFromAuth(response.data.user);
        }

        localStorage.removeItem('omniport_state');

        setStatus('success');
        toast.success('Authentication successful!');

        setTimeout(() => {
          navigate(consumePostLoginRedirect());
        }, 1500);
      } catch (err: any) {
        setStatus('error');
        const errorMessage = err.message || 'Authentication failed';
        setError(errorMessage);
        toast.error(errorMessage);
        localStorage.removeItem('omniport_state');
      }
    };

    processCallback();
  }, [searchParams, navigate, setUserFromAuth]);

  if (status === 'processing') {
    return (
      <div className="page-shell flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-center">
                <p className="text-lg font-semibold">Completing authentication...</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Please wait while we verify your credentials
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
      <div className="page-shell flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-6 w-6" />
              Authentication Failed
            </CardTitle>
            <CardDescription>
              There was a problem completing your login
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
              <p className="text-sm text-destructive">{error}</p>
            </div>
            <Button
              onClick={() => navigate("/auth")}
              className="w-full"
            >
              Return to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-shell flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
            <div className="text-center">
              <p className="text-lg font-semibold">Authentication Successful!</p>
              <p className="text-sm text-muted-foreground mt-2">
                Redirecting…
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthCallback;

