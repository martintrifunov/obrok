import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, act } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { useFeatureFlagStore } from "@/store/featureFlagStore";
import GlobalAISearchDialog, {
  MEAL_SEARCH_DEBOUNCE_MS,
  PRODUCT_SEARCH_DEBOUNCE_MS,
} from "./GlobalAISearchDialog";

const queries = vi.hoisted(() => ({
  useAISearch: vi.fn(),
  useSmartSearch: vi.fn(),
  useSmartSearchBudget: vi.fn(),
}));

vi.mock("@/features/products/hooks/useProductQueries", () => queries);

const lastCallArgs = (mock) => mock.mock.calls.at(-1);

const renderDialog = (props = {}) =>
  renderWithProviders(
    <GlobalAISearchDialog
      open
      onClose={vi.fn()}
      onRequestRoute={vi.fn()}
      userLocation={[21.409471, 42.004302]}
      {...props}
    />,
  );

const typeAndWait = (placeholder, value, ms) => {
  fireEvent.change(screen.getByPlaceholderText(placeholder), {
    target: { value },
  });
  act(() => vi.advanceTimersByTime(ms));
};

beforeEach(() => {
  vi.useFakeTimers();
  queries.useAISearch.mockReturnValue({ data: undefined, isLoading: false });
  queries.useSmartSearch.mockReturnValue({ data: undefined, isLoading: false });
  queries.useSmartSearchBudget.mockReturnValue({
    data: { data: { weeklyBudget: 250 } },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("GlobalAISearchDialog with smart search enabled", () => {
  beforeEach(() => {
    useFeatureFlagStore.setState({ flags: { "smart-search": true } });
  });

  it("opens on the meal tab and shows the weekly budget", () => {
    renderDialog();

    expect(screen.getByPlaceholderText("Внеси оброк што ти се јаде...")).toBeInTheDocument();
    expect(screen.getByText("Буџет за оброк: 250 ден.")).toBeInTheDocument();
  });

  it("debounces the meal query and sends a rounded location", () => {
    renderDialog();

    fireEvent.change(screen.getByPlaceholderText("Внеси оброк што ти се јаде..."), {
      target: { value: "  палачинки  " },
    });
    act(() => vi.advanceTimersByTime(MEAL_SEARCH_DEBOUNCE_MS - 1));
    expect(lastCallArgs(queries.useSmartSearch)[0].q).toBe("");

    act(() => vi.advanceTimersByTime(1));
    const [params, options] = lastCallArgs(queries.useSmartSearch);
    expect(params).toEqual({
      q: "палачинки",
      lat: 42.0043,
      lon: 21.4095,
      budgetOnly: false,
    });
    expect(options.enabled).toBe(true);
  });

  it("omits location when the user has not been located", () => {
    renderDialog({ userLocation: null });

    typeAndWait("Внеси оброк што ти се јаде...", "салата", MEAL_SEARCH_DEBOUNCE_MS);

    const [params] = lastCallArgs(queries.useSmartSearch);
    expect(params.lat).toBeUndefined();
    expect(params.lon).toBeUndefined();
  });

  it("does not run the product search while the meal tab is active", () => {
    renderDialog();

    typeAndWait("Внеси оброк што ти се јаде...", "салата", MEAL_SEARCH_DEBOUNCE_MS);

    expect(lastCallArgs(queries.useAISearch)[1].enabled).toBe(false);
  });

  it("forwards a route request from a market card", () => {
    const onRequestRoute = vi.fn();
    const market = { _id: "m1", name: "Ramstore", location: [42, 21.4] };
    const products = [{ name: "леб", title: "Леб", price: 40 }];
    queries.useSmartSearch.mockReturnValue({
      isLoading: false,
      data: {
        data: {
          shoppingList: [{ name: "леб", found: true }],
          markets: [
            {
              market,
              distance: 400,
              matchCount: 1,
              totalProducts: 1,
              complete: true,
              totalPrice: 40,
              overBudgetAmount: 0,
              products,
            },
          ],
        },
      },
    });
    renderDialog({ onRequestRoute });

    typeAndWait("Внеси оброк што ти се јаде...", "леб", MEAL_SEARCH_DEBOUNCE_MS);
    fireEvent.click(screen.getByText("400m"));

    expect(onRequestRoute).toHaveBeenCalledWith({ market, distance: 400, products });
  });

  it("clears inputs when closed explicitly", () => {
    const onClose = vi.fn();
    const { rerender } = renderDialog({ onClose });

    typeAndWait("Внеси оброк што ти се јаде...", "салата", MEAL_SEARCH_DEBOUNCE_MS);
    fireEvent.click(screen.getByLabelText("Затвори"));
    expect(onClose).toHaveBeenCalled();

    rerender(
      <GlobalAISearchDialog open onClose={onClose} userLocation={null} />,
    );
    expect(screen.getByPlaceholderText("Внеси оброк што ти се јаде...")).toHaveValue("");
  });
});

describe("GlobalAISearchDialog with smart search disabled", () => {
  beforeEach(() => {
    useFeatureFlagStore.setState({ flags: {} });
  });

  it("shows only the product search and never fetches the budget", () => {
    renderDialog();

    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText("Пребарувај низ сите маркети...")).toBeInTheDocument();
    expect(lastCallArgs(queries.useSmartSearchBudget)[0].enabled).toBe(false);
  });

  it("debounces the product query and resets to the first page", () => {
    renderDialog();

    typeAndWait("Пребарувај низ сите маркети...", "млеко", PRODUCT_SEARCH_DEBOUNCE_MS);

    const [params, options] = lastCallArgs(queries.useAISearch);
    expect(params).toEqual({ q: "млеко", page: 1, limit: 10 });
    expect(options.enabled).toBe(true);
  });

  it("routes to a market from a product result", () => {
    const onRequestRoute = vi.fn();
    const market = { _id: "m2", name: "KAM", location: [42, 21.4] };
    queries.useAISearch.mockReturnValue({
      isLoading: false,
      data: {
        data: [
          {
            product: { _id: "p1", title: "Млеко 1л", category: "Млечни" },
            marketProducts: [{ market, price: 75 }],
          },
        ],
      },
    });
    renderDialog({ onRequestRoute });

    typeAndWait("Пребарувај низ сите маркети...", "млеко", PRODUCT_SEARCH_DEBOUNCE_MS);
    fireEvent.click(screen.getByText("KAM — 75 ден."));

    expect(onRequestRoute).toHaveBeenCalledWith({ market, searchTerm: "Млеко 1л" });
  });

  it("does not route to a market without coordinates", () => {
    const onRequestRoute = vi.fn();
    queries.useAISearch.mockReturnValue({
      isLoading: false,
      data: {
        data: [
          {
            product: { _id: "p1", title: "Млеко 1л" },
            marketProducts: [{ market: { _id: "m3", name: "Stokomak" }, price: 70 }],
          },
        ],
      },
    });
    renderDialog({ onRequestRoute });

    typeAndWait("Пребарувај низ сите маркети...", "млеко", PRODUCT_SEARCH_DEBOUNCE_MS);
    fireEvent.click(screen.getByText("Stokomak — 70 ден."));

    expect(onRequestRoute).not.toHaveBeenCalled();
  });
});
