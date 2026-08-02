import { Navigate, useSearchParams } from "react-router-dom";
import { setPostLoginRedirect } from "@/lib/authRedirect";

/**
 * Alias for `/login`, which backend redirects point at when an unauthenticated
 * user requests an HTML page. Forwards to the real login page at `/auth`,
 * carrying over the `next` target when it resolves to an in-app path.
 */
const LoginRedirect = () => {
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next");

  if (next) {
    if (next.startsWith("/") && !next.startsWith("//")) {
      setPostLoginRedirect(next);
    } else {
      try {
        const target = new URL(next, window.location.origin);
        if (target.origin === window.location.origin) {
          setPostLoginRedirect(`${target.pathname}${target.search}${target.hash}`);
        }
      } catch {
        // Unparseable next value: fall through to the default post-login landing.
      }
    }
  }

  return <Navigate to="/auth" replace />;
};

export default LoginRedirect;
