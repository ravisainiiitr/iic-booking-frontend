// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

afterEach(() => cleanup());
import { MemoryRouter } from "react-router-dom";
import { SessionBar } from "./SessionBar";

function renderBar(fullscreen: "page" | "browser" | null = null) {
  render(
    <MemoryRouter>
      <SessionBar
        equipmentName="DSA Test Equipment (TEST)"
        bookingLabel="IICDSATEST202600037"
        remainingSeconds={1692}
        canExtend
        extendMinutes={15}
        onExtend={vi.fn()}
        onEnd={vi.fn()}
        sync={{ onSync: vi.fn(), running: false, destination: "My Research" }}
        onReconnect={vi.fn()}
        fullscreen={fullscreen}
        onToggleFullscreen={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe("SessionBar", () => {
  it("shows instrument, booking and time, with End Analysis last and no input/results buttons", () => {
    renderBar();
    expect(screen.getByText("DSA Test Equipment (TEST)")).toBeTruthy();
    expect(screen.getByText("IICDSATEST202600037")).toBeTruthy();
    expect(screen.getByTestId("session-timer").textContent).toContain("00:28:12");
    expect(screen.queryByText("Input data")).toBeNull();
    expect(screen.queryByText(/Results to save/)).toBeNull();
    const buttons = screen.getAllByRole("button");
    expect(buttons[buttons.length - 1].textContent).toBe("End Analysis");
  });

  it("offers Exit full screen in page full screen and the F11 hint in browser full screen", () => {
    renderBar("page");
    expect(screen.getByText("Exit full screen")).toBeTruthy();
  });

  it("tells F11 users how to leave", () => {
    renderBar("browser");
    expect(screen.getByText("Press F11 to exit full screen")).toBeTruthy();
  });
});

describe("SessionBar extend window", () => {
  const renderAt = (remainingSeconds: number, canExtend = true) =>
    render(
      <MemoryRouter>
        <SessionBar
          equipmentName="DSA"
          bookingLabel="B1"
          remainingSeconds={remainingSeconds}
          canExtend={canExtend}
          extendMinutes={15}
          onExtend={vi.fn()}
          onEnd={vi.fn()}
          onReconnect={vi.fn()}
          fullscreen={null}
          onToggleFullscreen={vi.fn()}
        />
      </MemoryRouter>,
    );

  it("opens with the 15-minute warning", () => {
    renderAt(14 * 60);
    expect((screen.getByRole("button", { name: "+15 min" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("stays closed before the last 15 minutes", () => {
    renderAt(20 * 60);
    expect((screen.getByRole("button", { name: "+15 min" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
