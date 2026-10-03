import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import { apiClient, type LabQuestionAwaiting } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LabQuestionsAwaitingCardProps {
  onOpenBooking: (bookingId: number) => void;
  /** Change to reload (e.g. after the booking details were closed). */
  refreshKey?: number;
}

function shortDate(value: string | null): string {
  if (!value) return "";
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime()) ? "" : format(d, "d MMM");
}

/** Questions the lab asked that the booking user has not answered yet (OIC / temporary OIC / Lab Operator / admin). */
export function LabQuestionsAwaitingCard({ onOpenBooking, refreshKey = 0 }: LabQuestionsAwaitingCardProps) {
  const [data, setData] = useState<{ count: number; overdue: number; items: LabQuestionAwaiting[] } | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient.getLabQuestionsAwaiting().then((res) => {
      if (!cancelled) setData(res.error ? null : res.data ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (!data || data.count === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50/70 px-3 py-2.5 text-sm dark:border-amber-800 dark:bg-amber-950/30">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="flex items-center gap-1.5 font-medium text-amber-900 dark:text-amber-200">
          <HelpCircle className="h-4 w-4 shrink-0" aria-hidden />
          {data.count === 1 ? "1 question is" : `${data.count} questions are`} awaiting the user&apos;s reply
          {data.overdue > 0 ? <span className="text-destructive">· {data.overdue} overdue</span> : null}
        </span>
        {expanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>
      {expanded ? (
        <ul className="mt-2 divide-y divide-amber-200/70 dark:divide-amber-900/60">
          {data.items.map((item) => (
            <li key={item.event_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">
                  {item.booking_ref} · {item.equipment_name} · {item.user_name}
                </p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{item.question}</p>
                <p className={cn("text-xs", item.overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
                  Asked {shortDate(item.asked_at)} by {item.asked_by_me ? "you" : item.asked_by}
                  {item.reply_by ? ` · reply by ${shortDate(item.reply_by)}${item.overdue ? " (overdue)" : ""}` : ""}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 shrink-0"
                onClick={() => onOpenBooking(item.booking_id)}
              >
                Open booking
              </Button>
            </li>
          ))}
          {data.count > data.items.length ? (
            <li className="py-2 text-xs text-muted-foreground">
              Showing the oldest {data.items.length} of {data.count}.
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
