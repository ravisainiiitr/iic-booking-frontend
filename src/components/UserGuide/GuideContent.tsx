import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  CalendarDays,
  Clock,
  CreditCard,
  FlaskConical,
  HelpCircle,
  Layers,
  LayoutTemplate,
  Lightbulb,
  ListChecks,
  Mail,
  Pencil,
  Receipt,
  Rocket,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Ticket,
  TrendingUp,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  WHATS_NEW_KIND_LABELS,
  type GuideIconId,
  type GuideSection,
  type UserGuideContent,
  type WhatsNewItem,
  type WhatsNewKind,
} from "@/guides/types";
import { groupSections, sectionMatches, WHATS_NEW_ID } from "./guideUtils";

const ICONS: Record<GuideIconId, LucideIcon> = {
  calendar: CalendarDays,
  template: LayoutTemplate,
  layers: Layers,
  pencil: Pencil,
  bot: Bot,
  list: ListChecks,
  wallet: Wallet,
  transfer: ArrowLeftRight,
  credit: CreditCard,
  users: Users,
  mail: Mail,
  alert: AlertTriangle,
  clock: Clock,
  ticket: Ticket,
  settings: Settings,
  star: Star,
  shield: ShieldCheck,
  receipt: Receipt,
  flask: FlaskConical,
  help: HelpCircle,
  building: Building2,
  rocket: Rocket,
  search: Search,
  chart: BarChart3,
};

export function GuideIcon({ id, className }: { id: GuideIconId; className?: string }) {
  const Icon = ICONS[id] ?? HelpCircle;
  return <Icon className={className} aria-hidden />;
}

