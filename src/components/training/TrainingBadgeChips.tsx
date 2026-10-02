import type { CSSProperties } from "react";
import { GraduationCap } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { TrainingBadge } from "@/lib/trainingTypes";
import { formatDate, trainingBadgeLabel } from "./trainingHelpers";
import { useTrainingBadges } from "./useTrainingBadges";

const NAMED_COLORS: Record<string, string> = {
  emerald: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200",
  green: "border-green-300 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-950/60 dark:text-green-200",
  sky: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950/60 dark:text-sky-200",
  blue: "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950/60 dark:text-blue-200",
  violet: "border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-700 dark:bg-violet-950/60 dark:text-violet-200",
  amber: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200",
  slate: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200",
};

function chipStyle(color: string | undefined, onDark: boolean): { className: string; style?: CSSProperties } {
  if (onDark) return { className: "border-white/30 bg-white/15 text-white" };
  const value = String(color || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(value)) {
    return {
      className: "text-foreground",
      style: { borderColor: `${value}99`, backgroundColor: `${value}1f` },
    };
  }
  return { className: NAMED_COLORS[value.toLowerCase()] ?? NAMED_COLORS.emerald };
}

type Props = {
  /** Fetches (batched) badges for this user; ignored when `badges` is given. */
  userId?: number | null;
  badges?: TrainingBadge[] | null;
  className?: string;
  /** White-on-navy chips for hero banners. */
  onDark?: boolean;
  max?: number;
};

function BadgeChipList({ badges, className, onDark = false, max = 6 }: Omit<Props, "userId"> & { badges: TrainingBadge[] }) {
  if (!badges.length) return null;
  const shown = badges.slice(0, max);
  const hidden = badges.length - shown.length;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {shown.map((badge) => {
        const { className: tone, style } = chipStyle(badge.color, onDark);
        return (
          <Tooltip key={`${badge.code}-${badge.equipment_id}`}>
            <TooltipTrigger asChild>
              <span
                tabIndex={0}
                className={cn(
                  "inline-flex max-w-[12rem] items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  tone,
                )}
                style={style}
              >
                <GraduationCap className="h-3 w-3 shrink-0" aria-hidden />
                <span className="truncate">{trainingBadgeLabel(badge)}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              <p className="font-semibold">{badge.name || "Trained"}</p>
              <p>{badge.equipment_name}</p>
              <p className="text-muted-foreground">
                Awarded {formatDate(badge.awarded_at)}
                {badge.valid_until ? ` · valid until ${formatDate(badge.valid_until)}` : ""}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}
      {hidden > 0 ? (
        <span className={cn("text-[11px]", onDark ? "text-white/80" : "text-muted-foreground")}>+{hidden} more</span>
      ) : null}
    </span>
  );
}

function FetchedBadgeChips({ userId, ...rest }: Omit<Props, "badges"> & { userId: number }) {
  const map = useTrainingBadges([userId]);
  return <BadgeChipList badges={map[userId] ?? []} {...rest} />;
}

/** Small "Trained · <equipment code>" chips. Renders nothing when the module is off or there are no badges. */
export function TrainingBadgeChips({ userId, badges, ...rest }: Props) {
  if (badges) return <BadgeChipList badges={badges} {...rest} />;
  if (!userId) return null;
  return <FetchedBadgeChips userId={userId} {...rest} />;
}

export default TrainingBadgeChips;
