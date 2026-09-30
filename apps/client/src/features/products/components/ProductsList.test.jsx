import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import ProductsList from "./ProductsList";

const queries = vi.hoisted(() => ({
  useProducts: vi.fn(),
  useDeleteProduct: vi.fn(),
}));

vi.mock("@/features/products/hooks/useProductQueries", () => queries);

const makeProducts = (count, offset = 0) =>
  Array.from({ length: count }, (_, i) => ({
    _id: `p${offset + i}`,
    title: `Product ${offset + i}`,
    marketProducts: [],
  }));

const stubMatchMedia = (matches) =>
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  );

let mutate;

beforeEach(() => {
  mutate = vi.fn((id, { onSuccess }) => onSuccess());
  queries.useDeleteProduct.mockReturnValue({ mutate, isPending: false });
  queries.useProducts.mockImplementation(({ page }) => ({
    isLoading: false,
    isError: false,
    data:
      page === 1
        ? { data: makeProducts(5), pagination: { total: 6 } }
        : { data: makeProducts(1, 5), pagination: { total: 6 } },
  }));
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const lastRequestedPage = () => queries.useProducts.mock.calls.at(-1)[0].page;

describe("ProductsList", () => {
  it("paginates on small screens", () => {
    stubMatchMedia(true);
    renderWithProviders(<ProductsList searchTerm="" />);

    fireEvent.click(screen.getByLabelText("Go to next page"));

    expect(lastRequestedPage()).toBe(2);
    expect(screen.getByText("Product 5")).toBeInTheDocument();
  });

  it("steps back a page after deleting the last row on it", () => {
    stubMatchMedia(false);
    renderWithProviders(<ProductsList searchTerm="" />);

    fireEvent.click(screen.getByLabelText("Go to next page"));
    expect(lastRequestedPage()).toBe(2);

    fireEvent.click(screen.getByLabelText("delete product"));

    expect(mutate).toHaveBeenCalledWith("p5", expect.any(Object));
    expect(lastRequestedPage()).toBe(1);
  });
});
