// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { AnalysisInputSource, AnalysisSetup } from "@/lib/analysisSetupTypes";

const api = vi.hoisted(() => ({
  saveBookingAnalysisSetup: vi.fn(),
  listBookingAnalysisInputSources: vi.fn(),
  getBookingAnalysisDataBrowser: vi.fn(),
  selectBookingAnalysisData: vi.fn(),
  uploadBookingAnalysisFileWithProgress: vi.fn(),
  createResearchWorkspace: vi.fn(),
  myResearchWorkspaceOptions: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: api }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: 7 } }) }));

import { AnalysisSetupDialog, type LegacySetupContext } from "./AnalysisSetupDialog";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(cleanup);

const current: AnalysisInputSource = {
  booking_id: 42,
  virtual_id: "IICDSA0042",
  equipment_name: "DSA",
  date: "2026-10-02",
  status: "COMPLETED",
  file_count: 3,
  is_current: true,
  locked_reason: null,
};
const older: AnalysisInputSource = { ...current, booking_id: 17, virtual_id: "IICDSA0017", date: "2026-08-14", file_count: 6, is_current: false };

const setup = (over: Partial<AnalysisSetup> = {}): AnalysisSetup => ({
  booking: { id: 42, virtual_id: "IICDSA0042", equipment_name: "DSA", date: "2026-10-02", status: "COMPLETED" },
  my_research: {
    eligible: true,
    reason: null,
    current_link: {
      link_id: 1,
      workspace_id: "ws1",
      workspace_name: "Polymer study",
      folder_id: "f1",
      folder_path: "IICDSA0042",
      raw_folder_id: "raw1",
      processed_folder_id: "proc1",
    },
    workspaces: [{ id: "ws1", name: "Polymer study", booking_linked: true }],
    can_create: true,
  },
  folders_preview: { root: "IICDSA0042", raw: "Raw Data", processed: "Processed Data" },
  input: { default_source: "booking", default_booking_id: 42, selected: null },
  output: {
    pc_output_path: "D:\\RemoteAnalysis\\Sessions\\IICDSA0042\\Output",
    destination_label: "My Research › Polymer study / IICDSA0042 / Processed Data",
    auto_delete_after_verify: true,
  },
  ...over,
});

const legacy: LegacySetupContext = {
  virtualId: "IICDSA0042",
  equipmentName: "DSA",
  date: "2026-10-02",
  status: "COMPLETED",
  fileCount: 3,
  outputPath: "D:\\RemoteAnalysis\\Sessions\\IICDSA0042\\Output",
};

function renderDialog(props: Partial<Parameters<typeof AnalysisSetupDialog>[0]> = {}) {
  const onPrepared = vi.fn().mockResolvedValue(true);
  const onOpenChange = vi.fn();
  render(
    <AnalysisSetupDialog
      open
      onOpenChange={onOpenChange}
      bookingId={42}
      setup={setup()}
      legacy={legacy}
      onPrepared={onPrepared}
      {...props}
    />,
  );
  return { onPrepared, onOpenChange };
}

const prepareButton = () => screen.getByRole("button", { name: /Prepare & Open/ });

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.listBookingAnalysisInputSources.mockResolvedValue({ data: { count: 2, results: [current, older] }, status: 200 });
  api.saveBookingAnalysisSetup.mockImplementation(async () => ({ data: setup(), status: 200 }));
});

