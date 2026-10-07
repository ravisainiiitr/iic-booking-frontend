// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const state = vi.hoisted(() => ({
  blocking: true,
  auth: {
    user: { id: 31, email: "u31@iitr.ac.in", name: "Asha", user_type: "student", user_guide_viewed: true },
    isAuthenticated: true,
    loading: false,
  },
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => state.auth }));
vi.mock("@/components/ProfileCompletion/ProfileCompletionProvider", () => ({
  useProfileCompletion: () => ({ blocking: state.blocking }),
}));
vi.mock("@/components/UserGuide/guideFlags", () => ({ loadGuideFlags: vi.fn(async () => ({})) }));
vi.mock("@/contexts/EmbeddedModeContext", () => ({ useEmbeddedMode: () => true }));
vi.mock("@/hooks/use-peak-window", () => ({ usePeakWindow: () => ({ externalPaused: false }) }));
vi.mock("@/lib/staffApp", () => ({ useStaffAppShell: () => false }));

import { UserGuideProvider, useUserGuide } from "./UserGuideProvider";

beforeAll(() => {
  Element.prototype.scrollTo = function scrollTo() {} as typeof Element.prototype.scrollTo;
  Element.prototype.scrollIntoView = function scrollIntoView() {};
});

function Busy() {
  const { postLoginBusy } = useUserGuide();
  return <span data-testid="busy">{String(postLoginBusy)}</span>;
}

const ui = () => (
  <MemoryRouter initialEntries={["/dashboard"]}>
    <UserGuideProvider>
      <Busy />
    </UserGuideProvider>
  </MemoryRouter>
);

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});
afterEach(() => cleanup());

describe("post-login order", () => {
  it("holds back later prompts until the Complete your profile prompt closes, without opening What's New", async () => {
    state.blocking = true;
    const view = render(ui());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1500));
    });
    expect(screen.queryByTestId("whats-new-dialog")).toBeNull();
    expect(screen.getByTestId("busy").textContent).toBe("true");

    state.blocking = false;
    view.rerender(ui());
    await waitFor(() => expect(screen.getByTestId("busy").textContent).toBe("false"));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 1300));
    });
    expect(screen.queryByTestId("whats-new-dialog")).toBeNull();
  });
});
