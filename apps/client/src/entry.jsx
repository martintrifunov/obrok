import ReactDOM from "react-dom/client";
import App from "@/components/layout/App.jsx";
import ConsentGate from "@/components/layout/ConsentGate.jsx";
import "@/assets/index.css";
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/theme/ThemeProvider.jsx";
import { queryClient } from "@/api/queryClient";

ReactDOM.createRoot(document.getElementById("root")).render(
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <ConsentGate>
        <BrowserRouter>
          <Routes>
            <Route path="/*" element={<App />} />
          </Routes>
        </BrowserRouter>
      </ConsentGate>
    </ThemeProvider>
  </QueryClientProvider>,
);
