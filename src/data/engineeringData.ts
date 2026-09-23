import {
  DisciplineDefinition,
  ProjectDisciplineConfig,
  EngineeringRFI,
  TechnicalSubmittal,
  DesignReviewItem,
  EngineeringDeviation,
  DesignAssumption,
  TemporaryWorksItem,
  ConstructabilityReview,
  EngineeringDesignChange,
  DigitalTraceabilityItem,
  SettingOutRecord,
  EarthworkVolumeComparison,
  DroneFlightSurvey,
  SurveyControlPoint,
  SurveyEquipmentCalibration,
  EngineeringDisciplineId
} from "../types/engineering";

// ============================================================================
// 1. MASTER ENGINEERING DISCIPLINES DEFINITION
// ============================================================================
export const MASTER_ENGINEERING_DISCIPLINES: DisciplineDefinition[] = [
  {
    id: "civil",
    name: "Civil Engineering",
    code: "CIV",
    category: "heavy_civil",
    description: "Earthworks, bulk excavations, site development, foundations, retention and retaining structures.",
    defaultForProjectTypes: ["Highway", "Bridge", "Rail", "Building", "Port", "Dam", "Infrastructure"],
    typicalDeliverables: ["Site Grading Plans", "Excavation Specs", "Slope Stability Calculations", "Earthworks Schedules"]
  },
  {
    id: "structural",
    name: "Structural Engineering",
    code: "STR",
    category: "heavy_civil",
    description: "Reinforced concrete, post-tensioning, structural steelwork, foundations, bridge piers, and deck design.",
    defaultForProjectTypes: ["Bridge", "Building", "Rail", "Industrial", "Infrastructure"],
    typicalDeliverables: ["Structural Framing Drawings", "Bending Schedules", "Connection Details", "Calculation Books"]
  },
  {
    id: "geotechnical",
    name: "Geotechnical Engineering",
    code: "GEO",
    category: "heavy_civil",
    description: "Soil investigation boreholes, rock mechanics, deep piling, ground improvement, and dewatering.",
    defaultForProjectTypes: ["Highway", "Bridge", "Rail", "Tunnel", "Dam", "Port", "Building"],
    typicalDeliverables: ["Geotechnical Baseline Reports (GBR)", "Borehole Logs", "Pile Load Test Reports", "Settlement Analysis"]
  },
  {
    id: "roads_pavements",
    name: "Roads & Pavements",
    code: "PAV",
    category: "heavy_civil",
    description: "Highway alignments, pavement layerworks, asphalt design, sub-base stabilization, and road furniture.",
    defaultForProjectTypes: ["Highway", "Infrastructure", "Urban", "Airport"],
    typicalDeliverables: ["Pavement Design Reports", "Road Alignment Strip Maps", "Cross Sections", "Paving Method Statements"]
  },
  {
    id: "drainage",
    name: "Drainage & Hydrology",
    code: "DRN",
    category: "heavy_civil",
    description: "Catchment hydrology, culverts, storm water attenuation, channels, headwalls, and sub-surface drains.",
    defaultForProjectTypes: ["Highway", "Rail", "Building", "Infrastructure", "Urban"],
    typicalDeliverables: ["Hydraulic Runoff Calculations", "Culvert Schedule", "Inlet/Outlet Details", "Attenuation Sizing"]
  },
  {
    id: "water",
    name: "Water & Wastewater",
    code: "WTR",
    category: "specialist",
    description: "Bulk water supply pipelines, pumping stations, reservoirs, wastewater treatment, and pipe hydraulics.",
    defaultForProjectTypes: ["Water Treatment", "Pipeline", "Infrastructure", "Municipal"],
    typicalDeliverables: ["Hydraulic Transient Analysis", "Pipeline Profiles", "Chamber Details", "Pumping Calculations"]
  },
  {
    id: "electrical",
    name: "Electrical Engineering",
    code: "ELE",
    category: "systems",
    description: "High/medium/low voltage reticulation, substations, lighting, UPS, backup generators, and earthing.",
    defaultForProjectTypes: ["Building", "Rail", "Industrial", "Highway", "Infrastructure"],
    typicalDeliverables: ["Single Line Diagrams (SLD)", "Cable Schedules", "Substation Layouts", "Illuminance Calculations"]
  },
  {
    id: "mechanical",
    name: "Mechanical Engineering (HVAC & Plant)",
    code: "MEC",
    category: "systems",
    description: "HVAC ventilation systems, chilled water loops, fire suppression, pumping plant, and heavy plant mechanics.",
    defaultForProjectTypes: ["Building", "Industrial", "Rail", "Water Treatment", "Tunnel"],
    typicalDeliverables: ["HVAC Ductwork Layouts", "Piping & Instrumentation (P&ID)", "Pump Curves", "Cooling Load Specs"]
  },
  {
    id: "instrumentation",
    name: "Instrumentation & SCADA",
    code: "INS",
    category: "systems",
    description: "SCADA systems, telemetry, PLC control panels, field sensors, fiber backbones, and automation.",
    defaultForProjectTypes: ["Rail", "Water Treatment", "Industrial", "Tunnel", "Smart City"],
    typicalDeliverables: ["I/O Loop Sheets", "SCADA Architecture Diagrams", "Cause & Effect Matrices", "FAT/SAT Protocols"]
  },
  {
    id: "architecture",
    name: "Architecture & Finishes",
    code: "ARC",
    category: "building",
    description: "Architectural floor layouts, facade cladding, curtain walling, interior fit-outs, and acoustic ratings.",
    defaultForProjectTypes: ["Building", "Commercial", "Airport", "Station"],
    typicalDeliverables: ["Architectural General Arrangements", "Door & Window Schedules", "Finishes Schedules", "3D Renders"]
  },
  {
    id: "rail",
    name: "Rail Systems & Permanent Way",
    code: "RLY",
    category: "specialist",
    description: "Track alignment, ballast, sleepers, continuously welded rail (CWR), turnouts, overhead catenary (OCS), signalling.",
    defaultForProjectTypes: ["Rail", "Metro", "Light Rail", "Freight Corridor"],
    typicalDeliverables: ["Track Alignment Curvature Charts", "Turnout Geometric Layouts", "OCS Stagger Diagrams", "Interlocking Data"]
  },
  {
    id: "utilities",
    name: "Utilities & Services Diversion",
    code: "UTL",
    category: "specialist",
    description: "Underground utility corridors, wayleaves, oil/gas crossings, telecom conduits, and live diversion staging.",
    defaultForProjectTypes: ["Highway", "Rail", "Urban", "Infrastructure", "Building"],
    typicalDeliverables: ["Utility Conflict Matrix", "Diversion Sequencing Plans", "Potholing Ground Radar Survey Logs"]
  },
  {
    id: "survey_geospatial",
    name: "Survey & Geospatial",
    code: "SRV",
    category: "heavy_civil",
    description: "Primary/secondary geodetic control networks, setting out, topographic surveys, LiDAR/photogrammetry, and as-built DTMs.",
    defaultForProjectTypes: ["Highway", "Bridge", "Rail", "Building", "Tunnel", "Dam", "Infrastructure", "Port"],
    typicalDeliverables: ["Control Pillar Coordinates", "Setting Out Sheets", "Earthworks Cut/Fill Models", "As-Built Redlines"]
  }
];

