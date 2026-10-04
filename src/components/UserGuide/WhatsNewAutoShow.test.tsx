// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { buildGuide, GUIDE_AUDIENCE_LABELS, type GuideAudienceId } from "@/guides";
import { UserGuideProvider, useUserGuide } from "./UserGuideProvider";
import { clearUserGuideAutoShownThisLogin } from "./userGuideSession";

type TestUser = { id: number; email: string; name: string; user_type: string; is_faculty?: boolean; user_guide_viewed?: boolean; user_type_alias?: string };

const env = vi.hoisted(() => ({
  auth: { user: null as unknown, isAuthenticated: false, loading: false },
  staffShell: false,
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => env.auth }));
vi.mock("@/components/UserGuide/guideFlags", () => ({ loadGuideFlags: vi.fn(async () => ({})) }));
vi.mock("@/contexts/EmbeddedModeContext", () => ({ useEmbeddedMode: () => true }));
vi.mock("@/hooks/use-peak-window", () => ({ usePeakWindow: () => ({ externalPaused: false }) }));
vi.mock("@/lib/staffApp", () => ({ useStaffAppShell: () => env.staffShell }));

beforeAll(() => {
  Element.prototype.scrollTo = function scrollTo() {} as typeof Element.prototype.scrollTo;
  Element.prototype.scrollIntoView = function scrollIntoView() {};
});

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  env.staffShell = false;
});

afterEach(() => {
  cleanup();
  env.auth = { user: null, isAuthenticated: false, loading: false };
});

function Probe() {
  const { openWhatsNew, postLoginBusy } = useUserGuide();
  const { pathname } = useLocation();
  return (
    <>
      <button type="button" onClick={openWhatsNew}>
        Reopen what's new
      </button>
      <span data-testid="busy">{String(postLoginBusy)}</span>
      <span data-testid="where">{pathname}</span>
    </>
  );
}

const renderAt = (path: string) => {
  const tree = () => (
    <MemoryRouter initialEntries={[path]}>
      <UserGuideProvider>
        <Probe />
      </UserGuideProvider>
    </MemoryRouter>
  );
  const utils = render(tree());
  return { ...utils, update: () => utils.rerender(tree()) };
};

const signIn = (user: TestUser) => {
  env.auth = { user, isAuthenticated: true, loading: false };
};

const account = (id: number, user_type: string, extra: Partial<TestUser> = {}): TestUser => ({
  id,
  email: `u${id}@iitr.ac.in`,
  name: `User ${id}`,
  user_type,
  // The legacy server flag must not hide What's New any more.
  user_guide_viewed: true,
  ...extra,
});

const whatsNew = () => screen.findByTestId("whats-new-dialog", {}, { timeout: 4000 });
const waitPastAutoShow = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 1300));
  });

const ROLES: Array<[string, TestUser, GuideAudienceId]> = [
  ["student", account(11, "student"), "student"],
  ["external user", account(12, "industry"), "external"],
  ["IITR startup", account(13, "startup_incubated_iitr"), "startup"],
  ["post-doc / RA", account(14, "individual_student", { user_type_alias: "Research Associate" }), "project_staff"],
  ["IITR faculty", account(15, "faculty", { is_faculty: true }), "faculty"],
  ["Accounts In-charge", account(16, "finance"), "finance"],
  ["Lab Operator", account(17, "operator"), "operator"],
  ["OIC / temporary OIC", account(18, "manager"), "oic"],
  ["Department Admin", account(19, "dept_admin"), "dept_admin"],
  ["Main Admin", account(20, "admin"), "admin"],
];

