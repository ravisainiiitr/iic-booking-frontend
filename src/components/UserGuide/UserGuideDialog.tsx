import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { UserGuideContent } from "@/guides";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  Sparkles,
  X,
} from "lucide-react";

interface UserGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guide: UserGuideContent | null;
  userName?: string | null;
}

const SECTION_ICONS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫"];

export default function UserGuideDialog({
  open,
  onOpenChange,
  guide,
  userName,
}: UserGuideDialogProps) {
  const [step, setStep] = useState(0); // 0 = welcome
  const [query, setQuery] = useState("");

  const sections = guide?.sections ?? [];
  const totalSteps = sections.length + 1; // welcome + sections
  const progress = totalSteps > 0 ? Math.round((step / (totalSteps - 1)) * 100) : 0;

  useEffect(() => {
    if (open) {
      setStep(0);
      setQuery("");
    }
  }, [open, guide?.audience]);

  const filteredIndexes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections.map((_, i) => i);
    return sections
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => {
        const blob = [s.title, ...s.paragraphs, ...(s.bullets || []), ...(s.callouts || [])]
          .join(" ")
          .toLowerCase();
        return blob.includes(q);
      })
      .map(({ i }) => i);
  }, [query, sections]);

  const finishAndClose = () => onOpenChange(false);

  const handlePrintPdf = () => {
    if (!guide) return;
    const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
    if (!w) return;
    const body = sections
      .map(
        (s) => `
      <section>
        <h2>${escapeHtml(s.title)}</h2>
        ${s.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
        ${
          s.bullets?.length
            ? `<ul>${s.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`
            : ""
        }
        ${
          s.callouts?.length
            ? s.callouts.map((c) => `<p><em>${escapeHtml(c)}</em></p>`).join("")
            : ""
        }
      </section>`
      )
      .join("");
    w.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(guide.title)}</title>
      <style>
        body{font-family:Georgia,serif;max-width:720px;margin:2rem auto;padding:0 1.25rem;color:#1a1a1a;line-height:1.55}
        h1{font-size:1.75rem;margin-bottom:.25rem}
        .sub{color:#555;margin-bottom:2rem}
        h2{font-size:1.2rem;margin-top:1.75rem;border-bottom:1px solid #ddd;padding-bottom:.35rem}
        ul{padding-left:1.25rem}
        @media print{body{margin:0}}
      </style></head><body>
      <h1>${escapeHtml(guide.title)}</h1>
      <p class="sub">${escapeHtml(guide.subtitle)}</p>
      <p><strong>${escapeHtml(guide.welcomeHeadline)}</strong></p>
      <p>${escapeHtml(guide.welcomeBody)}</p>
      ${body}
      <script>window.onload=function(){window.print()}<\/script>
      </body></html>`);
    w.document.close();
  };

  if (!guide) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>User Guide</DialogTitle>
            <DialogDescription>
              Role-specific guides are available for students, faculty, project staff, startups, and
              external users. Your current account type does not have a dedicated guide.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const isWelcome = step === 0;
  const section = !isWelcome ? sections[step - 1] : null;
  const displayName = (userName || "").trim() || "there";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-3xl p-0 gap-0 overflow-hidden border-0 shadow-2xl",
          "max-h-[92vh] flex flex-col",
          "[&>button]:hidden"
        )}
      >
        {/* Atmosphere header */}
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-teal-800 via-teal-700 to-cyan-800 px-6 pt-6 pb-5 text-white">
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, rgba(255,255,255,.25), transparent 45%), radial-gradient(circle at 80% 0%, rgba(255,255,255,.15), transparent 40%)",
            }}
          />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm">
                <BookOpen className="h-3.5 w-3.5" />
                {guide.audienceLabel}
              </div>
              <DialogTitle className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
                {isWelcome
                  ? guide.audience === "faculty" || guide.audience === "student"
                    ? `Welcome, ${displayName}`
                    : guide.welcomeHeadline
                  : section?.title}
              </DialogTitle>
              <DialogDescription className="mt-1 text-teal-50/90 text-sm">
                {isWelcome
                  ? guide.subtitle
                  : `Section ${step} of ${sections.length} · ${guide.title}`}
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-white hover:bg-white/15 hover:text-white"
              onClick={finishAndClose}
              aria-label="Close guide"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Progress */}
          <div className="relative mt-5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-amber-300 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-teal-100/80">
              {isWelcome ? "Introduction" : `${progress}% complete`}
            </p>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          {/* Sidebar nav — desktop */}
          <aside className="hidden w-52 shrink-0 border-r bg-muted/40 sm:flex sm:flex-col">
            <div className="border-b p-3">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search guide…"
                  className="h-8 pl-7 text-xs"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              <nav className="flex flex-col gap-0.5 p-2 pb-4">
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className={cn(
                    "rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors",
                    step === 0
                      ? "bg-teal-700 text-white"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  Welcome
                </button>
                {sections.map((s, i) => {
                  const visible = filteredIndexes.includes(i);
                  if (!visible) return null;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStep(i + 1)}
                      className={cn(
                        "rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                        step === i + 1
                          ? "bg-teal-700 text-white font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <span className="mr-1 opacity-70">{SECTION_ICONS[i] || "•"}</span>
                      {s.title}
                    </button>
                  );
                })}
              </nav>
            </ScrollArea>
          </aside>

          {/* Main content */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <ScrollArea className="max-h-[min(52vh,420px)] flex-1 sm:max-h-[min(58vh,480px)]">
              <div className="space-y-4 px-5 py-5 sm:px-6">
                {isWelcome ? (
                  <>
                    <div className="flex items-start gap-3 rounded-xl border border-teal-200/80 bg-gradient-to-br from-teal-50 to-cyan-50/80 p-4 dark:from-teal-950/40 dark:to-cyan-950/20 dark:border-teal-900">
                      <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
                      <p className="text-sm leading-relaxed text-foreground/90">{guide.welcomeBody}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Use Next to walk through each topic, or jump from the sidebar. You can skip now
                      and reopen this guide anytime from your user menu under{" "}
                      <strong className="text-foreground">User Guide</strong>.
                    </p>
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {sections.slice(0, 6).map((s) => (
                        <li
                          key={s.id}
                          className="rounded-lg border bg-background px-3 py-2 text-xs font-medium text-muted-foreground"
                        >
                          {s.title}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : section ? (
                  <>
                    {section.paragraphs.map((p, i) => (
                      <p key={i} className="text-sm leading-relaxed text-foreground/90">
                        {p}
                      </p>
                    ))}
                    {section.bullets && section.bullets.length > 0 && (
                      <ul className="space-y-2">
                        {section.bullets.map((b, i) => (
                          <li
                            key={i}
                            className="flex gap-2 text-sm leading-relaxed text-foreground/90"
                          >
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {section.callouts?.map((c, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
                      >
                        {c}
                      </div>
                    ))}
                  </>
                ) : null}
              </div>
            </ScrollArea>

            {/* Footer actions */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-background px-4 py-3 sm:px-5">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground"
                  onClick={finishAndClose}
                >
                  Skip for now
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handlePrintPdf}
                >
                  <Download className="h-3.5 w-3.5" />
                  Save as PDF
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={step === 0}
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                >
                  <ChevronLeft className="h-4 w-4 mr-0.5" />
                  Back
                </Button>
                {step < totalSteps - 1 ? (
                  <Button
                    type="button"
                    size="sm"
                    className="bg-teal-700 hover:bg-teal-800"
                    onClick={() => setStep((s) => Math.min(totalSteps - 1, s + 1))}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-0.5" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    className="bg-teal-700 hover:bg-teal-800"
                    onClick={finishAndClose}
                  >
                    Finish guide
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
