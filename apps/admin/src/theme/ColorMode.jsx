import React, { createContext, useContext, useMemo, useState } from "react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { getTheme } from "./theme";

const STORAGE_KEY = "admin_color_mode";
const ColorModeContext = createContext({ mode: "light", toggle: () => {} });

const initialMode = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Storage unavailable (private mode): fall back to the system setting.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

/** Light/dark theme for the whole portal, remembered per browser. */
export const ColorModeProvider = ({ children }) => {
  const [mode, setMode] = useState(initialMode);
  const value = useMemo(
    () => ({
      mode,
      toggle: () =>
        setMode((current) => {
          const next = current === "dark" ? "light" : "dark";
          try {
            localStorage.setItem(STORAGE_KEY, next);
          } catch {
            // Not persisted; the choice still applies until the page is closed.
          }
          return next;
        }),
    }),
    [mode]
  );
  const theme = useMemo(() => getTheme(mode), [mode]);
  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useColorMode = () => useContext(ColorModeContext);
