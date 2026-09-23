export interface InfrastructureProject {
  id: string;
  name: string;
  code: string;
  sector: "Transport & Rail" | "Civil Infrastructure" | "Utilities & Power" | "Ports & Marine";
  client: string;
  contractValue: number; // in USD
  localValue: string;
  progressPercent: number;
  targetPercent: number;
  spi: number; // Schedule Performance Index
  cpi: number; // Cost Performance Index
  status: "On Track" | "Critical Path Monitor" | "Immediate Intervention";
  criticalActivity: string;
  contractType: "FIDIC Silver Book" | "FIDIC Red Book" | "FIDIC Yellow Book" | "NEC3 Option C";
  activeRisksCount: number;
  capitalAtRisk: number; // in USD
  latestMilestone: string;
  projectManager: string;
  coordinates?: { lat: number; lng: number };
}

export interface RegionalHub {
  id: string;
  city: string;
  country: string;
  countryCode: string;
  region: "Middle East / GCC" | "East Africa" | "Southern Africa";
  coordinates: { x: number; y: number; lat: number; lng: number }; // x,y are percentages for custom SVG projection
  portfolioValue: number; // in USD
  totalValueUSD?: number;
  portfolioValueFormatted: string;
  activeProjectsCount: number;
  performanceScore: number; // percentage
  capitalAtRisk: number; // in USD
  capitalAtRiskUSD?: number;
  capitalAtRiskFormatted: string;
  criticalInterventions: number;
  status: "Optimal" | "Action Required" | "Stable";
  currency: string;
  currencySymbol: string;
  exchangeRateToUSD: number;
  leadDirector: string;
  headquarters: string;
  projects: InfrastructureProject[];
  sectorDistribution: { name: string; value: number; color: string }[];
  riskFactors: { title: string; severity: "high" | "medium" | "low"; impact: string; mitigation: string }[];
}

export const GLOBAL_SUMMARY = {
  portfolioValue: 4820000000,
  portfolioValueFormatted: "$4.82B",
  activeProjects: 27,
  portfolioPerformance: 81.4,
  capitalAtRisk: 312000000,
  capitalAtRiskFormatted: "$312M",
  criticalInterventions: 14,
  lastUpdated: "2026-08-15 19:35 UTC",
  hubsCount: 6,
};

