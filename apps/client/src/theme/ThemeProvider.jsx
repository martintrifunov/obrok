import { useMemo } from "react";
import { ThemeProvider as MUIThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { getAppTheme } from "@/theme/theme.js";
import { useThemeStore } from "@/store/themeStore";

export const ThemeProvider = ({ children }) => {
  const mode = useThemeStore((state) => state.mode);
  const theme = useMemo(() => getAppTheme(mode), [mode]);

  return (
    <MUIThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MUIThemeProvider>
  );
};
