import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface MultiOption {
  value: string;
  label: string;
  group?: string;
  hint?: string;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder = "Search…",
  ariaLabel,
  className,
}: {
  options: MultiOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  searchPlaceholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = new Set(value);
  const groups = Array.from(new Set(options.map((o) => o.group ?? "")));
  const label =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? (options.find((o) => o.value === value[0])?.label ?? placeholder)
        : `${value.length} selected`;

  const toggle = (v: string) => onChange(selected.has(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel ?? placeholder}
          className={cn("w-56 justify-between font-normal", value.length === 0 && "text-muted-foreground", className)}
        >
          <span className="truncate">{label}</span>
          <span className="ml-2 flex shrink-0 items-center gap-1">
            {value.length > 0 ? (
              <X
                className="h-3.5 w-3.5 opacity-60 hover:opacity-100"
                aria-label="Clear"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange([]);
                }}
              />
            ) : null}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-72">
            <CommandEmpty>No match.</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup key={group || "_"} heading={group || undefined}>
                {options
                  .filter((o) => (o.group ?? "") === group)
                  .map((o) => (
                    <CommandItem key={o.value} value={`${o.label} ${o.hint ?? ""} ${o.value}`} onSelect={() => toggle(o.value)}>
                      <Check className={cn("mr-2 h-4 w-4", selected.has(o.value) ? "opacity-100" : "opacity-0")} />
                      <span className="truncate">{o.label}</span>
                      {o.hint ? <span className="ml-auto pl-2 text-xs text-muted-foreground">{o.hint}</span> : null}
                    </CommandItem>
                  ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
