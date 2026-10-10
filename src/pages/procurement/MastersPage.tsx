import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { pmGet, pmPatch, pmPost, type Page, type PmCategory, type PmGstRate, type PmItem, type PmVendor } from "@/lib/procurementApi";
import { Switch } from "@/components/ui/switch";
import ItemLinksPanel from "./ItemLinksPanel";
import { EmptyRow, Field, humanize, LoadingRow, NativeSelect, pageSerialStart, Pager, ReasonDialog, SectionCard, usePm, useRunner } from "./shared";

const NATURES = ["CONSUMABLE", "NON_CONSUMABLE", "LIMITED_LIFE_ASSET", "MINOR_ASSET", "MAJOR_ASSET", "AMC_SERVICE", "GENERAL_OFFICE"];

export default function MastersPage() {
  return (
    <Tabs defaultValue="vendors">
      <TabsList>
        <TabsTrigger value="vendors">Vendors</TabsTrigger>
        <TabsTrigger value="items">Items</TabsTrigger>
        <TabsTrigger value="categories">Categories</TabsTrigger>
        <TabsTrigger value="gst">GST rates</TabsTrigger>
        <TabsTrigger value="links">Equipment items</TabsTrigger>
      </TabsList>
      <TabsContent value="links"><ItemLinksPanel /></TabsContent>
      <TabsContent value="vendors"><Vendors /></TabsContent>
      <TabsContent value="items"><Items /></TabsContent>
      <TabsContent value="categories"><Categories /></TabsContent>
      <TabsContent value="gst"><GstRates /></TabsContent>
    </Tabs>
  );
}

function SearchBox({ onSearch, placeholder }: { onSearch: (q: string) => void; placeholder: string }) {
  const [term, setTerm] = useState("");
  return (
    <form className="relative mb-3 w-full sm:w-72" onSubmit={(e) => { e.preventDefault(); onSearch(term.trim()); }}>
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input className="pl-8" placeholder={placeholder} value={term} onChange={(e) => setTerm(e.target.value)} />
    </form>
  );
}

function Vendors() {
  const { deptId } = usePm();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<PmVendor | "new" | null>(null);
  const [archiving, setArchiving] = useState<PmVendor | null>(null);
  const { run } = useRunner();
  const q = useQuery({
    queryKey: ["procurement", "vendors", deptId, page, search],
    queryFn: () => pmGet<Page<PmVendor>>("vendors/", { department_id: deptId, page, q: search, include_inactive: 1 }),
    enabled: !!deptId,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["procurement"] });
  return (
    <SectionCard title="Vendors" description="GSTIN is checksum-validated and PAN is derived from it." actions={<Button size="sm" onClick={() => setEditing("new")}><Plus className="mr-2 h-4 w-4" />Add vendor</Button>}>
      <SearchBox placeholder="Name, code, GSTIN or contact" onSearch={(s) => { setPage(1); setSearch(s); }} />
      <div className="overflow-x-auto">
        <Table serialStart={pageSerialStart(q.data)}>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>GSTIN</TableHead>
              <TableHead>State</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Active</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? <LoadingRow colSpan={7} /> : !q.data?.results.length ? <EmptyRow colSpan={7} /> : q.data.results.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-mono text-xs">{v.code}</TableCell>
                <TableCell>{v.name}</TableCell>
                <TableCell className="font-mono text-xs">{v.gstin || "—"}</TableCell>
                <TableCell>{v.state || "—"}</TableCell>
                <TableCell className="text-xs">{[v.phone, v.email].filter(Boolean).join(" · ") || "—"}</TableCell>
                <TableCell>{v.active ? "Yes" : "No"}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(v)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => setArchiving(v)}>Archive</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {q.data ? <Pager page={q.data.page} count={q.data.count} pageSize={q.data.page_size} onPage={setPage} /> : null}
      <VendorDialog vendor={editing} onClose={() => setEditing(null)} onSaved={refresh} />
      <ReasonDialog
        open={!!archiving}
        onOpenChange={(o) => !o && setArchiving(null)}
        title={`Archive ${archiving?.name ?? "vendor"}`}
        description="Archived vendors stay on past records but cannot be chosen for new ones."
        destructive
        confirmLabel="Archive"
        onConfirm={(reason) => run(async () => { await pmPost(`vendors/${archiving!.id}/archive/`, { reason }); refresh(); }, "Vendor archived.")}
      />
    </SectionCard>
  );
}

