// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BookingJourney, journeySteps } from "./BookingJourney";

afterEach(() => cleanup());

const states = (b: Parameters<typeof journeySteps>[0], external = true) =>
  journeySteps(b, { external }).map((s) => `${s.key}:${s.state}`);

describe("booking journey", () => {
  it("external: payment comes before the label and form", () => {
    expect(states({ status: "PENDING_PAYMENT" })).toEqual([
      "booked:done", "paid:current", "sent:todo", "received:todo", "analysis:todo", "results:todo",
    ]);
    expect(states({ status: "BOOKED" })).toEqual([
      "booked:done", "paid:done", "sent:current", "received:todo", "analysis:todo", "results:todo",
    ]);
  });

  it("follows the sample trace to the results", () => {
    expect(states({ status: "BOOKED", sample_trace: [{ status: "SAMPLE_SENT" }] })[3]).toBe("received:current");
    expect(states({ status: "BOOKED", sample_trace: [{ status: "SAMPLE_SENT" }, { status: "SAMPLE_ACCEPTED" }] })[4]).toBe("analysis:current");
    expect(states({ status: "COMPLETED", has_results: true }).every((s) => s.endsWith(":done"))).toBe(true);
  });

  it("internal users have no payment step and a hand-over step", () => {
    const steps = journeySteps({ status: "BOOKED" }, { external: false });
    expect(steps.map((s) => s.key)).toEqual(["booked", "sent", "received", "analysis", "results"]);
    expect(steps[1].label).toBe("Sample handed over");
  });

  it("a cancelled booking stops at the step it reached", () => {
    expect(states({ status: "CANCELLED" }).slice(1, 3)).toEqual(["paid:done", "sent:stopped"]);
  });

  it("shows the next action for the current step", () => {
    render(<BookingJourney booking={{ status: "BOOKED" }} external />);
    expect(screen.getByTestId("journey-hint").textContent).toContain("shipping label and requisition form");
    expect(screen.getByText("Paid").closest("li")?.getAttribute("aria-current")).toBeNull();
  });
});