/** Grouped table of contents. The first entry is always What's New. */
export function GuideToc({
  guide,
  activeId,
  query,
  onSelect,
}: {
  guide: UserGuideContent;
  activeId: string;
  query: string;
  onSelect: (id: string) => void;
}) {
  const visible = guide.sections.filter((s) => sectionMatches(s, query));
  const item = (id: string, label: string, icon: GuideIconId | "new") => (
    <button
      key={id}
      type="button"
      onClick={() => onSelect(id)}
      aria-current={activeId === id ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors",
        activeId === id
          ? "bg-primary/10 font-medium text-primary dark:bg-primary/20"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {icon === "new" ? <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden /> : <GuideIcon id={icon} className="h-3.5 w-3.5 shrink-0" />}
      <span className="truncate">{label}</span>
    </button>
  );
  return (
    <nav aria-label="Guide contents" className="space-y-3">
      {!query.trim() ? item(WHATS_NEW_ID, "What's New", "new") : null}
      {groupSections(visible).map(({ group, sections }) => (
        <div key={group} className="space-y-0.5">
          <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">{group}</p>
          {sections.map((s) => item(s.id, s.title, s.icon))}
        </div>
      ))}
      {visible.length === 0 ? <p className="px-2 text-xs text-muted-foreground">No chapters match “{query.trim()}”.</p> : null}
    </nav>
  );
}

/** Compact chapter picker for small screens. */
export function GuideChapterSelect({
  guide,
  activeId,
  onSelect,
  className,
}: {
  guide: UserGuideContent;
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
}) {
  return (
    <select
      aria-label="Choose a chapter"
      value={activeId}
      onChange={(e) => onSelect(e.target.value)}
      className={cn(
        "h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring",
        className
      )}
    >
      <option value={WHATS_NEW_ID}>What's New</option>
      {groupSections(guide.sections).map(({ group, sections }) => (
        <optgroup key={group} label={group}>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

const KIND_ORDER = Object.keys(WHATS_NEW_KIND_LABELS) as WhatsNewKind[];

const KIND_STYLE: Record<WhatsNewKind, { icon: LucideIcon; tile: string; accent: string }> = {
  new: { icon: Sparkles, tile: "bg-primary/10 text-primary dark:bg-primary/20", accent: "text-primary" },
  improved: {
    icon: TrendingUp,
    tile: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    accent: "text-sky-700 dark:text-sky-300",
  },
  fixed: {
    icon: Wrench,
    tile: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    accent: "text-emerald-700 dark:text-emerald-300",
  },
};

export function groupWhatsNew(items: WhatsNewItem[]): Array<{ kind: WhatsNewKind; items: WhatsNewItem[] }> {
  return KIND_ORDER.map((kind) => ({ kind, items: items.filter((i) => i.kind === kind) })).filter((g) => g.items.length > 0);
}

/** What's New items under New, Improved and Fixed, each with Try it (when the role can open the page) and Learn more. */
export function WhatsNewGroups({
  items,
  onLearnMore,
  onTry,
  unreadIds,
  short = false,
  twoColumns = false,
  idPrefix = "wn",
}: {
  items: WhatsNewItem[];
  onLearnMore: (sectionId: string) => void;
  onTry?: (href: string) => void;
  unreadIds?: ReadonlySet<string>;
  /** Show the one-line summary instead of the full benefit. */
  short?: boolean;
  twoColumns?: boolean;
  idPrefix?: string;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        No changes for your role in this release.
      </p>
    );
  }
  return (
    <div className="space-y-5">
      {groupWhatsNew(items).map(({ kind, items: group }) => {
        const style = KIND_STYLE[kind];
        const KindIcon = style.icon;
        return (
          <section key={kind} className="space-y-2" aria-labelledby={`${idPrefix}-${kind}`}>
            <h3 id={`${idPrefix}-${kind}`} className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <KindIcon className={cn("h-3.5 w-3.5", style.accent)} aria-hidden />
              {WHATS_NEW_KIND_LABELS[kind]}
              <span className="rounded-full bg-muted px-1.5 py-px text-[10px] font-medium tabular-nums text-muted-foreground" aria-label={`${group.length} items`}>
                {group.length}
              </span>
            </h3>
            <ul className={cn("grid gap-2.5", twoColumns && "sm:grid-cols-2")}>
              {group.map((item) => {
                const unread = unreadIds?.has(item.id) ?? false;
                return (
                  <li
                    key={item.id}
                    data-unread={unread || undefined}
                    className={cn(
                      "flex gap-3 rounded-xl border bg-card p-3 shadow-sm transition-colors",
                      unread ? "border-primary/50 bg-primary/[0.03] dark:bg-primary/10" : "border-border/70 dark:border-border"
                    )}
                  >
                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", style.tile)}>
                      <GuideIcon id={item.icon} className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="flex items-start gap-1.5 text-sm font-semibold leading-snug text-foreground">
                        {unread ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden /> : null}
                        <span>
                          {item.title}
                          {unread ? <span className="sr-only"> (unread)</span> : null}
                        </span>
                      </p>
                      <p className="text-[13px] leading-snug text-muted-foreground">{short ? item.summary ?? item.benefit : item.benefit}</p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5">
                        {item.href && onTry ? (
                          <button
                            type="button"
                            onClick={() => onTry(item.href as string)}
                            aria-label={`Try it: ${item.title}`}
                            className="inline-flex items-center gap-1 rounded text-xs font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            Try it
                            <ArrowRight className="h-3 w-3" aria-hidden />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => onLearnMore(item.sectionId)}
                          aria-label={`Learn more: ${item.title}`}
                          className="inline-flex items-center gap-1 rounded text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          Learn more
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function WhatsNewView({
  guide,
  onNavigate,
  onTry,
  greeting,
}: {
  guide: UserGuideContent;
  onNavigate: (sectionId: string) => void;
  onTry?: (href: string) => void;
  greeting?: string;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">What's New</h2>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary dark:bg-primary/20">
            {guide.whatsNew.date}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {greeting ? `${greeting} ` : ""}
          {guide.welcomeBody}
        </p>
      </div>

      <WhatsNewGroups items={guide.whatsNew.items} onLearnMore={onNavigate} onTry={onTry} twoColumns idPrefix="guide-wn" />
    </div>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</h3>;
}

export function GuideSectionHeader({ section }: { section: GuideSection }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-primary/20">
        <GuideIcon id={section.icon} className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{section.group}</p>
        <h2 className="text-lg font-semibold leading-tight tracking-tight text-foreground">{section.title}</h2>
      </div>
    </div>
  );
}

/** Body of one chapter under the fixed headings: What it is, How to, Rules / limits, Tips. */
export function GuideSectionBody({ section, large = false }: { section: GuideSection; large?: boolean }) {
  return (
    <div className="space-y-5 text-sm leading-relaxed text-foreground/90">
      <div className="space-y-2">
        <Heading>What it is</Heading>
        {section.intro.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        {section.glossary?.length ? (
          <dl className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/70">
            {section.glossary.map((g) => (
              <div key={g.term} className="grid gap-1 px-3 py-2 sm:grid-cols-[11rem_1fr] sm:gap-3">
                <dt className="font-medium text-foreground">{g.term}</dt>
                <dd className="text-muted-foreground">{g.meaning}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>

      {section.steps?.length ? (
        <div className="space-y-2">
          <Heading>How to</Heading>
          <ol className="space-y-3">
            {section.steps.map((st, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium text-foreground">{st.title}</p>
                  <p className="text-muted-foreground">{st.body}</p>
                  {st.screenshotSrc ? (
                    <figure className="mt-2 overflow-hidden rounded-lg border border-border/70 bg-muted/20">
                      <img
                        src={st.screenshotSrc}
                        alt={st.screenshotCaption || st.title}
                        className={cn("h-auto w-full object-contain object-top", large ? "max-h-[28rem]" : "max-h-56")}
                        loading="lazy"
                      />
                      {st.screenshotCaption ? (
                        <figcaption className="border-t border-border/60 px-2.5 py-1 text-xs text-muted-foreground">
                          {st.screenshotCaption}
                        </figcaption>
                      ) : null}
                    </figure>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {section.rules?.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3.5 py-3 dark:border-amber-900/70 dark:bg-amber-950/30">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-900 dark:text-amber-200">
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
            Rules / limits
          </p>
          <ul className="list-disc space-y-1 pl-5 text-amber-950 marker:text-amber-500 dark:text-amber-100">
            {section.rules.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {section.tips?.length ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50/70 px-3.5 py-3 dark:border-sky-900/70 dark:bg-sky-950/30">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-sky-900 dark:text-sky-200">
            <Lightbulb className="h-3.5 w-3.5" aria-hidden />
            Tips
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sky-950 marker:text-sky-500 dark:text-sky-100">
            {section.tips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {section.faqs?.length ? (
        <div className="space-y-2">
          <Heading>Questions</Heading>
          <div className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/70">
            {section.faqs.map((f) => (
              <details key={f.question} className="group px-3 py-2.5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-medium text-foreground">
                  {f.question}
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden />
                </summary>
                <p className="mt-1.5 text-muted-foreground">{f.answer}</p>
              </details>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
