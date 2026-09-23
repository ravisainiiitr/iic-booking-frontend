import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import DashboardHeader from "@/components/DashboardHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  departmentLabel,
  deriveDepartmentsFromEquipments,
  pickDefaultDepartmentId,
  type EquipmentDeptOption,
} from "@/lib/equipmentDepartments";
import { ArrowLeft, BookOpen, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type ClaimRow = {
  id: number;
  title: string;
  authors: string;
  journal: string;
  year: number | null;
  doi: string;
  status: string;
  rejection_reason: string;
  created_at: string | null;
  equipments: Array<{ id: number; code: string; name: string }>;
};

type EquipmentOption = {
  equipment_id: number;
  code: string;
  name: string;
  internal_department?: number | null;
  internal_department_name?: string | null;
  internal_department_code?: string | null;
};

const toEquipmentOption = (e: EquipmentOption): EquipmentOption => ({
  equipment_id: e.equipment_id,
  code: e.code,
  name: e.name,
});

const statusBadge = (status: string) => {
  const s = status.toLowerCase();
  if (s === "approved") return <Badge className="bg-emerald-600">Approved</Badge>;
  if (s === "rejected") return <Badge variant="destructive">Rejected</Badge>;
  return <Badge variant="secondary">Pending review</Badge>;
};

export default function MyPublications() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const userTypeStr = String(user?.user_type ?? "").toLowerCase();
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [equipments, setEquipments] = useState<EquipmentOption[]>([]);
  const [departments, setDepartments] = useState<EquipmentDeptOption[]>([]);
  const [departmentId, setDepartmentId] = useState("");
  const [loadingEq, setLoadingEq] = useState(false);
  const [eqSearch, setEqSearch] = useState("");
  const [selectedEq, setSelectedEq] = useState<number[]>([]);
  const [form, setForm] = useState({
    doi: "",
    title: "",
    authors: "",
    journal: "",
    year: "",
    volume_pages: "",
    url: "",
    facility_note: "",
    impact_factor: "",
  });

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      navigate("/auth");
      return;
    }
    void load();
  }, [authLoading, isAuthenticated, navigate]);

  const load = async () => {
    setLoading(true);
    try {
      const [mineRes, eqRes] = await Promise.all([
        apiClient.listMyPublicationClaims(),
        apiClient.getEquipments(undefined, "ACTIVE"),
      ]);
      if (mineRes.error) throw new Error(mineRes.error);
      if (eqRes.error) throw new Error(eqRes.error);
      setClaims((mineRes.data?.results as ClaimRow[]) || []);
      const allEq = (eqRes.data?.equipments || []) as EquipmentOption[];
      const depts = deriveDepartmentsFromEquipments(allEq);
      setDepartments(depts);
      setDepartmentId((prev) =>
        prev && depts.some((d) => String(d.id) === prev) ? prev : pickDefaultDepartmentId(depts)
      );
      if (!depts.length) setEquipments(allEq.map(toEquipmentOption));
    } catch (e: any) {
      toast.error(e?.message || "Failed to load publications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!departmentId) return;
    let cancelled = false;
    (async () => {
      setLoadingEq(true);
      try {
        const res = await apiClient.getEquipments(undefined, "ACTIVE", undefined, undefined, Number(departmentId));
        if (cancelled) return;
        if (res.error) throw new Error(res.error);
        setEquipments(((res.data?.equipments || []) as EquipmentOption[]).map(toEquipmentOption));
      } catch (e: any) {
        if (!cancelled) toast.error(e?.message || "Failed to load instruments");
      } finally {
        if (!cancelled) setLoadingEq(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [departmentId]);

  const filteredEq = useMemo(() => {
    const q = eqSearch.trim().toLowerCase();
    if (!q) return equipments.slice(0, 40);
    return equipments
      .filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.code.toLowerCase().includes(q)
      )
      .slice(0, 40);
  }, [equipments, eqSearch]);

  const toggleEq = (id: number) => {
    setSelectedEq((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const lookupDoi = async () => {
    const doi = form.doi.trim();
    if (!doi) {
      toast.error("Enter a DOI first");
      return;
    }
    setLookingUp(true);
    try {
      const res = await apiClient.lookupPublicationDoi(doi);
      if (res.error || !res.data) throw new Error(res.error || "DOI lookup failed");
      const meta = res.data;
      setForm((f) => ({
        ...f,
        doi: meta.doi || f.doi,
        title: meta.title || f.title,
        authors: meta.authors || f.authors,
        journal: meta.journal || f.journal,
        year: meta.year != null ? String(meta.year) : f.year,
        volume_pages: meta.volume_pages || f.volume_pages,
        url: meta.url || f.url,
      }));
      toast.success("Publication details filled from DOI");
    } catch (e: any) {
      toast.error(e?.message || "DOI lookup failed — fill fields manually");
    } finally {
      setLookingUp(false);
    }
  };

  const submit = async () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (selectedEq.length === 0) {
      toast.error("Select at least one instrument");
      return;
    }
    setSubmitting(true);
    try {
      const submitRes = await apiClient.submitPublicationClaim({
        title: form.title.trim(),
        authors: form.authors.trim(),
        journal: form.journal.trim(),
        year: form.year.trim() ? Number(form.year) : null,
        volume_pages: form.volume_pages.trim(),
        doi: form.doi.trim(),
        url: form.url.trim(),
        facility_note: form.facility_note.trim(),
        impact_factor: form.impact_factor.trim() ? form.impact_factor.trim() : null,
        equipment_ids: selectedEq,
      });
      if (submitRes.error) throw new Error(submitRes.error);
      const path = String((submitRes.data as { approval_path?: string } | undefined)?.approval_path || "");
      if (path === "faculty_auto" || userTypeStr === "faculty") {
        toast.success("Publication approved and listed on the selected instruments");
      } else if (path === "faculty" || userTypeStr === "student" || userTypeStr === "individual_student") {
        toast.success("Submitted for your faculty supervisor to review");
      } else {
        toast.success("Submitted for OIC / Admin review");
      }
      setForm({
        doi: "",
        title: "",
        authors: "",
        journal: "",
        year: "",
        volume_pages: "",
        url: "",
        facility_note: "",
        impact_factor: "",
      });
      setSelectedEq([]);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              My Publications
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Claim facility use in your papers. Approved entries appear on each instrument&apos;s Publications panel.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Submit a publication</CardTitle>
            <CardDescription>
              Prefer pasting a DOI — we can fill title, authors, and journal automatically. Then select the instrument(s) used.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="doi">DOI</Label>
                <Input
                  id="doi"
                  placeholder="10.xxxx/...."
                  value={form.doi}
                  onChange={(e) => setForm((f) => ({ ...f, doi: e.target.value }))}
                />
              </div>
              <div className="flex items-end">
                <Button type="button" variant="secondary" onClick={lookupDoi} disabled={lookingUp}>
                  {lookingUp ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                  Look up
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="authors">Authors</Label>
                <Input
                  id="authors"
                  value={form.authors}
                  onChange={(e) => setForm((f) => ({ ...f, authors: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="journal">Journal</Label>
                <Input
                  id="journal"
                  value={form.journal}
                  onChange={(e) => setForm((f) => ({ ...f, journal: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="year">Year</Label>
                <Input
                  id="year"
                  inputMode="numeric"
                  value={form.year}
                  onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="impact_factor">Impact factor (optional)</Label>
                <Input
                  id="impact_factor"
                  inputMode="decimal"
                  value={form.impact_factor}
                  onChange={(e) => setForm((f) => ({ ...f, impact_factor: e.target.value }))}
                  placeholder="e.g. 12.345"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="volume_pages">Volume / pages</Label>
                <Input
                  id="volume_pages"
                  value={form.volume_pages}
                  onChange={(e) => setForm((f) => ({ ...f, volume_pages: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="url">URL (optional)</Label>
              <Input
                id="url"
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="facility_note">How was the facility used? (optional)</Label>
              <Textarea
                id="facility_note"
                rows={2}
                value={form.facility_note}
                onChange={(e) => setForm((f) => ({ ...f, facility_note: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Instruments used *</Label>
              {departments.length > 0 ? (
                <Select value={departmentId || undefined} onValueChange={setDepartmentId}>
                  <SelectTrigger aria-label="Department">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {departmentLabel(d)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              <Input
                placeholder="Search equipment by name or code…"
                value={eqSearch}
                onChange={(e) => setEqSearch(e.target.value)}
              />
              <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-1">
                {loadingEq ? (
                  <p className="text-sm text-muted-foreground p-2 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading instruments…
                  </p>
                ) : filteredEq.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-2">No instruments match.</p>
                ) : (
                  filteredEq.map((eq) => (
                    <label
                      key={eq.equipment_id}
                      className="flex items-start gap-2 rounded px-2 py-1.5 hover:bg-muted/60 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedEq.includes(eq.equipment_id)}
                        onCheckedChange={() => toggleEq(eq.equipment_id)}
                      />
                      <span className="text-sm leading-snug">
                        <span className="font-medium">{eq.code}</span>
                        <span className="text-muted-foreground"> — {eq.name}</span>
                      </span>
                    </label>
                  ))
                )}
              </div>
              {selectedEq.length > 0 ? (
                <p className="text-xs text-muted-foreground">{selectedEq.length} selected</p>
              ) : null}
            </div>

            <Button onClick={submit} disabled={submitting} className="w-full sm:w-auto">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit for review
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your submissions</CardTitle>
            <CardDescription>Status of claims linked to your account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {claims.length === 0 ? (
              <p className="text-sm text-muted-foreground">No submissions yet.</p>
            ) : (
              claims.map((c) => (
                <div key={c.id} className="rounded-lg border p-4 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-medium leading-snug">{c.title}</h3>
                    {statusBadge(c.status)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {c.equipments.map((e) => e.code).join(", ")}
                    {c.year ? ` · ${c.year}` : ""}
                    {c.doi ? ` · DOI ${c.doi}` : ""}
                  </p>
                  {c.created_at ? (
                    <p className="text-xs text-muted-foreground">
                      Submitted {format(new Date(c.created_at), "dd MMM yyyy")}
                    </p>
                  ) : null}
                  {c.status === "rejected" && c.rejection_reason ? (
                    <p className="text-sm text-destructive">Reason: {c.rejection_reason}</p>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}