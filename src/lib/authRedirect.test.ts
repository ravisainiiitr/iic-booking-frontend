// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { consumePostLoginRedirect, isSafeInAppPath, setPostLoginRedirect } from "./authRedirect";

describe("post-login redirect", () => {
  afterEach(() => sessionStorage.clear());

  it("accepts in-app paths", () => {
    expect(isSafeInAppPath("/dashboard")).toBe(true);
    expect(isSafeInAppPath("/bookings?tab=past#top")).toBe(true);
  });

  it.each(["//evil.example", "/\\evil.example", "/\\/evil.example", "/\tevil", "/a\\b", "https://evil.example", "", null])(
    "refuses %j, which a browser could read as another site",
    (path) => {
      expect(isSafeInAppPath(path)).toBe(false);
    },
  );

  it("never stores or returns another site", () => {
    setPostLoginRedirect("/\\evil.example");
    expect(consumePostLoginRedirect()).toBe("/dashboard");
    sessionStorage.setItem("postLoginRedirect", "/\\evil.example"); // planted directly
    expect(consumePostLoginRedirect()).toBe("/dashboard");
    setPostLoginRedirect("/wallet");
    expect(consumePostLoginRedirect()).toBe("/wallet");
  });
});
