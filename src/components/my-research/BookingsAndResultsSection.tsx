import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarCheck, ChevronDown, FlaskConical, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";
import type { ResearchMyBooking } from "@/lib/myResearchTypes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BookingResultsBadge } from "./BookingResults";
import { FilterChips, InlineError, ListSkeleton, SectionHeader } from "./researchUi";
import { formatDate } from "./researchUtils";

const LIMIT = 8;
const SMALL_BUTTON = "h-10 sm:h-8";

type Mode = "recent" | "unfiled";

interface Props {
  /** The user's own active projects, offered by "Add to project". */
  projects: Array<{ id: string; name: string }>;
  onLinked?: () => void;
}

/** Recent bookings with their results status and project, so results can be filed without leaving My Research. */
export function BookingsAndResultsSection({ projects, onLinked }: Props) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("recent");
  const [rows, setRows] = useState<ResearchMyBooking[] | null>(null);
  const [unfiledCount, setUnfiledCount] = useState(0);
  const [error, setError] = useState(false);
  const [linking, setLinking] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(false);
    const res = await apiClient.listMyResearchBookings({ unfiled: mode === "unfiled", limit: LIMIT });
    if (res.error || !res.data) {
      setError(true);
      return;
    }
    setRows(res.data.results);
    setUnfiledCount(res.data.unfiled_count);
  }, [mode]);

  useEffect(() => {
    void load();
  }, [load]);

  const addToProject = async (booking: ResearchMyBooking, project: { id: string; name: string }) => {
    setLinking(booking.booking_id);
    const res = await apiClient.linkResearchBookings(project.id, [booking.booking_id]);
    setLinking(null);
    if (res.error || !res.data) {
      toast.error(res.error || "Could not add the booking to the project.");
      return;
    }
    if (res.data.rejected.includes(booking.booking_id)) {
      toast.error("This booking cannot be added to a project.");
      return;
    }
    toast.success(`Added to ${project.name}`);
    void load();
    onLinked?.();
  };

  if (rows && rows.length === 0 && mode === "recent" && !error) return null;

  const filterOptions: { value: Mode; label: string; count?: number }[] = [
    { value: "recent", label: "Recent" },
    { value: "unfiled", label: "Not in a project", count: unfiledCount },
  ];

  return (
    <section className="space-y-3" aria-labelledby="bookings-results-heading">
      <SectionHeader
        id="bookings-results-heading"
        icon={CalendarCheck}
        title="Bookings & results"
        description="Your recent bookings, whether results are ready, and the project each one is in."
        action={
          <Button variant="ghost" size="sm" className={`text-primary dark:text-sky-300 ${SMALL_BUTTON}`} onClick={() => navigate("/my-bookings")}>
            All bookings
          </Button>
        }
      />
      {unfiledCount > 0 || mode === "unfiled" ? (
        <FilterChips<Mode> label="Filter bookings" value={mode} onChange={setMode} options={filterOptions} />
      ) : null}
      {error ? (
        <InlineError message="Unable to load your bookings." onRetry={() => void load()} />
      ) : rows == null ? (
        <ListSkeleton rows={3} />
      ) : rows.length === 0 ? (
        <p className="rounded-lg border bg-card px-4 py-2 text-sm text-muted-foreground">Every completed booking is already in a project.</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card" aria-label="Bookings">
          {rows.map((b) => {
            const resultsReady = Boolean(b.results.can_view && b.results.has_results && !b.results.locked_code);
            const available = projects.filter((p) => !b.projects.some((bp) => bp.id === p.id));
            return (
              <li key={b.booking_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0 flex-1 basis-56">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">{b.equipment_name}</span>
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
                      {b.status_display}
                    </Badge>
                    <BookingResultsBadge results={b.results} />
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {b.display_id} · {formatDate(b.completed_at ?? b.booking_date)}
                  </p>
                  {b.projects.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {b.projects.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          className="inline-flex min-h-8 items-center gap-1 rounded-full border bg-muted/40 px-2 text-[11px] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-0 sm:py-0.5"
                          onClick={() => navigate(`/my-research/${p.id}?tab=bookings`)}
                          aria-label={`Open project ${p.name}`}
                        >
                          <FlaskConical className="h-3 w-3" aria-hidden /> {p.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {available.length > 0 && b.projects.length === 0 ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline" className={`gap-1.5 ${SMALL_BUTTON}`} disabled={linking === b.booking_id}>
                          {linking === b.booking_id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
                          Add to project <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="max-w-[min(20rem,calc(100vw-2rem))]">
                        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Add {b.display_id} to</DropdownMenuLabel>
                        {available.map((p) => (
                          <DropdownMenuItem key={p.id} onClick={() => void addToProject(b, p)}>
                            <span className="truncate">{p.name}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                  <Button
                    size="sm"
                    variant={resultsReady ? "default" : "ghost"}
                    className={SMALL_BUTTON}
                    onClick={() => navigate(`/my-bookings?booking=${encodeURIComponent(b.display_id || String(b.booking_id))}`)}
                    aria-label={`${resultsReady ? "View results of" : "Open"} booking ${b.display_id}`}
                  >
                    {resultsReady ? "View results" : "Open"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
