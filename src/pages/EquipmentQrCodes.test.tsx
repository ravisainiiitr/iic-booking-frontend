// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { QrList, QrRow } from "@/lib/equipmentQrApi";

const api = vi.hoisted(() => ({ list: vi.fn(), downloadPng: vi.fn(), downloadSvg: vi.fn(), downloadZip: vi.fn() }));
const auth = vi.hoisted(() => ({ value: { isAuthenticated: true, loading: false, user: { user_type: "manager" } as { user_type: string } | null } }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("@/lib/equipmentQrApi", async (orig) => {
  const actual = await orig<typeof import("@/lib/equipmentQrApi")>();
  return { ...actual, equipmentQrApi: { ...actual.equipmentQrApi, ...api } };
});
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth.value }));
vi.mock("@/components/DashboardHeader", () => ({ default: () => <div data-testid="dashboard-header" /> }));
vi.mock("sonner", () => ({ toast }));

import EquipmentQrCodes, { printUrl } from "./EquipmentQrCodes";
import EquipmentQrPrint, { parseIds } from "./EquipmentQrPrint";
import { qrNameSize } from "./equipmentQrCardStyles";

const row = (id: number, name: string, over: Partial<QrRow> = {}): QrRow => ({
  equipment_id: id, code: `EQ${id}`, name, make: "Zeiss", model: "M1", category: "", status: "ACTIVE",
  status_display: "Operational", department: { id: 1, name: "Institute Instrumentation Centre", code: "IIC" },
  public_url: `https://equip.iitr.ac.in/equipment/${id}`, publicly_visible: true, ...over,
});
const list = (rows: QrRow[], over: Partial<QrList> = {}): QrList => ({
  results: rows, count: rows.length, departments: [{ id: 1, name: "Institute Instrumentation Centre", code: "IIC" }],
  statuses: [{ value: "ACTIVE", label: "Operational" }], base_url: "https://equip.iitr.ac.in", base_url_warning: "", ...over,
});

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname + loc.search}</div>;
}

