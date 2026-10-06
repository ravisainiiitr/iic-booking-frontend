import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  children: ReactNode;
  fallbackTitle?: string;
  backPath?: string;
  /** When this value changes, a caught error is cleared (e.g. pass the pathname). */
  resetKey?: unknown;
};

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

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: undefined });
    }
  }

  render() {
    if (this.state.hasError) {
      const backPath = this.props.backPath ?? "/dashboard";
      const err = this.state.error;
      return (
        <div
          style={{
            minHeight: "var(--viewport-min-h, 100vh)",
            padding: "2rem",
            backgroundColor: "hsl(var(--background, 210 40% 98%))",
            color: "hsl(var(--foreground, 222 47% 11%))",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
            {this.props.fallbackTitle ?? "Something went wrong"}
          </h1>
          <p style={{ marginBottom: "1rem", color: "hsl(var(--muted-foreground, 215 16% 47%))" }}>
            This page could not be displayed. Go back and try again.
          </p>
          {err && (
            <pre style={{ fontSize: "0.75rem", padding: "1rem", background: "hsl(var(--muted, 210 40% 96%))", borderRadius: "6px", overflow: "auto", marginBottom: "1rem", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
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
