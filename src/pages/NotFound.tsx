import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FlaskConical, Home, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const NotFound = () => {
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="page-shell flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center rounded-2xl border border-border/70 bg-card p-8 shadow-[var(--shadow-elegant)]">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary dark:text-sky-200">
          <FlaskConical className="h-7 w-7" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-wider text-primary dark:text-sky-300">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-muted-foreground text-sm">
          The page <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{location.pathname}</code> does not exist
          or you may not have access.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          {isAuthenticated ? (
            <Button asChild className="bg-primary hover:bg-primary/90">
              <Link to="/dashboard">
                <LayoutDashboard className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
          ) : null}
          <Button asChild variant={isAuthenticated ? "outline" : "default"} className={!isAuthenticated ? "bg-primary hover:bg-primary/90" : undefined}>
            <Link to="/">
              <Home className="h-4 w-4 mr-2" />
              Return to Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
