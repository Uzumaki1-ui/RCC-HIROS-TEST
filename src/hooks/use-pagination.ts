"use client";

import { useState, useCallback, useMemo } from "react";

const DEFAULT_ROWS_PER_PAGE_OPTIONS = [10, 25, 50];
const DEFAULT_ROWS_PER_PAGE = 10;

interface UsePaginationOptions {
  totalItems: number;
  initialRowsPerPage?: number;
  rowsPerPageOptions?: number[];
}

interface UsePaginationReturn {
  currentPage: number;
  rowsPerPage: number;
  totalPages: number;
  safeCurrentPage: number;
  startIndex: number;
  endIndex: number;
  paginatedItems: <T>(items: T[]) => T[];
  handlePageChange: (page: number) => void;
  handleRowsPerPageChange: (value: number) => void;
  resetPage: () => void;
  rowsPerPageOptions: number[];
}

export function usePagination({
  totalItems,
  initialRowsPerPage = DEFAULT_ROWS_PER_PAGE,
  rowsPerPageOptions = DEFAULT_ROWS_PER_PAGE_OPTIONS,
}: UsePaginationOptions): UsePaginationReturn {
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(initialRowsPerPage);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalItems / rowsPerPage)),
    [totalItems, rowsPerPage]
  );

  const safeCurrentPage = useMemo(
    () => Math.min(currentPage, totalPages),
    [currentPage, totalPages]
  );

  const startIndex = (safeCurrentPage - 1) * rowsPerPage;
  const endIndex = Math.min(safeCurrentPage * rowsPerPage, totalItems);

  const paginatedItems = useCallback(
    <T,>(items: T[]): T[] =>
      items.slice(startIndex, startIndex + rowsPerPage),
    [startIndex, rowsPerPage]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    },
    [totalPages]
  );

  const handleRowsPerPageChange = useCallback((value: number) => {
    setRowsPerPage(value);
    setCurrentPage(1);
  }, []);

  const resetPage = useCallback(() => {
    setCurrentPage(1);
  }, []);

  return {
    currentPage,
    rowsPerPage,
    totalPages,
    safeCurrentPage,
    startIndex,
    endIndex,
    paginatedItems,
    handlePageChange,
    handleRowsPerPageChange,
    resetPage,
    rowsPerPageOptions,
  };
}
