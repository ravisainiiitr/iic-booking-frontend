import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Award, ClipboardList, GraduationCap, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RequestTrainingDialog } from "@/components/training/AuthorisationGateCard";
import { CertificateDialog } from "@/components/training/CertificateDialog";
import { AwardsTable } from "@/components/training/CertificationsTable";
import { formatDate, formatDateTime, formatWindow } from "@/components/training/trainingHelpers";
import {
  EmptyState,
  LoadingBlock,
  ModuleUnavailable,
  SectionCard,
  StatusChip,
  TrainingPageFrame,
  runTrainingAction,
} from "@/components/training/trainingUi";
import { useTrainingAvailability } from "@/components/training/useTrainingAvailability";
import { trainingApi } from "@/lib/trainingApi";
import type { AuthorisationRequest, MyAuthorisationEquipment, MyAuthorisations as MyAuthorisationsData } from "@/lib/trainingAuthTypes";

function EquipmentRow({ row, onRequest }: { row: MyAuthorisationEquipment; onRequest: (row: MyAuthorisationEquipment) => void }) {
  const req = row.open_request;
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <Link to={`/equipment/${row.equipment.equipment_id}`} className="hover:underline">
            {row.equipment.name}
          </Link>
          <span className="text-xs text-muted-foreground">{row.equipment.code}</span>
          <StatusChip kind="authorisation" status={row.status} label={row.status_label} />
        </p>
        <p className="text-xs text-muted-foreground">
          {row.valid_until && (row.status === "AUTHORISED" || row.status === "EXPIRING")
            ? `${row.level_name} · valid until ${formatDate(row.valid_until)}`
            : row.message || `Needs ${row.level_name}`}
        </p>
        {req ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Request {req.reference}: {req.status_label}
            {req.status === "SCHEDULED" && req.scheduled_start
              ? ` · ${formatWindow(req.scheduled_start, req.scheduled_end)}${req.location ? ` at ${req.location}` : ""}`
              : ""}
          </p>
        ) : null}
      </div>
      {row.can_request ? (
        <Button type="button" size="sm" variant={row.allowed ? "outline" : "default"} onClick={() => onRequest(row)} className="shrink-0 gap-1.5">
          <GraduationCap className="h-4 w-4" aria-hidden />
          {row.status === "EXPIRING" || row.status === "EXPIRED" ? "Request refresher" : "Request training"}
        </Button>
      ) : null}
    </li>
  );
}

