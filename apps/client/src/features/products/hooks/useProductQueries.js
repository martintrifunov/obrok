import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPrivate } from "@/api/fetch";

export const productKeys = {
  all: ["products"],
  list: (filters) => [...productKeys.all, "list", filters],
  detail: (id) => [...productKeys.all, "detail", id],
};

export function useProduct(id) {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => fetchPrivate(`/products/${id}`),
    enabled: !!id,
  });
}

export function useSaveProduct(isEditMode, productId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productData) =>
      fetchPrivate("/products", {
        method: isEditMode ? "PUT" : "POST",
        body: JSON.stringify(productData),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      queryClient.invalidateQueries({ queryKey: ["chains"] });
      queryClient.invalidateQueries({ queryKey: ["markets"] });
      if (isEditMode) {
        queryClient.invalidateQueries({
          queryKey: productKeys.detail(productId),
        });
      }
    },
  });
}

export function useProducts({ searchTerm, page = 1, limit = 5 } = {}) {
  return useQuery({
    queryKey: [...productKeys.all, "list", searchTerm, page, limit],
    queryFn: () => {
      const params = new URLSearchParams();
      if (page) params.append("page", page);
      if (limit !== undefined) params.append("limit", limit);
      if (searchTerm) params.append("title", searchTerm);
      return fetchPrivate(`/products?${params}`);
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) =>
      fetchPrivate("/products", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      queryClient.invalidateQueries({ queryKey: ["chains"] });
      queryClient.invalidateQueries({ queryKey: ["markets"] });
    },
  });
}

export function useMarketProducts(marketId, params = {}, options = {}) {
  return useQuery({
    queryKey: [...productKeys.all, "market", marketId, params],
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.append("page", params.page);
      if (params.limit) searchParams.append("limit", params.limit);
      if (params.title) searchParams.append("title", params.title);
      if (params.category) searchParams.append("category", params.category);
      if (marketId) searchParams.append("marketId", marketId);
      return fetchPrivate(`/products?${searchParams}`);
    },
    enabled: !!marketId && (options.enabled ?? true),
  });
}

export function useCategories(marketId) {
  return useQuery({
    queryKey: [...productKeys.all, "categories", marketId],
    queryFn: () => {
      const url = marketId
        ? `/products/categories?marketId=${marketId}`
        : `/products/categories`;
      return fetchPrivate(url);
    },
  });
}

export const searchKeys = {
  all: ["search"],
  query: (params) => [...searchKeys.all, params],
};

export function useAISearch({ q, marketId, page = 1, limit = 10 }, options = {}) {
  return useQuery({
    queryKey: searchKeys.query({ q, marketId, page, limit }),
    queryFn: () => {
      const params = new URLSearchParams();
      params.append("q", q);
      if (marketId) params.append("marketId", marketId);
      params.append("page", page);
      params.append("limit", limit);
      return fetchPrivate(`/search?${params}`);
    },
    enabled: !!q && (options.enabled ?? true),
  });
}

export const smartSearchKeys = {
  all: ["smart-search"],
  query: (params) => [...smartSearchKeys.all, params],
  budget: () => [...smartSearchKeys.all, "budget"],
};

export function useSmartSearchBudget(options = {}) {
  return useQuery({
    queryKey: smartSearchKeys.budget(),
    queryFn: () => fetchPrivate("/smart-search/budget"),
    enabled: options.enabled ?? true,
    refetchOnWindowFocus: options.refetchOnWindowFocus ?? false,
  });
}

export function useSmartSearch({ q, lat, lon, budgetOnly }, options = {}) {
  return useQuery({
    queryKey: smartSearchKeys.query({ q, lat, lon, budgetOnly }),
    queryFn: () =>
      fetchPrivate("/smart-search", {
        method: "POST",
        body: JSON.stringify({ q, lat, lon, budgetOnly }),
      }),
    enabled: !!q && (options.enabled ?? true),
    // Retrying a rate-limited request only burns more of the limit.
    retry: (failureCount, error) => error?.status !== 429 && failureCount < 1,
    refetchOnWindowFocus: options.refetchOnWindowFocus ?? false,
  });
}