describe("What's New after sign-in", () => {
  it.each(ROLES)("opens with their own items for: %s", async (_label, user, audience) => {
    signIn(user);
    renderAt("/dashboard");
    const dialog = await whatsNew();
    expect(within(dialog).getByRole("heading", { name: "What's new for you" })).toBeTruthy();
    expect(dialog.textContent).toContain(GUIDE_AUDIENCE_LABELS[audience]);
    const first = buildGuide({ audience }).whatsNew.items[0];
    expect(dialog.textContent).toContain(first.title);
    expect(within(dialog).getByRole("button", { name: /Open user guide/ })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Got it" })).toBeTruthy();
  });

  it("opens once per sign-in and again after the next sign-in", async () => {
    const user = account(30, "student");
    signIn(user);
    const view = renderAt("/dashboard");
    fireEvent.click(within(await whatsNew()).getByRole("button", { name: "Got it" }));
    await waitFor(() => expect(screen.queryByTestId("whats-new-dialog")).toBeNull());

    view.update();
    await waitPastAutoShow();
    expect(screen.queryByTestId("whats-new-dialog")).toBeNull();

    env.auth = { user: null, isAuthenticated: false, loading: false };
    clearUserGuideAutoShownThisLogin(user.id);
    view.update();
    signIn(user);
    view.update();
    expect(await whatsNew()).toBeTruthy();
  });

  it("waits for the dashboard and stays out of the staff Android app", async () => {
    signIn(account(31, "manager"));
    renderAt("/profile");
    await waitPastAutoShow();
    expect(screen.queryByTestId("whats-new-dialog")).toBeNull();
    cleanup();

    env.staffShell = true;
    renderAt("/dashboard");
    await waitPastAutoShow();
    expect(screen.queryByTestId("whats-new-dialog")).toBeNull();
    expect(screen.getByTestId("busy").textContent).toBe("false");
  });

  it("holds other post-login prompts until What's New is closed", async () => {
    signIn(account(32, "admin"));
    renderAt("/dashboard");
    expect(screen.getByTestId("busy").textContent).toBe("true");
    const dialog = await whatsNew();
    expect(screen.getByTestId("busy").textContent).toBe("true");
    fireEvent.click(within(dialog).getByRole("button", { name: "Got it" }));
    await waitFor(() => expect(screen.getByTestId("busy").textContent).toBe("false"));
  });

  it("hands over to the user guide at its first chapter instead of stacking a second popup", async () => {
    signIn(account(33, "manager"));
    renderAt("/dashboard");
    fireEvent.click(within(await whatsNew()).getByRole("button", { name: /Open user guide/ }));
    await waitFor(() => expect(screen.queryByTestId("whats-new-dialog")).toBeNull());
    const first = buildGuide({ audience: "oic" }).sections[0];
    expect(await screen.findByRole("heading", { name: first.title }, { timeout: 3000 })).toBeTruthy();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("marks only items not seen before as unread", async () => {
    signIn(account(34, "student"));
    renderAt("/dashboard");
    let dialog = await whatsNew();
    const total = buildGuide({ audience: "student" }).whatsNew.items.length;
    expect(dialog.querySelectorAll("[data-unread]")).toHaveLength(total);
    fireEvent.click(within(dialog).getByRole("button", { name: "Got it" }));
    await waitFor(() => expect(screen.queryByTestId("whats-new-dialog")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Reopen what's new" }));
    dialog = await whatsNew();
    expect(dialog.querySelectorAll("[data-unread]")).toHaveLength(0);
    expect(screen.getByTestId("whats-new-unread-summary").textContent).toMatch(/up to date/);
    fireEvent.click(within(dialog).getByRole("button", { name: "Got it" }));
    await waitFor(() => expect(screen.queryByTestId("whats-new-dialog")).toBeNull());

    const seen: string[] = JSON.parse(localStorage.getItem("iic_whats_new_seen_34") || "[]");
    localStorage.setItem("iic_whats_new_seen_34", JSON.stringify(seen.filter((id) => id !== "quota-countdown")));
    fireEvent.click(screen.getByRole("button", { name: "Reopen what's new" }));
    dialog = await whatsNew();
    expect(dialog.querySelectorAll("[data-unread]")).toHaveLength(1);
    expect(screen.getByTestId("whats-new-unread-summary").textContent).toMatch(/^1 change since your last visit/);
  });

  it("Try it opens the page and closes What's New", async () => {
    signIn(account(35, "student"));
    renderAt("/dashboard");
    fireEvent.click(within(await whatsNew()).getByRole("button", { name: "Try it: Quota left and what used it" }));
    await waitFor(() => expect(screen.queryByTestId("whats-new-dialog")).toBeNull());
    expect(screen.getByTestId("where").textContent).toBe("/equipments");
  });
});
