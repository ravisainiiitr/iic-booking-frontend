// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const state = vi.hoisted(() => ({
  native: true,
  auth: {
    user: { id: 5, user_type: "operator", name: "Asha Rao" } as Record<string, unknown> | null,
    isAuthenticated: true,
    loading: false,
    setUserFromAuth: vi.fn(),
    logout: vi.fn(async () => undefined),
  },
  api: {
    getStaffAppToday: vi.fn(),
    getMobileAppLatest: vi.fn(),
    createMobileAppDownloadTicket: vi.fn(),
    requestLoginOtp: vi.fn(),
    verifyLoginOtp: vi.fn(),
    signIn: vi.fn(),
    getOmniportAuthUrl: vi.fn(),
    getToken: vi.fn(() => "iicm_x"),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => state.auth }));
vi.mock("@/lib/api", () => ({ API_BASE_URL: "/api", apiClient: state.api }));
vi.mock("@/lib/nativeApp", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/nativeApp")>()),
  isNativeApp: () => state.native,
  getNativeAppInfo: vi.fn(async () => null),
}));
vi.mock("./StaffWeekCalendar", () => ({ default: () => <div>week calendar</div> }));

import { isStaffAppNavPath, isStaffAppUserType } from "@/lib/staffApp";
import StaffToday from "./StaffToday";
import AppSignIn from "./AppSignIn";
import AndroidAppCard from "@/components/staff-app/AndroidAppCard";

function Where() {
  const loc = useLocation();
  return <div data-testid="where">{loc.pathname + loc.search}</div>;
}

function renderAt(path: string, element: JSX.Element, routePath = path.split("?")[0]) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={routePath} element={element} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

const today = {
  role: "operator",
  today: "2026-10-03",
  tomorrow: "2026-10-04",
  generated_at: "2026-10-03T04:00:00Z",
  equipment: [{ equipment_id: 1, code: "XRD", name: "X-ray", status: "ACTIVE", status_display: "Operational" }],
  days: [
    {
      date: "2026-10-03",
      label: "Today",
      bookings: [
        {
          booking_id: 77,
          booking_ref: "XRD-0077",
          equipment_id: 1,
          equipment_code: "XRD",
          equipment_name: "X-ray",
          user_name: "Test Student",
          is_test: true,
          status: "BOOKED",
          status_display: "Booked",
          start_time: "2026-10-03T04:30:00Z",
          end_time: "2026-10-03T05:30:00Z",
          sample_stage: "FORWARDED_TO_LAB",
          sample_stage_display: "Forwarded to Lab",
        },
      ],
    },
    { date: "2026-10-04", label: "Tomorrow", bookings: [] },
  ],
  counts: {
    samples_awaiting_receipt: 1,
    user_messages_awaiting_reply: 2,
    urgent_requests_pending: null,
    waitlist_active: null,
    tickets_assigned_open: 0,
  },
  message_booking_ids: [91, 92],
};

