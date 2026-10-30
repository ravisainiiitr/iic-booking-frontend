import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import STATES from "@/data/indianStatesDistricts.json";

/**
 * Address pickers shared by every address form (shipping label, billing and shipping profile, invoice address):
 * Country (searchable, India by default), State (the States and Union Territories list when the country is India,
 * free text otherwise) and City (the chosen state's districts, or any other town typed in). Values are plain names,
 * as the address fields have always stored them.
 */
export const DEFAULT_COUNTRY = "India";

type StateRow = { code: string; name: string; type: string; districts: string[] };
const INDIAN_STATES = STATES as StateRow[];

export const isIndia = (country: string | null | undefined) => {
  const c = String(country ?? "").trim().toLowerCase();
  return c === "" || c === "india" || c === "in" || c === "bharat";
};

export function districtsFor(stateName: string | null | undefined): string[] {
  const s = String(stateName ?? "").trim().toLowerCase();
  return INDIAN_STATES.find((r) => r.name.toLowerCase() === s || r.code === s)?.districts ?? [];
}

let countryCache: string[] | null = null;
export function countryNames(): string[] {
  if (countryCache) return countryCache;
  const names = new Set<string>();
  try {
    const dn = new Intl.DisplayNames(["en"], { type: "region" });
    const A = 65;
    for (let i = 0; i < 26; i++) {
      for (let j = 0; j < 26; j++) {
        const code = String.fromCharCode(A + i) + String.fromCharCode(A + j);
        const name = dn.of(code);
        if (name && name !== code && !/unknown|world|europe|outlying|pseudo/i.test(name)) names.add(name);
      }
    }
  } catch {
    /* very old browsers: India and free text only */
  }
  names.add(DEFAULT_COUNTRY);
  countryCache = [...names].sort((a, b) => a.localeCompare(b));
  return countryCache;
}

type PickerProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  placeholder?: string;
};

/** Searchable list; ``allowCustom`` offers the typed text as a value when it is not in the list. */
function SearchPicker({
  id,
  value,
  onChange,
  disabled,
  invalid,
  placeholder,
  groups,
  allowCustom,
  searchPlaceholder,
  emptyText,
}: PickerProps & {
  groups: Array<{ heading?: string; items: string[] }>;
  allowCustom: boolean;
  searchPlaceholder: string;
  emptyText: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const typed = query.trim();
  const known = useMemo(() => new Set(groups.flatMap((g) => g.items).map((s) => s.toLowerCase())), [groups]);
  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery("");
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground")}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>{allowCustom && typed ? null : emptyText}</CommandEmpty>
            {allowCustom && typed && !known.has(typed.toLowerCase()) ? (
              <CommandGroup heading="Not in the list">
                <CommandItem value={`__custom__${typed}`} onSelect={() => choose(typed)}>
                  Use “{typed}”
                </CommandItem>
              </CommandGroup>
            ) : null}
            {groups.map((g) =>
              g.items.length ? (
                <CommandGroup key={g.heading ?? "items"} heading={g.heading}>
                  {g.items.map((item) => (
                    <CommandItem key={item} value={item} onSelect={() => choose(item)}>
                      <Check className={cn("mr-2 h-4 w-4", value === item ? "opacity-100" : "opacity-0")} aria-hidden />
                      {item}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null,
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Country, India unless the user picks another. An empty value is set to India once. */
export function CountryPicker({ id, value, onChange, disabled, invalid }: PickerProps) {
  useEffect(() => {
    if (!String(value ?? "").trim()) onChange(DEFAULT_COUNTRY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const items = useMemo(() => countryNames(), []);
  return (
    <SearchPicker
      id={id}
      value={value}
      onChange={onChange}
      disabled={disabled}
      invalid={invalid}
      placeholder="Select country"
      groups={[{ items }]}
      allowCustom
      searchPlaceholder="Search country..."
      emptyText="No country found."
    />
  );
}

/** State: States and Union Territories of India, or free text for another country. */
export function StatePicker({ id, value, onChange, disabled, invalid, country }: PickerProps & { country?: string }) {
  if (!isIndia(country)) {
    return <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-invalid={invalid || undefined} placeholder="State / province" />;
  }
  return (
    <SearchPicker
      id={id}
      value={value}
      onChange={onChange}
      disabled={disabled}
      invalid={invalid}
      placeholder="Select state / union territory"
      groups={[
        { heading: "States", items: INDIAN_STATES.filter((s) => s.type !== "union_territory").map((s) => s.name) },
        { heading: "Union Territories", items: INDIAN_STATES.filter((s) => s.type === "union_territory").map((s) => s.name) },
      ]}
      allowCustom={false}
      searchPlaceholder="Search state or union territory..."
      emptyText="No state or union territory found."
    />
  );
}

/** City: the districts of the chosen Indian state, or any other town typed in. */
export function CityPicker({ id, value, onChange, disabled, invalid, country, state }: PickerProps & { country?: string; state?: string }) {
  const districts = useMemo(() => (isIndia(country) ? districtsFor(state) : []), [country, state]);
  if (!isIndia(country)) {
    return <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-invalid={invalid || undefined} placeholder="City / town" />;
  }
  return (
    <SearchPicker
      id={id}
      value={value}
      onChange={onChange}
      disabled={disabled}
      invalid={invalid}
      placeholder={state ? "Select or type city / town" : "Type city / town (select the state for suggestions)"}
      groups={[{ heading: districts.length ? `Districts of ${state}` : undefined, items: districts }]}
      allowCustom
      searchPlaceholder="Search or type your city / town..."
      emptyText="Type your city or town."
    />
  );
}
