import * as React from "react";

import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface DateTimeInputProps {
  /** Local date-time as for `<input type="datetime-local">`: "YYYY-MM-DDTHH:mm" (seconds allowed), or "". */
  value: string | null | undefined;
  /** `e.target.value` is "YYYY-MM-DDTHH:mm" or "" (synthetic event, like DateInput). */
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onValueChange?: (value: string) => void;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  inputClassName?: string;
  min?: string;
  max?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean | "true" | "false";
}

const split = (value: string | null | undefined): [string, string] => {
  const m = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/.exec(value ?? "");
  return m ? [m[1], m[2] ?? ""] : ["", ""];
};

/** Date (DD-MM-YYYY with calendar) and time (24 h) fields. Drop-in for `<Input type="datetime-local">`. */
function DateTimeInput({
  value,
  onChange,
  onValueChange,
  id,
  name,
  disabled,
  required,
  className,
  inputClassName,
  min,
  max,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: DateTimeInputProps) {
  const [date, time] = split(value);
  const [pendingTime, setPendingTime] = React.useState(time);
  React.useEffect(() => {
    if (time) setPendingTime(time);
  }, [time]);

  const emit = (next: string) => {
    if (next === (value ?? "")) return;
    if (onChange) {
      const target = { value: next, name: name ?? "", id: id ?? "", type: "datetime-local" };
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

  const [minDate] = split(min);
  const [maxDate] = split(max);

  return (
    <div className={cn("flex w-full flex-wrap items-center gap-2 sm:flex-nowrap", className)}>
      <DateInput
        id={id}
        name={name}
        value={date}
        min={minDate || undefined}
        max={maxDate || undefined}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
        className="min-w-[9.5rem] flex-1"
        inputClassName={inputClassName}
        onValueChange={(d) => emit(d ? `${d}T${time || pendingTime || "00:00"}` : "")}
      />
      <Input
        type="time"
        value={time || pendingTime}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel ? `${ariaLabel} (time)` : "Time"}
        aria-invalid={ariaInvalid}
        className={cn("w-[7.5rem] shrink-0", inputClassName)}
        onChange={(e) => {
          const t = e.target.value;
          setPendingTime(t);
          if (date) emit(`${date}T${t || "00:00"}`);
        }}
      />
    </div>
  );
}

export { DateTimeInput };
