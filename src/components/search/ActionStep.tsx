import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, FlaskConical, Loader2, Power, Search } from "lucide-react";
import { Command as CommandPrimitive } from "cmdk";

import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { apiClient, type PortalAction, type PortalActionEquipment } from "@/lib/api";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 200;

/** "Turn Slot Exchange on or off" -> "Slot Exchange". */
export function switchName(title: string): string {
  return title.replace(/^Turn\s+/i, "").replace(/\s+on or off$/i, "");
}

type Props = {
  action: PortalAction;
  /** Instrument already named in the search words. */
  preselected?: { id: number; name: string; code: string };
  onBack: () => void;
  onOpen: (path: string) => void;
};

/**
 * Second step of a search action that is about one instrument: choose it (only instruments the user may act on),
 * then open the page for it, or, for a switch, see whether it is on and turn it on or off.
 */
export default function ActionStep({ action, preselected, onBack, onOpen }: Props) {
  const [query, setQuery] = useState("");
  const [choices, setChoices] = useState<PortalActionEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [chosen, setChosen] = useState<PortalActionEquipment | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const choose = (e: PortalActionEquipment) => {
    if (action.switch) {
      setChosen(e);
      setMessage(null);
    } else onOpen(action.path.replace("{id}", String(e.id)));
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const t = window.setTimeout(async () => {
      const res = await apiClient.portalActionEquipment(action.key, query.trim(), controller.signal);
      if (controller.signal.aborted) return;
      setLoading(false);
      setChoices(res.data?.equipment ?? []);
    }, query ? DEBOUNCE_MS : 0);
    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, [action.key, query]);

  // An instrument named in the search words: go straight to it.
  useEffect(() => {
    if (!preselected) return;
    let cancelled = false;
    void apiClient.portalActionEquipment(action.key, preselected.code || preselected.name).then((res) => {
      if (cancelled) return;
      const hit = res.data?.equipment.find((e) => e.id === preselected.id);
      if (hit) choose(hit);
    });
    return () => {
      cancelled = true;
    };
    // Only for the instrument the search named.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action.key, preselected?.id]);

  const toggle = async (on: boolean) => {
    if (!chosen) return;
    setSaving(true);
    const res = await apiClient.runPortalAction(action.key, chosen.id, on);
    setSaving(false);
    if (res.error || !res.data) setMessage({ ok: false, text: res.error || "Not changed." });
    else {
      setChosen(res.data);
      setMessage({ ok: true, text: `${switchName(action.title)} is now ${res.data.on ? "on" : "off"} for ${res.data.name}.` });
    }
  };

  const header = (
    <div className="flex items-center gap-2 border-b px-3 py-2 text-sm">
      <button
        type="button"
        onClick={chosen && !preselected ? () => setChosen(null) : onBack}
        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Back"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
      </button>
      <span className="font-medium">{action.title}</span>
      <span className="truncate text-xs text-muted-foreground">· {action.hint}</span>
    </div>
  );

  if (chosen && action.switch) {
    const name = switchName(action.title);
    return (
      <div data-testid="action-step-switch">
        {header}
        <div className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            <span className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", chosen.on ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200" : "bg-muted text-muted-foreground")}>
              <Power className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <p className="font-medium">{chosen.name}</p>
              <p className="text-sm text-muted-foreground">
                {name} is <span className="font-semibold text-foreground">{chosen.on ? "on" : "off"}</span> for this instrument.
              </p>
            </div>
          </div>
          {message ? (
            <p role="status" className={cn("flex items-center gap-1.5 text-sm", message.ok ? "text-emerald-700 dark:text-emerald-300" : "text-destructive")}>
              {message.ok ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : null}
              {message.text}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={saving} onClick={() => void toggle(!chosen.on)} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Power className="h-4 w-4" aria-hidden />}
              Turn {chosen.on ? "off" : "on"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => (preselected ? onBack() : setChosen(null))}>
              {preselected ? "Back to search" : "Choose another instrument"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Command shouldFilter={false} loop className="rounded-none" data-testid="action-step">
      {header}
      <div className="flex items-center gap-2 border-b px-4" cmdk-input-wrapper="">
        {loading ? <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" aria-hidden /> : <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />}
        <CommandPrimitive.Input
          autoFocus
          value={query}
          onValueChange={setQuery}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !query) onBack();
          }}
          placeholder="Which instrument? Type a name or code…"
          aria-label="Choose an instrument"
          className="flex h-12 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
      </div>
      <CommandList className="max-h-[min(55vh,480px)]">
        {!loading && choices.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">No instrument you can choose matches “{query}”.</p>
        ) : null}
        {choices.length > 0 ? (
          <CommandGroup heading="Your instruments">
            {choices.map((e) => (
              <CommandItem key={e.id} value={`eq-${e.id}`} onSelect={() => choose(e)} className="group">
                <FlaskConical className="mr-3 h-4 w-4 shrink-0 text-muted-foreground group-data-[selected=true]:text-current" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{e.name}</span>
                <span className="ml-2 shrink-0 font-mono text-xs text-muted-foreground group-data-[selected=true]:text-current">{e.code}</span>
                {e.on !== undefined ? (
                  <span className={cn("ml-2 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", e.on ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200" : "bg-muted text-muted-foreground")}>
                    {e.on ? "On" : "Off"}
                  </span>
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </Command>
  );
}
