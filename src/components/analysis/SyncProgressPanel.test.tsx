// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { AnalysisSyncStatus } from "@/lib/analysisSetupTypes";
import { SyncProgressPanel } from "./SyncProgressPanel";

afterEach(cleanup);

const base: AnalysisSyncStatus = {
  phase: "copying_to_workspace",
  direction: "output",
  percent: 40,
  bytes_done: 4 * 1024 * 1024,
  bytes_total: 10 * 1024 * 1024,
  files_done: 2,
  files_total: 5,
  current_file: "Output/spectrum.csv",
  message: null,
  verified: false,
  pc_cleanup: null,
  kept_files: [],
  destination: null,
  updated_at: null,
  poll_after_ms: 2000,
};

const renderPanel = (props: Partial<Parameters<typeof SyncProgressPanel>[0]>) =>
  render(
    <MemoryRouter>
      <SyncProgressPanel status={base} {...props} />
    </MemoryRouter>,
  );

describe("SyncProgressPanel", () => {
  it("announces live copy progress", () => {
    renderPanel({});
    const panel = screen.getByTestId("sync-progress");
    expect(panel.getAttribute("aria-live")).toBe("polite");
    expect(panel.textContent).toContain("Copying results to My Research — 40%");
    expect(panel.textContent).toContain("4 MB of 10 MB · 2 of 5 files");
    expect(panel.textContent).toContain("Output/spectrum.csv");
    expect(screen.getByRole("progressbar", { name: "Copy progress" })).toBeTruthy();
  });

  it("links to My Research once results are saved", () => {
    renderPanel({
      status: { ...base, phase: "done", files_done: 5, pc_cleanup: "done" },
      myResearchHref: "/my-research/ws1?tab=files&folder=f2",
    });
    expect(screen.getByTestId("sync-progress").textContent).toContain(
      "5 files saved to Processed Data · Removed from the Analysis PC",
    );
    expect(screen.getByRole("link", { name: /Open in My Research/ }).getAttribute("href")).toBe(
      "/my-research/ws1?tab=files&folder=f2",
    );
  });

  it("lists kept files and offers a retry on failure", () => {
    const onRetry = vi.fn();
    renderPanel({ status: { ...base, phase: "failed", kept_files: ["Output/a.csv"] }, onRetry });
    expect(screen.getByText("Output/a.csv")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Retry now/ }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows each chosen folder: copied and removed, partly kept, or skipped", () => {
    renderPanel({
      status: {
        ...base,
        phase: "done",
        verified: true,
        pc_cleanup: "kept",
        kept_files: ["Run2/late.csv"],
        pc_removed_folders: ["D:\\Results\\Run1"],
        extra_folders: [
          { path: "D:\\Results\\Run1", alias: "Run1", files: 3, bytes: 2048 },
          { path: "D:\\Results\\Run2", alias: "Run2", files: 2, bytes: 10 },
          { path: "D:\\Results\\Gone", alias: "", files: 0, bytes: 0, error: "The folder no longer exists on the Analysis PC." },
        ],
      },
    });
    const rows = screen.getByTestId("extra-folders").querySelectorAll("li");
    expect(rows[0].textContent).toContain("Run1 · 3 files · 2.0 KB");
    expect(rows[0].textContent).toContain("Copied · removed from the Analysis PC");
    expect(rows[1].textContent).toContain("1 file left on the PC");
    expect(rows[2].textContent).toContain("Gone");
    expect(rows[2].textContent).toContain("no longer exists");
  });

  it("renders nothing while the session is running", () => {
    renderPanel({ status: { ...base, phase: "in_session" } });
    expect(screen.queryByTestId("sync-progress")).toBeNull();
  });
});
