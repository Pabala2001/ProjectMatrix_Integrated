import React, { useState, useMemo } from "react";
import { 
  Plus, Search, Filter, ArrowUpDown, Eye, Edit2, Trash2, 
  Layers, MapPin, Calendar, CheckCircle2, Clock, AlertCircle,
  Archive, RotateCcw
} from "lucide-react";
import { Campaign, CampaignStatus, ControlPoint } from "../../types/surveying";

interface CampaignsTabProps {
  campaigns: Campaign[];
  controlPoints: ControlPoint[];
  onNew: () => void;
  onEdit: (campaign: Campaign) => void;
  onView: (campaign: Campaign) => void;
  onDelete: (campaignId: string) => void;
  onArchive?: (campaignId: string) => void;
  onRestore?: (campaignId: string) => void;
}

export default function CampaignsTab({
  campaigns,
  controlPoints,
  onNew,
  onEdit,
  onView,
  onDelete,
  onArchive,
  onRestore
}: CampaignsTabProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [disciplineFilter, setDisciplineFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"campaignCode" | "name" | "date" | "discipline">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Metrics
  const totalCount = campaigns.length;
  const completedCount = campaigns.filter(c => c.status === "Completed").length;
  const inProgressCount = campaigns.filter(c => c.status === "In Progress").length;
  const plannedCount = campaigns.filter(c => c.status === "Planned").length;

  // Filter & Sort
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(c => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        c.campaignCode.toLowerCase().includes(query) ||
        c.name.toLowerCase().includes(query) ||
        c.discipline.toLowerCase().includes(query) ||
        c.type.toLowerCase().includes(query) ||
        (c.chainage && c.chainage.toLowerCase().includes(query)) ||
        (c.leadSurveyor && c.leadSurveyor.toLowerCase().includes(query));

      const matchesDiscipline = disciplineFilter === "ALL" || c.discipline === disciplineFilter;
      const matchesType = typeFilter === "ALL" || c.type === typeFilter;
      const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;

      return matchesSearch && matchesDiscipline && matchesType && matchesStatus;
    }).sort((a, b) => {
      let comparison = 0;
      if (sortBy === "campaignCode") {
        comparison = a.campaignCode.localeCompare(b.campaignCode, undefined, { numeric: true, sensitivity: 'base' });
      } else if (sortBy === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === "discipline") {
        comparison = a.discipline.localeCompare(b.discipline);
      } else if (sortBy === "date") {
        comparison = new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime();
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [campaigns, searchQuery, disciplineFilter, typeFilter, statusFilter, sortBy, sortOrder]);

  const getStatusBadge = (status: CampaignStatus) => {
    switch (status) {
      case "Completed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Completed
          </span>
        );
      case "In Progress":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
            <Clock className="w-3 h-3" />
            In Progress
          </span>
        );
      case "Planned":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
            Planned
          </span>
        );
      case "Under Review":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
            Under Review
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Campaigns</span>
            <Layers className="w-4 h-4 text-amber-600 dark:text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">{totalCount}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Survey runs & setting out</div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Completed Runs</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{completedCount}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Signed-off survey runs</div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Active In Progress</span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{inProgressCount}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Currently being surveyed</div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Planned / Scheduled</span>
            <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400">{plannedCount}</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">Upcoming site campaigns</div>
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
              placeholder="Search code, title, discipline, surveyor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Discipline Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] font-bold text-slate-500 uppercase">Discipline:</span>
            <select
              value={disciplineFilter}
              onChange={(e) => setDisciplineFilter(e.target.value)}
              className="bg-transparent text-slate-900 dark:text-white text-xs focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-white dark:bg-slate-900">All Disciplines</option>
              <option value="Civil" className="bg-white dark:bg-slate-900">Civil</option>
              <option value="Topographic" className="bg-white dark:bg-slate-900">Topographic</option>
              <option value="As-Built" className="bg-white dark:bg-slate-900">As-Built</option>
              <option value="Structural Monitoring" className="bg-white dark:bg-slate-900">Structural Monitoring</option>
              <option value="Earthworks" className="bg-white dark:bg-slate-900">Earthworks</option>
              <option value="Tunneling" className="bg-white dark:bg-slate-900">Tunneling</option>
              <option value="Cadastral" className="bg-white dark:bg-slate-900">Cadastral</option>
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
              <option value="Planned" className="bg-white dark:bg-slate-900">Planned</option>
              <option value="In Progress" className="bg-white dark:bg-slate-900">In Progress</option>
              <option value="Completed" className="bg-white dark:bg-slate-900">Completed</option>
              <option value="Under Review" className="bg-white dark:bg-slate-900">Under Review</option>
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
              <option value="date" className="bg-white dark:bg-slate-900">Date</option>
              <option value="campaignCode" className="bg-white dark:bg-slate-900">Code</option>
              <option value="name" className="bg-white dark:bg-slate-900">Title</option>
              <option value="discipline" className="bg-white dark:bg-slate-900">Discipline</option>
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
          <span>New Campaign</span>
        </button>
      </div>

      {/* 3. Campaigns Table */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider">
              <tr>
                <th className="px-4 py-3.5">Campaign Code</th>
                <th className="px-4 py-3.5">Campaign Title</th>
                <th className="px-4 py-3.5">Discipline</th>
                <th className="px-4 py-3.5">Type</th>
                <th className="px-4 py-3.5">Chainage</th>
                <th className="px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5">Linked Points</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-850">
              {filteredCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500 dark:text-slate-500">
                    <Layers className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-700 mb-2" />
                    <p className="text-sm font-semibold">No survey campaigns found.</p>
                    <p className="text-xs text-slate-500 dark:text-slate-600 mt-1">
                      {campaigns.length === 0 
                        ? 'Click "New Campaign" above to record your first survey run or setting out task.'
                        : 'Try adjusting your search query or filters.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredCampaigns.map((camp) => (
                  <tr key={camp.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/50 transition-colors">
                    <td className="px-4 py-3.5 font-mono font-bold text-amber-600 dark:text-amber-400">
                      {camp.campaignCode}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-white max-w-[200px] truncate">
                      {camp.name}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300 font-medium">
                      {camp.discipline}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400">
                      {camp.type}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-700 dark:text-slate-300">
                      {camp.chainage || "—"}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-800 dark:text-slate-200">
                      {camp.date || "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded font-mono text-[10px] text-amber-700 dark:text-amber-400 font-bold">
                        <MapPin className="w-3 h-3 text-amber-600 dark:text-amber-500" />
                        {camp.linkedPointIds?.length || 0} Points
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {getStatusBadge(camp.status)}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onView(camp)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg transition-all"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onEdit(camp)}
                          className="p-1.5 text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg transition-all"
                          title="Edit Campaign"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {onRestore && (camp.is_archived || camp.status === "Archived") ? (
                          <button
                            onClick={() => onRestore(camp.id)}
                            className="p-1.5 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-all"
                            title="Restore Record"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : onArchive ? (
                          <button
                            onClick={() => onArchive(camp.id)}
                            className="p-1.5 text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-all"
                            title="Archive Record"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                        <button
                          onClick={() => setDeleteConfirmId(camp.id)}
                          className="p-1.5 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-all"
                          title="Delete Campaign"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Campaign?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Are you sure you want to remove this campaign record from the project register?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all"
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
