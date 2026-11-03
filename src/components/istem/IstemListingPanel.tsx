import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { apiClient, type IstemEquipmentSearchRow } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** I-STEM's own equipment list for the institute, with the portal instruments mapped to each entry. */
export default function IstemListingPanel({ connected }: { connected: boolean }) {
  const [rows, setRows] = useState<IstemEquipmentSearchRow[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [unmappedOnly, setUnmappedOnly] = useState(false);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    const res = await apiClient.getIstemEquipmentListing(refresh);
    setLoading(false);
    if (res.error || !res.data) {
      setError(res.error || "Could not read I-STEM's equipment list.");
      return;
    }
    setError("");
    setRows(res.data.equipment);
  }, []);

  useEffect(() => { if (connected) void load(); }, [connected, load]);

  const shown = useMemo(() => {
    const needle = text.trim().toLowerCase();
    return (rows ?? []).filter((r) =>
      (!unmappedOnly || r.mapped_to.length === 0)
      && (!needle || `${r.equipment_name} ${r.equipment_id} ${r.mapped_to.map((m) => m.name).join(" ")}`.toLowerCase().includes(needle)));
  }, [rows, text, unmappedOnly]);

  if (!connected) {
    return <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">I-STEM is not connected on this portal.</p>;
  }

  const mapped = (rows ?? []).filter((r) => r.mapped_to.length).length;
  return (
    <section className="space-y-3" data-testid="istem-listing">
      <div className="flex flex-wrap items-center gap-3">
        <Input className="w-full sm:w-72" placeholder="Search I-STEM name, ID or instrument" value={text}
          onChange={(e) => setText(e.target.value)} aria-label="Search the I-STEM list" />
        <div className="flex items-center gap-2">
          <Switch id="istem-unmapped" checked={unmappedOnly} onCheckedChange={setUnmappedOnly} />
          <Label htmlFor="istem-unmapped" className="text-sm">Not mapped on the portal</Label>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load(true)} disabled={loading}>
          <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Re-read from I-STEM
        </Button>
        {rows ? <span className="text-xs text-muted-foreground">{mapped} of {rows.length} mapped on the portal</span> : null}
      </div>
      {error ? <p className="text-sm text-red-700" role="alert">{error}</p> : null}
      {rows ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>I-STEM ID</TableHead>
                <TableHead>I-STEM equipment</TableHead>
                <TableHead>Portal instrument</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r) => (
                <TableRow key={r.equipment_id} data-testid="istem-listing-row">
                  <TableCell className="font-mono text-sm">{r.equipment_id}</TableCell>
                  <TableCell>{r.equipment_name}</TableCell>
                  <TableCell className="text-sm">
                    {r.mapped_to.length ? r.mapped_to.map((m) => m.name).join(", ") : <span className="text-muted-foreground">Not mapped</span>}
                  </TableCell>
                </TableRow>
              ))}
              {!shown.length ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">Nothing matches.</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      ) : loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Reading I-STEM…</div>
      ) : null}
    </section>
  );
}
