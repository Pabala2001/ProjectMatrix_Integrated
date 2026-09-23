import React from "react";
import { X, Compass, Wrench, MapPin, Calendar, Hash, ShieldCheck, Tag, Info, User, Layers } from "lucide-react";
import { ControlPoint, Instrument, Campaign, getCalibrationState } from "../../types/surveying";

type ViewItem = 
  | { type: "point"; data: ControlPoint }
  | { type: "instrument"; data: Instrument }
  | { type: "campaign"; data: Campaign };

interface ViewDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ViewItem | null;
  allControlPoints?: ControlPoint[];
}

export default function ViewDetailsModal({
  isOpen,
  onClose,
  item,
  allControlPoints = []
}: ViewDetailsModalProps) {
  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-600 dark:text-amber-500">
              {item.type === "point" && <Compass className="w-5 h-5" />}
              {item.type === "instrument" && <Wrench className="w-5 h-5" />}
              {item.type === "campaign" && <Layers className="w-5 h-5" />}
            </div>
            <div>
              <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">
                {item.type === "point" && "Control Point Details"}
                {item.type === "instrument" && "Survey Instrument Details"}
                {item.type === "campaign" && "Survey Campaign Details"}
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-wide">
                {item.type === "point" && `${item.data.pointId} — ${item.data.name}`}
                {item.type === "instrument" && `${item.data.instrumentId} — ${item.data.name}`}
                {item.type === "campaign" && `${item.data.campaignCode} — ${item.data.name}`}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          
          {/* CONTROL POINT DETAILS */}
          {item.type === "point" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-850 rounded-xl">
                <div>
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Point ID</span>
                  <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 mt-0.5 block">{item.data.pointId}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Type</span>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">{item.data.type}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Status</span>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                    {item.data.status}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Created Date</span>
                  <span className="text-xs text-slate-700 dark:text-slate-300 mt-0.5 block">{new Date(item.data.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-850 rounded-xl space-y-3">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2 border-b border-slate-200 dark:border-slate-850 pb-2">
                  <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                  <span>Geodetic / Spatial Coordinates</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block">Easting (X)</span>
                    <span className="text-sm font-mono font-bold text-slate-900 dark:text-white mt-1 block">{item.data.easting.toFixed(3)}</span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block">Northing (Y)</span>
                    <span className="text-sm font-mono font-bold text-slate-900 dark:text-white mt-1 block">{item.data.northing.toFixed(3)}</span>
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block">Elevation (Z)</span>
                    <span className="text-sm font-mono font-bold text-amber-600 dark:text-amber-400 mt-1 block">{item.data.elevation.toFixed(3)} m</span>
                  </div>
                </div>
              </div>

              {item.data.notes && (
                <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Notes & Remarks</span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{item.data.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* INSTRUMENT DETAILS */}
          {item.type === "instrument" && (() => {
            const calState = getCalibrationState(item.data.calibrationExpiryDate);
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-850 rounded-xl">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-500 uppercase">ID</span>
                    <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 mt-0.5 block">{item.data.instrumentId}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-500 uppercase">Manufacturer</span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">{item.data.manufacturer}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-500 uppercase">Serial Number</span>
                    <span className="text-xs font-mono text-slate-700 dark:text-slate-300 mt-0.5 block">{item.data.serialNumber}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-500 uppercase">Status</span>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                      {item.data.status}
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-850 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-850 pb-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                      <span>Calibration Certification</span>
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      calState === "Valid" 
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                        : calState === "Approaching Expiry"
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                          : "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20"
                    }`}>
                      {calState}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block">Calibration Date</span>
                      <span className="text-xs font-mono font-bold text-slate-900 dark:text-white mt-1 block">{item.data.calibrationDate || "N/A"}</span>
                    </div>
                    <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block">Calibration Expiry</span>
                      <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 mt-1 block">{item.data.calibrationExpiryDate || "N/A"}</span>
                    </div>
                  </div>
                </div>

                {item.data.notes && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Notes & Accessories</span>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{item.data.notes}</p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* CAMPAIGN DETAILS */}
          {item.type === "campaign" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-850 rounded-xl">
                <div>
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Campaign Code</span>
                  <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 mt-0.5 block">{item.data.campaignCode}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Discipline</span>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">{item.data.discipline}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Type</span>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5 block">{item.data.type}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Status</span>
                  <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                    {item.data.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850 rounded-xl">
                <div>
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Campaign Date</span>
                  <span className="text-xs font-medium text-slate-900 dark:text-white mt-0.5 block">{item.data.date}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Chainage</span>
                  <span className="text-xs font-medium text-slate-900 dark:text-white mt-0.5 block">{item.data.chainage || "General Site"}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Lead Surveyor</span>
                  <span className="text-xs font-medium text-slate-900 dark:text-white mt-0.5 block">{item.data.leadSurveyor || "Unspecified"}</span>
                </div>
              </div>

              {/* Linked Control Points List */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-850 rounded-xl space-y-3">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between border-b border-slate-200 dark:border-slate-850 pb-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                    <span>Linked Control Points ({item.data.linkedPointIds?.length || 0})</span>
                  </div>
                </div>

                {(!item.data.linkedPointIds || item.data.linkedPointIds.length === 0) ? (
                  <div className="text-xs text-slate-500 italic">No control points linked to this campaign.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {item.data.linkedPointIds.map(pid => {
                      const matched = allControlPoints.find(p => p.pointId === pid || p.id === pid);
                      return (
                        <div key={pid} className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                          <div className="flex items-center justify-between font-bold text-amber-600 dark:text-amber-400">
                            <span>{matched ? matched.pointId : pid}</span>
                            {matched && <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">{matched.type}</span>}
                          </div>
                          {matched && (
                            <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1 flex gap-2">
                              <span>E: {matched.easting.toFixed(2)}</span>
                              <span>N: {matched.northing.toFixed(2)}</span>
                              <span>Z: {matched.elevation.toFixed(2)}m</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {item.data.notes && (
                <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-850 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Campaign Observations</span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{item.data.notes}</p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-bold text-xs rounded-xl transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
