// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Link, MemoryRouter } from "react-router-dom";

import BestSlotsPanel from "./BestSlotsPanel";
import TicketTriageCard from "./TicketTriageCard";
import { resetAutomationFeaturesCache } from "./useAutomationFeatures";
import InstrumentFinder from "@/pages/InstrumentFinder";
import AdminSettingsAutomation from "@/pages/AdminSettingsAutomation";

const api = vi.hoisted(() => ({
  automationFeatures: vi.fn(),
  slotSuggestions: vi.fn(),
  instrumentFinder: vi.fn(),
  ticketTriage: vi.fn(),
  ticketTriageDecision: vi.fn(),
  automationSettings: vi.fn(),
  updateAutomationSettings: vi.fn(),
  automationLog: vi.fn(),
  automationPreviewOicAlerts: vi.fn(),
  automationPreviewNoShow: vi.fn(),
  automationPreviewTicketTriage: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ apiClient: api }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: 1, user_type: "admin" } }) }));
vi.mock("@/components/PageShell", () => ({
  PageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PageHero: ({ title, children }: { title: string; children?: ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {children}
    </header>
  ),
  StandaloneOnly: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const wrap = (ui: ReactNode, path = "/") => render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);

beforeEach(() => {
  resetAutomationFeaturesCache();
  api.automationFeatures.mockResolvedValue({ data: { instrument_finder: true, smart_slots: true } });
});

afterEach(() => {
  cleanup();
  Object.values(api).forEach((fn) => fn.mockReset());
});

describe("BestSlotsPanel", () => {
  const suggestion = {
    slot_ids: [11, 12],
    date: "2026-10-20",
    start: "2026-10-20T14:00:00+05:30",
    end: "2026-10-20T16:00:00+05:30",
    label: "Tue 20 Oct, 14:00–16:00",
    score: 0.8,
    reasons: ["Starts at your usual time (14:00)"],
  };

  it("lists runs and selects one on click", async () => {
    api.slotSuggestions.mockResolvedValue({
      data: { enabled: true, slot_count: 2, window_days: 14, suggestions: [suggestion], alternatives: [] },
    });
    const onPick = vi.fn();
    wrap(<BestSlotsPanel equipmentId={7} slotCount={2} selectedSlotIds={[]} onPick={onPick} />);
    fireEvent.click(await screen.findByRole("button", { name: /Tue 20 Oct/ }));
    expect(onPick).toHaveBeenCalledWith(suggestion);
    expect(api.slotSuggestions).toHaveBeenCalledWith(7, 2);
    expect(screen.getByText(/2 back-to-back slots/)).toBeTruthy();
  });

  it("marks the selected run and offers similar instruments", async () => {
    api.slotSuggestions.mockResolvedValue({
      data: {
        enabled: true,
        slot_count: 2,
        suggestions: [suggestion],
        alternatives: [
          { equipment_id: 9, name: "Rigaku XRD", code: "XRD-R2", first_label: "Fri 16 Oct, 09:00–11:00", first_date: "2026-10-16", href: "/book-equipment?equipment_id=9&date=2026-10-16", reason: "" },
        ],
      },
    });
    wrap(<BestSlotsPanel equipmentId={7} slotCount={2} selectedSlotIds={[12, 11]} onPick={vi.fn()} />);
    const btn = await screen.findByRole("button", { name: /Tue 20 Oct/ });
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("link", { name: /Rigaku XRD/ }).getAttribute("href")).toBe("/book-equipment?equipment_id=9&date=2026-10-16");
  });

  it("stays hidden when switched off", async () => {
    api.automationFeatures.mockResolvedValue({ data: { instrument_finder: true, smart_slots: false } });
    const { container } = wrap(<BestSlotsPanel equipmentId={7} slotCount={2} selectedSlotIds={[]} onPick={vi.fn()} />);
    await waitFor(() => expect(api.automationFeatures).toHaveBeenCalled());
    expect(api.slotSuggestions).not.toHaveBeenCalled();
    expect(container.textContent).toBe("");
  });
});

describe("TicketTriageCard", () => {
  const triage = {
    enabled: true,
    saved: false,
    status: "preview",
    topic: "equipment_issue",
    category: "equipment",
    priority: "high",
    route_role: "oic",
    equipment: { equipment_id: 3, name: "Bruker XRD", code: "XRD-B1" },
    suggested_assignee: { id: 5, name: "Dr A" },
    confidence: 0.85,
    reasons: ["Mentions instrument problem", "Equipment XRD-B1 (code)"],
    reply_draft: "Dear user,\n\nThe Officer in Charge has been informed.",
    draft_sources: [],
  };

  it("copies the draft into the reply box and never sends it", async () => {
    api.ticketTriage.mockResolvedValue({ data: triage });
    const onUseDraft = vi.fn();
    wrap(<TicketTriageCard ticketId={42} onUseDraft={onUseDraft} />);
    fireEvent.click(await screen.findByRole("button", { name: /Use draft/ }));
    expect(onUseDraft).toHaveBeenCalledWith(triage.reply_draft);
    expect(api.ticketTriageDecision).not.toHaveBeenCalled();
    expect(screen.getByText(/Dr A/)).toBeTruthy();
    expect(screen.getByText("85% sure")).toBeTruthy();
  });

  it("accepts the suggestion", async () => {
    api.ticketTriage.mockResolvedValue({ data: triage });
    api.ticketTriageDecision.mockResolvedValue({ data: { ...triage, saved: true, status: "accepted", decided_by: "Admin" } });
    const onApplied = vi.fn();
    wrap(<TicketTriageCard ticketId={42} onUseDraft={vi.fn()} onApplied={onApplied} />);
    fireEvent.click(await screen.findByRole("button", { name: /Accept/ }));
    await waitFor(() => expect(onApplied).toHaveBeenCalled());
    expect(api.ticketTriageDecision).toHaveBeenCalledWith(42, { accept: true });
    expect(screen.getByText(/Accepted by Admin/)).toBeTruthy();
  });

  it("renders nothing when triage is off", async () => {
    api.ticketTriage.mockResolvedValue({ data: { enabled: false } });
    const { container } = wrap(<TicketTriageCard ticketId={42} onUseDraft={vi.fn()} />);
    await waitFor(() => expect(api.ticketTriage).toHaveBeenCalled());
    expect(container.textContent).toBe("");
  });
});

describe("InstrumentFinder page", () => {
  it("searches and shows ranked instruments with reasons", async () => {
    api.instrumentFinder.mockResolvedValue({
      data: {
        enabled: true,
        query: "crystal structure of my thin film",
        sample: "thin film",
        method: "rules",
        techniques: [{ key: "xrd", label: "X-ray diffraction (XRD)", summary: "", why: "XRD is used for crystal structure and phases", source: "goal", score: 0.98, available: true }],
        results: [
          { equipment_id: 3, name: "Bruker D8 Advance XRD", code: "XRD-B1", score: 0.98, reasons: ["XRD is used for crystal structure and phases; suits a thin film"], techniques: ["X-ray diffraction (XRD)"], detail_href: "/equipment/3", book_href: "/book-equipment?equipment_id=3" },
        ],
        tips: [],
      },
    });
    wrap(<InstrumentFinder />, "/find-instrument");
    fireEvent.change(screen.getByLabelText(/What do you want to learn/), { target: { value: "crystal structure of my thin film" } });
    fireEvent.click(screen.getByRole("button", { name: /Find instruments/ }));
    expect(await screen.findByText("Bruker D8 Advance XRD")).toBeTruthy();
    expect(api.instrumentFinder).toHaveBeenCalledWith("crystal structure of my thin film");
    expect(screen.getByText(/Techniques that fit a thin film/)).toBeTruthy();
    expect(screen.getByText(/suits a thin film/)).toBeTruthy();
  });

  it("runs a shared link", async () => {
    api.instrumentFinder.mockResolvedValue({ data: { enabled: false, techniques: [], results: [] } });
    wrap(<InstrumentFinder />, "/find-instrument?q=band%20gap");
    expect(await screen.findByText(/instrument finder is switched off/i)).toBeTruthy();
    expect(api.instrumentFinder).toHaveBeenCalledWith("band gap");
  });

  it("runs a new query that arrives while the page is open", async () => {
    api.instrumentFinder.mockResolvedValue({ data: { enabled: false, techniques: [], results: [] } });
    render(
      <MemoryRouter initialEntries={["/find-instrument?q=band%20gap"]}>
        <Link to="/find-instrument?q=surface%20area">new query</Link>
        <InstrumentFinder />
      </MemoryRouter>,
    );
    await waitFor(() => expect(api.instrumentFinder).toHaveBeenCalledWith("band gap"));
    fireEvent.click(screen.getByText("new query"));
    await waitFor(() => expect(api.instrumentFinder).toHaveBeenLastCalledWith("surface area"));
    expect(api.instrumentFinder).toHaveBeenCalledTimes(2);
    expect((screen.getByLabelText(/What do you want to learn/) as HTMLTextAreaElement).value).toBe("surface area");
  });
});

describe("AdminSettingsAutomation", () => {
  const cfg = {
    instrument_finder_enabled: true,
    instrument_finder_llm_enabled: false,
    llm_daily_call_limit: 200,
    smart_slots_enabled: true,
    ticket_triage_enabled: false,
    ticket_auto_assign_enabled: false,
    oic_alerts_enabled: false,
    oic_alert_utilisation_drop_pct: 40,
    oic_alert_min_cancellations: 3,
    oic_alert_min_disruptions: 2,
    no_show_prompts_enabled: false,
    no_show_grace_minutes: 60,
    updated_at: null,
    updated_by: null,
    llm_calls_today: 0,
    llm_provider: "ollama",
  };

  beforeEach(() => {
    api.automationSettings.mockResolvedValue({ data: cfg });
    api.automationLog.mockResolvedValue({ data: { count: 0, results: [] } });
  });

  it("asks before switching on an automation that sends email", async () => {
    api.updateAutomationSettings.mockResolvedValue({ data: { ...cfg, oic_alerts_enabled: true } });
    wrap(<AdminSettingsAutomation />);
    fireEvent.click(await screen.findByRole("switch", { name: "oic_alerts_enabled" }));
    expect(api.updateAutomationSettings).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Switch on" }));
    await waitFor(() => expect(api.updateAutomationSettings).toHaveBeenCalledWith({ oic_alerts_enabled: true }));
  });

  it("switching off a read-only feature saves at once", async () => {
    api.updateAutomationSettings.mockResolvedValue({ data: { ...cfg, smart_slots_enabled: false } });
    wrap(<AdminSettingsAutomation />);
    fireEvent.click(await screen.findByRole("switch", { name: "smart_slots_enabled" }));
    await waitFor(() => expect(api.updateAutomationSettings).toHaveBeenCalledWith({ smart_slots_enabled: false }));
  });

  it("shows the weekly alert dry run", async () => {
    api.automationPreviewOicAlerts.mockResolvedValue({
      data: {
        week: "2026-W41",
        dry_run: true,
        enabled: false,
        equipment_flagged: 1,
        flags: { utilisation_drop: 1 },
        recipients: 1,
        sent: 0,
        skipped: 0,
        equipment: [{ equipment_id: 3, name: "Bruker XRD", code: "XRD-B1", flags: [{ kind: "utilisation_drop", text: "Booked hours fell 80%." }], metrics: {} }],
      },
    });
    wrap(<AdminSettingsAutomation />);
    await screen.findByText("Weekly anomaly alerts to Officers in Charge");
    const buttons = screen.getAllByRole("button", { name: /Preview \(dry run\)/ });
    fireEvent.click(buttons[1]);
    expect(await screen.findByText(/1 equipment flagged, 1 OIC email/)).toBeTruthy();
    expect(screen.getAllByText("Booked hours drop")).toHaveLength(2);
    expect(screen.getByText("Booked hours fell 80%.")).toBeTruthy();
  });
});
