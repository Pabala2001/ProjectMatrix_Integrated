import fs from "fs";
import path from "path";

export interface EngineeringRFIStorageRecord {
  id: string;
  rfiNumber: string;
  title: string;
  discipline: string;
  disciplineLabel: string;
  drawingRef: string;
  specRef: string;
  location: string;
  chainage?: string;
  raisedBy: string;
  raisedByRole: string;
  raisedDate: string;
  responseDueDate: string;
  status: string;
  priority: string;
  questionText: string;
  proposedSolution?: string;
  consultantResponse?: string;
  respondedBy?: string;
  respondedDate?: string;
  constructionImpact: string;
  constructionImpactDetails: string;
  programmeImpact?: {
    hasImpact: boolean;
    activityId: string;
    activityName: string;
    durationImpactDays: number;
    isCriticalPath: boolean;
    details: string;
  };
  commercialImpact?: {
    hasImpact: boolean;
    potentialVariation: boolean;
    estimatedCostImpact: number;
    boqItemRef?: string;
    details: string;
  };
  contractClauseRef?: {
    framework: string;
    clauseNumber: string;
    clauseTitle: string;
  };
  attachments?: any[];
  projectId?: string;
  companyId?: string;
  createdBy?: string;
  assignedTo?: string;
  createdAt?: string;
  updatedAt?: string;
  history?: Array<{
    id?: string;
    date: string;
    action: string;
    user: string;
    details?: string;
  }>;
}

const DATA_DIR = path.join(process.cwd(), "data");
const RFI_FILE_PATH = path.join(DATA_DIR, "engineering_rfis.json");

