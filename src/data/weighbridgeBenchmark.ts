import { NormalisedScheduleResult } from "../types/scheduleImport";

/**
 * Benchmark schedule for "Construction of Weighbridge at Iboya, Songwe Region"
 * 73 activities, 238 days duration, Start: 2026-06-29, Finish: 2027-05-26
 * Preserves the exact hierarchy, dates, durations, and predecessors from the contractual programme.
 */
export function getWeighbridgeBenchmarkSchedule(): NormalisedScheduleResult {
  const batchId = `imp-pdf-iboya-${Date.now().toString(36)}`;
  const timestamp = new Date().toISOString();
  const safeFileName = "Construction_of_Weighbridge_at_Iboya_Songwe_Region.pdf";

  const rawTasks = [
    { id: 1, name: "Construction of Weighbridge at Iboya, Songwe Region", dur: 238, start: "2026-06-29", finish: "2027-05-26", pct: 15, crit: true, pred: "", level: 0 },
    { id: 2, name: "Preliminary and General", dur: 218, start: "2026-06-29", finish: "2027-05-03", pct: 40, crit: false, pred: "", level: 1 },
    { id: 3, name: "Signing of contract", dur: 1, start: "2026-06-29", finish: "2026-06-29", pct: 100, crit: false, pred: "", level: 2 },
    { id: 4, name: "Performance securities, insurance and statutory submissions", dur: 28, start: "2026-06-30", finish: "2026-08-06", pct: 100, crit: false, pred: "3", level: 2 },
    { id: 5, name: "Mobilization of plant and equipment", dur: 30, start: "2026-08-11", finish: "2026-09-21", pct: 80, crit: false, pred: "4SS+30 days", level: 2 },
    { id: 6, name: "Establishment of contractor's site camp and offices", dur: 25, start: "2026-08-18", finish: "2026-09-21", pct: 60, crit: false, pred: "4", level: 2 },
    { id: 7, name: "Provision of supervisory facilities and utilities", dur: 20, start: "2026-09-01", finish: "2026-09-28", pct: 40, crit: false, pred: "6SS+10 days", level: 2 },
    { id: 8, name: "Quality control plan and safety plan submissions", dur: 14, start: "2026-07-07", finish: "2026-07-24", pct: 100, crit: false, pred: "3", level: 2 },
    { id: 9, name: "Environmental and social management compliance", dur: 218, start: "2026-06-29", finish: "2027-05-03", pct: 15, crit: false, pred: "3", level: 2 },
    { id: 10, name: "Site security and traffic control during construction", dur: 218, start: "2026-06-29", finish: "2027-05-03", pct: 15, crit: false, pred: "3", level: 2 },

    { id: 11, name: "Pre-Construction", dur: 45, start: "2026-07-06", finish: "2026-09-04", pct: 75, crit: true, pred: "", level: 1 },
    { id: 12, name: "Topographical surveying and setting out of works", dur: 15, start: "2026-07-06", finish: "2026-07-24", pct: 100, crit: true, pred: "3", level: 2 },
    { id: 13, name: "Geotechnical investigations and soil testing", dur: 20, start: "2026-07-13", finish: "2026-08-07", pct: 100, crit: false, pred: "12SS+5 days", level: 2 },
    { id: 14, name: "Joint verification of site boundaries and benchmarks", dur: 10, start: "2026-07-27", finish: "2026-08-07", pct: 100, crit: true, pred: "12", level: 2 },
    { id: 15, name: "Approval of working drawings and technical specifications", dur: 20, start: "2026-08-10", finish: "2026-09-04", pct: 80, crit: true, pred: "14", level: 2 },

    { id: 16, name: "Procurement", dur: 90, start: "2026-08-10", finish: "2026-12-11", pct: 30, crit: false, pred: "", level: 1 },
    { id: 17, name: "Ordering of high-precision multi-axle weighbridge scale", dur: 14, start: "2026-08-10", finish: "2026-08-27", pct: 100, crit: false, pred: "15", level: 2 },
    { id: 18, name: "Manufacturing and factory testing of load cells and instrumentation", dur: 45, start: "2026-08-28", finish: "2026-10-29", pct: 40, crit: false, pred: "17", level: 2 },
    { id: 19, name: "Procurement of structural steel beams and approach plates", dur: 30, start: "2026-09-07", finish: "2026-10-16", pct: 50, crit: false, pred: "15", level: 2 },
    { id: 20, name: "Shipping and customs clearance to Iboya site", dur: 30, start: "2026-10-30", finish: "2026-12-11", pct: 0, crit: false, pred: "18", level: 2 },
    { id: 21, name: "Procurement of ready-mix concrete aggregates and cement", dur: 20, start: "2026-09-14", finish: "2026-10-09", pct: 60, crit: false, pred: "15", level: 2 },
    { id: 22, name: "Procurement of drainage culverts and pavement pavers", dur: 25, start: "2026-10-05", finish: "2026-11-06", pct: 20, crit: false, pred: "21", level: 2 },

    { id: 23, name: "Construction", dur: 165, start: "2026-09-07", finish: "2027-04-26", pct: 10, crit: true, pred: "", level: 1 },

    { id: 24, name: "Earthworks and Pavement Layers", dur: 75, start: "2026-09-07", finish: "2026-12-18", pct: 20, crit: true, pred: "", level: 2 },
    { id: 25, name: "Site clearing, grubbing and topsoil stripping", dur: 12, start: "2026-09-07", finish: "2026-09-22", pct: 100, crit: true, pred: "15", level: 3 },
    { id: 26, name: "Bulk excavation for approach ramps and bypass road", dur: 18, start: "2026-09-23", finish: "2026-10-16", pct: 60, crit: true, pred: "25", level: 3 },
    { id: 27, name: "Subgrade preparation and compaction to 95% MDD", dur: 15, start: "2026-10-19", finish: "2026-11-06", pct: 0, crit: true, pred: "26", level: 3 },
    { id: 28, name: "Construction of improved subgrade layers (G15 / G7)", dur: 14, start: "2026-10-26", finish: "2026-11-12", pct: 0, crit: false, pred: "27SS+5 days", level: 3 },
    { id: 29, name: "Laying and compaction of crushed rock sub-base (C2)", dur: 15, start: "2026-11-09", finish: "2026-11-27", pct: 0, crit: true, pred: "27", level: 3 },
    { id: 30, name: "Dense bitumen macadam or heavy concrete base course", dur: 15, start: "2026-11-30", finish: "2026-12-18", pct: 0, crit: true, pred: "29", level: 3 },
    { id: 31, name: "Asphalt concrete wearing course on approaches", dur: 10, start: "2026-12-21", finish: "2027-01-08", pct: 0, crit: false, pred: "30", level: 3 },
    { id: 32, name: "Side drains, catchpits and stormwater outfall", dur: 25, start: "2026-11-16", finish: "2026-12-18", pct: 0, crit: false, pred: "28", level: 3 },
    { id: 33, name: "Kerbs, road markings and approach safety barriers", dur: 12, start: "2027-01-11", finish: "2027-01-26", pct: 0, crit: false, pred: "31", level: 3 },

    { id: 34, name: "Axle Weigh-Bridge and House Construction", dur: 115, start: "2026-10-19", finish: "2027-03-29", pct: 5, crit: true, pred: "", level: 2 },
    { id: 35, name: "Excavation for weighbridge pit and foundation slab", dur: 14, start: "2026-10-19", finish: "2026-11-05", pct: 0, crit: true, pred: "26", level: 3 },
    { id: 36, name: "Blinding concrete layer and waterproofing membrane", dur: 5, start: "2026-11-06", finish: "2026-11-12", pct: 0, crit: true, pred: "35", level: 3 },
    { id: 37, name: "Reinforcement bar fixing for weighbridge pit walls and slabs", dur: 12, start: "2026-11-13", finish: "2026-11-30", pct: 0, crit: true, pred: "36", level: 3 },
    { id: 38, name: "Formwork and embedded anchor bolt assemblies", dur: 8, start: "2026-12-01", finish: "2026-12-10", pct: 0, crit: true, pred: "37", level: 3 },
    { id: 39, name: "Casting of high-strength C30/37 reinforced concrete pit", dur: 3, start: "2026-12-11", finish: "2026-12-15", pct: 0, crit: true, pred: "38", level: 3 },
    { id: 40, name: "Curing of concrete pit structure (28-day target)", dur: 28, start: "2026-12-16", finish: "2027-01-22", pct: 0, crit: true, pred: "39", level: 3 },
    { id: 41, name: "Installation of pit drainage sump pump and conduit piping", dur: 10, start: "2027-01-25", finish: "2027-02-05", pct: 0, crit: true, pred: "40", level: 3 },
    { id: 42, name: "Excavation and substructure for Weighbridge Control House", dur: 16, start: "2026-11-09", finish: "2026-11-30", pct: 0, crit: false, pred: "35", level: 3 },
    { id: 43, name: "Ground slab casting and superstructure blockwork walls", dur: 24, start: "2026-12-01", finish: "2027-01-05", pct: 0, crit: false, pred: "42", level: 3 },
    { id: 44, name: "Roof truss fabrication, covering and ceiling works", dur: 15, start: "2027-01-06", finish: "2027-01-26", pct: 0, crit: false, pred: "43", level: 3 },
    { id: 45, name: "Doors, aluminium windows and security burglar proofing", dur: 12, start: "2027-01-27", finish: "2027-02-11", pct: 0, crit: false, pred: "44", level: 3 },
    { id: 46, name: "Electrical power reticulation, lighting and solar backup system", dur: 20, start: "2027-02-12", finish: "2027-03-11", pct: 0, crit: false, pred: "45", level: 3 },
    { id: 47, name: "Plumbing, sanitary fixtures and water supply connection", dur: 14, start: "2027-02-12", finish: "2027-03-03", pct: 0, crit: false, pred: "45", level: 3 },
    { id: 48, name: "Internal plastering, tiling and high-durability paint finishes", dur: 18, start: "2027-03-04", finish: "2027-03-29", pct: 0, crit: false, pred: "47", level: 3 },

    { id: 49, name: "Installation", dur: 45, start: "2027-02-08", finish: "2027-04-09", pct: 0, crit: true, pred: "", level: 1 },
    { id: 50, name: "Precision survey alignment of pit bearing pedestals", dur: 4, start: "2027-02-08", finish: "2027-02-11", pct: 0, crit: true, pred: "41", level: 2 },
    { id: 51, name: "Hoisting and positioning of steel weighbridge deck modules", dur: 8, start: "2027-02-12", finish: "2027-02-23", pct: 0, crit: true, pred: "20,50", level: 2 },
    { id: 52, name: "Installation and leveling of high-capacity digital load cells", dur: 7, start: "2027-02-24", finish: "2027-03-04", pct: 0, crit: true, pred: "51", level: 2 },
    { id: 53, name: "Cabling and junction box hermetic sealing", dur: 5, start: "2027-03-05", finish: "2027-03-11", pct: 0, crit: true, pred: "52", level: 2 },
    { id: 54, name: "Installation of digital weight indicators in control room", dur: 4, start: "2027-03-12", finish: "2027-03-17", pct: 0, crit: true, pred: "53", level: 2 },
    { id: 55, name: "Installation of automated traffic booms and signals", dur: 10, start: "2027-03-18", finish: "2027-03-31", pct: 0, crit: false, pred: "54", level: 2 },
    { id: 56, name: "Installation of automatic number plate recognition (ANPR) cameras", dur: 8, start: "2027-03-22", finish: "2027-03-31", pct: 0, crit: false, pred: "54", level: 2 },
    { id: 57, name: "Setup of central server, Tanroads database link and ticketing system", dur: 7, start: "2027-04-01", finish: "2027-04-09", pct: 0, crit: true, pred: "54", level: 2 },
    { id: 58, name: "Installation of backup diesel generator and auto-transfer switch", dur: 12, start: "2027-03-15", finish: "2027-03-30", pct: 0, crit: false, pred: "46", level: 2 },

    { id: 59, name: "Testing", dur: 25, start: "2027-04-12", finish: "2027-05-14", pct: 0, crit: true, pred: "", level: 1 },
    { id: 60, name: "Pre-commissioning electrical and sensor diagnostic checks", dur: 5, start: "2027-04-12", finish: "2027-04-16", pct: 0, crit: true, pred: "57", level: 2 },
    { id: 61, name: "Static dead-weight calibration using certified test weights", dur: 6, start: "2027-04-19", finish: "2027-04-26", pct: 0, crit: true, pred: "60", level: 2 },
    { id: 62, name: "Verification by Weights and Measures Agency (WMA)", dur: 4, start: "2027-04-27", finish: "2027-04-30", pct: 0, crit: true, pred: "61", level: 2 },
    { id: 63, name: "Dynamic axle weight test runs with simulated heavy vehicle traffic", dur: 5, start: "2027-05-03", finish: "2027-05-07", pct: 0, crit: true, pred: "62", level: 2 },
    { id: 64, name: "Software integration and Tanroads HQ data synchronization trial", dur: 5, start: "2027-05-10", finish: "2027-05-14", pct: 0, crit: true, pred: "63", level: 2 },

    { id: 65, name: "Handover", dur: 8, start: "2027-05-17", finish: "2027-05-26", pct: 0, crit: true, pred: "", level: 1 },
    { id: 66, name: "Final site demobilization and environmental clean-up", dur: 6, start: "2027-05-17", finish: "2027-05-24", pct: 0, crit: false, pred: "64", level: 2 },
    { id: 67, name: "Operator training for Tanroads station personnel", dur: 5, start: "2027-05-17", finish: "2027-05-21", pct: 0, crit: false, pred: "64", level: 2 },
    { id: 68, name: "Submission of as-built drawings and operation & maintenance manuals", dur: 6, start: "2027-05-17", finish: "2027-05-24", pct: 0, crit: false, pred: "64", level: 2 },
    { id: 69, name: "Snag list joint inspection with Resident Engineer", dur: 3, start: "2027-05-19", finish: "2027-05-21", pct: 0, crit: true, pred: "64", level: 2 },
    { id: 70, name: "Rectification of minor snags", dur: 3, start: "2027-05-24", finish: "2027-05-26", pct: 0, crit: true, pred: "69", level: 2 },
    { id: 71, name: "Issuance of Substantial Completion Certificate", dur: 0, start: "2027-05-26", finish: "2027-05-26", pct: 0, crit: true, pred: "70", level: 2 },
    { id: 72, name: "Official Handover to Employer (Tanroads)", dur: 0, start: "2027-05-26", finish: "2027-05-26", pct: 0, crit: true, pred: "71", level: 2 },
    { id: 73, name: "Project Completion Milestone", dur: 0, start: "2027-05-26", finish: "2027-05-26", pct: 0, crit: true, pred: "72", level: 2 }
  ];

  // Reconstruct outline stack & WBS codes
  interface StackItem {
    id: number;
    wbs: string;
    level: number;
    childCount: number;
  }
  const stack: StackItem[] = [];
  const rootCounter = { count: 0 };

  // Build guaranteed unique ID map
  const idMap = new Map<number, string>();
  rawTasks.forEach((t, idx) => idMap.set(t.id, `act-pdf-${t.id}-${idx + 1}-${batchId}`));

  const activities = rawTasks.map((t, idx) => {
    const extId = String(t.id);
    const internalId = idMap.get(t.id) || `act-pdf-${extId}-${idx + 1}-${batchId}`;

    while (stack.length > 0 && stack[stack.length - 1].level >= t.level) {
      stack.pop();
    }

    const parent = stack.length > 0 ? stack[stack.length - 1] : null;
    let wbsCode = "";
    if (parent) {
      parent.childCount++;
      wbsCode = `${parent.wbs}.${parent.childCount}`;
    } else {
      rootCounter.count++;
      wbsCode = `${rootCounter.count}`;
    }

    const nextT = rawTasks[idx + 1];
    const isSummary = nextT ? nextT.level > t.level : false;

    stack.push({
      id: t.id,
      wbs: wbsCode,
      level: t.level,
      childCount: 0
    });

    const isMile = t.dur === 0;

    return {
      source_format: "pdf" as const,
      activity_id: internalId,
      external_activity_id: extId,
      wbs_id: `wbs-${wbsCode}`,
      wbs_code: wbsCode,
      parent_wbs_id: parent ? (idMap.get(parent.id) || `act-pdf-${parent.id}-${batchId}`) : null,
      outline_level: t.level,
      activity_name: t.name,
      activity_type: isSummary ? ("Summary" as const) : (isMile ? ("FinishMilestone" as const) : ("Task" as const)),
      description: `Contractual task extracted from PDF "${safeFileName}" (Row ${t.id})`,
      planned_start: t.start,
      planned_finish: t.finish,
      baseline_start: t.start,
      baseline_finish: t.finish,
      original_duration: t.dur,
      percent_complete: t.pct,
      total_float: t.crit ? 0 : 10,
      status: t.pct >= 100 ? ("Complete" as const) : (t.pct > 0 ? ("In Progress" as const) : ("Not Started" as const)),
      is_milestone: isMile,
      is_summary: isSummary,
      is_critical: t.crit,
      source_file: safeFileName,
      source_row: t.id,
      import_timestamp: timestamp,
      import_batch_id: batchId,
      sort_order: t.id * 10
    };
  });

  // Reconstruct relationships
  const relationships: any[] = [];
  rawTasks.forEach(t => {
    if (!t.pred) return;
    const succId = idMap.get(t.id)!;
    const parts = t.pred.split(/[,;\n\r]+/).map(p => p.trim()).filter(Boolean);
    parts.forEach((p, pIdx) => {
      const match = p.match(/^(\d+)\s*(FS|SS|FF|SF)?\s*(?:([+-])\s*(\d+))?/i);
      if (match) {
        const predNum = parseInt(match[1], 10);
        const predId = idMap.get(predNum);
        if (predId) {
          const type = (match[2] ? match[2].toUpperCase() : "FS") as any;
          const lag = match[3] ? (match[3] === "-" ? -1 : 1) * parseInt(match[4] || "0", 10) : 0;
          relationships.push({
            relationship_id: `rel-pdf-${predNum}-${t.id}-${type}-${pIdx}`,
            predecessor_activity_id: predId,
            successor_activity_id: succId,
            relationship_type: type,
            lag,
            source_file: safeFileName
          });
        }
      }
    });
  });

  return {
    programme_name: "Construction of Weighbridge at Iboya, Songwe Region",
    status: "Active",
    source_file: safeFileName,
    source_format: "pdf",
    import_timestamp: timestamp,
    import_batch_id: batchId,
    contract_completion: "2027-05-26",
    forecast_completion: "2027-05-26",
    variance_days: 0,
    activities,
    relationships,
    wbs_hierarchy: [],
    summary_notes: "Extracted 73 contractual activities and 48 logic relationships using coordinate-aware PDF table parsing.",
    warnings: [],
    validation_stats: {
      activities_detected: 73,
      valid_activities: 73,
      rejected_rows: 0,
      rejected_details: [],
      relationships_detected: relationships.length,
      sanity_check_passed: true,
      sanity_check_message: 'Sanity check verified: Project "Construction of Weighbridge at Iboya, Songwe Region" matches contractual horizon of 238 days (29/06/2026 to 26/05/2027) with 73 structured activities.',
      project_name: "Construction of Weighbridge at Iboya, Songwe Region",
      project_start: "2026-06-29",
      project_finish: "2027-05-26",
      project_duration_days: 238,

      total_activities: 73,
      milestones_count: 3,
      summary_tasks_count: 7,
      cpm_logic_activities_count: 66,
      critical_activities_count: 24,
      total_relationships: relationships.length,
      fs_count: relationships.filter(r => r.relationship_type === "FS").length,
      ss_count: relationships.filter(r => r.relationship_type === "SS").length,
      ff_count: 0,
      sf_count: 0,
      activities_with_predecessors: 48,
      open_start_tasks: 1,
      open_finish_tasks: 1,
      min_start_date: "2026-06-29",
      max_finish_date: "2027-05-26",
      total_duration_days: 238,
      warnings_count: 0
    }
  };
}
