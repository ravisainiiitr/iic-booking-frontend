import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarPlus, ChevronLeft, ChevronRight, Copy, Megaphone, MoreHorizontal, Pencil, Plus, Power, Search, Square } from "lucide-react";
import { toast } from "sonner";
import { PageHero, PageShell, StandaloneOnly } from "@/components/PageShell";
import { RowsPerPageSelect } from "@/components/RowsPerPageSelect";
import { FlashMessageDialog, type FlashDialogMode } from "@/components/flashMessages/FlashMessageDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiClient } from "@/lib/api";
import { formatDMYTime } from "@/lib/dateFormat";
import {
  FLASH_DURATION_PRESETS,
  FLASH_STATUS_LABELS,
  FLASH_STATUS_STYLES,
  FLASH_TONE_STYLES,
  sanitizeFlashHtml,
  type FlashMessageListResponse,
  type FlashMessageOptions,
  type FlashMessageRecord,
  type FlashStatus,
} from "@/lib/flashMessages";
import { cn } from "@/lib/utils";

const ALL = "__all__";
const STATUS_TABS: { key: "" | Lowercase<FlashStatus>; label: string }[] = [
  { key: "", label: "All" },
  { key: "live", label: "Live" },
  { key: "scheduled", label: "Scheduled" },
  { key: "expired", label: "Expired" },
  { key: "off", label: "Off" },
];