// ============================================================================
// 2. PROJECT-SPECIFIC CONFIGURATION REPOSITORY
// ============================================================================
export const INITIAL_PROJECT_DISCIPLINE_CONFIGS: Record<string, ProjectDisciplineConfig> = {
  // Central Station Transfer Interchange (Complex Building / Rail / Civil Hub)
  "proj-01": {
    projectId: "proj-01",
    projectName: "Central Station Transfer Interchange",
    projectType: "Rail & Multimodal Transit Hub",
    activeDisciplineIds: [
      "civil",
      "structural",
      "geotechnical",
      "architecture",
      "rail",
      "mechanical",
      "electrical",
      "instrumentation",
      "drainage",
      "utilities",
      "survey_geospatial"
    ],
    leadEngineers: {
      civil: { name: "Marcus Van Der Merwe", organisation: "Matrix JV", registrationNumber: "PrEng 20120491", role: "Chief Civil Engineer" },
      structural: { name: "Dr. Elena Rostova", organisation: "Matrix JV", registrationNumber: "CEng FIStructE 88201", role: "Principal Structural Designer" },
      geotechnical: { name: "Farhan Al-Mansoor", organisation: "GeoCore Consult", registrationNumber: "PE Geotech 55219", role: "Senior Geotechnical Engineer" },
      roads_pavements: { name: "David Osei", organisation: "Matrix JV", registrationNumber: "PrEng 20184412", role: "Pavements Specialist" },
      drainage: { name: "Khadija Belkacem", organisation: "Matrix JV", registrationNumber: "PrEng 20163390", role: "Hydraulic Lead" },
      water: { name: "Tariq Aziz", organisation: "Matrix JV", registrationNumber: "PE Water 91823", role: "Water Reticulation Engineer" },
      electrical: { name: "Jean-Paul Mbaye", organisation: "ElectroMatrix JV", registrationNumber: "PrEng 20109931", role: "High Voltage & Power Lead" },
      mechanical: { name: "Simon Cooper", organisation: "Matrix JV", registrationNumber: "CEng MIMechE 74901", role: "HVAC & Tunnel Systems Lead" },
      instrumentation: { name: "Yuki Tanaka", organisation: "SignalMatrix", registrationNumber: "IEEE SCADA 44910", role: "SCADA & Telemetry Architect" },
      architecture: { name: "Amara Diallo", organisation: "UrbanArch Design", registrationNumber: "SACAP 20881", role: "Senior Project Architect" },
      rail: { name: "Klaus Zimmerman", organisation: "TrackTech International", registrationNumber: "EUR ING 99120", role: "Permanent Way Lead" },
      utilities: { name: "Lerato Khumalo", organisation: "Matrix JV", registrationNumber: "PrEng 20194420", role: "Utilities Coordinator" },
      survey_geospatial: { name: "Mpho Dlamini", organisation: "Matrix JV", registrationNumber: "PLS Geomatic 4019", role: "Chief Geomatic Surveyor" }
    }
  },

  // Western Highway Arterial Dualling (Heavy Road Project)
  "proj-02": {
    projectId: "proj-02",
    projectName: "Western Highway Arterial Dualling",
    projectType: "Highway & Bridges",
    activeDisciplineIds: [
      "civil",
      "roads_pavements",
      "drainage",
      "structural",
      "geotechnical",
      "electrical",
      "utilities",
      "survey_geospatial"
    ],
    leadEngineers: {
      civil: { name: "Marcus Van Der Merwe", organisation: "Matrix JV", registrationNumber: "PrEng 20120491", role: "Chief Civil Engineer" },
      structural: { name: "Dr. Elena Rostova", organisation: "Matrix JV", registrationNumber: "CEng FIStructE 88201", role: "Bridge Engineer" },
      geotechnical: { name: "Farhan Al-Mansoor", organisation: "GeoCore Consult", registrationNumber: "PE Geotech 55219", role: "Geotechnical Engineer" },
      roads_pavements: { name: "David Osei", organisation: "Matrix JV", registrationNumber: "PrEng 20184412", role: "Senior Highway Engineer" },
      drainage: { name: "Khadija Belkacem", organisation: "Matrix JV", registrationNumber: "PrEng 20163390", role: "Culvert & Drainage Lead" },
      water: { name: "Tariq Aziz", organisation: "Matrix JV", registrationNumber: "PE Water 91823", role: "Water Reticulation Engineer" },
      electrical: { name: "Jean-Paul Mbaye", organisation: "ElectroMatrix JV", registrationNumber: "PrEng 20109931", role: "Street Lighting Engineer" },
      mechanical: { name: "Simon Cooper", organisation: "Matrix JV", registrationNumber: "CEng MIMechE 74901", role: "Mechanical Lead" },
      instrumentation: { name: "Yuki Tanaka", organisation: "SignalMatrix", registrationNumber: "IEEE SCADA 44910", role: "Traffic Signal Control" },
      architecture: { name: "Amara Diallo", organisation: "UrbanArch Design", registrationNumber: "SACAP 20881", role: "Architect" },
      rail: { name: "Klaus Zimmerman", organisation: "TrackTech International", registrationNumber: "EUR ING 99120", role: "Rail Engineer" },
      utilities: { name: "Lerato Khumalo", organisation: "Matrix JV", registrationNumber: "PrEng 20194420", role: "Services Diversion Lead" },
      survey_geospatial: { name: "Mpho Dlamini", organisation: "Matrix JV", registrationNumber: "PLS Geomatic 4019", role: "Senior Highway Surveyor" }
    }
  },

  // Red Sea Marine Desalination Plant (Water & Industrial Plant)
  "proj-03": {
    projectId: "proj-03",
    projectName: "Red Sea Marine Desalination Plant",
    projectType: "Industrial & Water Treatment",
    activeDisciplineIds: [
      "civil",
      "structural",
      "geotechnical",
      "water",
      "mechanical",
      "electrical",
      "instrumentation",
      "survey_geospatial"
    ],
    leadEngineers: {
      civil: { name: "Marcus Van Der Merwe", organisation: "Matrix JV", registrationNumber: "PrEng 20120491", role: "Chief Civil Engineer" },
      structural: { name: "Dr. Elena Rostova", organisation: "Matrix JV", registrationNumber: "CEng FIStructE 88201", role: "Marine Structural Engineer" },
      geotechnical: { name: "Farhan Al-Mansoor", organisation: "GeoCore Consult", registrationNumber: "PE Geotech 55219", role: "Coastal Geotech Lead" },
      roads_pavements: { name: "David Osei", organisation: "Matrix JV", registrationNumber: "PrEng 20184412", role: "Pavement Engineer" },
      drainage: { name: "Khadija Belkacem", organisation: "Matrix JV", registrationNumber: "PrEng 20163390", role: "Drainage Engineer" },
      water: { name: "Tariq Aziz", organisation: "Matrix JV", registrationNumber: "PE Water 91823", role: "Process & Reverse Osmosis Lead" },
      electrical: { name: "Jean-Paul Mbaye", organisation: "ElectroMatrix JV", registrationNumber: "PrEng 20109931", role: "Industrial Power Engineer" },
      mechanical: { name: "Simon Cooper", organisation: "Matrix JV", registrationNumber: "CEng MIMechE 74901", role: "High Pressure Pump Systems" },
      instrumentation: { name: "Yuki Tanaka", organisation: "SignalMatrix", registrationNumber: "IEEE SCADA 44910", role: "Desal SCADA Lead" },
      architecture: { name: "Amara Diallo", organisation: "UrbanArch Design", registrationNumber: "SACAP 20881", role: "Architect" },
      rail: { name: "Klaus Zimmerman", organisation: "TrackTech International", registrationNumber: "EUR ING 99120", role: "Rail Engineer" },
      utilities: { name: "Lerato Khumalo", organisation: "Matrix JV", registrationNumber: "PrEng 20194420", role: "Utilities Engineer" },
      survey_geospatial: { name: "Mpho Dlamini", organisation: "Matrix JV", registrationNumber: "PLS Geomatic 4019", role: "Bathymetric & Land Surveyor" }
    }
  }
};

