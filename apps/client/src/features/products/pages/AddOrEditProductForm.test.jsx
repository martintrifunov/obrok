import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render } from "@testing-library/react";
import AddOrEditProductForm from "./AddOrEditProductForm";

const mutate = vi.hoisted(() => vi.fn());
const product = vi.hoisted(() => ({ current: null }));

vi.mock("@/features/products/hooks/useProductQueries", () => ({
  useProduct: () => ({ data: product.current, isLoading: false, isError: false }),
  useSaveProduct: () => ({ mutate, isPending: false }),
}));
vi.mock("@/features/markets/hooks/useMarketQueries", () => ({
  useMarketsDropdown: () => ({ data: [] }),
}));
vi.mock("@/features/images/hooks/useImageQueries", () => ({
  useImages: () => ({ data: [], refetch: vi.fn() }),
  useUploadImage: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/components/ui/RichTextEditor", () => ({
  default: () => <div data-testid="rich-text" />,
}));

const vero = { _id: "m-vero", name: "Vero 1", chain: { name: "Vero" } };
const manualA = { _id: "m-a", name: "Pazar", chain: { name: "Local" } };
const manualB = { _id: "m-b", name: "Kiosk", chain: { name: "Local" } };

const renderForm = () =>
  render(
    <MemoryRouter initialEntries={["/dashboard/products/p1"]}>
      <ThemeProvider theme={createTheme()}>
        <Routes>
          <Route path="/dashboard/products/:productId" element={<AddOrEditProductForm />} />
        </Routes>
      </ThemeProvider>
    </MemoryRouter>,
  );

const save = () => fireEvent.click(screen.getByRole("button", { name: /save/i }));
const sentData = () => mutate.mock.calls.at(-1)[0];

beforeEach(() => {
  mutate.mockReset();
  product.current = {
    _id: "p1",
    title: "Млеко 1л",
    category: "Млечни",
    description: "desc",
    marketProducts: [
      { market: vero, price: 65, lastSeenAt: "2026-09-24T03:00:00Z" },
      { market: manualA, price: 70, lastSeenAt: null },
      { market: manualB, price: 80, lastSeenAt: null },
    ],
  };
});

describe("AddOrEditProductForm price editing", () => {
  it("shows scraped prices read-only and hand-added prices as editable", () => {
    renderForm();

    expect(screen.getByText("65 ден")).toBeInTheDocument();
    expect(screen.getByText("Updated by scraper")).toBeInTheDocument();
    expect(screen.queryByLabelText("Price at Vero 1 (Vero)")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Price at Pazar (Local)")).toHaveValue(70);
    expect(screen.getByLabelText("Price at Kiosk (Local)")).toHaveValue(80);
  });

  it("sends changed and removed hand-added prices, not a single price field", async () => {
    renderForm();

    const pazar = screen.getByLabelText("Price at Pazar (Local)");
    await userEvent.clear(pazar);
    await userEvent.type(pazar, "99");
    await userEvent.click(screen.getByLabelText("Remove price at Kiosk (Local)"));
    save();

    expect(sentData()).toMatchObject({
      id: "p1",
      prices: [{ market: "m-a", price: 99 }],
      removedMarkets: ["m-b"],
    });
    expect(sentData()).not.toHaveProperty("price");
    expect(sentData()).not.toHaveProperty("market");
  });

  it("can undo a removal before saving", async () => {
    renderForm();

    await userEvent.click(screen.getByLabelText("Remove price at Kiosk (Local)"));
    await userEvent.click(screen.getByLabelText("Keep price at Kiosk (Local)"));
    save();

    expect(sentData()).not.toHaveProperty("removedMarkets");
  });

  it("sends no price changes when prices are untouched", () => {
    renderForm();
    save();

    expect(sentData()).not.toHaveProperty("prices");
    expect(sentData()).not.toHaveProperty("removedMarkets");
  });

  it("blocks saving a non-positive price", async () => {
    renderForm();

    const pazar = screen.getByLabelText("Price at Pazar (Local)");
    await userEvent.clear(pazar);
    await userEvent.type(pazar, "0");
    save();

    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByText("Prices must be greater than 0.")).toBeInTheDocument();
  });
});
