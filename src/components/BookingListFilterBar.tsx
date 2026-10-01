import type { ReactNode } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type BookingListFilterOption = { value: string; label: string };

type BookingListFilterBarProps = {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  status: string;
  onStatusChange: (value: string) => void;
  statusOptions: BookingListFilterOption[];
  startDate: string;
  onStartDateChange: (value: string) => void;
  endDate: string;
  onEndDateChange: (value: string) => void;
  equipment: string;
  onEquipmentChange: (value: string) => void;
  equipmentOptions: BookingListFilterOption[];
  onApply: () => void;
  onClear?: () => void;
  moreFilters?: ReactNode;
  moreFiltersActiveCount?: number;
};

export function BookingListFilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search bookings…",
  status,
  onStatusChange,
  statusOptions,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  equipment,
  onEquipmentChange,
  equipmentOptions,
  onApply,
  onClear,
  moreFilters,
  moreFiltersActiveCount = 0,
}: BookingListFilterBarProps) {
  return (
    <form
      className="flex w-full flex-wrap items-center gap-2 lg:flex-nowrap"
      onSubmit={(e) => {
        e.preventDefault();
        onApply();
      }}
    >
      <div className="relative w-full min-w-[8rem] lg:w-auto lg:flex-[2_1_12rem]">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          aria-label="Search"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-9 pl-8"
        />
      </div>
      <Select value={status} onValueChange={onStatusChange}>
        <SelectTrigger className="h-9 w-[11rem] min-w-[6.5rem] lg:w-auto lg:flex-[1_1_9rem]" aria-label="Status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="date"
        aria-label="Start date"
        title="Start date"
        value={startDate}
        onChange={(e) => onStartDateChange(e.target.value)}
        className="h-9 w-[9.5rem] min-w-[8rem] lg:w-auto lg:flex-[1_1_9rem]"
      />
      <Input
        type="date"
        aria-label="End date"
        title="End date"
        value={endDate}
        onChange={(e) => onEndDateChange(e.target.value)}
        className="h-9 w-[9.5rem] min-w-[8rem] lg:w-auto lg:flex-[1_1_9rem]"
      />
      <Select value={equipment || "all"} onValueChange={onEquipmentChange}>
        <SelectTrigger className="h-9 w-[13rem] min-w-[7rem] lg:w-auto lg:flex-[1.5_1_11rem]" aria-label="Equipment">
          <SelectValue placeholder="All equipment" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All equipment</SelectItem>
          {equipmentOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {moreFilters ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-9 shrink-0 gap-1.5">
              <SlidersHorizontal className="h-4 w-4" aria-hidden />
              More filters
              {moreFiltersActiveCount > 0 ? (
                <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                  {moreFiltersActiveCount}
                </span>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 space-y-3">
            {moreFilters}
            <div className="flex justify-end">
              <Button type="button" size="sm" onClick={onApply}>
                Apply
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
      <Button type="submit" size="sm" className="h-9 shrink-0">
        Apply
      </Button>
      {onClear ? (
        <Button type="button" variant="ghost" size="sm" className="h-9 shrink-0" onClick={onClear}>
          Clear
        </Button>
      ) : null}
    </form>
  );
}
