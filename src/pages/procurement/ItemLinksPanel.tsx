import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage, pmGet, pmPatch, pmPost, pmRequest, type Page, type PmItem, type PmItemLink } from "@/lib/procurementApi";
import { labelOf, LINK_USAGES } from "./inventory";
import { EmptyRow, Field, LoadingRow, NativeSelect, pageSerialStart, Pager, qty, SectionCard, usePm, useRunner } from "./shared";

/** Consumables, spares and accessories used by each equipment; requests and the "back to functional" prompt suggest them. */
export default function ItemLinksPanel() {
  const { deptId, boot, hasPerm, hasRole } = usePm();
  const qc = useQueryClient();
  const equipment = boot.equipment.filter((e) => e.department_id === deptId);
  const [equipmentId, setEquipmentId] = useState(equipment.length === 1 ? String(equipment[0].id) : "");
  const [usage, setUsage] = useState("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const { run } = useRunner();
  const q = useQuery({
    queryKey: ["procurement", "item-links", deptId, equipmentId, usage, page],
    queryFn: () => pmGet<Page<PmItemLink>>("item-links/", { department_id: deptId, equipment_id: equipmentId, usage, page }),
    enabled: !!deptId,
  });
  const managesAll = hasRole("OC_STORES") || hasPerm("masters");
  const mine = new Set([...(boot.oic_equipment_ids ?? []), ...(boot.incharge_equipment_ids ?? [])]);
  const canManage = (eqId: number) => managesAll || mine.has(eqId);
  const refresh = () => qc.invalidateQueries({ queryKey: ["procurement"] });
  return (
    <SectionCard
      title="Equipment items"
      description="Link the consumables, spare parts and accessories each instrument uses. Requests for that equipment can then be filled from this list with live stock, and Stores sees what is running low."
      actions={equipment.some((e) => canManage(e.id)) ? <Button size="sm" onClick={() => setAdding(true)}><Plus className="mr-2 h-4 w-4" />Link item</Button> : undefined}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        <NativeSelect aria-label="Equipment" className="w-64" value={equipmentId} onChange={(e) => { setPage(1); setEquipmentId(e.target.value); }} placeholder="All equipment" options={equipment.map((e) => ({ value: String(e.id), label: e.name }))} />
        <NativeSelect aria-label="Use" className="w-44" value={usage} onChange={(e) => { setPage(1); setUsage(e.target.value); }} placeholder="All uses" options={LINK_USAGES} />
      </div>
      {q.error ? <p className="mb-2 text-sm text-destructive">{errorMessage(q.error)}</p> : null}
      <div className="overflow-x-auto">
        <Table serialStart={pageSerialStart(q.data)}>
          <TableHeader>
            <TableRow>
              <TableHead>Equipment</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Part no.</TableHead>
              <TableHead>Use</TableHead>
              <TableHead className="text-right">Usual qty</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? <LoadingRow colSpan={8} /> : !q.data?.results.length ? <EmptyRow colSpan={8} text="No items linked yet." /> : q.data.results.map((l) => (
              <TableRow key={l.id} className={l.active ? undefined : "opacity-60"}>
                <TableCell>{l.equipment.name}</TableCell>
                <TableCell><span className="font-mono text-xs text-muted-foreground">{l.item.code}</span> {l.item.name}</TableCell>
                <TableCell>{l.item.part_number || "—"}</TableCell>
                <TableCell>{labelOf(LINK_USAGES, l.usage)}</TableCell>
                <TableCell className="text-right tabular-nums">{qty(l.typical_quantity)} {l.item.uom}</TableCell>
                <TableCell className="max-w-xs truncate">{l.notes || "—"}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {canManage(l.equipment.id) ? (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => run(async () => { await pmPatch(`item-links/${l.id}/`, { active: !l.active }); refresh(); }, l.active ? "Link paused." : "Link active.")}>
                        {l.active ? "Pause" : "Activate"}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => run(async () => { await pmRequest(`item-links/${l.id}/`, { method: "DELETE" }); refresh(); }, "Link removed.")}>
                        Remove
                      </Button>
                    </>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {q.data ? <Pager page={q.data.page} count={q.data.count} pageSize={q.data.page_size} onPage={setPage} /> : null}
      {adding ? (
        <LinkDialog
          equipment={equipment.filter((e) => canManage(e.id))}
          defaultEquipment={equipmentId}
          onClose={() => setAdding(false)}
          onSaved={refresh}
        />
      ) : null}
    </SectionCard>
  );
}

function LinkDialog({ equipment, defaultEquipment, onClose, onSaved }: { equipment: { id: number; name: string }[]; defaultEquipment: string; onClose: () => void; onSaved: () => void }) {
  const { deptId } = usePm();
  const items = useQuery({
    queryKey: ["procurement", "items-all", deptId],
    queryFn: () => pmGet<Page<PmItem>>("items/", { department_id: deptId, page_size: 200 }),
    enabled: !!deptId,
  }).data?.results ?? [];
  const [f, setF] = useState({ equipment_id: equipment.some((e) => String(e.id) === defaultEquipment) ? defaultEquipment : "", item_id: "", usage: "CONSUMABLE", typical_quantity: "1", notes: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const { busy, run } = useRunner();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Link an item to equipment</DialogTitle>
          <DialogDescription>Missing an item? Stores / Office add it to the item master first.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Equipment" className="sm:col-span-2">
            <NativeSelect value={f.equipment_id} onChange={set("equipment_id")} placeholder="Choose" options={equipment.map((e) => ({ value: String(e.id), label: e.name }))} />
          </Field>
          <Field label="Item" className="sm:col-span-2">
            <NativeSelect value={f.item_id} onChange={set("item_id")} placeholder="Choose" options={items.map((i) => ({ value: String(i.id), label: `${i.code} · ${i.name} (${i.uom})` }))} />
          </Field>
          <Field label="Use"><NativeSelect value={f.usage} onChange={set("usage")} options={LINK_USAGES} /></Field>
          <Field label="Usual quantity per request"><Input inputMode="decimal" value={f.typical_quantity} onChange={set("typical_quantity")} /></Field>
          <Field label="Notes" className="sm:col-span-2"><Input value={f.notes} onChange={set("notes")} placeholder="e.g. replace every 500 h" /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={busy || !f.equipment_id || !f.item_id}
            onClick={async () => {
              const ok = await run(async () => {
                await pmPost("item-links/", { ...f, equipment_id: Number(f.equipment_id), item_id: Number(f.item_id) });
                onSaved();
              }, "Item linked.");
              if (ok) onClose();
            }}
          >
            Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