// ============================================================================
// 3. RFI (REQUEST FOR INFORMATION) DATASET
// ============================================================================
export const SAMPLE_ENGINEERING_RFIS: EngineeringRFI[] = [
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
    disciplineLabel: "Drainage & Hydrology",
    drawingRef: "DRN-104 Rev B",
    specRef: "33 40 00 Section 3.2",
    location: "Chainage Km 14+200",
    chainage: "Km 14+200",
    raisedBy: "Khadija Belkacem (Civil Works Lead)",
    raisedByRole: "Civil Works Lead",
    raisedDate: "18 Feb 2025",
    responseDueDate: "23 Feb 2025",
    status: "Responded",
    priority: "High",
    questionText: "Culvert BC-04 inlet invert at El. 138.920m clashes with existing 450mm dia municipal water main at El. 138.750m. Provide crossing profile instruction.",
    proposedSolution: "Lower culvert inlet by 300mm to provide minimum 200mm vertical clearance with 150mm concrete encasement around water main.",
    consultantResponse: "Approved with condition: Encase existing 450mm water main in 20MPa concrete cradle as per Standard Drawing STD-UTL-08. Adjust culvert upstream channel regrade by 15m.",
    respondedBy: "Resident Engineer - Dr. A. Mwamba",
    respondedDate: "21 Feb 2025",
    constructionImpact: "Medium",
    constructionImpactDetails: "Excavation staged while bypass line is verified with Municipal Authority.",
    programmeImpact: {
      hasImpact: false,
      activityId: "ACT-064",
      activityName: "Drainage Culvert BC-04",
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
      { name: "DCP_Test_Report_Km18.pdf", size: "3.2 MB", type: "PDF" }
    ],
    createdBy: "Farhan Al-Mansoor",
    assignedTo: "Materials & Pavement Specialist",
    createdAt: new Date("2025-02-20T11:45:00Z").toISOString(),
    history: [
      {
        date: "20 Feb 2025 11:45",
        action: "Created & Submitted",
        user: "Farhan Al-Mansoor",
        details: "Subgrade test failure flagged on site."
      }
    ]
  }
];

