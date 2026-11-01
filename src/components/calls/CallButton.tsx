import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { CallContextType, CallOptions, CallRole } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useCalls } from "./CallProvider";

type Props = {
  context: CallContextType;
  id: number;
  role: CallRole;
  /** e.g. "Call Lab Operator"; defaults to "Call <role label>". */
  label?: string;
  reason?: string;
  className?: string;
};

/**
 * "Call Lab Operator" / "Call OIC" / "Call Accounts In Charge" for one booking, instrument or invoice. Shows nothing
 * unless calling is open to the user and the role has someone configured. With several eligible people it offers a
 * short labelled choice; when nobody can be reached it points to the Officer In Charge or a support ticket.
 */
export default function CallButton({ context, id, role, label, reason = "", className }: Props) {
  const { enabled, engine, loadOptions, state } = useCalls();
  const [options, setOptions] = useState<CallOptions | null>(null);

  useEffect(() => {
    if (!enabled || !id) return;
    let cancelled = false;
    void loadOptions(context, id).then((o) => !cancelled && setOptions(o));
    return () => {
      cancelled = true;
    };
  }, [enabled, context, id, loadOptions]);

  const entry = options?.roles.find((r) => r.role === role);
  if (!enabled || !engine || !entry || entry.people.length === 0) return null;
  const busy = state.phase !== "idle" && state.phase !== "ended";
  const text = label ?? `Call ${entry.label}`;
  const reachable = entry.people.filter((p) => p.available);
  const start = (calleeId?: number) => void engine.call(context, id, role, calleeId, reason);

  if (reachable.length === 0) {
    return (
      <p className={cn("flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground", className)}>
        <Phone className="h-3.5 w-3.5" aria-hidden /> {entry.label} cannot take calls right now.
        {entry.fallback === "oic" && role !== "oic" ? (
          <button type="button" className="font-medium text-primary hover:underline" disabled={busy} onClick={() => void engine.call(context, id, "oic", undefined, reason)}>
            Call the Officer In Charge instead
          </button>
        ) : (
          <Link to="/tickets" className="font-medium text-primary hover:underline">Raise a support ticket</Link>
        )}
      </p>
    );
  }

  if (entry.people.length === 1) {
    return (
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => start(entry.people[0]!.id)}
        className={cn("gap-1.5", className)} aria-label={`${text}: ${entry.people[0]!.name}`}>
        <Phone className="h-4 w-4" aria-hidden /> {text}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" variant="outline" disabled={busy} className={cn("gap-1.5", className)}>
          <Phone className="h-4 w-4" aria-hidden /> {text}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Choose whom to call</DropdownMenuLabel>
        {entry.people.map((p) => (
          <DropdownMenuItem key={p.id} disabled={!p.available} onSelect={() => start(p.id)}>
            <span className={cn("mr-2 inline-block h-2 w-2 rounded-full", p.available ? "bg-emerald-500" : "bg-muted-foreground/40")} aria-hidden />
            {p.name}
            {!p.available ? <span className="ml-2 text-xs text-muted-foreground">not reachable</span> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
