// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { PublicEquipment } from "@/lib/equipmentQrApi";

const api = vi.hoisted(() => ({ publicEquipment: vi.fn() }));
const redirect = vi.hoisted(() => ({ setPostLoginRedirect: vi.fn() }));
const auth = vi.hoisted(() => ({ value: { isAuthenticated: false, loading: false, user: null as null | { user_type: string } } }));

vi.mock("@/lib/equipmentQrApi", async (orig) => {
  const actual = await orig<typeof import("@/lib/equipmentQrApi")>();
  return { ...actual, equipmentQrApi: { ...actual.equipmentQrApi, ...api } };
});
vi.mock("@/lib/authRedirect", () => redirect);
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth.value }));
vi.mock("@/pages/EquipmentProfile", () => ({ default: () => <div data-testid="full-equipment-profile">Full profile</div> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import PublicEquipmentPage from "./PublicEquipmentPage";
import EquipmentPageRoute from "./EquipmentPageRoute";

export function equipment(over: Partial<PublicEquipment> = {}): PublicEquipment {
  return {
    equipment_id: 38,
    code: "FESEM",
    name: "Field Emission SEM",
    description: "High-resolution imaging of surfaces.",
    important_instruction: "Samples must be dry.",
    status: { key: "operational", label: "Operational" },
    category: "Electron Microscopy",
    department: { name: "Institute Instrumentation Centre", code: "IIC" },
    make: "Zeiss",
    model: "Gemini 300",
    image_url: "/api/equipments/38/image/",
    specifications: [{ label: "Resolution", value: "0.8 nm" }],
    accessories: [{ name: "EDS detector", optional: true }],
    location: "Ground floor, Lab 12",
    directions: {
      maps_url: "https://maps.app.goo.gl/AbC",
      source: "maps_url",
      latitude: 29.86,
      longitude: 77.89,
      embed_url: "https://www.google.com/maps?q=29.86%2C77.89&z=17&output=embed",
    },
    enquiry_address: "IIC Office, Room 101",
    public_url: "https://equip.iitr.ac.in/equipment/38",
    booking_path: "/book-equipment?equipment_id=38",
    charges_path: "/analysis-charges",
    ...over,
  };
}

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname}</div>;
}

function renderAt(path: string, element = <EquipmentPageRoute />) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/equipment/:id" element={element} />
        <Route path="/auth" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("public equipment page (QR landing)", () => {
  beforeEach(() => {
    api.publicEquipment.mockReset();
    redirect.setPostLoginRedirect.mockReset();
    auth.value = { isAuthenticated: false, loading: false, user: null };
  });
  afterEach(() => cleanup());

  it("opens the equipment details directly for a signed-out visitor: no continue step, no login", async () => {
    api.publicEquipment.mockResolvedValue({ data: equipment(), status: 200 });
    renderAt("/equipment/38");
    expect(await screen.findByRole("heading", { level: 1, name: "Field Emission SEM" })).toBeTruthy();
    expect(api.publicEquipment).toHaveBeenCalledWith("38");
    expect(screen.queryByText(/continue|open equipment/i)).toBeNull();
    expect(screen.queryByTestId("full-equipment-profile")).toBeNull();
    expect(screen.getByTestId("public-status").textContent).toBe("Operational");
    expect(screen.getByText("Institute Instrumentation Centre", { selector: "p.font-medium" })).toBeTruthy();
    // Sections and quick actions
    for (const name of ["Overview", "Technical Details", "Booking and Charges", "How to Reach", "Contact and Support"]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeTruthy();
    }
    const quick = screen.getByRole("navigation", { name: "Quick actions" });
    for (const label of ["Book This Equipment", "How to Reach", "Technical Details", "View Charges", "Contact Laboratory"]) {
      expect(within(quick).getByText(label)).toBeTruthy();
    }
    expect(screen.getByText("Manufacturer")).toBeTruthy();
    expect(screen.getByText("0.8 nm")).toBeTruthy();
    expect(screen.getByText("EDS detector (optional)")).toBeTruthy();
  });

  it("keeps the full equipment page for signed-in users", async () => {
    auth.value = { isAuthenticated: true, loading: false, user: { user_type: "faculty" } };
    renderAt("/equipment/38");
    expect(await screen.findByTestId("full-equipment-profile")).toBeTruthy();
    expect(api.publicEquipment).not.toHaveBeenCalled();
  });

  it("Book keeps the equipment context through sign-in", async () => {
    api.publicEquipment.mockResolvedValue({ data: equipment(), status: 200 });
    renderAt("/equipment/38");
    fireEvent.click(await screen.findByRole("button", { name: /Book This Equipment/ }));
    expect(redirect.setPostLoginRedirect).toHaveBeenCalledWith("/book-equipment?equipment_id=38");
    expect(screen.getByTestId("where").textContent).toBe("/auth");
  });

  it("How to Reach uses the stored maps link; the map preview loads only on request", async () => {
    api.publicEquipment.mockResolvedValue({ data: equipment(), status: 200 });
    renderAt("/equipment/38");
    const link = (await screen.findByTestId("open-in-maps")) as HTMLAnchorElement;
    expect(link.href).toBe("https://maps.app.goo.gl/AbC");
    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noopener");
    expect(document.querySelector("iframe")).toBeNull();
    fireEvent.click(screen.getByText("Show map preview"));
    expect(document.querySelector("iframe")?.getAttribute("src")).toContain("output=embed");
    const sticky = screen.getByRole("navigation", { name: "Equipment actions" });
    expect(within(sticky).getByText("Directions").closest("a")?.getAttribute("href")).toBe("https://maps.app.goo.gl/AbC");
  });

  it("missing optional data is hidden, and missing directions show a message instead of a button", async () => {
    api.publicEquipment.mockResolvedValue({
      data: equipment({
        description: "", important_instruction: "", make: "", model: "", specifications: [], accessories: [],
        image_url: null, location: "", enquiry_address: "",
        directions: { maps_url: "", source: "", latitude: null, longitude: null, embed_url: "" },
      }),
      status: 200,
    });
    renderAt("/equipment/38");
    await screen.findByRole("heading", { level: 1 });
    expect(screen.queryByRole("heading", { name: "Overview" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Technical Details" })).toBeNull();
    expect(screen.queryByText("Technical Details")).toBeNull();
    expect(screen.queryByTestId("open-in-maps")).toBeNull();
    expect(screen.getByTestId("no-directions")).toBeTruthy();
    expect(screen.queryByText("Directions")).toBeNull();
    expect(document.querySelector("img[alt='Field Emission SEM']")).toBeNull();
    expect(screen.getByText(/Laboratory contacts are shown to signed-in users/)).toBeTruthy();
  });

  it("unavailable equipment pauses booking", async () => {
    api.publicEquipment.mockResolvedValue({ data: equipment({ status: { key: "unavailable", label: "Temporarily unavailable" } }), status: 200 });
    renderAt("/equipment/38");
    const book = await screen.findByRole("button", { name: /Book This Equipment/ });
    expect((book as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/new bookings are paused/)).toBeTruthy();
  });

  it("restricted or missing equipment shows a neutral not-available page", async () => {
    api.publicEquipment.mockResolvedValue({ error: "This equipment page is not available.", status: 404 });
    renderAt("/equipment/999", <PublicEquipmentPage equipmentId="999" />);
    expect(await screen.findByRole("heading", { name: "This equipment page is not available" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Browse equipment" })).toBeTruthy();
  });

  it("network errors offer a retry", async () => {
    api.publicEquipment.mockResolvedValueOnce({ error: "Network error occurred" }).mockResolvedValueOnce({ data: equipment(), status: 200 });
    renderAt("/equipment/38");
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Field Emission SEM" })).toBeTruthy());
  });
});