// ============================================================================
// 4. TECHNICAL SUBMITTAL REGISTER
// ============================================================================
export const SAMPLE_TECHNICAL_SUBMITTALS: TechnicalSubmittal[] = [
  {
    id: "sub-01",
    submittalNumber: "MAT-047",
    title: "CEM I 42.5N Portland Cement (Low Heat Sulfate Resistant)",
    discipline: "structural",
    specification: "03 30 00 - Cast-in-Place Concrete",
    supplier: "Mbeya Cement Ltd",
    manufacturer: "Holcim Lafarge Group",
    submittedDate: "14 Aug 2026",
    status: "Approved",
    approvedBy: "Resident Engineer - Dr. A. Mwamba",
    approvalDate: "18 Aug 2026",
    consultantRemarks: "Approved for all substructure and pier pile cap concrete works. Mill test certificates to be supplied per 50-tonne bulk delivery.",
    revision: "Rev 0",
    documents: {
      technicalDataSheet: { attached: true, documentRef: "TDS-CEM-047" },
      testCertificate: { attached: true, documentRef: "TC-2026-881" },
      complianceCertificate: { attached: true, documentRef: "ISO-9001-CEM" },
      sampleApproval: { attached: true, documentRef: "SMP-047-A" },
      factoryAudit: { attached: true, documentRef: "AUD-2026-03" }
    },
    procurementStatus: "PO Released",
    linkedPurchaseOrder: "PO-2026-088",
    leadTimeWeeks: 2,
    criticalActivityRef: "ACT-092"
  },
  {
    id: "sub-02",
    submittalNumber: "MAT-048",
    title: "Grade B500B High Yield Deformed Reinforcement Bars (T16-T32)",
    discipline: "structural",
    specification: "03 20 00 - Concrete Reinforcing",
    supplier: "AfriSteel Rolling Mills Ltd",
    manufacturer: "AfriSteel Integrated Works",
    submittedDate: "15 Aug 2026",
    status: "Approved",
    approvedBy: "Resident Engineer - Dr. A. Mwamba",
    approvalDate: "19 Aug 2026",
    consultantRemarks: "Mechanical tensile tests and bend/rebend compliance verified in accordance with BS 4449.",
    revision: "Rev 0",
    documents: {
      technicalDataSheet: { attached: true, documentRef: "TDS-REBAR-B500B" },
      testCertificate: { attached: true, documentRef: "TC-MILL-500B" },
      complianceCertificate: { attached: true, documentRef: "CARES-CERT-091" },
      sampleApproval: { attached: true, documentRef: "SMP-BAR-01" },
      factoryAudit: { attached: true, documentRef: "AUD-AFRISTEEL" }
    },
    procurementStatus: "PO Released",
    linkedPurchaseOrder: "PO-2026-092",
    leadTimeWeeks: 3,
    criticalActivityRef: "ACT-092"
  },
  {
    id: "sub-03",
    submittalNumber: "MAT-049",
    title: "Class G5 Natural Gravel Sub-Base Material",
    discipline: "roads_pavements",
    specification: "32 11 23 - Aggregate Base Courses",
    supplier: "Kilima Quarry Borrow Pit 4",
    manufacturer: "Kilima Quarry Crushing Works",
    submittedDate: "18 Aug 2026",
    status: "Under Review",
    approvedBy: "Senior Materials Engineer",
    consultantRemarks: "Grading envelopes and Atterberg limits conform. 4-day soaked CBR results pending laboratory confirmation.",
    revision: "Rev 1",
    documents: {
      technicalDataSheet: { attached: true, documentRef: "TDS-G5-GRAVEL" },
      testCertificate: { attached: true, documentRef: "TC-LAB-CBR-91" },
      complianceCertificate: { attached: false, documentRef: "—" },
      sampleApproval: { attached: true, documentRef: "SMP-G5-PIT4" },
      factoryAudit: { attached: true, documentRef: "PIT-AUD-2026" }
    },
    procurementStatus: "Procurement Pending",
    leadTimeWeeks: 1,
    criticalActivityRef: "ACT-118"
  },
  {
    id: "sub-04",
    submittalNumber: "MAT-050",
    title: "1200mm Precast Concrete Box Culvert Units (C-04 Crossing)",
    discipline: "drainage",
    specification: "33 40 00 - Storm Drainage Piping",
    supplier: "Precast Infratech Ltd",
    manufacturer: "Precast Infratech Yard",
    submittedDate: "16 Aug 2026",
    status: "Revise and Resubmit",
    approvedBy: "Senior Drainage Engineer",
    consultantRemarks: "Proof load test certificate missing for 200 kN design axle load. Resubmit with 28-day cylinder compressive break results.",
    revision: "Rev 0",
    documents: {
      technicalDataSheet: { attached: true, documentRef: "TDS-BC-1200" },
      testCertificate: { attached: false, documentRef: "—" },
      complianceCertificate: { attached: true, documentRef: "ISO-PRECAST" },
      sampleApproval: { attached: false, documentRef: "—" },
      factoryAudit: { attached: true, documentRef: "AUD-YARD-2026" }
    },
    procurementStatus: "Quotation Under Review",
    leadTimeWeeks: 4,
    criticalActivityRef: "ACT-064"
  }
];

