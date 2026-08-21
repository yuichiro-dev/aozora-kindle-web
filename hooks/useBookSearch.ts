'use client';

import { useMemo } from 'react';
import type { Book } from '@/components/Recommendations';

import {
  getSuggestions,
  searchBooks,
  type SearchResultBook,
  type Suggestion,
} from '@/lib/bookSearch';

type UseBookSearchResult = {
  filteredBooks: SearchResultBook[];
  suggestions: Suggestion[];
};

export function useBookSearch(books: Book[], query: string): UseBookSearchResult {
  const filteredBooks = useMemo(() => searchBooks(books, query), [books, query]);

  const suggestions = useMemo(() => getSuggestions(books, query), [books, query]);

  return {
    filteredBooks,
    suggestions,
  };
}
