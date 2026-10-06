import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { installChunkReloadHandler } from "@/lib/buildUpdate";
import { apiClient } from "@/lib/api";
import { bootstrapNativeApp, isNativeApp } from "@/lib/nativeApp";

installChunkReloadHandler();

// The theme follows the OS (prefers-color-scheme). Drop the preference the former next-themes setup stored.
try {
  localStorage.removeItem("theme");
} catch {
  // Storage can be unavailable (private mode / blocked); nothing to clean up then.
}

const renderApp = () => {
  const rootEl = document.getElementById("root");
  if (!rootEl) {
    document.body.innerHTML = "<h1>Root element #root not found</h1>";
    return;
  }
  createRoot(rootEl).render(
    <ErrorBoundary fallbackTitle="App Error" backPath="/">
      <App />
    </ErrorBoundary>
  );
};

if (isNativeApp()) {
  // Inside the mobile app: restore the remembered sign-in before the first render.
  void bootstrapNativeApp({
    getToken: () => apiClient.getToken(),
    setToken: (token) => apiClient.setToken(token),
  })
    .catch(() => undefined)
    .finally(renderApp);
} else {
  renderApp();
}
