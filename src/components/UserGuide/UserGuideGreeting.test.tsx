// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { buildGuide } from "@/guides";
import UserGuidePage from "@/pages/UserGuidePage";
import UserGuideDialog from "./UserGuideDialog";
import { UserGuideProvider, useUserGuide } from "./UserGuideProvider";
import { guideToPrintHtml } from "./guideUtils";

type TestUser = {
  id: number;
  email: string;
  name: string;
  display_name?: string | null;
  user_type: string | number;
  is_faculty?: boolean;
  user_guide_viewed?: boolean;
};

const auth = vi.hoisted(() => ({
  state: { user: null as unknown, isAuthenticated: false, loading: false },
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => auth.state }));
vi.mock("@/components/UserGuide/guideFlags", () => ({ loadGuideFlags: vi.fn(async () => ({})) }));
vi.mock("@/contexts/EmbeddedModeContext", () => ({ useEmbeddedMode: () => true }));

const facultyGuide = buildGuide({ audience: "faculty" });
const greetingText = () => screen.getAllByTestId("user-guide-greeting").map((el) => el.textContent);

beforeAll(() => {
  Element.prototype.scrollTo = function scrollTo() {} as typeof Element.prototype.scrollTo;
  Element.prototype.scrollIntoView = function scrollIntoView() {};
});

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  auth.state = { user: null, isAuthenticated: false, loading: false };
});

describe("UserGuideDialog greeting", () => {
  it("shows the greeting on What's New and keeps it on every other section", () => {
    render(<UserGuideDialog open onOpenChange={() => {}} guide={facultyGuide} userName="Prof. Ravi Saini" />);
    expect(greetingText()).toEqual(["Welcome, Prof. Ravi Saini."]);

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByRole("heading", { name: facultyGuide.sections[0].title })).toBeTruthy();
    expect(greetingText()).toEqual(["Welcome, Prof. Ravi Saini."]);

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(greetingText()).toEqual(["Welcome, Prof. Ravi Saini."]);
  });

  it("keeps the greeting on a chapter opened from search results", () => {
    render(<UserGuideDialog open onOpenChange={() => {}} guide={facultyGuide} userName="Prof. Ravi Saini" />);
    const last = facultyGuide.sections[facultyGuide.sections.length - 1];
    fireEvent.change(screen.getByLabelText("Search this guide"), { target: { value: last.title } });
    const nav = screen.getByLabelText("Search this guide").closest("aside") as HTMLElement;
    fireEvent.click(within(nav).getAllByRole("button", { name: new RegExp(last.title, "i") })[0]);
    expect(screen.getByRole("heading", { name: last.title })).toBeTruthy();
    expect(greetingText()).toEqual(["Welcome, Prof. Ravi Saini."]);
  });

  it("shows the greeting while the guide content is still loading", () => {
    render(<UserGuideDialog open onOpenChange={() => {}} guide={null} loading userName="Prof. Ravi Saini" />);
    expect(greetingText()).toEqual(["Welcome, Prof. Ravi Saini."]);
  });

  it("does not repeat the greeting inside the What's New paragraph", () => {
    render(<UserGuideDialog open onOpenChange={() => {}} guide={facultyGuide} userName="Prof. Ravi Saini" />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent?.match(/Welcome, Prof\. Ravi Saini/g)).toHaveLength(1);
  });
});

function OpenGuideButton() {
  const { openGuide } = useUserGuide();
  return (
    <button type="button" onClick={() => openGuide({ force: true })}>
      Open user guide
    </button>
  );
}

const renderProvider = () => {
  const tree = () => (
    <MemoryRouter initialEntries={["/dashboard"]}>
      <UserGuideProvider>
        <OpenGuideButton />
      </UserGuideProvider>
    </MemoryRouter>
  );
  const utils = render(tree());
  return { ...utils, update: () => utils.rerender(tree()) };
};

const faculty = (overrides: Partial<TestUser> = {}): TestUser => ({
  id: 7,
  email: "ravi@iitr.ac.in",
  name: "Ravi Saini",
  display_name: "Prof. Ravi Saini",
  user_type: "faculty",
  is_faculty: true,
  user_guide_viewed: true,
  ...overrides,
});

