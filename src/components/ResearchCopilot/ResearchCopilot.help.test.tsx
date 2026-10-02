// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const api = vi.hoisted(() => ({
  researchCopilotBootstrap: vi.fn(),
  researchCopilotPublicBootstrap: vi.fn(),
  researchCopilotListConversations: vi.fn(),
  researchCopilotCreateConversation: vi.fn(),
  researchCopilotSendMessage: vi.fn(),
  researchCopilotFeedback: vi.fn(),
  researchCopilotEscalate: vi.fn(),
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiClient: api,
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: true, loading: false }),
}));

import ResearchCopilot from "./index";
import ResearchCopilotLauncher from "./ResearchCopilotLauncher";
import { offerAssistantHelp } from "@/lib/assistantHelp";

const CONV = "11111111-1111-4111-8111-111111111111";
const REPLY_ID = "22222222-2222-4222-8222-222222222222";
const FEEDBACK_ID = "33333333-3333-4333-8333-333333333333";

const STARTERS = [
  { id: "s1", label: "Book equipment", action_type: "ba_flow", payload: { step: "start" } },
  { id: "s2", label: "My upcoming bookings", prompt: "Show my upcoming bookings" },
  { id: "s3", label: "How much will it cost?", prompt: "How much do 5 XRD samples cost?" },
  { id: "s4", label: "Link supervisor's wallet", prompt: "How do I link my supervisor's wallet?" },
];

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

beforeEach(() => {
  vi.clearAllMocks();
  api.researchCopilotBootstrap.mockResolvedValue({
    data: {
      enabled: true,
      assistant_name: "IIC Booking Assistant",
      suggested_prompts: ["What is HOLD?"],
      command_actions: [{ id: "c1", label: "Cancellation rules", prompt: "How do I cancel a booking?" }],
      starter_actions: STARTERS,
      intelligence: { enabled: false, knowledge: true },
    },
  });
  api.researchCopilotListConversations.mockResolvedValue({ data: { results: [] } });
  api.researchCopilotCreateConversation.mockResolvedValue({ data: { conversation: { id: CONV } } });
  api.researchCopilotSendMessage.mockResolvedValue({
    data: {
      conversation_id: CONV,
      message: {
        id: REPLY_ID,
        role: "assistant",
        content: "Someone else booked that **XRD** slot just before you. Here are the next free times.",
        metadata: { intent: "assistant:help_slot_taken" },
        suggested_actions: [
          { id: "a1", label: "Join the waitlist", href: "/equipments/5/book" },
          { id: "a2", label: "Back to booking form", href: "/equipments/5/book" },
          { id: "a3", label: "Check charges", action_type: "ba_info", payload: { equipment_id: 5, topic: "charges" } },
        ],
      },
    },
  });
  api.researchCopilotFeedback.mockResolvedValue({ data: { id: FEEDBACK_ID, rating: "down" } });
});

afterEach(cleanup);

describe("welcome starter chips", () => {
  it("shows a short welcome with the role-based starters and keeps other quick actions one tap away", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ResearchCopilot initialOpen initialBackendEnabled />
      </MemoryRouter>,
    );
    for (const s of STARTERS) expect(await screen.findByRole("button", { name: s.label })).toBeTruthy();
    expect(screen.getByText(/Pick one below or ask in your own words/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cancellation rules" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "More quick actions" }));
    expect(screen.getByRole("button", { name: "Cancellation rules" })).toBeTruthy();
  });

  it("a starter chip asks the assistant and the answer gets next-step chips and 'Was this helpful?'", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ResearchCopilot initialOpen initialBackendEnabled />
      </MemoryRouter>,
    );
    await user.click(await screen.findByRole("button", { name: "My upcoming bookings" }));
    await waitFor(() => expect(api.researchCopilotSendMessage).toHaveBeenCalledWith(CONV, "Show my upcoming bookings", undefined, undefined));
    expect(await screen.findByRole("button", { name: "Join the waitlist" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Check charges" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "No, this was not helpful" }));
    expect(api.researchCopilotFeedback).toHaveBeenLastCalledWith(CONV, {
      rating: "down",
      message_id: REPLY_ID,
      comment: undefined,
      feedback_id: undefined,
    });
    await user.type(screen.getByLabelText(/What were you looking for\?/), "My XRD booking on Friday{Enter}");
    expect(api.researchCopilotFeedback).toHaveBeenLastCalledWith(CONV, {
      rating: "down",
      message_id: REPLY_ID,
      comment: "My XRD booking on Friday",
      feedback_id: FEEDBACK_ID,
    });
  });
});

describe("Need help? after a booking failure", () => {
  it("shows a dismissible prompt and opens the assistant with the failure context", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/equipments/5/book"]}>
        <ResearchCopilotLauncher />
      </MemoryRouter>,
    );
    await screen.findByRole("button", { name: "Open Booking Assistant" });

    act(() => offerAssistantHelp({ code: "slot_taken", equipmentId: 5, equipmentName: "XRD", message: "Slot not available" }));
    expect(screen.getByText("Need help?")).toBeTruthy();
    expect(screen.getByText(/find you another free slot/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Dismiss help offer" }));
    expect(screen.queryByText("Need help?")).toBeNull();
    act(() => offerAssistantHelp({ code: "slot_taken", equipmentId: 5 }));
    expect(screen.queryByText("Need help?")).toBeNull();

    act(() => offerAssistantHelp({ code: "quota", equipmentId: 5, equipmentName: "XRD", message: "Weekly quota exceeded" }));
    expect(screen.getByText(/how much quota is left/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Ask the Booking Assistant" }));

    await waitFor(() =>
      expect(api.researchCopilotSendMessage).toHaveBeenCalledWith(
        CONV,
        "My booking went over the quota — what can I do? (XRD)",
        undefined,
        { type: "ba_help", payload: { code: "quota_exceeded", equipment_id: 5, message: "Weekly quota exceeded" } },
      ),
    );
    expect(api.researchCopilotSendMessage).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: "Join the waitlist" })).toBeTruthy();
    expect(screen.queryByText("Need help?")).toBeNull();
  });
});
