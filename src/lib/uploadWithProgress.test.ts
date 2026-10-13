import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDuration, postFormWithProgress, uploadProgress, type UploadProgress } from "./uploadWithProgress";

class FakeXhr {
  static last: FakeXhr;
  upload: { onprogress?: (e: ProgressEvent) => void; onload?: () => void } = {};
  onload?: () => void;
  onerror?: () => void;
  onabort?: () => void;
  status = 0;
  responseText = "";
  headers: Record<string, string> = {};
  constructor() {
    FakeXhr.last = this;
  }
  open() {}
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send() {}
  abort() {
    this.onabort?.();
  }
  progress(loaded: number, total: number) {
    this.upload.onprogress?.({ lengthComputable: true, loaded, total } as ProgressEvent);
  }
}

afterEach(() => vi.unstubAllGlobals());

describe("uploadProgress", () => {
  it("holds at 99% until the server answers and estimates the time left", () => {
    expect(uploadProgress(50, 100, 2000)).toMatchObject({ phase: "uploading", percent: 50, bytesPerSecond: 25, secondsLeft: 2 });
    expect(uploadProgress(100, 100, 2000)).toMatchObject({ phase: "processing", percent: 99, secondsLeft: null });
    expect(uploadProgress(10, 100, 500).bytesPerSecond).toBeNull();
  });

  it("formats durations", () => {
    expect(formatDuration(42)).toBe("42s");
    expect(formatDuration(600)).toBe("10 min");
    expect(formatDuration(3900)).toBe("1 h 5 min");
  });
});

describe("postFormWithProgress", () => {
  it("reports upload progress, then processing, then resolves with the JSON body", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const seen: UploadProgress[] = [];
    const done = postFormWithProgress("/x", new FormData(), { Authorization: "Token t" }, (p) => seen.push(p));
    const xhr = FakeXhr.last;
    expect(xhr.headers.Authorization).toBe("Token t");
    xhr.progress(40, 200);
    xhr.progress(200, 200);
    xhr.upload.onload?.();
    xhr.status = 200;
    xhr.responseText = '{"uploaded_files":["a.zip"]}';
    xhr.onload?.();
    await expect(done).resolves.toEqual({ ok: true, status: 200, data: { uploaded_files: ["a.zip"] } });
    expect(seen[0]).toMatchObject({ phase: "uploading", sentBytes: 40, totalBytes: 200, percent: 20 });
    expect(seen[seen.length - 1]).toMatchObject({ phase: "processing", sentBytes: 200, totalBytes: 200 });
  });

  it("resolves as aborted when the signal fires", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const controller = new AbortController();
    const done = postFormWithProgress("/x", new FormData(), {}, undefined, controller.signal);
    controller.abort();
    await expect(done).resolves.toMatchObject({ ok: false, aborted: true });
  });

  it("reports HTTP errors with the server body and network errors with status 0", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const failed = postFormWithProgress("/x", new FormData(), {});
    FakeXhr.last.status = 400;
    FakeXhr.last.responseText = '{"error":"Cannot complete booking"}';
    FakeXhr.last.onload?.();
    await expect(failed).resolves.toEqual({ ok: false, status: 400, data: { error: "Cannot complete booking" } });

    const offline = postFormWithProgress("/x", new FormData(), {});
    FakeXhr.last.onerror?.();
    await expect(offline).resolves.toMatchObject({ ok: false, status: 0 });
  });
});
