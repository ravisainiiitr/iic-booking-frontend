// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Suspense, useCallback, useState, type ComponentType } from "react";
import { lazyPage } from "./lazyPage";
import {
  registerOpenWorkspace,
  rememberWorkspaceForReload,
  takeWorkspaceToResume,
  useWorkspaceResume,
} from "./workspaceResume";

const reload = vi.fn();

/** What a stale tab sees after a deploy: the old hashed chunk is gone from the server. */
const chunkGone = () => Promise.reject(new TypeError("Failed to fetch dynamically imported module"));
const myBookingsChunk = () => Promise.resolve({ default: () => <h1>My Bookings page</h1> });

/** The dashboard's panel: menu items open pages in place, the browser URL stays /dashboard. */
function DashboardHarness({ pages }: { pages: Record<string, ComponentType> }) {
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [workspaceTitle, setWorkspaceTitle] = useState("");
  const openWorkspace = useCallback((path: string, title?: string) => {
    setWorkspacePath(path);
    setWorkspaceTitle(title || path);
  }, []);
  useWorkspaceResume({
    workspacePath,
    workspaceCurrentPath: workspacePath?.split(/[?#]/)[0] ?? "",
    workspaceTitle,
    openWorkspace,
  });
  const Page = workspacePath ? pages[workspacePath] : null;
  return (
    <div>
      <button type="button" onClick={() => openWorkspace("/my-bookings", "My bookings")}>
        My bookings
      </button>
      {Page ? (
        <section aria-label={workspaceTitle}>
          <Suspense fallback={<p>Loading page</p>}>
            <Page />
          </Suspense>
        </section>
      ) : (
        <p>Main dashboard</p>
      )}
    </div>
  );
}

/** A real reload re-evaluates every module, so each page load gets fresh lazy components. */
function loadApp(myBookings: () => Promise<{ default: ComponentType }>) {
  return render(<DashboardHarness pages={{ "/my-bookings": lazyPage(myBookings) }} />);
}

beforeEach(() => {
  sessionStorage.clear();
  reload.mockReset();
  vi.stubGlobal("location", { pathname: "/dashboard", search: "", hash: "", reload });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("dashboard panel page after a deploy", () => {
  it("opens the clicked page after the stale-chunk reload instead of the main dashboard", async () => {
    const firstLoad = loadApp(chunkGone);
    fireEvent.click(screen.getByRole("button", { name: "My bookings" }));
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    firstLoad.unmount();

    loadApp(myBookingsChunk);

    expect(await screen.findByRole("heading", { name: "My Bookings page" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "My bookings" })).toBeTruthy();
    expect(screen.queryByText("Main dashboard")).toBeNull();
  });

  it("shows the main dashboard on an ordinary load", () => {
    loadApp(myBookingsChunk);
    expect(screen.getByText("Main dashboard")).toBeTruthy();
  });

  it("does not reopen the page once the dashboard has used the saved entry", async () => {
    const firstLoad = loadApp(chunkGone);
    fireEvent.click(screen.getByRole("button", { name: "My bookings" }));
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    firstLoad.unmount();
    loadApp(myBookingsChunk).unmount();

    loadApp(myBookingsChunk);
    expect(screen.getByText("Main dashboard")).toBeTruthy();
  });
});

describe("workspace resume storage", () => {
  it("saves nothing when no panel page is open", () => {
    rememberWorkspaceForReload();
    expect(takeWorkspaceToResume()).toBeNull();
  });

  it("returns the saved page once", () => {
    const unregister = registerOpenWorkspace({ path: "/wallet?tab=history", title: "Wallet" });
    rememberWorkspaceForReload();
    unregister();
    expect(takeWorkspaceToResume()).toEqual({ path: "/wallet?tab=history", title: "Wallet" });
    expect(takeWorkspaceToResume()).toBeNull();
  });

  it("ignores an entry older than a minute", () => {
    vi.useFakeTimers();
    const unregister = registerOpenWorkspace({ path: "/wallet" });
    rememberWorkspaceForReload();
    unregister();
    vi.advanceTimersByTime(61_000);
    expect(takeWorkspaceToResume()).toBeNull();
  });

  it("never resumes the dashboard itself or an external path", () => {
    for (const path of ["/dashboard", "/dashboard?full=1", "//evil.example"]) {
      const unregister = registerOpenWorkspace({ path });
      rememberWorkspaceForReload();
      unregister();
      expect(takeWorkspaceToResume()).toBeNull();
    }
  });

  it("only clears the registration it made", () => {
    const unregisterOld = registerOpenWorkspace({ path: "/wallet" });
    const unregisterNew = registerOpenWorkspace({ path: "/my-bookings" });
    unregisterOld();
    rememberWorkspaceForReload();
    unregisterNew();
    expect(takeWorkspaceToResume()?.path).toBe("/my-bookings");
  });
});
