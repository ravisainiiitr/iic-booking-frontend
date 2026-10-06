import * as React from "react";
import { CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dateFromIso, formatDMY, isoFromDate, maskDMY, parseDMY } from "@/lib/dateFormat";
import { cn } from "@/lib/utils";

type NativeInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "onChange" | "type" | "min" | "max"
>;

export interface DateInputProps extends NativeInputProps {
  /** ISO date (YYYY-MM-DD) or "" / null for no date. */
  value: string | null | undefined;
  /**
   * Same as a native date input: `e.target.value` is the ISO date or "". The event is synthetic
   * (only `target` / `currentTarget` value, name and id are meaningful).
   */
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onValueChange?: (iso: string) => void;
  /** Earliest / latest selectable ISO date. */
  min?: string;
  max?: string;
  /** Classes for the text box (the outer wrapper gets `className`). */
  inputClassName?: string;
}

const COARSE_DAY = "[@media(pointer:coarse)]:h-10 [@media(pointer:coarse)]:w-10";

/**
 * Date field that always shows and accepts DD-MM-YYYY, regardless of the browser locale, with a
 * tap-friendly calendar. Drop-in for `<Input type="date">`: the value stays an ISO date.
 */
const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  (
    {
      value,
      onChange,
      onValueChange,
      min,
      max,
      className,
      inputClassName,
      placeholder = "DD-MM-YYYY",
      disabled,
      readOnly,
      name,
      onBlur,
      onKeyDown,
      ...rest
    },
    ref,
  ) => {
    const iso = value ?? "";
    const [text, setText] = React.useState(() => formatDMY(iso));
    const [open, setOpen] = React.useState(false);
    const [invalid, setInvalid] = React.useState(false);

    const inRange = (candidate: string) => (!min || candidate >= min) && (!max || candidate <= max);

    React.useEffect(() => {
      setText((current) => (parseDMY(current) === (iso || null) && current !== "" ? current : formatDMY(iso)));
      setInvalid(Boolean(iso) && ((min && iso < min) || (max && iso > max)) ? true : false);
    }, [iso, min, max]);

    const emit = (next: string) => {
      if (next === iso) return;
      if (onChange) {
        const target = { value: next, name: name ?? "", id: rest.id ?? "", type: "date" };
        const noop = () => {};
        onChange({
          target,
          currentTarget: target,
          type: "change",
          preventDefault: noop,
          stopPropagation: noop,
          persist: noop,
        } as unknown as React.ChangeEvent<HTMLInputElement>);
      }
      onValueChange?.(next);
    };

    const handleText = (raw: string) => {
      const masked = maskDMY(raw);
      setText(masked);
      if (masked.trim() === "") {
        setInvalid(false);
        emit("");
        return;
      }
      const parsed = parseDMY(masked);
      if (parsed) {
        // Like a native date input, typed dates outside min/max are passed on so the page can explain the limit.
        setInvalid(!inRange(parsed));
        emit(parsed);
      } else {
        setInvalid(masked.replace(/\D/g, "").length >= 8);
      }
    };

    const revertIfIncomplete = () => {
      const parsed = parseDMY(text);
      if (text.trim() === "" || parsed) {
        if (parsed) setText(formatDMY(parsed));
        return;
      }
      setText(formatDMY(iso));
      setInvalid(false);
    };

    const selected = dateFromIso(iso) ?? undefined;
    const minDate = dateFromIso(min) ?? undefined;
    const maxDate = dateFromIso(max) ?? undefined;
    const thisYear = new Date().getFullYear();
    const fromYear = minDate?.getFullYear() ?? thisYear - 100;
    const toYear = Math.max(maxDate?.getFullYear() ?? thisYear + 10, fromYear);
    const disabledDays = [
      ...(minDate ? [{ before: minDate }] : []),
      ...(maxDate ? [{ after: maxDate }] : []),
    ];
    const today = new Date();
    const todayIso = isoFromDate(today);

    return (
      <div className={cn("relative w-full", className)}>
        <Input
          {...rest}
          ref={ref}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          value={text}
          disabled={disabled}
          readOnly={readOnly}
          aria-invalid={invalid || rest["aria-invalid"] || undefined}
          className={cn("pr-11 tabular-nums", inputClassName)}
          onChange={(e) => handleText(e.target.value)}
          onBlur={(e) => {
            revertIfIncomplete();
            onBlur?.(e);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && e.altKey) {
              e.preventDefault();
              setOpen(true);
            }
            onKeyDown?.(e);
          }}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled || readOnly}
              className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Choose date from calendar"
            >
              <CalendarDays className="h-4 w-4" aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="z-[200] w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={selected}
              defaultMonth={selected ?? (minDate && minDate > today ? minDate : maxDate && maxDate < today ? maxDate : today)}
              onSelect={(d) => {
                if (d) emit(isoFromDate(d));
                setOpen(false);
              }}
              weekStartsOn={1}
              captionLayout="dropdown-buttons"
              fromYear={fromYear}
              toYear={toYear}
              disabled={disabledDays}
              initialFocus
              classNames={{
                caption_dropdowns: "flex items-center justify-center gap-1",
                dropdown_month: "relative inline-flex items-center",
                dropdown_year: "relative inline-flex items-center",
                dropdown: "absolute inset-0 z-10 w-full cursor-pointer appearance-none opacity-0",
                dropdown_icon: "h-3 w-3",
                caption_label: "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm font-medium",
                vhidden: "sr-only",
                head_cell: cn("w-9 rounded-md text-[0.8rem] font-normal text-muted-foreground", "[@media(pointer:coarse)]:w-10"),
                cell: cn(
                  "relative h-9 w-9 p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:rounded-md [&:has([aria-selected])]:bg-accent",
                  COARSE_DAY,
                ),
                day: cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-md p-0 text-sm font-normal hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-selected:opacity-100",
                  COARSE_DAY,
                ),
              }}
            />
            <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!inRange(todayIso)}
                onClick={() => {
                  emit(todayIso);
                  setOpen(false);
                }}
              >
                Today
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!iso}
                onClick={() => {
                  emit("");
                  setOpen(false);
                }}
              >
                Clear
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  },
);
DateInput.displayName = "DateInput";

export { DateInput };