const DEFAULT_INITIAL_RFIS: EngineeringRFIStorageRecord[] = [
  {
    id: "rfi-101",
    rfiNumber: "RFI-101",
    title: "Discrepancy in Pier P14 Pile Cap Starter Bar Spacing",
    discipline: "structural",
    disciplineLabel: "Structural",
    drawingRef: "STR-042 Rev C",
    specRef: "03 30 00 Clause 4.2",
    location: "Pier P14, Chainage Km 14+250",
    chainage: "Km 14+250",
    raisedBy: "Thabo Nkosi (Site Engineer)",
    raisedByRole: "Site Engineer",
    raisedDate: "22 Feb 2025",
    responseDueDate: "26 Feb 2025",
    status: "Awaiting Consultant",
    priority: "Critical",
    questionText: "Contract drawing STR-042 Rev C indicates T32 starter bars at 150mm c/c into pile cap, whereas bending schedule BBS-STR-014 specifies T25 at 200mm c/c. Clarify reinforcement bar diameter and pitch before pile cap reinforcement fixing commences.",
    proposedSolution: "Adopt T32 @ 150mm c/c as per structural design intent to prevent anchorage capacity shortfall.",
    constructionImpact: "Critical",
    constructionImpactDetails: "Work held at Pier P14 pile cap fixing pending structural engineer confirmation.",
    programmeImpact: {
      hasImpact: true,
      activityId: "ACT-092",
      activityName: "Substructure Pier P14",
      durationImpactDays: 3,
      isCriticalPath: true,
      details: "Potential schedule delay of 3 days on critical path bridge foundation."
    },
    commercialImpact: {
      hasImpact: true,
      potentialVariation: true,
      estimatedCostImpact: 35000,
      details: "Cost variation evaluation logged under Sub-Clause 1.9."
    },
    contractClauseRef: {
      framework: "FIDIC Red Book 2017",
      clauseNumber: "Sub-Clause 1.9",
      clauseTitle: "Delayed Drawings or Instructions"
    },
    attachments: [
      { name: "STR-042_RevC_Conflict_Detail.pdf", size: "2.4 MB", type: "PDF" },
      { name: "Site_Photo_P14_Rebar.jpg", size: "3.8 MB", type: "IMAGE" }
    ],
    createdBy: "Thabo Nkosi (Site Engineer)",
    assignedTo: "Dr. Elena Rostova (Principal Structural Designer)",
    createdAt: new Date("2025-02-22T08:30:00Z").toISOString(),
    history: [
      {
        date: "22 Feb 2025 08:30",
        action: "Created & Submitted",
        user: "Thabo Nkosi",
        details: "Technical query formally registered and submitted to resident engineer."
      }
    ]
  },
  {
    id: "rfi-102",
    rfiNumber: "RFI-102",
    title: "Conflicting Invert Level: Box Culvert BC-04 vs Stormwater Main",
    discipline: "drainage",
    disciplineLabel: "Drainage",
    drawingRef: "DRN-104 Rev B",
    specRef: "33 40 00 Clause 2.1",
    location: "Chainage Km 08+400",
    chainage: "Km 08+400",
    raisedBy: "Khadija Belkacem (Drainage Lead)",
    raisedByRole: "Hydraulic Engineer",
    raisedDate: "18 Feb 2025",
    responseDueDate: "23 Feb 2025",
    status: "Responded",
    priority: "High",
    questionText: "Invert level of precast box culvert BC-04 at Chainage 08+400 (IL 142.350m) clashes with existing 600mm dia municipal stormwater pipe invert (IL 142.180m). Clarify culvert bedding level or authorize relocation.",
    proposedSolution: "Lower downstream open discharge channel invert by 250mm to provide 150mm vertical clearance without compromising hydraulic capacity.",
    consultantResponse: "Approved with modification: Contractor to lower open channel downstream by 250mm and construct concrete encasement around crossing pipe in accordance with standard drawing SD-UTL-012. Formal instruction EI-044 issued.",
    respondedBy: "Resident Engineer (Civil / Infrastructure)",
    respondedDate: "21 Feb 2025",
    constructionImpact: "High",
    constructionImpactDetails: "Culvert installation authorized to resume in accordance with EI-044.",
    programmeImpact: {
      hasImpact: false,
      activityId: "ACT-064",
      activityName: "Culvert BC-04 Installation",
      durationImpactDays: 0,
      isCriticalPath: false,
      details: "Resolved within float window; no critical path impact."
    },
    commercialImpact: {
      hasImpact: true,
      potentialVariation: true,
      estimatedCostImpact: 18000,
      details: "Encasement and channel regrading evaluated under Bill 3 Item 3.4.1."
    },
    contractClauseRef: {
      framework: "FIDIC Red Book 2017",
      clauseNumber: "Sub-Clause 3.3",
      clauseTitle: "Engineer's Instructions"
    },
    attachments: [
      { name: "DRN-104_Crossing_Section.dwg", size: "5.1 MB", type: "DWG" },
      { name: "Engineer_Instruction_EI-044.pdf", size: "1.2 MB", type: "PDF" }
    ],
    createdBy: "Khadija Belkacem",
    assignedTo: "Resident Engineer",
    createdAt: new Date("2025-02-18T10:15:00Z").toISOString(),
    history: [
      {
        date: "18 Feb 2025 10:15",
        action: "Created & Submitted",
        user: "Khadija Belkacem",
        details: "RFI raised due to utility clash on site."
      },
      {
        date: "21 Feb 2025 14:00",
        action: "Responded & Instructed",
        user: "Resident Engineer",
        details: "Technical clarification response provided with Instruction EI-044."
      }
    ]
  },
  {
    id: "rfi-103",
    rfiNumber: "RFI-103",
    title: "Subgrade In-Situ CBR Values Below Minimum at Km 18+200 - 18+600",
    discipline: "geotechnical",
    disciplineLabel: "Geotechnical",
    drawingRef: "GEO-019 Rev A",
    specRef: "31 23 00 Clause 3.4",
    location: "Chainage Km 18+200 to 18+600",
    chainage: "Km 18+200 - 18+600",
    raisedBy: "Farhan Al-Mansoor (Geotech Engineer)",
    raisedByRole: "Geotechnical Specialist",
    raisedDate: "20 Feb 2025",
    responseDueDate: "25 Feb 2025",
    status: "Under Review",
    priority: "High",
    questionText: "Dynamic cone penetrometer (DCP) testing indicates subgrade CBR between 3.5% and 4.8% across 400m cut section, failing specified minimum G7 material requirement of 7% CBR at 93% Mod AASHTO. Confirm if in-situ lime stabilization or undercut replacement is required.",
    proposedSolution: "Perform 150mm undercut and replace with imported G5 natural gravel, or stabilize upper 150mm subgrade with 3% road lime.",
    constructionImpact: "High",
    constructionImpactDetails: "Road sub-base layerworks halted between Km 18+200 and 18+600 pending direction.",
    programmeImpact: {
      hasImpact: true,
      activityId: "ACT-118",
      activityName: "Subgrade Layerworks Km 18",
      durationImpactDays: 4,
      isCriticalPath: true,
      details: "Critical path highway layerworks delay of 4 days."
    },
    commercialImpact: {
      hasImpact: true,
      potentialVariation: true,
      estimatedCostImpact: 78000,
      details: "Undercutting / lime treatment claim flagged under GCC 2015 Clause 48."
    },
    contractClauseRef: {
      framework: "FIDIC Red Book 2017",
      clauseNumber: "Sub-Clause 4.12",
      clauseTitle: "Unforeseeable Physical Conditions"
    },
    attachments: [
      { name: "DCP_Test_Report_Km18.pdf", size: "4.2 MB", type: "PDF" }
    ],
    createdBy: "Farhan Al-Mansoor",
    assignedTo: "Materials Engineer & Geotechnical Lead",
    createdAt: new Date("2025-02-20T11:45:00Z").toISOString(),
    history: [
      {
        date: "20 Feb 2025 11:45",
        action: "Created & Submitted",
        user: "Farhan Al-Mansoor",
        details: "Subgrade failure logged with lab test results."
      }
    ]
  }
];

