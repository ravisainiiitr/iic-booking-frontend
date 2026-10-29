// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: { getToken: () => "tok" } }));

import type { ArrivalEligibility } from "@/lib/courierTrackingApi";

import { SampleArrivalForm } from "./SampleArrivalForm";
import { resetCouriersCache, trackingNumberProblem } from "./courierHelpers";

const COURIERS = [
  { slug: "bluedart", name: "Blue Dart" },
  { slug: "speedpost", name: "Speed Post" },
  { slug: "dtdc", name: "DTDC" },
];

const external: ArrivalEligibility = {
  may_declare: true,
  manual_allowed: true,
  courier_allowed: true,
  is_external: true,
  department_enabled: true,
  default_mode: "COURIER",
  reasons: [],
  courier_reason: "",
};
const internal: ArrivalEligibility = {
  ...external,
  courier_allowed: false,
  is_external: false,
  default_mode: "MANUAL",
  courier_reason: "IIT Roorkee users bring samples to the lab in person, so courier tracking is not used.",
};

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  cleanup();
  resetCouriersCache();
  vi.unstubAllGlobals();
});

type Call = { url: string; method: string; body: unknown };

function stubServer(respond?: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const call = { url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined };
    calls.push(call);
    if (url.endsWith("/couriers/")) {
      return new Response(JSON.stringify({ couriers: COURIERS, count: COURIERS.length, fresh: true }));
    }
    if (respond) return respond(call);
    return new Response(JSON.stringify({ message: "saved", arrival: { id: 1, arrival_mode: call.body && (call.body as { arrival_mode: string }).arrival_mode } }), { status: 201 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

async function chooseCourier(user: ReturnType<typeof userEvent.setup>, name: string) {
  await waitFor(() => expect(screen.getByRole("combobox").textContent).toContain("Select a courier"));
  await user.click(screen.getByRole("combobox"));
  await user.type(screen.getByPlaceholderText("Search courier name..."), name.slice(0, 4));
  await user.click(screen.getByRole("option", { name }));
}

describe("trackingNumberProblem", () => {
  it("applies the documented India Post format only to the postal couriers", () => {
    expect(trackingNumberProblem("speedpost", "ee 123456789 in")).toBe("");
    expect(trackingNumberProblem("speedpost", "EE12345678IN")).toContain("13 characters");
    expect(trackingNumberProblem("dtdc", "D3010377227")).toBe("");
    expect(trackingNumberProblem("dtdc", "")).toContain("Enter the tracking");
  });
});

describe("SampleArrivalForm", () => {
  it("internal users get manual delivery only and no courier list is fetched", async () => {
    const user = userEvent.setup();
    const calls = stubServer();
    const onSaved = vi.fn();
    render(<SampleArrivalForm bookingId={5} eligibility={internal} onSaved={onSaved} />);
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText(internal.courier_reason)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Confirm manual delivery" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(calls.filter((c) => c.url.endsWith("/couriers/"))).toHaveLength(0);
    expect(calls[0].body).toMatchObject({ arrival_mode: "MANUAL" });
    expect(calls[0].body).not.toHaveProperty("courier_slug");
  });

  it("external users register a courier: slug from the list, email preference, exact label", async () => {
    const user = userEvent.setup();
    const calls = stubServer();
    const onSaved = vi.fn();
    render(<SampleArrivalForm bookingId={7} eligibility={external} onSaved={onSaved} />);
    expect(screen.getByText("Email me when the courier tracking status changes.")).toBeTruthy();
    await chooseCourier(user, "Blue Dart");
    await user.type(screen.getByLabelText(/Tracking \/ AWB number/), " 1234 5678 90 ");
    await user.click(screen.getByRole("button", { name: "Register shipment" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const post = calls.find((c) => c.method === "POST");
    expect(post?.url).toBe("/api/v1/courier-tracking/bookings/7/arrival/");
    expect(post?.body).toMatchObject({ arrival_mode: "COURIER", courier_slug: "bluedart", email_updates: true });
  });

  it("requires a courier from the list and validates postal numbers before sending", async () => {
    const user = userEvent.setup();
    const calls = stubServer();
    render(<SampleArrivalForm bookingId={7} eligibility={external} onSaved={vi.fn()} />);
    await user.type(screen.getByLabelText(/Tracking \/ AWB number/), "ABC123");
    await user.click(screen.getByRole("button", { name: "Register shipment" }));
    expect(await screen.findByText("Choose a courier from the list.")).toBeTruthy();
    await chooseCourier(user, "Speed Post");
    await user.click(screen.getByRole("button", { name: "Register shipment" }));
    expect(await screen.findByText(/13 characters/)).toBeTruthy();
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  it("sends one request however many times submit is pressed", async () => {
    const user = userEvent.setup();
    let release: (r: Response) => void = () => {};
    const calls = stubServer(() => new Promise<Response>((resolve) => { release = resolve; }));
    render(<SampleArrivalForm bookingId={7} eligibility={external} onSaved={vi.fn()} />);
    await chooseCourier(user, "DTDC");
    await user.type(screen.getByLabelText(/Tracking \/ AWB number/), "D3010377227");
    const submit = screen.getByRole("button", { name: "Register shipment" });
    await user.click(submit);
    await user.click(submit);
    await user.dblClick(submit);
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(1);
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    release(new Response(JSON.stringify({ message: "ok", arrival: { id: 1 } }), { status: 201 }));
  });

  it("shows the server's field errors without exposing provider details", async () => {
    const user = userEvent.setup();
    stubServer(() => new Response(JSON.stringify({ error: "Choose a courier from the list.", fields: { courier_slug: ["Choose a courier from the list."] } }), { status: 400 }));
    render(<SampleArrivalForm bookingId={7} eligibility={external} onSaved={vi.fn()} />);
    await chooseCourier(user, "DTDC");
    await user.type(screen.getByLabelText(/Tracking \/ AWB number/), "D3010377227");
    await user.click(screen.getByRole("button", { name: "Register shipment" }));
    expect((await screen.findAllByText("Choose a courier from the list.")).length).toBeGreaterThan(0);
    expect(screen.getByRole("alert").textContent).toContain("Choose a courier from the list.");
  });

  it("external users can choose manual delivery instead", async () => {
    const user = userEvent.setup();
    const calls = stubServer();
    const onSaved = vi.fn();
    render(<SampleArrivalForm bookingId={7} eligibility={external} onSaved={onSaved} />);
    await user.click(screen.getByRole("radio", { name: /Manual delivery/ }));
    expect(screen.queryByLabelText(/Tracking \/ AWB number/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Confirm manual delivery" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(calls.find((c) => c.method === "POST")?.body).toMatchObject({ arrival_mode: "MANUAL" });
  });
});
