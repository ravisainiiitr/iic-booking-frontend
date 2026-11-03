import { useEffect, useState } from "react";
import { Link2, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import {
  apiClient,
  type IstemEquipmentSearchRow,
  type IstemMappingEquipmentRow,
  type IstemSuggestionRow,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import ConfidencePill from "./ConfidencePill";
import { reasonText, sourceNote } from "./mappingModel";

const NO_FIELD = "__none__";

type Option = IstemEquipmentSearchRow & { score?: number; reasons?: string[] };

function OptionList({ options, selected, onPick, currentId }: {
  options: Option[]; selected: string; onPick: (id: string) => void; currentId: number;
}) {
  return (
    <ul className="max-h-60 divide-y overflow-auto rounded-lg border">
      {options.map((o) => {
        const elsewhere = o.mapped_to.filter((m) => m.equipment_id !== currentId);
        return (
          <li key={o.equipment_id}>
            <button type="button" onClick={() => onPick(o.equipment_id)} aria-pressed={selected === o.equipment_id}
              className={`flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/60 ${selected === o.equipment_id ? "bg-primary/10" : ""}`}>
              <span className="min-w-0">
                <span className="block text-sm font-medium">{o.equipment_name || "(no name)"}</span>
                <span className="block text-xs text-muted-foreground">
                  {[o.reasons?.length ? reasonText(o.reasons) : "", o.location].filter(Boolean).join(" · ")}
                </span>
                {elsewhere.length ? (
                  <span className="block text-xs text-amber-700 dark:text-amber-400">Already mapped to {elsewhere.map((m) => m.name).join(", ")}</span>
                ) : null}
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                {o.score != null ? <ConfidencePill score={o.score} /> : null}
                <span className="font-mono text-xs text-muted-foreground">{o.equipment_id}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Choose or change an instrument's I-STEM equipment: suggestions first (no typing), a name search as a fallback. */
export default function IstemMappingDialog({ row, connected, onClose, onSaved }: {
  row: IstemMappingEquipmentRow;
  connected: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [istemId, setIstemId] = useState(row.mapping?.istem_equipment_id ?? "");
  const [fieldKey, setFieldKey] = useState(row.mapping?.sample_count_input_key || NO_FIELD);
  const [active, setActive] = useState(row.mapping?.is_active ?? true);
  const [notes, setNotes] = useState(row.mapping?.notes ?? "");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<IstemEquipmentSearchRow[] | null>(null);
  const [note, setNote] = useState("");
  const [suggested, setSuggested] = useState<IstemSuggestionRow | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(connected);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const locked = row.open_istem_bookings > 0 && Boolean(row.mapping?.istem_equipment_id);

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    apiClient.getIstemEquipmentSuggestions(undefined, false, row.equipment_id).then((res) => {
      if (cancelled) return;
      setLoadingSuggestions(false);
      if (res.error || !res.data) {
        setNote(res.error || "");
        return;
      }
      const found = res.data.equipment[0] ?? null;
      setSuggested(found);
      setNote(sourceNote(res.data.istem_source));
      if (found?.confident && !row.mapping?.istem_equipment_id && found.candidates[0]) setIstemId(found.candidates[0].equipment_id);
      if (!row.mapping && found?.default_sample_key) setFieldKey(found.default_sample_key);
    });
    return () => { cancelled = true; };
  }, [connected, row.equipment_id, row.mapping]);

  const search = async () => {
    setSearching(true);
    const res = await apiClient.searchIstemEquipment(query.trim());
    setSearching(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setResults(res.data?.results ?? []);
    const extra = sourceNote(res.data?.istem_source);
    if (extra) setNote(extra);
  };

  const save = async () => {
    setSaving(true);
    const res = await apiClient.saveIstemEquipmentMapping(row.equipment_id, {
      istem_equipment_id: istemId.trim(),
      sample_count_input_key: fieldKey === NO_FIELD ? "" : fieldKey,
      is_active: active,
      notes,
    });
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(`${row.name} mapped to I-STEM equipment ${istemId.trim()}.`);
    for (const warning of res.data?.warnings ?? []) toast.warning(warning);
    onSaved();
  };

  const departments = suggested?.istem_departments ?? [];
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{row.mapping ? "Change" : "Map"} {row.name}</DialogTitle>
          <DialogDescription>
            Pick the I-STEM equipment this instrument is listed as. Bookings that need an I-STEM FBR are registered on
            I-STEM under it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          {note ? <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">{note}</p> : null}
          {connected ? (
            <section className="space-y-2" data-testid="istem-suggestions">
              <div className="flex items-baseline justify-between gap-2">
                <Label>Suggested</Label>
                <span className="text-xs text-muted-foreground">
                  {departments.length ? `From I-STEM department ${departments.join(", ")}` : "From the institute's whole I-STEM list"}
                </span>
              </div>
              {loadingSuggestions ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Looking on I-STEM…</div>
              ) : suggested?.candidates.length ? (
                <OptionList options={suggested.candidates} selected={istemId} onPick={setIstemId} currentId={row.equipment_id} />
              ) : (
                <p className="text-sm text-muted-foreground">No close match on I-STEM. Search by name below.</p>
              )}
            </section>
          ) : (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              I-STEM is not connected on this portal. Enter the I-STEM equipment ID; it is checked once I-STEM is connected.
            </p>
          )}
          {connected ? (
            <section className="space-y-2">
              <Label htmlFor="istem-search">Not in the list? Search I-STEM by name</Label>
              <div className="flex gap-2">
                <Input id="istem-search" value={query} onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void search(); } }}
                  placeholder="e.g. Fluorescence" />
                <Button type="button" variant="outline" onClick={() => void search()} disabled={searching || query.trim().length < 3}>
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  <span className="ml-1">Search</span>
                </Button>
              </div>
              {results ? (
                results.length ? (
                  <OptionList options={results} selected={istemId} onPick={setIstemId} currentId={row.equipment_id} />
                ) : (
                  <p className="text-sm text-muted-foreground">Nothing on I-STEM matches that name.</p>
                )
              ) : null}
            </section>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="istem-id">I-STEM equipment ID</Label>
              <Input id="istem-id" inputMode="numeric" value={istemId} disabled={locked}
                onChange={(e) => setIstemId(e.target.value.replace(/\D/g, ""))} placeholder="Chosen above, or type it" />
              {locked ? (
                <p className="text-xs text-amber-700">
                  {row.open_istem_bookings} booking(s) are still open on I-STEM under this ID; it can change once they
                  are executed or cancelled.
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label>Number of samples is entered in</Label>
              <Select value={fieldKey} onValueChange={setFieldKey}>
                <SelectTrigger aria-label="Sample-count field"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_FIELD}>Not set</SelectItem>
                  {row.input_fields.map((f) => <SelectItem key={f.key} value={f.key}>{f.key} — {f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="istem-active" checked={active} onCheckedChange={setActive} disabled={locked && active} />
            <Label htmlFor="istem-active">Mapping in use</Label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="istem-notes">Notes</Label>
            <Textarea id="istem-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. confirmed with the I-STEM team on …" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void save()} disabled={saving || !istemId.trim()}>
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Link2 className="mr-1 h-4 w-4" />}Save mapping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