function ensureDirectoryExists(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readAllRFIs(): EngineeringRFIStorageRecord[] {
  ensureDirectoryExists();
  if (!fs.existsSync(RFI_FILE_PATH)) {
    // Initialize with baseline records
    writeAllRFIs(DEFAULT_INITIAL_RFIS);
    return DEFAULT_INITIAL_RFIS;
  }
  try {
    const raw = fs.readFileSync(RFI_FILE_PATH, "utf-8");
    if (!raw.trim()) {
      writeAllRFIs(DEFAULT_INITIAL_RFIS);
      return DEFAULT_INITIAL_RFIS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      writeAllRFIs(DEFAULT_INITIAL_RFIS);
      return DEFAULT_INITIAL_RFIS;
    }
    return parsed;
  } catch (err) {
    console.error("Error reading engineering_rfis.json:", err);
    return DEFAULT_INITIAL_RFIS;
  }
}

function writeAllRFIs(rfis: EngineeringRFIStorageRecord[]): void {
  ensureDirectoryExists();
  const tempPath = `${RFI_FILE_PATH}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(rfis, null, 2), "utf-8");
    fs.renameSync(tempPath, RFI_FILE_PATH);
  } catch (err) {
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {}
    }
    // Fallback direct write
    fs.writeFileSync(RFI_FILE_PATH, JSON.stringify(rfis, null, 2), "utf-8");
  }
}

export const EngineeringRFIStorage = {
  getRFIs(filter?: { projectId?: string; companyId?: string }): EngineeringRFIStorageRecord[] {
    const all = readAllRFIs();
    if (!filter) return all;

    return all.filter((item) => {
      if (filter.projectId && item.projectId && item.projectId !== filter.projectId) {
        return false;
      }
      if (filter.companyId && item.companyId && item.companyId !== filter.companyId) {
        return false;
      }
      return true;
    });
  },

  getRFIById(id: string): EngineeringRFIStorageRecord | undefined {
    const all = readAllRFIs();
    return all.find((item) => item.id === id);
  },

  createRFI(data: Partial<EngineeringRFIStorageRecord>): EngineeringRFIStorageRecord {
    const all = readAllRFIs();
    const nowIso = new Date().toISOString();
    const formattedDate = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });

    const newId = data.id || `rfi-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const rfiNum = data.rfiNumber || `RFI-${String(all.length + 101).padStart(3, "0")}`;

    const newRecord: EngineeringRFIStorageRecord = {
      id: newId,
      rfiNumber: rfiNum,
      title: data.title || "Technical Clarification",
      discipline: data.discipline || "structural",
      disciplineLabel: data.disciplineLabel || "Engineering",
      drawingRef: data.drawingRef || "—",
      specRef: data.specRef || "—",
      location: data.location || "Site",
      chainage: data.chainage || "",
      raisedBy: data.raisedBy || "Thabo Nkosi (Site Engineer)",
      raisedByRole: data.raisedByRole || "Site Engineer",
      raisedDate: data.raisedDate || formattedDate,
      responseDueDate: data.responseDueDate || new Date(Date.now() + 4 * 86400000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
      status: data.status || "Awaiting Consultant",
      priority: data.priority || "High",
      questionText: data.questionText || "",
      proposedSolution: data.proposedSolution || "",
      consultantResponse: data.consultantResponse || "",
      respondedBy: data.respondedBy || "",
      respondedDate: data.respondedDate || "",
      constructionImpact: data.constructionImpact || "High",
      constructionImpactDetails: data.constructionImpactDetails || "Work held pending engineer response.",
      programmeImpact: data.programmeImpact || {
        hasImpact: false,
        activityId: "",
        activityName: "",
        durationImpactDays: 0,
        isCriticalPath: false,
        details: ""
      },
      commercialImpact: data.commercialImpact || {
        hasImpact: false,
        potentialVariation: false,
        estimatedCostImpact: 0,
        details: ""
      },
      contractClauseRef: data.contractClauseRef || {
        framework: "FIDIC Red Book 2017",
        clauseNumber: "Sub-Clause 1.9",
        clauseTitle: "Delayed Drawings or Instructions"
      },
      attachments: data.attachments || [],
      projectId: data.projectId,
      companyId: data.companyId,
      createdBy: data.createdBy || data.raisedBy || "Current User",
      assignedTo: data.assignedTo || "Supervising Consultant",
      createdAt: data.createdAt || nowIso,
      updatedAt: nowIso,
      history: data.history && data.history.length > 0 ? data.history : [
        {
          id: `hist-${Date.now()}`,
          date: formattedDate,
          action: "Created Technical Query / RFI",
          user: data.raisedBy || "Site Engineer",
          details: `Query issued with status ${data.status || "Awaiting Consultant"}`
        }
      ]
    };

    // Prepend new record so latest appears first
    all.unshift(newRecord);
    writeAllRFIs(all);
    return newRecord;
  },

  updateRFI(id: string, updates: Partial<EngineeringRFIStorageRecord>): EngineeringRFIStorageRecord {
    const all = readAllRFIs();
    const index = all.findIndex((item) => item.id === id);

    if (index === -1) {
      // If not found by id, create it
      return this.createRFI({ ...updates, id });
    }

    const existing = all[index];
    const nowIso = new Date().toISOString();
    const formattedDate = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });

    const historyLog = [...(existing.history || [])];

    if (updates.status && updates.status !== existing.status) {
      historyLog.push({
        id: `hist-${Date.now()}-status`,
        date: formattedDate,
        action: `Status changed to ${updates.status}`,
        user: updates.respondedBy || updates.raisedBy || "User",
        details: `Updated from ${existing.status} to ${updates.status}`
      });
    }

    if (updates.consultantResponse && updates.consultantResponse !== existing.consultantResponse) {
      historyLog.push({
        id: `hist-${Date.now()}-resp`,
        date: formattedDate,
        action: "Consultant Response Registered",
        user: updates.respondedBy || "Resident Engineer",
        details: updates.consultantResponse.slice(0, 100)
      });
    }

    const updatedRecord: EngineeringRFIStorageRecord = {
      ...existing,
      ...updates,
      id: existing.id, // Immutable ID
      projectId: updates.projectId || existing.projectId,
      companyId: updates.companyId || existing.companyId,
      createdAt: existing.createdAt || nowIso,
      updatedAt: nowIso,
      history: historyLog
    };

    all[index] = updatedRecord;
    writeAllRFIs(all);
    return updatedRecord;
  },

  deleteRFI(id: string): boolean {
    const all = readAllRFIs();
    const filtered = all.filter((item) => item.id !== id);

    if (filtered.length === all.length) {
      return false; // Not found
    }

    writeAllRFIs(filtered);
    return true;
  }
};
