// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: { getToken: () => null } }));

import { istemRegisterApi, istemTestKey } from "./istemLinkApi";

describe("I-STEM registration test key", () => {
  afterEach(() => {
    sessionStorage.clear();
    window.history.replaceState(null, "", "/");
    vi.unstubAllGlobals();
  });

  it("is taken from the test link and kept for the tab", () => {
    window.history.replaceState(null, "", "/auth?mode=register&istem_test=k3y");
    expect(istemTestKey()).toBe("k3y");
    window.history.replaceState(null, "", "/auth");
    expect(istemTestKey()).toBe("k3y");
  });

  it("is sent with the availability check and the look-up", async () => {
    window.history.replaceState(null, "", "/auth?istem_test=k3y");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ available: true }) });
    vi.stubGlobal("fetch", fetchMock);
    await istemRegisterApi.availability();
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/istem\/register\/availability\/\?istem_test=k3y$/);
    await istemRegisterApi.lookup("a@b.example.com", "");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ email: "a@b.example.com", mobile: "", istem_test: "k3y" });
  });

  it("is left out without a test link", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ available: false }) });
    vi.stubGlobal("fetch", fetchMock);
    await istemRegisterApi.availability();
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/istem\/register\/availability\/$/);
  });
});
