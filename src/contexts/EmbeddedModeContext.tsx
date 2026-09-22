import { createContext, useContext } from "react";

/** When true, pages should omit DashboardHeader / full-page chrome (shown inside Dashboard workspace). */
export const EmbeddedModeContext = createContext(false);

export function useEmbeddedMode(): boolean {
  return useContext(EmbeddedModeContext);
}