function renderPage(path = "/equipment-qr-codes") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/equipment-qr-codes" element={<EquipmentQrCodes />} />
        <Route path="/equipment-qr-codes/print" element={<EquipmentQrPrint />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Equipment QR Codes", () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset());
    toast.success.mockReset();
    toast.error.mockReset();
    auth.value = { isAuthenticated: true, loading: false, user: { user_type: "manager" } };
  });
  afterEach(() => cleanup());

  it("lists the OIC's equipment with QR codes encoding the exact public URL", async () => {
    api.list.mockResolvedValue({ data: list([row(38, "FE-SEM"), row(39, "XRD", { publicly_visible: false })]) });
    renderPage();
    expect(await screen.findAllByTestId("qr-row")).toHaveLength(2);
    await waitFor(() => expect(document.querySelectorAll("svg[data-qr-value]").length).toBe(2));
    const values = Array.from(document.querySelectorAll("svg[data-qr-value]")).map((s) => s.getAttribute("data-qr-value"));
    expect(values).toEqual(["https://equip.iitr.ac.in/equipment/38", "https://equip.iitr.ac.in/equipment/39"]);
    expect(screen.getByText("equip.iitr.ac.in/equipment/38")).toBeTruthy();
    expect(screen.getByText(/Not public/)).toBeTruthy();
  });

  it("search and filters are sent to the scoped API", async () => {
    api.list.mockResolvedValue({ data: list([row(38, "FE-SEM")]) });
    renderPage();
    await screen.findAllByTestId("qr-row");
    fireEvent.change(screen.getByLabelText("Search equipment"), { target: { value: "zeiss" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "ACTIVE" } });
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith({ q: "zeiss", department_id: undefined, status: "ACTIVE" }));
  });

  it("download, copy, share and print actions", async () => {
    api.list.mockResolvedValue({ data: list([row(38, "FE-SEM")]) });
    api.downloadPng.mockResolvedValue(null);
    api.downloadSvg.mockResolvedValue("Equipment not found.");
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    renderPage();
    await screen.findAllByTestId("qr-row");

    fireEvent.click(screen.getByRole("button", { name: /PNG/ }));
    await waitFor(() => expect(api.downloadPng).toHaveBeenCalledWith(38));
    fireEvent.click(screen.getByRole("button", { name: /SVG/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Equipment not found."));
    fireEvent.click(screen.getByRole("button", { name: /Copy link/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("https://equip.iitr.ac.in/equipment/38"));
    fireEvent.click(screen.getByRole("button", { name: /Share/ }));  // no share sheet here: falls back to copying
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Sharing is not available here, so the link was copied"));

    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    fireEvent.click(screen.getByRole("button", { name: /Share/ }));
    await waitFor(() => expect(share).toHaveBeenCalledWith({ title: "FE-SEM", url: "https://equip.iitr.ac.in/equipment/38" }));

    fireEvent.click(screen.getByRole("button", { name: /Print card/ }));
    expect(await screen.findAllByTestId("qr-card")).toBeTruthy();
  });

  it("batch download and printing use the selected equipment", async () => {
    api.list.mockResolvedValue({ data: list([row(38, "FE-SEM"), row(39, "XRD")]) });
    api.downloadZip.mockResolvedValue(null);
    renderPage();
    await screen.findAllByTestId("qr-row");
    const zip = screen.getByRole("button", { name: /Download ZIP/ }) as HTMLButtonElement;
    expect(zip.disabled).toBe(true);
    fireEvent.click(screen.getByLabelText("Select all shown"));
    fireEvent.click(zip);
    await waitFor(() => expect(api.downloadZip).toHaveBeenCalledWith([38, 39]));
    expect(printUrl([38, 39], "cards")).toBe("/equipment-qr-codes/print?layout=cards&ids=38,39");
  });

  it("shows the canonical-domain warning from the server", async () => {
    api.list.mockResolvedValue({ data: list([row(38, "FE-SEM")], { base_url_warning: "QR codes point to http://localhost:8080, a local address." }) });
    renderPage();
    expect((await screen.findByRole("alert")).textContent).toContain("local address");
  });

  it("other roles see no QR controls and never call the API", async () => {
    auth.value = { isAuthenticated: true, loading: false, user: { user_type: "faculty" } };
    renderPage();
    expect(screen.getByRole("alert").textContent).toContain("Main Administrator and Officers In-charge");
    expect(screen.queryByRole("button", { name: /Download ZIP/ })).toBeNull();
    expect(api.list).not.toHaveBeenCalled();
  });

  it("signed-out users are sent to sign in", async () => {
    auth.value = { isAuthenticated: false, loading: false, user: null };
    renderPage();
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/auth"));
  });
});

describe("QR print cards", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    api.list.mockReset();
    auth.value = { isAuthenticated: true, loading: false, user: { user_type: "admin" } };
  });

  it("parses ids safely", () => {
    expect(parseIds("38, 39,abc,-1,38,0")).toEqual([38, 39]);
    expect(parseIds(null)).toEqual([]);
  });

  it("renders a card with the name, department, QR of the exact URL, instruction and short URL; toolbar is print-hidden", async () => {
    api.list.mockResolvedValue({ data: list([row(38, "FE-SEM")]) });
    renderPage("/equipment-qr-codes/print?layout=a4&ids=38");
    const card = await screen.findByTestId("qr-card");
    expect(api.list).toHaveBeenCalledWith({ ids: [38] });
    expect(card.textContent).toContain("FE-SEM");
    expect(card.textContent).toContain("Institute Instrumentation Centre");
    expect(card.textContent).toContain("Scan with your phone camera to view equipment information");
    expect(card.textContent).toContain("equip.iitr.ac.in/equipment/38");
    expect(within(card).getByAltText(/logo/i).getAttribute("src")).toBe("/IITR_Logo.png");
    await waitFor(() => expect(card.querySelector("svg[data-qr-value]")?.getAttribute("data-qr-value")).toBe("https://equip.iitr.ac.in/equipment/38"));
    expect(screen.getByTestId("print-toolbar").className).toContain("print:hidden");
    expect(document.querySelector("style")?.textContent).toContain("@page");
    expect(card.querySelector("button")).toBeNull();  // no controls inside the printed card
    for (const label of ["Specifications", "Charges", "Booking", "Directions", "Contact Information"]) {
      expect(within(card).getByText(label)).toBeTruthy();
    }
  });

  it("shows the equipment's own department, and none when it has no department", async () => {
    const lab = { ...row(77, "CNC Lathe"), department: { id: 5, name: "Rethink ! The Tinkering Lab", code: "TL" } };
    api.list.mockResolvedValue({ data: list([lab, { ...row(78, "No Department"), department: null }, row(38, "FE-SEM")]) });
    renderPage("/equipment-qr-codes/print?ids=77,78,38");
    const [tinkering, none, iic] = await screen.findAllByTestId("qr-card");
    expect(tinkering.querySelector(".qrp-dept")?.textContent).toBe("Rethink ! The Tinkering Lab");
    expect(none.querySelector(".qrp-dept")).toBeNull();
    expect(iic.textContent).not.toContain("Tinkering");
  });

  it("puts one sign on each A4 sheet and four small cards on each sheet", async () => {
    const rows = [38, 39, 40, 41, 42].map((id) => row(id, `Instrument ${id}`));
    api.list.mockResolvedValue({ data: list(rows) });
    const a4 = renderPage("/equipment-qr-codes/print?layout=a4&ids=38,39,40,41,42");
    await screen.findAllByTestId("qr-card");
    expect(document.querySelectorAll(".qrp-sheet").length).toBe(5);
    a4.unmount();
    renderPage("/equipment-qr-codes/print?layout=cards&ids=38,39,40,41,42");
    expect((await screen.findAllByTestId("qr-card")).length).toBe(5);
    expect(document.querySelectorAll(".qrp-sheet").length).toBe(2);
  });

  it("shrinks long names in steps so the longest allowed name still fits", () => {
    expect(qrNameSize("FE-SEM")).toBe("xl");
    expect(qrNameSize("x".repeat(40))).toBe("lg");
    expect(qrNameSize("x".repeat(80))).toBe("md");
    expect(qrNameSize("x".repeat(120))).toBe("sm");
    expect(qrNameSize("x".repeat(255))).toBe("xs");
  });

  it("other roles cannot open the print view", async () => {
    auth.value = { isAuthenticated: true, loading: false, user: { user_type: "student" } };
    renderPage("/equipment-qr-codes/print?ids=38");
    expect(screen.getByRole("alert").textContent).toContain("Main Administrator");
    expect(api.list).not.toHaveBeenCalled();
  });
});
