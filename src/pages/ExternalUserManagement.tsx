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
      if (!["admin", "external_relations"].includes(String(userRes.data.user_type ?? "").toLowerCase())) {
        toast({
          title: "Access Denied",
          description: "Only Admin or External Relations Administrator can manage external users.",
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
      <div className="page-shell flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="page-shell flex flex-col">
      <DashboardHeader />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-primary via-primary to-accent p-6 text-white shadow-xl">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="mb-3 -ml-2 text-white/90 hover:text-white hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">External user management</h1>
          <p className="mt-2 text-sm text-white/85">
            Verification workflows for external organizations/departments and external users.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* External Department Addition/Verification */}
          <Card
            role="button"
            tabIndex={0}
            className="cursor-pointer transition-all duration-200 overflow-hidden border-0 shadow-md hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/25 dark:hover:border-primary/40 h-full"
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
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-white shadow-lg">
                  <Building2 className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg">External Departments</CardTitle>
                  <CardDescription className="text-sm mt-0.5">
                    Add external departments with State/Union Territory and type, or verify departments added during registration.
                  </CardDescription>
                </div>
              </div>
              <div className="h-1 w-16 rounded-full bg-gradient-to-r from-primary to-accent mt-3" />
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-primary hover:bg-primary/90 text-white">Open departments</Button>
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
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-primary text-white shadow-lg">
                  <UserCheck className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg">External Users</CardTitle>
                  <CardDescription className="text-sm mt-0.5">Review external users and their verification/approval status.</CardDescription>
                </div>
              </div>
              <div className="h-1 w-16 rounded-full bg-gradient-to-r from-emerald-500 to-primary/50 mt-3" />
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
