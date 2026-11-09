// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { IntegrationHealth } from "@/lib/api";

const api = vi.hoisted(() => ({ getIntegrationHealth: vi.fn(), runIntegrationHealth: vi.fn() }));
vi.mock("@/lib/api", () => ({ apiClient: api }));

import IntegrationHealthCard, { componentStatus } from "./IntegrationHealthCard";

function health(over: Partial<IntegrationHealth> = {}): IntegrationHealth {
  return {
    generated_at: "2026-11-09T14:30:00Z",
    duration_ms: 900,
    overall: "fail",
    fixes: {},
    checks: [
      { key: "istem_queue", component: "istem", title: "I-STEM queue is moving", status: "ok", summary: "No job overdue.", items: [], action: "", count: 0 },
      {
        key: "whatsapp_delivery", component: "whatsapp", title: "WhatsApp messages delivered", status: "fail",
        summary: "6 of 9 message(s) refused in the last 24 hours.",
        items: ["Meta 131037: 6 message(s) - The WhatsApp number's display name is not approved."],
        action: "Approve the display name in Meta WhatsApp Manager.", count: 6,
      },
      { key: "payments", component: "payments", title: "Online payments", status: "off", summary: "Off.", items: [], action: "", count: 0 },
    ],
    ...over,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("IntegrationHealthCard", () => {
  it("shows each service's state and what to do about a failing step", async () => {
    api.getIntegrationHealth.mockResolvedValue({ data: health() });
    render(<IntegrationHealthCard />);
    expect((await screen.findByTestId("integration-health-overall")).textContent).toBe("1 problem");
    expect(screen.getByTestId("health-istem").getAttribute("data-status")).toBe("ok");
    expect(screen.getByTestId("health-whatsapp").getAttribute("data-status")).toBe("fail");
    expect(screen.getByTestId("health-payments").getAttribute("data-status")).toBe("off");
    await userEvent.setup().click(screen.getByRole("button", { name: /WhatsApp messages delivered/ }));
    expect(screen.getByText(/Meta 131037: 6 message/)).toBeTruthy();
    expect(screen.getByText(/Approve the display name/)).toBeTruthy();
  });

  it("runs the checks and fixes on demand", async () => {
    api.getIntegrationHealth.mockResolvedValue({ data: health() });
    api.runIntegrationHealth.mockResolvedValue({ data: health({ overall: "ok", checks: [health().checks[0]] }) });
    render(<IntegrationHealthCard />);
    await screen.findByTestId("integration-health-overall");
    await userEvent.setup().click(screen.getByRole("button", { name: /Check and fix now/ }));
    expect(api.runIntegrationHealth).toHaveBeenCalledOnce();
    expect((await screen.findByTestId("integration-health-overall")).textContent).toBe("All working");
  });

  it("shows nothing to anyone but the Main Administrator", async () => {
    api.getIntegrationHealth.mockResolvedValue({ error: "Only the Main Administrator can view integration health." });
    const { container } = render(<IntegrationHealthCard />);
    await vi.waitFor(() => expect(api.getIntegrationHealth).toHaveBeenCalled());
    expect(container.innerHTML).toBe("");
  });

  it("rolls checks up to the worst state per service", () => {
    expect(componentStatus(health().checks, "whatsapp")).toBe("fail");
    expect(componentStatus(health().checks, "email")).toBe("off");
  });
});
