const POST_LOGIN_REDIRECT_KEY = "postLoginRedirect";

/**
 * An in-app path ("/dashboard?tab=x"), never another site. Browsers read "//host" and "/\host" (and tabs or newlines
 * stripped from them) as a link to another site, so a path with a backslash or a control character is refused.
 */
export function isSafeInAppPath(path: string | null | undefined): path is string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return false;
  // eslint-disable-next-line no-control-regex
  return !/[\\\u0000-\u001f\u007f]/.test(path);
}

/** Store an in-app path to navigate to after successful login. */
export function setPostLoginRedirect(path: string): void {
  if (isSafeInAppPath(path)) {
    sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, path);
  }
}

/** Read and clear the stored post-login path, or return fallback. */
export function consumePostLoginRedirect(fallback = "/dashboard"): string {
  const raw = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY);
  sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
  return isSafeInAppPath(raw) ? raw : fallback;
}
