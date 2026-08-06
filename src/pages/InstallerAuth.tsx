import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiClient } from "@/lib/api";
import { setPostLoginRedirect } from "@/lib/authRedirect";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

/**
 * Installer loopback handoff (Phase R.2.3).
 * Opens from DSA installer → after Portal/Channel-i login, redirects token to 127.0.0.1.
 * Token is never logged; only returned to the local installer listener.
 */
function isLoopbackReturn(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:") return false;
    if (u.hostname !== "127.0.0.1" && u.hostname !== "localhost") return false;
    const port = Number(u.port || "80");
    return port > 0 && port < 65536;
  } catch {
    return false;
  }
}

export default function InstallerAuthPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Preparing installer handoff…");

  useEffect(() => {
    const returnTo = (params.get("return_to") || "").trim();
    if (!returnTo || !isLoopbackReturn(returnTo)) {
      setError("Invalid installer return URL. Expected http://127.0.0.1:<port>/");
      return;
    }

    if (!isAuthenticated || !apiClient.getToken()) {
      setStatus("Redirecting to sign in…");
      const here = `/device-provisioning/installer-auth?return_to=${encodeURIComponent(returnTo)}`;
      setPostLoginRedirect(here);
      navigate("/auth", { replace: true });
      return;
    }

    const token = apiClient.getToken();
    if (!token) {
      setError("No portal token available after login.");
      return;
    }

    const deptId = user?.department;
    const departmentId = typeof deptId === "number" ? deptId : "";

    setStatus("Returning credentials to the installer…");
    const target = new URL(returnTo.endsWith("/") ? returnTo : `${returnTo}/`);
    target.searchParams.set("token", token);
    if (departmentId !== "") {
      target.searchParams.set("department_id", String(departmentId));
    }
    // Full navigation to loopback — installer HttpListener receives GET.
    window.location.replace(target.toString());
  }, [isAuthenticated, navigate, params, user]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
      {error ? (
        <p className="max-w-md text-sm text-destructive">{error}</p>
      ) : (
        <>
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{status}</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            You can close this tab after the installer continues. Bootstrap secrets are never shown here.
          </p>
        </>
      )}
    </div>
  );
}
