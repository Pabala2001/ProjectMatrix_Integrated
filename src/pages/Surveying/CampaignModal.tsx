import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect } from "react";
import { X, Save, AlertCircle, Calendar, Hash, Compass, Check, Users, MapPin } from "lucide-react";
import { Campaign, CampaignDiscipline, CampaignType, CampaignStatus, ControlPoint } from "../../types/surveying";

interface CampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (campaign: Campaign) => void;
  initialCampaign?: Campaign | null;
  existingCampaigns: Campaign[];
  controlPoints: ControlPoint[];
  projectId: string;
  companyId: string;
}

const DISCIPLINES: CampaignDiscipline[] = [
  "Civil",
  "Topographic",
  "As-Built",
  "Structural Monitoring",
  "Earthworks",
  "Tunneling",
  "Cadastral"
];

const CAMPAIGN_TYPES: CampaignType[] = [
  "Initial Survey",
  "Monitoring Run",
  "As-Built Verification",
  "Setting Out",
  "Control Verification",
  "Volumetric Survey"
];

const CAMPAIGN_STATUSES: CampaignStatus[] = [
  "Planned",
  "In Progress",
  "Completed",
  "Under Review",
  "Archived"
];

export default function CampaignModal({
  isOpen,
  onClose,
  onSave,
  initialCampaign,
  existingCampaigns,
  controlPoints,
  projectId,
  companyId
}: CampaignModalProps) {
  const [campaignCode, setCampaignCode] = useState("");
  const [name, setName] = useState("");
  const [discipline, setDiscipline] = useState<CampaignDiscipline>("Civil");
  const [type, setType] = useState<CampaignType>("Initial Survey");
  const [chainage, setChainage] = useState("");
  const [date, setDate] = useState("");
  const [linkedPointIds, setLinkedPointIds] = useState<string[]>([]);
  const [status, setStatus] = useState<CampaignStatus>("In Progress");
  const [leadSurveyor, setLeadSurveyor] = useState("");
  const [notes, setNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialCampaign) {
      setCampaignCode(initialCampaign.campaignCode);
      setName(initialCampaign.name);
      setDiscipline(initialCampaign.discipline);
      setType(initialCampaign.type);
      setChainage(initialCampaign.chainage || "");
      setDate(initialCampaign.date || "");
      setLinkedPointIds(initialCampaign.linkedPointIds || []);
      setStatus(initialCampaign.status);
      setLeadSurveyor(initialCampaign.leadSurveyor || "");
      setNotes(initialCampaign.notes || "");
    } else {
      const today = new Date().toISOString().split("T")[0];
      setCampaignCode("");
      setName("");
      setDiscipline("Civil");
      setType("Initial Survey");
      setChainage("");
      setDate(today);
      setLinkedPointIds([]);
      setStatus("In Progress");
      setLeadSurveyor("");
      setNotes("");
    }
    setErrorMsg(null);
  }, [initialCampaign, isOpen]);

  if (!isOpen) return null;

  const togglePointSelection = (pointId: string) => {
    setLinkedPointIds(prev => 
      prev.includes(pointId) ? prev.filter(id => id !== pointId) : [...prev, pointId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    assertOperationalAction("write", "pages/Surveying/CampaignModal.tsx");
    e.preventDefault();
    setErrorMsg(null);

    const trimmedCode = campaignCode.trim();
    const trimmedName = name.trim();

    if (!trimmedCode) {
      setErrorMsg("Campaign Code is required.");
      return;
    }

    if (!trimmedName) {
      setErrorMsg("Campaign Title / Name is required.");
      return;
    }

    // Duplicate check
    const isDuplicate = existingCampaigns.some(c => 
      c.projectId === projectId && 
      c.campaignCode.toLowerCase() === trimmedCode.toLowerCase() && 
      c.id !== initialCampaign?.id
    );

    if (isDuplicate) {
      setErrorMsg(`Campaign Code "${trimmedCode}" already exists in this project.`);
      return;
    }

    const now = new Date().toISOString();
    const campaignData: Campaign = {
      id: initialCampaign ? initialCampaign.id : `cmp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      campaignCode: trimmedCode,
      projectId,
      companyId,
      name: trimmedName,
      discipline,
      type,
      chainage: chainage.trim(),
      date,
      linkedPointIds,
      status,
      leadSurveyor: leadSurveyor.trim() || undefined,
      notes: notes.trim() || undefined,
      createdAt: initialCampaign ? initialCampaign.createdAt : now,
      updatedAt: now
    };

    onSave(campaignData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-600 dark:text-amber-500">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-wide">
                {initialCampaign ? "Edit Survey Campaign" : "New Survey Campaign"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {initialCampaign ? `Updating ${initialCampaign.campaignCode}` : "Record a site survey campaign, setting-out, or monitoring run"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-700 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Campaign Code <span className="text-amber-500">*</span>
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="e.g. CMP-2026-001"
                  value={campaignCode}
                  onChange={(e) => setCampaignCode(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Campaign Title / Name <span className="text-amber-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Earthworks Baseline Topo & Grid Setting Out"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Discipline
              </label>
              <select
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value as CampaignDiscipline)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                {DISCIPLINES.map((d, idx) => (
                  <option key={`${d}-${idx}`} value={d} className="bg-white dark:bg-slate-900">{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Campaign Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as CampaignType)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                {CAMPAIGN_TYPES.map((t, idx) => (
                  <option key={`${t}-${idx}`} value={t} className="bg-white dark:bg-slate-900">{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CampaignStatus)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                {CAMPAIGN_STATUSES.map((s, idx) => (
                  <option key={`${s}-${idx}`} value={s} className="bg-white dark:bg-slate-900">{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Chainage / Location
              </label>
              <input
                type="text"
                placeholder="e.g. 0+000 - 1+250"
                value={chainage}
                onChange={(e) => setChainage(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Campaign Date <span className="text-amber-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Lead Surveyor
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. J. van der Merwe (Pr.LS)"
                  value={leadSurveyor}
                  onChange={(e) => setLeadSurveyor(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Link Control Points selection card */}
          <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-850 rounded-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-850 pb-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                <span>Link Control Points from Register ({linkedPointIds.length} selected)</span>
              </div>
              <span className="text-[10px] text-slate-500">
                Select control points referenced in this campaign
              </span>
            </div>

            {controlPoints.length === 0 ? (
              <div className="text-xs text-slate-500 italic p-3 text-center bg-slate-100 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-850">
                No Control Points registered yet. Add Control Points first in the Control Points tab.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                {controlPoints.map(p => {
                  const isSelected = linkedPointIds.includes(p.pointId) || linkedPointIds.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => togglePointSelection(p.pointId)}
                      className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-all ${
                        isSelected 
                          ? "bg-amber-500/10 border-amber-500/50 text-amber-700 dark:text-amber-300"
                          : "bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          isSelected ? "bg-amber-500 border-amber-500 text-slate-950" : "border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950"
                        }`}>
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div className="truncate">
                          <span className="font-bold text-slate-900 dark:text-white mr-1.5">{p.pointId}</span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">({p.type})</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 shrink-0 ml-1">
                        E:{p.easting.toFixed(1)} N:{p.northing.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Campaign Notes & Observations
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Benchmarks CP-101 and CP-102 verified within ±2mm tolerance prior to grid setting out..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-amber-500/10 transition-all cursor-pointer uppercase tracking-wider"
            >
              <Save className="w-4 h-4" />
              <span>{initialCampaign ? "Update Campaign" : "Save Campaign"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
