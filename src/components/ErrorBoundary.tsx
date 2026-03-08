import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Props = { children: ReactNode; fallbackTitle?: string; backPath?: string };

type State = { hasError: boolean; error?: Error };

/**
 * Catches render errors in children and shows a fallback UI.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const backPath = this.props.backPath ?? "/dashboard";
      const err = this.state.error;
      return (
        <div
          style={{
            minHeight: "100vh",
            padding: "2rem",
            backgroundColor: "#f8fafc",
            color: "#0f172a",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
            {this.props.fallbackTitle ?? "Something went wrong"}
          </h1>
          <p style={{ marginBottom: "1rem", color: "#64748b" }}>
            This page could not be displayed. Go back and try again.
          </p>
          {err && (
            <pre style={{ fontSize: "0.75rem", padding: "1rem", background: "#f1f5f9", borderRadius: "6px", overflow: "auto", marginBottom: "1rem" }}>
              {err.message}
            </pre>
          )}
          <a href={backPath}>
            <Button variant="outline">Back to Dashboard</Button>
          </a>
        </div>
      );
    }
    return this.props.children;
  }
}
