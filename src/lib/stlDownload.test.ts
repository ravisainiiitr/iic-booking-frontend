// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient, downloadWithProgress } from "@/lib/api";

const STL = new TextEncoder().encode("solid Eiffel_tower_sample\nendsolid Eiffel_tower_sample\n");

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

function stl() {
  return new Response(STL, { status: 200, headers: { "Content-Length": String(STL.byteLength) } });
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  apiClient.setToken("tok-1");
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  vi.useRealTimers();
});

const urlOf = (call: unknown[]) => String(call[0]);

describe("booked STL download for the View Booking preview", () => {
  it("reads the model straight from storage through the presigned link, without cookies or the API token", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes("/stl-presign/") ? json({ url: "https://bucket.s3.amazonaws.com/media/print_3d/a.STL?X-Amz-Signature=x" }) : stl(),
    );
    const progress = vi.fn();
    const res = await apiClient.getPrintAnalysisStlBuffer("a1", { onProgress: progress });

    expect(new TextDecoder().decode(res.buffer)).toContain("solid Eiffel_tower_sample");
    const direct = fetchMock.mock.calls.find((c) => urlOf(c).startsWith("https://bucket.s3"))!;
    expect(direct[1]).toMatchObject({ credentials: "omit", headers: {} });
    expect(progress).toHaveBeenLastCalledWith(STL.byteLength, STL.byteLength);
    expect(fetchMock.mock.calls.some((c) => urlOf(c).endsWith("/print-analyses/a1/stl/"))).toBe(false);
  });

  it("falls back to the API stream with the token when storage cannot be read from the page", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/stl-presign/")) return json({ url: "https://bucket.s3.amazonaws.com/a.stl?sig=1" });
      if (url.startsWith("https://bucket.s3")) throw new TypeError("Failed to fetch");
      return stl();
    });
    const res = await apiClient.getPrintAnalysisStlBuffer("a1");

    expect(res.buffer?.byteLength).toBe(STL.byteLength);
    const api = fetchMock.mock.calls.find((c) => urlOf(c).endsWith("/print-analyses/a1/stl/"))!;
    expect(api[1]).toMatchObject({ credentials: "omit", headers: { Authorization: "Token tok-1" } });
  });

  it("uses the API stream when storage is not S3 (presign answers with the API link)", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes("/stl-presign/") ? json({ url: "/api/print-analyses/a1/stl/" }) : stl(),
    );
    const res = await apiClient.getPrintAnalysisStlBuffer("a1");
    expect(res.buffer?.byteLength).toBe(STL.byteLength);
    expect(fetchMock.mock.calls.filter((c) => !urlOf(c).includes("/stl-presign/")).map(urlOf)).toEqual([
      expect.stringMatching(/\/print-analyses\/a1\/stl\/$/),
    ]);
  });

  it("reports the HTTP status instead of waiting when the file is gone", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes("/stl-presign/") ? new Response("{}", { status: 404 }) : new Response("{}", { status: 404 }),
    );
    expect(await apiClient.getPrintAnalysisStlBuffer("a1")).toEqual({ error: "HTTP 404" });
  });

  it("gives up on a download that stops sending data, so the preview never stays blank", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    );
    const pending = downloadWithProgress("/api/print-analyses/a1/stl/", {}, { stallMs: 1000 });
    await vi.advanceTimersByTimeAsync(1001);
    expect(await pending).toEqual({ error: "the download stopped responding" });
  });
});