// ============================================================================
// 5. DESIGN REVIEWS DATASET
// ============================================================================
export const SAMPLE_DESIGN_REVIEWS: DesignReviewItem[] = [
  {
    id: "dr-01",
    referenceNumber: "DR-STR-014",
    package: "PKG-BR-02",
    packageNumber: "PKG-BR-02",
    revision: "Rev B",
    discipline: "structural",
    title: "Pier P14 Superstructure Post-Tensioned Box Girder Analysis",
    checkCategory: "Cat 3 (Independent Third Party)",
    independentCheckCategory: "Cat 3 (Independent Third Party)",
    independentCheckStatus: "Passed with Conditions",
    independentCheckerOrg: "COWI Global Bridges Ltd",
    submissionDate: "05 Aug 2026",
    approvalDate: "15 Aug 2026",
    status: "Approved with Conditions",
    signOffChain: {
      preparedBy: { name: "Thabo Nkosi", organisation: "Matrix JV", registrationNumber: "PrEng 201844", date: "05 Aug 2026", signed: true },
      checkedBy: { name: "Dr. Elena Rostova", organisation: "Design Partner", registrationNumber: "MIStructE 9821", date: "08 Aug 2026", signed: true },
      reviewedBy: { name: "COWI Checker", organisation: "COWI Ltd", registrationNumber: "Cat3 Lead", date: "12 Aug 2026", signed: true },
      approvedBy: { name: "Dr. A. Mwamba", organisation: "Consultant RE", registrationNumber: "PrEng 19992", date: "15 Aug 2026", signed: true }
    },
    findingsCount: { open: 1, resolved: 6 },
    drawingNumbers: ["STR-042 Rev C", "STR-044 Rev B"]
  },
  {
    id: "dr-02",
    referenceNumber: "DR-GEO-008",
    package: "PKG-HW-04",
    packageNumber: "PKG-HW-04",
    revision: "Rev A",
    discipline: "geotechnical",
    title: "Km 18 Deep Cut Slope Stability & Soil Nailing Design Review",
    checkCategory: "Cat 2 (Peer Check)",
    independentCheckCategory: "Cat 2 (Peer Check)",
    independentCheckStatus: "Passed",
    independentCheckerOrg: "Knight Piésold Consulting",
    submissionDate: "10 Aug 2026",
    approvalDate: "18 Aug 2026",
    status: "Approved",
    signOffChain: {
      preparedBy: { name: "Farhan Al-Mansoor", organisation: "Matrix JV", registrationNumber: "PrEng 202100", date: "10 Aug 2026", signed: true },
      checkedBy: { name: "Dr. M. Kiptoo", organisation: "Geotech Lead", registrationNumber: "PrSciNat 8820", date: "14 Aug 2026", signed: true },
      reviewedBy: { name: "Knight Piésold Peer", organisation: "Knight Piésold", registrationNumber: "Lead Reviewer", date: "16 Aug 2026", signed: true },
      approvedBy: { name: "Dr. A. Mwamba", organisation: "Consultant RE", registrationNumber: "PrEng 19992", date: "18 Aug 2026", signed: true }
    },
    findingsCount: { open: 0, resolved: 4 },
    drawingNumbers: ["GEO-019 Rev A"]
  }
];

// ============================================================================
// 6. ENGINEERING DEVIATIONS DATASET
// ============================================================================
export const SAMPLE_ENGINEERING_DEVIATIONS: EngineeringDeviation[] = [
  {
    id: "dev-01",
    deviationNumber: "DEV-014",
    title: "Substitution of CEM I 52.5N with CEM II/A-L 42.5N for Mass Concrete Blinding",
    discipline: "structural",
    specificationClause: "03 30 00 Section 2.1",
    proposedDeparture: "Use CEM II/A-L 42.5N blended limestone cement to reduce thermal hydration cracking in 1000mm mass pours.",
    engineeringJustification: "Thermal modeling demonstrates 12°C reduction in core temperature, exceeding durability requirements while satisfying 28-day 25MPa strength.",
    structuralImpactAssessment: "No adverse structural impact on non-reinforced blinding layers.",
    costScheduleImpact: "Cost-neutral; reduces water-curing cycle time by 2 days.",
    originalRequirement: "CEM I 52.5N Portland Cement throughout all civil concrete works.",
    approvedLimits: "Permitted strictly for blinding layers and non-structural mass footings.",
    status: "Approved by Engineer",
    approvedBy: "Resident Engineer - Dr. A. Mwamba",
    dateApproved: "14 Aug 2026",
    approvalDate: "14 Aug 2026",
    signOffChain: {
      preparedBy: { name: "Thabo Nkosi", organisation: "Matrix JV", registrationNumber: "PrEng 201844", date: "10 Aug 2026", signed: true },
      checkedBy: { name: "Dr. Elena Rostova", organisation: "Structural Lead", registrationNumber: "MIStructE 9821", date: "12 Aug 2026", signed: true },
      reviewedBy: { name: "Materials Specialist", organisation: "Consultant", registrationNumber: "MatEng 442", date: "13 Aug 2026", signed: true },
      approvedBy: { name: "Dr. A. Mwamba", organisation: "Consultant RE", registrationNumber: "PrEng 19992", date: "14 Aug 2026", signed: true }
    }
  },
  {
    id: "dev-02",
    deviationNumber: "DEV-015",
    title: "Reduction of Minimum Clear Cover from 50mm to 40mm on Internal Void Faces with MCI",
    discipline: "structural",
    specificationClause: "03 20 00 Section 3.2",
    proposedDeparture: "40mm cover on internal non-exposed void faces where Migrating Corrosion Inhibitor (MCI) admixtures are dosed.",
    engineeringJustification: "Weight reduction on hollow box girder walls to optimize seismic response and reduce dead load on Pier P14.",
    structuralImpactAssessment: "Carbonation modeling confirms 100-year passivation integrity in dry internal box environment.",
    costScheduleImpact: "Net saving of 14m³ concrete per span; zero schedule change.",
    originalRequirement: "50mm minimum cover on all cast concrete surfaces.",
    approvedLimits: "Internal sheltered surfaces only; external marine-exposed surfaces remain strictly 60mm.",
    status: "Pending Review",
    approvedBy: "Resident Engineer",
    signOffChain: {
      preparedBy: { name: "Thabo Nkosi", organisation: "Matrix JV", registrationNumber: "PrEng 201844", date: "16 Aug 2026", signed: true },
      checkedBy: { name: "Dr. Elena Rostova", organisation: "Structural Lead", registrationNumber: "MIStructE 9821", date: "18 Aug 2026", signed: true },
      reviewedBy: { name: "Pending", organisation: "Consultant", registrationNumber: "—", date: "—", signed: false },
      approvedBy: { name: "Pending", organisation: "Consultant RE", registrationNumber: "—", date: "—", signed: false }
    }
  }
];

