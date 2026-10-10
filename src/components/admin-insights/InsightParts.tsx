import { useEffect, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, XAxis, YAxis } from "recharts";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, RotateCcw, Search } from "lucide-react";
import { RowsPerPageSelect } from "@/components/RowsPerPageSelect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableHead } from "@/components/ui/table";
import { CHART_COLORS } from "@/lib/adminInsights";
import { cn } from "@/lib/utils";

const ALL = "__all__";

export function StatTile({
  label,
  value,
  hint,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const body = (
    <>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tone)}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </>
  );
  const className = "h-full rounded-xl border border-border/70 bg-card p-4 text-left shadow-sm";
  if (!onClick) return <div className={className}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        className,
        "cursor-pointer transition-colors hover:border-primary/40 hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && "border-primary ring-1 ring-primary",
      )}
    >
      {body}
    </button>
  );
}

export function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allLabel: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? "" : v)}>
        <SelectTrigger id={id} className="h-9">
          <SelectValue placeholder={allLabel} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Search box whose value is applied 350 ms after the user stops typing. */
export function DebouncedSearch({
  value,
  onChange,
  label,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft((d) => (d.trim() === value ? d : value)), [value]);
  useEffect(() => {
    if (draft.trim() === value) return;
    const t = window.setTimeout(() => onChange(draft.trim()), 350);
    return () => window.clearTimeout(t);
  }, [draft, value, onChange]);
  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
      <Input
        aria-label={label}
        placeholder={placeholder}
        className="h-9 pl-8"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
    </div>
  );
}

export function ClearFilters({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClick}>
      <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
      Clear filters
    </Button>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden border-border/70 shadow-sm", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <CardTitle className="text-sm font-semibold tracking-tight">{title}</CardTitle>
          {description ? <CardDescription className="mt-0.5 text-xs">{description}</CardDescription> : null}
        </div>
        {action}
      </CardHeader>
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}

export interface BarItem {
  key: string;
  label: string;
  count: number;
  detail?: string;
}

/**
 * Horizontal bars, one per row. Clicking a row toggles it as a filter when ``onSelect`` is given;
 * long lists show the first ``limit`` rows with a "Show all" toggle.
 */
export function BreakdownBars({
  items,
  total,
  selected,
  onSelect,
  limit = 8,
  empty = "Nothing to show.",
  color = "bg-primary/80",
}: {
  items: BarItem[];
  total?: number;
  selected?: string;
  onSelect?: (key: string) => void;
  limit?: number;
  empty?: string;
  color?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, limit);
  const max = Math.max(1, ...items.map((i) => i.count));
  const sum = total ?? items.reduce((s, i) => s + i.count, 0);
  if (items.length === 0) return <p className="px-4 py-8 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="px-4 py-3">
      <ul className="space-y-2">
        {visible.map((item) => {
          const pct = sum > 0 ? Math.round((item.count / sum) * 100) : 0;
          const content = (
            <>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium text-foreground" title={item.label}>
                  {item.label}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {item.count.toLocaleString("en-IN")} · {pct}%{item.detail ? ` · ${item.detail}` : ""}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", color)}
                  style={{ width: `${item.count ? Math.max(3, (item.count / max) * 100) : 0}%` }}
                />
              </div>
            </>
          );
          return (
            <li key={item.key}>
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(item.key)}
                  aria-pressed={selected === item.key}
                  className={cn(
                    "-mx-1.5 block w-[calc(100%+0.75rem)] cursor-pointer rounded-md px-1.5 py-1 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected === item.key && "bg-primary/10",
                  )}
                >
                  {content}
                </button>
              ) : (
                <div className="py-1">{content}</div>
              )}
            </li>
          );
        })}
      </ul>
      {items.length > limit ? (
        <Button variant="link" size="sm" className="mt-1 h-7 px-0 text-xs" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Show fewer" : `Show all ${items.length}`}
        </Button>
      ) : null}
    </div>
  );
}

