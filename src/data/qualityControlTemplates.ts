import { QualityControlTemplate } from "../types/qualityControl";

export const QUALITY_CONTROL_TEMPLATES: QualityControlTemplate[] = [
  // --- ROADS AND EARTHWORKS ---
  {
    id: "road-setting-out",
    title: "Setting Out of Works",
    category: "Roads & Earthworks",
    documentRef: "QC-RD-001",
    revision: "Rev 2",
    revisionDate: "2026-03-12",
    description: "Inspection sheet for verifying horizontal and vertical alignment of roadworks, coordinate pegs, benchmarks, and control points.",
    customFields: [
      { name: "stationFrom", label: "Station/Chainage From", type: "text", placeholder: "e.g. km 12+400" },
      { name: "stationTo", label: "Station/Chainage To", type: "text", placeholder: "e.g. km 14+200" },
      { name: "benchMarkUsed", label: "Reference Bench Mark", type: "text", placeholder: "e.g. TBM-4B (Elev: 1045.22m)" },
      { name: "surveyInstrumentRef", label: "Survey Instrument Serial/Ref", type: "text" },
      { name: "alignmentOffset", label: "Design Alignment Offset (mm)", type: "number" },
      { name: "tolerancePermitted", label: "Tolerance Permitted (mm)", type: "number", defaultValue: "20" }
    ],
    checklistItems: [
      "Establishment of primary benchmarks and validation of coordinates",
      "Transfer of levels to local temporary control points (TBMs)",
      "Setting out of road centerline pegs and alignment stakes",
      "Setting out of batters, fill slopes, and catch water drains",
      "Checking of curves, tangents, and superelevation transition points",
      "Verification of clearances from site boundaries and utilities",
      "Double-checking coordinates via independent GPS/Total Station checks",
      "Validation of peg heights and vertical curve benchmarks"
    ]
  },
  {
    id: "road-layer-work",
    title: "Layer Work Testing",
    category: "Roads & Earthworks",
    documentRef: "QC-RD-002",
    revision: "Rev 1",
    revisionDate: "2025-11-04",
    description: "Compaction and layer thickness inspection for subgrade, sub-base, and base layers of roadway structures.",
    customFields: [
      { name: "layerNumber", label: "Layer Name/Number", type: "select", options: ["Subgrade", "Selected Subgrade", "Sub-base Lower", "Sub-base Upper", "Base G1/G2", "Base G4"] },
      { name: "roadLane", label: "Road & Lane Direction", type: "text", placeholder: "e.g. Main Highway Northbound, Left Lane" },
      { name: "chainage", label: "Chainage / Station", type: "text", placeholder: "e.g. km 15+350" },
      { name: "materialClassification", label: "Material Classification (G1-G10)", type: "text", defaultValue: "G4" },
      { name: "specifiedDensity", label: "Specified Mod AASHTO Density (%)", type: "number", defaultValue: "98" },
      { name: "actualDensity", label: "Actual Field Density (%)", type: "number" },
      { name: "moistureContent", label: "Optimum Moisture Content (OMC %)", type: "number" }
    ],
    checklistItems: [
      "Material source validation and visual grading assessment",
      "Moisture content uniform across layer prior to compaction",
      "Compaction effort, roller patterns, and passes verification",
      "Nuclear Gauge or Sand Replacement density test compliance",
      "Layer thickness dip checks within tolerance limit",
      "Surface finish free of loose material, segregation, or cracking",
      "Dynamic Cone Penetrometer (DCP) values or proof rolling checks"
    ],
    hasMeasurementColumns: true
  },
  {
    id: "road-stabilization",
    title: "Stabilization",
    category: "Roads & Earthworks",
    documentRef: "QC-RD-003",
    revision: "Rev 2",
    revisionDate: "2026-01-20",
    description: "Quality verification for chemical stabilization (cement, lime, emulsion) of pavement layers, including mixing, moisture, and curing.",
    customFields: [
      { name: "stabilizingAgent", label: "Stabilizing Agent Type", type: "select", options: ["Cement CEM II 32.5N", "Road Lime", "Bitumen Emulsion", "Other"] },
      { name: "spreadRateSpecified", label: "Specified Spread Rate (kg/m²)", type: "number" },
      { name: "spreadRateActual", label: "Measured Spread Rate (kg/m²)", type: "number" },
      { name: "mixingDepth", label: "Specified Mixing Depth (mm)", type: "number", defaultValue: "150" },
      { name: "curingMethod", label: "Curing Method & Duration", type: "text", placeholder: "e.g. Water spraying 7 days" }
    ],
    checklistItems: [
      "Roadbed surface prepared, shaped, and checked before agent application",
      "Bags spotting or bulk spreading layout checked for correct dosage",
      "Mixing machine depth controls verified and material uniformly blended",
      "Moisture checks performed during mixing to meet OMC specifications",
      "Compaction completed within maximum allowable time from water addition",
      "Curing process initiated immediately (constant dampness or emulsion seal)",
      "In-situ UCS/compaction tests taken as per frequency plan"
    ],
    hasMeasurementColumns: true
  },
  {
    id: "road-traffic-accommodation",
    title: "Traffic Accommodation",
    category: "Roads & Earthworks",
    documentRef: "QC-RD-004",
    revision: "Rev 3",
    revisionDate: "2026-05-15",
    description: "Traffic safety and detour inspection check sheet ensuring alignment with statutory road traffic management guides.",
    customFields: [
      { name: "deviationLength", label: "Detour/Deviation Length (km)", type: "text" },
      { name: "trafficPlanApproval", label: "Approved Traffic Plan Ref", type: "text" },
      { name: "speedLimitEnforced", label: "Speed Limit Enforced (km/h)", type: "number", defaultValue: "60" },
      { name: "safetyOfficer", label: "Site Traffic Safety Officer", type: "text" }
    ],
    checklistItems: [
      "Advance warning signs clean, visible, and placed at specified intervals",
      "Delineators, cones, and flashing beacons spacing & alignment",
      "Flagmen equipped, visible, and actively directing traffic as trained",
      "Detour road surface well-graded, watered for dust, and free of potholes",
      "Temporary concrete barriers/fences secure and reflecting properly",
      "Safe pedestrian paths and crossings provided where applicable",
      "Night-time illumination and reflective tape on barriers checked",
      "Emergency contact numbers displayed prominently"
    ]
  },
  {
    id: "road-asphalt-paving",
    title: "Asphalt Paving Records",
    category: "Roads & Earthworks",
    documentRef: "QC-RD-005",
    revision: "Rev 1",
    revisionDate: "2025-08-11",
    description: "Detailed operational log for laying of hot-mix asphalt (surfacing or binder course) including batch delivery temperatures and compaction rolling.",
    customFields: [
      { name: "asphaltMixType", label: "Asphalt Mix Type / Design", type: "text", placeholder: "e.g. Medium Stone Continuously Graded with AP-1" },
      { name: "bitumenGrade", label: "Bitumen Grade / Modifier", type: "text", defaultValue: "50/70" },
      { name: "tackCoatType", label: "Tack Coat Type & Spray Rate", type: "text", placeholder: "e.g. Cat-65 @ 0.4 L/m²" },
      { name: "layingTemperature", label: "Minimum Laying Temp (°C)", type: "number", defaultValue: "135" },
      { name: "rollerTypes", label: "Roller Fleet Used", type: "text", placeholder: "e.g. 1 Steel-drum, 1 Pneumatic, 1 Oscillation" }
    ],
    checklistItems: [
      "Sub-base/base swept clean and dry; tack coat applied uniformly",
      "Delivery trucks covered, temperature checked on arrival (>150°C)",
      "Paving speed, screed pre-heating, and level sensors active",
      "Breakdown rolling (steel wheel) executed at maximum warm temp",
      "Intermediate rolling (pneumatic tyre) completed for dense packing",
      "Finishing rolling (static steel) eliminated all roller marks",
      "Transverse and longitudinal joint cuts prepared and painted",
      "Core samples cut for thickness and lab density correlation"
    ],
    hasMeasurementColumns: true
  },
  {
    id: "road-sealwork",
    title: "Sealwork Records",
    category: "Roads & Earthworks",
    documentRef: "QC-RD-006",
    revision: "Rev 1",
    revisionDate: "2025-09-02",
    description: "Quality records for spray chip seals, slurry seals, or cape seals, tracking bitumen spray rates and aggregate cover.",
    customFields: [
      { name: "binderType", label: "Binder Type / Grade", type: "text", placeholder: "e.g. S-E1 Polymer Modified Bitumen" },
      { name: "sprayRateSpecified", label: "Specified Binder Spray Rate (L/m²)", type: "number" },
      { name: "sprayRateActual", label: "Actual Binder Spray Rate (L/m²)", type: "number" },
      { name: "stoneSize", label: "Stone Aggregate Size (mm)", type: "select", options: ["19mm", "13.2mm", "9.5mm", "6.7mm", "Slurry Sand"] },
      { name: "stoneSpreadRate", label: "Specified Aggregate Spread Rate (m³/m²)", type: "text" }
    ],
    checklistItems: [
      "Base/road surface swept extensively with mechanical broom",
      "Bitumen distributor spray-bar jets aligned and calibrated",
      "Binder spraying temperature verified to grade requirements",
      "Spray run overlap limits protected with paper/plastic plates",
      "Aggregate spreader distribution uniform immediately behind spray",
      "Heavy pneumatic tyre rolling initiated immediately for stone embedding",
      "No bleeding, aggregate peeling, or double spraying observed",
      "Sweeping of loose excess stones executed prior to opening to traffic"
    ]
  },
  {
    id: "road-level-dip",
    title: "Level Dip Check Sheet",
    category: "Roads & Earthworks",
    documentRef: "QC-RD-007",
    revision: "Rev 2",
    revisionDate: "2026-02-14",
    description: "Pavement level tolerance evaluation verifying actual layer elevation versus theoretical design profiles at distinct offset grids.",
    customFields: [
      { name: "stationRange", label: "Chainage Station Range Checked", type: "text", placeholder: "e.g. km 24+000 to km 24+500" },
      { name: "layerUnderCheck", label: "Layer Under Check", type: "text", defaultValue: "Sub-base Upper Layer" },
      { name: "allowableTolerance", label: "Allowable Level Tolerance (mm)", type: "number", defaultValue: "15" },
      { name: "referenceDatum", label: "Reference Datum Bench Mark", type: "text" }
    ],
    checklistItems: [
      "Survey control points and instrument levels verified before check",
      "Centerline levels checked and deviation recorded within tolerance",
      "Left edge pavement elevations checked and recorded",
      "Right edge pavement elevations checked and recorded",
      "Crossfall percentage measured and verified to standard drawing",
      "Low/high spots marked on road surface for correction (cutting/filling)",
      "Re-survey carried out on areas requiring correction"
    ],
    hasMeasurementColumns: true
  },
  {
    id: "road-earthworks-layer",
    title: "Earthworks: Layer Work Testing",
    category: "Roads & Earthworks",
    documentRef: "QC-RD-008",
    revision: "Rev 2",
    revisionDate: "2025-10-30",
    description: "Inspection record for general bulk earthworks fill, cut-to-fill, and structural embankment layer compacting.",
    customFields: [
      { name: "borrowSource", label: "Material Borrow Pit Source", type: "text", placeholder: "e.g. Borrow Pit B-3" },
      { name: "embankmentZone", label: "Embankment Zone / Area", type: "text", placeholder: "e.g. Bridge Abutment Fill Area A" },
      { name: "gClassification", label: "Soil Class (TRH14)", type: "text", defaultValue: "G7 / G9" },
      { name: "compactionStandard", label: "Specified Min Compaction (% Mod)", type: "number", defaultValue: "93" }
    ],
    checklistItems: [
      "Stripping of topsoil and removal of organic roots completed to depth",
      "Prior layer approved, ripped or scarred for proper layer bonding",
      "Fill material free of boulders (>100mm), clay lumps, and garbage",
      "Uncompacted lift thickness within maximum limits (e.g. 200mm)",
      "Moisture addition/drying mixed thoroughly to achieve OMC",
      "Compaction rolling patterns and equipment appropriate for soil type",
      "Density test locations recorded with chainages and offsets"
    ],
    hasMeasurementColumns: true
  },
  {
    id: "road-inspection-request",
    title: "Inspection Request",
    category: "Roads & Earthworks",
    documentRef: "QC-RD-009",
    revision: "Rev 4",
    revisionDate: "2026-04-01",
    description: "Formal document requested by Contractor for Resident Engineer's approval to proceed to the next stage of road construction works.",
    customFields: [
      { name: "proposedActivity", label: "Activity Requested For Inspection", type: "text", placeholder: "e.g. Pouring of subgrade layer G7" },
      { name: "drawingRefs", label: "Relevant Design Drawing No.", type: "text" },
      { name: "inspectionDateTime", label: "Contractor Requested Inspection Time", type: "text", placeholder: "e.g. 2026-07-11 at 10:00" },
      { name: "contractorRep", label: "Contractor Rep Submitting Request", type: "text" }
    ],
    checklistItems: [
      "Prior layer/test results signed off and attached",
      "All horizontal and vertical controls laid out and marked",
      "Required on-site testing (slump, compaction, etc.) resources ready",
      "All health, safety and environmental barriers in place",
      "Contractor's self-inspection checklist completed and signed off",
      "Subgrade, base, or structure surfaces clean of debris/unsuitable matter"
    ]
  },

  // --- CONCRETE AND STRUCTURES ---
  {
    id: "concrete-culverts",
    title: "Pre-Concreting — Culverts and Drains",
    category: "Concrete & Structures",
    documentRef: "QC-CS-001",
    revision: "Rev 2",
    revisionDate: "2026-02-18",
    description: "Inspection checklist prior to pouring concrete for portal culverts, pipe culvert headwalls, and concrete-lined roadside drains.",
    customFields: [
      { name: "structureId", label: "Culvert / Drain ID & Location", type: "text", placeholder: "e.g. Culvert No. 3, km 18+220" },
      { name: "concreteGrade", label: "Concrete Grade (Strength MPa)", type: "text", defaultValue: "25/19" },
      { name: "excavationDepth", label: "Trench/Excavation Depth (mm)", type: "number" },
      { name: "beddingClass", label: "Bedding Concrete Class", type: "text", defaultValue: "Class 15/19" }
    ],
    checklistItems: [
      "Excavation to correct grade, alignment, and native foundation dry and firm",
      "Geotextile fabric placed, overlapped, and weighted properly (if required)",
      "Granular or concrete bedding layer cast and verified to correct invert levels",
      "Portal culvert units or pipes correctly aligned with joints properly sealed",
      "Formwork sturdy, correctly sized, cleaned, oiled, and braced against shifting",
      "Steel reinforcing bars matching drawings (size, spacing, splice lengths, covers)",
      "Plumbing sleeves, weep holes, joints, and cast-in fittings correctly placed",
      "Slump cones, cube molds, and vibrators checked and ready at pouring point"
    ]
  },
  {
    id: "concrete-watertight",
    title: "Water-Tight Test for Liquid Retaining Structures",
    category: "Concrete & Structures",
    documentRef: "QC-CS-002",
    revision: "Rev 1",
    revisionDate: "2025-10-15",
    description: "Hydrostatic leakage testing procedure for liquid-retaining structures such as water tanks, reservoirs, and sump boxes.",
    customFields: [
      { name: "structureRef", label: "Structure Reference / Name", type: "text", placeholder: "e.g. Potable Water Reservoir 1" },
      { name: "capacity", label: "Structure Water Capacity (m³)", type: "number" },
      { name: "testDuration", label: "Specified Test Duration (Hours)", type: "number", defaultValue: "72" },
      { name: "allowableDrop", label: "Permissible Water Level Drop (mm)", type: "number", defaultValue: "10" },
      { name: "actualDrop", label: "Measured Water Level Drop (mm)", type: "number" }
    ],
    checklistItems: [
      "Structure interior swept clean, all formwork ties sealed, and debris removed",
      "Structure filled slowly in stages (e.g. 1m depth per 24 hours) to avoid stress",
      "Stabilization/absorption period completed (minimum 24 to 48 hours)",
      "Reference benchmark established on wall with a metal scale/pointer hook",
      "Evaporation control container (floating jar) filled and placed on water surface",
      "All external walls, corners, joints, and pipe penetrations inspected for dampness",
      "Inlet and outlet valves fully blanked off and monitored to prevent back-flow",
      "Final drop calculated adjusting for evaporation and compared against allowable"
    ],
    hasMeasurementColumns: true
  },
  {
    id: "concrete-structures",
    title: "Pre-Concreting — Structures",
    category: "Concrete & Structures",
    documentRef: "QC-CS-003",
    revision: "Rev 3",
    revisionDate: "2026-05-10",
    description: "Comprehensive QA sheet for heavy reinforced concrete structures (bridge decks, piers, abutments, columns, slabs).",
    customFields: [
      { name: "structureName", label: "Structure / Element Name", type: "text", placeholder: "e.g. Bridge No. 2, Abutment A Deck S1" },
      { name: "concreteGrade", label: "Concrete Grade / Strength", type: "text", defaultValue: "35/20" },
      { name: "slumpSpecified", label: "Specified Slump (mm)", type: "number", defaultValue: "100" },
      { name: "estimatedVolume", label: "Estimated Pour Volume (m³)", type: "number" },
      { name: "curingMethod", label: "Proposed Curing Method", type: "text", defaultValue: "Wet burlap & plastic sheeting" }
    ],
    checklistItems: [
      "Formwork secure, watertight, free of gaps, with level alignment within 5mm",
      "Formwork release agent applied without coating the steel rebar",
      "Rebar size, grade, spacing, hook details matching structural bending schedule",
      "Concrete cover spacers/chairs placed at correct frequency (>4 per m²)",
      "All structural joints, water stops, expansion joints, dowel bars installed",
      "Embedded items, anchor bolts, conduits, and pipe sleeves secured to plan",
      "Pour face clean of wood chips, soil, water, wire ties, and leaves",
      "Working vibrators on site (minimum 2) with a functional backup unit",
      "Slump cones, thermometer, scoop, and concrete test cube molds (min 6) prepared"
    ]
  },

  // --- SURVEYING AND TESTING ---
  {
    id: "survey-asbuilt",
    title: "As-Built Level Survey",
    category: "Surveying & Testing",
    documentRef: "QC-ST-001",
    revision: "Rev 2",
    revisionDate: "2026-01-11",
    description: "Post-construction survey log checking finished grade levels, positions, and coordinates against theoretical designs.",
    customFields: [
      { name: "surveySection", label: "Surveyed Section / Block", type: "text", placeholder: "e.g. Sewer Main Run MH-04 to MH-05" },
      { name: "surveyor", label: "Registered Land Surveyor", type: "text" },
      { name: "instrumentRef", label: "Total Station / GPS Calibration Ref", type: "text" },
      { name: "coordinateSystem", label: "Coordinate Reference System", type: "text", defaultValue: "WGS 84 / UTM Zone 35S" }
    ],
    checklistItems: [
      "Survey linked to approved government or baseline coordinate benchmarks",
      "As-built horizontal coordinates match layout within specified tolerance",
      "As-built vertical elevations checked against design grade levels",
      "Invert levels of stormwater, sewer, or water pipes measured and compared",
      "Coordinates and levels of structures (plinths, anchors, corners) checked",
      "Cross-fall slope gradients and flow directions verify gravity drainage",
      "As-built survey plan drawings prepared, signed and annexed"
    ],
    hasMeasurementColumns: true
  },
  {
    id: "survey-dye-penetration",
    title: "Dye Penetration Test",
    category: "Surveying & Testing",
    documentRef: "QC-ST-002",
    revision: "Rev 1",
    revisionDate: "2025-07-28",
    description: "Non-destructive testing (NDT) report for weld integrity on steel pipes, steel linings, and structural steel connections.",
    customFields: [
      { name: "weldRef", label: "Weld Joint Reference No.", type: "text", placeholder: "e.g. Pipeline Joint WJ-104" },
      { name: "componentType", label: "Component Description", type: "text", placeholder: "e.g. 500mm Steel Pipe Sleeve" },
      { name: "welderID", label: "Welder Qualification ID", type: "text" },
      { name: "dyeBrand", label: "NDT Dye Penetrant Brand/Type", type: "text", defaultValue: "Magnaflux SKL-SP2" },
      { name: "developerType", label: "Developer Brand/Type", type: "text", defaultValue: "SKD-S2" }
    ],
    checklistItems: [
      "Weld surface ground smooth, free of slag, rust, oil, water, or spatter",
      "Weld pre-cleaning solvent applied and surface thoroughly dried",
      "Red dye penetrant sprayed uniformly over entire weld area and HAZ",
      "Dwell time observed strictly (minimum 10 to 15 minutes)",
      "Excess penetrant wiped clean using dry lint-free cloth and solvent-damp cloth",
      "Developer sprayed in a thin, uniform white layer over dry weld",
      "Weld inspected after 10-20 minutes for color indications (cracks, porosity)",
      "Evaluation findings recorded and marked on weld (Acceptable or Reject)"
    ],
    hasMeasurementColumns: true
  },
  {
    id: "survey-xray-welding",
    title: "X-Ray Testing for Welding",
    category: "Surveying & Testing",
    documentRef: "QC-ST-003",
    revision: "Rev 1",
    revisionDate: "2025-09-08",
    description: "Radiographic testing log tracking weld joints subjected to radiographic radiography, mapping internal voids and crack defects.",
    customFields: [
      { name: "jointNo", label: "Weld Joint Reference(s)", type: "text", placeholder: "e.g. High Pressure Pipe Joint J-45 to J-48" },
      { name: "welderID", label: "Welder Certification Code", type: "text" },
      { name: "radiationSource", label: "Isotope Source / Radiation Type", type: "select", options: ["Iridium-192", "Cobalt-60", "X-Ray Machine"] },
      { name: "filmType", label: "Radiographic Film Type", type: "text" },
      { name: "evaluationStandard", label: "AWS / API Design Standard Used", type: "text", defaultValue: "API 1104 / ASME Section IX" }
    ],
    checklistItems: [
      "Work area fully barriered off, warning signs posted, and radiation safety clearance active",
      "Joint surface clean, free of slag, and numbered with lead markers",
      "Film and penetrameter (IQI) correctly placed over joint as per specification",
      "Exposure angle, distance, and duration calculated and executed properly",
      "Films developed under controlled lab conditions with no scratches or light leaks",
      "Radiographer reviewed films and graded as: Acceptable / Porosity / Lack of Fusion / Crack",
      "Weld joints failing X-ray mapped, cut/ground out, re-welded, and re-tested"
    ]
  },

  // --- WATER AND PIPELINES ---
  {
    id: "pipe-sewer-air",
    title: "Air Test for Sewer Pipes",
    category: "Water & Pipelines",
    documentRef: "QC-WP-001",
    revision: "Rev 2",
    revisionDate: "2026-03-01",
    description: "Low-pressure air tightness testing for non-pressure sewers and concrete/PVC wastewater drainage pipelines.",
    customFields: [
      { name: "sewerLineRef", label: "Sewer Line Run Section", type: "text", placeholder: "e.g. MH-12 to MH-13 (Main Outfall)" },
      { name: "pipeMaterial", label: "Pipe Material & Class", type: "select", options: ["uPVC Class 34", "Structured Wall HDPE", "Reinforced Concrete Class 100D", "Other"] },
      { name: "pipeDiameter", label: "Pipe Nominal Diameter (mm)", type: "number", defaultValue: "300" },
      { name: "testPressureKpa", label: "Test Pressure Applied (kPa)", type: "number", defaultValue: "10" },
      { name: "allowableTime", label: "Allowable Time for 2.5kPa Drop (sec)", type: "number", defaultValue: "180" },
      { name: "actualTime", label: "Actual Measured Drop Time (sec)", type: "number" }
    ],
    checklistItems: [
      "Pipeline brushed clean, flushed, and free of dirt, silt, or pooled water",
      "Both ends of sewer pipeline securely sealed with expandable rubber test plugs",
      "Trench shoring or backfill secure to prevent pipeline displacement during air test",
      "Pressure gauge, pump, and exhaust relief valve linked to plug manifold",
      "Pressure pumped up to 12 kPa and allowed to stabilize down to 10 kPa",
      "Timing initiated as pressure crosses 10 kPa; stopped when pressure hits 7.5 kPa",
      "Recorded time compared with specified; check joints with soapy water if failure"
    ]
  },
  {
    id: "pipe-hydraulic-test",
    title: "Standard Hydraulic Pipe Test — Medium Pressure Pipelines",
    category: "Water & Pipelines",
    documentRef: "QC-WP-002",
    revision: "Rev 3",
    revisionDate: "2026-04-12",
    description: "High-pressure hydrostatic testing procedure for water supply pipelines, tracking pumping pressures and permissible leakage.",
    customFields: [
      { name: "pipelineSection", label: "Pipeline Section under Test", type: "text", placeholder: "e.g. Chainage 0+000 to 1+250" },
      { name: "pipeDiameter", label: "Pipe Outer Diameter (mm)", type: "number" },
      { name: "pipeMaterial", label: "Pipe Material & Pressure Class", type: "text", placeholder: "e.g. Ductile Iron Class K9 / Steel" },
      { name: "testPressureBar", label: "Specified Test Pressure (Bar)", type: "number", defaultValue: "15" },
      { name: "allowableLeakage", label: "Permissible Leakage (Liters/hour)", type: "number" },
      { name: "actualLeakage", label: "Actual Makeup Water Added (Liters)", type: "number" }
    ],
    checklistItems: [
      "All pipeline joints left exposed for visual check; barrel covered with soil backfill",
      "Concrete thrust blocks fully cured (>7 days or 28-day target reached)",
      "Pipeline slowly filled with clean water from lowest point, venting air at high valves",
      "Pipeline sat filled for 24 hours under low head to allow liner absorption",
      "Hydraulic pump raised pressure to test pressure (e.g. 15 Bar or 1.5x working)",
      "Pressure held for 2 hours; makeup water metered through calibrated tank",
      "All exposed joints, flanges, valves and fittings inspected for visual leaks",
      "Calculated leakage is strictly less than allowable permissible leakage"
    ],
    hasMeasurementColumns: true
  },
  {
    id: "pipe-fitting-arrival",
    title: "Inspection of Pipes and Fittings on Arrival",
    category: "Water & Pipelines",
    documentRef: "QC-WP-003",
    revision: "Rev 1",
    revisionDate: "2025-06-18",
    description: "Quality verification for pipes, flanges, rubber rings, valves, and fittings upon arrival at site laydown area.",
    customFields: [
      { name: "supplierName", label: "Material Supplier Name", type: "text" },
      { name: "deliveryNote", label: "Delivery Note / Invoice No.", type: "text" },
      { name: "pipeMaterial", label: "Material Specification", type: "text", placeholder: "e.g. Steel API 5L Gr. B / uPVC SANS 966" },
      { name: "batchNo", label: "Manufacturer Batch No.", type: "text" }
    ],
    checklistItems: [
      "Physical count matches packing list and order specifications",
      "Visual check for damage during transport (no cracks, gouges, ovality, or chips)",
      "Wall thickness at pipe ends measured and verified against specifications",
      "Internal and external lining/coating uniform and undamaged",
      "Markings, manufacturer brand, pressure ratings, and certification stamps present",
      "Fittings, gaskets, rubber joint rings flexible, undamaged and correct sizing"
    ]
  },
  {
    id: "pipe-preconcreting",
    title: "Pre-Concreting (Pipelines)",
    category: "Water & Pipelines",
    documentRef: "QC-WP-004",
    revision: "Rev 2",
    revisionDate: "2026-01-05",
    description: "Inspection check sheet for casting concrete anchor blocks, thrust blocks, pipeline encasement, or valve chambers.",
    customFields: [
      { name: "blockRef", label: "Thrust Block / Encasement Ref", type: "text", placeholder: "e.g. Thrust Block TB-14 at Bend 45°" },
      { name: "concreteClass", label: "Concrete Class Specified", type: "text", defaultValue: "Class 20/19" },
      { name: "excavationSize", label: "Excavation Size (W x L x H mm)", type: "text" },
      { name: "slumpRequired", label: "Specified Slump Range (mm)", type: "text", defaultValue: "75 - 100" }
    ],
    checklistItems: [
      "Thrust block excavation sizes and bearing face against undisturbed soil correct",
      "Pipes correctly aligned, joints wrapped to prevent concrete ingress",
      "Formwork sturdy and braced to handle heavy concrete pressure",
      "Reinforcing steel structure placed, spaced, and covers verify sched schedule",
      "Trench base dry, clean of loose dirt, mud, and water pumped out",
      "Approved concrete mix batching, vibrators, and lab test molds on standby"
    ]
  },
  {
    id: "pipe-trench-bedding",
    title: "Trench Bedding and Backfill Inspection",
    category: "Water & Pipelines",
    documentRef: "QC-WP-005",
    revision: "Rev 2",
    revisionDate: "2025-12-14",
    description: "Inspection of pipe cradle laying, haunching, select granular fill, and subsequent main trench backfill compacting.",
    customFields: [
      { name: "trenchSection", label: "Trench Chainage Section Range", type: "text", placeholder: "e.g. km 3+120 to km 3+400" },
      { name: "beddingClass", label: "Bedding Type (e.g. Class B / C)", type: "text", defaultValue: "Class B Bedding" },
      { name: "cradleMaterial", label: "Cradle Material Type", type: "text", defaultValue: "Selected Granular Sand / Crusher Dust" },
      { name: "layerThickness", label: "Backfill Layer Lift Thickness (mm)", type: "number", defaultValue: "150" }
    ],
    checklistItems: [
      "Pipe bedding cradle laid uniform to grade, compacted and hollowed for sockets",
      "Pipe haunching material placed under the pipe sides with no voids",
      "Primary selected backfill placed around pipe and 300mm above crown",
      "Backfill material free of sharp rocks, clays, organic matter, or frozen soil",
      "Manual compaction using rammers around pipe; heavy equipment used on upper layers only",
      "Field density tests taken in staggered layers and pass specification"
    ],
    hasMeasurementColumns: true
  },
  {
    id: "pipe-trench-excavation",
    title: "Trench Excavation Inspection",
    category: "Water & Pipelines",
    documentRef: "QC-WP-006",
    revision: "Rev 1",
    revisionDate: "2025-08-20",
    description: "Inspection of trench dimensions, vertical depths, soil stability, and alignment prior to pipeline bedding.",
    customFields: [
      { name: "excavationSection", label: "Trench Section Chainage", type: "text", placeholder: "e.g. km 5+600 to km 5+850" },
      { name: "excavationWidth", label: "Trench Top / Bottom Width (mm)", type: "text" },
      { name: "excavationDepth", label: "Trench Average Depth (mm)", type: "number" },
      { name: "soilType", label: "Soil Material / Classification", type: "text", defaultValue: "Intermediate Clay / Soft Rock" }
    ],
    checklistItems: [
      "Trench line, center, and curve layout conforms to alignment drawings",
      "Trench bottom leveled, dry, with all soft pockets or rock protrusions removed",
      "Excavated soil stockpiled safe distance from trench edge (minimum 1.0 meter)",
      "Trench sides battered back or shoring safety framework installed as required",
      "Barricades, warning ropes, and crossing bridges erected for public safety",
      "Underground service lines (cables, water) physically traced and protected"
    ]
  },

  // --- BUILDING WORKS ---
  {
    id: "building-plasterwork",
    title: "Plasterwork",
    category: "Building Works",
    documentRef: "QC-BW-001",
    revision: "Rev 2",
    revisionDate: "2026-04-10",
    description: "Internal and external cement plaster surface inspection checklist evaluating alignment, adhesion, and texture finish.",
    customFields: [
      { name: "roomRef", label: "Room / Building Area Block", type: "text", placeholder: "e.g. Block B, First Floor, Room 102" },
      { name: "mixRatio", label: "Cement-Sand Mortar Mix Ratio", type: "text", defaultValue: "1:4" },
      { name: "plasterThickness", label: "Specified Thickness (mm)", type: "number", defaultValue: "15" },
      { name: "backingSurface", label: "Backing Surface Material", type: "select", options: ["Clay Brick", "Concrete Block", "Off-shut Concrete", "Other"] }
    ],
    checklistItems: [
      "Masonry walls brushed clean, joints raked out 10mm, and surface dampened",
      "Concrete surfaces key-treated (spatter dash/slashing) to ensure bond strength",
      "Corner beads, plaster guides, plumb pads placed to verify flush alignment",
      "Plaster applied in layers; scratch coat scratched and cured before second coat",
      "Final plaster layer level, straight, free of waves, hollows, or trowel marks",
      "No cracking, drumminess, hollow sounds, or dry-outs when checked with mallet",
      "Curing started immediately and maintained with water spray for minimum 3 days"
    ]
  },
  {
    id: "building-brickwork",
    title: "Brickwork",
    category: "Building Works",
    documentRef: "QC-BW-002",
    revision: "Rev 2",
    revisionDate: "2026-02-05",
    description: "Masonry structural inspection evaluating cement brick or clay block alignments, joints, mortar quality, and reinforcing.",
    customFields: [
      { name: "wallLocation", label: "Wall Location / Room Reference", type: "text", placeholder: "e.g. Block A, Ground Floor Perimeter Wall" },
      { name: "brickType", label: "Brick / Block Type", type: "text", defaultValue: "7MPa Concrete Block (190mm)" },
      { name: "mortarMix", label: "Mortar Class / Mix Ratio", type: "text", defaultValue: "Class II (1:4)" },
      { name: "jointThickness", label: "Bed / Vertical Joint Size (mm)", type: "number", defaultValue: "10" }
    ],
    checklistItems: [
      "Concrete foundation beam swept clean, level, and marked with chalk layout",
      "Damp Proof Course (DPC) felt laid uniform and overlapped at joints (>150mm)",
      "Bricks wetted before laying; corner leads set up plumb and aligned with strings",
      "Mortar beds full; vertical joints filled completely with joint pointers applied",
      "Wall ties installed into columns and concrete frames as specified (e.g. every 3rd course)",
      "Brickforce mesh reinforcing installed at required heights (e.g. every 4th course)",
      "Cavities clean of mortar droppings; lintels placed flat with correct bearing (>150mm)",
      "Wall plumb, straight, and true to level inside structural tolerance limits"
    ]
  },
  {
    id: "building-preconcreting",
    title: "Pre-Concreting Checklist",
    category: "Building Works",
    documentRef: "QC-BW-003",
    revision: "Rev 3",
    revisionDate: "2026-05-18",
    description: "Pre-pour quality checklist for building structures, covering slab-on-grade, reinforced concrete columns, beams, and load-bearing lintels.",
    customFields: [
      { name: "slabRef", label: "Slab / Column / Beam Reference", type: "text", placeholder: "e.g. Block C, First Floor Slab Zone 2" },
      { name: "concreteMix", label: "Concrete Mix Design Grade", type: "text", defaultValue: "30MPa / 19mm" },
      { name: "estimatedVolume", label: "Estimated Pour Volume (m³)", type: "number" },
      { name: "slumpSpecified", label: "Specified Slump (mm)", type: "number", defaultValue: "100" }
    ],
    checklistItems: [
      "Formwork rigid, sturdy, fully propped, oiled, and dimensions match drawings",
      "Concrete cover blocks, plastic chairs placed correctly underneath rebar layout",
      "Rebar reinforcing sizes, spacings, splice laps, and bends match drawings",
      "Electrical conduits, wall switch boxes, and lighting sleeves secured to rebar",
      "Plumbing drain lines, water pipes sleeves cast-in and pressure-tested",
      "Expansion/construction joint strips and dowels aligned correctly",
      "Slab bottom clean of wire ties, wood dust, trash, and wetted prior to pour",
      "Concrete vibrator needle (min 2) and power generator on-site on stand-by"
    ]
  }
];

export const CATEGORIES = [
  "All",
  "Roads & Earthworks",
  "Concrete & Structures",
  "Surveying & Testing",
  "Water & Pipelines",
  "Building Works"
];
