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
  useMarketsDropdown: () => ({ data: dropdownMarkets }),
}));
vi.mock("@/features/images/hooks/useImageQueries", () => ({
  useImages: () => ({ data: [], refetch: vi.fn() }),
  useUploadImage: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/components/ui/RichTextEditor", () => ({
  default: () => <div data-testid="rich-text" />,
}));

const vero = { _id: "m-vero", name: "Vero 1", chain: { name: "Vero" } };
const ramstore = { _id: "m-ram", name: "Ramstore 2", chain: { name: "Ramstore" } };
const manualA = { _id: "m-a", name: "Pazar", chain: { name: "Local" } };
const manualB = { _id: "m-b", name: "Kiosk", chain: { name: "Local" } };
// Markets offered in the "Add price" select: the product's own markets plus one new.
const dropdownMarkets = [vero, manualA, manualB, ramstore];

const theme = createTheme();
const formTree = () => (
  <MemoryRouter initialEntries={["/dashboard/products/p1"]}>
    <ThemeProvider theme={theme}>
      <Routes>
        <Route path="/dashboard/products/:productId" element={<AddOrEditProductForm />} />
      </Routes>
    </ThemeProvider>
  </MemoryRouter>
);
const renderForm = () => render(formTree());

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

describe("AddOrEditProductForm initialization", () => {
  it("fills the form from the loaded product", () => {
    renderForm();
    expect(screen.getByLabelText("Title")).toHaveValue("Млеко 1л");
  });

  it("keeps typed edits when the product is refetched", async () => {
    const { rerender } = renderForm();

    const title = screen.getByLabelText("Title");
    await userEvent.clear(title);
    await userEvent.type(title, "Млеко 2л");

    // A background refetch returns a fresh object for the same product.
    product.current = { ...product.current, title: "Млеко 1л (server)" };
    rerender(formTree());

    expect(screen.getByLabelText("Title")).toHaveValue("Млеко 2л");
  });
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

  describe("adding a price at a new market", () => {
    const openMarketSelect = () =>
      fireEvent.mouseDown(screen.getByRole("combobox", { name: "Market" }));

    it("only offers markets the product isn't sold at", () => {
      renderForm();
      openMarketSelect();

      const options = screen.getAllByRole("option").map((o) => o.textContent);
      expect(options).toEqual(["Ramstore 2 (Ramstore)"]);
    });

    it("stages a new price and sends it as addedPrices", async () => {
      renderForm();
      openMarketSelect();
      await userEvent.click(screen.getByRole("option", { name: "Ramstore 2 (Ramstore)" }));
      await userEvent.type(screen.getByLabelText("New price"), "55");
      await userEvent.click(screen.getByRole("button", { name: /add price/i }));

      expect(screen.getByText("55 ден")).toBeInTheDocument();
      save();

      expect(sentData().addedPrices).toEqual([{ market: "m-ram", price: 55 }]);
    });

    it("doesn't stage without a market or a positive price", async () => {
      renderForm();
      await userEvent.type(screen.getByLabelText("New price"), "55");
      await userEvent.click(screen.getByRole("button", { name: /add price/i }));
      expect(screen.getByText("Choose a market.")).toBeInTheDocument();

      openMarketSelect();
      await userEvent.click(screen.getByRole("option", { name: "Ramstore 2 (Ramstore)" }));
      await userEvent.clear(screen.getByLabelText("New price"));
      await userEvent.type(screen.getByLabelText("New price"), "0");
      await userEvent.click(screen.getByRole("button", { name: /add price/i }));
      expect(screen.getByText("Price must be greater than 0.")).toBeInTheDocument();

      save();
      expect(sentData()).not.toHaveProperty("addedPrices");
    });

    it("sends nothing when a staged price is removed before saving", async () => {
      renderForm();
      openMarketSelect();
      await userEvent.click(screen.getByRole("option", { name: "Ramstore 2 (Ramstore)" }));
      await userEvent.type(screen.getByLabelText("New price"), "55");
      await userEvent.click(screen.getByRole("button", { name: /add price/i }));
      await userEvent.click(screen.getByLabelText("Remove new price at Ramstore 2 (Ramstore)"));
      save();

      expect(sentData()).not.toHaveProperty("addedPrices");
    });
  });
});
