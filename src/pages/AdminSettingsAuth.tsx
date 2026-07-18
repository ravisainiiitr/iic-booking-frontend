import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Loader2, Shield } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type UserTypeChoice = { code: string; name: string };

const AdminSettingsAuth = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading, refreshUser } = useAuth();
  const userTypeStr = user?.user_type != null ? String(user.user_type).toLowerCase() : "";
  const isAdmin = userTypeStr === "admin";

  const [globalMinutes, setGlobalMinutes] = useState<number>(30);
  const [byUserTypeMinutes, setByUserTypeMinutes] = useState<Record<string, number | "">>({});
  const [userTypeChoices, setUserTypeChoices] = useState<UserTypeChoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/admin-settings");
      return;
    }
    if (!isAdmin) return;

    const fetchSettings = async () => {
      const res = await apiClient.getAuthSettings();
      if (res.error) {
        toast.error(res.error || "Failed to load auth settings");
        setLoading(false);
        return;
      }
      const d = res.data;
      if (d) {
        setGlobalMinutes(Math.round(d.global_inactivity_timeout_seconds / 60));
        const by: Record<string, number | ""> = {};
        (d.user_type_choices || []).forEach(({ code }: UserTypeChoice) => {
          const sec = d.by_user_type?.[code];
          by[code] = sec != null ? Math.round(sec / 60) : "";
        });
        setByUserTypeMinutes(by);
        setUserTypeChoices(d.user_type_choices || []);
      }
      setLoading(false);
    };
    fetchSettings();
  }, [authLoading, isAdmin, navigate]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    const globalSec = globalMinutes * 60;
    if (globalSec < 60 || globalSec > 86400 * 7) {
      toast.error("Global timeout must be between 1 minute and 10080 minutes (7 days).");
      return;
    }
    const byUserType: Record<string, number | null> = {};
    userTypeChoices.forEach(({ code }) => {
      const val = byUserTypeMinutes[code];
      if (val === "" || val === undefined) {
        byUserType[code] = null;
      } else {
        const m = Number(val);
        if (!Number.isNaN(m) && m >= 1 && m <= 10080) {
          byUserType[code] = m * 60;
        }
      }
    });

    setSaving(true);
    const res = await apiClient.updateAuthSettings({
      global_inactivity_timeout_seconds: globalSec,
      by_user_type: byUserType,
    });
    setSaving(false);
    if (res.error) {
      toast.error(res.error || "Failed to update settings");
      return;
    }
    toast.success("Session timeouts updated. Changes apply per user type.");
    if (res.data) {
      setGlobalMinutes(Math.round(res.data.global_inactivity_timeout_seconds / 60));
      const by: Record<string, number | ""> = {};
      userTypeChoices.forEach(({ code }) => {
        const sec = res.data!.by_user_type?.[code];
        by[code] = sec != null ? Math.round(sec / 60) : "";
      });
      setByUserTypeMinutes(by);
    }
    await refreshUser();
  };

  const setTypeMinutes = (code: string, value: number | "") => {
    setByUserTypeMinutes((prev) => ({ ...prev, [code]: value }));
  };

  if (!isAdmin && !authLoading) return null;

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin-settings")}
              className="mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin Settings
            </Button>
            <h1 className="text-3xl font-bold">Session / Auto-logout by user type</h1>
            <p className="text-muted-foreground mt-1">
              Set how long each user type stays logged in when there is no activity. Leave a type empty to use the default.
            </p>
          </div>
        </div>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Inactivity timeout
            </CardTitle>
            <CardDescription>
              Users are logged out after this many minutes without activity. You can set a default and overrides per user type (Student, Faculty, OIC, Admin, etc.).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-4">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading…
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="global-minutes">Default timeout (minutes) — used when a user type has no override</Label>
                  <Input
                    id="global-minutes"
                    type="number"
                    min={1}
                    max={10080}
                    value={globalMinutes}
                    onChange={(e) => setGlobalMinutes(Number(e.target.value) || 30)}
                    className="max-w-[140px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Per user type (minutes) — leave empty to use default</Label>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User type</TableHead>
                        <TableHead className="w-[140px]">Timeout (min)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userTypeChoices.map(({ code, name }) => (
                        <TableRow key={code}>
                          <TableCell className="font-medium">{name}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={1}
                              max={10080}
                              placeholder={String(globalMinutes)}
                              value={byUserTypeMinutes[code] ?? ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                setTypeMinutes(code, v === "" ? "" : Number(v) || 0);
                              }}
                              className="max-w-[120px]"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminSettingsAuth;
