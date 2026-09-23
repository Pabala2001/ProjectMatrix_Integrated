import React, { useState, useMemo } from "react";
import { 
  Plus, Search, Filter, ArrowUpDown, Eye, Edit2, Trash2, 
  Wrench, ShieldCheck, AlertTriangle, Clock, CheckCircle2, XCircle,
  Archive, RotateCcw
} from "lucide-react";
import { Instrument, InstrumentStatus, InstrumentType, getCalibrationState, CalibrationState } from "../../types/surveying";

interface InstrumentsTabProps {
  instruments: Instrument[];
  onNew: () => void;
  onEdit: (instrument: Instrument) => void;
  onView: (instrument: Instrument) => void;
  onDelete: (instrumentId: string) => void;
  onArchive?: (instrumentId: string) => void;
  onRestore?: (instrumentId: string) => void;
}

export default function InstrumentsTab({
  instruments,
  onNew,
  onEdit,
  onView,
  onDelete,
  onArchive,
  onRestore
}: InstrumentsTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [calibrationFilter, setCalibrationFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"instrumentId" | "name" | "expiry" | "manufacturer">("instrumentId");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Metrics
  const totalCount = instruments.length;
  let validCount = 0;
  let expiringCount = 0;
  let overdueCount = 0;

  instruments.forEach(inst => {
    const state = getCalibrationState(inst.calibrationExpiryDate);
    if (state === "Valid") validCount++;
    else if (state === "Approaching Expiry") expiringCount++;
    else if (state === "Overdue") overdueCount++;
  });

  // Filter & Sort
  const filteredInstruments = useMemo(() => {
    return instruments.filter(inst => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        inst.instrumentId.toLowerCase().includes(query) ||
        inst.name.toLowerCase().includes(query) ||
        inst.manufacturer.toLowerCase().includes(query) ||
        inst.serialNumber.toLowerCase().includes(query) ||
        inst.type.toLowerCase().includes(query);

      const matchesType = typeFilter === "ALL" || inst.type === typeFilter;
      const matchesStatus = statusFilter === "ALL" || inst.status === statusFilter;
      
      const calState = getCalibrationState(inst.calibrationExpiryDate);
      const matchesCal = calibrationFilter === "ALL" || calState === calibrationFilter;

      return matchesSearch && matchesType && matchesStatus && matchesCal;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortBy === "instrumentId") {
        comparison = a.instrumentId.localeCompare(b.instrumentId, undefined, { numeric: true, sensitivity: 'base' });
      } else if (sortBy === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === "manufacturer") {
        comparison = a.manufacturer.localeCompare(b.manufacturer);
      } else if (sortBy === "expiry") {
        comparison = new Date(a.calibrationExpiryDate || 0).getTime() - new Date(b.calibrationExpiryDate || 0).getTime();
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [instruments, searchQuery, typeFilter, statusFilter, calibrationFilter, sortBy, sortOrder]);

  const getCalibrationBadge = (expiryDate: string) => {
    const state = getCalibrationState(expiryDate);
    switch (state) {
      case "Valid":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-3 h-3" />
            Valid Calibration
          </span>
        );
      case "Approaching Expiry":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
            <Clock className="w-3 h-3" />
            Expiring Soon
          </span>
        );
      case "Overdue":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse">
            <AlertTriangle className="w-3 h-3" />
            Calibration Overdue
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400">
            Unspecified
          </span>
        );
    }
  };

  const getStatusBadge = (status: InstrumentStatus) => {
    switch (status) {
      case "In Service":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
            In Service
          </span>
        );
      case "In Calibration":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
            In Calibration
          </span>
        );
      case "Out of Service":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-500/10 text-red-400 border border-red-500/20">
            Out of Service
          </span>
        );
      case "Retired":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-500 border border-slate-700">
            Retired
          </span>
        );
      default:
        return <span className="text-slate-400">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Instruments</span>
            <Wrench className="w-4 h-4 text-amber-600 dark:text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{totalCount}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Total stations, GNSS & levels</div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Calibration Valid</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{validCount}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Certified for precise works</div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Expiring Soon (≤30d)</span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{expiringCount}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Schedule recalibration</div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Calibration Overdue</span>
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
          </div>
          <div className="text-2xl font-black text-red-600 dark:text-red-400">{overdueCount}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Requires immediate lab service</div>
        </div>
      </div>

      {/* 2. Control Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search ID, model, mfg, serial..."
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
              <option value="Total Station" className="bg-white dark:bg-slate-900">Total Station</option>
              <option value="GPS/GNSS Receiver" className="bg-white dark:bg-slate-900">GPS/GNSS Receiver</option>
              <option value="Digital Level" className="bg-white dark:bg-slate-900">Digital Level</option>
              <option value="Drone / LiDAR" className="bg-white dark:bg-slate-900">Drone / LiDAR</option>
              <option value="Optical Level" className="bg-white dark:bg-slate-900">Optical Level</option>
              <option value="Laser Scanner" className="bg-white dark:bg-slate-900">Laser Scanner</option>
            </select>
          </div>

          {/* Calibration Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300">
            <span className="text-[10px] font-bold text-slate-500 uppercase">Calibration:</span>
            <select
              value={calibrationFilter}
              onChange={(e) => setCalibrationFilter(e.target.value)}
              className="bg-transparent text-slate-900 dark:text-white text-xs focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-white dark:bg-slate-900">All Calibration</option>
              <option value="Valid" className="bg-white dark:bg-slate-900">Valid</option>
              <option value="Approaching Expiry" className="bg-white dark:bg-slate-900">Expiring Soon</option>
              <option value="Overdue" className="bg-white dark:bg-slate-900">Overdue</option>
            </select>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-slate-900 dark:text-white text-xs focus:outline-none cursor-pointer"
            >
              <option value="instrumentId" className="bg-white dark:bg-slate-900">ID</option>
              <option value="name" className="bg-white dark:bg-slate-900">Name</option>
              <option value="manufacturer" className="bg-white dark:bg-slate-900">Manufacturer</option>
              <option value="expiry" className="bg-white dark:bg-slate-900">Expiry Date</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
              className="ml-1 text-[10px] font-mono text-amber-600 dark:text-amber-400 hover:underline"
            >
              {sortOrder.toUpperCase()}
            </button>
          </div>
        </div>

        <button
          onClick={onNew}
          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/10 transition-all cursor-pointer uppercase tracking-wider shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>New Instrument</span>
        </button>
      </div>

      {/* 3. Instruments Table */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider">
              <tr>
                <th className="px-4 py-3.5">ID</th>
                <th className="px-4 py-3.5">Instrument Name</th>
                <th className="px-4 py-3.5">Type</th>
                <th className="px-4 py-3.5">Manufacturer</th>
                <th className="px-4 py-3.5">Serial</th>
                <th className="px-4 py-3.5">Calibration Status</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-850">
              {filteredInstruments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500 dark:text-slate-500">
                    <Wrench className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-700 mb-2" />
                    <p className="text-sm font-semibold">No survey instruments found.</p>
                    <p className="text-xs text-slate-500 dark:text-slate-600 mt-1">
                      {instruments.length === 0 
                        ? 'Click "New Instrument" above to add your first survey total station or GPS equipment.'
                        : 'Try adjusting your search query or filters.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredInstruments.map((inst) => (
                  <tr key={inst.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/50 transition-colors">
                    <td className="px-4 py-3.5 font-mono font-bold text-amber-600 dark:text-amber-400">
                      {inst.instrumentId}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white max-w-[200px] truncate">
                      {inst.name}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300 font-medium">
                      {inst.type}
                    </td>
                    <td className="px-4 py-3.5 text-slate-800 dark:text-slate-200">
                      {inst.manufacturer}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                      {inst.serialNumber}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-1">
                        {getCalibrationBadge(inst.calibrationExpiryDate)}
                        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-500">
                          Exp: {inst.calibrationExpiryDate || "N/A"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {getStatusBadge(inst.status)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onView(inst)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg transition-all"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onEdit(inst)}
                          className="p-1.5 text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg transition-all"
                          title="Edit Instrument"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {onRestore && (inst.is_archived || inst.status === "Archived") ? (
                          <button
                            onClick={() => onRestore(inst.id)}
                            className="p-1.5 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-all"
                            title="Restore Record"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : onArchive ? (
                          <button
                            onClick={() => onArchive(inst.id)}
                            className="p-1.5 text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-all"
                            title="Archive Record"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                        <button
                          onClick={() => setDeleteConfirmId(inst.id)}
                          className="p-1.5 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-all"
                          title="Delete Instrument"
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
                <h3 className="text-base font-bold text-white">Delete Instrument?</h3>
                <p className="text-xs text-slate-400">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-xs text-slate-300">
              Are you sure you want to remove this instrument from the project register?
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
