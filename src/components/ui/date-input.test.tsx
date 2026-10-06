// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";

import { DateInput } from "./date-input";

afterEach(cleanup);

function Harness({ initial = "", min, onIso }: { initial?: string; min?: string; onIso?: (v: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <DateInput
      aria-label="Date"
      value={value}
      min={min}
      onChange={(e) => {
        setValue(e.target.value);
        onIso?.(e.target.value);
      }}
    />
  );
}

describe("DateInput", () => {
  it("shows an ISO value as DD-MM-YYYY", () => {
    render(<Harness initial="2026-10-06" />);
    const input = screen.getByLabelText("Date") as HTMLInputElement;
    expect(input.value).toBe("06-10-2026");
    expect(input.placeholder).toBe("DD-MM-YYYY");
    expect(input.type).toBe("text");
  });

  it("emits ISO when a full DD-MM-YYYY date is typed and auto-inserts dashes", () => {
    const onIso = vi.fn();
    render(<Harness onIso={onIso} />);
    const input = screen.getByLabelText("Date") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "15112026" } });
    expect(input.value).toBe("15-11-2026");
    expect(onIso).toHaveBeenLastCalledWith("2026-11-15");
  });

  it("emits an empty value when cleared", () => {
    const onIso = vi.fn();
    render(<Harness initial="2026-10-06" onIso={onIso} />);
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "" } });
    expect(onIso).toHaveBeenLastCalledWith("");
  });

  it("passes on a typed date before min but marks it invalid, like a native date input", () => {
    const onIso = vi.fn();
    render(<Harness initial="2026-10-10" min="2026-10-05" onIso={onIso} />);
    const input = screen.getByLabelText("Date") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "01-10-2026" } });
    expect(onIso).toHaveBeenLastCalledWith("2026-10-01");
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("reverts incomplete text on blur", () => {
    const onIso = vi.fn();
    render(<Harness initial="2026-10-10" onIso={onIso} />);
    const input = screen.getByLabelText("Date") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "31-02" } });
    expect(onIso).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(input.value).toBe("10-10-2026");
  });

  it("has a calendar button", () => {
    render(<Harness />);
    expect(screen.getByRole("button", { name: "Choose date from calendar" })).toBeTruthy();
  });
});
