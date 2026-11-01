import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Award, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { apiClient, type ResearchRecognitionAdmin } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import DashboardHeader from "@/components/DashboardHeader";
import { StandaloneOnly } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type Section = "cmsHallOfFrames" | "cmsResearchersOfTheMonth";
type Dept = { id: number; name: string };

const EMPTY: Partial<ResearchRecognitionAdmin> = {
  researcher_name: "",
  affiliation: "",
  publication_title: "",
  research_summary: "",
  journal: "",
  year: null,
  publication_url: "",
  facility: "",
  is_approved: false,
  order: 0,
  month: "",
  department: null,
};

function monthLabel(iso?: string): string {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function RecognitionList({
  section,
  departments,
  isMainAdmin,
}: {
  section: Section;
  departments: Dept[];
  isMainAdmin: boolean;
}) {
  const { toast } = useToast();
  const monthly = section === "cmsResearchersOfTheMonth";
  const [rows, setRows] = useState<ResearchRecognitionAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<ResearchRecognitionAdmin> | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiClient.adminList<ResearchRecognitionAdmin>(section);
    const data = res.data as unknown;
    setRows(Array.isArray(data) ? (data as ResearchRecognitionAdmin[]) : ((data as { results?: ResearchRecognitionAdmin[] })?.results ?? []));
    setLoading(false);
  }, [section]);

  useEffect(() => {
    void load();
  }, [load]);

  const set = (key: keyof ResearchRecognitionAdmin, value: unknown) =>
    setEditing((prev) => ({ ...(prev ?? {}), [key]: value }));

  const save = async () => {
    if (!editing?.researcher_name?.trim()) {
      toast({ title: "Name required", description: "Enter the researcher's name.", variant: "destructive" });
      return;
    }
    if (monthly && !editing.month) {
      toast({ title: "Month required", description: "Choose the month to feature this researcher.", variant: "destructive" });
      return;
    }
    const fields: Record<string, string | number | boolean | null | undefined> = {
      researcher_name: editing.researcher_name,
      affiliation: editing.affiliation ?? "",
      publication_title: editing.publication_title ?? "",
      research_summary: editing.research_summary ?? "",
      journal: editing.journal ?? "",
      year: editing.year ?? "",
      publication_url: editing.publication_url ?? "",
      facility: editing.facility ?? "",
    };
    if (isMainAdmin) fields.is_approved = Boolean(editing.is_approved);
    if (monthly) {
      fields.month = `${String(editing.month).slice(0, 7)}-01`;
      fields.department = editing.department ?? "";
    } else {
      fields.order = editing.order ?? 0;
    }
    setSaving(true);
    const res = await apiClient.adminSaveResearchRecognition(section, editing.id ?? null, fields, photo);
    setSaving(false);
    if (res.error) {
      toast({ title: "Not saved", description: res.error, variant: "destructive" });
      return;
    }
    toast({
      title: "Saved",
      description: res.data?.is_approved ? "Shown on the home page." : "Saved as a draft: the Main Administrator approves it for the home page.",
    });
    setEditing(null);
    setPhoto(null);
    void load();
  };

  const remove = async (row: ResearchRecognitionAdmin) => {
    if (!window.confirm(`Remove ${row.researcher_name}? This cannot be undone.`)) return;
    const res = await apiClient.adminDelete(section, row.id);
    if (res.error) {
      toast({ title: "Not removed", description: res.error, variant: "destructive" });
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== row.id));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          className="gap-2"
          onClick={() => {
            setPhoto(null);
            setEditing({ ...EMPTY, month: monthly ? new Date().toISOString().slice(0, 7) : "" });
          }}
        >
          <Plus className="h-4 w-4" /> {monthly ? "Feature a researcher" : "Add entry"}
        </Button>
      </div>
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nothing added yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 p-3">
              {r.photo_url ? (
                <img src={r.photo_url} alt="" width={48} height={48} className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <span className="h-12 w-12 rounded-full bg-muted" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium">{r.researcher_name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {monthly ? `${monthLabel(r.month)} · ${r.department_name}` : `Order ${r.order ?? 0}`}
                  {r.publication_title ? ` · ${r.publication_title}` : ""}
                </p>
              </div>
              <Badge variant={r.is_approved ? "default" : "secondary"}>{r.is_approved ? "Approved" : "Draft"}</Badge>
              <Button size="icon" variant="ghost" aria-label={`Edit ${r.researcher_name}`} onClick={() => { setPhoto(null); setEditing({ ...r, month: r.month?.slice(0, 7) }); }}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" aria-label={`Remove ${r.researcher_name}`} onClick={() => void remove(r)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit" : monthly ? "Feature a researcher" : "Add a Hall of Frames entry"}</DialogTitle>
            <DialogDescription>
              {isMainAdmin
                ? "Approved entries appear on the home page."
                : "Your changes are saved as a draft; the Main Administrator approves them for the home page."}
            </DialogDescription>
          </DialogHeader>
          {editing ? (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="rr-name">Researcher name</Label>
                <Input id="rr-name" value={editing.researcher_name ?? ""} onChange={(e) => set("researcher_name", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="rr-photo">Photo</Label>
                <Input id="rr-photo" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
                <p className="text-xs text-muted-foreground">Resized automatically; a square portrait looks best.</p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="rr-aff">Department / institution</Label>
                <Input id="rr-aff" value={editing.affiliation ?? ""} onChange={(e) => set("affiliation", e.target.value)} />
              </div>
              {monthly ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="rr-month">Month</Label>
                    <Input id="rr-month" type="month" value={String(editing.month ?? "").slice(0, 7)} onChange={(e) => set("month", e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="rr-dept">Recognised for</Label>
                    <select
                      id="rr-dept"
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      value={editing.department ?? ""}
                      onChange={(e) => set("department", e.target.value ? Number(e.target.value) : null)}
                    >
                      {isMainAdmin ? <option value="">Institute-wide</option> : null}
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid gap-1.5">
                  <Label htmlFor="rr-order">Order (lower shows first)</Label>
                  <Input id="rr-order" type="number" min={0} value={editing.order ?? 0} onChange={(e) => set("order", Number(e.target.value) || 0)} />
                </div>
              )}
              <div className="grid gap-1.5">
                <Label htmlFor="rr-title">Publication title</Label>
                <Input id="rr-title" value={editing.publication_title ?? ""} onChange={(e) => set("publication_title", e.target.value)} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 grid gap-1.5">
                  <Label htmlFor="rr-journal">Journal / conference</Label>
                  <Input id="rr-journal" value={editing.journal ?? ""} onChange={(e) => set("journal", e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="rr-year">Year</Label>
                  <Input id="rr-year" type="number" min={1900} max={2100} value={editing.year ?? ""} onChange={(e) => set("year", e.target.value ? Number(e.target.value) : null)} />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="rr-url">Publication link (DOI or URL)</Label>
                <Input id="rr-url" type="url" value={editing.publication_url ?? ""} onChange={(e) => set("publication_url", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="rr-facility">Acknowledged facility / equipment</Label>
                <Input id="rr-facility" value={editing.facility ?? ""} onChange={(e) => set("facility", e.target.value)} placeholder="e.g. IIC FE-SEM facility" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="rr-summary">Brief research description</Label>
                <Textarea id="rr-summary" rows={3} value={editing.research_summary ?? ""} onChange={(e) => set("research_summary", e.target.value)} />
              </div>
              {isMainAdmin ? (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={Boolean(editing.is_approved)} onCheckedChange={(v) => set("is_approved", v === true)} />
                  Approved: show on the home page
                </label>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Admin: Hall of Frames entries and Researchers of the Month shown on the home page. */
export default function AdminResearchRecognition() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMainAdmin = String(user?.user_type ?? "").toLowerCase() === "admin";
  const [departments, setDepartments] = useState<Dept[]>([]);

  useEffect(() => {
    if (user && !apiClient.isAdminPanelUser(user.user_type)) navigate("/dashboard");
  }, [user, navigate]);

  useEffect(() => {
    apiClient
      .getDepartments("internal")
      .then((res) => {
        const all = (res.data?.departments ?? []).map((d) => ({ id: d.id, name: d.name }));
        const own = (user as { department?: number | null } | null)?.department ?? null;
        setDepartments(isMainAdmin || own == null ? all : all.filter((d) => d.id === own));
      })
      .catch(() => setDepartments([]));
  }, [isMainAdmin, user]);

  return (
    <div className="page-shell">
      <DashboardHeader />
      <div className="container mx-auto px-4 py-8">
        <StandaloneOnly>
          <Button variant="ghost" className="mb-4 gap-2" onClick={() => navigate("/content-management")}>
            <ArrowLeft className="h-4 w-4" /> Back to Content Management
          </Button>
        </StandaloneOnly>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-6 w-6" /> Researcher recognition
            </CardTitle>
            <CardDescription>
              Hall of Frames and Researcher of the Month on the home page. Only entries approved by the Main
              Administrator are shown; a new month replaces the previous Researcher of the Month automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="month">
              <TabsList>
                <TabsTrigger value="month">Researcher of the Month</TabsTrigger>
                <TabsTrigger value="hall">Hall of Frames</TabsTrigger>
              </TabsList>
              <TabsContent value="month" className="pt-4">
                <RecognitionList section="cmsResearchersOfTheMonth" departments={departments} isMainAdmin={isMainAdmin} />
              </TabsContent>
              <TabsContent value="hall" className="pt-4">
                <RecognitionList section="cmsHallOfFrames" departments={departments} isMainAdmin={isMainAdmin} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
