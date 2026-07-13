import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardHeader from "@/components/DashboardHeader";
import { ArrowLeft, Building2, UserCheck, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const ExternalUserManagement = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const check = async () => {
      const token = apiClient.getToken();
      if (!token) {
        navigate("/auth");
        return;
      }
      const userRes = await apiClient.getCurrentUser();
      if (userRes.error || !userRes.data) {
        navigate("/auth");
        return;
      }
      if (String(userRes.data.user_type ?? "").toLowerCase() !== "admin") {
        toast({
          title: "Access Denied",
          description: "Only Admin can manage external users.",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }
      setAllowed(true);
    };
    check();
  }, [navigate, toast]);

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-background via-background to-accent/20">
      <DashboardHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">External User Management</h1>
          <p className="text-muted-foreground mt-1">
            Verification workflows for external organizations/departments and external users.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* External Department Addition/Verification */}
          <Card
            role="button"
            tabIndex={0}
            className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-sky-200 dark:hover:border-sky-800 h-full"
            onClick={() => navigate("/manage/external-user-management/departments")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigate("/manage/external-user-management/departments");
              }
            }}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-4 mb-1">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg">
                  <Building2 className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg">External Departments</CardTitle>
                  <CardDescription className="text-sm mt-0.5">
                    Add external departments with State/Union Territory and type, or verify departments added during registration.
                  </CardDescription>
                </div>
              </div>
              <div className="h-1 w-16 rounded-full bg-gradient-to-r from-sky-500 to-blue-500 mt-3" />
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-sky-600 hover:bg-sky-700 text-white">Open departments</Button>
            </CardContent>
          </Card>

          {/* External User Verification */}
          <Card
            role="button"
            tabIndex={0}
            className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-emerald-200 dark:hover:border-emerald-800 h-full"
            onClick={() => navigate("/manage/section/users")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigate("/manage/section/users");
              }
            }}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-4 mb-1">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
                  <UserCheck className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg">External Users</CardTitle>
                  <CardDescription className="text-sm mt-0.5">Review external users and their verification/approval status.</CardDescription>
                </div>
              </div>
              <div className="h-1 w-16 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 mt-3" />
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">Open verification</Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default ExternalUserManagement;