describe("AnalysisSetupDialog — My Research", () => {
  it("shows the linked project, folders and where to save results", async () => {
    renderDialog();
    const dialog = screen.getByTestId("analysis-setup-dialog");
    expect(within(dialog).getByText("Save to My Research project")).toBeTruthy();
    expect(dialog.textContent).toContain("Saving to Polymer study / IICDSA0042");
    expect(screen.getByTestId("folder-preview").textContent).toContain("IICDSA0042/Raw Data·Processed Data");
    expect(screen.getByTestId("pc-output-path").textContent).toBe("D:\\RemoteAnalysis\\Sessions\\IICDSA0042\\Output");
    expect(screen.getByTestId("destination-label").textContent).toBe("My Research › Polymer study / IICDSA0042 / Processed Data");
    expect(dialog.textContent).toContain("Once the copy is verified, it is removed from the Analysis PC.");
    await waitFor(() => expect(screen.getByTestId("selected-input-booking").textContent).toContain("3 files"));
  });

  it("saves the setup for the current booking and opens", async () => {
    const { onPrepared } = renderDialog();
    await waitFor(() => expect(prepareButton().hasAttribute("disabled")).toBe(false));
    fireEvent.click(prepareButton());
    await waitFor(() => expect(onPrepared).toHaveBeenCalled());
    expect(api.saveBookingAnalysisSetup).toHaveBeenCalledWith(42, {
      workspace_id: "ws1",
      new_workspace_name: null,
      input_source: "booking",
      input_booking_id: 42,
    });
    expect(onPrepared.mock.calls[0][0]).toMatchObject({ source: "booking", inputLabel: "IICDSA0042 · 3 files" });
  });

  it("uses an older booking chosen from the list", async () => {
    const { onPrepared } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Change booking" }));
    const picker = await screen.findByTestId("input-booking-picker");
    fireEvent.click(await within(picker).findByRole("radio", { name: /IICDSA0017/ }));
    expect(screen.getByTestId("selected-input-booking").textContent).toContain("IICDSA0017");
    fireEvent.click(prepareButton());
    await waitFor(() => expect(onPrepared).toHaveBeenCalled());
    expect(api.saveBookingAnalysisSetup.mock.calls[0][1]).toMatchObject({ input_booking_id: 17, input_source: "booking" });
  });

  it("asks for a project when the booking isn't in one yet", async () => {
    renderDialog({
      setup: setup({
        my_research: {
          eligible: true,
          reason: null,
          current_link: null,
          workspaces: [
            { id: "ws1", name: "Polymer study", booking_linked: false },
            { id: "ws2", name: "Thin films", booking_linked: false },
          ],
          can_create: true,
        },
      }),
    });
    expect(screen.getByTestId("project-picker")).toBeTruthy();
    expect(screen.getByText("Choose a My Research project.")).toBeTruthy();
    expect(prepareButton().hasAttribute("disabled")).toBe(true);
    expect(screen.getByTestId("destination-label").textContent).toBe("My Research › your project / IICDSA0042 / Processed Data");
  });

  it("reopens with the last upload and can continue without new files", async () => {
    const previous = setup({ input: { default_source: "booking", default_booking_id: 42, selected: { source: "upload", booking_id: null, virtual_id: null, file_count: 2 } } });
    api.saveBookingAnalysisSetup.mockResolvedValue({ data: previous, status: 200 });
    const { onPrepared } = renderDialog({ setup: previous, title: "Confirm your analysis setup" });
    expect(screen.getByText("Confirm your analysis setup")).toBeTruthy();
    expect(screen.getByTestId("previous-upload").textContent).toContain("2 files you uploaded earlier will be used");
    expect(prepareButton().hasAttribute("disabled")).toBe(false);
    fireEvent.click(prepareButton());
    await waitFor(() => expect(onPrepared).toHaveBeenCalled());
    expect(api.saveBookingAnalysisSetup).toHaveBeenCalledTimes(1);
    expect(api.saveBookingAnalysisSetup.mock.calls[0][1]).toMatchObject({ input_source: "upload", workspace_id: "ws1" });
    expect(onPrepared.mock.calls[0][0]).toMatchObject({ source: "upload" });
  });

  it("explains server validation errors", async () => {
    api.saveBookingAnalysisSetup.mockResolvedValue({ error: "bad", errorCode: "invalid_workspace", status: 400 });
    const { onPrepared } = renderDialog();
    await waitFor(() => expect(prepareButton().hasAttribute("disabled")).toBe(false));
    fireEvent.click(prepareButton());
    expect((await screen.findByRole("alert")).textContent).toBe("That project is no longer available. Choose another project.");
    expect(onPrepared).not.toHaveBeenCalled();
  });
});