export const REGIONAL_HUBS: RegionalHub[] = [
  {
    id: "riyadh",
    city: "Riyadh",
    country: "Saudi Arabia",
    countryCode: "SA",
    region: "Middle East / GCC",
    coordinates: { x: 55.4, y: 39.8, lat: 24.7136, lng: 46.6753 },
    portfolioValue: 1450000000,
    portfolioValueFormatted: "$1.45B",
    activeProjectsCount: 8,
    performanceScore: 84.2,
    capitalAtRisk: 94000000,
    capitalAtRiskFormatted: "$94M",
    criticalInterventions: 4,
    status: "Action Required",
    currency: "SAR",
    currencySymbol: "﷼",
    exchangeRateToUSD: 3.75,
    leadDirector: "Eng. Tariq Al-Mansoor",
    headquarters: "King Fahd Road Tower, Riyadh",
    sectorDistribution: [
      { name: "Transport & Rail", value: 48, color: "#3B82F6" },
      { name: "Civil Infrastructure", value: 34, color: "#F59E0B" },
      { name: "Utilities & Power", value: 18, color: "#10B981" }
    ],
    riskFactors: [
      {
        title: "Summer Heat Thermal Pouring Protocols",
        severity: "medium",
        impact: "Night-shift concrete batching requires liquid nitrogen injection.",
        mitigation: "Chilled water plant operational at CH 0+400 yard."
      },
      {
        title: "Deep Basement Cavity Formation (Diriyah)",
        severity: "high",
        impact: "Limestone fissure encountered at Level -3 substructure.",
        mitigation: "Jet grouting curtain deployed with 24/7 seismic acoustic monitors."
      },
      {
        title: "Employer RFI Approval Latency (Line 4)",
        severity: "high",
        impact: "3 MEP structural coordination queries past 14-day contractual window.",
        mitigation: "Formal preservation of rights notice issued under FIDIC Cl. 1.9."
      }
    ],
    projects: [
      {
        id: "ruh-01",
        name: "Riyadh Metro Line 4 Spine & Underpass Network",
        code: "KSA-RUH-M4",
        sector: "Transport & Rail",
        client: "Royal Commission for Riyadh City (RCRC)",
        contractValue: 680000000,
        localValue: "2.55B SAR",
        progressPercent: 64.2,
        targetPercent: 65.8,
        spi: 0.98,
        cpi: 1.01,
        status: "On Track",
        criticalActivity: "Precast viaduct segment post-tensioning pier P-42 to P-58",
        contractType: "FIDIC Silver Book",
        activeRisksCount: 3,
        capitalAtRisk: 32000000,
        latestMilestone: "Underpass Box Culvert 100% cast at King Khalid Junction",
        projectManager: "Eng. Khalid Al-Otaibi",
        coordinates: { lat: 24.7311, lng: 46.6842 }
      },
      {
        id: "ruh-02",
        name: "Diriyah Gate Deep Substructure & Civil Works",
        code: "KSA-DIR-08",
        sector: "Civil Infrastructure",
        client: "Diriyah Gate Development Authority (DGDA)",
        contractValue: 490000000,
        localValue: "1.84B SAR",
        progressPercent: 38.4,
        targetPercent: 43.1,
        spi: 0.89,
        cpi: 0.94,
        status: "Critical Path Monitor",
        criticalActivity: "Zone 3 diaphragm wall secant piling and anchor prestressing",
        contractType: "FIDIC Red Book",
        activeRisksCount: 5,
        capitalAtRisk: 48000000,
        latestMilestone: "Excavation to -18.5m completed in Sector B",
        projectManager: "Marc van der Westhuizen",
        coordinates: { lat: 24.7339, lng: 46.5772 }
      },
      {
        id: "ruh-03",
        name: "King Salman Park Strategic Stormwater & Utility Trunk",
        code: "KSA-KSP-UTL",
        sector: "Utilities & Power",
        client: "King Salman Park Foundation",
        contractValue: 280000000,
        localValue: "1.05B SAR",
        progressPercent: 79.5,
        targetPercent: 78.0,
        spi: 1.02,
        cpi: 1.03,
        status: "On Track",
        criticalActivity: "Micro-tunneling 2,400mm GRP pipe under Eastern Ring Road",
        contractType: "FIDIC Yellow Book",
        activeRisksCount: 2,
        capitalAtRisk: 14000000,
        latestMilestone: "Tunnel Boring Machine breakthrough at Shaft 4",
        projectManager: "Faisal Al-Sharif",
        coordinates: { lat: 24.7102, lng: 46.7328 }
      },
      {
        id: "ruh-04",
        name: "Qiddiya Water Theme Park Structural Earthworks",
        code: "KSA-QID-WTP",
        sector: "Civil Infrastructure",
        client: "Qiddiya Investment Company (QIC)",
        contractValue: 160000000,
        localValue: "600M SAR",
        progressPercent: 55.0,
        targetPercent: 53.5,
        spi: 1.03,
        cpi: 1.02,
        status: "On Track",
        criticalActivity: "Cliffside slope stabilization & rock bolt anchoring at Zone 2",
        contractType: "FIDIC Red Book",
        activeRisksCount: 2,
        capitalAtRisk: 11000000,
        latestMilestone: "Wave pool reinforced concrete base slab casting completed",
        projectManager: "Eng. Waleed Al-Husseini",
        coordinates: { lat: 24.5823, lng: 46.3211 }
      },
      {
        id: "ruh-05",
        name: "New Murabba Iconic Box Cut & Dewatering",
        code: "KSA-NMR-BOX",
        sector: "Civil Infrastructure",
        client: "New Murabba Development Company (NMDC)",
        contractValue: 220000000,
        localValue: "825M SAR",
        progressPercent: 29.4,
        targetPercent: 34.0,
        spi: 0.88,
        cpi: 0.93,
        status: "Critical Path Monitor",
        criticalActivity: "High-volume deep wellpoint dewatering & soldier pile perimeter installation",
        contractType: "FIDIC Silver Book",
        activeRisksCount: 4,
        capitalAtRisk: 28000000,
        latestMilestone: "Bulk excavation reached 4.2M m³ benchmark",
        projectManager: "Eng. Ziyad Al-Ghamdi",
        coordinates: { lat: 24.8122, lng: 46.6190 }
      },
      {
        id: "ruh-06",
        name: "Riyadh Ring Road North Bypass Overpass Bridges",
        code: "KSA-RRR-NBP",
        sector: "Transport & Rail",
        client: "Ministry of Transport and Logistic Services",
        contractValue: 140000000,
        localValue: "525M SAR",
        progressPercent: 88.0,
        targetPercent: 87.0,
        spi: 1.01,
        cpi: 1.02,
        status: "On Track",
        criticalActivity: "Parapet wall slipforming & highway asphalt wearing course application",
        contractType: "FIDIC Red Book",
        activeRisksCount: 1,
        capitalAtRisk: 6000000,
        latestMilestone: "Northbound flyover span opened to traffic",
        projectManager: "Eng. Majed Al-Subaie",
        coordinates: { lat: 24.8455, lng: 46.7210 }
      },
      {
        id: "ruh-07",
        name: "South Riyadh Industrial Logistics Hub",
        code: "KSA-SRY-LOG",
        sector: "Transport & Rail",
        client: "MODON Industrial Cities Authority",
        contractValue: 95000000,
        localValue: "356M SAR",
        progressPercent: 73.2,
        targetPercent: 72.0,
        spi: 1.01,
        cpi: 1.00,
        status: "On Track",
        criticalActivity: "Intermodal rail loading terminal concrete apron finishing",
        contractType: "FIDIC Yellow Book",
        activeRisksCount: 2,
        capitalAtRisk: 5000000,
        latestMilestone: "Substation 33kV energization and switchgear testing passed",
        projectManager: "Eng. Fahad Al-Dossary",
        coordinates: { lat: 24.5122, lng: 46.8841 }
      },
      {
        id: "ruh-08",
        name: "Wadi Hanifah Eco-Drainage & Retention Basin",
        code: "KSA-WDH-DRN",
        sector: "Utilities & Power",
        client: "RCRC Environmental Directorate",
        contractValue: 85000000,
        localValue: "318M SAR",
        progressPercent: 82.1,
        targetPercent: 81.5,
        spi: 1.01,
        cpi: 1.03,
        status: "On Track",
        criticalActivity: "Gabion weir basket alignment and natural stone riprap pitching",
        contractType: "FIDIC Red Book",
        activeRisksCount: 1,
        capitalAtRisk: 3000000,
        latestMilestone: "Basin 4 spillway hydraulic test fully certified",
        projectManager: "Eng. Bandar Al-Mutairi",
        coordinates: { lat: 24.6201, lng: 46.6022 }
      }
    ]
  },
  {
    id: "dubai",
    city: "Dubai",
    country: "United Arab Emirates",
    countryCode: "AE",
    region: "Middle East / GCC",
    coordinates: { x: 59.8, y: 40.2, lat: 25.2048, lng: 55.2708 },
    portfolioValue: 1120000000,
    portfolioValueFormatted: "$1.12B",
    activeProjectsCount: 6,
    performanceScore: 88.5,
    capitalAtRisk: 58000000,
    capitalAtRiskFormatted: "$58M",
    criticalInterventions: 2,
    status: "Optimal",
    currency: "AED",
    currencySymbol: "د.إ",
    exchangeRateToUSD: 3.67,
    leadDirector: "Hamdan Al-Maktoum",
    headquarters: "DIFC Gate Tower 4, Dubai",
    sectorDistribution: [
      { name: "Transport & Rail", value: 46, color: "#3B82F6" },
      { name: "Civil Infrastructure", value: 34, color: "#F59E0B" },
      { name: "Ports & Marine", value: 20, color: "#06B6D4" }
    ],
    riskFactors: [
      {
        title: "High Water Table Dewatering (Jebel Ali)",
        severity: "medium",
        impact: "Continuous 24-hour wellpoint pumping required for viaduct piers.",
        mitigation: "Environmental discharge filtration system running at 100% compliance."
      },
      {
        title: "Specialized Track Slabs Delivery from Europe",
        severity: "low",
        impact: "Red Sea logistics routing adding 7 days transit buffer.",
        mitigation: "Early inventory warehouse staging at JAFZA."
      }
    ],
    projects: [
      {
        id: "dxb-01",
        name: "Dubai Urban Freight Rail Corridor & Intermodal Hub",
        code: "UAE-DXB-FRT",
        sector: "Transport & Rail",
        client: "Roads & Transport Authority (RTA) / Etihad Rail",
        contractValue: 520000000,
        localValue: "1.91B AED",
        progressPercent: 71.2,
        targetPercent: 70.0,
        spi: 1.02,
        cpi: 1.00,
        status: "On Track",
        criticalActivity: "Catenary mast erection & ballastless slab installation KM 32-48",
        contractType: "FIDIC Silver Book",
        activeRisksCount: 2,
        capitalAtRisk: 22000000,
        latestMilestone: "Intermodal Container Gantry Foundation handover",
        projectManager: "Sultan Al-Nuaimi",
        coordinates: { lat: 25.1023, lng: 55.1982 }
      },
      {
        id: "dxb-02",
        name: "Al Maktoum South Expansion Civils & Drainage",
        code: "UAE-DWC-EXP",
        sector: "Civil Infrastructure",
        client: "Dubai Aviation City Corporation",
        contractValue: 380000000,
        localValue: "1.39B AED",
        progressPercent: 44.8,
        targetPercent: 46.5,
        spi: 0.96,
        cpi: 0.98,
        status: "On Track",
        criticalActivity: "Sub-base stabilization across Runway Parallel Taxiway Echo",
        contractType: "FIDIC Red Book",
        activeRisksCount: 3,
        capitalAtRisk: 24000000,
        latestMilestone: "1.2M m³ engineered backfill completed ahead of schedule",
        projectManager: "Rashid bin Butti",
        coordinates: { lat: 24.8962, lng: 55.1611 }
      },
      {
        id: "dxb-03",
        name: "Jebel Ali Smart Port Access Expressway",
        code: "UAE-JAF-EXP",
        sector: "Ports & Marine",
        client: "DP World / Dubai Port Authority",
        contractValue: 220000000,
        localValue: "807M AED",
        progressPercent: 91.5,
        targetPercent: 90.0,
        spi: 1.02,
        cpi: 1.04,
        status: "On Track",
        criticalActivity: "Final asphalt wearing course and smart tolling gantries",
        contractType: "FIDIC Silver Book",
        activeRisksCount: 1,
        capitalAtRisk: 12000000,
        latestMilestone: "Bridge B02 structural load test successfully certified",
        projectManager: "Karim Hassan",
        coordinates: { lat: 25.0112, lng: 55.0645 }
      },
      {
        id: "dxb-04",
        name: "Dubai Creek Bascule Bridge & Cofferdam Marine Works",
        code: "UAE-DXB-CRK",
        sector: "Civil Infrastructure",
        client: "Dubai Roads and Transport Authority (RTA)",
        contractValue: 190000000,
        localValue: "697M AED",
        progressPercent: 48.6,
        targetPercent: 52.0,
        spi: 0.93,
        cpi: 0.96,
        status: "Critical Path Monitor",
        criticalActivity: "Marine sheet pile cofferdam dewatering & hydraulic jack bascule pivot installation",
        contractType: "FIDIC Yellow Book",
        activeRisksCount: 3,
        capitalAtRisk: 18000000,
        latestMilestone: "South abutment underwater tremie concrete pour verified",
        projectManager: "Eng. Omar Al-Qassimi",
        coordinates: { lat: 25.2411, lng: 55.3340 }
      },
      {
        id: "dxb-05",
        name: "Hatta Hydro-Storage Penstock Civil Package",
        code: "UAE-HTA-HDR",
        sector: "Utilities & Power",
        client: "Dubai Electricity and Water Authority (DEWA)",
        contractValue: 130000000,
        localValue: "477M AED",
        progressPercent: 78.4,
        targetPercent: 77.0,
        spi: 1.02,
        cpi: 1.01,
        status: "On Track",
        criticalActivity: "High-pressure steel penstock shaft backfill grouting",
        contractType: "FIDIC Silver Book",
        activeRisksCount: 2,
        capitalAtRisk: 9000000,
        latestMilestone: "Upper reservoir concrete intake tower completed",
        projectManager: "Eng. Tariq Al-Suwaidi",
        coordinates: { lat: 24.7891, lng: 56.1245 }
      },
      {
        id: "dxb-06",
        name: "Dubai South Logistics Freezone Infrastructure",
        code: "UAE-DWC-LOG",
        sector: "Civil Infrastructure",
        client: "Dubai Aviation City Corporation",
        contractValue: 80000000,
        localValue: "294M AED",
        progressPercent: 86.5,
        targetPercent: 85.0,
        spi: 1.01,
        cpi: 1.03,
        status: "On Track",
        criticalActivity: "Medium voltage distribution loop commissioning & final road landscaping",
        contractType: "FIDIC Red Book",
        activeRisksCount: 1,
        capitalAtRisk: 4000000,
        latestMilestone: "Main customs gatehouse handover to DWC operations",
        projectManager: "Eng. Saeed Al-Falasi",
        coordinates: { lat: 24.8722, lng: 55.1890 }
      }
    ]
  },
  {
    id: "abudhabi",
    city: "Abu Dhabi",
    country: "United Arab Emirates",
    countryCode: "AE",
    region: "Middle East / GCC",
    coordinates: { x: 58.6, y: 41.5, lat: 24.4539, lng: 54.3773 },
    portfolioValue: 610000000,
    portfolioValueFormatted: "$610M",
    activeProjectsCount: 4,
    performanceScore: 79.1,
    capitalAtRisk: 42000000,
    capitalAtRiskFormatted: "$42M",
    criticalInterventions: 2,
    status: "Action Required",
    currency: "AED",
    currencySymbol: "د.إ",
    exchangeRateToUSD: 3.67,
    leadDirector: "Mansoor Al-Zaabi",
    headquarters: "Al Maryah Tower, Abu Dhabi",
    sectorDistribution: [
      { name: "Transport & Rail", value: 59, color: "#3B82F6" },
      { name: "Ports & Marine", value: 41, color: "#06B6D4" }
    ],
    riskFactors: [
      {
        title: "Marine Silt Dredging Density Discrepancy",
        severity: "high",
        impact: "Hard caliche layer at -18m CD requiring cutter suction dredger.",
        mitigation: "Supplemental equipment mobilized from Singapore."
      }
    ],
    projects: [
      {
        id: "auh-01",
        name: "Etihad Rail Industrial Siding & Freight Terminal",
        code: "UAE-AUH-ETR",
        sector: "Transport & Rail",
        client: "Etihad Rail PJSC",
        contractValue: 360000000,
        localValue: "1.32B AED",
        progressPercent: 52.0,
        targetPercent: 55.4,
        spi: 0.94,
        cpi: 0.97,
        status: "Critical Path Monitor",
        criticalActivity: "Track interlocking signaling control room commissioning",
        contractType: "FIDIC Yellow Book",
        activeRisksCount: 3,
        capitalAtRisk: 26000000,
        latestMilestone: "35km heavy rail track laying passed ultrasound audit",
        projectManager: "Youssef Al-Hammadi",
        coordinates: { lat: 24.3644, lng: 54.5211 }
      },
      {
        id: "auh-02",
        name: "Khalifa Port Deep Marine Quay Extension",
        code: "UAE-KHL-QAY",
        sector: "Ports & Marine",
        client: "AD Ports Group",
        contractValue: 250000000,
        localValue: "917M AED",
        progressPercent: 33.6,
        targetPercent: 35.0,
        spi: 0.96,
        cpi: 0.99,
        status: "On Track",
        criticalActivity: "Precast concrete caisson sinking (Caissons 12 through 18)",
        contractType: "FIDIC Red Book",
        activeRisksCount: 2,
        capitalAtRisk: 16000000,
        latestMilestone: "Underwater geotextile mattress placement approved",
        projectManager: "Dr. Adel Al-Marzouqi",
        coordinates: { lat: 24.8101, lng: 54.6724 }
      },
      {
        id: "auh-03",
        name: "Al Dhafra Solar Substation 400kV Cable Civils",
        code: "UAE-AUH-SOL",
        sector: "Utilities & Power",
        client: "Abu Dhabi National Energy Company (TAQA)",
        contractValue: 110000000,
        localValue: "403M AED",
        progressPercent: 68.2,
        targetPercent: 67.0,
        spi: 1.01,
        cpi: 1.02,
        status: "On Track",
        criticalActivity: "Direct buried 400kV XLPE power cable jointing and thermo-backfill",
        contractType: "FIDIC Silver Book",
        activeRisksCount: 2,
        capitalAtRisk: 7000000,
        latestMilestone: "Phase 1 inverter step-up transformer energized",
        projectManager: "Eng. Saif Al-Nuaimi",
        coordinates: { lat: 23.9841, lng: 54.5210 }
      },
      {
        id: "auh-04",
        name: "Ruwais Chemical Corridor Highway Duplication",
        code: "UAE-RUW-HWY",
        sector: "Transport & Rail",
        client: "Department of Municipalities and Transport",
        contractValue: 90000000,
        localValue: "330M AED",
        progressPercent: 81.5,
        targetPercent: 80.0,
        spi: 1.02,
        cpi: 1.01,
        status: "On Track",
        criticalActivity: "Heavy hazardous-cargo lane polymer-modified asphalt surfacing",
        contractType: "FIDIC Red Book",
        activeRisksCount: 1,
        capitalAtRisk: 5000000,
        latestMilestone: "Pipeline crossing culvert load test passed at 120 tonnes",
        projectManager: "Eng. Jamal Al-Kaabi",
        coordinates: { lat: 24.1102, lng: 52.7412 }
      }
    ]
  },
  {
    id: "doha",
    city: "Doha",
    country: "Qatar",
    countryCode: "QA",
    region: "Middle East / GCC",
    coordinates: { x: 57.2, y: 40.8, lat: 25.2854, lng: 51.5310 },
    portfolioValue: 380000000,
    portfolioValueFormatted: "$380M",
    activeProjectsCount: 3,
    performanceScore: 83.0,
    capitalAtRisk: 26000000,
    capitalAtRiskFormatted: "$26M",
    criticalInterventions: 1,
    status: "Stable",
    currency: "QAR",
    currencySymbol: "ر.ق",
    exchangeRateToUSD: 3.64,
    leadDirector: "Abdullah Al-Kuwari",
    headquarters: "West Bay Financial District, Doha",
    sectorDistribution: [
      { name: "Civil Infrastructure", value: 55, color: "#F59E0B" },
      { name: "Ports & Marine", value: 45, color: "#06B6D4" }
    ],
    riskFactors: [
      {
        title: "Subsurface Utility Relocation Conflicts",
        severity: "medium",
        impact: "Uncharted 400kV HV cable route intersecting box culvert corridor.",
        mitigation: "Ground penetrating radar (GPR) full corridor sweep executed."
      }
    ],
    projects: [
      {
        id: "doh-01",
        name: "Hamad Port Logistics Zone Phase 2 Civils",
        code: "QAT-HMD-LZ2",
        sector: "Ports & Marine",
        client: "Ashghal / Mwani Qatar",
        contractValue: 210000000,
        localValue: "764M QAR",
        progressPercent: 67.4,
        targetPercent: 66.0,
        spi: 1.02,
        cpi: 1.01,
        status: "On Track",
        criticalActivity: "Heavy industrial asphalt paving for container reach-stackers",
        contractType: "FIDIC Silver Book",
        activeRisksCount: 1,
        capitalAtRisk: 14000000,
        latestMilestone: "High-mast lighting and fiber optic backbone operational",
        projectManager: "Nasser Al-Thani",
        coordinates: { lat: 25.0133, lng: 51.6102 }
      },
      {
        id: "doh-02",
        name: "Doha Orbital Freight Expressway Bridge Rehabilitation",
        code: "QAT-ORB-BRG",
        sector: "Civil Infrastructure",
        client: "Ashghal Public Works Authority",
        contractValue: 170000000,
        localValue: "619M QAR",
        progressPercent: 85.0,
        targetPercent: 84.5,
        spi: 1.01,
        cpi: 1.02,
        status: "On Track",
        criticalActivity: "Expansion joint replacement and bridge deck hydro-demolition",
        contractType: "FIDIC Red Book",
        activeRisksCount: 1,
        capitalAtRisk: 12000000,
        latestMilestone: "Southbound flyover lanes opened to commercial traffic",
        projectManager: "Mohamed Al-Khelaifi",
        coordinates: { lat: 25.3211, lng: 51.4892 }
      },
      {
        id: "doh-03",
        name: "Ras Laffan Desalination Brine Outfall Marine Works",
        code: "QAT-RLF-BRN",
        sector: "Utilities & Power",
        client: "Kahramaa / QatarEnergy",
        contractValue: 80000000,
        localValue: "291M QAR",
        progressPercent: 58.0,
        targetPercent: 57.0,
        spi: 1.01,
        cpi: 1.00,
        status: "On Track",
        criticalActivity: "HDPE submarine outfall pipe bottom-pull and diffuser installation",
        contractType: "FIDIC Yellow Book",
        activeRisksCount: 2,
        capitalAtRisk: 6000000,
        latestMilestone: "Trench seabed backfill with geotextile riprap completed",
        projectManager: "Eng. Jassim Al-Kuwari",
        coordinates: { lat: 25.9122, lng: 51.5412 }
      }
    ]
  },
  {
    id: "daressalaam",
    city: "Dar es Salaam",
    country: "Tanzania",
    countryCode: "TZ",
    region: "East Africa",
    coordinates: { x: 58.2, y: 64.5, lat: -6.7924, lng: 39.2083 },
    portfolioValue: 510000000,
    portfolioValueFormatted: "$510M",
    activeProjectsCount: 3,
    performanceScore: 76.8,
    capitalAtRisk: 48000000,
    capitalAtRiskFormatted: "$48M",
    criticalInterventions: 3,
    status: "Action Required",
    currency: "TZS",
    currencySymbol: "TSh",
    exchangeRateToUSD: 2580,
    leadDirector: "Eng. Juma Mwinyi",
    headquarters: "Kigamboni Waterfront Plaza, Dar es Salaam",
    sectorDistribution: [
      { name: "Transport & Rail", value: 63, color: "#3B82F6" },
      { name: "Ports & Marine", value: 37, color: "#06B6D4" }
    ],
    riskFactors: [
      {
        title: "Monsoon Season Earthworks Stoppage Risk",
        severity: "high",
        impact: "Heavy rainfall saturated subgrade in Sector 4 cut sections.",
        mitigation: "Lime-soil stabilization machines and covered drainage channels deployed."
      },
      {
        title: "Import Customs Clearance at Dar Port",
        severity: "medium",
        impact: "Structural rail steel shipment delayed 10 days in terminal holding.",
        mitigation: "Fast-track customs corridor authorized under bilateral infrastructure pact."
      }
    ],
    projects: [
      {
        id: "dar-01",
        name: "Central Corridor Standard Gauge Railway (SGR) Lot 3 Terminus",
        code: "TZA-SGR-L03",
        sector: "Transport & Rail",
        client: "Tanzania Railways Corporation (TRC)",
        contractValue: 320000000,
        localValue: "825B TZS",
        progressPercent: 49.2,
        targetPercent: 54.0,
        spi: 0.91,
        cpi: 0.96,
        status: "Immediate Intervention",
        criticalActivity: "Track ballast compaction & bridge abutment BA-12 pier casting",
        contractType: "FIDIC Red Book",
        activeRisksCount: 4,
        capitalAtRisk: 31000000,
        latestMilestone: "Passenger terminal concourse structural steel 100% erected",
        projectManager: "Barnabas Mchome",
        coordinates: { lat: -6.8211, lng: 39.2812 }
      },
      {
        id: "dar-02",
        name: "Dar Port Berths 8-11 Deepening & Heavy Lift Terminal",
        code: "TZA-PRT-B08",
        sector: "Ports & Marine",
        client: "Tanzania Ports Authority (TPA)",
        contractValue: 190000000,
        localValue: "490B TZS",
        progressPercent: 41.5,
        targetPercent: 42.0,
        spi: 0.99,
        cpi: 1.01,
        status: "On Track",
        criticalActivity: "Steel tubular combi-wall piling & underwater anchor ties",
        contractType: "FIDIC Yellow Book",
        activeRisksCount: 2,
        capitalAtRisk: 17000000,
        latestMilestone: "Berth 8 quay apron concrete casting completed",
        projectManager: "Mwita Marwa",
        coordinates: { lat: -6.8402, lng: 39.3015 }
      },
      {
        id: "dar-03",
        name: "Kigamboni Coastal Bypass & Mangrove Causeways",
        code: "TZA-KIG-BYP",
        sector: "Civil Infrastructure",
        client: "TANROADS (Tanzania National Roads Agency)",
        contractValue: 75000000,
        localValue: "193B TZS",
        progressPercent: 52.4,
        targetPercent: 56.0,
        spi: 0.93,
        cpi: 0.95,
        status: "Critical Path Monitor",
        criticalActivity: "Precast pile driving in tidal mangrove zone & geotextile subbase wrap",
        contractType: "FIDIC Red Book",
        activeRisksCount: 3,
        capitalAtRisk: 9000000,
        latestMilestone: "Causeway Bridge 02 pier caps cast to deck level",
        projectManager: "Eng. Frank Kessy",
        coordinates: { lat: -6.8722, lng: 39.3241 }
      }
    ]
  },
  {
    id: "johannesburg",
    city: "Johannesburg",
    country: "South Africa",
    countryCode: "ZA",
    region: "Southern Africa",
    coordinates: { x: 54.1, y: 83.2, lat: -26.2041, lng: 28.0473 },
    portfolioValue: 750000000,
    portfolioValueFormatted: "$750M",
    activeProjectsCount: 3,
    performanceScore: 74.5,
    capitalAtRisk: 44000000,
    capitalAtRiskFormatted: "$44M",
    criticalInterventions: 2,
    status: "Action Required",
    currency: "ZAR",
    currencySymbol: "R",
    exchangeRateToUSD: 18.4,
    leadDirector: "Sipho Dlamini",
    headquarters: "Sandton City Office Towers, Johannesburg",
    sectorDistribution: [
      { name: "Civil Infrastructure", value: 56, color: "#F59E0B" },
      { name: "Transport & Rail", value: 28, color: "#3B82F6" },
      { name: "Utilities & Power", value: 16, color: "#10B981" }
    ],
    riskFactors: [
      {
        title: "Community Business Forum Delays",
        severity: "high",
        impact: "Section 3 access road blocked intermittently by local sub-forum demands.",
        mitigation: "Project Liaison Committee (PLC) 30% local subcontracting charter finalized."
      },
      {
        title: "Hard Rock Basalt Blasting Permits (N1 Interchange)",
        severity: "medium",
        impact: "Blasting proximity to Eskom 400kV pylon required vibration dampening mats.",
        mitigation: "Laser acoustic seismographs installed with live council telemetry."
      }
    ],
    projects: [
      {
        id: "jhb-01",
        name: "SANRAL N1/N3 Freight Corridor Expansion & Interchange",
        code: "ZAF-N1-EXP",
        sector: "Civil Infrastructure",
        client: "South African National Roads Agency (SANRAL)",
        contractValue: 420000000,
        localValue: "7.72B ZAR",
        progressPercent: 56.4,
        targetPercent: 60.1,
        spi: 0.94,
        cpi: 0.95,
        status: "Critical Path Monitor",
        criticalActivity: "Precast beam placement over active 8-lane N1 highway at midnight",
        contractType: "FIDIC Red Book",
        activeRisksCount: 4,
        capitalAtRisk: 26000000,
        latestMilestone: "Culvert CH 0+400 base slab 100% cast and cured",
        projectManager: "Gerhard Coetzee",
        coordinates: { lat: -26.1102, lng: 28.1405 }
      },
      {
        id: "jhb-02",
        name: "Gautrain Midrand Logistics Terminal Expansion",
        code: "ZAF-GTR-MID",
        sector: "Transport & Rail",
        client: "Gautrain Management Agency (GMA)",
        contractValue: 210000000,
        localValue: "3.86B ZAR",
        progressPercent: 38.2,
        targetPercent: 41.0,
        spi: 0.93,
        cpi: 0.98,
        status: "On Track",
        criticalActivity: "Continuous welded rail laying and depot maintenance pit civil works",
        contractType: "NEC3 Option C",
        activeRisksCount: 2,
        capitalAtRisk: 12000000,
        latestMilestone: "Substation transformer energized and passed SABS testing",
        projectManager: "Thabo Mokoena",
        coordinates: { lat: -25.9982, lng: 28.1255 }
      },
      {
        id: "jhb-03",
        name: "Gauteng Bulk Water Conveyance Pipeline",
        code: "ZAF-WTR-BLK",
        sector: "Utilities & Power",
        client: "Rand Water / Department of Water and Sanitation",
        contractValue: 120000000,
        localValue: "2.20B ZAR",
        progressPercent: 69.5,
        targetPercent: 71.0,
        spi: 0.98,
        cpi: 0.99,
        status: "On Track",
        criticalActivity: "1,600mm welded steel pipe joint cathodic protection wrapping",
        contractType: "FIDIC Red Book",
        activeRisksCount: 1,
        capitalAtRisk: 6000000,
        latestMilestone: "14km pipeline pressure testing passed at 25 bar",
        projectManager: "Zanele Khumalo",
        coordinates: { lat: -26.3101, lng: 28.0122 }
      }
    ]
  }
];

