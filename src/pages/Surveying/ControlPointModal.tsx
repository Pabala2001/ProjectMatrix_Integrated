import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect } from "react";
import { X, Save, AlertCircle, MapPin, Hash, Layers, Compass } from "lucide-react";
import { ControlPoint, ControlPointType, ControlPointStatus } from "../../types/surveying";

interface ControlPointModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (point: ControlPoint) => void;
  initialPoint?: ControlPoint | null;
  existingPoints: ControlPoint[];
  projectId: string;
  companyId: string;
}

const CONTROL_POINT_TYPES: ControlPointType[] = [
  "Benchmark",
  "Traverse Station",
  "Monitoring Point",
  "Boundary Peg",
  "Control Pillar",
  "GPS Station"
];

const CONTROL_POINT_STATUSES: ControlPointStatus[] = [
  "Active",
  "Compromised",
  "Destroyed",
  "Pending Verification",
  "Archived"
];

export default function ControlPointModal({
  isOpen,
  onClose,
  onSave,
  initialPoint,
  existingPoints,
  projectId,
  companyId
}: ControlPointModalProps) {
  const [pointId, setPointId] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<ControlPointType>("Benchmark");
  const [easting, setEasting] = useState("");
  const [northing, setNorthing] = useState("");
  const [elevation, setElevation] = useState("");
  const [status, setStatus] = useState<ControlPointStatus>("Active");
  const [notes, setNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialPoint) {
      setPointId(initialPoint.pointId);
      setName(initialPoint.name);
      setType(initialPoint.type);
      setEasting(initialPoint.easting.toString());
      setNorthing(initialPoint.northing.toString());
      setElevation(initialPoint.elevation.toString());
      setStatus(initialPoint.status);
      setNotes(initialPoint.notes || "");
    } else {
      setPointId("");
      setName("");
      setType("Benchmark");
      setEasting("");
      setNorthing("");
      setElevation("");
      setStatus("Active");
      setNotes("");
    }
    setErrorMsg(null);
  }, [initialPoint, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    assertOperationalAction("write", "pages/Surveying/ControlPointModal.tsx");
    e.preventDefault();
    setErrorMsg(null);

    const trimmedPointId = pointId.trim();
    const trimmedName = name.trim();

    if (!trimmedPointId) {
      setErrorMsg("Point ID is required.");
      return;
    }

    if (!trimmedName) {
      setErrorMsg("Control Point Name is required.");
      return;
    }

    // Check duplicate Point ID within active project
    const isDuplicate = existingPoints.some(p => 
      p.projectId === projectId && 
      p.pointId.toLowerCase() === trimmedPointId.toLowerCase() && 
      p.id !== initialPoint?.id
    );

    if (isDuplicate) {
      setErrorMsg(`Point ID "${trimmedPointId}" already exists in this project.`);
      return;
    }

    const numEasting = parseFloat(easting);
    if (isNaN(numEasting)) {
      setErrorMsg("Easting must be a valid numeric decimal value.");
      return;
    }

    const numNorthing = parseFloat(northing);
    if (isNaN(numNorthing)) {
      setErrorMsg("Northing must be a valid numeric decimal value.");
      return;
    }

    const numElevation = parseFloat(elevation);
    if (isNaN(numElevation)) {
      setErrorMsg("Elevation must be a valid numeric decimal value.");
      return;
    }

    const now = new Date().toISOString();
    const pointData: ControlPoint = {
      id: initialPoint ? initialPoint.id : `cp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      pointId: trimmedPointId,
      projectId,
      companyId,
      name: trimmedName,
      type,
      easting: numEasting,
      northing: numNorthing,
      elevation: numElevation,
      status,
      notes: notes.trim() || undefined,
      createdAt: initialPoint ? initialPoint.createdAt : now,
      updatedAt: now
    };

    onSave(pointData);
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
                {initialPoint ? "Edit Control Point" : "New Control Point"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {initialPoint ? `Updating ${initialPoint.pointId}` : "Add a new survey control point reference"}
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
                Point ID <span className="text-amber-500">*</span>
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="e.g. CP-101"
                  value={pointId}
                  onChange={(e) => setPointId(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Control Point Name <span className="text-amber-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Site Primary Benchmark North"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Point Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ControlPointType)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                {CONTROL_POINT_TYPES.map(t => (
                  <option key={t} value={t} className="bg-white dark:bg-slate-900">{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ControlPointStatus)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                {CONTROL_POINT_STATUSES.map(s => (
                  <option key={s} value={s} className="bg-white dark:bg-slate-900">{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-850 rounded-xl space-y-3">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 border-b border-slate-200 dark:border-slate-850 pb-2">
              <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-500" />
              <span>Spatial Coordinates (Decimal)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Easting (X) <span className="text-amber-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 28045.123"
                  value={easting}
                  onChange={(e) => setEasting(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Northing (Y) <span className="text-amber-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 54321.987"
                  value={northing}
                  onChange={(e) => setNorthing(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Elevation (Z - m) <span className="text-amber-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="e.g. 1520.450"
                  value={elevation}
                  onChange={(e) => setElevation(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Notes / Remarks
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Brass peg set in concrete monument near Chainage 0+450..."
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
              <span>{initialPoint ? "Update Control Point" : "Save Control Point"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
