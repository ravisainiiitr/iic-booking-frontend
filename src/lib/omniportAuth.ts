/** Persist OAuth state for the frontend callback security check. */
export function storeOmniportState(authUrl: string, state?: string | null): void {
  const resolved =
    state?.trim() ||
    (() => {
      try {
        return new URL(authUrl).searchParams.get("state");
      } catch {
        return null;
      }
    })();
  if (resolved) {
    localStorage.setItem("omniport_state", resolved);
  }
}

const OMNIPORT_ERROR_MESSAGES: Record<string, string> = {
  token_endpoint_timeout:
    "The server could not reach Channel i in time. Ask the administrator to verify outbound HTTPS access to channeli.in.",
  token_endpoint_unreachable:
    "The server cannot reach Channel i. Outbound network or firewall rules on the production host may be blocking channeli.in.",
  token_endpoint_error:
    "The server failed to contact Channel i during login. Please try again or contact support.",
  token_exchange_failed:
    "Channel i rejected the login code. Please start login again from the sign-in page.",
  user_creation_failed:
    "Channel i login succeeded but your account could not be created. Contact support with your institute email.",
  userinfo_fetch_failed:
    "Channel i login succeeded but user profile could not be loaded. Please try again.",
};

export function formatOmniportCallbackError(
  message: string,
  errorCode?: string | null,
): string {
  if (errorCode && OMNIPORT_ERROR_MESSAGES[errorCode]) {
    return OMNIPORT_ERROR_MESSAGES[errorCode];
  }
  return message;
}
