import { describe, expect, it, vi } from "vitest";
import {
  formatBytes,
  pickSaveTarget,
  pipeToFile,
  preparingProgress,
  progressFor,
  type ResultsDownloadProgress,
} from "./resultsDownload";

function streamOf(chunks: number[][], failAfter?: number): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (failAfter != null && i === failAfter) {
        controller.error(new Error("network lost"));
        return;
      }
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(new Uint8Array(chunks[i++]));
    },
  });
}

function fakeTarget() {
  const written: number[] = [];
  return {
    written,
    write: vi.fn(async (data: Uint8Array) => {
      written.push(...data);
    }),
    close: vi.fn(async () => undefined),
    abort: vi.fn(async () => undefined),
  };
}

describe("progressFor", () => {
  it("reports bytes against the total and holds at 99 until done", () => {
    expect(progressFor(50, 200).percent).toBe(25);
    expect(progressFor(210, 200).percent).toBe(99);
  });

  it("has no percentage when the total is unknown", () => {
    expect(progressFor(1024, 0)).toEqual({ phase: "downloading", receivedBytes: 1024, totalBytes: 0, percent: null });
  });
});

describe("pipeToFile", () => {
  it("writes every chunk as it arrives and reports real progress", async () => {
    const target = fakeTarget();
    const seen: ResultsDownloadProgress[] = [];

    await pipeToFile(streamOf([[1, 2], [3, 4], [5, 6, 7, 8]]), target, 8, (p) => seen.push(p));

    expect(target.written).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(target.close).toHaveBeenCalledOnce();
    expect(seen.map((p) => p.percent)).toEqual([0, 25, 50, 99, 100]);
    expect(seen.at(-1)?.phase).toBe("done");
  });

  it("discards the partial file when the download fails", async () => {
    const target = fakeTarget();

    await expect(pipeToFile(streamOf([[1], [2]], 1), target, 2)).rejects.toThrow("network lost");

    expect(target.abort).toHaveBeenCalledOnce();
    expect(target.close).not.toHaveBeenCalled();
  });
});

describe("pickSaveTarget", () => {
  it("returns null when the user dismisses the save dialog", async () => {
    const picker = vi.fn(async () => {
      throw Object.assign(new Error("dismissed"), { name: "AbortError" });
    });
    await expect(pickSaveTarget(picker, "Results.zip")).resolves.toBeNull();
    expect(picker).toHaveBeenCalledWith({ suggestedName: "Results.zip" });
  });

  it("rethrows when the picker cannot be shown so the caller can fall back", async () => {
    const picker = vi.fn(async () => {
      throw Object.assign(new Error("no user activation"), { name: "SecurityError" });
    });
    await expect(pickSaveTarget(picker, "Results.zip")).rejects.toThrow("no user activation");
  });
});

describe("preparingProgress", () => {
  it("shows the server-side build as a percentage held below 100", () => {
    expect(preparingProgress(0.5, 400)).toEqual({ phase: "preparing", receivedBytes: 200, totalBytes: 400, percent: 50 });
    expect(preparingProgress(1, 400).percent).toBe(99);
  });
});

it("formats sizes for the progress label", () => {
  expect(formatBytes(384.5 * 1024 * 1024)).toBe("384.5 MB");
  expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe("2.00 GB");
});
