import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import DashboardHeader from "@/components/DashboardHeader";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";

type Tab =
  | "dashboard"
  | "degrees"
  | "mapping"
  | "hods"
  | "students"
  | "extensions";

export default function IdentityAdministration() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const isAdmin = String(user?.user_type || "").toLowerCase() === "admin";
  const [tab, setTab] = useState<Tab>("dashboard");
  const [loading, setLoading] = useState(true);
  const [dash, setDash] = useState<Record<string, number | string>>({});
  const [degrees, setDegrees] = useState<any[]>([]);
  const [mappings, setMappings] = useState<any[]>([]);
  const [hods, setHods] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [extensions, setExtensions] = useState<any[]>([]);
  const [degreeName, setDegreeName] = useState("B.Tech");
  const [degreeClass, setDegreeClass] = useState("UNDERGRADUATE");
  const [mapName, setMapName] = useState("");
  const [mapDeptId, setMapDeptId] = useState("");
  const [hodUserId, setHodUserId] = useState("");
  const [hodDeptId, setHodDeptId] = useState("");

  const load = async () => {
    setLoading(true);
    if (tab === "dashboard") {
      const r = await apiClient.getIdentityDashboard();
      if (r.error) toast.error(r.error);
      else setDash(r.data || {});
    } else if (tab === "degrees") {
      const r = await apiClient.listDegreeClassifications();
      if (r.error) toast.error(r.error);
      else setDegrees(r.data?.results || []);
    } else if (tab === "mapping") {
      const r = await apiClient.listDepartmentMappings({ unmapped: false });
      if (r.error) toast.error(r.error);
      else setMappings(r.data?.results || []);
    } else if (tab === "hods") {
      const r = await apiClient.listHodAssignments();
      if (r.error) toast.error(r.error);
      else setHods(r.data?.results || []);
    } else if (tab === "students") {
      const r = await apiClient.listIdentityStudents();
      if (r.error) toast.error(r.error);
      else setStudents(r.data?.results || []);
    } else {
      const r = await apiClient.listValidityExtensions();
      if (r.error) toast.error(r.error);
      else setExtensions(r.data?.results || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!isAdmin) {
      toast.error("Only Main Administrator can access Identity.");
      navigate("/dashboard");
      return;
    }
    load();
  }, [authLoading, isAuthenticated, user, isAdmin, tab]);

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-6 max-w-6xl space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/user-management")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h1 className="text-2xl font-semibold">Identity &amp; Affiliation</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["dashboard", "Dashboard"],
              ["degrees", "Degree Classification"],
              ["mapping", "Department Mapping"],
              ["hods", "Heads of Department"],
              ["students", "Student Lifecycle"],
              ["extensions", "Extension Requests"],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <Button key={id} size="sm" variant={tab === id ? "default" : "outline"} onClick={() => setTab(id)}>
              {label}
            </Button>
          ))}
        </div>

        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <>
            {tab === "dashboard" && (
              <Card>
                <CardHeader>
                  <CardTitle>Identity statistics</CardTitle>
                  <CardDescription>Feature flags remain off until staging activation.</CardDescription>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-3 gap-3 text-sm">
                  {Object.entries(dash).map(([k, v]) => (
                    <div key={k} className="border rounded-md p-3">
                      <div className="text-muted-foreground">{k}</div>
                      <div className="font-medium">{String(v)}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {tab === "degrees" && (
              <Card>
                <CardHeader>
                  <CardTitle>Degree classification</CardTitle>
                  <CardDescription>Do not hardcode B.Tech only. Add names here.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2 items-end">
                    <div>
                      <Label>Channel-I degree name</Label>
                      <Input value={degreeName} onChange={(e) => setDegreeName(e.target.value)} />
                    </div>
                    <div>
                      <Label>Classification</Label>
                      <Input value={degreeClass} onChange={(e) => setDegreeClass(e.target.value)} />
                    </div>
                    <Button
                      onClick={async () => {
                        const r = await apiClient.saveDegreeClassification({
                          channel_i_degree_name: degreeName,
                          classification: degreeClass,
                        });
                        if (r.error) toast.error(r.error);
                        else {
                          toast.success("Saved");
                          load();
                        }
                      }}
                    >
                      Save
                    </Button>
                  </div>
                  {degrees.map((d) => (
                    <div key={d.id} className="text-sm border rounded-md p-2">
                      {d.channel_i_degree_name} → {d.classification} {d.active ? "" : "(inactive)"}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {tab === "mapping" && (
              <Card>
                <CardHeader>
                  <CardTitle>Department mapping</CardTitle>
                  <CardDescription>
                    Channel-I name → internal Department. Unmapped students cannot pick an arbitrary HoD.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2 items-end">
                    <div>
                      <Label>Channel-I department</Label>
                      <Input value={mapName} onChange={(e) => setMapName(e.target.value)} />
                    </div>
                    <div>
                      <Label>Internal department id</Label>
                      <Input value={mapDeptId} onChange={(e) => setMapDeptId(e.target.value)} />
                    </div>
                    <Button
                      onClick={async () => {
                        const r = await apiClient.saveDepartmentMapping({
                          channel_i_department_name: mapName,
                          internal_department_id: mapDeptId ? Number(mapDeptId) : null,
                        });
                        if (r.error) toast.error(r.error);
                        else {
                          toast.success("Saved");
                          load();
                        }
                      }}
                    >
                      Save mapping
                    </Button>
                  </div>
                  {mappings.map((m) => (
                    <div key={m.id} className="text-sm border rounded-md p-2">
                      {m.channel_i_department_name} → {m.internal_department_name || "UNMAPPED"} ({m.status})
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {tab === "hods" && (
              <Card>
                <CardHeader>
                  <CardTitle>Heads of Department</CardTitle>
                  <CardDescription>Local portal role. Not inferred from Channel-I designation.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2 items-end">
                    <div>
                      <Label>User id</Label>
                      <Input value={hodUserId} onChange={(e) => setHodUserId(e.target.value)} />
                    </div>
                    <div>
                      <Label>Department id</Label>
                      <Input value={hodDeptId} onChange={(e) => setHodDeptId(e.target.value)} />
                    </div>
                    <Button
                      onClick={async () => {
                        const r = await apiClient.assignHod({
                          user_id: Number(hodUserId),
                          department_id: Number(hodDeptId),
                        });
                        if (r.error) toast.error(r.error);
                        else {
                          toast.success("Assigned");
                          load();
                        }
                      }}
                    >
                      Assign HoD
                    </Button>
                  </div>
                  {hods.map((h) => (
                    <div key={h.id} className="text-sm border rounded-md p-2 flex justify-between">
                      <span>
                        {h.user_name} ({h.user_email}) — {h.department_name} {h.active ? "ACTIVE" : "inactive"}
                      </span>
                      {h.active && (
                        <Button size="sm" variant="outline" onClick={() => apiClient.disableHod(h.id).then(load)}>
                          Disable
                        </Button>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {tab === "students" && (
              <Card>
                <CardHeader>
                  <CardTitle>Student lifecycle</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {students.map((s) => (
                    <div key={s.user_id} className="text-sm border rounded-md p-2">
                      {s.name} ({s.email}) · {s.classification} · {s.validity_source} · end{" "}
                      {s.channel_i_end_date || s.derived_end_date || "UNRESOLVED"} ·{" "}
                      {s.is_active ? "active" : "disabled"}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {tab === "extensions" && (
              <Card>
                <CardHeader>
                  <CardTitle>Extension requests</CardTitle>
                  <CardDescription>+6 calendar months. Cannot override a Channel-I end date.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {extensions.map((e) => (
                    <div key={e.id} className="text-sm border rounded-md p-2 flex justify-between">
                      <span>
                        {e.student_email}: {e.previous_expiry} → {e.requested_expiry} ({e.status})
                      </span>
                      {e.status === "SUBMITTED" && (
                        <Button size="sm" onClick={() => apiClient.approveValidityExtension(e.id).then(load)}>
                          Approve
                        </Button>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}
