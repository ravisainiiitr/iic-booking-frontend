import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarClock, Loader2, RefreshCw, Search } from "lucide-react";
import { format, parseISO } from "date-fns";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiClient, type PublicEquipmentAvailability } from "@/lib/api";

const ALL_DEPARTMENTS = "all";
const WINDOW_OPTIONS = [7, 14, 31];

function safeFormat(value: string | null | undefined, pattern: string): string {
  if (!value) return "—";
  try {
    return format(parseISO(value), pattern);
  } catch {
    return "—";
  }
}

/** Public (no login) list of equipment with their next free booking dates. */
export default function EquipmentAvailability() {
  const navigate = useNavigate();
  const [data, setData] = useState<PublicEquipmentAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState(ALL_DEPARTMENTS);
  const [days, setDays] = useState(14);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiClient
      .getPublicEquipmentAvailability({
        days,
        search,
        department: department === ALL_DEPARTMENTS ? undefined : department,
      })
      .then((res) => {
        if (cancelled) return;
        if (res.error || !res.data) {
          setError(res.error || "Could not load equipment availability.");
          return;
        }
        setData(res.data);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load equipment availability.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days, search, department, reloadKey]);

  const rows = data?.equipment ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 rounded-2xl bg-gradient-to-br from-primary via-[hsl(215_62%_22%)] to-slate-950 p-6 text-white shadow-xl shadow-primary/25 sm:p-8">
          <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
            <CalendarClock className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Equipment Availability</h1>
          <p className="mt-2 max-w-2xl text-sm text-white/85 sm:text-base">
            Next available booking dates for all equipment, soonest first. Log in to book a slot.
          </p>
          <p className="mt-3 text-xs text-white/70">
            <Link to="/" className="underline underline-offset-2 hover:text-white">
              Back to home
            </Link>
          </p>
        </div>

        <section className="mb-6 rounded-xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
          <div className="grid gap-4 md:grid-cols-12">
            <div className="space-y-2 md:col-span-5">
              <Label htmlFor="av-search">Search equipment</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="av-search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Name or code"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2 md:col-span-4">
              <Label htmlFor="av-dept">Department</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger id="av-dept">
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_DEPARTMENTS}>All departments</SelectItem>
                  {(data?.departments ?? []).map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="av-days">Look ahead</Label>
              <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
                <SelectTrigger id="av-days">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WINDOW_OPTIONS.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d} days
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end md:col-span-1">
              <Button
                variant="outline"
                size="icon"
                aria-label="Refresh"
                disabled={loading}
                onClick={() => setReloadKey((k) => k + 1)}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border/70 bg-card shadow-sm">
          {loading && !data ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="px-4 py-10 text-center text-sm text-destructive">{error}</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">No equipment matches your filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equipment</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Next available</TableHead>
                    <TableHead>Upcoming free slots</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.equipment_id}>
                      <TableCell>
                        <div className="font-medium">{row.name}</div>
                        <div className="text-xs text-muted-foreground">{row.code}</div>
                      </TableCell>
                      <TableCell className="text-sm">{row.department_name || "—"}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {row.next_available_at ? (
                          <span className="font-medium text-green-700 dark:text-green-400">
                            {safeFormat(row.next_available_at, "EEE, dd MMM · hh:mm a")}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">No free slots in the next {data?.days ?? days} days</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.dates.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {row.dates.map((d) => (
                              <Badge key={d.date} variant="outline" className="whitespace-nowrap font-normal">
                                {safeFormat(d.date, "dd MMM")}
                                <span className="ml-1 font-semibold">
                                  {d.available_slots} slot{d.available_slots !== 1 ? "s" : ""}
                                </span>
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          disabled={!row.next_available_at}
                          onClick={() => navigate(`/book-equipment?equipment_id=${row.equipment_id}`)}
                        >
                          Book
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {data ? (
            <p className="border-t px-4 py-3 text-xs text-muted-foreground">
              Showing {data.count} equipment · availability until {safeFormat(data.until, "dd MMM yyyy")} · updated{" "}
              {safeFormat(data.generated_at, "hh:mm a")}. Slots reserved for home-department users are not shown.
            </p>
          ) : null}
        </section>
      </main>
      <Footer />
    </div>
  );
}