// ============================================================================
// 7. DESIGN ASSUMPTIONS DATASET
// ============================================================================
export const SAMPLE_DESIGN_ASSUMPTIONS: DesignAssumption[] = [
  {
    id: "assump-01",
    assumptionNumber: "ASSUMP-01",
    assumptionCode: "ASSUMP-01",
    title: "Allowable Bearing Pressure 350 kPa at Pier P14 Pile Tip (El. 112.5m)",
    discipline: "geotechnical",
    designBasis: "Rotary diamond core drillings BH-08 indicating unweathered granodiorite rockhead at -18.5m depth.",
    validationTrigger: "High-strain dynamic pile load test (PDA) and core verification on pile P14-01 before cap pour.",
    siteTriggerHoldPoint: "Pile Cap Reinforcement Hold Point HP-GEO-04",
    targetLocation: "Pier P14, Km 14+250",
    verifiedEvidenceRef: "PDA-TEST-P14-01",
    status: "Awaiting Site Verification",
    actionOwner: "Lead Geotechnical Engineer",
    criticality: "High",
    impactLevel: "High"
  },
  {
    id: "assump-02",
    assumptionNumber: "ASSUMP-02",
    assumptionCode: "ASSUMP-02",
    title: "Subgrade G7 Minimum CBR 7% at 93% Mod AASHTO (Km 18-20)",
    discipline: "roads_pavements",
    designBasis: "Preliminary site investigation trial pit samples TP-12 to TP-18 showing clayey gravel.",
    validationTrigger: "In-situ Dynamic Cone Penetrometer (DCP) testing at 50m intervals along subgrade formation.",
    siteTriggerHoldPoint: "Subgrade Layerworks Inspection Hold Point HP-PAV-02",
    targetLocation: "Km 18+200 - 18+600",
    verifiedEvidenceRef: "DCP-REPORT-KM18",
    status: "Invalidated - Action Required",
    actionOwner: "Senior Materials Engineer",
    criticality: "Critical",
    impactLevel: "Critical"
  },
  {
    id: "assump-03",
    assumptionNumber: "ASSUMP-03",
    assumptionCode: "ASSUMP-03",
    title: "Design Peak Runoff Inflow Q50 = 4.8 m³/s at Box Culvert BC-04",
    discipline: "drainage",
    designBasis: "Rational method catchment calculations using 25-minute catchment time of concentration.",
    validationTrigger: "Culvert invert and backwater flood elevation verification against 2026 satellite terrain model.",
    siteTriggerHoldPoint: "Culvert Headwall Excavation Verification",
    targetLocation: "Chainage Km 14+200",
    verifiedEvidenceRef: "HYD-REPORT-BC04",
    status: "Validated on Site",
    actionOwner: "Senior Drainage Engineer",
    criticality: "Medium",
    impactLevel: "Medium"
  }
];

// ============================================================================
// 8. TEMPORARY WORKS DATASET
// ============================================================================
export const SAMPLE_TEMPORARY_WORKS: TemporaryWorksItem[] = [
  {
    id: "tw-01",
    twNumber: "TW-012",
    itemNumber: "TW-012",
    title: "Pier P14 Heavy Falsework & Cofferdam Shoring System",
    discipline: "structural",
    category: "Cat 3",
    checkCategory: "Cat 3",
    location: "Pier P14, Chainage Km 14+250",
    temporaryWorksCoordinator: "Johan Van Der Merwe (Matrix TWC)",
    temporaryWorksDesigner: "RMD Kwikform Engineering (TWD)",
    independentChecker: "Buro Happold Temporary Works",
    permitNumber: "PTL-2026-044",
    permitToLoadIssued: true,
    permitToLoadDate: "14 Aug 2026",
    permitToStrikeIssued: false,
    inspectionStatus: "Inspected & Certified",
    signOffChain: {
      preparedBy: { name: "RMD Designer", organisation: "RMD Kwikform", registrationNumber: "TWD-881", date: "10 Aug 2026", signed: true },
      checkedBy: { name: "Buro Happold Checker", organisation: "Buro Happold", registrationNumber: "TWC-Cat3", date: "12 Aug 2026", signed: true },
      reviewedBy: { name: "Johan Van Der Merwe", organisation: "Matrix JV", registrationNumber: "PrEng TWC", date: "13 Aug 2026", signed: true },
      approvedBy: { name: "Resident Engineer", organisation: "Consultant", registrationNumber: "RE-PrEng", date: "14 Aug 2026", signed: true }
    }
  }
];

// ============================================================================
// 9. CONSTRUCTABILITY REVIEWS DATASET
// ============================================================================
export const SAMPLE_CONSTRUCTABILITY_REVIEWS: ConstructabilityReview[] = [
  {
    id: "cr-01",
    reviewNumber: "CR-08",
    title: "Pier P14 Heavy Lift Mobile Crane Outrigger Bearing Pressure on Riverbank",
    discipline: "structural",
    identifiedHazard: "500-tonne crawler crane outrigger loading (380 kN/m²) exceeds riverside soft alluvium capacity during girder erection.",
    proposedMitigation: "Install 300mm reinforced concrete crane spreader mat over 500mm compacted rockfill platform.",
    severity: "Critical",
    status: "Mitigation Incorporated"
  }
];