// Global Analytical Aggregations for Pie Charts & Graphs
export const GLOBAL_SECTOR_BREAKDOWN = [
  { name: "Transport & High-Speed Rail", value: 1830000000, percentage: 38.0, color: "#3B82F6" },
  { name: "Civil Infrastructure & Civils", value: 1250000000, percentage: 26.0, color: "#F59E0B" },
  { name: "Water, Power & Mega-Utilities", value: 1010000000, percentage: 21.0, color: "#10B981" },
  { name: "Ports, Marine & Intermodal", value: 730000000, percentage: 15.0, color: "#06B6D4" }
];

export const GLOBAL_RISK_BREAKDOWN = [
  { name: "Geotechnical & Soil Variances", value: 106000000, percentage: 34.0, color: "#EF4444" },
  { name: "Material Price & Supply Logistics", value: 87000000, percentage: 28.0, color: "#F97316" },
  { name: "Contractual Claims & RFI Delay", value: 75000000, percentage: 24.0, color: "#EAB308" },
  { name: "Regulatory & Environmental Permits", value: 44000000, percentage: 14.0, color: "#64748B" }
];

export const PORTFOLIO_S_CURVE_DATA = [
  { month: "Q1 '25", baseline: 620, actual: 610, earned: 590 },
  { month: "Q2 '25", baseline: 1240, actual: 1190, earned: 1120 },
  { month: "Q3 '25", baseline: 1980, actual: 1860, earned: 1740 },
  { month: "Q4 '25", baseline: 2750, actual: 2590, earned: 2410 },
  { month: "Q1 '26", baseline: 3420, actual: 3200, earned: 3010 },
  { month: "Q2 '26", baseline: 4120, actual: 3880, earned: 3670 },
  { month: "Q3 '26 (Current)", baseline: 4820, actual: 4490, earned: 4210 },
  { month: "Q4 '26 (Fcst)", baseline: 5410, actual: null, earned: null, forecast: 5080 },
  { month: "Q1 '27 (Fcst)", baseline: 5980, actual: null, earned: null, forecast: 5740 },
];