export default function EquipmentFlashMessages() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [equipment, setEquipment] = useState(searchParams.get("equipment") ?? "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [data, setData] = useState<FlashMessageListResponse | null>(null);
  const [options, setOptions] = useState<FlashMessageOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [dialog, setDialog] = useState<{ open: boolean; mode: FlashDialogMode }>({ open: false, mode: { kind: "create" } });
  const [busyId, setBusyId] = useState<number | null>(null);
  const optionsLoaded = useRef(false);
  const newHandled = useRef(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch(searchDraft.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchDraft]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient
      .getFlashMessages({
        equipment: equipment || undefined,
        status: statusFilter || undefined,
        search: search || undefined,
        page,
        page_size: pageSize,
        with_options: optionsLoaded.current ? undefined : true,
      })
      .then((res) => {
        if (cancelled) return;
        setLoading(false);
        if (res.error || !res.data) {
          setError(res.error || "Could not load flash messages.");
          return;
        }
        setError(null);
        setData(res.data);
        if (res.data.equipment_options && res.data.limits) {
          optionsLoaded.current = true;
          setOptions({
            equipment_options: res.data.equipment_options,
            tones: res.data.tones ?? [],
            audiences: res.data.audiences ?? [],
            user_types: res.data.user_types ?? [],
            limits: res.data.limits,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [equipment, statusFilter, search, page, pageSize, reloadKey]);

  useEffect(() => {
    if (newHandled.current || !options || searchParams.get("new") !== "1") return;
    newHandled.current = true;
    const id = Number(searchParams.get("equipment"));
    setDialog({ open: true, mode: { kind: "create", equipmentId: Number.isFinite(id) && id > 0 ? id : null } });
    const next = new URLSearchParams(searchParams);
    next.delete("new");
    setSearchParams(next, { replace: true });
  }, [options, searchParams, setSearchParams]);

  const equipmentOptions = useMemo(
    () =>
      (options?.equipment_options ?? []).map((e) => ({ value: String(e.id), label: e.code ? `${e.name} (${e.code})` : e.name })),
    [options],
  );

  const rows = data?.results ?? [];
  const summary = data?.summary;
  const total = data?.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const reload = () => setReloadKey((k) => k + 1);

  const runAction = async (row: FlashMessageRecord, action: "end" | "extend" | "toggle", days?: number) => {
    setBusyId(row.id);
    const res =
      action === "end"
        ? await apiClient.endFlashMessage(row.id)
        : action === "extend"
          ? await apiClient.extendFlashMessage(row.id, days ?? 1)
          : await apiClient.updateFlashMessage(row.id, { is_active: !row.is_active });
    setBusyId(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(
      action === "end" ? "Flash message ended." : action === "extend" ? "Flash message extended." : row.is_active ? "Flash message turned off." : "Flash message turned on.",
    );
    reload();
  };

  const counts: Record<string, number | undefined> = {
    "": summary ? summary.live + summary.scheduled + summary.expired + summary.off : undefined,
    live: summary?.live,
    scheduled: summary?.scheduled,
    expired: summary?.expired,
    off: summary?.off,
  };

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-[1400px] space-y-4 px-3 py-4 sm:px-6">
        <StandaloneOnly>
          <PageHero
            compact
            icon={<Megaphone className="h-5 w-5" />}
            title="Equipment flash messages"
            description="Short, timed messages at the top of an equipment's page and booking page."
          />
        </StandaloneOnly>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Status">
            {STATUS_TABS.map((t) => (
              <button
                key={t.key || "all"}
                type="button"
                role="tab"
                aria-selected={statusFilter === t.key}
                onClick={() => {
                  setStatusFilter(t.key);
                  setPage(1);
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  statusFilter === t.key ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
                )}
              >
                {t.label}
                {counts[t.key] != null ? (
                  <span className={cn("tabular-nums text-xs", statusFilter === t.key ? "opacity-90" : "text-muted-foreground")}>
                    {counts[t.key]}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <Button type="button" onClick={() => setDialog({ open: true, mode: { kind: "create", equipmentId: equipment ? Number(equipment) : null } })} disabled={!options}>
            <Plus className="mr-1.5 h-4 w-4" />
            New flash message
          </Button>
        </div>

        <Card>
          <CardContent className="space-y-3 p-3 sm:p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[14rem] flex-1 sm:max-w-sm">
                <Select
                  value={equipment || ALL}
                  onValueChange={(v) => {
                    setEquipment(v === ALL ? "" : v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger aria-label="Equipment">
                    <SelectValue placeholder="All equipment" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value={ALL}>All equipment</SelectItem>
                    {equipmentOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
                <Input
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  placeholder="Search message or equipment"
                  aria-label="Search"
                  className="pl-8"
                />
              </div>
            </div>

            {error ? (
              <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="min-w-[12rem]">Equipment</TableHead>
                    <TableHead className="min-w-[18rem]">Message</TableHead>
                    <TableHead>Tone</TableHead>
                    <TableHead className="min-w-[11rem]">Schedule</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="min-w-[9rem]">Who sees it</TableHead>
                    <TableHead className="min-w-[9rem]">Updated</TableHead>
                    <TableHead className="w-12 text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!loading && rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                        No flash messages{statusFilter || equipment || search ? " match the filters" : " yet"}.
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {rows.map((r) => {
                    const tone = FLASH_TONE_STYLES[r.tone] ?? FLASH_TONE_STYLES.INFO;
                    const active = r.status === "LIVE" || r.status === "SCHEDULED";
                    return (
                      <TableRow key={r.id} data-testid="flash-row">
                        <TableCell>
                          <div className="font-medium leading-tight">{r.equipment_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.equipment_code}
                            {r.show_on_modes ? " · also on all modes" : ""}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className="flash-text line-clamp-2 text-sm"
                            dangerouslySetInnerHTML={{ __html: sanitizeFlashHtml(r.message) }}
                          />
                          {r.link_url ? <span className="text-xs text-muted-foreground">Link: {r.link_label || "Learn more"}</span> : null}
                        </TableCell>
                        <TableCell>
                          <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold", tone.chip)}>
                            <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} aria-hidden />
                            {r.tone_display}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          <div>{formatDMYTime(r.start_at)}</div>
                          <div className="text-muted-foreground">to {formatDMYTime(r.end_at)}</div>
                        </TableCell>
                        <TableCell>
                          <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold", FLASH_STATUS_STYLES[r.status])}>
                            {FLASH_STATUS_LABELS[r.status] ?? r.status_display}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">{r.audience === "ALL" ? "Everyone" : r.audience_display}</TableCell>
                        <TableCell className="text-xs">
                          <div>{r.updated_by_name || r.created_by_name}</div>
                          <div className="text-muted-foreground">{formatDMYTime(r.updated_at)}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                aria-label={`Actions for flash message on ${r.equipment_name}`}
                                disabled={busyId === r.id}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onSelect={() => setDialog({ open: true, mode: { kind: "edit", record: r } })}>
                                <Pencil className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              {active ? (
                                <DropdownMenuItem onSelect={() => runAction(r, "end")}>
                                  <Square className="mr-2 h-4 w-4" /> End now
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuItem onSelect={() => setDialog({ open: true, mode: { kind: "create", from: r } })}>
                                <Copy className="mr-2 h-4 w-4" /> Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => runAction(r, "toggle")}>
                                <Power className="mr-2 h-4 w-4" /> {r.is_active ? "Turn off" : "Turn on"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Extend by</DropdownMenuLabel>
                              {FLASH_DURATION_PRESETS.map((p) => (
                                <DropdownMenuItem key={p.key} onSelect={() => runAction(r, "extend", p.days)}>
                                  <CalendarPlus className="mr-2 h-4 w-4" /> {p.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{loading ? "Loading…" : `${total} message${total === 1 ? "" : "s"}`}</span>
              <div className="flex items-center gap-3">
                <RowsPerPageSelect
                  value={pageSize}
                  onChange={(n) => {
                    setPageSize(n);
                    setPage(1);
                  }}
                />
                <Button type="button" size="icon" variant="outline" className="h-8 w-8" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="tabular-nums">
                  {page} / {pages}
                </span>
                <Button type="button" size="icon" variant="outline" className="h-8 w-8" aria-label="Next page" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <FlashMessageDialog
        open={dialog.open}
        mode={dialog.mode}
        options={options}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        onSaved={() => {
          setDialog((d) => ({ ...d, open: false }));
          reload();
        }}
      />
    </PageShell>
  );
}
