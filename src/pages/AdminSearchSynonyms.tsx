import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import DashboardHeader from "@/components/DashboardHeader";
import { StandaloneOnly } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient, type SearchSynonym, type SearchSynonymList } from "@/lib/api";

type Draft = {
  id: number | null;
  technique: string;
  terms: string;
  category_ids: number[];
  equipment_ids: number[];
  is_active: boolean;
};

const EMPTY_DRAFT: Draft = { id: null, technique: "", terms: "", category_ids: [], equipment_ids: [], is_active: true };

const toggle = (ids: number[], id: number) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

/** Main Administrator: techniques and the words people type for them, used by the header search. */
export default function AdminSearchSynonyms() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const isAdmin = String(user?.user_type ?? "").toLowerCase() === "admin";

  const [data, setData] = useState<SearchSynonymList | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [equipmentFilter, setEquipmentFilter] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user) {
      navigate("/auth");
      return;
    }
    if (!isAdmin) {
      toast.error("Only the Main Administrator can edit search synonyms.");
      navigate("/admin-settings/equipment");
    }
  }, [authLoading, isAuthenticated, user, isAdmin, navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiClient.getSearchSynonyms();
    setLoading(false);
    if (res.error || !res.data?.synonyms) {
      toast.error(res.error || "Could not load search synonyms.");
      return;
    }
    setData(res.data);
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const categoryName = useMemo(() => new Map((data?.categories ?? []).map((c) => [c.id, c.name])), [data]);
  const equipmentCode = useMemo(() => new Map((data?.equipment ?? []).map((e) => [e.id, e.code])), [data]);

  const rows = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const all = data?.synonyms ?? [];
    if (!needle) return all;
    return all.filter((s) =>
      [s.technique, ...s.terms, ...s.category_ids.map((id) => categoryName.get(id) ?? ""), ...s.equipment_ids.map((id) => equipmentCode.get(id) ?? "")]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [data, filter, categoryName, equipmentCode]);

  const equipmentChoices = useMemo(() => {
    const needle = equipmentFilter.trim().toLowerCase();
    const all = data?.equipment ?? [];
    return needle ? all.filter((e) => `${e.code} ${e.name}`.toLowerCase().includes(needle)) : all;
  }, [data, equipmentFilter]);

  const openEdit = (s: SearchSynonym | null) => {
    setEquipmentFilter("");
    setDraft(
      s
        ? {
            id: s.id,
            technique: s.technique,
            terms: s.terms.join(", "),
            category_ids: s.category_ids,
            equipment_ids: s.equipment_ids,
            is_active: s.is_active,
          }
        : EMPTY_DRAFT,
    );
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    const body = {
      technique: draft.technique,
      terms: draft.terms,
      category_ids: draft.category_ids,
      equipment_ids: draft.equipment_ids,
      is_active: draft.is_active,
    };
    const res = draft.id ? await apiClient.updateSearchSynonym(draft.id, body) : await apiClient.createSearchSynonym(body);
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Search synonyms saved.");
    setDraft(null);
    load();
  };

  const remove = async (s: SearchSynonym) => {
    if (!window.confirm(`Delete “${s.technique}”? Searches for its terms will no longer find these instruments.`)) return;
    const res = await apiClient.deleteSearchSynonym(s.id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Deleted.");
    load();
  };

  const setActive = async (s: SearchSynonym, active: boolean) => {
    const res = await apiClient.updateSearchSynonym(s.id, { is_active: active });
    if (res.error) toast.error(res.error);
    load();
  };

  if (!isAdmin) return null;

  return (
    <div className="page-shell">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-5">
        <StandaloneOnly>
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin-settings/equipment")} className="mb-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Equipment settings
          </Button>
        </StandaloneOnly>
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Search synonyms</CardTitle>
              <CardDescription>
                Words people type for a technique, and the categories or instruments that offer it. The search
                (Ctrl+K) uses them, so “crystal structure” finds the X-ray diffractometers. Small spelling mistakes
                are handled automatically.
              </CardDescription>
            </div>
            <Button onClick={() => openEdit(null)}>
              <Plus className="mr-2 h-4 w-4" />
              Add technique
            </Button>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter by technique, term, category or code"
                className="pl-9"
                aria-label="Filter search synonyms"
              />
            </div>
            {loading && !data ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
              </div>
            ) : rows.length === 0 ? (
              <p className="py-8 text-sm text-muted-foreground">No techniques match.</p>
            ) : (
              <ul className="divide-y rounded-md border">
                {rows.map((s) => {
                  const linked = [
                    ...s.category_ids.map((id) => categoryName.get(id)).filter(Boolean),
                    ...s.equipment_ids.map((id) => equipmentCode.get(id)).filter(Boolean),
                  ] as string[];
                  return (
                    <li key={s.id} className="flex flex-wrap items-start gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{s.technique}</p>
                        <p className="mt-0.5 text-sm text-muted-foreground">{s.terms.join(", ")}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {linked.length ? (
                            linked.map((l) => (
                              <Badge key={l} variant="secondary" className="font-normal">
                                {l}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-amber-700 dark:text-amber-400">
                              Not linked to any category or equipment yet
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={s.is_active}
                          onCheckedChange={(v) => setActive(s, v)}
                          aria-label={`${s.technique} active`}
                        />
                        <Button variant="ghost" size="icon" onClick={() => openEdit(s)} aria-label={`Edit ${s.technique}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(s)} aria-label={`Delete ${s.technique}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{draft?.id ? "Edit technique" : "Add technique"}</DialogTitle>
              <DialogDescription>
                Searching any of the terms lists the linked instruments with “Matched technique: …”.
              </DialogDescription>
            </DialogHeader>
            {draft ? (
              <div className="grid gap-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="syn-technique">Technique</Label>
                  <Input
                    id="syn-technique"
                    value={draft.technique}
                    maxLength={120}
                    onChange={(e) => setDraft({ ...draft, technique: e.target.value })}
                    placeholder="e.g. X-ray diffraction"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="syn-terms">Search terms (comma-separated)</Label>
                  <Textarea
                    id="syn-terms"
                    rows={3}
                    value={draft.terms}
                    onChange={(e) => setDraft({ ...draft, terms: e.target.value })}
                    placeholder="xrd, crystal structure, phase identification"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Categories (every instrument in the category)</Label>
                  <div className="grid max-h-40 grid-cols-1 gap-1.5 overflow-y-auto rounded-md border p-2 sm:grid-cols-2">
                    {(data?.categories ?? []).map((c) => (
                      <label key={c.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={draft.category_ids.includes(c.id)}
                          onCheckedChange={() => setDraft({ ...draft, category_ids: toggle(draft.category_ids, c.id) })}
                        />
                        {c.name}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="syn-equipment-filter">Equipment ({draft.equipment_ids.length} selected)</Label>
                  <Input
                    id="syn-equipment-filter"
                    value={equipmentFilter}
                    onChange={(e) => setEquipmentFilter(e.target.value)}
                    placeholder="Filter by code or name"
                  />
                  <div className="grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto rounded-md border p-2">
                    {equipmentChoices.map((e) => (
                      <label key={e.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={draft.equipment_ids.includes(e.id)}
                          onCheckedChange={() => setDraft({ ...draft, equipment_ids: toggle(draft.equipment_ids, e.id) })}
                        />
                        <span className="font-mono text-xs">{e.code}</span>
                        <span className="truncate text-muted-foreground">{e.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={draft.is_active} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} />
                  Active
                </label>
              </div>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDraft(null)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={save} disabled={saving || !draft?.technique.trim() || !draft?.terms.trim()}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
