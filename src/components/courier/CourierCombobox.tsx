import { useId, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2, RotateCw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Courier } from "@/lib/courierTrackingApi";
import { cn } from "@/lib/utils";

import { filterCouriers } from "./courierHelpers";

export interface CourierComboboxProps {
  /** Selected courier's API slug ("" for none). */
  value: string;
  onChange: (slug: string) => void;
  couriers: Courier[] | undefined;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  id?: string;
  labelId?: string;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
}

export function CourierCombobox({
  value,
  onChange,
  couriers,
  loading = false,
  error = false,
  onRetry,
  id,
  labelId,
  invalid = false,
  describedBy,
  disabled = false,
}: CourierComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const listId = useId();
  const list = useMemo(() => couriers ?? [], [couriers]);
  const selected = useMemo(() => list.find((c) => c.slug === value), [list, value]);
  const filtered = useMemo(() => filterCouriers(list, query), [list, query]);

  const choose = (slug: string) => {
    onChange(slug);
    setOpen(false);
    setQuery("");
  };

  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm"
      >
        <span>The courier list could not be loaded, so a courier cannot be chosen yet.</span>
        {onRetry ? (
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            <RotateCw className="mr-1 h-4 w-4" aria-hidden="true" /> Retry
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-haspopup="listbox"
            aria-labelledby={labelId}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            disabled={disabled || loading}
            className={cn(
              "h-10 w-full min-w-0 justify-between font-normal",
              !selected && "text-muted-foreground",
              invalid && "border-destructive focus-visible:ring-destructive",
            )}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading couriers…
              </span>
            ) : (
              <span className="truncate text-left">{selected ? selected.name : "Select a courier"}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] min-w-[16rem] max-w-[calc(100vw-1.5rem)] p-0"
          align="start"
          collisionPadding={12}
        >
          <Command shouldFilter={false} label="Search courier name">
            <CommandInput
              placeholder="Search courier name..."
              value={query}
              onValueChange={setQuery}
            />
            <CommandList id={listId} className="max-h-[min(18rem,50vh)] overscroll-contain">
              <CommandEmpty>No matching courier found. Try a different name.</CommandEmpty>
              <CommandGroup>
                {filtered.map((courier) => (
                  <CommandItem
                    key={courier.slug}
                    value={courier.slug}
                    onSelect={() => choose(courier.slug)}
                    className="min-h-10 cursor-pointer"
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4 shrink-0", value === courier.slug ? "opacity-100" : "opacity-0")}
                      aria-hidden="true"
                    />
                    <span className="truncate">{courier.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected && !disabled ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0"
          aria-label={`Clear courier ${selected.name}`}
          onClick={() => onChange("")}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}

export default CourierCombobox;
