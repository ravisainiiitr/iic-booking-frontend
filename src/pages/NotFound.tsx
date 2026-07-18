import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FlaskConical, Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="page-shell flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center rounded-2xl border border-border/70 bg-card p-8 shadow-[var(--shadow-elegant)]">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-700/10 text-teal-800 dark:text-teal-300">
          <FlaskConical className="h-7 w-7" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-400">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-muted-foreground text-sm">
          The page <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{location.pathname}</code> does not exist
          or you may not have access.
        </p>
        <Button asChild className="mt-6 bg-teal-700 hover:bg-teal-800">
          <Link to="/">
            <Home className="h-4 w-4 mr-2" />
            Return to Home
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
