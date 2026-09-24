import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/renderWithProviders";
import MealSearchTab from "./MealSearchTab";

const market = { _id: "m1", name: "Vero Центар", location: [42, 21.4] };

const result = {
  data: {
    shoppingList: [
      { name: "брашно", found: true },
      { name: "јајца", found: false },
    ],
    markets: [
      {
        market,
        distance: 1250,
        matchCount: 1,
        totalProducts: 2,
        complete: false,
        totalPrice: 180,
        overBudgetAmount: 30,
        products: [
          { name: "брашно", title: "Брашно Т-400 1кг", price: 80, overflow: false },
          { name: "млеко", title: "Млеко 1л", price: 100, overflow: true },
        ],
      },
    ],
  },
};

const renderTab = (props = {}) =>
  renderWithProviders(
    <MealSearchTab
      input=""
      onInputChange={vi.fn()}
      query=""
      isLoading={false}
      error={null}
      result={undefined}
      weeklyBudget={null}
      budgetOnly={false}
      onBudgetOnlyChange={vi.fn()}
      onDistanceClick={vi.fn()}
      {...props}
    />,
  );

describe("MealSearchTab", () => {
  it("shows a placeholder dash until the budget loads", () => {
    renderTab();
    expect(screen.getByText("Буџет за оброк: —")).toBeInTheDocument();
  });

  it("shows the weekly budget", () => {
    renderTab({ weeklyBudget: 250 });
    expect(screen.getByText("Буџет за оброк: 250 ден.")).toBeInTheDocument();
  });

  it("toggles the budget-only filter", async () => {
    const onBudgetOnlyChange = vi.fn();
    renderTab({ onBudgetOnlyChange });

    await userEvent.click(screen.getByRole("switch"));

    expect(onBudgetOnlyChange).toHaveBeenCalledWith(true);
  });

  it("prompts for a meal before a query is entered", () => {
    renderTab();
    expect(screen.getByText(/Внеси оброк, а ние ќе ги најдеме/)).toBeInTheDocument();
  });

  it("explains when the AI could not decompose the meal", () => {
    renderTab({ query: "нешто", result: { data: null, redirect: true } });
    expect(screen.getByText(/Не успеавме да го разложиме/)).toBeInTheDocument();
  });

  it("tells the user to wait when rate limited", () => {
    renderTab({ query: "палачинки", error: { status: 429 } });
    expect(screen.getByText(/Премногу пребарувања/)).toBeInTheDocument();
  });

  it("renders the shopping list and market breakdown", () => {
    renderTab({ query: "палачинки", result });

    expect(screen.getByText("брашно")).toBeInTheDocument();
    expect(screen.getByText("јајца")).toBeInTheDocument();
    expect(screen.getByText("Vero Центар")).toBeInTheDocument();
    expect(screen.getByText("1/2 производи")).toBeInTheDocument();
    expect(screen.getByText("Вкупно: 180 ден.")).toBeInTheDocument();
    expect(screen.getByText("Доплата: 30 ден.")).toBeInTheDocument();
    expect(screen.getByText("Млеко 1л")).toBeInTheDocument();
  });

  it("hides the surcharge chip when the market is within budget", () => {
    const withinBudget = structuredClone(result);
    withinBudget.data.markets[0].overBudgetAmount = 0;
    renderTab({ query: "палачинки", result: withinBudget });

    expect(screen.queryByText(/Доплата/)).not.toBeInTheDocument();
  });

  it("requests a route when the distance chip is clicked", async () => {
    const onDistanceClick = vi.fn();
    renderTab({ query: "палачинки", result, onDistanceClick });

    await userEvent.click(screen.getByText("1.3 km"));

    expect(onDistanceClick).toHaveBeenCalledWith(
      expect.anything(),
      market,
      1250,
      result.data.markets[0].products,
    );
  });
});
