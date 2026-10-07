import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { RepeatSampleUserCard } from "./RepeatSampleUserCard";

vi.mock("@/lib/api", () => ({
  API_BASE_URL: "/api",
  apiClient: { getProfilePictureUrl: (id: number) => `/api/users/${id}/picture/` },
}));

const source = {
  real_booking_id: 501,
  booking_id: 501,
  virtual_booking_id: "XRD-#501",
  user: 7,
  user_name: "Asha Verma",
  user_email: "asha@example.org",
  user_phone: "+91 98765 43210",
  user_department: "Chemistry",
  user_profile_picture: null,
  wallet_owner_name: "Prof. R. Kumar",
};

const render = (props: Partial<Parameters<typeof RepeatSampleUserCard>[0]> = {}) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <RepeatSampleUserCard loading={false} source={source} onBack={() => {}} {...props} />
    </MemoryRouter>,
  );

describe("RepeatSampleUserCard", () => {
  it("shows the original user's details and links back to the original booking", () => {
    const html = render();
    for (const text of ["Asha Verma", "asha@example.org", "Chemistry", "+91 98765 43210", "Supervisor Name", "Prof. R. Kumar"]) {
      expect(html, text).toContain(text);
    }
    expect(html).toContain("Repeat of booking");
    expect(html).toContain('href="/booking-management?expand=501"');
    expect(html).toContain("XRD-#501");
    expect(html).toContain("Back to booking details");
  });

  it("does not offer a user picker, user type filter or the original booking's cost", () => {
    const html = render();
    for (const hidden of ["Book slots for user", "User type", "Back to Change slot status", "₹", "Total Cost"]) {
      expect(html, hidden).not.toContain(hidden);
    }
  });

  it("shows a loading state until the original booking is loaded", () => {
    expect(render({ loading: true, source: null })).toContain("Loading user details");
  });
});
