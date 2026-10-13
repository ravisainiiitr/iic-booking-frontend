// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const startBrowserDownload = vi.fn();
vi.mock("@/lib/resultsDownload", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/resultsDownload")>()),
  getSaveFilePicker: () => null,
  startBrowserDownload: (...args: unknown[]) => startBrowserDownload(...args),
}));

import { apiClient } from "@/lib/api";
import type { ResultsDownloadProgress } from "@/lib/resultsDownload";

type LinkResponse = { data?: Record<string, unknown>; error?: string };

function mockLinks(...responses: LinkResponse[]) {
  const calls: unknown[] = [];
  const request = vi.spyOn(apiClient as unknown as { request: (...a: unknown[]) => unknown }, "request");
  request.mockImplementation(async (_path: unknown, init: unknown) => {
    calls.push(JSON.parse(String((init as { body?: string }).body || "{}")));
    return responses.length > 1 ? responses.shift() : responses[0];
  });
  return calls;
}

const preparing = (progress: number) => ({
  data: { mode: "direct", status: "preparing", progress, filename: "Results_X.zip", total_bytes: 1000 },
});

describe("downloadBookingResultsZip", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    startBrowserDownload.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("downloads a storage link in the browser, resumable", async () => {
    mockLinks({ data: { mode: "direct", status: "ready", url: "https://s3/x.zip", filename: "x.zip", total_bytes: 5 } });

    const result = await apiClient.downloadBookingResultsZip(1);

    expect(result).toEqual({ mode: "browser", resumable: true });
    expect(startBrowserDownload).toHaveBeenCalledWith("https://s3/x.zip", "x.zip");
  });

  it("waits while the server builds the ZIP, showing its progress", async () => {
    const calls = mockLinks(
      preparing(0.2),
      preparing(0.6),
      { data: { mode: "direct", status: "ready", url: "https://s3/built.zip", filename: "Results_X.zip", total_bytes: 1000 } },
    );
    const seen: ResultsDownloadProgress[] = [];

    const pending = apiClient.downloadBookingResultsZip(1, (p) => seen.push(p));
    await vi.runAllTimersAsync();
    const result = await pending;

    expect(result.resumable).toBe(true);
    expect(seen.filter((p) => p.percent != null).map((p) => p.percent)).toEqual([20, 60]);
    expect(calls).toEqual([{}, {}, {}]);
    expect(startBrowserDownload).toHaveBeenCalledWith("https://s3/built.zip", "Results_X.zip");
  });

  it("asks for the streamed ZIP when the build stops making progress", async () => {
    const calls = mockLinks(preparing(0.1));
    const pending = apiClient.downloadBookingResultsZip(1);

    await vi.advanceTimersByTimeAsync(95_000);
    expect(calls.at(-1)).toEqual({ stream: true });
    vi.restoreAllMocks();
    mockLinks({ data: { mode: "stream", status: "ready", url: "https://api/zip?t=1", filename: "Results_X.zip", total_bytes: 1000 } });
    await vi.runAllTimersAsync();

    await expect(pending).resolves.toEqual({ mode: "browser" });
    expect(startBrowserDownload).toHaveBeenCalledWith("https://api/zip?t=1", "Results_X.zip");
  });
});
