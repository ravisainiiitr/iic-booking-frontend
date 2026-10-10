import { RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { activeFilterCount, EMPTY_FILTERS, type AudienceFilters, type GroupsOptions } from "@/lib/facilityGroupsApi";
import { departmentOptions } from "./format";
import { MultiSelect } from "./MultiSelect";

export function AudienceFiltersBar({
  value,
  onChange,
  options,
  showSearch = true,
  idPrefix,
}: {
  value: AudienceFilters;
  onChange: (next: AudienceFilters) => void;
  options: GroupsOptions | null;
  showSearch?: boolean;
  idPrefix: string;
}) {
  const set = <K extends keyof AudienceFilters>(key: K, v: AudienceFilters[K]) => onChange({ ...value, [key]: v });
  const count = activeFilterCount(value) + (showSearch && value.search.trim() ? 1 : 0);

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center gap-2">
        {showSearch ? (
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={value.search}
              onChange={(e) => set("search", e.target.value)}
              placeholder="Name, email, ID, mobile"
              className="w-60 pl-8"
              aria-label="Search people"
            />
          </div>
        ) : null}
        <MultiSelect
          options={departmentOptions(options)}
          value={value.department_ids.map(String)}
          onChange={(ids) => set("department_ids", ids.map(Number))}
          placeholder="All departments / organisations"
          searchPlaceholder="Search departments"
          ariaLabel="Departments"
          className="w-64"
        />
        <Select value={value.audience || "all"} onValueChange={(v) => set("audience", v === "all" ? "" : (v as AudienceFilters["audience"]))}>
          <SelectTrigger className="w-44" aria-label="Internal or external">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Internal & external</SelectItem>
            <SelectItem value="internal">Internal (IITR)</SelectItem>
            <SelectItem value="external">External</SelectItem>
          </SelectContent>
        </Select>
        <MultiSelect
          options={(options?.user_types ?? []).map((t) => ({ value: t.value, label: t.label }))}
          value={value.user_types}
          onChange={(v) => set("user_types", v)}
          placeholder="All user types"
          ariaLabel="User types"
        />
        <div className="flex items-center gap-1.5">
          <Label htmlFor={`${idPrefix}-from`} className="text-xs text-muted-foreground">
            Booked from
          </Label>
          <DateInput id={`${idPrefix}-from`} value={value.booked_from} onValueChange={(v) => set("booked_from", v)} className="w-40" />
          <Label htmlFor={`${idPrefix}-to`} className="text-xs text-muted-foreground">
            to
          </Label>
          <DateInput id={`${idPrefix}-to`} value={value.booked_to} onValueChange={(v) => set("booked_to", v)} className="w-40" />
        </div>
        {count ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...EMPTY_FILTERS })}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Clear filters
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        {(
          [
            ["include_supervisors", "Include supervising faculty", "Faculty whose students / project staff booked"],
            ["include_inactive", "Include inactive accounts", ""],
            ["include_test_accounts", "Include test accounts", ""],
          ] as const
        ).map(([key, label, hint]) => (
          <div key={key} className="flex items-center gap-2" title={hint || undefined}>
            <Checkbox id={`${idPrefix}-${key}`} checked={value[key]} onCheckedChange={(v) => set(key, v === true)} />
            <Label htmlFor={`${idPrefix}-${key}`} className="font-normal">
              {label}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
