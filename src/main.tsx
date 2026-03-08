import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const rootEl = document.getElementById("root");
if (!rootEl) {
  document.body.innerHTML = "<h1>Root element #root not found</h1>";
} else {
  createRoot(rootEl).render(
    <ErrorBoundary fallbackTitle="App Error" backPath="/">
      <App />
    </ErrorBoundary>
  );
}
