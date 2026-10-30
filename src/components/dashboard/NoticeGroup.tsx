import { type ReactNode, useEffect, useRef, useState } from "react";
import { BellRing, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

const STORAGE_KEY = "dashboard.noticeGroup.open";

function readOpen(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * One collapsible panel for the dashboard notices of staff (equipment under maintenance, disruptions needing a reason,
 * items needing attention). Each child renders nothing when it has nothing to say; the panel counts what is shown,
 * hides itself when that is nothing, and starts collapsed (the viewer's choice is remembered on this device).
 */
export default function NoticeGroup({ children, className }: { children: ReactNode; className?: string }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(readOpen);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const update = () => setCount(body.childElementCount);
    update();
    const observer = new MutationObserver(update);
    observer.observe(body, { childList: true });
    return () => observer.disconnect();
  }, []);

  const toggle = () => {
    setOpen((o) => {
      try {
        localStorage.setItem(STORAGE_KEY, o ? "0" : "1");
      } catch {
        /* the choice is only remembered for this visit */
      }
      return !o;
    });
  };

  return (
    <section className={cn(count === 0 && "hidden", className)} aria-label="Notices" data-testid="notice-group">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-left text-sm text-amber-950 hover:bg-amber-100/70 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
      >
        <span className="flex items-center gap-2 font-medium">
          <BellRing className="h-4 w-4 shrink-0" aria-hidden />
          Notices ({count})
          <span className="font-normal text-amber-900/80 dark:text-amber-100/80">
            — equipment under maintenance, disruptions and items needing your attention
          </span>
        </span>
        <span className="flex items-center gap-1 text-xs font-medium">
          {open ? "Hide" : "Show"}
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden />
        </span>
      </button>
      {/* Children stay mounted while collapsed so they keep loading and the count stays right. */}
      <div ref={bodyRef} hidden={!open} className="mt-2 space-y-3 [&>*]:!mb-0">
        {children}
      </div>
    </section>
  );
}
