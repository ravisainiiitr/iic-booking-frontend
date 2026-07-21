import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { UserGuideContent } from "@/guides";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Maximize2,
  Minus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface UserGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guide: UserGuideContent | null;
  userName?: string | null;
}

type WindowMode = "normal" | "minimized" | "maximized";

const SECTION_ICONS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪", "⑫"];

const NORMAL_WIDTH = 768;
const NORMAL_HEIGHT = 640;

function defaultPosition() {
  if (typeof window === "undefined") return { x: 80, y: 60 };
  const x = Math.max(16, Math.round((window.innerWidth - NORMAL_WIDTH) / 2));
  const y = Math.max(16, Math.round((window.innerHeight - NORMAL_HEIGHT) / 2));
  return { x, y };
}

export default function UserGuideDialog({
  open,
  onOpenChange,
  guide,
  userName,
}: UserGuideDialogProps) {
  const [step, setStep] = useState(0);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<WindowMode>("normal");
  const [pos, setPos] = useState(defaultPosition);
  const [preMaximize, setPreMaximize] = useState<{ x: number; y: number } | null>(null);

  const dragRef = useRef<{
    active: boolean;
    offsetX: number;
    offsetY: number;
  }>({ active: false, offsetX: 0, offsetY: 0 });
  const posRef = useRef(pos);
  posRef.current = pos;

  const sections = guide?.sections ?? [];
  const totalSteps = sections.length + 1;
  const progress = totalSteps > 0 ? Math.round((step / (totalSteps - 1)) * 100) : 0;

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setQuery("");
    setMode("normal");
    setPos(defaultPosition());
    setPreMaximize(null);
  }, [open, guide?.audience]);

  const clampPosition = useCallback((x: number, y: number) => {
    const maxX = Math.max(8, window.innerWidth - 120);
    const maxY = Math.max(8, window.innerHeight - 48);
    return {
      x: Math.min(Math.max(8, x), maxX),
      y: Math.min(Math.max(8, y), maxY),
    };
  }, []);

  const onTitlePointerDown = (e: React.PointerEvent) => {
    if (mode === "maximized") return;
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      active: true,
      offsetX: e.clientX - posRef.current.x,
      offsetY: e.clientY - posRef.current.y,
    };
  };

  const onTitlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    setPos(
      clampPosition(e.clientX - dragRef.current.offsetX, e.clientY - dragRef.current.offsetY)
    );
  };

  const onTitlePointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const filteredIndexes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections.map((_, i) => i);
    return sections
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => {
        const blob = [
          s.title,
          ...s.paragraphs,
          ...(s.bullets || []),
          ...(s.callouts || []),
          ...(s.steps?.flatMap((st) => [st.title, st.body, st.screenshotCaption || ""]) || []),
          ...(s.faqs?.flatMap((f) => [f.question, f.answer]) || []),
        ]
          .join(" ")
          .toLowerCase();
        return blob.includes(q);
      })
      .map(({ i }) => i);
  }, [query, sections]);

  const finishAndClose = () => onOpenChange(false);

  const toggleMaximize = () => {
    if (mode === "maximized") {
      setMode("normal");
      if (preMaximize) setPos(preMaximize);
      setPreMaximize(null);
      return;
    }
    setPreMaximize(pos);
    setMode("maximized");
  };

  const minimize = () => {
    if (mode === "maximized") {
      setMode("minimized");
      return;
    }
    setMode("minimized");
  };

  const restoreFromMinimized = () => {
    setMode("normal");
  };

  const handlePrintPdf = () => {
    if (!guide) return;

    const body = sections
      .map(
        (s) => `
      <section>
        <h2>${escapeHtml(s.title)}</h2>
        ${s.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
        ${
          s.steps?.length
            ? s.steps
                .map(
                  (st, idx) => `
          <div class="step">
            <h3>Step ${idx + 1}: ${escapeHtml(st.title)}</h3>
            <p>${escapeHtml(st.body)}</p>
            ${
              st.screenshotCaption
                ? `<p class="shot">[Screenshot: ${escapeHtml(st.screenshotCaption)}]</p>`
                : ""
            }
          </div>`
                )
                .join("")
            : ""
        }
        ${
          s.bullets?.length
            ? `<ul>${s.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`
            : ""
        }
        ${
          s.faqs?.length
            ? s.faqs
                .map(
                  (f) => `
          <div class="faq">
            <p><strong>Q: ${escapeHtml(f.question)}</strong></p>
            <p>A: ${escapeHtml(f.answer)}</p>
          </div>`
                )
                .join("")
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

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(guide.title)}</title>
  <style>
    body{font-family:Georgia,serif;max-width:720px;margin:2rem auto;padding:0 1.25rem;color:#1a1a1a;line-height:1.55}
    h1{font-size:1.75rem;margin-bottom:.25rem}
    .sub{color:#555;margin-bottom:2rem}
    h2{font-size:1.2rem;margin-top:1.75rem;border-bottom:1px solid #ddd;padding-bottom:.35rem}
    h3{font-size:1.05rem;margin-top:1rem}
    ul{padding-left:1.25rem}
    .shot{color:#555;font-style:italic;border:1px dashed #bbb;padding:.5rem .75rem;background:#fafafa}
    .faq{margin:.75rem 0;padding:.5rem 0;border-bottom:1px dotted #ddd}
    @media print{body{margin:0}}
  </style>
</head>
<body>
  <h1>${escapeHtml(guide.title)}</h1>
  <p class="sub">${escapeHtml(guide.subtitle)}</p>
  <p><strong>${escapeHtml(guide.welcomeHeadline)}</strong></p>
  <p>${escapeHtml(guide.welcomeBody)}</p>
  ${body}
</body>
</html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (!w) {
      URL.revokeObjectURL(url);
      toast.error("Please allow pop-ups to save the user guide as PDF.");
      return;
    }

    const triggerPrint = () => {
      try {
        w.focus();
        w.print();
      } catch {
        /* ignore */
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    };

    window.setTimeout(triggerPrint, 400);
  };

  const isWelcome = step === 0;
  const section = !isWelcome ? sections[step - 1] : null;
  const displayName = (userName || "").trim() || "there";
  const titleText = !guide
    ? "User Guide"
    : isWelcome
      ? guide.audience === "faculty" || guide.audience === "student"
        ? `Welcome, ${displayName}`
        : guide.welcomeHeadline
      : section?.title || guide.title;

  const windowControls = (
    <div className="flex shrink-0 items-center gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-white hover:bg-white/15 hover:text-white"
        onClick={minimize}
        aria-label="Minimize"
        title="Minimize"
      >
        <Minus className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-white hover:bg-white/15 hover:text-white"
        onClick={() => {
          if (mode === "minimized") {
            restoreFromMinimized();
            return;
          }
          toggleMaximize();
        }}
        aria-label={mode === "maximized" ? "Restore" : "Maximize"}
        title={mode === "maximized" ? "Restore" : "Maximize"}
      >
        {mode === "maximized" ? <Copy className="h-3.5 w-3.5" /> : <Maximize2 className="h-4 w-4" />}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-white hover:bg-red-500/80 hover:text-white"
        onClick={finishAndClose}
        aria-label="Cancel"
        title="Cancel"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        // Only allow dismiss via Cancel / Finish / Skip — not overlay click while reading
        if (!next) onOpenChange(false);
      }}
      modal={mode !== "minimized"}
    >
      <DialogPrimitive.Portal>
        {mode !== "minimized" ? (
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        ) : null}

        <DialogPrimitive.Content
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden border-0 bg-background shadow-2xl outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            mode === "maximized" && "inset-3 sm:inset-4 rounded-xl",
            mode === "normal" && "w-[min(100vw-1rem,48rem)] max-h-[min(92vh,40rem)] rounded-xl",
            mode === "minimized" && "w-[min(100vw-2rem,22rem)] rounded-lg shadow-xl"
          )}
          style={
            mode === "maximized"
              ? undefined
              : {
                  left: pos.x,
                  top: pos.y,
                  right: "auto",
                  bottom: "auto",
                  transform: "none",
                }
          }
          onPointerDownOutside={(e) => {
            if (mode === "minimized") {
              e.preventDefault();
              return;
            }
            // Keep open until Cancel — user can still Minimize to use the dashboard
            e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (mode !== "minimized") e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            finishAndClose();
          }}
        >
          {/* Title bar — drag handle */}
          <div
            className={cn(
              "relative shrink-0 select-none overflow-hidden bg-gradient-to-br from-teal-800 via-teal-700 to-cyan-800 text-white",
              mode === "minimized" ? "px-3 py-2 cursor-grab active:cursor-grabbing" : "px-4 pt-3 pb-3 sm:px-5",
              mode !== "maximized" && "cursor-grab active:cursor-grabbing"
            )}
            onPointerDown={onTitlePointerDown}
            onPointerMove={onTitlePointerMove}
            onPointerUp={onTitlePointerUp}
            onPointerCancel={onTitlePointerUp}
            onDoubleClick={() => {
              if (mode === "minimized") restoreFromMinimized();
              else toggleMaximize();
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 20% 20%, rgba(255,255,255,.25), transparent 45%), radial-gradient(circle at 80% 0%, rgba(255,255,255,.15), transparent 40%)",
              }}
            />
            <div className="relative flex items-center justify-between gap-2">
              <div className="min-w-0 flex items-center gap-2">
                <BookOpen className="h-4 w-4 shrink-0 opacity-90" />
                <div className="min-w-0">
                  <DialogPrimitive.Title className="truncate text-sm font-semibold tracking-tight text-white sm:text-base">
                    {titleText}
                  </DialogPrimitive.Title>
                  {mode !== "minimized" && guide ? (
                    <DialogPrimitive.Description className="mt-0.5 truncate text-xs text-teal-50/90">
                      {isWelcome
                        ? guide.subtitle
                        : `Section ${step} of ${sections.length} · ${guide.title}`}
                    </DialogPrimitive.Description>
                  ) : (
                    <DialogPrimitive.Description className="sr-only">
                      User guide window
                    </DialogPrimitive.Description>
                  )}
                </div>
              </div>
              {windowControls}
            </div>

            {mode !== "minimized" && guide ? (
              <div className="relative mt-3">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-amber-300 transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-teal-100/80">
                  {isWelcome ? "Introduction" : `${progress}% complete`}
                </p>
              </div>
            ) : null}
          </div>

          {mode === "minimized" ? (
            <div className="flex items-center justify-between gap-2 border-t bg-muted/40 px-3 py-2">
              <p className="truncate text-xs text-muted-foreground">Minimized — drag to move</p>
              <Button type="button" size="sm" variant="secondary" onClick={restoreFromMinimized}>
                Restore
              </Button>
            </div>
          ) : !guide ? (
            <div className="space-y-4 p-5">
              <p className="text-sm text-muted-foreground">
                Role-specific guides are available for students, faculty, project staff, startups,
                external users, Officers-in-Charge, lab operators, department administrators, and
                institute administrators. Your current account type does not have a dedicated guide.
              </p>
              <div className="flex justify-end">
                <Button variant="outline" onClick={finishAndClose}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col sm:flex-row",
                mode === "maximized" ? "min-h-0" : "max-h-[min(70vh,32rem)]"
              )}
            >
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
                      if (!filteredIndexes.includes(i)) return null;
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

              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <ScrollArea
                  className={cn(
                    "flex-1",
                    mode === "maximized"
                      ? "max-h-[calc(100vh-12rem)]"
                      : "max-h-[min(52vh,420px)] sm:max-h-[min(58vh,480px)]"
                  )}
                >
                  <div className="space-y-4 px-5 py-5 sm:px-6">
                    {isWelcome ? (
                      <>
                        <div className="flex items-start gap-3 rounded-xl border border-teal-200/80 bg-gradient-to-br from-teal-50 to-cyan-50/80 p-4 dark:from-teal-950/40 dark:to-cyan-950/20 dark:border-teal-900">
                          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
                          <p className="text-sm leading-relaxed text-foreground/90">
                            {guide.welcomeBody}
                          </p>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Drag the title bar to move this window. Use Minimize to keep working on the
                          dashboard, Maximize for a larger view, or Cancel to dismiss. You can reopen
                          anytime from{" "}
                          <strong className="text-foreground">User Guide</strong> in the menu.
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
                        {section.steps && section.steps.length > 0 && (
                          <ol className="space-y-3">
                            {section.steps.map((st, i) => (
                              <li
                                key={i}
                                className="rounded-lg border bg-muted/30 px-3 py-3 text-sm space-y-1.5"
                              >
                                <p className="font-medium text-foreground">
                                  <span className="text-teal-700 mr-1.5">{i + 1}.</span>
                                  {st.title}
                                </p>
                                <p className="text-foreground/90 leading-relaxed pl-5">{st.body}</p>
                                {st.screenshotCaption ? (
                                  <p className="ml-5 rounded-md border border-dashed border-muted-foreground/40 bg-background px-2.5 py-1.5 text-xs italic text-muted-foreground">
                                    [Screenshot: {st.screenshotCaption}]
                                  </p>
                                ) : null}
                              </li>
                            ))}
                          </ol>
                        )}
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
                        {section.faqs && section.faqs.length > 0 && (
                          <div className="space-y-3">
                            {section.faqs.map((f, i) => (
                              <div key={i} className="rounded-lg border px-3 py-2.5 space-y-1">
                                <p className="text-sm font-medium text-foreground">Q: {f.question}</p>
                                <p className="text-sm leading-relaxed text-muted-foreground">
                                  A: {f.answer}
                                </p>
                              </div>
                            ))}
                          </div>
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
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