describe("UserGuideProvider greeting", () => {
  it("updates the greeting to Prof. <name> when the profile arrives after the guide opened", async () => {
    auth.state = { user: faculty({ name: "", display_name: "" }), isAuthenticated: true, loading: false };
    const view = renderProvider();
    fireEvent.click(screen.getByRole("button", { name: "Open user guide" }));
    await waitFor(() => expect(greetingText()).toEqual(["Welcome."]));

    auth.state = { ...auth.state, user: faculty() };
    view.update();
    await waitFor(() => expect(greetingText()).toEqual(["Welcome, Prof. Ravi Saini."]));
  });

  it("waits for the fresh profile before auto-opening, so a stale cached user is never greeted", async () => {
    const cached = faculty({ display_name: null, name: "", user_guide_viewed: false });
    auth.state = { user: cached, isAuthenticated: true, loading: true };
    const view = renderProvider();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1300));
    });
    expect(screen.queryByTestId("user-guide-greeting")).toBeNull();

    auth.state = { user: faculty({ user_guide_viewed: false }), isAuthenticated: true, loading: false };
    view.update();
    await waitFor(() => expect(greetingText()).toEqual(["Welcome, Prof. Ravi Saini."]), { timeout: 4000 });
  });

  it("greets IITR faculty with Prof. even when the cached user's name has no prefix", async () => {
    auth.state = { user: faculty({ display_name: "Ravi Saini" }), isAuthenticated: true, loading: false };
    renderProvider();
    fireEvent.click(screen.getByRole("button", { name: "Open user guide" }));
    await waitFor(() => expect(greetingText()).toEqual(["Welcome, Prof. Ravi Saini."]));
    expect(screen.getByRole("dialog").textContent).toContain("Signed in as Prof. Ravi Saini");
  });

  it("greets other user types by their full name without Prof.", async () => {
    auth.state = {
      user: { id: 9, email: "aman@iitr.ac.in", name: "Aman Kumar", display_name: "Aman Kumar", user_type: "student", user_guide_viewed: true },
      isAuthenticated: true,
      loading: false,
    };
    renderProvider();
    fireEvent.click(screen.getByRole("button", { name: "Open user guide" }));
    await waitFor(() => expect(greetingText()).toEqual(["Welcome, Aman Kumar."]));
    expect(screen.getByRole("dialog").textContent).not.toContain("Prof.");
  });

  it("shows the greeting every time the guide is reopened", async () => {
    auth.state = { user: faculty(), isAuthenticated: true, loading: false };
    renderProvider();
    for (let i = 0; i < 2; i += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Open user guide" }));
      await waitFor(() => expect(greetingText()).toEqual(["Welcome, Prof. Ravi Saini."]));
      fireEvent.click(screen.getByRole("button", { name: /next/i }));
      expect(greetingText()).toEqual(["Welcome, Prof. Ravi Saini."]);
      fireEvent.click(within(screen.getByRole("dialog")).getAllByRole("button", { name: "Close" })[0]);
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    }
  });
});

describe("Full-page guide and Save as PDF", () => {
  it("keeps the greeting at the top of the full page, including search results", async () => {
    auth.state = { user: faculty({ display_name: "Ravi Saini" }), isAuthenticated: true, loading: false };
    render(
      <MemoryRouter initialEntries={["/user-guide"]}>
        <UserGuideProvider>
          <UserGuidePage />
        </UserGuideProvider>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 })).toBeTruthy());
    expect(greetingText()).toEqual(["Welcome, Prof. Ravi Saini."]);

    fireEvent.change(screen.getByLabelText("Search this guide"), { target: { value: "wallet" } });
    expect(greetingText()).toEqual(["Welcome, Prof. Ravi Saini."]);
  });

  it("puts the name in the PDF header", () => {
    const html = guideToPrintHtml(facultyGuide, "Prof. Ravi Saini");
    expect(html).toContain("Prepared for Prof. Ravi Saini");
    expect(guideToPrintHtml(facultyGuide, "")).not.toContain("Prepared for");
    expect(guideToPrintHtml(facultyGuide, "<b>X</b>")).toContain("Prepared for &lt;b&gt;X&lt;/b&gt;");
  });
});