export const HUB_CAPITAL_COMPARISON = [
  { city: "Riyadh", value: 1450, risk: 94, projects: 8, spi: 0.98 },
  { city: "Dubai", value: 1120, risk: 58, projects: 6, spi: 1.01 },
  { city: "Abu Dhabi", value: 610, risk: 42, projects: 4, spi: 0.95 },
  { city: "Doha", value: 380, risk: 26, projects: 3, spi: 1.01 },
  { city: "Dar es Salaam", value: 510, risk: 48, projects: 3, spi: 0.91 },
  { city: "Johannesburg", value: 750, risk: 44, projects: 3, spi: 0.94 },
];

export interface PortfolioMilestone {
  id: string;
  projectName: string;
  projectCode: string;
  hubId: string;
  hubCity: string;
  countryCode: string;
  title: string;
  category: "Engineering" | "Commercial" | "Civil Works" | "Commissioning" | "Regulatory";
  targetDate: string;
  daysRemaining: number;
  criticalPath: boolean;
  contractClause?: string;
  status: "On Track" | "At Risk" | "Critical Path Monitor";
  impactScore: number;
}

export const GLOBAL_UPCOMING_MILESTONES: PortfolioMilestone[] = [
  {
    id: "ms-01",
    projectName: "Riyadh Metro Line 4 Spine",
    projectCode: "KSA-RUH-M4",
    hubId: "riyadh",
    hubCity: "Riyadh",
    countryCode: "SA",
    title: "Viaduct Deck Precast Closure (Pier P-42 to P-58)",
    category: "Civil Works",
    targetDate: "2026-09-02",
    daysRemaining: 16,
    criticalPath: true,
    contractClause: "FIDIC Cl. 8.2",
    status: "On Track",
    impactScore: 92
  },
  {
    id: "ms-02",
    projectName: "Central Corridor SGR Lot 3",
    projectCode: "TZA-SGR-L03",
    hubId: "daressalaam",
    hubCity: "Dar es Salaam",
    countryCode: "TZ",
    title: "Traction Substation 25kV Overhead Electrification",
    category: "Commissioning",
    targetDate: "2026-09-10",
    daysRemaining: 24,
    criticalPath: true,
    contractClause: "FIDIC Cl. 9.1",
    status: "Critical Path Monitor",
    impactScore: 95
  },
  {
    id: "ms-03",
    projectName: "Diriyah Gate Substructure",
    projectCode: "KSA-DIR-08",
    hubId: "riyadh",
    hubCity: "Riyadh",
    countryCode: "SA",
    title: "Level -3 Limestone Fissure Jet Grout Grouting Sign-off",
    category: "Engineering",
    targetDate: "2026-09-18",
    daysRemaining: 32,
    criticalPath: true,
    contractClause: "FIDIC Cl. 4.12",
    status: "At Risk",
    impactScore: 88
  },
  {
    id: "ms-04",
    projectName: "SANRAL N1/N3 Interchange",
    projectCode: "ZAF-N1-EXP",
    hubId: "johannesburg",
    hubCity: "Johannesburg",
    countryCode: "ZA",
    title: "Precast Beam Placement Over Active 8-Lane N1 Highway",
    category: "Civil Works",
    targetDate: "2026-09-28",
    daysRemaining: 42,
    criticalPath: false,
    contractClause: "GCC 2015 Cl. 5.14",
    status: "On Track",
    impactScore: 78
  },
  {
    id: "ms-05",
    projectName: "Dubai Creek Harbour Tower",
    projectCode: "UAE-DXB-CRK",
    hubId: "dubai",
    hubCity: "Dubai",
    countryCode: "AE",
    title: "Marine Cofferdam Dewatering & Bascule Bridge Commissioning",
    category: "Engineering",
    targetDate: "2026-10-15",
    daysRemaining: 59,
    criticalPath: true,
    contractClause: "FIDIC Cl. 10.1",
    status: "On Track",
    impactScore: 85
  },
  {
    id: "ms-06",
    projectName: "Dar Port Berths 8-11 Terminal",
    projectCode: "TZA-PRT-B08",
    hubId: "daressalaam",
    hubCity: "Dar es Salaam",
    countryCode: "TZ",
    title: "Interim Payment Certificate #18 ($12.4M) Verification",
    category: "Commercial",
    targetDate: "2026-10-25",
    daysRemaining: 69,
    criticalPath: false,
    contractClause: "FIDIC Cl. 14.6",
    status: "On Track",
    impactScore: 74
  },
  {
    id: "ms-07",
    projectName: "Etihad Rail West Coast Terminal",
    projectCode: "UAE-AUH-ETR",
    hubId: "abudhabi",
    hubCity: "Abu Dhabi",
    countryCode: "AE",
    title: "Heavy Maintenance Depot Taking-Over Certificate (TOC)",
    category: "Regulatory",
    targetDate: "2026-11-12",
    daysRemaining: 87,
    criticalPath: true,
    contractClause: "FIDIC Cl. 10.2",
    status: "On Track",
    impactScore: 90
  }
];

