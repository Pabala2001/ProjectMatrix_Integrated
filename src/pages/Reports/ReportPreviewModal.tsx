import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect } from "react";
import { X, Download, FileText, Calendar, Building, CheckCircle2, ShieldAlert, Leaf } from "lucide-react";
import { TechnicalReportRecord, ReportFormData } from "./types";
import { supabase } from "../../lib/supabase";
import { generateTechnicalReportDocx } from "./docxGenerator";

interface ReportPreviewModalProps {
  report: TechnicalReportRecord;
  onClose: () => void;
}

export default function ReportPreviewModal({ report, onClose }: ReportPreviewModalProps) {
  const [signedDocxUrl, setSignedDocxUrl] = useState<string | null>(null);
  const [signedImages, setSignedImages] = useState<Record<string, string>>({});
  const [isGeneratingDocx, setIsGeneratingDocx] = useState(false);

  const formData: ReportFormData = report.form_data || ({} as ReportFormData);

  useEffect(() => {
    const fetchSignedUrls = async () => {
      // Document file signed url (PDF, DOCX, etc.)
      const docPath = report.file_path || report.docx_file_path;
      if (docPath) {
        const { data } = await supabase.storage
          .from("reports")
          .createSignedUrl(docPath, 3600);
        if (data?.signedUrl) {
          setSignedDocxUrl(data.signedUrl);
        }
      }

      // Site picture signed urls
      if (formData.site_pictures && formData.site_pictures.length > 0) {
        const imgMap: Record<string, string> = {};
        for (const pic of formData.site_pictures) {
          if (pic.image && !pic.image.startsWith("data:")) {
            const { data } = await supabase.storage
              .from("report-images")
              .createSignedUrl(pic.image, 3600);
            if (data?.signedUrl) {
              imgMap[pic.image] = data.signedUrl;
            }
          }
        }
        setSignedImages(imgMap);
      }
    };

    fetchSignedUrls();
  }, [report]);

  const handleDownloadDocx = async () => {
    assertOperationalAction("export", "pages/Reports/ReportPreviewModal.tsx");
    if (signedDocxUrl) {
      window.open(signedDocxUrl, "_blank");
      return;
    }

    try {
      setIsGeneratingDocx(true);
      const blob = await generateTechnicalReportDocx(formData);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${report.report_number || "Technical_Report"}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error generating report docx:", err);
      alert("Failed to download DOCX report");
    } finally {
      setIsGeneratingDocx(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Modal Top Bar */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="p-2 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <FileText className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {report.title || formData.report_title || "Technical Report"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {report.category} • {report.frequency} • Ref: {report.report_number}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownloadDocx}
              disabled={isGeneratingDocx}
              className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center space-x-1.5"
            >
              <Download className="w-4 h-4" />
              <span>{isGeneratingDocx ? "Generating..." : "Download DOCX"}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Header Metadata Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
            <div>
              <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">Project</span>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{formData.project_name || "-"}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">Contractor</span>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{formData.contractor_name || "-"}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">Date</span>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{report.report_date}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">Status</span>
              <span className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                report.status === "Final" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
              }`}>
                {report.status}
              </span>
            </div>
          </div>

          {/* Overview */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Executive Overview</h4>
            <p className="text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 leading-relaxed">
              {formData.introduction || "No overview recorded."}
            </p>
          </div>

          {/* Weekly Achievements (Weekly Reports) */}
          {report.frequency === "Weekly" && formData.weekly_achievements && formData.weekly_achievements.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Weekly Achievements</h4>
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-2">Task Description</th>
                      <th className="p-2">Location</th>
                      <th className="p-2">Planned Qty</th>
                      <th className="p-2">Actual Qty</th>
                      <th className="p-2">% Done</th>
                      <th className="p-2">Variance Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {formData.weekly_achievements.map((wa) => (
                      <tr key={wa.id}>
                        <td className="p-2 font-medium">{wa.task_description}</td>
                        <td className="p-2">{wa.location_section || "-"}</td>
                        <td className="p-2">{wa.planned_qty} {wa.unit}</td>
                        <td className="p-2">{wa.actual_qty} {wa.unit}</td>
                        <td className="p-2 font-bold">{wa.completion_pct}</td>
                        <td className="p-2">{wa.variance_notes || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Weekly Planned vs Actual Summary */}
          {report.frequency === "Weekly" && formData.planned_vs_actual && (
            <div className="p-3 rounded-xl bg-blue-50/40 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">Weekly Schedule & Progress Status</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-[10px] text-slate-500">Weekly Planned</span>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{formData.planned_vs_actual.planned_pct}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500">Weekly Actual</span>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{formData.planned_vs_actual.actual_pct}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500">Cumulative Planned</span>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{formData.planned_vs_actual.cumulative_planned_pct}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500">Cumulative Actual</span>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{formData.planned_vs_actual.cumulative_actual_pct}</p>
                </div>
              </div>
              {formData.planned_vs_actual.summary_notes && (
                <p className="text-[11px] text-slate-600 dark:text-slate-400 pt-1 border-t border-blue-100 dark:border-blue-900/30">
                  {formData.planned_vs_actual.summary_notes}
                </p>
              )}
            </div>
          )}

          {/* Monthly Progress Summary & SPI */}
          {report.frequency === "Monthly" && formData.monthly_progress_summary && (
            <div className="p-3 rounded-xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">Monthly Performance & Schedule Index</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-[10px] text-slate-500">Monthly Planned</span>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{formData.monthly_progress_summary.monthly_planned_pct}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500">Monthly Actual</span>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{formData.monthly_progress_summary.monthly_actual_pct}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500">SPI Index</span>
                  <p className="text-xs font-bold text-emerald-600">{formData.monthly_progress_summary.spi_index || "1.00"}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500">Schedule Status</span>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{formData.monthly_progress_summary.progress_status || "On Track"}</p>
                </div>
              </div>
            </div>
          )}

          {/* Monthly Milestones */}
          {report.frequency === "Monthly" && formData.monthly_milestones && formData.monthly_milestones.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Monthly Key Milestones</h4>
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-2">Milestone Name</th>
                      <th className="p-2">Target Date</th>
                      <th className="p-2">Status</th>
                      <th className="p-2">% Complete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {formData.monthly_milestones.map((m) => (
                      <tr key={m.id}>
                        <td className="p-2 font-medium">{m.milestone_name}</td>
                        <td className="p-2">{m.target_date || "-"}</td>
                        <td className="p-2 font-semibold">{m.status}</td>
                        <td className="p-2 font-bold">{m.completion_pct}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Major Risks & Delays (Monthly) */}
          {report.frequency === "Monthly" && formData.major_risks_and_delays && formData.major_risks_and_delays.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-500">Major Risks & Delays Log</h4>
              <div className="border border-rose-200 dark:border-rose-900/40 rounded-xl overflow-hidden bg-rose-50/20">
                <table className="w-full text-xs text-left">
                  <thead className="bg-rose-100/50 dark:bg-rose-950/40 text-slate-700 dark:text-slate-300 font-semibold">
                    <tr>
                      <th className="p-2">Risk / Delay Description</th>
                      <th className="p-2">Impact</th>
                      <th className="p-2">Mitigation Action</th>
                      <th className="p-2">Owner</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rose-200/50 dark:divide-rose-900/40 text-slate-700 dark:text-slate-300">
                    {formData.major_risks_and_delays.map((r) => (
                      <tr key={r.id}>
                        <td className="p-2 font-medium">{r.risk_description}</td>
                        <td className="p-2 font-bold text-rose-600">{r.impact_level}</td>
                        <td className="p-2">{r.mitigation_action}</td>
                        <td className="p-2">{r.owner}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Environmental Metrics if Category is Environmental */}
          {report.category === "Environmental" && formData.environmental_metrics && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 flex items-center space-x-1">
                <Leaf className="w-3.5 h-3.5" />
                <span>Environmental Compliance Metrics</span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                <div>
                  <span className="text-[10px] text-slate-500">Waste Disposed</span>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{formData.environmental_metrics.waste_disposed_kg || "0"} kg</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500">Water Consumption</span>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{formData.environmental_metrics.water_consumption_litres || "0"} L</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500">Air Quality</span>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{formData.environmental_metrics.air_quality_status || "Compliant"}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500">Noise Level</span>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{formData.environmental_metrics.noise_level_status || "Compliant"}</p>
                </div>
              </div>
            </div>
          )}

          {/* OHS Metrics if Category is Occupational Health and Safety */}
          {report.category === "Occupational Health and Safety" && formData.ohs_metrics && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center space-x-1">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>OHS & Safety Statistics</span>
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-xl border border-blue-100 dark:border-blue-900/40">
                <div>
                  <span className="text-[10px] text-slate-500">Safe Man Hours</span>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{formData.ohs_metrics.safe_man_hours || "0"}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500">PPE Compliance</span>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{formData.ohs_metrics.ppe_compliance_pct || "100%"}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500">Near Misses</span>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{formData.ohs_metrics.near_misses_count || "0"}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500">First Aid Incidents</span>
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{formData.ohs_metrics.first_aid_incidents || "0"}</p>
                </div>
              </div>
            </div>
          )}

          {/* Technical Activities Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Technical Activities</h4>
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-2.5">Activity Description</th>
                    <th className="p-2.5">Quantity</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {formData.technical_activities && formData.technical_activities.length > 0 ? (
                    formData.technical_activities.map((act) => (
                      <tr key={act.id}>
                        <td className="p-2.5">{act.description}</td>
                        <td className="p-2.5">{act.quantity}</td>
                        <td className="p-2.5">{act.status || "Ongoing"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="p-3 text-center text-slate-400 italic">No activities listed.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Site Pictures */}
          {formData.site_pictures && formData.site_pictures.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Site Pictures</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {formData.site_pictures.map((pic, idx) => {
                  const imgUrl = pic.image?.startsWith("data:") ? pic.image : signedImages[pic.image];
                  return (
                    <div key={idx} className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-800/40">
                      <div className="h-28 bg-slate-200 dark:bg-slate-700 overflow-hidden flex items-center justify-center">
                        {imgUrl ? (
                          <img src={imgUrl} alt="Site" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] text-slate-400">Photo Attached</span>
                        )}
                      </div>
                      <div className="p-2 text-[11px] text-slate-600 dark:text-slate-300 truncate">
                        {pic.caption || "Photograph"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Document Control Sign-off */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Document Control & Approval</h4>
            <div className="grid grid-cols-2 gap-4 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
              <div>
                <span className="text-[10px] text-slate-400 block">Prepared By</span>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {formData.doc_control?.prepared_print_name || formData.doc_control?.prepared_by || "Site Engineer"}
                </p>
                <span className="text-[10px] text-slate-500">{formData.doc_control?.prepared_title || "Engineer"}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Reviewed By</span>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {formData.doc_control?.reviewed_print_name || formData.doc_control?.reviewed_by || "Project Manager"}
                </p>
                <span className="text-[10px] text-slate-500">{formData.doc_control?.reviewed_title || "Manager"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
