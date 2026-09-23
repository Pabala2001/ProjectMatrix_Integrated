import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState } from "react";
import { ProjectCalendar } from "../../types/programmeEngine";
import { 
  Calendar, 
  Clock, 
  X, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Sun, 
  AlertCircle,
  Save
} from "lucide-react";

interface ProgrammeCalendarManagerProps {
  calendars: Record<string, ProjectCalendar>;
  isOpen: boolean;
  onClose: () => void;
  onSaveCalendars: (calendars: Record<string, ProjectCalendar>) => void;
}

export const ProgrammeCalendarManager: React.FC<ProgrammeCalendarManagerProps> = ({
  calendars,
  isOpen,
  onClose,
  onSaveCalendars
}) => {
  const [calState, setCalState] = useState<Record<string, ProjectCalendar>>(() => ({ ...calendars }));
  const [selectedCalId, setSelectedCalId] = useState<string>(Object.keys(calendars)[0] || "cal-6day");
  const [newHolidayInput, setNewHolidayInput] = useState("");

  if (!isOpen) return null;

  const currentCal = calState[selectedCalId];

  const handleToggleDay = (dayIndex: number) => {
    if (!currentCal) return;
    const working = currentCal.workingDays.includes(dayIndex)
      ? currentCal.workingDays.filter(d => d !== dayIndex)
      : [...currentCal.workingDays, dayIndex].sort();

    setCalState(prev => ({
      ...prev,
      [selectedCalId]: {
        ...currentCal,
        workingDays: working
      }
    }));
  };

  const handleAddHoliday = () => {
    assertOperationalAction("create", "components/programme/ProgrammeCalendarManager.tsx");
    if (!currentCal || !newHolidayInput) return;
    if (currentCal.holidays.includes(newHolidayInput)) return;

    setCalState(prev => ({
      ...prev,
      [selectedCalId]: {
        ...currentCal,
        holidays: [...currentCal.holidays, newHolidayInput].sort()
      }
    }));
    setNewHolidayInput("");
  };

  const handleRemoveHoliday = (hDate: string) => {
    assertOperationalAction("delete", "components/programme/ProgrammeCalendarManager.tsx");
    if (!currentCal) return;
    setCalState(prev => ({
      ...prev,
      [selectedCalId]: {
        ...currentCal,
        holidays: currentCal.holidays.filter(d => d !== hDate)
      }
    }));
  };

  const handleSave = () => {
    assertOperationalAction("write", "components/programme/ProgrammeCalendarManager.tsx");
    onSaveCalendars(calState);
    onClose();
  };

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/80">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
              Project Working Calendars & Non-Working Exceptions
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 flex flex-col md:flex-row gap-5">
          {/* Calendar List */}
          <div className="w-full md:w-56 space-y-2 shrink-0">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
              Active Calendars
            </span>
            {(Object.values(calState) as ProjectCalendar[]).map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCalId(c.id)}
                className={`w-full text-left p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  selectedCalId === c.id 
                    ? "bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-700 dark:text-blue-300 shadow-xs" 
                    : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-300"
                }`}
              >
                <div>{c.name}</div>
                <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                  {c.workingDays.length} Working Days • {c.hoursPerDay}h/day
                </div>
              </button>
            ))}
          </div>

          {/* Calendar Details */}
          {currentCal && (
            <div className="flex-1 space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    {currentCal.name}
                  </h3>
                  <span className="text-xs font-mono text-blue-600 dark:text-blue-400 font-bold">
                    {currentCal.hoursPerDay} hrs/shift
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {currentCal.description}
                </p>

                {/* Working Days Checkbox Grid */}
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-2">
                    Working Shifts
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {dayNames.map((name, idx) => {
                      const isWorking = currentCal.workingDays.includes(idx);
                      return (
                        <button
                          type="button"
                          key={name}
                          onClick={() => handleToggleDay(idx)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center justify-between cursor-pointer ${
                            isWorking 
                              ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-400 text-emerald-800 dark:text-emerald-300" 
                              : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400"
                          }`}
                        >
                          <span>{name.slice(0, 3)}</span>
                          {isWorking && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Public Holidays & Non-working Exceptions */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                  Public Holidays & Non-Working Shutdowns ({currentCal.holidays.length})
                </span>

                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={newHolidayInput}
                    onChange={(e) => setNewHolidayInput(e.target.value)}
                    className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleAddHoliday}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Add Date
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {currentCal.holidays.map(h => (
                    <span
                      key={h}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300"
                    >
                      <span>{h}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveHoliday(h)}
                        className="text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50/80 dark:bg-slate-800/80">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Apply Calendars</span>
          </button>
        </div>
      </div>
    </div>
  );
};
