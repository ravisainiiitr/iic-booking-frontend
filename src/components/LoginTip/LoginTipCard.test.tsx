// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { clearLoginTipsThisLogin, type LoginTipUser, type NextSampleReminder } from "@/lib/loginTips";
import type { SamplePolicyEquipment } from "@/lib/samplePolicy";
import { LoginTipCard } from "./LoginTipCard";

const catalog = vi.hoisted(() => ({ rows: [] as unknown[], fail: false }));

vi.mock("@/lib/catalogCache", () => ({
  loadDefaultCatalogEquipment: vi.fn(async () => {
    if (catalog.fail) throw new Error("offline");
    return catalog.rows;
  }),
  loadCatalogEquipment: vi.fn(async () => {
    if (catalog.fail) throw new Error("offline");
    return catalog.rows;
  }),
  peekCatalogEquipment: () => null,
}));

const eq = (id: number, name: string, lead: number, collect = 72, parent: number | null = null): SamplePolicyEquipment => ({
  equipment_id: id,
  code: `C${id}`,
  name,
  parent_equipment: parent,
  sample_submission_lead_hours: lead,
  sample_collect_deadline_hours: collect,
});

const ROWS = [
  eq(10, "Field Emission Scanning Electron Microscope (FE-SEM)-APREO", 0, 0),
  eq(5, "Field Emission Scanning Electron Microscope (FE-SEM)-GEMINI 300", 0),
  eq(37, "Electron Backscatter Diffraction (EBSD)", 0, 72, 10),
  eq(38, "Transmission Electron Microscope (TEM)", 0),
  eq(42, "Scanning Probe Microscope (SPM)", 0),
  eq(1, "Powder X-Ray Diffractometer (PXRD) [A]", 24),
  eq(7, "Nuclear Magnetic Resonance (NMR)", 24),
];

const student: LoginTipUser = { id: 7, user_type: "student", department_type: "internal" };

const renderCard = (user: LoginTipUser | null, nextSampleReminder: NextSampleReminder | null = null) =>
  render(
    <MemoryRouter>
      <main id="main-content" tabIndex={-1}>
        <LoginTipCard user={user} nextSampleReminder={nextSampleReminder} />
      </main>
    </MemoryRouter>
  );

beforeEach(() => {
  sessionStorage.clear();
  catalog.rows = ROWS;
  catalog.fail = false;
});
afterEach(cleanup);

const openPolicy = async () => {
  fireEvent.click(screen.getByRole("button", { name: /More information/ }));
  return screen.findByRole("dialog", { name: "Sample submission policy" });
};

