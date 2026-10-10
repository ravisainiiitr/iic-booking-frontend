import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { pmDownload, pmForm, type PmImportPreview, type PmImportResult, type PmImportRow } from "@/lib/procurementApi";
import { EmptyRow, NativeSelect, SectionCard, Stat, StatusBadge, usePm, useRunner } from "./shared";

const STEPS = ["Template", "Upload", "Check", "Import"] as const;

const STATUS_TONE: Record<PmImportRow["status"], string> = {
  OK: "COMPLETED",
  WARNING: "PENDING",
  ERROR: "REJECTED",
  DUPLICATE: "FLAGGED",
};

/** Rows the server would import: OK and WARNING (errors / duplicates only with "skip"). */
export function importableCount(p: PmImportPreview | null): number {
  return p ? p.counts.OK + p.counts.WARNING : 0;
}

export function Stepper({ step, steps }: { step: number; steps: readonly string[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Steps">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2" aria-current={i === step ? "step" : undefined}>
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold",
              i < step && "border-emerald-500 bg-emerald-500 text-white",
              i === step && "border-primary bg-primary text-primary-foreground",
              i > step && "text-muted-foreground",
            )}
          >
            {i < step ? <Check className="h-4 w-4" /> : i + 1}
          </span>
          <span className={cn(i === step ? "font-medium" : "text-muted-foreground")}>{s}</span>
          {i < steps.length - 1 ? <span className="mx-1 h-px w-6 bg-border" aria-hidden /> : null}
        </li>
      ))}
    </ol>
  );
}