export interface MonthlyCashFlow {
  month: string;
  plannedDrawdown: number; // in Millions USD
  certifiedActual: number | null; // in Millions USD
  forecastDrawdown: number; // in Millions USD
  ipcInvoiced: number | null;
  ipcReceived: number | null;
  retentionWithheld: number;
}

export const GLOBAL_CASH_FLOW_FORECAST: MonthlyCashFlow[] = [
  { month: "Jan '26", plannedDrawdown: 142, certifiedActual: 139, forecastDrawdown: 139, ipcInvoiced: 138, ipcReceived: 135, retentionWithheld: 6.9 },
  { month: "Feb '26", plannedDrawdown: 156, certifiedActual: 151, forecastDrawdown: 151, ipcInvoiced: 149, ipcReceived: 146, retentionWithheld: 7.5 },
  { month: "Mar '26", plannedDrawdown: 168, certifiedActual: 162, forecastDrawdown: 162, ipcInvoiced: 160, ipcReceived: 154, retentionWithheld: 8.1 },
  { month: "Apr '26", plannedDrawdown: 180, certifiedActual: 173, forecastDrawdown: 173, ipcInvoiced: 171, ipcReceived: 168, retentionWithheld: 8.6 },
  { month: "May '26", plannedDrawdown: 195, certifiedActual: 188, forecastDrawdown: 188, ipcInvoiced: 184, ipcReceived: 180, retentionWithheld: 9.4 },
  { month: "Jun '26", plannedDrawdown: 210, certifiedActual: 204, forecastDrawdown: 204, ipcInvoiced: 201, ipcReceived: 196, retentionWithheld: 10.2 },
  { month: "Jul '26", plannedDrawdown: 225, certifiedActual: 218, forecastDrawdown: 218, ipcInvoiced: 215, ipcReceived: 209, retentionWithheld: 10.9 },
  { month: "Aug '26 (Act)", plannedDrawdown: 238, certifiedActual: 229, forecastDrawdown: 229, ipcInvoiced: 226, ipcReceived: 218, retentionWithheld: 11.4 },
  { month: "Sep '26 (Fcst)", plannedDrawdown: 245, certifiedActual: null, forecastDrawdown: 236, ipcInvoiced: null, ipcReceived: null, retentionWithheld: 11.8 },
  { month: "Oct '26 (Fcst)", plannedDrawdown: 252, certifiedActual: null, forecastDrawdown: 241, ipcInvoiced: null, ipcReceived: null, retentionWithheld: 12.0 },
  { month: "Nov '26 (Fcst)", plannedDrawdown: 260, certifiedActual: null, forecastDrawdown: 248, ipcInvoiced: null, ipcReceived: null, retentionWithheld: 12.4 },
  { month: "Dec '26 (Fcst)", plannedDrawdown: 270, certifiedActual: null, forecastDrawdown: 258, ipcInvoiced: null, ipcReceived: null, retentionWithheld: 12.9 }
];