describe("LoginTipCard", () => {
  it("shows the sample tip to an IITR student after sign-in", () => {
    renderCard(student);
    const tip = screen.getByRole("status", { name: /Tip of the day: Submit your sample before the deadline/ });
    expect(tip.textContent).toContain("request the Lab Operator to record its receipt in the portal");
    expect(tip.textContent).toContain("treated as Not Utilized and the charges are not refunded");
    expect(screen.queryByRole("button", { name: /Read about samples/ })).toBeNull();
  });

  it("names the brought-to-the-slot instruments from the equipment configuration", async () => {
    renderCard(student);
    await waitFor(() =>
      expect(screen.getByTestId("login-tip-at-slot").textContent).toBe(
        "For instruments where the sample is brought to the slot, such as FE-SEM, SPM and TEM, please bring your sample at the start of your slot."
      )
    );
  });

  it("keeps a general exception line when the configuration cannot be loaded", async () => {
    catalog.fail = true;
    renderCard(student);
    await waitFor(() =>
      expect(screen.getByTestId("login-tip-at-slot").textContent).toBe(
        "For instruments where the sample is brought to the slot, please bring your sample at the start of your slot."
      )
    );
  });

  it.each([
    ["faculty", { id: 2, user_type: "faculty", department_type: "internal" }],
    ["external user", { id: 3, user_type: "external" }],
    ["startup", { id: 4, user_type: "startup_incubated_iitr" }],
    ["Lab Operator", { id: 5, user_type: "operator" }],
    ["Officer In Charge", { id: 6, user_type: "manager" }],
    ["admin", { id: 8, user_type: "admin" }],
  ])("is not shown to a %s", (_label, user) => {
    renderCard(user as LoginTipUser);
    expect(screen.queryByTestId("login-tip")).toBeNull();
  });

  it("Got it hides it for the rest of this sign-in and the next sign-in shows it again", () => {
    renderCard(student);
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByTestId("login-tip")).toBeNull();
    expect(document.activeElement?.id).toBe("main-content");

    cleanup();
    renderCard(student);
    expect(screen.queryByTestId("login-tip")).toBeNull();

    cleanup();
    clearLoginTipsThisLogin();
    renderCard(student);
    expect(screen.getByTestId("login-tip")).not.toBeNull();
  });

  it("the close button also dismisses, per user", () => {
    renderCard(student);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss tip" }));
    expect(screen.queryByTestId("login-tip")).toBeNull();
    cleanup();
    renderCard({ ...student, id: 99 });
    expect(screen.getByTestId("login-tip")).not.toBeNull();
  });

  it("stays on the dashboard until acknowledged", () => {
    renderCard(student);
    cleanup();
    renderCard(student);
    expect(screen.getByTestId("login-tip")).not.toBeNull();
  });

  it("shows the next booking and its sample deadline when known", () => {
    renderCard(student, {
      equipmentId: 1,
      equipmentName: "Powder X-Ray Diffractometer (PXRD) [A]",
      startTime: "2026-10-06T10:00:00",
      deadlineAt: "2026-10-05T10:00:00",
      leadHours: 24,
    });
    const line = screen.getByTestId("login-tip-next-booking").textContent;
    expect(line).toContain("Your next booking: Powder X-Ray Diffractometer (PXRD) [A] on Tue 6 Oct, 10:00 AM.");
    expect(line).toContain("Please submit your sample by Mon 5 Oct, 10:00 AM (24 hours before your slot).");
  });

  it("asks to bring the sample to the slot when the next booking is on such equipment", async () => {
    renderCard(student, {
      equipmentId: 38,
      equipmentName: "Transmission Electron Microscope (TEM)",
      startTime: "2026-10-06T10:00:00",
      deadlineAt: null,
      leadHours: null,
    });
    await waitFor(() =>
      expect(screen.getByTestId("login-tip-next-booking").textContent).toBe(
        "Your next booking: Transmission Electron Microscope (TEM) on Tue 6 Oct, 10:00 AM. Please bring your sample at the start of your slot."
      )
    );
  });

  it("states the lead time when only the configuration is known", async () => {
    renderCard(student, { equipmentId: 7, equipmentName: "NMR", startTime: "2026-10-06T10:00:00", deadlineAt: null, leadHours: null });
    await waitFor(() =>
      expect(screen.getByTestId("login-tip-next-booking").textContent).toContain(
        "Please submit your sample at least 24 hours before your slot; the booking details show the exact deadline."
      )
    );
  });

  it("More information opens the full policy with the exception list and a worked example", async () => {
    renderCard(student);
    const dialog = await openPolicy();
    const text = dialog.textContent ?? "";
    for (const title of [
      "Submission deadline",
      "Recording of receipt",
      "Checking your deadline",
      "Bookings not utilized",
      "If you are delayed",
      "After the sample is accepted",
      "Atmosphere-sensitive samples",
      "Collection after analysis",
    ]) {
      expect(text).toContain(title);
    }
    expect(text).toContain("(24 hours for most instruments)");
    expect(text).toContain("moves to the same time on the previous working day");
    expect(text).toContain("Message the lab");
    expect(text).toContain("automatically 24 hours after the slot ends");

    const list = await within(dialog).findByTestId("sample-at-slot-list");
    const items = within(list).getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toEqual([
      "Electron Backscatter Diffraction (EBSD)",
      "Field Emission Scanning Electron Microscope (FE-SEM)-APREOTake the sample back after the slot.",
      "Field Emission Scanning Electron Microscope (FE-SEM)-GEMINI 300",
      "Scanning Probe Microscope (SPM)",
      "Transmission Electron Microscope (TEM)",
    ]);

    const example = within(dialog).getByTestId("sample-policy-example").textContent ?? "";
    expect(example).toContain("Example with a lead time of 24 hours, the most common setting at present:");
    expect(example).toMatch(/Slot on Tuesday, 10:00 AM: submit by Monday, 10:00 AM\./);
    expect(example).toMatch(/Slot on Monday, 10:00 AM: submit by Friday, 10:00 AM \(moved back from the weekend/);

    fireEvent.click(within(dialog).getAllByRole("button", { name: "Close" })[0]);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByTestId("login-tip")).not.toBeNull();
  });

  it("uses the student's own next booking as the worked example", async () => {
    renderCard(student, {
      equipmentId: 1,
      equipmentName: "Powder X-Ray Diffractometer (PXRD) [A]",
      startTime: "2026-10-06T10:00:00",
      deadlineAt: "2026-10-05T10:00:00",
      leadHours: 24,
    });
    const dialog = await openPolicy();
    await waitFor(() =>
      expect(within(dialog).getByTestId("sample-policy-example").textContent).toBe(
        "Your booking: Powder X-Ray Diffractometer (PXRD) [A], Tue 6 Oct, 10:00 AM. Submit the sample by Mon 5 Oct, 10:00 AM (24 hours before the slot)."
      )
    );
    expect(within(dialog).getByRole("heading", { name: /Your next booking/ })).not.toBeNull();
  });

  it("explains that no advance deadline applies when the own booking is brought to the slot", async () => {
    renderCard(student, {
      equipmentId: 10,
      equipmentName: "Field Emission Scanning Electron Microscope (FE-SEM)-APREO",
      startTime: "2026-10-06T10:00:00",
      deadlineAt: null,
      leadHours: null,
    });
    const dialog = await openPolicy();
    await waitFor(() =>
      expect(within(dialog).getByTestId("sample-policy-example").textContent).toContain(
        "No advance deadline applies: bring your sample at the start of the slot. After the slot, take the sample back with you."
      )
    );
  });
});
