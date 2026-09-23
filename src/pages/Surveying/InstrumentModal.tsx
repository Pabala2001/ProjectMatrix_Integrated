import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect } from "react";
import { X, Save, AlertCircle, Wrench, Calendar, Hash, ShieldCheck } from "lucide-react";
import { Instrument, InstrumentType, InstrumentStatus, getCalibrationState } from "../../types/surveying";

interface InstrumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (instrument: Instrument) => void;
  initialInstrument?: Instrument | null;
  existingInstruments: Instrument[];
  projectId: string;
  companyId: string;
}

const INSTRUMENT_TYPES: InstrumentType[] = [
  "Total Station",
  "GPS/GNSS Receiver",
  "Digital Level",
  "Drone / LiDAR",
  "Optical Level",
  "Laser Scanner"
];

const INSTRUMENT_STATUSES: InstrumentStatus[] = [
  "In Service",
  "In Calibration",
  "Out of Service",
  "Retired",
  "Archived"
];

export default function InstrumentModal({
  isOpen,
  onClose,
  onSave,
  initialInstrument,
  existingInstruments,
  projectId,
  companyId
}: InstrumentModalProps) {
  const [instrumentId, setInstrumentId] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<InstrumentType>("Total Station");
  const [manufacturer, setManufacturer] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [calibrationDate, setCalibrationDate] = useState("");
  const [calibrationExpiryDate, setCalibrationExpiryDate] = useState("");
  const [status, setStatus] = useState<InstrumentStatus>("In Service");
  const [notes, setNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialInstrument) {
      setInstrumentId(initialInstrument.instrumentId);
      setName(initialInstrument.name);
      setType(initialInstrument.type);
      setManufacturer(initialInstrument.manufacturer);
      setSerialNumber(initialInstrument.serialNumber);
      setCalibrationDate(initialInstrument.calibrationDate || "");
      setCalibrationExpiryDate(initialInstrument.calibrationExpiryDate || "");
      setStatus(initialInstrument.status);
      setNotes(initialInstrument.notes || "");
    } else {
      setInstrumentId("");
      setName("");
      setType("Total Station");
      setManufacturer("");
      setSerialNumber("");
      
      const today = new Date().toISOString().split("T")[0];
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      const expiryStr = nextYear.toISOString().split("T")[0];

      setCalibrationDate(today);
      setCalibrationExpiryDate(expiryStr);
      setStatus("In Service");
      setNotes("");
    }
    setErrorMsg(null);
  }, [initialInstrument, isOpen]);

  if (!isOpen) return null;

  const calState = getCalibrationState(calibrationExpiryDate);

  const handleSubmit = (e: React.FormEvent) => {
    assertOperationalAction("write", "pages/Surveying/InstrumentModal.tsx");
    e.preventDefault();
    setErrorMsg(null);

    const trimmedId = instrumentId.trim();
    const trimmedName = name.trim();
    const trimmedMfg = manufacturer.trim();
    const trimmedSerial = serialNumber.trim();

    if (!trimmedId) {
      setErrorMsg("Instrument ID is required.");
      return;
    }

    if (!trimmedName) {
      setErrorMsg("Instrument Name is required.");
      return;
    }

    if (!trimmedMfg) {
      setErrorMsg("Manufacturer is required.");
      return;
    }

    if (!trimmedSerial) {
      setErrorMsg("Serial Number is required.");
      return;
    }

    // Check duplicate ID
    const isDuplicate = existingInstruments.some(i => 
      i.projectId === projectId && 
      i.instrumentId.toLowerCase() === trimmedId.toLowerCase() && 
      i.id !== initialInstrument?.id
    );

    if (isDuplicate) {
      setErrorMsg(`Instrument ID "${trimmedId}" already exists in this project.`);
      return;
    }

    const now = new Date().toISOString();
    const instrumentData: Instrument = {
      id: initialInstrument ? initialInstrument.id : `inst-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      instrumentId: trimmedId,
      projectId,
      companyId,
      name: trimmedName,
      type,
      manufacturer: trimmedMfg,
      serialNumber: trimmedSerial,
      calibrationDate,
      calibrationExpiryDate,
      status,
      notes: notes.trim() || undefined,
      createdAt: initialInstrument ? initialInstrument.createdAt : now,
      updatedAt: now
    };

    onSave(instrumentData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-600 dark:text-amber-500">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-wide">
                {initialInstrument ? "Edit Survey Instrument" : "New Survey Instrument"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {initialInstrument ? `Updating ${initialInstrument.instrumentId}` : "Register a new total station, GPS, or optical level"}
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
                Instrument ID <span className="text-amber-500">*</span>
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="e.g. INST-001"
                  value={instrumentId}
                  onChange={(e) => setInstrumentId(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Instrument Name <span className="text-amber-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Leica TS16 1'' Robotic Total Station"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Instrument Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as InstrumentType)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                {INSTRUMENT_TYPES.map(t => (
                  <option key={t} value={t} className="bg-white dark:bg-slate-900">{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Manufacturer <span className="text-amber-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Leica Geosystems"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Serial Number <span className="text-amber-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. SN-8849201"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-mono text-xs placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-850 rounded-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-850 pb-2">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                <span>Calibration Details & Status</span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                calState === "Valid" 
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : calState === "Approaching Expiry"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse"
                    : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 animate-pulse"
              }`}>
                {calState}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Last Calibration Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    required
                    value={calibrationDate}
                    onChange={(e) => setCalibrationDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Calibration Expiry Date <span className="text-amber-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    required
                    value={calibrationExpiryDate}
                    onChange={(e) => setCalibrationExpiryDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white text-xs focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Operational Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as InstrumentStatus)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                {INSTRUMENT_STATUSES.map(s => (
                  <option key={s} value={s} className="bg-white dark:bg-slate-900">{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Notes / Accessories
              </label>
              <input
                type="text"
                placeholder="e.g. Includes dual battery pack & heavy tripod"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
            </div>
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
              <span>{initialInstrument ? "Update Instrument" : "Save Instrument"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
