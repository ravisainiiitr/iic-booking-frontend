// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";

import { DateTimeInput } from "./datetime-input";

afterEach(cleanup);

function Harness({ initial = "", onValue }: { initial?: string; onValue?: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <DateTimeInput
      aria-label="Starts"
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        onValue?.(e.target.value);
      }}
    />
  );
}

describe("DateTimeInput", () => {
  it("shows the date as DD-MM-YYYY and the time separately", () => {
    render(<Harness initial="2026-10-06T14:30" />);
    expect((screen.getByLabelText("Starts") as HTMLInputElement).value).toBe("06-10-2026");
    expect((screen.getByLabelText("Starts (time)") as HTMLInputElement).value).toBe("14:30");
  });

  it("emits a local date-time value when either part changes", () => {
    const onValue = vi.fn();
    render(<Harness initial="2026-10-06T14:30" onValue={onValue} />);
    fireEvent.change(screen.getByLabelText("Starts"), { target: { value: "07-10-2026" } });
    expect(onValue).toHaveBeenLastCalledWith("2026-10-07T14:30");
    fireEvent.change(screen.getByLabelText("Starts (time)"), { target: { value: "09:15" } });
    expect(onValue).toHaveBeenLastCalledWith("2026-10-07T09:15");
  });

  it("keeps a time chosen before the date and clears with the date", () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    fireEvent.change(screen.getByLabelText("Starts (time)"), { target: { value: "10:00" } });
    expect(onValue).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Starts"), { target: { value: "08-10-2026" } });
    expect(onValue).toHaveBeenLastCalledWith("2026-10-08T10:00");
    fireEvent.change(screen.getByLabelText("Starts"), { target: { value: "" } });
    expect(onValue).toHaveBeenLastCalledWith("");
  });
});
