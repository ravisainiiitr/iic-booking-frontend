// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { PcFolderListing } from "@/lib/analysisSetupTypes";

const api = vi.hoisted(() => ({
  browsePcFolders: vi.fn(),
  getPcBrowseResult: vi.fn(),
  endBookingAnalysis: vi.fn(),
  setPcFolders: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: api }));

import { breadcrumbs, isInside } from "@/lib/pcFolders";
import { EndSessionDialog } from "./EndSessionDialog";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const places: PcFolderListing = {
  path: "",
  parent: null,
  can_select: false,
  reason: null,
  places: [
    { label: "Desktop", path: "C:\\Users\\lab\\Desktop" },
    { label: "Data (D:)", path: "D:\\" },
  ],
  recent: [{ path: "D:\\Results\\Run1", name: "Run1", changed_files: 4 }],
  folders: [],
  files: [],
  file_count: 0,
  truncated: false,
};

const run1: PcFolderListing = {
  path: "D:\\Results\\Run1",
  parent: "D:\\Results",
  can_select: true,
  reason: null,
  summary: { files: 4, bytes: 4096, truncated: false },
  folders: [{ name: "plots", path: "D:\\Results\\Run1\\plots", can_select: true }],
  files: [{ name: "fit.csv", size: 1200 }],
  file_count: 1,
  truncated: false,
};

const drive: PcFolderListing = {
  path: "D:\\",
  parent: null,
  can_select: false,
  reason: "A whole drive cannot be chosen. Open it and choose a folder inside.",
  folders: [{ name: "Results", path: "D:\\Results", can_select: true }],
  files: [],
  file_count: 0,
  truncated: false,
};

const listings: Record<string, PcFolderListing> = { "": places, "D:\\Results\\Run1": run1, "D:\\": drive };

function renderDialog(props: Partial<Parameters<typeof EndSessionDialog>[0]> = {}) {
  const onEnded = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <EndSessionDialog
      open
      onOpenChange={onOpenChange}
      bookingId={42}
      mode="end"
      destinationLabel="My Research › Polymer study / IICDSA0042 / Processed Data"
      onEnded={onEnded}
      {...props}
    />,
  );
  return { onEnded, onOpenChange };
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  let n = 0;
  const pending = new Map<string, string>();
  api.browsePcFolders.mockImplementation(async (_id: number, path: string) => {
    const id = `req-${++n}`;
    pending.set(id, path);
    return { data: { request_id: id }, status: 202 };
  });
  api.getPcBrowseResult.mockImplementation(async (_id: number, req: string) => {
    const listing = listings[pending.get(req) ?? ""];
    return listing
      ? { data: { status: "done", result: listing }, status: 200 }
      : { data: { status: "failed", detail: "This folder no longer exists." }, status: 200 };
  });
  api.endBookingAnalysis.mockResolvedValue({ data: { ok: true }, status: 200 });
  api.setPcFolders.mockImplementation(async (_id: number, folders: string[]) => ({ data: { folders }, status: 200 }));
});

const waitForListing = async (text: string) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1100);
  });
  await waitFor(() => expect(screen.getByTestId("folder-browser").textContent).toContain(text));
};

describe("path helpers", () => {
  it("builds breadcrumbs and detects nested folders", () => {
    expect(breadcrumbs("D:\\Data\\Run1")).toEqual([
      { label: "D:", path: "D:\\" },
      { label: "Data", path: "D:\\Data" },
      { label: "Run1", path: "D:\\Data\\Run1" },
    ]);
    expect(isInside("D:\\Data\\Run1\\x", "D:\\data\\run1")).toBe(true);
    expect(isInside("D:\\Data\\Run10", "D:\\Data\\Run1")).toBe(false);
    expect(isInside("D:\\Data", "D:\\Data")).toBe(false);
    expect(isInside("D:\\Data", "D:\\")).toBe(true);
  });
});

