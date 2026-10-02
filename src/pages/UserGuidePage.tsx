import { useEffect, useState } from "react";
import { BookOpen, Download, Search } from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import { useUserGuide } from "@/components/UserGuide/UserGuideProvider";
import {
  GuideChapterSelect,
  GuideSectionBody,
  GuideSectionHeader,
  GuideToc,
  WhatsNewView,
} from "@/components/UserGuide/GuideContent";
import { openPrintableGuide, sectionMatches, WHATS_NEW_ID } from "@/components/UserGuide/guideUtils";
import { useAuth } from "@/contexts/AuthContext";
import { formatPersonName, formatWelcomeGreeting } from "@/lib/displayName";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEmbeddedMode } from "@/contexts/EmbeddedModeContext";

const anchor = (id: string) => `guide-${id}`;

/** Full-page / in-dashboard workspace view of the signed-in user's guide. */
export default function UserGuidePage() {
  const { guide, hasGuide, requestGuide } = useUserGuide();
  const { user } = useAuth();
  const embedded = useEmbeddedMode();
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState(WHATS_NEW_ID);

  useEffect(() => {
    if (hasGuide) requestGuide();
  }, [hasGuide, requestGuide]);

  const jump = (id: string) => {
    setActiveId(id);
    document.getElementById(anchor(id))?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const shell = (body: React.ReactNode) => (
    <div className="page-shell">
      {!embedded ? <DashboardHeader /> : null}
      {body}
    </div>
  );

  if (!guide) {
    return shell(
      <main className="container mx-auto max-w-3xl px-4 py-6">
        <p className="text-sm text-muted-foreground" role="status">
          {hasGuide ? "Loading your user guide…" : "There is no guide for your account type yet."}
        </p>
      </main>
    );
  }

  const greeting = formatWelcomeGreeting(formatPersonName(user));
  const sections = guide.sections.filter((s) => sectionMatches(s, query));

  return shell(
    <main className="container mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border/70 bg-gradient-to-br from-primary/5 via-card to-accent/10 p-5 shadow-sm sm:p-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <BookOpen className="h-5 w-5" />
          </span>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{guide.title}</h1>
              <Badge variant="secondary" className="font-medium">
                {guide.audienceLabel}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {`${greeting} `}
              {guide.welcomeBody}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openPrintableGuide(guide)}>
          <Download className="h-3.5 w-3.5" />
          Save as PDF
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search this guide"
                aria-label="Search this guide"
                className="h-9 pl-8 text-sm"
              />
            </div>
            <div className="max-h-[calc(100vh-8rem)] overflow-y-auto pr-1">
              <GuideToc guide={guide} activeId={activeId} query={query} onSelect={jump} />
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-6">
          <GuideChapterSelect guide={guide} activeId={activeId} onSelect={jump} className="lg:hidden" />

          {!query.trim() ? (
            <section id={anchor(WHATS_NEW_ID)} className="scroll-mt-4 rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
              <WhatsNewView guide={guide} onNavigate={jump} />
            </section>
          ) : null}

          {sections.map((section) => (
            <section
              key={section.id}
              id={anchor(section.id)}
              className="scroll-mt-4 space-y-5 rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6"
            >
              <GuideSectionHeader section={section} />
              <GuideSectionBody section={section} large />
            </section>
          ))}

          {query.trim() && sections.length === 0 ? (
            <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              No chapters match “{query.trim()}”.
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
