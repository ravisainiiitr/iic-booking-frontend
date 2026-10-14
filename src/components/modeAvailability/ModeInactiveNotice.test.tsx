// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ModeInactiveNotice from "./ModeInactiveNotice";
import { modeInactiveNextLine } from "@/lib/modeAvailability";

const info = {
  label: "Mode not active",
  message: "Currently running as NMR TXI probe; booking opens when this mode is active.",
  active_mode: { equipment_id: 338, code: "NMR TXI", name: "NMR TXI probe" },
  next_active_dates: ["2026-10-26", "2026-10-27"],
};

afterEach(() => cleanup());

describe("modeInactiveNextLine", () => {
  it("lists the next active days, or nothing when the schedule gives none", () => {
    expect(modeInactiveNextLine(info)).toBe("Next active: Mon 26 Oct, Tue 27 Oct");
    expect(modeInactiveNextLine({ next_active_dates: [] })).toBe("");
    expect(modeInactiveNextLine(null)).toBe("");
  });
});

describe("ModeInactiveNotice", () => {
  it("explains on the equipment page that booking is closed and links to the running mode", () => {
    render(
      <MemoryRouter>
        <ModeInactiveNotice info={info} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("status").textContent).toContain("Mode not active: not available for booking");
    expect(screen.getByText(info.message)).toBeTruthy();
    expect(screen.getByText("Next active: Mon 26 Oct, Tue 27 Oct")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open NMR TXI probe" }).getAttribute("href")).toBe("/equipment/338");
  });

  it("is two short lines without a link on a card", () => {
    render(
      <MemoryRouter>
        <ModeInactiveNotice info={{ ...info, next_active_dates: [] }} compact />
      </MemoryRouter>,
    );
    expect(screen.getByText(info.message)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByText(/Next active/)).toBeNull();
  });
});