export default function RegisterImport() {
  const { deptId, hasPerm } = usePm();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [createRegisters, setCreateRegisters] = useState(true);
  const [skipErrors, setSkipErrors] = useState(false);
  const [preview, setPreview] = useState<PmImportPreview | null>(null);
  const [result, setResult] = useState<PmImportResult | null>(null);
  const [filter, setFilter] = useState("");
  const { busy, run } = useRunner();

  const form = (extra: Record<string, string> = {}) => {
    const fd = new FormData();
    if (file) fd.append("file", file);
    fd.append("department_id", String(deptId ?? ""));
    fd.append("create_registers", createRegisters ? "true" : "false");
    for (const [k, v] of Object.entries(extra)) fd.append(k, v);
    return fd;
  };
  const check = () =>
    run(async () => {
      setPreview(await pmForm<PmImportPreview>("assets/import/preview/", form()));
      setStep(2);
    });
  const commit = () =>
    run(async () => {
      setResult(await pmForm<PmImportResult>("assets/import/commit/", form({ skip_errors: skipErrors ? "true" : "false" })));
      qc.invalidateQueries({ queryKey: ["procurement"] });
      setStep(3);
    }, "Import finished.");
  const restart = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setSkipErrors(false);
    setStep(1);
  };
  const rows = useMemo(() => (preview?.rows ?? []).filter((r) => !filter || r.status === filter), [preview, filter]);
  const problems = preview ? preview.counts.ERROR + preview.counts.DUPLICATE : 0;

  if (!hasPerm("assets")) {
    return <p className="text-sm text-muted-foreground">Importing registers needs the asset permission.</p>;
  }
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link to="/procurement/registers"><ArrowLeft className="mr-2 h-4 w-4" />Register books</Link>
      </Button>
      <SectionCard
        title="Import an existing Major / Minor register"
        description="Copy each line of your physical register into the template (one row per asset), check it here, then import. Nothing is saved until the last step."
      >
        <Stepper step={step} steps={STEPS} />
      </SectionCard>

      {step === 0 ? (
        <SectionCard title="1. Download the template">
          <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Required columns: <b>Register Code, Register Type (MAJOR / MINOR / LIMITED_LIFE), Page No, Serial No, Description</b>.</li>
            <li>The same register, page and serial cannot appear twice — repeated rows are flagged as duplicates.</li>
            <li>Link an asset to an instrument with <b>Equipment Code</b>; enter accessories with <b>Parent Asset Tag</b>.</li>
            <li>Dates as DD-MM-YYYY or YYYY-MM-DD; amounts in rupees without commas. Up to 5,000 rows per file.</li>
            <li>The Instructions sheet in the Excel template lists every column and allowed value.</li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy} onClick={() => run(() => pmDownload("assets/import/template/", { type: "xlsx" }, "asset-register-template.xlsx"))}>
              <Download className="mr-2 h-4 w-4" />Excel template
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => run(() => pmDownload("assets/import/template/", { type: "csv" }, "asset-register-template.csv"))}>
              <Download className="mr-2 h-4 w-4" />CSV template
            </Button>
            <Button onClick={() => setStep(1)}>I have my file ready</Button>
          </div>
        </SectionCard>
      ) : null}

      {step === 1 ? (
        <SectionCard title="2. Upload the filled file">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={() => fileRef.current?.click()}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                {file ? "Choose another file" : "Choose .xlsx or .csv"}
              </Button>
              {file ? <span className="text-sm">{file.name} <span className="text-muted-foreground">({Math.ceil(file.size / 1024)} KB)</span></span> : null}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={createRegisters} onCheckedChange={setCreateRegisters} />
              Create register books that do not exist yet (from Register Code / Type)
            </label>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
              <Button disabled={!file || busy} onClick={check}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Check file
              </Button>
            </div>
          </div>
        </SectionCard>
      ) : null}

      {step === 2 && preview ? (
        <SectionCard
          title="3. Check the rows"
          description="Fix errors in the file and check again, or import only the good rows."
          actions={
            <NativeSelect
              aria-label="Show rows"
              className="h-9 w-44"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={`All rows (${preview.total})`}
              options={(["OK", "WARNING", "ERROR", "DUPLICATE"] as const).map((s) => ({ value: s, label: `${s === "OK" ? "Ready" : s.charAt(0) + s.slice(1).toLowerCase()} (${preview.counts[s]})` }))}
            />
          }
        >
          <div className="mb-4 grid gap-3 sm:grid-cols-4">
            <Stat label="Ready" value={preview.counts.OK} />
            <Stat label="With warnings" value={preview.counts.WARNING} tone={preview.counts.WARNING ? "warn" : undefined} hint="Imported as is" />
            <Stat label="Errors" value={preview.counts.ERROR} tone={preview.counts.ERROR ? "bad" : undefined} />
            <Stat label="Duplicates" value={preview.counts.DUPLICATE} tone={preview.counts.DUPLICATE ? "bad" : undefined} hint="Same register / page / serial" />
          </div>
          {preview.new_registers.length ? (
            <p className="mb-3 text-sm">
              New register books {createRegisters ? "to be created" : "not found (turn on “create register books” or create them first)"}: <b>{preview.new_registers.join(", ")}</b>
            </p>
          ) : null}
          <div className="max-h-[28rem] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Row</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Register · page · serial</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Equipment</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Messages</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!rows.length ? <EmptyRow colSpan={7} text="No rows." /> : rows.map((r) => (
                  <TableRow key={r.row}>
                    <TableCell className="tabular-nums">{r.row}</TableCell>
                    <TableCell><StatusBadge status={STATUS_TONE[r.status]} label={r.status === "OK" ? "Ready" : r.status.charAt(0) + r.status.slice(1).toLowerCase()} /></TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-xs">{r.register_ref}</TableCell>
                    <TableCell className="max-w-xs truncate">{r.description}</TableCell>
                    <TableCell>{r.equipment_code || "—"}</TableCell>
                    <TableCell className="tabular-nums">{r.cost || "—"}</TableCell>
                    <TableCell className="max-w-md text-left text-xs">
                      {r.errors.map((m, i) => <div key={`e${i}`} className="text-destructive">{m}</div>)}
                      {r.warnings.map((m, i) => <div key={`w${i}`} className="text-amber-700">{m}</div>)}
                      {r.duplicate_of?.asset_id ? (
                        <Link className="text-primary underline" to={`/procurement/assets/${r.duplicate_of.asset_id}`}>Open {r.duplicate_of.asset_number}</Link>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={restart}>Upload a corrected file</Button>
            {problems ? (
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={skipErrors} onCheckedChange={setSkipErrors} />
                Skip the {problems} row(s) with errors or duplicates
              </label>
            ) : null}
            <Button disabled={busy || !importableCount(preview) || (problems > 0 && !skipErrors)} onClick={commit}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Import {importableCount(preview)} asset(s)
            </Button>
          </div>
        </SectionCard>
      ) : null}

      {step === 3 && result ? (
        <SectionCard title="4. Done">
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Stat label="Assets created" value={result.created} />
            <Stat label="Rows skipped" value={result.skipped} tone={result.skipped ? "warn" : undefined} />
            <Stat label="Register books created" value={result.registers_created.length} hint={result.registers_created.join(", ") || undefined} />
          </div>
          {result.skipped_rows.length ? (
            <ul className="mb-4 space-y-1 text-sm">
              {result.skipped_rows.map((r) => (
                <li key={r.row}>Row {r.row} ({r.register_ref}): {[...r.errors, r.duplicate_of ? "duplicate" : ""].filter(Boolean).join("; ")}</li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button asChild><Link to="/procurement/registers">Open register books</Link></Button>
            <Button variant="outline" onClick={restart}>Import another file</Button>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
