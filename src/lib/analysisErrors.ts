/**
 * Plain-language Remote Analysis errors: what happened, and what to do next.
 *
 * Server messages and codes are mapped to a short title, a sentence the user can act on, and the action the
 * page should offer. Unknown messages keep their own text, without the internal "[category]" prefix.
 */

export type AnalysisErrorAction = "retry" | "reconnect" | "request_again" | "contact_lab" | "wait" | "none";

export type FriendlyAnalysisError = {
  title: string;
  detail: string;
  action: AnalysisErrorAction;
  /** True when the page should keep trying by itself. */
  transient: boolean;
};

type Rule = { test: RegExp; error: FriendlyAnalysisError };

const RULES: Rule[] = [
  {
    test: /credentials|rdp_credentials_missing|automatic login/i,
    error: {
      title: "The Analysis PC is not set up for remote sign-in",
      detail: "Lab staff need to finish setting up this Analysis PC. Your place is kept. Please tell the Lab Operator.",
      action: "contact_lab",
      transient: false,
    },
  },
  {
    test: /checkin_expired|check-in window expired|hold.*expired/i,
    error: {
      title: "Your hold on the Analysis PC ended",
      detail: "The PC was held for you but the session was not started in time, so it went to the next person. Request analysis again to rejoin the queue.",
      action: "request_again",
      transient: false,
    },
  },
  {
    test: /tunnel|secure link|joining|not ready|try again/i,
    error: {
      title: "Opening a secure link to the Analysis PC",
      detail: "This usually takes under a minute. The page keeps trying by itself.",
      action: "wait",
      transient: true,
    },
  },
  {
    test: /never reported a heartbeat|agent is offline|stale|not reported recently|offline/i,
    error: {
      title: "The Analysis PC is not connected to the portal",
      detail: "The PC may be restarting or its network is down. Lab staff are alerted; try again in a few minutes or contact the Lab Operator.",
      action: "retry",
      transient: false,
    },
  },
  {
    test: /preparation timeout|prepare_timeout|preparing the analysis pc failed|preparation failed/i,
    error: {
      title: "The Analysis PC did not get ready in time",
      detail: "Nothing was lost. Try again; if it happens twice, contact the Lab Operator.",
      action: "retry",
      transient: false,
    },
  },
  {
    test: /analysis_ended|session is over|analysis window has ended/i,
    error: {
      title: "Remote analysis for this booking is over",
      detail: "You can download your results from the booking details page.",
      action: "none",
      transient: false,
    },
  },
  {
    test: /raw_not_ready|raw files are not available/i,
    error: {
      title: "Your data is still being copied",
      detail: "The instrument data for this booking has not finished uploading. Try again in a few minutes.",
      action: "retry",
      transient: false,
    },
  },
  {
    test: /queue_blocked|someone is waiting|another analysis request is currently waiting/i,
    error: {
      title: "Someone is waiting for this Analysis PC",
      detail: "The session cannot be extended. Save your work before the time runs out.",
      action: "none",
      transient: false,
    },
  },
  {
    test: /forbidden|permission denied|only the booking owner/i,
    error: {
      title: "This session belongs to another account",
      detail: "Sign in as the person who made the booking.",
      action: "none",
      transient: false,
    },
  },
  {
    test: /network|failed to fetch|load failed|timeout|ERR_/i,
    error: {
      title: "Connection to the portal was interrupted",
      detail: "Check your internet connection. The page reconnects automatically when it is back.",
      action: "reconnect",
      transient: true,
    },
  },
];

export function stripCategory(message: string): string {
  return message.replace(/^\s*\[[a-z_ -]+\]\s*/i, "").trim();
}

export function friendlyAnalysisError(message: string | null | undefined, code?: string | null): FriendlyAnalysisError | null {
  const raw = stripCategory(String(message || ""));
  const haystack = `${code || ""} ${raw}`.trim();
  if (!haystack) return null;
  const rule = RULES.find((r) => r.test.test(haystack));
  if (rule) return rule.error;
  return { title: "Something went wrong", detail: raw || "Please try again.", action: "retry", transient: false };
}
