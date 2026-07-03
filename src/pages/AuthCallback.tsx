import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { consumePostLoginRedirect } from "@/lib/authRedirect";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const token = searchParams.get('token');
      const errorParam = searchParams.get('error');

      // Handle OAuth errors
      if (errorParam) {
        setStatus('error');
        setError(errorParam);
        toast.error(`Authentication failed: ${errorParam}`);
        return;
      }

      // Handle direct token-based authentication (server redirects with token)
      if (token) {
        try {
          // Store the token
          apiClient.setToken(token);
          
          // Build user object from URL parameters
          const userId = searchParams.get('user_id');
          const email = searchParams.get('email');
          const name = searchParams.get('name');
          const userType = searchParams.get('user_type');
          const usesAdminPanel = searchParams.get('uses_admin_panel');
          const usesReactApp = searchParams.get('uses_react_app');

          if (userId && email && name) {
            const userData = {
              id: parseInt(userId, 10),
              email: decodeURIComponent(email),
              name: decodeURIComponent(name.replace(/\+/g, ' ')),
              user_type: userType ? (isNaN(Number(userType)) ? userType : parseInt(userType, 10)) : '',
              uses_admin_panel: usesAdminPanel === 'true',
              uses_react_app: usesReactApp === 'true',
            };

            localStorage.setItem('user', JSON.stringify(userData));
          } else {
            // If user data not in URL, fetch from API
            const userResponse = await apiClient.getCurrentUser();
            if (userResponse.data) {
              localStorage.setItem('user', JSON.stringify(userResponse.data));
            }
          }

          setStatus('success');
          toast.success('Authentication successful!');

          // Redirect after short delay
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

        // Store user data if provided
        if (response.data?.user) {
          localStorage.setItem('user', JSON.stringify(response.data.user));
        }

        // Clear state
        localStorage.removeItem('omniport_state');

        setStatus('success');
        toast.success('Authentication successful!');

        // Redirect after short delay
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
  }, [searchParams, navigate]);

  if (status === 'processing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/20 p-4">
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/20 p-4">
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/20 p-4">
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