// ============================================================================
// 10. ENGINEERING DESIGN CHANGES DATASET
// ============================================================================
export const SAMPLE_ENGINEERING_DESIGN_CHANGES: EngineeringDesignChange[] = [
  {
    id: "dcn-01",
    changeNumber: "DC-017",
    title: "900mm to 1200mm Precast Box Culvert Upsizing (C-04 Crossing)",
    discipline: "drainage",
    status: "APPROVED",
    dateRaised: "10 Aug 2026",
    location: "Chainage Km 14+200",
    reason: "Revised upstream hydrology catchment modeling necessitates increased hydraulic flow area to prevent road overtopping during 1:50 year storm events.",
    reasonForChange: "Revised upstream hydrology catchment modeling necessitates increased hydraulic flow area.",
    consultantApprovedBy: "Resident Engineer - Dr. A. Mwamba",
    consultantApprovalDate: "14 Aug 2026",
    technical: {
      whatChanged: "Replaced 900mm pipe culvert with 1200mm precast box culvert units; increased inlet drop pit capacity by 40%.",
      drawingRevisions: ["DRN-104 Rev B", "DRN-105 Rev A"],
      specAmendments: ["Spec 33 40 00 Section 3.2"],
      approvalStatus: "APPROVED",
      technicalSignOff: "Senior Drainage Engineer"
    },
    commercialImpact: {
      hasImpact: true,
      potentialVariation: true,
      costImpact: 42000,
      estimatedCostImpact: 42000,
      netCostDelta: 42000,
      variationClause: "FIDIC Sub-Clause 13.1 (Right to Vary)",
      currency: "USD"
    },
    programmeImpact: {
      doesChangeDuration: false,
      durationImpactDays: 0,
      scheduleDeltaDays: 0,
      criticalPathImpact: false,
      affectedActivities: ["ACT-064 Culvert C-04"]
    }
  },
  {
    id: "dcn-02",
    changeNumber: "DC-018",
    title: "Pier P14 Pile Cap Starter Bar Modification (T32 @ 150mm c/c)",
    discipline: "structural",
    status: "UNDER_REVIEW",
    dateRaised: "22 Feb 2025",
    location: "Pier P14, Chainage Km 14+250",
    reason: "Resolving discrepancy between contract drawing STR-042 Rev C and bar bending schedule BBS-STR-014.",
    reasonForChange: "Resolving discrepancy between contract drawing STR-042 Rev C and bar bending schedule BBS-STR-014.",
    technical: {
      whatChanged: "Adopt T32 starter bars at 150mm pitch into pile cap; lengthen development lap to 1280mm.",
      drawingRevisions: ["STR-042 Rev D"],
      specAmendments: ["Spec 03 30 00 Clause 4.2"],
      approvalStatus: "UNDER REVIEW",
      technicalSignOff: "Structural Lead"
    },
    commercialImpact: {
      hasImpact: true,
      potentialVariation: true,
      costImpact: 35000,
      estimatedCostImpact: 35000,
      netCostDelta: 35000,
      variationClause: "FIDIC Sub-Clause 1.9 (Delayed Drawings or Instructions)",
      currency: "USD"
    },
    programmeImpact: {
      doesChangeDuration: true,
      durationImpactDays: 3,
      scheduleDeltaDays: 3,
      criticalPathImpact: true,
      affectedActivities: ["ACT-092 Substructure Pier P14"]
    }
  }
];

// ============================================================================
// 11. DIGITAL TRACEABILITY CHAIN DATASET
// ============================================================================
export const SAMPLE_DIGITAL_TRACEABILITY_CHAIN: DigitalTraceabilityItem[] = [
  {
    id: "dt-01",
    elementRef: "PIER-P14-CAP",
    elementName: "Pier P14 Pile Cap Reinforced Concrete",
    location: "Chainage Km 14+250",
    drawingRef: "STR-042 Rev C",
    drawingRevision: "Rev C",
    drawingTitle: "Pier P14 Substructure Details",
    discipline: "structural",
    specificationRef: "03 30 00",
    specificationTitle: "Cast-in-Place Structural Concrete",
    methodStatementRef: "MS-STR-014",
    methodStatementTitle: "Substructure Concrete Pouring & Curing",
    itpRef: "ITP-STR-004",
    inspectionRequestRef: "IR-STR-284",
    cubeTestRef: "CT-STR-488 (45MPa at 28d)",
    asBuiltSurveyRef: "AB-STR-042",
    settingOutRef: "SO-STR-092",
    overallTraceabilityStatus: "Inspection Pending"
  }
];

// ============================================================================
// 12. SETTING OUT & SURVEY RECORDS
// ============================================================================
export const SAMPLE_SETTING_OUT_RECORDS: SettingOutRecord[] = [
  {
    id: "so-01",
    referenceNumber: "SO-STR-092",
    recordNumber: "SO-STR-092",
    elementName: "Pier P14 Pile Cap Centerline & Edges",
    location: "Chainage Km 14+250",
    discipline: "structural",
    chainage: "Km 14+250",
    offset: "0.00m CL",
    designedEasting: 524250.300,
    designedNorthing: 8413010.550,
    designedElevation: 142.450,
    measuredEasting: 524250.304,
    measuredNorthing: 8413010.548,
    measuredElevation: 142.451,
    deltaEastingMm: 4,
    deltaNorthingMm: -2,
    deltaElevationMm: 1,
    toleranceMm: 10,
    status: "PASSED (Within Tolerance)",
    toleranceStatus: "PASSED",
    surveyor: "Mpho Dlamini (PLS Geomatic 4019)",
    instrumentUsed: "Leica TS16 1-sec Total Station",
    pointsStaked: 8,
    consultantWitnessedBy: "Resident Survey Inspector",
    date: "22 Feb 2025"
  },
  {
    id: "so-02",
    referenceNumber: "SO-DRN-044",
    recordNumber: "SO-DRN-044",
    elementName: "Culvert BC-04 Upstream Invert & Headwall",
    location: "Chainage Km 14+200",
    discipline: "drainage",
    chainage: "Km 14+200",
    offset: "-12.50m Left",
    designedEasting: 524200.180,
    designedNorthing: 8412980.210,
    designedElevation: 138.920,
    measuredEasting: 524200.182,
    measuredNorthing: 8412980.208,
    measuredElevation: 138.918,
    deltaEastingMm: 2,
    deltaNorthingMm: -2,
    deltaElevationMm: -2,
    toleranceMm: 15,
    status: "PASSED (Within Tolerance)",
    toleranceStatus: "PASSED",
    surveyor: "Mpho Dlamini (PLS Geomatic 4019)",
    instrumentUsed: "Leica TS16 1-sec Total Station",
    pointsStaked: 6,
    consultantWitnessedBy: "Resident Survey Inspector",
    date: "19 Feb 2025"
  }
];

