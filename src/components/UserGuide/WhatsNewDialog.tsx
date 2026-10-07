import { useRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { BookOpen, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatWelcomeGreeting } from "@/lib/displayName";
import { WHATS_NEW_KIND_LABELS, type UserGuideContent } from "@/guides/types";
import { groupWhatsNew, WhatsNewGroups } from "./GuideContent";

interface WhatsNewDialogProps {
  open: boolean;
  /** Got it, Close, Escape or a click outside. */
  onClose: () => void;
  guide: UserGuideContent;
  userName?: string | null;
  /** Items the user has not seen before, highlighted with a dot. */
  unreadIds: ReadonlySet<string>;
  /** Hand over to the user guide window; `sectionId` opens that chapter. */
  onOpenGuide: (sectionId?: string) => void;
  onTry: (href: string) => void;
}

function unreadSummary(unread: number, total: number, counts: string): string {
  if (total === 0) return "";
  if (unread === total) return `Here is what changed for you: ${counts}.`;
  if (unread > 0) return `${unread === 1 ? "1 change" : `${unread} changes`} since your last visit ${unread === 1 ? "is" : "are"} marked with a dot. In all: ${counts}.`;
  return `You're up to date. A recap: ${counts}.`;
}

/** "What's new for you": the role's latest changes, opened from the profile menu. */
export default function WhatsNewDialog({ open, onClose, guide, userName, unreadIds, onOpenGuide, onTry }: WhatsNewDialogProps) {
  const gotItRef = useRef<HTMLButtonElement>(null);
  /** Set while handing focus to the guide window or a new page, so closing does not pull focus back. */
  const handoffRef = useRef(false);
  const items = guide.whatsNew.items;
  const unreadCount = items.filter((i) => unreadIds.has(i.id)).length;
  const counts = groupWhatsNew(items).map((g) => `${g.items.length} ${WHATS_NEW_KIND_LABELS[g.kind].toLowerCase()}`);

  const handOff = (fn: () => void) => {
    handoffRef.current = true;
    fn();
  };

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            // Above the floating Booking Assistant launcher (z-9999), which would otherwise cover "Got it" on phones.
            "fixed inset-0 z-[10000] flex items-stretch justify-center bg-black/45 sm:items-center sm:p-4",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
          )}
        >
          <DialogPrimitive.Content
            data-testid="whats-new-dialog"
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              handoffRef.current = false;
              gotItRef.current?.focus();
            }}
            onCloseAutoFocus={(e) => {
              if (handoffRef.current) e.preventDefault();
              handoffRef.current = false;
            }}
            className={cn(
              // Phones: stretched by the overlay to a full-screen sheet (overriding the global 92vh dialog cap). Larger screens: centred card.
              "relative flex w-full flex-col overflow-hidden bg-background shadow-2xl outline-none max-sm:!max-h-none",
              "sm:max-h-[min(88dvh,46rem)] sm:max-w-2xl sm:rounded-2xl sm:border sm:border-border/70",
              "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-2"
            )}
          >
            <header className="shrink-0 border-b bg-gradient-to-br from-primary/10 via-background to-accent/10 px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-6 sm:pt-5">
              <div className="flex items-start gap-3 pr-10">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                  <Sparkles className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 space-y-0.5">
                  <DialogPrimitive.Title className="text-lg font-semibold leading-tight tracking-tight text-foreground sm:text-xl">
                    What's new for you
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description className="text-sm text-muted-foreground">
                    {guide.whatsNew.date} update · {guide.audienceLabel}
                  </DialogPrimitive.Description>
                </div>
              </div>
              <DialogPrimitive.Close
                className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:top-3"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
              <p className="mt-3 text-sm text-foreground">
                <span className="font-medium" data-testid="user-guide-greeting">
                  {formatWelcomeGreeting(userName)}
                </span>{" "}
                <span className="text-muted-foreground" data-testid="whats-new-unread-summary">
                  {unreadSummary(unreadCount, items.length, counts.join(", "))}
                </span>
              </p>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
              <WhatsNewGroups
                items={items}
                unreadIds={unreadIds}
                short
                idPrefix="whats-new"
                onLearnMore={(sectionId) => handOff(() => onOpenGuide(sectionId))}
                onTry={(href) => handOff(() => onTry(href))}
              />
            </div>

            <footer className="shrink-0 border-t bg-background px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="hidden text-xs text-muted-foreground sm:block">Open this again from your profile menu › What's new.</p>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <Button type="button" variant="outline" className="gap-1.5" onClick={() => handOff(() => onOpenGuide())}>
                    <BookOpen className="h-4 w-4" aria-hidden />
                    Open user guide
                  </Button>
                  <Button ref={gotItRef} type="button" onClick={onClose}>
                    Got it
                  </Button>
                </div>
              </div>
            </footer>
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
