// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

const api = vi.hoisted(() => ({ assistantTrialMetrics: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiClient: api }));

import AssistantTrialMetrics from "./AssistantTrialMetrics";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("IITR Equipment Booking Assistant trial metrics", () => {
  it("shows the recognition rate, outcomes, top requests and roles", async () => {
    api.assistantTrialMetrics.mockResolvedValue({
      data: {
        days: 30,
        turns: 40,
        recognised: 30,
        recognition_rate: 0.75,
        outcomes: { clarification: 6, action_suggested: 20, unrecognised: 10 },
        sources: { typed: 32, button: 8 },
        top_intents: [{ intent: "assistant:portal:slot_exchange", count: 5 }],
        roles: { admin: 5, student: 30 },
        feedback: { up: 4, down: 1 },
      },
    });
    render(<AssistantTrialMetrics days={30} />);
    expect(await screen.findByText("75% (30)")).toBeTruthy();
    expect(api.assistantTrialMetrics).toHaveBeenCalledWith(30);
    expect(screen.getByText("Asked which one / to clarify")).toBeTruthy();
    expect(screen.getByText("page: slot exchange")).toBeTruthy();
    expect(screen.getByText("Main Administrator")).toBeTruthy();
    expect(screen.getByText("4 / 1")).toBeTruthy();
  });

  it("shows the error when the metrics cannot be loaded", async () => {
    api.assistantTrialMetrics.mockResolvedValue({ error: "Forbidden" });
    render(<AssistantTrialMetrics days={7} />);
    expect(await screen.findByText("Forbidden")).toBeTruthy();
  });
});