describe("EndSessionDialog", () => {
  it("ends the session without extra folders", async () => {
    const { onEnded } = renderDialog();
    expect(screen.getByText(/No folders chosen yet/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /End session & save results/ }));
    await waitFor(() => expect(onEnded).toHaveBeenCalled());
    expect(api.endBookingAnalysis).toHaveBeenCalledWith(42, "Finished early by user", []);
  });

  it("browses the PC, chooses a suggested folder and ends with it", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { onEnded } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Add folder" }));
    expect(api.browsePcFolders).toHaveBeenCalledWith(42, "");
    await waitForListing("Changed during this session");
    expect(screen.getByTestId("folder-browser").textContent).toContain("Data (D:)");

    fireEvent.doubleClick(screen.getByRole("option", { name: /Run1/ }));
    await waitForListing("fit.csv");
    expect(screen.getByTestId("choose-hint").textContent).toBe("4 files · 4.0 KB");
    fireEvent.click(screen.getByRole("button", { name: "Choose this folder" }));

    const chosen = screen.getByTestId("chosen-folders");
    expect(chosen.textContent).toContain("D:\\Results\\Run1");
    expect(chosen.textContent).toContain("4 files · 4.0 KB");
    expect(screen.getByRole("button", { name: "Add more" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /End session & save results/ }));
    await waitFor(() => expect(onEnded).toHaveBeenCalled());
    expect(api.endBookingAnalysis).toHaveBeenCalledWith(42, "Finished early by user", [{ path: "D:\\Results\\Run1", kind: "folder" }]);
  });

  it("explains why a drive cannot be chosen", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Add folder" }));
    await waitForListing("Places");
    fireEvent.click(screen.getByRole("button", { name: "Data (D:)" }));
    await waitForListing("Results");
    expect(screen.getByRole("button", { name: "Choose this folder" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByTestId("choose-hint").textContent).toContain("A whole drive cannot be chosen");
  });

  it("shows the Analysis PC's error and keeps the dialog usable", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.browsePcFolders.mockResolvedValueOnce({
      error: "This Analysis PC needs an agent update before folders can be chosen.",
      errorCode: "picker_unsupported",
      status: 409,
    });
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Add folder" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("needs an agent update"));
    fireEvent.click(screen.getByRole("button", { name: /Back/ }));
    expect(screen.getByRole("button", { name: /End session & save results/ }).hasAttribute("disabled")).toBe(false);
  });

  it("starts from folders chosen earlier and merges a chosen parent", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    listings["D:\\Results"] = { ...run1, path: "D:\\Results", parent: "D:\\", folders: [], files: [], file_count: 0 };
    renderDialog({ initialFolders: ["D:\\Results\\Run1"] });
    expect(screen.getByTestId("chosen-folders").textContent).toContain("D:\\Results\\Run1");
    fireEvent.click(screen.getByRole("button", { name: "Add more" }));
    await waitForListing("Places");
    fireEvent.click(screen.getByRole("button", { name: "Data (D:)" }));
    await waitForListing("Results");
    fireEvent.doubleClick(screen.getByRole("option", { name: /^Results/ }));
    await waitForListing("This folder is empty");
    fireEvent.click(screen.getByRole("button", { name: "Choose this folder" }));
    const rows = screen.getByTestId("chosen-folders").querySelectorAll("li");
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain("D:\\Results");
    expect(screen.getByRole("status").textContent).toContain("merged into it");
  });

  it("in choose mode saves the folder list instead of ending", async () => {
    const onSaved = vi.fn();
    renderDialog({ mode: "choose", initialFolders: ["D:\\Results\\Run1"], onSaved });
    fireEvent.click(screen.getByRole("button", { name: "Save list" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith([{ path: "D:\\Results\\Run1", kind: "folder" }]));
    expect(api.setPcFolders).toHaveBeenCalledWith(42, [{ path: "D:\\Results\\Run1", kind: "folder" }]);
    expect(api.endBookingAnalysis).not.toHaveBeenCalled();
  });

  it("single click selects, double click opens, and several folders and files can be added at once", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    listings["D:\\Results\\Run1"] = {
      ...run1,
      files: [
        { name: "fit.csv", path: "D:\\Results\\Run1\\fit.csv", size: 1200, can_select: true },
        { name: "busy.partial", path: "D:\\Results\\Run1\\busy.partial", size: 5, can_select: false },
      ],
      file_count: 2,
    };
    const { onEnded } = renderDialog({ allowFiles: true });
    fireEvent.click(screen.getByRole("button", { name: "Add folders or files" }));
    await waitForListing("Changed during this session");

    const suggestion = screen.getByRole("option", { name: /Run1/ });
    fireEvent.click(suggestion);
    expect(suggestion.getAttribute("aria-selected")).toBe("true");
    expect(api.browsePcFolders).toHaveBeenCalledTimes(1);
    fireEvent.click(suggestion);
    expect(suggestion.getAttribute("aria-selected")).toBe("false");

    fireEvent.keyDown(suggestion, { key: "Enter" });
    await waitForListing("fit.csv");
    expect(api.browsePcFolders).toHaveBeenLastCalledWith(42, "D:\\Results\\Run1");

    fireEvent.click(screen.getByRole("option", { name: /plots/ }));
    fireEvent.click(screen.getByRole("option", { name: /fit\.csv/ }));
    fireEvent.click(screen.getByRole("option", { name: /busy\.partial/ }));
    expect(screen.getByRole("option", { name: /busy\.partial/ }).getAttribute("aria-selected")).toBe("false");
    expect(screen.getByTestId("choose-hint").textContent).toContain("2 selected");
    fireEvent.click(screen.getByRole("button", { name: "Add 2 selected" }));

    const chosen = screen.getByTestId("chosen-folders");
    expect(chosen.querySelectorAll("li")).toHaveLength(2);
    expect(chosen.textContent).toContain("fit.csv");
    expect(chosen.textContent).toContain("1.2 KB");

    fireEvent.click(screen.getByRole("button", { name: /End session & save results/ }));
    await waitFor(() => expect(onEnded).toHaveBeenCalled());
    expect(api.endBookingAnalysis).toHaveBeenCalledWith(42, "Finished early by user", [
      { path: "D:\\Results\\Run1\\plots", kind: "folder" },
      { path: "D:\\Results\\Run1\\fit.csv", kind: "file" },
    ]);
  });

  it("does not select items already covered by a chosen folder", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    listings["D:\\Results\\Run1"] = {
      ...run1,
      files: [{ name: "fit.csv", path: "D:\\Results\\Run1\\fit.csv", size: 1200, can_select: true }],
    };
    renderDialog({ allowFiles: true, initialFolders: [{ path: "D:\\Results\\Run1", kind: "folder" }] });
    fireEvent.click(screen.getByRole("button", { name: "Add more" }));
    await waitForListing("Places");
    fireEvent.doubleClick(screen.getByRole("option", { name: /Run1/ }));
    await waitForListing("fit.csv");
    fireEvent.click(screen.getByRole("option", { name: /fit\.csv/ }));
    expect(screen.getByRole("option", { name: /fit\.csv/ }).getAttribute("aria-selected")).toBe("false");
    expect(screen.getByTestId("choose-hint").textContent).toContain("already included in D:\\Results\\Run1");
  });
});
