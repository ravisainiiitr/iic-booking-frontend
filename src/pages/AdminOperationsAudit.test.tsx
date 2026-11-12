// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdminOperationsAudit from "./AdminOperationsAudit";

const api = vi.hoisted(() => ({ getOperationsAudit: vi.fn(), downloadOperationsAuditCsv: vi.fn() }));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiClient: api,
}));
vi.mock("@/components/PageShell", () => ({ PageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const row = {
  at: "2026-11-06T10:00:00+05:30",
  category: "refund",
  category_label: "Refund",
  action: "Refund to wallet",
  actor_name: "Officer One",
  actor_role: "Officer In Charge",
  equipment: "Test XRD",
  affected_user: "Booking User",
  booking_ref: "XRD202600123",
  amount: "1500.00",
  detail: "Instrument fault",
};

describe("AdminOperationsAudit", () => {
  beforeEach(() => {
    api.getOperationsAudit.mockResolvedValue({ data: { count: 1, page: 1, page_size: 25, num_pages: 1, categories: [], results: [row] } });
    api.downloadOperationsAuditCsv.mockResolvedValue({});
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows who did what, on which booking, for how much", async () => {
    render(<AdminOperationsAudit />);
    expect(await screen.findByText("Refund to wallet")).toBeTruthy();
    expect(screen.getByText("Officer One")).toBeTruthy();
    expect(screen.getByText("Officer In Charge")).toBeTruthy();
    expect(screen.getByText("XRD202600123")).toBeTruthy();
    expect(screen.getByText(/1,500/)).toBeTruthy();
  });

  it("sends the search to the server and goes back to the first page", async () => {
    render(<AdminOperationsAudit />);
    await screen.findByText("Refund to wallet");
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "xrd" } });
    await waitFor(() => expect(api.getOperationsAudit).toHaveBeenLastCalledWith(expect.objectContaining({ q: "xrd", page: 1 })));
  });

  it("exports with the same filters", async () => {
    render(<AdminOperationsAudit />);
    await screen.findByText("Refund to wallet");
    fireEvent.click(screen.getByRole("button", { name: /Export CSV/ }));
    await waitFor(() => expect(api.downloadOperationsAuditCsv).toHaveBeenCalled());
  });

  it("shows the server's refusal to anyone else", async () => {
    api.getOperationsAudit.mockResolvedValue({ error: "The operations audit is available to the Main Administrator." });
    render(<AdminOperationsAudit />);
    expect((await screen.findByRole("alert")).textContent).toContain("Main Administrator");
  });
});
