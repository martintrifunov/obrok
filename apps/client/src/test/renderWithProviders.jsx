import { render } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material";
import { MemoryRouter } from "react-router-dom";

const theme = createTheme();

export const renderWithProviders = (ui) =>
  render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>{ui}</ThemeProvider>
    </MemoryRouter>,
  );
