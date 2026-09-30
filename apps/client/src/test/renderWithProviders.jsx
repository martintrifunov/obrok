import { render } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material";
import { MemoryRouter } from "react-router-dom";

const theme = createTheme();

const Providers = ({ children }) => (
  <MemoryRouter>
    <ThemeProvider theme={theme}>{children}</ThemeProvider>
  </MemoryRouter>
);

// Uses RTL's wrapper option so rerender() keeps the providers and updates the
// same component instance instead of remounting it.
export const renderWithProviders = (ui) => render(ui, { wrapper: Providers });