describe("AnalysisSetupDialog — without My Research", () => {
  it("uploads files to the booking and saves the upload choice", async () => {
    api.uploadBookingAnalysisFileWithProgress.mockImplementation(async (_id: number, file: File, onProgress: (n: number) => void) => {
      onProgress(file.size);
      return { data: { ok: true }, status: 201 };
    });
    const notEligible = setup({
      my_research: { eligible: false, reason: "not_enrolled", current_link: null, workspaces: [], can_create: false },
      output: { pc_output_path: null, destination_label: "Booking Details › Analyzed Data", auto_delete_after_verify: false },
    });
    api.saveBookingAnalysisSetup.mockResolvedValue({ data: notEligible, status: 200 });
    const { onPrepared } = renderDialog({ setup: notEligible });

    expect(screen.queryByText("Save to My Research project")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: /Upload from my computer/ }));
    const file = new File(["a,b\n1,2"], "spectrum.csv", { type: "text/csv" });
    fireEvent.change(screen.getByTestId("upload-input"), { target: { files: [file] } });
    expect(screen.getByRole("list", { name: "Files to upload" }).textContent).toContain("spectrum.csv");

    fireEvent.click(prepareButton());
    await waitFor(() => expect(onPrepared).toHaveBeenCalled());
    expect(api.uploadBookingAnalysisFileWithProgress).toHaveBeenCalledTimes(1);
    expect(api.uploadBookingAnalysisFileWithProgress.mock.calls[0][1]).toBe(file);
    expect(api.saveBookingAnalysisSetup.mock.calls.map((c) => c[1].input_source)).toEqual(["upload", "upload"]);
    expect(api.saveBookingAnalysisSetup.mock.calls[0][1].workspace_id).toBeNull();
    expect(onPrepared.mock.calls[0][0]).toMatchObject({ source: "upload" });
  });
});

describe("AnalysisSetupDialog — backend without the setup API", () => {
  it("shows the same dialog without the project step and keeps results in Booking Details", async () => {
    const { onPrepared } = renderDialog({ setup: null });
    expect(screen.queryByText("Save to My Research project")).toBeNull();
    expect(screen.getByTestId("destination-label").textContent).toBe("Booking Details › Analyzed Data");
    expect(screen.getByTestId("selected-input-booking").textContent).toContain("IICDSA0042");
    fireEvent.click(prepareButton());
    await waitFor(() => expect(onPrepared).toHaveBeenCalled());
    expect(api.saveBookingAnalysisSetup).not.toHaveBeenCalled();
    expect(api.selectBookingAnalysisData).not.toHaveBeenCalled();
    expect(onPrepared.mock.calls[0][0]).toMatchObject({ setup: null, source: "booking" });
  });

  it("stages another booking's data through the older selection endpoint", async () => {
    api.getBookingAnalysisDataBrowser.mockResolvedValue({
      data: {
        datasets: [
          { booking_pk: 42, virtual_booking_id: "IICDSA0042", equipment_name: "DSA", is_current: true, file_count: 3 },
          { booking_pk: 17, virtual_booking_id: "IICDSA0017", equipment_name: "DSA", is_current: false, file_count: 6 },
        ],
        pagination: { has_more: false },
      },
      status: 200,
    });
    api.selectBookingAnalysisData.mockResolvedValue({ data: {}, status: 200 });
    const { onPrepared } = renderDialog({ setup: null });
    fireEvent.click(screen.getByRole("button", { name: "Change booking" }));
    fireEvent.click(await screen.findByRole("radio", { name: /IICDSA0017/ }));
    fireEvent.click(prepareButton());
    await waitFor(() => expect(onPrepared).toHaveBeenCalled());
    expect(api.listBookingAnalysisInputSources).not.toHaveBeenCalled();
    expect(api.selectBookingAnalysisData).toHaveBeenCalledWith(42, { source_booking_id: 17, stage: true });
  });
});