function VendorDialog({ vendor, onClose, onSaved }: { vendor: PmVendor | "new" | null; onClose: () => void; onSaved: () => void }) {
  const { deptId } = usePm();
  const blank = { name: "", gstin: "", pan: "", state: "", contact_person: "", phone: "", email: "", address: "", active: "true" };
  const [f, setF] = useState(blank);
  const [loaded, setLoaded] = useState<PmVendor | "new" | null>(null);
  if (vendor !== loaded) {
    setLoaded(vendor);
    setF(vendor && vendor !== "new" ? { ...blank, ...Object.fromEntries(Object.entries(vendor).filter(([k]) => k in blank).map(([k, v]) => [k, String(v ?? "")])) } : blank);
  }
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const { busy, run } = useRunner();
  return (
    <Dialog open={!!vendor} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{vendor === "new" ? "Add vendor" : "Edit vendor"}</DialogTitle>
          <DialogDescription>Changes are audited.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" className="sm:col-span-2"><Input value={f.name} onChange={set("name")} /></Field>
          <Field label="GSTIN (optional)"><Input value={f.gstin} onChange={set("gstin")} className="font-mono uppercase" maxLength={15} /></Field>
          <Field label="PAN (optional)"><Input value={f.pan} onChange={set("pan")} className="font-mono uppercase" maxLength={10} /></Field>
          <Field label="State"><Input value={f.state} onChange={set("state")} /></Field>
          <Field label="Contact person"><Input value={f.contact_person} onChange={set("contact_person")} /></Field>
          <Field label="Phone"><Input value={f.phone} onChange={set("phone")} /></Field>
          <Field label="Email"><Input type="email" value={f.email} onChange={set("email")} /></Field>
          <Field label="Address" className="sm:col-span-2"><Input value={f.address} onChange={set("address")} /></Field>
          <Field label="Active"><NativeSelect value={f.active} onChange={set("active")} options={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={busy || !f.name.trim()}
            onClick={async () => {
              const body = { ...f, active: f.active === "true", department_id: deptId };
              const ok = await run(async () => {
                if (vendor === "new") await pmPost("vendors/", body);
                else await pmPatch(`vendors/${(vendor as PmVendor).id}/`, body);
                onSaved();
              }, "Vendor saved.");
              if (ok) onClose();
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Items() {
  const { deptId } = usePm();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const q = useQuery({
    queryKey: ["procurement", "items", deptId, page, search],
    queryFn: () => pmGet<Page<PmItem & { default_gst_rate: string | null }>>("items/", { department_id: deptId, page, q: search }),
    enabled: !!deptId,
  });
  return (
    <SectionCard title="Items" description="Department item master used by requests, bills and the stock ledger." actions={<Button size="sm" onClick={() => setAdding(true)}><Plus className="mr-2 h-4 w-4" />Add item</Button>}>
      <SearchBox placeholder="Name, code, HSN or specification" onSearch={(s) => { setPage(1); setSearch(s); }} />
      <div className="overflow-x-auto">
        <Table serialStart={pageSerialStart(q.data)}>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>HSN / SAC</TableHead>
              <TableHead>GST</TableHead>
              <TableHead>Part no.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? <LoadingRow colSpan={8} /> : !q.data?.results.length ? <EmptyRow colSpan={8} /> : q.data.results.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-mono text-xs">{i.code}</TableCell>
                <TableCell>{i.name}</TableCell>
                <TableCell>{i.category?.name ?? "—"}</TableCell>
                <TableCell>{i.uom}</TableCell>
                <TableCell>{i.hsn_sac || "—"}</TableCell>
                <TableCell>{i.default_gst_rate ? `${Number(i.default_gst_rate)}%` : "—"}</TableCell>
                <TableCell>{i.part_number || "—"}{i.tracks_batch ? <span className="ml-1 text-xs text-muted-foreground">(batch)</span> : null}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {q.data ? <Pager page={q.data.page} count={q.data.count} pageSize={q.data.page_size} onPage={setPage} /> : null}
      <ItemDialog open={adding} onOpenChange={setAdding} onSaved={() => qc.invalidateQueries({ queryKey: ["procurement"] })} />
    </SectionCard>
  );
}

function ItemDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const { deptId } = usePm();
  const cats = useQuery({ queryKey: ["procurement", "categories", deptId], queryFn: () => pmGet<{ results: PmCategory[] }>("categories/", { department_id: deptId }), enabled: open && !!deptId }).data?.results ?? [];
  const gst = useQuery({ queryKey: ["procurement", "gst", deptId], queryFn: () => pmGet<{ results: PmGstRate[] }>("gst-rates/", { department_id: deptId }), enabled: open && !!deptId }).data?.results ?? [];
  const blank = { name: "", category_id: "", uom: "Nos", hsn_sac: "", default_gst_rate_id: "", specification: "", min_level: "", reorder_level: "", part_number: "" };
  const [f, setF] = useState(blank);
  const [tracksBatch, setTracksBatch] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const { busy, run } = useRunner();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add item</DialogTitle>
          <DialogDescription>Codes are generated automatically.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" className="sm:col-span-2"><Input value={f.name} onChange={set("name")} /></Field>
          <Field label="Category"><NativeSelect value={f.category_id} onChange={set("category_id")} placeholder="Choose" options={cats.map((c) => ({ value: String(c.id), label: c.name }))} /></Field>
          <Field label="Unit"><Input value={f.uom} onChange={set("uom")} /></Field>
          <Field label="HSN / SAC (optional)"><Input value={f.hsn_sac} onChange={set("hsn_sac")} inputMode="numeric" maxLength={8} /></Field>
          <Field label="Default GST"><NativeSelect value={f.default_gst_rate_id} onChange={set("default_gst_rate_id")} placeholder="—" options={gst.map((g) => ({ value: String(g.id), label: `${g.name} (${Number(g.rate)}%)` }))} /></Field>
          <Field label="Minimum stock level (optional)"><Input inputMode="decimal" value={f.min_level} onChange={set("min_level")} /></Field>
          <Field label="Reorder level (optional)"><Input inputMode="decimal" value={f.reorder_level} onChange={set("reorder_level")} /></Field>
          <Field label="Specification (optional)" className="sm:col-span-2"><Input value={f.specification} onChange={set("specification")} /></Field>
          <Field label="Manufacturer part no. (optional)"><Input value={f.part_number} onChange={set("part_number")} /></Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <Switch checked={tracksBatch} onCheckedChange={setTracksBatch} />
            Track batch / lot and expiry
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={busy || !f.name.trim() || !f.category_id}
            onClick={async () => {
              const ok = await run(async () => {
                await pmPost("items/", { ...f, tracks_batch: tracksBatch, department_id: deptId, category_id: Number(f.category_id), default_gst_rate_id: f.default_gst_rate_id || null });
                onSaved();
              }, "Item added.");
              if (ok) {
                setF(blank);
                setTracksBatch(false);
                onOpenChange(false);
              }
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Categories() {
  const { deptId } = usePm();
  const qc = useQueryClient();
  const { busy, run } = useRunner();
  const [adding, setAdding] = useState(false);
  const q = useQuery({
    queryKey: ["procurement", "categories-admin", deptId],
    queryFn: () => pmGet<{ results: (PmCategory & { approval_exempt: boolean; hod_required_always: boolean })[] }>("categories/", { department_id: deptId, include_inactive: 1 }),
    enabled: !!deptId,
  });
  const toggle = (id: number, field: string, value: boolean) =>
    run(async () => { await pmPatch(`categories/${id}/`, { [field]: value }); qc.invalidateQueries({ queryKey: ["procurement"] }); }, "Category updated.");
  const flags = ["is_asset", "tracks_stock", "small_purchase_allowed", "approval_exempt", "hod_required_always", "active"] as const;
  return (
    <SectionCard title="Item categories" description="Category flags drive asset entry, stock tracking and the small-purchase rule." actions={<Button size="sm" onClick={() => setAdding(true)}><Plus className="mr-2 h-4 w-4" />Add category</Button>}>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Nature</TableHead>
              {flags.map((f) => <TableHead key={f} className="text-center">{humanize(f)}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading ? <LoadingRow colSpan={9} /> : !q.data?.results.length ? <EmptyRow colSpan={9} /> : q.data.results.map((cat) => (
              <TableRow key={cat.id}>
                <TableCell className="font-mono text-xs">{cat.code}</TableCell>
                <TableCell>{cat.name}</TableCell>
                <TableCell>{humanize(cat.nature)}</TableCell>
                {flags.map((f) => (
                  <TableCell key={f} className="text-center">
                    <input type="checkbox" aria-label={`${cat.name} ${humanize(f)}`} checked={!!cat[f]} disabled={busy} onChange={(e) => toggle(cat.id, f, e.target.checked)} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <SimpleCreateDialog
        open={adding}
        onOpenChange={setAdding}
        title="Add category"
        fields={[{ key: "code", label: "Code" }, { key: "name", label: "Name" }, { key: "nature", label: "Nature", options: NATURES }]}
        onSave={(body) => run(async () => { await pmPost("categories/", { ...body, department_id: deptId }); qc.invalidateQueries({ queryKey: ["procurement"] }); }, "Category added.")}
      />
    </SectionCard>
  );
}

function GstRates() {
  const { deptId } = usePm();
  const qc = useQueryClient();
  const { run } = useRunner();
  const [adding, setAdding] = useState(false);
  const q = useQuery({
    queryKey: ["procurement", "gst-admin", deptId],
    queryFn: () => pmGet<{ results: PmGstRate[] }>("gst-rates/", { department_id: deptId, include_inactive: 1 }),
    enabled: !!deptId,
  });
  return (
    <SectionCard title="GST rates" description="CGST/SGST are half the rate each; IGST equals the rate." actions={<Button size="sm" onClick={() => setAdding(true)}><Plus className="mr-2 h-4 w-4" />Add rate</Button>}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="text-right">Rate</TableHead>
            <TableHead className="text-right">CGST</TableHead>
            <TableHead className="text-right">SGST</TableHead>
            <TableHead className="text-right">IGST</TableHead>
            <TableHead>Active</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {q.isLoading ? <LoadingRow colSpan={6} /> : !q.data?.results.length ? <EmptyRow colSpan={6} /> : q.data.results.map((g) => (
            <TableRow key={g.id}>
              <TableCell>{g.name}</TableCell>
              <TableCell className="text-right">{Number(g.rate)}%</TableCell>
              <TableCell className="text-right">{Number(g.cgst_rate)}%</TableCell>
              <TableCell className="text-right">{Number(g.sgst_rate)}%</TableCell>
              <TableCell className="text-right">{Number(g.igst_rate)}%</TableCell>
              <TableCell>{g.active ? "Yes" : "No"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <SimpleCreateDialog
        open={adding}
        onOpenChange={setAdding}
        title="Add GST rate"
        fields={[{ key: "name", label: "Name" }, { key: "rate", label: "Rate (%)" }]}
        onSave={(body) => run(async () => { await pmPost("gst-rates/", { ...body, department_id: deptId }); qc.invalidateQueries({ queryKey: ["procurement"] }); }, "Rate added.")}
      />
    </SectionCard>
  );
}

function SimpleCreateDialog({
  open,
  onOpenChange,
  title,
  fields,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  fields: { key: string; label: string; options?: string[] }[];
  onSave: (body: Record<string, string>) => Promise<boolean>;
}) {
  const [f, setF] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Changes are audited.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {fields.map((fd) => (
            <Field key={fd.key} label={fd.label}>
              {fd.options ? (
                <NativeSelect value={f[fd.key] ?? ""} onChange={(e) => setF({ ...f, [fd.key]: e.target.value })} placeholder="Choose" options={fd.options.map((o) => ({ value: o, label: humanize(o) }))} />
              ) : (
                <Input value={f[fd.key] ?? ""} onChange={(e) => setF({ ...f, [fd.key]: e.target.value })} />
              )}
            </Field>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={busy || fields.some((fd) => !(f[fd.key] ?? "").trim())}
            onClick={async () => {
              setBusy(true);
              const ok = await onSave(f);
              setBusy(false);
              if (ok) {
                setF({});
                onOpenChange(false);
              }
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
