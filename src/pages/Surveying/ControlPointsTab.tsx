import React, { useState, useMemo } from "react";
import { 
  Plus, Search, Filter, ArrowUpDown, Eye, Edit2, Trash2, 
  Compass, MapPin, CheckCircle2, AlertTriangle, XCircle, Clock, ShieldAlert,
  Archive, RotateCcw
} from "lucide-react";
import { ControlPoint, ControlPointStatus, ControlPointType } from "../../types/surveying";

interface ControlPointsTabProps {
  controlPoints: ControlPoint[];
  onNew: () => void;
  onEdit: (point: ControlPoint) => void;
  onView: (point: ControlPoint) => void;
  onDelete: (pointId: string) => void;
  onArchive?: (pointId: string) => void;
  onRestore?: (pointId: string) => void;
}

export default function ControlPointsTab({
  controlPoints,
  onNew,
  onEdit,
  onView,
  onDelete,
  onArchive,
  onRestore
}: ControlPointsTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"pointId" | "name" | "elevation" | "date">("pointId");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Compute metrics
  const totalCount = controlPoints.length;
  const activeCount = controlPoints.filter(p => p.status === "Active").length;
  const compromisedCount = controlPoints.filter(p => p.status === "Compromised" || p.status === "Destroyed").length;
  const pendingCount = controlPoints.filter(p => p.status === "Pending Verification").length;

  // Filtered & Sorted Control Points
  const filteredPoints = useMemo(() => {
    return controlPoints.filter(p => {
      // Search
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        p.pointId.toLowerCase().includes(query) ||
        p.name.toLowerCase().includes(query) ||
        p.type.toLowerCase().includes(query) ||
        (p.notes && p.notes.toLowerCase().includes(query));

      // Type filter
      const matchesType = typeFilter === "ALL" || p.type === typeFilter;

      // Status filter
      const matchesStatus = statusFilter === "ALL" || p.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortBy === "pointId") {
        comparison = a.pointId.localeCompare(b.pointId, undefined, { numeric: true, sensitivity: 'base' });
      } else if (sortBy === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === "elevation") {
        comparison = a.elevation - b.elevation;
      } else if (sortBy === "date") {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [controlPoints, searchQuery, typeFilter, statusFilter, sortBy, sortOrder]);

  const getStatusBadge = (status: ControlPointStatus) => {
    switch (status) {
      case "Active":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Active
          </span>
        );
      case "Compromised":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3 h-3" />
            Compromised
          </span>
        );
      case "Destroyed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20">
            <XCircle className="w-3 h-3" />
            Destroyed
          </span>
        );
      case "Pending Verification":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Clock className="w-3 h-3" />
            Pending Verification
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Control Points</span>
            <Compass className="w-4 h-4 text-amber-600 dark:text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{totalCount}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Survey ground references</div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Active & Valid</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{activeCount}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Verified for setting out</div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Compromised / Lost</span>
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{compromisedCount}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Requires re-traverse or fix</div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Pending Check</span>
            <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400">{pendingCount}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Awaiting campaign audit</div>
        </div>
      </div>

      {/* 2. Control Bar: Search, Filters, Sorting, New Action */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search point ID, name, or type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-transparent text-slate-900 dark:text-white text-xs focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-white dark:bg-slate-900">All Types</option>
              <option value="Benchmark" className="bg-white dark:bg-slate-900">Benchmark</option>
              <option value="Traverse Station" className="bg-white dark:bg-slate-900">Traverse Station</option>
              <option value="Monitoring Point" className="bg-white dark:bg-slate-900">Monitoring Point</option>
              <option value="Boundary Peg" className="bg-white dark:bg-slate-900">Boundary Peg</option>
              <option value="Control Pillar" className="bg-white dark:bg-slate-900">Control Pillar</option>
              <option value="GPS Station" className="bg-white dark:bg-slate-900">GPS Station</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-slate-900 dark:text-white text-xs focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-white dark:bg-slate-900">All Statuses</option>
              <option value="Active" className="bg-white dark:bg-slate-900">Active</option>
              <option value="Compromised" className="bg-white dark:bg-slate-900">Compromised</option>
              <option value="Destroyed" className="bg-white dark:bg-slate-900">Destroyed</option>
              <option value="Pending Verification" className="bg-white dark:bg-slate-900">Pending Verification</option>
            </select>
          </div>

          {/* Sort Control */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-slate-900 dark:text-white text-xs focus:outline-none cursor-pointer"
            >
              <option value="pointId" className="bg-white dark:bg-slate-900">Point ID</option>
              <option value="name" className="bg-white dark:bg-slate-900">Name</option>
              <option value="elevation" className="bg-white dark:bg-slate-900">Elevation</option>
              <option value="date" className="bg-white dark:bg-slate-900">Date Added</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
              className="ml-1 text-[10px] font-mono text-amber-600 dark:text-amber-400 hover:underline"
            >
              {sortOrder.toUpperCase()}
            </button>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onNew}
          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/10 transition-all cursor-pointer uppercase tracking-wider shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>New Control Point</span>
        </button>
      </div>

      {/* 3. Control Points Register Table */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300 table-fixed">
            <thead className="bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider">
              <tr>
                <th className="px-4 py-3.5 w-28 overflow-hidden text-ellipsis">Point ID</th>
                <th className="px-4 py-3.5 w-48 overflow-hidden text-ellipsis">Name</th>
                <th className="px-4 py-3.5 w-36 overflow-hidden text-ellipsis">Type</th>
                <th className="px-4 py-3.5 w-32 overflow-hidden text-ellipsis">Easting (X)</th>
                <th className="px-4 py-3.5 w-32 overflow-hidden text-ellipsis">Northing (Y)</th>
                <th className="px-4 py-3.5 w-32 overflow-hidden text-ellipsis">Elevation (Z)</th>
                <th className="px-4 py-3.5 w-32 overflow-hidden text-ellipsis">Status</th>
                <th className="px-4 py-3.5 text-right w-36 overflow-hidden text-ellipsis">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-850">
              {filteredPoints.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500 dark:text-slate-500 overflow-hidden text-ellipsis">
                    <Compass className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-700 mb-2" />
                    <p className="text-sm font-semibold">No control points found.</p>
                    <p className="text-xs text-slate-500 dark:text-slate-600 mt-1">
                      {controlPoints.length === 0 
                        ? 'Click "New Control Point" above to add the first survey benchmark.'
                        : 'Try adjusting your search query or filters.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredPoints.map((point) => (
                  <tr key={point.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/50 transition-colors">
                    <td className="px-4 py-3.5 font-mono font-bold text-amber-600 dark:text-amber-400 overflow-hidden text-ellipsis whitespace-nowrap">
                      {point.pointId}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white max-w-[200px] overflow-hidden text-ellipsis" title={point.name}>
                      <span className="truncate block">{point.name}</span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300 font-medium overflow-hidden text-ellipsis whitespace-nowrap">
                      {point.type}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-800 dark:text-slate-200 overflow-hidden text-ellipsis whitespace-nowrap">
                      {point.easting.toFixed(3)}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-800 dark:text-slate-200 overflow-hidden text-ellipsis whitespace-nowrap">
                      {point.northing.toFixed(3)}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-amber-700 dark:text-amber-300 font-bold overflow-hidden text-ellipsis whitespace-nowrap">
                      {point.elevation.toFixed(3)} m
                    </td>
                    <td className="px-4 py-3.5 overflow-hidden text-ellipsis whitespace-nowrap">
                      {getStatusBadge(point.status)}
                    </td>
                    <td className="px-4 py-3.5 text-right overflow-hidden text-ellipsis whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onView(point)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg transition-all"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onEdit(point)}
                          className="p-1.5 text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg transition-all"
                          title="Edit Control Point"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {onRestore && (point.is_archived || point.status === "Archived") ? (
                          <button
                            onClick={() => onRestore(point.id)}
                            className="p-1.5 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-all"
                            title="Restore Record"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : onArchive ? (
                          <button
                            onClick={() => onArchive(point.id)}
                            className="p-1.5 text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-all"
                            title="Archive Record"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                        <button
                          onClick={() => setDeleteConfirmId(point.id)}
                          className="p-1.5 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-all"
                          title="Delete Control Point"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Control Point?</h3>
                <p className="text-xs text-slate-400">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to delete this control point record from the active project register?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-red-500/20"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
