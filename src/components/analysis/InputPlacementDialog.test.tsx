// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const placeInput = vi.fn();
const getInputPlacement = vi.fn();
vi.mock("@/lib/api", () => ({
  apiClient: {
    placeInput: (...a: unknown[]) => placeInput(...a),
    getInputPlacement: (...a: unknown[]) => getInputPlacement(...a),
    browsePcFolders: vi.fn(),
    getPcBrowseResult: vi.fn(),
  },
}));

import { InputPlacementDialog } from "./InputPlacementDialog";

const done = {
  status: "done",
  session_id: "s1",
  request_id: "r1",
  path: "C:\\Users\\a\\Desktop\\IICXRD202600041",
  display_path: "Desktop › IICXRD202600041",
  files: 3,
  opened: true,
};

function renderDialog(extra: Partial<Parameters<typeof InputPlacementDialog>[0]> = {}) {
  const onPlaced = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <InputPlacementDialog
      open
      onOpenChange={onOpenChange}
      bookingId={41}
      defaultFolderName="IICXRD202600041"
      fileCount={3}
      sourceLabel="booking IICXRD202600041"
      canBrowse
      onPlaced={onPlaced}
      {...extra}
    />,
  );
  return { onPlaced, onOpenChange };
}

beforeEach(() => {
  placeInput.mockReset();
  getInputPlacement.mockReset();
});
afterEach(cleanup);

describe("InputPlacementDialog", () => {
  it("defaults to a booking folder on the Desktop and says where it will go", () => {
    renderDialog();
    expect(screen.getByText("Where should we put your input data?")).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Desktop/ }).getAttribute("aria-checked")).toBe("true");
    expect((screen.getByLabelText("Folder name") as HTMLInputElement).value).toBe("IICXRD202600041");
    expect(screen.getByTestId("input-placement-dialog").textContent).toContain("Saved to Desktop › IICXRD202600041");
    expect(screen.getByTestId("input-placement-dialog").textContent).toContain("3 files from booking IICXRD202600041");
  });

  it("saves to the chosen place, waits for the PC and confirms", async () => {
    placeInput.mockResolvedValue({ data: { request_id: "r1", folder_name: "Run 1" } });
    getInputPlacement.mockResolvedValue({ data: { supported: true, placement: done } });
    const { onPlaced } = renderDialog();
    fireEvent.click(screen.getByRole("radio", { name: /Documents/ }));
    fireEvent.change(screen.getByLabelText("Folder name"), { target: { value: "Run 1" } });
    fireEvent.click(screen.getByRole("button", { name: "Save and open" }));

    await waitFor(() => expect(screen.getByText("Your input data is on the Analysis PC")).toBeTruthy(), { timeout: 4000 });
    expect(placeInput).toHaveBeenCalledWith(41, { place: "Documents", folder_name: "Run 1" });
    expect(onPlaced).toHaveBeenCalledWith(done);
    expect(screen.getByTestId("input-placement-dialog").textContent).toContain("The folder is open on the desktop.");
  });

  it("shows the PC's reason when saving fails and lets the user try again", async () => {
    placeInput.mockResolvedValue({ data: { request_id: "r2", folder_name: "x" } });
    getInputPlacement.mockResolvedValue({
      data: { supported: true, placement: { status: "failed", session_id: "s1", request_id: "r2", detail: "Your input data has not reached the Analysis PC yet." } },
    });
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Save and open" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("not reached the Analysis PC"), { timeout: 4000 });
    expect((screen.getByRole("button", { name: "Save and open" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("needs a folder name and can be put off", () => {
    const { onOpenChange } = renderDialog();
    fireEvent.change(screen.getByLabelText("Folder name"), { target: { value: "   " } });
    expect((screen.getByRole("button", { name: "Save and open" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("can be closed while copying, so a slow PC never traps the user", async () => {
    placeInput.mockResolvedValue({ data: { request_id: "r3", folder_name: "x" } });
    getInputPlacement.mockResolvedValue({ data: { supported: true, placement: { status: "pending", session_id: "s1", request_id: "r3" } } });
    const { onOpenChange } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Save and open" }));
    const keep = await screen.findByRole("button", { name: "Keep working" });
    expect((keep as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(keep);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("offers another folder only when the PC can list folders", () => {
    renderDialog({ canBrowse: false });
    expect(screen.queryByText("Another folder or drive…")).toBeNull();
  });
});
