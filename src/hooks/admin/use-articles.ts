"use client";

import useSWR from "swr";
import type { ArticleReviewItem } from "@/types/admin";

interface ArticlesFilters {
  status?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

interface ArticlesResponse {
  articles: ArticleReviewItem[];
  total: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/**
 * SWR hook for admin articles list with optional filters.
 */
export function useArticles(filters?: ArticlesFilters) {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.category) params.set("category", filters.category);
  if (filters?.limit) params.set("limit", String(filters.limit));
  if (filters?.offset) params.set("offset", String(filters.offset));

  const queryString = params.toString();
  const url = `/api/admin/articles${queryString ? `?${queryString}` : ""}`;

  const { data, error, isLoading, mutate } = useSWR<ArticlesResponse>(
    url,
    fetcher,
    {
      revalidateOnFocus: true,
    },
  );

  return { data, error, isLoading, mutate };
}
