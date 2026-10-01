import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { UserGuideContent } from "@/guides/types";
import { BookOpen, ChevronLeft, ChevronRight, Copy, Download, Maximize2, Minus, Search, X } from "lucide-react";
import { GuideChapterSelect, GuideSectionBody, GuideSectionHeader, GuideToc, WhatsNewView } from "./GuideContent";
import { openPrintableGuide, WHATS_NEW_ID } from "./guideUtils";

interface UserGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guide: UserGuideContent | null;
  /** The role has a guide but its content is still downloading. */
  loading?: boolean;
  userName?: string | null;
}

type WindowMode = "normal" | "minimized" | "maximized";

const NORMAL_WIDTH = 896;
const NORMAL_HEIGHT = 640;

function defaultPosition() {
  if (typeof window === "undefined") return { x: 80, y: 60 };
  const x = Math.max(8, Math.round((window.innerWidth - NORMAL_WIDTH) / 2));
  const y = Math.max(8, Math.round((window.innerHeight - NORMAL_HEIGHT) / 2));
  return { x, y };
}

export default function UserGuideDialog({ open, onOpenChange, guide, loading = false, userName }: UserGuideDialogProps) {
  const [activeId, setActiveId] = useState(WHATS_NEW_ID);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<WindowMode>("normal");
  const [pos, setPos] = useState(defaultPosition);
  const [preMaximize, setPreMaximize] = useState<{ x: number; y: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const dragRef = useRef<{ active: boolean; offsetX: number; offsetY: number }>({ active: false, offsetX: 0, offsetY: 0 });
  const posRef = useRef(pos);
  posRef.current = pos;

  const order = useMemo(() => [WHATS_NEW_ID, ...(guide?.sections ?? []).map((s) => s.id)], [guide]);
  const index = Math.max(0, order.indexOf(activeId));
  const section = guide?.sections.find((s) => s.id === activeId) ?? null;

  useEffect(() => {
    if (!open) return;
    setActiveId(WHATS_NEW_ID);
    setQuery("");
    setMode(window.innerWidth < 640 ? "maximized" : "normal");
    setPos(defaultPosition());
    setPreMaximize(null);
  }, [open, guide?.audience]);

  const go = useCallback((id: string) => {
    setActiveId(id);
    scrollRef.current?.scrollTo({ top: 0 });
  }, []);

  const clampPosition = useCallback((x: number, y: number) => {
    const maxX = Math.max(8, window.innerWidth - 120);
    const maxY = Math.max(8, window.innerHeight - 48);
    return { x: Math.min(Math.max(8, x), maxX), y: Math.min(Math.max(8, y), maxY) };
  }, []);

  const onTitlePointerDown = (e: React.PointerEvent) => {
    if (mode === "maximized") return;
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { active: true, offsetX: e.clientX - posRef.current.x, offsetY: e.clientY - posRef.current.y };
  };

  const onTitlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    setPos(clampPosition(e.clientX - dragRef.current.offsetX, e.clientY - dragRef.current.offsetY));
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

  const close = () => onOpenChange(false);

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

  const firstName = (userName || "").trim().split(/\s+/)[0];

  const windowControls = (
    <div className="flex shrink-0 items-center gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-white hover:bg-white/15 hover:text-white"
        onClick={() => setMode("minimized")}
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
        onClick={() => (mode === "minimized" ? setMode("normal") : toggleMaximize())}
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
        onClick={close}
        aria-label="Close"
        title="Close"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
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
            mode === "maximized" && "inset-2 rounded-xl sm:inset-4",
            mode === "normal" && "h-[min(92vh,40rem)] w-[min(100vw-1rem,56rem)] rounded-xl",
            mode === "minimized" && "w-[min(100vw-2rem,22rem)] rounded-lg shadow-xl"
          )}
          style={mode === "maximized" ? undefined : { left: pos.x, top: pos.y, right: "auto", bottom: "auto", transform: "none" }}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            if (mode !== "minimized") e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            close();
          }}
        >
          <div
            className={cn(
              "relative shrink-0 select-none bg-gradient-to-br from-primary via-primary to-accent text-white",
              mode === "minimized" ? "px-3 py-2" : "px-4 py-3 sm:px-5",
              mode !== "maximized" && "cursor-grab active:cursor-grabbing"
            )}
            onPointerDown={onTitlePointerDown}
            onPointerMove={onTitlePointerMove}
            onPointerUp={onTitlePointerUp}
            onPointerCancel={onTitlePointerUp}
            onDoubleClick={() => (mode === "minimized" ? setMode("normal") : toggleMaximize())}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <BookOpen className="h-4 w-4 shrink-0 opacity-90" />
                <div className="min-w-0">
                  <DialogPrimitive.Title className="truncate text-sm font-semibold tracking-tight text-white sm:text-base">
                    {guide?.title ?? "User Guide"}
                  </DialogPrimitive.Title>
                  {mode !== "minimized" && guide ? (
                    <DialogPrimitive.Description className="truncate text-xs text-primary-foreground/85">
                      {guide.audienceLabel}
                      {firstName ? ` · Signed in as ${firstName}` : ""}
                    </DialogPrimitive.Description>
                  ) : (
                    <DialogPrimitive.Description className="sr-only">User guide window</DialogPrimitive.Description>
                  )}
                </div>
              </div>
              {windowControls}
            </div>
          </div>

          {mode === "minimized" ? (
            <div className="flex items-center justify-between gap-2 border-t bg-muted/40 px-3 py-2">
              <p className="truncate text-xs text-muted-foreground">Minimized — drag to move</p>
              <Button type="button" size="sm" variant="secondary" onClick={() => setMode("normal")}>
                Restore
              </Button>
            </div>
          ) : !guide ? (
            <div className="space-y-4 p-5">
              <p className="text-sm text-muted-foreground" role="status">
                {loading ? "Loading your user guide…" : "There is no guide for your account type yet."}
              </p>
              {!loading ? (
                <div className="flex justify-end">
                  <Button variant="outline" onClick={close}>
                    Close
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1">
              <aside className="hidden w-60 shrink-0 flex-col border-r bg-muted/30 sm:flex">
                <div className="border-b p-3">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search this guide"
                      aria-label="Search this guide"
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-2 pb-4">
                  <GuideToc guide={guide} activeId={activeId} query={query} onSelect={go} />
                </div>
              </aside>

              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <div className="border-b px-4 py-2 sm:hidden">
                  <GuideChapterSelect guide={guide} activeId={activeId} onSelect={go} />
                </div>
                <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
                  <div className="mx-auto max-w-2xl space-y-5 px-4 py-5 sm:px-6">
                    {section ? (
                      <>
                        <GuideSectionHeader section={section} />
                        <GuideSectionBody section={section} large={mode === "maximized"} />
                      </>
                    ) : (
                      <WhatsNewView guide={guide} onNavigate={go} greeting={firstName ? `Welcome, ${firstName}.` : undefined} />
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-background px-4 py-2.5 sm:px-5">
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={close}>
                      Close
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => openPrintableGuide(guide)}>
                      <Download className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Save as PDF</span>
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
                      {index + 1} / {order.length}
                    </span>
                    <Button type="button" variant="outline" size="sm" disabled={index === 0} onClick={() => go(order[index - 1])}>
                      <ChevronLeft className="mr-0.5 h-4 w-4" />
                      Back
                    </Button>
                    {index < order.length - 1 ? (
                      <Button type="button" size="sm" onClick={() => go(order[index + 1])}>
                        Next
                        <ChevronRight className="ml-0.5 h-4 w-4" />
                      </Button>
                    ) : (
                      <Button type="button" size="sm" onClick={close}>
                        Done
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
