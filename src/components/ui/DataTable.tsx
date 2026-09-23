import React, { useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown, Search, Filter } from "lucide-react";

export interface Column<T> {
  key?: string;
  accessor?: string | ((row: T) => any);
  header: string;
  render?: (row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  className?: string;
  width?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor?: (row: T, index: number) => string;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchFilter?: (row: T, query: string) => boolean;
  emptyState?: React.ReactNode;
  isLoading?: boolean;
  onRowClick?: (row: T) => void;
  className?: string;
  id?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor = (row: any, idx: number) => row?.id || row?.key || row?.code || row?.ref || String(idx),
  searchable = false,
  searchPlaceholder = "Search records...",
  searchFilter,
  emptyState,
  isLoading = false,
  onRowClick,
  className = "",
  id
}: DataTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Filtering
  const filteredData = React.useMemo(() => {
    if (!searchQuery.trim()) return data;
    if (searchFilter) {
      return data.filter(row => searchFilter(row, searchQuery.toLowerCase()));
    }
    return data.filter(row => {
      const rowString = JSON.stringify(row).toLowerCase();
      return rowString.includes(searchQuery.toLowerCase());
    });
  }, [data, searchQuery, searchFilter]);

  // Sorting
  const sortedData = React.useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a: any, b: any) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      if (typeof valA === "number" && typeof valB === "number") {
        return sortOrder === "asc" ? valA - valB : valB - valA;
      }
      return sortOrder === "asc"
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [filteredData, sortKey, sortOrder]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortOrder === "asc") {
        setSortOrder("desc");
      } else {
        setSortKey(null);
        setSortOrder("asc");
      }
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  return (
    <div id={id} className={`space-y-4 ${className}`}>
      {searchable && (
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#0B172A] border border-[#E6E9EF] dark:border-slate-800 rounded-2xl text-xs font-medium text-[#172033] dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>
          <span className="text-xs text-slate-400 font-medium">
            {sortedData.length} {sortedData.length === 1 ? "entry" : "entries"}
          </span>
        </div>
      )}

      <div className="border border-[#E6E9EF] dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-[#0B172A] shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
              <tr className="bg-[#F7F8FA] dark:bg-slate-850/80 border-b border-[#E6E9EF] dark:border-slate-800 text-[11px] font-extrabold uppercase tracking-wider text-[#667085] dark:text-slate-400">
                {columns.map((col, cIdx) => {
                  const colKey = col.key || (typeof col.accessor === "string" ? col.accessor : "") || `col_${cIdx}`;
                  return (
                    <th
                      key={colKey}
                      style={{ width: col.width }}
                      className={`px-4 py-3.5 overflow-hidden text-ellipsis ${
                        col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : "text-left"
                      } ${col.sortable ? "cursor-pointer select-none hover:text-slate-900 dark:hover:text-white" : ""} ${col.className || ""}`}
                      onClick={() => col.sortable && handleSort(colKey)}
                    >
                      <div className={`inline-flex items-center gap-1.5 max-w-full overflow-hidden text-ellipsis ${
                        col.align === "center" ? "justify-center" : col.align === "right" ? "justify-end" : "justify-start"
                      }`}>
                        <span className="truncate">{col.header}</span>
                        {col.sortable && (
                          sortKey === colKey ? (
                            sortOrder === "asc" ? (
                              <ChevronUp className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            )
                          ) : (
                            <ChevronsUpDown className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0" />
                          )
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-400 overflow-hidden text-ellipsis">
                    <div className="inline-flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      <span>Loading records...</span>
                    </div>
                  </td>
                </tr>
              ) : sortedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-400 overflow-hidden text-ellipsis">
                    {emptyState || (
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-700 dark:text-slate-300">No records found</p>
                        <p className="text-[11px] text-slate-400">There are no matching entries to display.</p>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                sortedData.map((row, idx) => (
                  <tr
                    key={keyExtractor(row, idx)}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={`transition-colors ${
                      onRowClick ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60" : "hover:bg-[#F7F8FA] dark:hover:bg-slate-800/40"
                    }`}
                  >
                    {columns.map((col, cIdx) => {
                      const colKey = col.key || (typeof col.accessor === "string" ? col.accessor : "") || `col_${cIdx}`;
                      return (
                        <td
                          key={colKey}
                          className={`px-4 py-3.5 sm:py-4 text-slate-700 dark:text-slate-200 overflow-hidden text-ellipsis text-xs sm:text-[13px] ${
                            col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : "text-left"
                          } ${col.className || ""}`}
                        >
                          {col.render 
                            ? col.render(row, idx) 
                            : typeof col.accessor === "function"
                              ? col.accessor(row)
                              : (row as any)[colKey]}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DataTable;
