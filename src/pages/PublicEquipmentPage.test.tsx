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
    contacts: [
      { role: "Officer In-charge", name: "Prof. Asha Rao", email: "oic@example.ac.in", phones: ["+91 11111 22222"], office: "Room 5, IIC", photo_url: "" },
      { role: "Lab Operator", name: "Ravi Kumar", email: "lab@example.ac.in", phones: ["01332-285000", "+91 33333 44444"], office: "", photo_url: "https://equip.iitr.ac.in/api/users/9/profile-picture/" },
    ],
    public_url: "https://equip.iitr.ac.in/equipment/38",
    booking_path: "/book-equipment?equipment_id=38",
    charges_path: "/analysis-charges",
    charges: {
      profile_type: "HOUR",
      slot_duration_minutes: 60,
      internal_user_types: ["student", "faculty"],
      charge_profiles: [
        { user_type: "student", profile_type: "HOUR", is_active: true, primary_unit_charge: "100.00", display_text: "" },
        { user_type: "faculty", profile_type: "HOUR", is_active: true, primary_unit_charge: "200.00", display_text: "" },
        { user_type: "Industry", profile_type: "HOUR", is_active: true, primary_unit_charge: "900.00", display_text: "" },
      ],
      input_fields: [],
      slot_options: [],
    },
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
    expect(screen.getAllByText("Institute Instrumentation Centre").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Book This Equipment/ })).toBeTruthy();
    for (const name of ["Overview", "Technical Details", "Charges", "Booking", "How to Reach", "Lab Contacts"]) {
      expect(screen.getByRole("heading", { level: 2, name })).toBeTruthy();
    }
    const quick = screen.getByRole("navigation", { name: "Quick actions" });
    for (const label of ["How to Reach", "Technical Details", "View Charges", "Contact Laboratory"]) {
      expect(within(quick).getByText(label)).toBeTruthy();
    }
    expect(screen.getByText("Manufacturer")).toBeTruthy();
    expect(screen.getByText("0.8 nm")).toBeTruthy();
    expect(screen.getByText("EDS detector (optional)")).toBeTruthy();
  });

  it("shows internal and external rates on the page, and View Charges jumps to them", async () => {
    api.publicEquipment.mockResolvedValue({ data: equipment(), status: 200 });
    renderAt("/equipment/38");
    await screen.findByRole("heading", { level: 1, name: "Field Emission SEM" });
    const quick = screen.getByRole("navigation", { name: "Quick actions" });
    expect(within(quick).getByText("View Charges").closest("a")?.getAttribute("href")).toBe("#charges");

    const iitr = within(screen.getByRole("region", { name: "IIT Roorkee users" }));
    expect(iitr.getAllByTestId("charge-rate").length).toBe(2);
    expect(iitr.getAllByTestId("charge-rate").map((c) => c.textContent).join(" ")).toMatch(/100.*200|200.*100/);
    const external = within(screen.getByRole("region", { name: "External users" }));
    expect(external.getByTestId("charge-rate").textContent).toContain("900");
    expect(screen.getByText(/All rates are exclusive of GST/)).toBeTruthy();
    expect(document.querySelector('a[href="/analysis-charges"]')).toBeNull();
  });

  it("says so when no rates are published", async () => {
    api.publicEquipment.mockResolvedValue({ data: equipment({ charges: null }) });
    renderAt("/equipment/38");
    expect(await screen.findByText(/have not been published yet/)).toBeTruthy();
    expect(screen.queryByTestId("charge-rate")).toBeNull();
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
    expect(screen.queryByText("Before you book")).toBeNull();
  });

  it("lab contacts are shown to everyone with tap-to-call and email links", async () => {
    api.publicEquipment.mockResolvedValue({ data: equipment(), status: 200 });
    renderAt("/equipment/38");
    const cards = await screen.findAllByTestId("lab-contact");
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText("Prof. Asha Rao")).toBeTruthy();
    expect(within(cards[0]).getByText("Officer In-charge")).toBeTruthy();
    expect(within(cards[0]).getByText("AR")).toBeTruthy(); // initials when there is no photo
    expect(within(cards[0]).getByText("Room 5, IIC")).toBeTruthy();
    expect(within(cards[1]).getByText("+91 33333 44444").closest("a")?.getAttribute("href")).toBe("tel:+913333344444");
    expect(within(cards[1]).getByText("01332-285000").closest("a")?.getAttribute("href")).toBe("tel:01332285000");
    expect(within(cards[1]).getByText("lab@example.ac.in").closest("a")?.getAttribute("href")).toBe("mailto:lab@example.ac.in");
    expect(cards[1].querySelector("img")?.getAttribute("src")).toBe("https://equip.iitr.ac.in/api/users/9/profile-picture/");
    expect(screen.queryByText(/Sign in for lab contacts/)).toBeNull();
    const sticky = screen.getByRole("navigation", { name: "Equipment actions" });
    expect(sticky.hasAttribute("data-floating-clearance")).toBe(true);  // the assistant button rises above it
    expect(within(sticky).getByText("Call").closest("a")?.getAttribute("href")).toBe("tel:+911111122222");
  });

  it("long descriptions fold behind Show more and stored text becomes lists and rows", async () => {
    const description = "Talos F200X is a scanning TEM.\n\nApplications:\n" + "Material Science, Chemical Engineering. ".repeat(20);
    api.publicEquipment.mockResolvedValue({
      data: equipment({
        description,
        specifications: [
          { label: "General Information:", value: "Make- THERMOFISHER\nModel- TALOS F200X\nYear of Installation- 2024" },
          { label: "Specifications:", value: "1) Acceleration Voltage 200 kV\n2) Source: X-FEG\n3) Point resolution 0.24 nm" },
        ],
      }),
      status: 200,
    });
    renderAt("/equipment/38");
    const more = await screen.findByRole("button", { name: "Show more" });
    expect(more.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(more);
    expect(screen.getByRole("button", { name: "Show less" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "Applications" })).toBeTruthy();
    expect(screen.getByText("General Information")).toBeTruthy();  // label without the trailing colon
    expect(screen.getByText("Year of Installation").tagName).toBe("DT");
    expect(screen.getByText("2024").tagName).toBe("DD");
    expect(screen.getByText("Acceleration Voltage 200 kV").closest("li")).toBeTruthy();
  });

  it("the formatted important instruction is rendered as formatted text, not raw HTML", async () => {
    api.publicEquipment.mockResolvedValue({ data: equipment({ important_instruction: "<p><strong>Dry</strong> samples only</p>" }), status: 200 });
    renderAt("/equipment/38");
    await screen.findByText("Before you book");
    expect(screen.getByText("Dry").tagName).toBe("STRONG");
    expect(screen.queryByText(/<strong>/)).toBeNull();
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
