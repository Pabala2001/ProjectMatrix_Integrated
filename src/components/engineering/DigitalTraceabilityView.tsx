import React, { useState } from "react";
import { motion } from "motion/react";
import {
  GitCommit,
  ArrowRight,
  CheckCircle2,
  FileText,
  ShieldCheck,
  Building,
  Check,
  Search,
  ExternalLink,
  Layers,
  Sparkles,
  Award,
  AlertCircle,
  HelpCircle
} from "lucide-react";
import { DigitalTraceabilityItem } from "../../types/engineering";

interface DigitalTraceabilityViewProps {
  traceabilityItems: DigitalTraceabilityItem[];
}

export default function DigitalTraceabilityView({
  traceabilityItems
}: DigitalTraceabilityViewProps) {
  const [selectedItem, setSelectedItem] = useState<DigitalTraceabilityItem>(traceabilityItems[0]);

  const stages = [
    { key: "drawing", label: "1. Drawing", icon: FileText, getVal: (item: DigitalTraceabilityItem) => item.drawingRef, getRev: (item: DigitalTraceabilityItem) => item.drawingRevision, color: "blue" },
    { key: "spec", label: "2. Specification", icon: ShieldCheck, getVal: (item: DigitalTraceabilityItem) => item.specificationRef, getRev: () => "", color: "indigo" },
    { key: "ms", label: "3. Method Statement", icon: Layers, getVal: (item: DigitalTraceabilityItem) => item.methodStatementRef, getRev: () => "", color: "purple" },
    { key: "itp", label: "4. ITP (Quality)", icon: CheckCircle2, getVal: (item: DigitalTraceabilityItem) => item.itpRef, getRev: () => "HSEQ Linked", color: "emerald" },
    { key: "ir", label: "5. Inspection Request", icon: Check, getVal: (item: DigitalTraceabilityItem) => item.inspectionRequestRef, getRev: () => "Approved", color: "emerald" },
    { key: "cube", label: "6. Cube / Lab Test", icon: Award, getVal: (item: DigitalTraceabilityItem) => item.cubeTestRef || "N/A", getRev: () => "Passed (42.5 MPa)", color: "cyan" },
    { key: "asbuilt", label: "7. As-Built Survey", icon: GitCommit, getVal: (item: DigitalTraceabilityItem) => item.asBuiltSurveyRef, getRev: () => "Verified within ±5mm", color: "emerald" },
  ];

  return (
    <div className="space-y-4">
      {/* Principle Clarification Banner */}
      <div className="p-4 bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white rounded-2xl border border-blue-800/60 shadow-md">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">
                Digital Traceability Chain: Engineering → Quality → As-Built
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                <strong>Core System Principle:</strong> Engineering defines the technical requirements (Drawings & Specs); Quality (HSEQ) demonstrates compliance via ITPs & Lab Tests.
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-block px-3 py-1 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-full text-[11px] font-mono font-bold">
            100% Chain-of-Custody
          </span>
        </div>
      </div>

      {/* Selector of Work Elements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {traceabilityItems.map(item => (
          <div
            key={item.id}
            onClick={() => setSelectedItem(item)}
            className={`p-4 rounded-xl border transition-all cursor-pointer select-none ${
              selectedItem.id === item.id
                ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-400 dark:border-blue-700 shadow-xs"
                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400">
                {item.elementRef}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200">
                {item.status.replace("_", " ")}
              </span>
            </div>
            <h4 className="font-bold text-xs text-slate-900 dark:text-white mt-1">
              {item.elementName}
            </h4>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Location: {item.location}</span>
              <span>Discipline: <strong className="capitalize">{item.discipline}</strong></span>
            </div>
          </div>
        ))}
      </div>

      {/* Interactive Visual Traceability Stepper */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              Traceability Stepper for: <span className="text-blue-600 dark:text-blue-400 font-mono">{selectedItem.elementRef}</span> - {selectedItem.elementName}
            </h4>
            <p className="text-xs text-slate-500">
              End-to-end evidence loop from design inception to permanent handover.
            </p>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Fully Handover Compliant</span>
          </div>
        </div>

        {/* Stepper Flow */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
          {stages.map((stage, idx) => {
            const Icon = stage.icon;
            const val = stage.getVal(selectedItem);
            const sub = stage.getRev(selectedItem);

            return (
              <div
                key={stage.key}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[10px] font-bold uppercase">{stage.label}</span>
                    <Icon className="w-3.5 h-3.5 text-blue-500" />
                  </div>
                  <div className="font-mono font-bold text-xs text-slate-900 dark:text-white mt-1.5 break-all">
                    {val}
                  </div>
                </div>

                {sub && (
                  <div className="mt-2 pt-1.5 border-t border-slate-200 dark:border-slate-800 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Check className="w-3 h-3 stroke-[3]" />
                    <span>{sub}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary Details */}
        <div className="p-4 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Engineering Technical Baseline</span>
            <p className="mt-1 text-slate-800 dark:text-slate-200">
              Drawings: <strong>{selectedItem.drawingRef} {selectedItem.drawingRevision}</strong> • Spec: {selectedItem.specificationRef}
            </p>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Quality Verification (HSEQ)</span>
            <p className="mt-1 text-slate-800 dark:text-slate-200">
              ITP Checklist: <strong>{selectedItem.itpRef}</strong> • Inspection: {selectedItem.inspectionRequestRef}
            </p>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase">As-Built Survey & Tolerances</span>
            <p className="mt-1 text-slate-800 dark:text-slate-200">
              Survey Certificate: <strong>{selectedItem.asBuiltSurveyRef}</strong> • All coordinates within ±5mm
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