export function DonutChart({
  items,
  label,
  emptyText = "Nothing to show.",
}: {
  items: BarItem[];
  label: string;
  emptyText?: string;
}) {
  const data = items.filter((i) => i.count > 0);
  if (data.length === 0) return <p className="px-4 py-8 text-center text-sm text-muted-foreground">{emptyText}</p>;
  const config: ChartConfig = Object.fromEntries(
    data.map((d, i) => [d.key, { label: d.label, color: CHART_COLORS[i % CHART_COLORS.length] }]),
  );
  return (
    <div className="px-2 py-2" role="img" aria-label={`${label}: ${data.map((d) => `${d.label} ${d.count}`).join(", ")}`}>
      <ChartContainer config={config} className="aspect-auto h-[240px] w-full">
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="label" innerRadius="52%" outerRadius="80%" paddingAngle={1.5}>
            {data.map((d, i) => (
              <Cell key={d.key} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <ChartTooltip content={<ChartTooltipContent nameKey="label" hideLabel />} />
          <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ChartContainer>
    </div>
  );
}

export interface TrendSeries {
  key: string;
  label: string;
  color: string;
}

export function TrendChart({
  data,
  series,
  xKey = "label",
  stacked = true,
  height = 230,
}: {
  data: Array<Record<string, string | number>>;
  series: TrendSeries[];
  xKey?: string;
  stacked?: boolean;
  height?: number;
}) {
  const config: ChartConfig = Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }]));
  return (
    <div className="px-2 pb-2 pt-3">
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height }}>
        <BarChart data={data} margin={{ left: -18, right: 6, top: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={14} fontSize={11} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} fontSize={11} />
          <ChartTooltip cursor={{ fillOpacity: 0.08 }} content={<ChartTooltipContent />} />
          {series.length > 1 ? <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} /> : null}
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              stackId={stacked ? "a" : undefined}
              fill={`var(--color-${s.key})`}
              radius={!stacked || i === series.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
              maxBarSize={26}
            />
          ))}
        </BarChart>
      </ChartContainer>
    </div>
  );
}

export function SortHeader({
  label,
  sortKey,
  ordering,
  onSort,
  className,
}: {
  label: string;
  sortKey: string;
  ordering: string;
  onSort: (key: string) => void;
  className?: string;
}) {
  const active = ordering.replace(/^-/, "") === sortKey;
  const desc = ordering.startsWith("-");
  const Icon = !active ? ArrowUpDown : desc ? ArrowDown : ArrowUp;
  return (
    <TableHead className={className} aria-sort={active ? (desc ? "descending" : "ascending") : "none"}>
      <button
        type="button"
        className="inline-flex items-center gap-1 font-semibold uppercase hover:text-foreground"
        onClick={() => onSort(sortKey)}
      >
        {label}
        <Icon className={cn("h-3.5 w-3.5", !active && "opacity-40")} aria-hidden />
      </button>
    </TableHead>
  );
}

export function Pager({
  page,
  pageSize,
  total,
  loading,
  noun,
  onPage,
  onPageSize,
}: {
  page: number;
  pageSize: number;
  total: number;
  loading?: boolean;
  noun: string;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span className="text-muted-foreground">
        {total === 0
          ? `0 ${noun}`
          : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total.toLocaleString("en-IN")}`}
      </span>
      <div className="flex items-center gap-3">
        <RowsPerPageSelect value={pageSize} onChange={onPageSize} />
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8"
          aria-label="Previous page"
          disabled={page <= 1 || loading}
          onClick={() => onPage(Math.max(1, page - 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="tabular-nums">
          Page {page} of {pages}
        </span>
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8"
          aria-label="Next page"
          disabled={page >= pages || loading}
          onClick={() => onPage(Math.min(pages, page + 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 p-8 text-center text-sm">
      <p className="text-destructive">{message}</p>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

export function Muted({ children = "—" }: { children?: ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}
