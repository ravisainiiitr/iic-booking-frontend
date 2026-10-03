// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { clearLoginTipsThisLogin, type LoginTipUser } from "@/lib/loginTips";
import { LoginTipCard } from "./LoginTipCard";

const student: LoginTipUser = { id: 7, user_type: "student", department_type: "internal" };

function Where() {
  const loc = useLocation();
  return <p data-testid="where">{loc.pathname + loc.hash}</p>;
}

const renderCard = (user: LoginTipUser | null, props: Partial<Parameters<typeof LoginTipCard>[0]> = {}) =>
  render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <main id="main-content" tabIndex={-1}>
        <Routes>
          <Route path="/dashboard" element={<LoginTipCard user={user} {...props} />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </main>
    </MemoryRouter>
  );

beforeEach(() => sessionStorage.clear());
afterEach(cleanup);

describe("LoginTipCard", () => {
  it("shows the sample tip to an IITR student after sign-in", () => {
    renderCard(student);
    const tip = screen.getByRole("status", { name: /Tip of the day: Hand in your sample on time/ });
    expect(tip.textContent).toContain("ask the Lab Operator to mark it as received");
    expect(tip.textContent).toContain("Not Utilized and no refund can be given");
  });

  it.each([
    ["faculty", { id: 2, user_type: "faculty", department_type: "internal" }],
    ["external user", { id: 3, user_type: "external" }],
    ["startup", { id: 4, user_type: "startup_incubated_iitr" }],
    ["Lab Operator", { id: 5, user_type: "operator" }],
    ["Officer In Charge", { id: 6, user_type: "manager" }],
    ["admin", { id: 8, user_type: "admin" }],
  ])("is not shown to a %s", (_label, user) => {
    renderCard(user as LoginTipUser);
    expect(screen.queryByTestId("login-tip")).toBeNull();
  });

  it("Got it hides it for the rest of this sign-in and the next sign-in shows it again", () => {
    renderCard(student);
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByTestId("login-tip")).toBeNull();
    expect(document.activeElement?.id).toBe("main-content");

    cleanup();
    renderCard(student);
    expect(screen.queryByTestId("login-tip")).toBeNull();

    cleanup();
    clearLoginTipsThisLogin();
    renderCard(student);
    expect(screen.getByTestId("login-tip")).not.toBeNull();
  });

  it("the close button also dismisses, per user", () => {
    renderCard(student);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss tip" }));
    expect(screen.queryByTestId("login-tip")).toBeNull();
    cleanup();
    renderCard({ ...student, id: 99 });
    expect(screen.getByTestId("login-tip")).not.toBeNull();
  });

  it("stays on the dashboard until acknowledged", () => {
    renderCard(student);
    cleanup();
    renderCard(student);
    expect(screen.getByTestId("login-tip")).not.toBeNull();
  });

  it("shows the next booking and its sample deadline when known", () => {
    renderCard(student, {
      nextSampleReminder: {
        equipmentName: "X-Ray Diffractometer",
        startTime: "2026-10-06T10:00:00",
        deadlineAt: "2026-10-05T10:00:00",
        leadHours: 24,
      },
    });
    const tip = screen.getByTestId("login-tip");
    expect(tip.textContent).toContain("Your next booking: X-Ray Diffractometer on Tue 6 Oct, 10:00 AM.");
    expect(tip.textContent).toContain("Please hand in your sample by Mon 5 Oct, 10:00 AM (24 hours before your slot).");
  });

  it("Read about samples opens the Samples chapter and counts as seen", () => {
    renderCard(student);
    fireEvent.click(screen.getByRole("button", { name: /Read about samples/ }));
    expect(screen.getByTestId("where").textContent).toContain("/user-guide#guide-samples");
    cleanup();
    renderCard(student);
    expect(screen.queryByTestId("login-tip")).toBeNull();
  });
});
