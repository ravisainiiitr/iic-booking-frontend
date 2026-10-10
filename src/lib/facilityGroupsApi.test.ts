import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: { getToken: () => "tok" } }));

import {
  activeFilterCount,
  EMPTY_FILTERS,
  facilityGroupsApi,
  filtersToJson,
  filtersToParams,
  newIdempotencyKey,
  parseAddresses,
  type SendRequest,
} from "./facilityGroupsApi";

afterEach(() => {
  vi.unstubAllGlobals();
});

function okFetch(body: unknown = {}) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("filters", () => {
  it("sends only what differs from the defaults", () => {
    expect(filtersToParams(EMPTY_FILTERS).toString()).toBe("");
    expect(filtersToJson(EMPTY_FILTERS)).toEqual({});
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
  });

  it("joins lists and keeps flags", () => {
    const f = {
      ...EMPTY_FILTERS,
      department_ids: [33, 0],
      user_types: ["student", "faculty"],
      audience: "internal" as const,
      booked_from: "2026-01-01",
      include_supervisors: true,
      search: "  rao ",
    };
    const qs = filtersToParams(f, { page: 2, ordering: "-last_booked", empty: "" });
    expect(qs.get("department_ids")).toBe("33,0");
    expect(qs.get("user_types")).toBe("student,faculty");
    expect(qs.get("audience")).toBe("internal");
    expect(qs.get("booked_from")).toBe("2026-01-01");
    expect(qs.has("booked_to")).toBe(false);
    expect(qs.get("include_supervisors")).toBe("true");
    expect(qs.get("search")).toBe("rao");
    expect(qs.get("page")).toBe("2");
    expect(qs.has("empty")).toBe(false);
    expect(filtersToJson(f)).toEqual({
      department_ids: [33, 0],
      user_types: ["student", "faculty"],
      audience: "internal",
      booked_from: "2026-01-01",
      include_supervisors: true,
    });
    expect(activeFilterCount(f)).toBe(5);
  });
});

describe("parseAddresses", () => {
  it("splits, lower-cases and de-duplicates", () => {
    expect(parseAddresses("HOD@iitr.ac.in; a@b.com,\n<a@b.com>  bad@ x@y")).toEqual({
      valid: ["hod@iitr.ac.in", "a@b.com"],
      invalid: ["bad@", "x@y"],
    });
    expect(parseAddresses("  ")).toEqual({ valid: [], invalid: [] });
  });
});

describe("newIdempotencyKey", () => {
  it("is unique and fits the server column", () => {
    const a = newIdempotencyKey();
    const b = newIdempotencyKey();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(16);
    expect(a.length).toBeLessThanOrEqual(64);
  });
});

describe("facilityGroupsApi", () => {
  it("lists members with filters, paging and the token", async () => {
    const fetchMock = okFetch({ results: [] });
    await facilityGroupsApi.members(7, { ...EMPTY_FILTERS, audience: "external" }, { page: 3, page_size: 50, ordering: "name" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/admin/facility-groups/7/members/?audience=external&page=3&page_size=50&ordering=name");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Token tok");
  });

  it("previews recipients with JSON filters", async () => {
    const fetchMock = okFetch({ total: 0 });
    await facilityGroupsApi.preview([1, 2], { ...EMPTY_FILTERS, department_ids: [33] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/admin/facility-groups/email/preview/");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ group_ids: [1, 2], filters: { department_ids: [33] } });
  });

  const sendBody: SendRequest = {
    subject: "Maintenance",
    body_html: "<p>Hi {{ name }}</p>",
    cc: ["hod@iitr.ac.in"],
    bcc: [],
    cc_mode: "summary",
    reply_to: "",
    group_ids: [4],
    filters: {},
    idempotency_key: "k".repeat(32),
    expected_recipients: 12,
  };

  it("sends JSON without attachments", async () => {
    const fetchMock = okFetch({ campaign: { id: 1 }, created: true });
    await facilityGroupsApi.send(sendBody);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/admin/facility-groups/email/send/");
    expect((init?.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual(sendBody);
  });

  it("sends multipart with a payload field when files are attached", async () => {
    const fetchMock = okFetch({ campaign: { id: 1 }, created: true });
    const file = new File(["hello"], "notice.pdf", { type: "application/pdf" });
    await facilityGroupsApi.send(sendBody, [file]);
    const init = fetchMock.mock.calls[0][1];
    expect(init?.body).toBeInstanceOf(FormData);
    const form = init?.body as FormData;
    expect(JSON.parse(String(form.get("payload")))).toEqual(sendBody);
    expect((form.getAll("attachments")[0] as File).name).toBe("notice.pdf");
    expect((init?.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  });

  it("surfaces the server message, code and status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ detail: "The recipient list changed.", code: "recipients_changed" }), { status: 409 })),
    );
    await expect(facilityGroupsApi.send(sendBody)).rejects.toMatchObject({
      message: "The recipient list changed.",
      code: "recipients_changed",
      status: 409,
    });
  });

  it("builds campaign list and detail URLs", async () => {
    const fetchMock = okFetch({ results: [] });
    await facilityGroupsApi.campaigns({ page: 2, status: "partial" });
    await facilityGroupsApi.campaign(9, { status: "failed" });
    await facilityGroupsApi.list({ kind: "equipment", q: " sem ", include_archived: true });
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      "/api/v1/admin/facility-groups/email/campaigns/?page=2&status=partial",
      "/api/v1/admin/facility-groups/email/campaigns/9/?status=failed",
      "/api/v1/admin/facility-groups/?kind=equipment&q=sem&include_archived=true",
    ]);
  });
});
