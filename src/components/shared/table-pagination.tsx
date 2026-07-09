"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  safeCurrentPage: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  rowsPerPage: number;
  rowsPerPageOptions: number[];
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (value: number) => void;
  itemName?: string; // e.g. "employees", "entries", "records", "requests"
}

export default function TablePagination({
  safeCurrentPage,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  rowsPerPage,
  rowsPerPageOptions,
  onPageChange,
  onRowsPerPageChange,
  itemName = "entries",
}: TablePaginationProps) {
  return (
    <div className="px-5 py-3 border-t border-rcc-border bg-rcc-bg/30 flex flex-col sm:flex-row items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <p className="text-xs text-rcc-text-muted">
          Showing{" "}
          <span className="font-semibold text-rcc-text-secondary">
            {totalItems === 0 ? 0 : startIndex + 1}
          </span>
          {" – "}
          <span className="font-semibold text-rcc-text-secondary">
            {endIndex}
          </span>
          {" of "}
          <span className="font-semibold text-rcc-text-secondary">{totalItems}</span>
          {" "}{itemName}
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-rcc-text-muted">Rows:</span>
          <select
            value={rowsPerPage}
            onChange={(e) => onRowsPerPageChange(Number(e.target.value))}
            className="appearance-none border border-rcc-border rounded-md px-2 py-1 text-xs bg-rcc-surface text-rcc-text-primary focus:outline-none focus:ring-1 focus:ring-rcc-accent cursor-pointer"
          >
            {rowsPerPageOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage <= 1}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-rcc-border text-rcc-text-secondary hover:bg-rcc-bg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Previous
        </button>

        {/* Page numbers */}
        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((page) => {
              if (page === 1 || page === totalPages) return true;
              if (Math.abs(page - safeCurrentPage) <= 1) return true;
              return false;
            })
            .reduce<(number | "ellipsis")[]>((acc, page, idx, arr) => {
              if (idx > 0) {
                const prev = arr[idx - 1];
                if (page - prev > 1) {
                  acc.push("ellipsis");
                }
              }
              acc.push(page);
              return acc;
            }, [])
            .map((item, idx) =>
              item === "ellipsis" ? (
                <span key={`ellipsis-${idx}`} className="px-1 text-xs text-rcc-text-muted">
                  ...
                </span>
              ) : (
                <button
                  key={item}
                  onClick={() => onPageChange(item)}
                  className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                    safeCurrentPage === item
                      ? "bg-rcc-primary text-rcc-primary-foreground"
                      : "text-rcc-text-secondary hover:bg-rcc-bg"
                  }`}
                >
                  {item}
                </button>
              )
            )}
        </div>

        <button
          onClick={() => onPageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage >= totalPages}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-rcc-border text-rcc-text-secondary hover:bg-rcc-bg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
