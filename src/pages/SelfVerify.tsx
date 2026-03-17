import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, User, Mail, Building2 } from "lucide-react";
import { toast } from "sonner";

const SelfVerify = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<"accept" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<{
    name: string;
    email: string;
    department_name: string | null;
    user_type_display: string;
  } | null>(null);
  const [done, setDone] = useState<"accepted" | "rejected" | null>(null);

  const uidb64 = searchParams.get("uidb64");
  const token = searchParams.get("token");

  useEffect(() => {
    if (!uidb64 || !token) {
      setError("Invalid or missing verification link.");
      setLoading(false);
      return;
    }
    apiClient
      .getSelfVerifyDetails(uidb64, token)
      .then((res) => {
        if (res.error || !res.data) {
          setError(res.error || "Invalid or expired link.");
          return;
        }
        setDetails(res.data);
      })
      .catch(() => setError("Failed to load details."))
      .finally(() => setLoading(false));
  }, [uidb64, token]);

  const handleAccept = () => {
    if (!uidb64 || !token) return;
    setSubmitting("accept");
    apiClient
      .selfVerifyAction(uidb64, token, "accept")
      .then((res) => {
        if (res.error) {
          toast.error(res.error);
          setSubmitting(null);
          return;
        }
        setDone("accepted");
        toast.success(res.data?.message || "Account verified. You can now log in.");
        setTimeout(() => navigate("/auth"), 2500);
      })
      .catch(() => {
        toast.error("Something went wrong.");
        setSubmitting(null);
      });
  };

  const handleReject = () => {
    if (!uidb64 || !token) return;
    setSubmitting("reject");
    apiClient
      .selfVerifyAction(uidb64, token, "reject")
      .then((res) => {
        if (res.error) {
          toast.error(res.error);
          setSubmitting(null);
          return;
        }
        setDone("rejected");
        toast.success(res.data?.message || "Registration cancelled.");
        setTimeout(() => navigate("/auth"), 2500);
      })
      .catch(() => {
        toast.error("Something went wrong.");
        setSubmitting(null);
      });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/20">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading your details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/20 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-6 w-6" />
              Invalid link
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => navigate("/auth")} className="w-full">
              Go to login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done === "accepted") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/20 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-500">
              <CheckCircle2 className="h-6 w-6" />
              Account verified
            </CardTitle>
            <CardDescription>
              You can now log in and use the booking portal. Redirecting to login...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (done === "rejected") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/20 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">Registration cancelled</CardTitle>
            <CardDescription>
              Your registration has been removed. Redirecting to login...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!details) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/20 p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Confirm your details</CardTitle>
          <CardDescription>
            Please verify the information below. Click <strong>Accept</strong> to activate your account and start using the booking portal, or <strong>Reject</strong> to cancel your registration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="font-medium">{details.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium">{details.email}</p>
              </div>
            </div>
            {(details.department_name || details.user_type_display) && (
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Organization / Type</p>
                  <p className="font-medium">
                    {[details.department_name, details.user_type_display].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={handleAccept}
              disabled={submitting !== null}
            >
              {submitting === "accept" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Accept & activate account
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleReject}
              disabled={submitting !== null}
            >
              {submitting === "reject" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Reject & cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SelfVerify;
