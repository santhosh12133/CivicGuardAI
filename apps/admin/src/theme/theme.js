import { alpha, createTheme } from "@mui/material/styles";

// CivicFix brand: the blue of the app icon, with neutral slate greys.
const BRAND = "#2563eb";

export const getTheme = (mode) => {
  const dark = mode === "dark";
  return createTheme({
    palette: {
      mode,
      primary: { main: BRAND, light: "#60a5fa", dark: "#1d4ed8", contrastText: "#ffffff" },
      secondary: { main: "#0d9488" },
      warning: { main: "#d97706" },
      info: { main: "#0284c7" },
      success: { main: "#16a34a" },
      error: { main: "#dc2626" },
      background: dark
        ? { default: "#0b1120", paper: "#111827" }
        : { default: "#f5f7fb", paper: "#ffffff" },
      divider: dark ? "rgba(148, 163, 184, 0.16)" : "#e5e7eb",
      text: dark
        ? { primary: "#e5e7eb", secondary: "#94a3b8" }
        : { primary: "#0f172a", secondary: "#64748b" },
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: [
        "Inter",
        "system-ui",
        "-apple-system",
        '"Segoe UI"',
        "Roboto",
        '"Helvetica Neue"',
        "Arial",
        "sans-serif",
      ].join(","),
      h4: { fontWeight: 700, letterSpacing: "-0.02em" },
      h5: { fontWeight: 700, letterSpacing: "-0.01em" },
      h6: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
      button: { textTransform: "none", fontWeight: 600 },
    },
    components: {
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: { backgroundImage: "none" },
          outlined: ({ theme }) => ({ borderColor: theme.palette.divider }),
        },
      },
      MuiCard: {
        defaultProps: { variant: "outlined" },
        styleOverrides: { root: { borderRadius: 14 } },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { borderRadius: 8 } },
      },
      MuiChip: {
        styleOverrides: { root: { fontWeight: 600 } },
      },
      MuiTooltip: {
        defaultProps: { arrow: true },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 8,
            "&.Mui-selected": {
              backgroundColor: alpha(theme.palette.primary.main, dark ? 0.22 : 0.1),
              color: dark ? theme.palette.primary.light : theme.palette.primary.dark,
              "& .MuiListItemIcon-root": { color: "inherit" },
              "&:hover": { backgroundColor: alpha(theme.palette.primary.main, dark ? 0.3 : 0.16) },
            },
          }),
        },
      },
    },
  });
};

// Fixed colours for statuses and priorities, used by chips, charts and map markers.
export const STATUS_HEX = { Open: "#d97706", "In Progress": "#0284c7", Resolved: "#16a34a" };
export const PRIORITY_HEX = { low: "#64748b", normal: "#2563eb", high: "#ea580c", urgent: "#dc2626" };