function RequestsTable({ rows, onChanged }: { rows: AuthorisationRequest[]; onChanged: () => void }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Request</TableHead>
          <TableHead>Equipment</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Details</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="whitespace-nowrap text-sm">
              {r.reference}
              <div className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}</div>
            </TableCell>
            <TableCell className="text-sm">{r.equipment.name}</TableCell>
            <TableCell>
              <StatusChip kind="authRequest" status={r.status} label={r.status_label} />
            </TableCell>
            <TableCell className="max-w-xs text-xs text-muted-foreground">
              {r.status === "SCHEDULED" && r.scheduled_start
                ? `${formatWindow(r.scheduled_start, r.scheduled_end)}${r.location ? ` at ${r.location}` : ""}`
                : r.status === "REJECTED"
                  ? r.decision_reason
                  : r.staff_note || r.message || "—"}
            </TableCell>
            <TableCell className="text-right">
              {r.can_withdraw ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const res = await runTrainingAction(trainingApi.authorisationRequestAction(r.id, "withdraw"), "Request withdrawn");
                    if (!res.error) onChanged();
                  }}
                >
                  Withdraw
                </Button>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function SupervisorSection({ data }: { data: NonNullable<MyAuthorisationsData["supervisor"]> }) {
  if (!data.equipment.length) return null;
  return (
    <SectionCard
      title="Your students"
      description="Authorisation status of your research group on equipment that needs it."
      icon={<Users className="h-4 w-4" />}
      bodyClassName="p-0 overflow-x-auto"
    >
      {!data.students.length ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">No students linked to you yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              {data.equipment.map((e) => (
                <TableHead key={e.equipment_id} className="whitespace-nowrap">
                  {e.name}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.students.map((s) => (
              <TableRow key={s.student.id}>
                <TableCell className="whitespace-nowrap text-sm">
                  {s.student.name}
                  {s.student.department ? <div className="text-xs text-muted-foreground">{s.student.department}</div> : null}
                </TableCell>
                {s.equipment.map((c) => (
                  <TableCell key={c.equipment_id}>
                    {c.required ? (
                      <div className="space-y-0.5">
                        <StatusChip kind="authorisation" status={c.status} label={c.status_label} />
                        {c.valid_until && (c.status === "AUTHORISED" || c.status === "EXPIRING") ? (
                          <div className="text-[11px] text-muted-foreground">until {formatDate(c.valid_until)}</div>
                        ) : null}
                        {c.open_request ? <div className="text-[11px] text-muted-foreground">Request {c.open_request.status_label.toLowerCase()}</div> : null}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not needed</span>
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  );
}

export default function MyAuthorisations() {
  const { loading: bootLoading, menu } = useTrainingAvailability();
  const allowed = menu("my_authorisations");
  const [data, setData] = useState<MyAuthorisationsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [requestFor, setRequestFor] = useState<MyAuthorisationEquipment | null>(null);
  const [openAward, setOpenAward] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await trainingApi.myAuthorisations();
    setLoading(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setData(res.data ?? null);
  }, []);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  const blocked = (data?.equipment ?? []).filter((r) => !r.allowed).length;

  return (
    <TrainingPageFrame
      title="My authorisations"
      description="Equipment you must be trained on before booking, your status and your training requests."
      icon={<ShieldCheck className="h-5 w-5" />}
      onRefresh={allowed ? () => void load() : undefined}
      refreshing={loading}
    >
      {bootLoading ? (
        <LoadingBlock />
      ) : !allowed ? (
        <ModuleUnavailable />
      ) : loading && !data ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-4">
          <SectionCard
            title="Equipment that needs authorisation"
            description={
              blocked
                ? `You need training before you can book ${blocked} of these.`
                : data?.equipment?.length
                  ? "You may book all of these; renew before the expiry date."
                  : "Equipment that needs a training certificate appears here."
            }
            icon={<ShieldCheck className="h-4 w-4" />}
            bodyClassName="p-0"
          >
            {!data?.equipment.length ? (
              <EmptyState
                className="m-4"
                icon={<ShieldCheck className="h-8 w-8" />}
                title="Nothing needs authorisation"
                description="You can book every equipment open to you without a training certificate."
              />
            ) : (
              <ul className="divide-y divide-border/60">
                {data.equipment.map((row) => (
                  <EquipmentRow key={row.equipment.equipment_id} row={row} onRequest={setRequestFor} />
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Training requests" icon={<ClipboardList className="h-4 w-4" />} bodyClassName="p-0 overflow-x-auto">
            {!data?.requests.length ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">No training requests yet.</p>
            ) : (
              <RequestsTable rows={data.requests} onChanged={() => void load()} />
            )}
          </SectionCard>

          {data?.certifications.length ? (
            <SectionCard title="Certificates" icon={<Award className="h-4 w-4" />} bodyClassName="p-0">
              <AwardsTable awards={data.certifications} showUser={false} onOpen={(a) => setOpenAward(a.id)} />
            </SectionCard>
          ) : null}

          {data?.supervisor ? <SupervisorSection data={data.supervisor} /> : null}

          {requestFor ? (
            <RequestTrainingDialog
              open
              onOpenChange={(v) => !v && setRequestFor(null)}
              equipmentId={requestFor.equipment.equipment_id}
              equipmentName={requestFor.equipment.name}
              reasonRequired={requestFor.status === "SUSPENDED" || requestFor.status === "REVOKED"}
              onDone={() => void load()}
            />
          ) : null}
          <CertificateDialog awardId={openAward} open={openAward !== null} onOpenChange={(v) => !v && setOpenAward(null)} onChanged={() => void load()} />
        </div>
      )}
    </TrainingPageFrame>
  );
}