beforeEach(() => {
  state.native = true;
  state.auth.user = { id: 5, user_type: "operator", name: "Asha Rao" };
  state.auth.isAuthenticated = true;
  Object.values(state.api).forEach((fn) => fn.mockReset());
  state.api.getToken.mockReturnValue("iicm_x");
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(cleanup);

describe("staff app helpers", () => {
  it("covers Officers In Charge and Lab Operators only", () => {
    expect(isStaffAppUserType("manager")).toBe(true);
    expect(isStaffAppUserType("OPERATOR")).toBe(true);
    expect(isStaffAppUserType("admin")).toBe(false);
    expect(isStaffAppUserType("faculty")).toBe(false);
  });

  it("shows the bottom navigation on the four tabs", () => {
    expect(isStaffAppNavPath("/app")).toBe(true);
    expect(isStaffAppNavPath("/app/calendar/")).toBe(true);
    expect(isStaffAppNavPath("/booking-management")).toBe(true);
    expect(isStaffAppNavPath("/app/sign-in")).toBe(false);
    expect(isStaffAppNavPath("/tickets")).toBe(false);
  });
});

describe("Today", () => {
  it("lists today's bookings in institute time and opens the job sheet", async () => {
    state.api.getStaffAppToday.mockResolvedValue({ data: today });
    renderAt("/app", <StaffToday />);
    const row = await screen.findByRole("link", { name: /Test Student/ });
    expect(row.getAttribute("href")).toBe("/booking-management?expand=77");
    expect(row.textContent).toContain("10:00");
    expect(row.textContent).toContain("11:00");
    expect(row.textContent).toContain("Forwarded to Lab");
    expect(screen.getByText("No bookings tomorrow on your instruments.")).toBeTruthy();
  });

  it("shows operator counts without OIC-only tiles and links messages to the first booking", async () => {
    state.api.getStaffAppToday.mockResolvedValue({ data: today });
    renderAt("/app", <StaffToday />);
    const messages = await screen.findByRole("link", { name: /Messages to answer/ });
    expect(messages.getAttribute("href")).toBe("/booking-management?expand=91");
    expect(screen.queryByText("Urgent requests")).toBeNull();
    expect(screen.queryByText("Waitlist")).toBeNull();
  });

  it("shows the results overdue count and opens the overdue list (or the only overdue job sheet)", async () => {
    state.api.getStaffAppToday.mockResolvedValue({
      data: { ...today, counts: { ...today.counts, results_overdue: 3 }, results_overdue_booking_ids: [40, 41, 42] },
    });
    renderAt("/app", <StaffToday />);
    const tile = await screen.findByRole("link", { name: /Results overdue/ });
    expect(tile.getAttribute("href")).toBe("/booking-management?results=overdue");
    expect(tile.textContent).toContain("3");
    cleanup();

    state.api.getStaffAppToday.mockResolvedValue({
      data: { ...today, counts: { ...today.counts, results_overdue: 1 }, results_overdue_booking_ids: [40] },
    });
    renderAt("/app", <StaffToday />);
    expect((await screen.findByRole("link", { name: /Results overdue/ })).getAttribute("href")).toBe(
      "/booking-management?expand=40",
    );
  });

  it("hides the results overdue tile for an older server that does not report it", async () => {
    state.api.getStaffAppToday.mockResolvedValue({ data: today });
    renderAt("/app", <StaffToday />);
    await screen.findByRole("link", { name: /Messages to answer/ });
    expect(screen.queryByText("Results overdue")).toBeNull();
  });

  it("refreshes on request", async () => {
    state.api.getStaffAppToday.mockResolvedValue({ data: today });
    renderAt("/app", <StaffToday />);
    await screen.findByRole("link", { name: /Test Student/ });
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(state.api.getStaffAppToday).toHaveBeenLastCalledWith({ refresh: true }));
  });
});

describe("App sign-in", () => {
  beforeEach(() => {
    state.auth.user = null;
    state.auth.isAuthenticated = false;
  });

  it("sends an OTP and asks for the code", async () => {
    state.api.requestLoginOtp.mockResolvedValue({ data: { message: "OTP sent." } });
    renderAt("/app/sign-in", <AppSignIn />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "Op@IITR.ac.in " } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in with OTP" }));
    expect(await screen.findByText("OTP sent.")).toBeTruthy();
    expect(state.api.requestLoginOtp).toHaveBeenCalledWith("op@iitr.ac.in");
    expect(screen.getByLabelText(/6-digit code sent to op@iitr.ac.in/)).toBeTruthy();
  });

  it("goes to quick-unlock setup after a correct code", async () => {
    state.api.requestLoginOtp.mockResolvedValue({ data: { message: "OTP sent." } });
    state.api.verifyLoginOtp.mockResolvedValue({ data: { token: "web", user: { id: 5, user_type: "operator" } } });
    renderAt("/app/sign-in", <AppSignIn />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "op@iitr.ac.in" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in with OTP" }));
    fireEvent.change(await screen.findByLabelText(/6-digit code/), { target: { value: "12 34 56" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and sign in" }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/app/setup-lock"));
    expect(state.api.verifyLoginOtp).toHaveBeenCalledWith("op@iitr.ac.in", "123456");
  });

  it("shows the not-available screen for roles outside the app audience", async () => {
    state.api.requestLoginOtp.mockResolvedValue({ error: "The IIC Booking app is currently available…", errorCode: "APP_AUDIENCE", status: 403 });
    renderAt("/app/sign-in", <AppSignIn />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "student@iitr.ac.in" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in with OTP" }));
    await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/app/not-available"));
  });

  it("keeps password and Channel i as secondary options", async () => {
    state.api.signIn.mockResolvedValue({ error: "Invalid credentials" });
    renderAt("/app/sign-in", <AppSignIn />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in with password" }));
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "op@iitr.ac.in" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Sign in with Channel i/i })).toBeTruthy();
  });
});

describe("Get the Android app card", () => {
  const release = {
    id: "r1",
    platform: "android",
    version_name: "1.0.0",
    version_code: 1,
    release_date: "2026-10-03",
    release_notes: "",
    min_android: "Android 7.0 or newer",
    file_name: "IIC-Booking-1.0.0.apk",
    size_bytes: 5 * 1024 * 1024,
    sha256: "ab".repeat(32),
    signing_cert_sha256: "",
    has_file: true,
    is_latest: true,
  };

  it("is hidden inside the app", () => {
    renderAt("/dashboard", <AndroidAppCard />);
    expect(state.api.getMobileAppLatest).not.toHaveBeenCalled();
  });

  it("shows version, size and checksum on the website and can be dismissed", async () => {
    state.native = false;
    state.api.getMobileAppLatest.mockResolvedValue({ data: { release } });
    renderAt("/dashboard", <AndroidAppCard />);
    expect(await screen.findByText("Get the Android app")).toBeTruthy();
    expect(screen.getByText(/Version 1.0.0 · 5.0 MB/)).toBeTruthy();
    expect(screen.getByText(`SHA-256 ${release.sha256}`)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hide the Android app card" }));
    expect(screen.queryByText("Get the Android app")).toBeNull();
    cleanup();
    renderAt("/dashboard", <AndroidAppCard />);
    await waitFor(() => expect(state.api.getMobileAppLatest).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("Get the Android app")).toBeNull();
  });

  it("is not shown to other roles", () => {
    state.native = false;
    state.auth.user = { id: 9, user_type: "faculty" };
    renderAt("/dashboard", <AndroidAppCard />);
    expect(state.api.getMobileAppLatest).not.toHaveBeenCalled();
  });
});