export interface PortfolioHealthPillar {
  key: string;
  name: string;
  score: number; // 0-100
  weight: number; // percentage
  status: "Optimal" | "Monitored" | "Distressed";
  summary: string;
  spiOrCpi?: string;
}

export const PORTFOLIO_HEALTH_PILLARS: PortfolioHealthPillar[] = [
  { key: "schedule", name: "Schedule & Critical Path", score: 82.5, weight: 25, status: "Monitored", summary: "Portfolio SPI at 0.96. 4 projects tracking 2-4 weeks off baseline path.", spiOrCpi: "SPI 0.96" },
  { key: "cost", name: "Cost & Budget Integrity", score: 88.0, weight: 20, status: "Optimal", summary: "CPI at 0.98 across multinational contracts with disciplined margin controls.", spiOrCpi: "CPI 0.98" },
  { key: "quality", name: "Quality & Material ITPs", score: 91.4, weight: 15, status: "Optimal", summary: "98.2% non-conformance closure rate within 14-day contractual cycle.", spiOrCpi: "Pass 98.2%" },
  { key: "hseq", name: "HSEQ Safety & Environmental", score: 94.8, weight: 15, status: "Optimal", summary: "Zero Lost Time Injuries (LTIFR: 0.04 across 14.8M aggregate man-hours).", spiOrCpi: "LTIFR 0.04" },
  { key: "commercial", name: "FIDIC / Commercial Claims", score: 71.2, weight: 15, status: "Distressed", summary: "$78.4M open variation & EoT claims under assessment across 3 corridors.", spiOrCpi: "Claim $78M" },
  { key: "procurement", name: "Supply Chain & Logistics", score: 79.6, weight: 10, status: "Monitored", summary: "Port customs clearance and long-lead structural steel deliveries stabilized.", spiOrCpi: "Lead 94%" }
];