// ============================================================================
// 13. EARTHWORK VOLUME COMPARISONS
// ============================================================================
export const SAMPLE_EARTHWORK_VOLUMES: EarthworkVolumeComparison[] = [
  {
    id: "ew-01",
    sectionName: "Highway Cut Section Km 12+000 to 14+500",
    title: "Highway Cut Section Km 12+000 to 14+500",
    discipline: "civil",
    cutFillType: "CUT",
    designVolumeM3: 148000,
    surveyedVolumeM3: 142500,
    varianceVolumeM3: -5500,
    percentVariance: -3.7,
    surveyMethod: "UAV LiDAR & RTK Ground Truthing",
    surveyDate: "15 Aug 2026",
    status: "WITHIN_TOLERANCE",
    approvedBy: "Senior Geomatics Surveyor"
  }
];

// ============================================================================
// 14. DRONE FLIGHT SURVEYS
// ============================================================================
export const SAMPLE_DRONE_FLIGHTS: DroneFlightSurvey[] = [
  {
    id: "df-01",
    missionName: "Corridor Flight 04 - Km 10 to 16 Orthomosaic",
    flightDate: "16 Aug 2026",
    pilotInCommand: "Mpho Dlamini (Licensed Drone Operator)",
    uavModel: "DJI Matrice 300 RTK + Zenmuse P1",
    groundSampleDistanceCm: 1.8,
    areaSurveyedHa: 85,
    pointCloudDensityPtsM2: 140,
    processedOutputs: ["True Orthomosaic TIF", "DSM GeoTIFF", "Classified Point Cloud LAS"]
  }
];

// ============================================================================
// 15. SURVEY CONTROL POINTS
// ============================================================================
export const SAMPLE_CONTROL_POINTS: SurveyControlPoint[] = [
  {
    id: "cp-01",
    pointId: "CP-01",
    type: "Primary Geodetic Monument Pillar",
    description: "Primary Datum - Concrete Pillar with Brass Tablet (WGS84 UTM 36S)",
    easting: 524180.2450,
    northing: 8412950.8820,
    elevation: 142.4500,
    order: "1st Order Geodetic",
    lastVerifiedDate: "10 Aug 2026",
    status: "VERIFIED"
  },
  {
    id: "cp-02",
    pointId: "CP-02",
    type: "Secondary Benchmark Pillar",
    description: "North Bridge Abutment Approach Pillar",
    easting: 524820.6120,
    northing: 8413410.1240,
    elevation: 158.1200,
    order: "2nd Order Traversing",
    lastVerifiedDate: "10 Aug 2026",
    status: "VERIFIED"
  },
  {
    id: "cp-03",
    pointId: "TBM-04",
    type: "Temporary Benchmark",
    description: "Stainless Steel Pin in Culvert C-04 Wingwall",
    easting: 525200.1800,
    northing: 8413800.4500,
    elevation: 138.9200,
    order: "3rd Order Construction Leveling",
    lastVerifiedDate: "18 Aug 2026",
    status: "VERIFIED"
  },
  {
    id: "cp-04",
    pointId: "TBM-05",
    type: "Temporary Benchmark",
    description: "Chiseled Cross on Pier P14 Pile Cap Substructure",
    easting: 524250.3100,
    northing: 8413010.5600,
    elevation: 142.6100,
    order: "3rd Order Construction Leveling",
    lastVerifiedDate: "22 Feb 2025",
    status: "VERIFIED"
  }
];

// ============================================================================
// 16. EQUIPMENT CALIBRATIONS
// ============================================================================
export const SAMPLE_EQUIPMENT_CALIBRATIONS: SurveyEquipmentCalibration[] = [
  {
    id: "eq-01",
    instrumentName: "Leica TS16 1-sec Robotic Total Station",
    serialNumber: "TS16-894022",
    calibrationDate: "15 Jan 2026",
    nextDueDate: "15 Jan 2027",
    calibratedBy: "Leica Geosystems Authorized Calibration Lab",
    certificateNumber: "CAL-TS16-2026-081",
    status: "VALID"
  },
  {
    id: "eq-02",
    instrumentName: "Trimble R12i GNSS Receiver & Base Station",
    serialNumber: "TRMB-R12-4410",
    calibrationDate: "02 Feb 2026",
    nextDueDate: "02 Feb 2027",
    calibratedBy: "Trimble Africa Support Facility",
    certificateNumber: "CAL-R12-9920",
    status: "VALID"
  }
];

// Convenient export aliases
export const SAMPLE_CHANGE_NOTICES = SAMPLE_ENGINEERING_DESIGN_CHANGES;
export const SAMPLE_TRACEABILITY_ITEMS = SAMPLE_DIGITAL_TRACEABILITY_CHAIN;
export const SAMPLE_EARTHWORKS_SURVEYS = SAMPLE_EARTHWORK_VOLUMES;
export const SAMPLE_DRONE_MISSIONS = SAMPLE_DRONE_FLIGHTS;
export const SAMPLE_PROJECT_DISCIPLINES = INITIAL_PROJECT_DISCIPLINE_CONFIGS;
