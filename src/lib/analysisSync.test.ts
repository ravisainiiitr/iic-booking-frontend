import { describe, expect, it } from "vitest";
import type { AnalysisSyncStatus } from "@/lib/analysisSetupTypes";
import {
  clampPollDelay,
  describeSync,
  formatBytes,
  isMissingEndpoint,
  legacySyncFromSummary,
  myResearchFolderHref,
} from "./analysisSync";

const MB = 1024 * 1024;

const status = (over: Partial<AnalysisSyncStatus> = {}): AnalysisSyncStatus => ({
  phase: "copying_to_workspace",
  direction: "output",
  percent: 63,
  bytes_done: 412 * MB,
  bytes_total: 650 * MB,
  files_done: 3,
  files_total: 5,
  current_file: "Output/run1.csv",
  message: null,
  verified: false,
  pc_cleanup: null,
  kept_files: [],
  destination: { workspace_id: "ws1", folder_id: "f2", path_label: "Polymer study / BK1 / Processed Data" },
  updated_at: null,
  poll_after_ms: 2000,
  ...over,
});

describe("describeSync", () => {
  it("shows percent, bytes and files while copying", () => {
    const d = describeSync(status());
    expect(d.tone).toBe("progress");
    expect(d.headline).toBe("Copying results to My Research — 63%");
    expect(d.detail).toBe("412 MB of 650 MB · 3 of 5 files");
    expect(d.percent).toBe(63);
  });

  it("falls back to a file count when the total is unknown", () => {
    const d = describeSync(status({ percent: null, files_done: 2, files_total: null }));
    expect(d.headline).toBe("Copying results to My Research");
    expect(d.detail).toBe("2 files received");
    expect(d.percent).toBeNull();
  });

  it("only claims PC removal when cleanup is done", () => {
    expect(describeSync(status({ phase: "done", files_done: 5, pc_cleanup: "done" })).headline).toBe(
      "5 files saved to Processed Data",
    );
    expect(describeSync(status({ phase: "done", files_done: 5, pc_cleanup: "done" })).detail).toBe("Removed from the Analysis PC");
    expect(describeSync(status({ phase: "done", files_done: 5, pc_cleanup: "not_supported" })).detail).toBeNull();
    expect(
      describeSync(status({ phase: "done", files_done: 5, pc_cleanup: "kept", kept_files: ["a.csv"] })).detail,
    ).toBe("1 file kept on the Analysis PC");
  });

  it("is honest when nothing was in the Output folder", () => {
    const d = describeSync(status({ phase: "done", files_done: 0, files_total: 0 }));
    expect(d.headline).toBe("No result files were found in the Output folder");
  });

  it("lists kept files on failure", () => {
    const d = describeSync(status({ phase: "failed", kept_files: ["a.csv", "b.csv"] }));
    expect(d.tone).toBe("failed");
    expect(d.headline).toBe("2 files couldn't be verified");
    expect(d.detail).toMatch(/still on the Analysis PC/);
  });

  it("hides raw storage errors and reassures when the PC copy was already verified", () => {
    const d = describeSync(
      status({
        phase: "failed",
        pc_cleanup: "done",
        message: "An error occurred (InvalidRange) when calling the GetObject operation: The requested range is not satisfiable",
      }),
    );
    expect(d.headline).toBe("Copying results to Processed Data didn't finish");
    expect(d.detail).toMatch(/reached the portal safely/);
  });

  it("uses the Booking Details label for legacy results", () => {
    expect(describeSync(status({ phase: "done", files_done: 1 }), "Analyzed Data").headline).toBe("1 file saved to Analyzed Data");
  });

  it("is idle outside a transfer", () => {
    expect(describeSync(status({ phase: "in_session" })).tone).toBe("idle");
    expect(describeSync(null).tone).toBe("idle");
  });
});

describe("legacySyncFromSummary", () => {
  it("maps cleanup done to a finished sync without claiming PC removal", () => {
    const s = legacySyncFromSummary({
      experience: { results: { file_count: 4 }, cleanup: { status: "done" }, workspace: { sync_phase: "completed" } },
    });
    expect(s?.phase).toBe("done");
    expect(s?.files_done).toBe(4);
    expect(s?.pc_cleanup).toBe("not_supported");
    expect(describeSync(s, "Analyzed Data").headline).toBe("4 files saved to Analyzed Data");
  });

  it("reports collecting with a file count while copying", () => {
    const s = legacySyncFromSummary({ experience: { results: { file_count: 1 }, workspace: { sync_phase: "syncing" } } });
    expect(s?.phase).toBe("collecting");
    expect(describeSync(s).detail).toBe("1 file received");
  });

  it("reports failures", () => {
    const s = legacySyncFromSummary({ experience: { workspace: { sync_phase: "failed", sync_message: "Agent offline" } } });
    expect(s?.phase).toBe("failed");
    expect(describeSync(s).headline).toBe("Agent offline");
  });
});

describe("helpers", () => {
  it("treats 404/405/501 as an undeployed endpoint", () => {
    expect(isMissingEndpoint({ error: "Not found.", status: 404 })).toBe(true);
    expect(isMissingEndpoint({ error: "Method not allowed", status: 405 })).toBe(true);
    expect(isMissingEndpoint({ error: "Forbidden", status: 403 })).toBe(false);
    expect(isMissingEndpoint({ status: 404 })).toBe(false);
  });

  it("clamps the server poll interval", () => {
    expect(clampPollDelay(2000)).toBe(2000);
    expect(clampPollDelay(50)).toBe(1000);
    expect(clampPollDelay(600000)).toBe(60000);
    expect(clampPollDelay(null, 7000)).toBe(7000);
  });

  it("formats sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(650 * MB)).toBe("650 MB");
  });

  it("links to the My Research folder", () => {
    expect(myResearchFolderHref("ws1", "f2")).toBe("/my-research/ws1?tab=files&folder=f2");
    expect(myResearchFolderHref(null, "f2")).toBeNull();
  });
});
