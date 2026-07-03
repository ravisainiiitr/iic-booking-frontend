const POST_LOGIN_REDIRECT_KEY = "postLoginRedirect";

/** Store an in-app path to navigate to after successful login. */
export function setPostLoginRedirect(path: string): void {
  if (path.startsWith("/") && !path.startsWith("//")) {
    sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, path);
  }
}

/** Read and clear the stored post-login path, or return fallback. */
export function consumePostLoginRedirect(fallback = "/dashboard"): string {
  const raw = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY);
  sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }
  return fallback;
}
