import { ReportFormData, ReportCategory, ReportFrequency } from "./types";

export function getInitialReportFormData(
  projectName: string,
  companyName: string,
  contractNumber: string,
  category: ReportCategory = "Progress",
  frequency: ReportFrequency = "Daily"
): ReportFormData {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const dateParts = today.split("-");
  const yearStr = dateParts[0];
  const monthStr = dateParts[1];
  const dayStr = dateParts[2];

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const currentMonthName = monthNames[now.getMonth()] || "July";

  // Calculate 6 days ago for week start
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);
  const weekStartStr = weekStart.toISOString().split("T")[0];

  // Calculate first day of month
  const firstDayOfMonthStr = `${yearStr}-${monthStr}-01`;

  const categoryPrefix = category === "Progress" ? "PRG" : category === "Environmental" ? "ENV" : "OHS";
  const frequencyPrefix = frequency === "Daily" ? "D" : frequency === "Weekly" ? "W" : "M";

  let reportNum = `${categoryPrefix}-${frequencyPrefix}-${yearStr}${monthStr}${dayStr}-01`;
  if (frequency === "Weekly") {
    reportNum = `${categoryPrefix}-W-${yearStr}-WK${Math.ceil(now.getDate() / 7)}-01`;
  } else if (frequency === "Monthly") {
    reportNum = `${categoryPrefix}-M-${yearStr}${monthStr}-01`;
  }

  const baseFormData: ReportFormData = {
    client_name: "Client Representative",
    contractor_name: companyName || "Contractor Name",
    project_name: projectName || "Project Name",
    contract_number: contractNumber || "CONTRACT-001",
    report_title: `${category} ${frequency} Report`,
    report_number: reportNum,
    report_date: today,
    period_start_date: frequency === "Weekly" ? weekStartStr : frequency === "Monthly" ? firstDayOfMonthStr : today,
    period_end_date: today,
    report_month: currentMonthName,
    report_year: now.getFullYear(),
    category,
    frequency,
    company_logo: "",
    client_logo: "",
    doc_control: {
      revision_number: "00",
      revision_date: today,
      prepared_by: "Site Manager",
      reviewed_by: "Project Manager",
      approved_by: "Client Representative",
      prepared_print_name: "",
      prepared_title: "Site Engineer",
      prepared_date: today,
      reviewed_print_name: "",
      reviewed_title: "Project Manager",
      reviewed_date: today,
    },
    introduction: frequency === "Daily"
      ? `Daily report detailing site operations, supervision, and progress metrics for ${projectName || "the project"} on ${today}.`
      : frequency === "Weekly"
      ? `Weekly progress report summarizing physical achievements, planned versus actual progress, and resource utilization for the period ${weekStartStr} to ${today}.`
      : `Executive monthly progress report providing a comprehensive appraisal of physical progress, key milestones, financial/schedule performance, resource allocation, and risk management for ${currentMonthName} ${yearStr}.`,
    project_team: [
      { role: "Contractor Representative", organization: companyName || "Contractor", designation: "Project Manager", name: "Project Lead" },
      { role: "Site Supervisor", organization: companyName || "Contractor", designation: "Supervisor", name: "Site Engineer" },
    ],
    scope_of_work: [
      { id: "s-1", text: "Site mobilization, earthworks, structural erection, and quality inspections." },
    ],
    programme_progress: {
      overall_percentage: "0%",
      summary_notes: "Works progressing according to scheduled milestones.",
      current_items: [
        { id: "cp-1", text: "Earthworks and foundation preparation" },
      ],
      completed_items: [],
    },

    // Daily Activities
    technical_activities: [
      { id: "act-1", description: "General site setup, survey alignment, and material staging.", quantity: "1", unit: "Lot", status: "Ongoing", challenges: "None" },
    ],

    // Weekly Achievements
    weekly_achievements: [
      { id: "wa-1", task_description: "Excavation and foundation compaction", location_section: "Section A", planned_qty: "120", actual_qty: "115", unit: "m3", completion_pct: "95%", variance_notes: "Minor delay due to soil moisture" },
      { id: "wa-2", task_description: "Reinforcement steel placement", location_section: "Section B", planned_qty: "15", actual_qty: "15", unit: "Tons", completion_pct: "100%", variance_notes: "On schedule" }
    ],
    planned_vs_actual: {
      planned_pct: "10%",
      actual_pct: "9.5%",
      variance_pct: "-0.5%",
      cumulative_planned_pct: "45%",
      cumulative_actual_pct: "44%",
      summary_notes: "Weekly performance aligned with overall programme schedule."
    },

    // Monthly Progress & Milestones
    monthly_progress_summary: {
      monthly_planned_pct: "25%",
      monthly_actual_pct: "23%",
      cumulative_planned_pct: "65%",
      cumulative_actual_pct: "62%",
      spi_index: "0.95",
      progress_status: "On Track",
      summary_notes: "Monthly execution maintained strong momentum across all active work fronts."
    },
    monthly_milestones: [
      { id: "m-1", milestone_name: "Substructure Concrete Pours", target_date: today, status: "Achieved", completion_pct: "100%" },
      { id: "m-2", milestone_name: "Superstructure Steel Erection", target_date: today, status: "Ongoing", completion_pct: "60%" }
    ],
    planned_vs_actual_performance: [
      { id: "pa-1", key_deliverable: "Concrete Volume Poured", planned_target: "450 m3", actual_achieved: "420 m3", variance_explanation: "Rain interruptions in week 2" }
    ],
    monthly_resource_summary: {
      total_man_hours: "1280",
      peak_personnel: "28",
      key_plant_deployed: "2 Excavators, 1 TLB, 3 Tipper Trucks, 1 Crane",
      total_fuel_consumed: "3600 Litres",
      notes: "Plant availability averaged 96% throughout the month."
    },
    major_risks_and_delays: [
      { id: "rd-1", risk_description: "Inclement weather and heavy rainfall impacting earthworks", impact_level: "Medium", mitigation_action: "De-watering pumps deployed; extended weekday shifts", owner: "Site Manager" }
    ],

    // Common Resources
    plant_on_site: [
      { id: "p-1", item: "Excavator 20T", quantity: "1", notes: "Operational" },
      { id: "p-2", item: "TLB 4x4", quantity: "1", notes: "Operational" },
    ],
    fuel_used: [],
    personnel_on_site: [
      { id: "per-1", personnel: "Site Supervisor", quantity: "1" },
      { id: "per-2", personnel: "General Artisans & Laborers", quantity: "8" },
      { id: "per-3", personnel: "Safety Officer", quantity: "1" },
    ],
    site_pictures: [],
    next_work_plan: [
      { id: "np-1", text: frequency === "Daily" ? "Continue planned site activities according to daily schedule." : frequency === "Weekly" ? "Proceed with next week planned milestone activities." : "Execute upcoming monthly planned deliverables and concrete works." },
    ],
    challenges: [
      { id: "c-1", text: "None recorded for this reporting period." },
    ],

    environmental_metrics: {
      waste_disposed_kg: "0",
      water_consumption_litres: "0",
      spill_incidents_count: "0",
      air_quality_status: "Compliant",
      noise_level_status: "Compliant",
      environmental_notes: "No environmental non-conformances identified during site inspection.",
    },
    ohs_metrics: {
      safe_man_hours: frequency === "Daily" ? "80" : frequency === "Weekly" ? "480" : "1920",
      near_misses_count: "0",
      first_aid_incidents: "0",
      lost_time_injuries: "0",
      toolbox_talk_topic: "Site Safety Briefing, Heat Stress & PPE Checks",
      ppe_compliance_pct: "100%",
      ohs_notes: "All personnel on site fully equipped with mandatory PPE.",
    }
  };

  return baseFormData;
}
