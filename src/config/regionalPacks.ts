import { RegionConfig, REGION_CONFIGS, getRegionConfig } from "./countries";
import { SupportedCurrency, getCurrencyInfo } from "./currencies";
import { LocaleInfo, getLocaleInfo } from "./locales";
import { ContractFramework, DEFAULT_CONTRACT_FRAMEWORK } from "./contractFrameworks";

export interface AuthorityDetail {
  code: string;
  name: string;
  category: "Roads & Highways" | "Rail & Transit" | "Ports & Maritime" | "Municipal & Urban" | "Energy & Water" | "Regulatory";
  description: string;
}

export interface TaxConfiguration {
  taxName: "VAT" | "GST" | "TVA" | "Sales Tax" | "Customs & Excise" | "Corporate Tax";
  standardRate: number; // percentage
  withholdingTaxRate: number; // percentage
  taxAuthorityName: string;
  taxNumberLabel: string; // e.g. "TIN (Taxpayer Identification Number)", "VAT Registration No", "TRN"
  taxInvoiceRequired: boolean;
}

export interface RegionalPack {
  id: string;
  countryCode: string;
  countryName: string;
  regionCategory: "East Africa" | "Southern Africa" | "Middle East / GCC" | "Europe" | "North America" | "Asia Pacific";
  currencyCode: SupportedCurrency;
  currencySymbol: string;
  locale: string;
  timezone: string;
  measurementSystem: "metric" | "imperial";
  defaultLanguage: string;
  supportedLanguages: { code: string; label: string; nativeLabel: string }[];
  defaultContractFramework: ContractFramework;
  tax: TaxConfiguration;
  authorities: AuthorityDetail[];
  climateWindowNote: string;
  regulatoryStandardNotes: string[];
}

export const REGIONAL_PACKS: Record<string, RegionalPack> = {
  TZ: {
    id: "tz-pack",
    countryCode: "TZ",
    countryName: "Tanzania",
    regionCategory: "East Africa",
    currencyCode: "TZS",
    currencySymbol: "TSh",
    locale: "en-TZ",
    timezone: "Africa/Dar_es_Salaam",
    measurementSystem: "metric",
    defaultLanguage: "en",
    supportedLanguages: [
      { code: "en", label: "English", nativeLabel: "English" },
      { code: "sw", label: "Swahili", nativeLabel: "Kiswahili" }
    ],
    defaultContractFramework: "FIDIC (International Federation of Consulting Engineers) Red Book",
    tax: {
      taxName: "VAT",
      standardRate: 18,
      withholdingTaxRate: 5,
      taxAuthorityName: "TRA (Tanzania Revenue Authority)",
      taxNumberLabel: "TIN / VAT Registration Number",
      taxInvoiceRequired: true
    },
    authorities: [
      {
        code: "TANROADS",
        name: "Tanzania National Roads Agency",
        category: "Roads & Highways",
        description: "National trunk and regional road network development, maintenance, and bridge asset management."
      },
      {
        code: "TARURA",
        name: "Tanzania Rural and Urban Roads Agency",
        category: "Municipal & Urban",
        description: "District, feeder, urban asphalt, and community drainage infrastructure."
      },
      {
        code: "TRC",
        name: "Tanzania Railways Corporation",
        category: "Rail & Transit",
        description: "Standard Gauge Railway (SGR) lot expansion and Central Corridor heavy freight logistics."
      },
      {
        code: "TPA",
        name: "Tanzania Ports Authority",
        category: "Ports & Maritime",
        description: "Dar es Salaam, Tanga, and Mtwara deep-water berth terminals and marine civil works."
      },
      {
        code: "TANESCO",
        name: "Tanzania Electric Supply Company",
        category: "Energy & Water",
        description: "Grid transmission corridor substations, hydroelectric dams, and HV power lines."
      }
    ],
    climateWindowNote: "Monsoon rains (Masika: March-May, Vuli: Oct-Dec) require soil stabilization and lime-treated subgrade drainage.",
    regulatoryStandardNotes: [
      "PPRA (Public Procurement Regulatory Authority) standard bidding compliance",
      "NEMC (National Environment Management Council) EIA certification mandatory before groundbreaking",
      "CRB (Contractors Registration Board) mandatory registration for local and foreign contractors"
    ]
  },

  ZA: {
    id: "za-pack",
    countryCode: "ZA",
    countryName: "South Africa",
    regionCategory: "Southern Africa",
    currencyCode: "ZAR",
    currencySymbol: "R",
    locale: "en-ZA",
    timezone: "Africa/Johannesburg",
    measurementSystem: "metric",
    defaultLanguage: "en",
    supportedLanguages: [
      { code: "en", label: "English", nativeLabel: "English" },
      { code: "zu", label: "Zulu", nativeLabel: "isiZulu" },
      { code: "af", label: "Afrikaans", nativeLabel: "Afrikaans" }
    ],
    defaultContractFramework: "NEC4",
    tax: {
      taxName: "VAT",
      standardRate: 15,
      withholdingTaxRate: 0,
      taxAuthorityName: "SARS (South African Revenue Service)",
      taxNumberLabel: "SARS Tax Reference / VAT Registration No",
      taxInvoiceRequired: true
    },
    authorities: [
      {
        code: "SANRAL",
        name: "South African National Roads Agency SOC Ltd",
        category: "Roads & Highways",
        description: "National road network (N1, N2, N3, N4) engineering, toll freeways, and interchange bridges."
      },
      {
        code: "Transnet",
        name: "Transnet Freight Rail & Port Terminals",
        category: "Rail & Transit",
        description: "Heavy haul coal/ore rail corridors, container freight logistics, and maritime port quays."
      },
      {
        code: "GMA",
        name: "Gautrain Management Agency",
        category: "Rail & Transit",
        description: "High-speed passenger rapid rail extension corridors and intermodal depot terminals."
      },
      {
        code: "Rand Water",
        name: "Rand Water Bulk Water Authority",
        category: "Energy & Water",
        description: "Bulk pipeline civil excavation, booster pump stations, and treated potable water reservoirs."
      }
    ],
    climateWindowNote: "Highveld summer thunderstorm downpours require rapid trench dewatering; coastal winter rain in Western Cape.",
    regulatoryStandardNotes: [
      "CIDB (Construction Industry Development Board) grading & contractor compliance",
      "B-BBEE (Broad-Based Black Economic Empowerment) local subcontracting charter (minimum 30% CPG)",
      "OHSA (Occupational Health and Safety Act) Construction Regulations 2014 client agent compliance"
    ]
  },

  SA: {
    id: "sa-pack",
    countryCode: "SA",
    countryName: "Saudi Arabia",
    regionCategory: "Middle East / GCC",
    currencyCode: "SAR",
    currencySymbol: "﷼",
    locale: "en-SA",
    timezone: "Asia/Riyadh",
    measurementSystem: "metric",
    defaultLanguage: "en",
    supportedLanguages: [
      { code: "en", label: "English", nativeLabel: "English" },
      { code: "ar", label: "Arabic", nativeLabel: "العربية" }
    ],
    defaultContractFramework: "FIDIC Silver Book",
    tax: {
      taxName: "VAT",
      standardRate: 15,
      withholdingTaxRate: 5,
      taxAuthorityName: "ZATCA (Zakat, Tax and Customs Authority)",
      taxNumberLabel: "ZATCA VAT / Tax Identification Number",
      taxInvoiceRequired: true
    },
    authorities: [
      {
        code: "RCRC",
        name: "Royal Commission for Riyadh City",
        category: "Municipal & Urban",
        description: "Riyadh Metro, Green Riyadh, King Salman Park, and capital city strategic urban corridors."
      },
      {
        code: "MOTLS",
        name: "Ministry of Transport and Logistic Services",
        category: "Roads & Highways",
        description: "Inter-city expressway network, logistics zones, and overland dry ports."
      },
      {
        code: "NEOM",
        name: "NEOM Infrastructure & Mobility Authority",
        category: "Municipal & Urban",
        description: "THE LINE high-speed subterranean rail spine, Oxagon port, and Trojena infrastructure."
      },
      {
        code: "SAR",
        name: "Saudi Arabia Railways",
        category: "Rail & Transit",
        description: "North-South heavy minerals rail, Haramain high speed rail, and Landbridge railway."
      }
    ],
    climateWindowNote: "Extreme summer ambient heat (>45°C) requires midday work stoppages, nocturnal pours, and chilled batch water.",
    regulatoryStandardNotes: [
      "ZATCA Fatoorah Phase 2 electronic invoicing cryptographic QR code integration",
      "Saudi Building Code (SBC) structural and seismic compliance",
      "Civil Defense fire safety and deep underground station emergency evacuation approval"
    ]
  },

  AE: {
    id: "ae-pack",
    countryCode: "AE",
    countryName: "United Arab Emirates",
    regionCategory: "Middle East / GCC",
    currencyCode: "AED",
    currencySymbol: "د.إ",
    locale: "en-AE",
    timezone: "Asia/Dubai",
    measurementSystem: "metric",
    defaultLanguage: "en",
    supportedLanguages: [
      { code: "en", label: "English", nativeLabel: "English" },
      { code: "ar", label: "Arabic", nativeLabel: "العربية" }
    ],
    defaultContractFramework: "FIDIC Yellow Book",
    tax: {
      taxName: "VAT",
      standardRate: 5,
      withholdingTaxRate: 0,
      taxAuthorityName: "FTA (Federal Tax Authority)",
      taxNumberLabel: "TRN (Tax Registration Number)",
      taxInvoiceRequired: true
    },
    authorities: [
      {
        code: "RTA",
        name: "Roads and Transport Authority (Dubai)",
        category: "Roads & Highways",
        description: "Dubai Metro extensions, smart traffic tunnels, bridges, and municipal expressway flyovers."
      },
      {
        code: "Etihad Rail",
        name: "Etihad Rail Company",
        category: "Rail & Transit",
        description: "National passenger and freight railway linking GCC borders, ports, and industrial cities."
      },
      {
        code: "Musanada",
        name: "Abu Dhabi General Services Company",
        category: "Municipal & Urban",
        description: "Government buildings, hospitals, transport junctions, and master community infrastructure."
      }
    ],
    climateWindowNote: "Summer midday work ban (12:30pm to 3:00pm) strictly enforced by Ministry of Human Resources & Emiratisation.",
    regulatoryStandardNotes: [
      "Dubai Municipality / Estidama green building rating system compliance",
      "Civil Aviation Authority height clearance for tower cranes and heavy lifting operations",
      "DEWA / ADDC utility corridor NOC (No Objection Certificate) protocol"
    ]
  },

  KE: {
    id: "ke-pack",
    countryCode: "KE",
    countryName: "Kenya",
    regionCategory: "East Africa",
    currencyCode: "KES",
    currencySymbol: "KSh",
    locale: "en-KE",
    timezone: "Africa/Nairobi",
    measurementSystem: "metric",
    defaultLanguage: "en",
    supportedLanguages: [
      { code: "en", label: "English", nativeLabel: "English" },
      { code: "sw", label: "Swahili", nativeLabel: "Kiswahili" }
    ],
    defaultContractFramework: "FIDIC (International Federation of Consulting Engineers) Red Book",
    tax: {
      taxName: "VAT",
      standardRate: 16,
      withholdingTaxRate: 3,
      taxAuthorityName: "KRA (Kenya Revenue Authority)",
      taxNumberLabel: "KRA PIN / VAT Number",
      taxInvoiceRequired: true
    },
    authorities: [
      {
        code: "KeNHA",
        name: "Kenya National Highways Authority",
        category: "Roads & Highways",
        description: "Class A, B, and C national trunk highways, expressway viaducts, and international transit corridors."
      },
      {
        code: "KURA",
        name: "Kenya Urban Roads Authority",
        category: "Municipal & Urban",
        description: "Nairobi, Mombasa, and regional city ring roads and urban interchanges."
      },
      {
        code: "KRC",
        name: "Kenya Railways Corporation",
        category: "Rail & Transit",
        description: "Mombasa-Nairobi-Naivasha SGR operations and commuter rail network."
      }
    ],
    climateWindowNote: "Long rains (March-May) affect rift valley earthworks; strict drainage culvert sizing required.",
    regulatoryStandardNotes: [
      "NCA (National Construction Authority) site registration and supervisor accreditation",
      "NEMA (National Environment Management Authority) environmental compliance license",
      "PPRA Kenya standard bidding procurement guidelines"
    ]
  },

  GB: {
    id: "gb-pack",
    countryCode: "GB",
    countryName: "United Kingdom",
    regionCategory: "Europe",
    currencyCode: "GBP",
    currencySymbol: "£",
    locale: "en-GB",
    timezone: "Europe/London",
    measurementSystem: "metric",
    defaultLanguage: "en",
    supportedLanguages: [
      { code: "en", label: "English", nativeLabel: "English" }
    ],
    defaultContractFramework: "NEC4",
    tax: {
      taxName: "VAT",
      standardRate: 20,
      withholdingTaxRate: 0,
      taxAuthorityName: "HMRC (HM Revenue & Customs)",
      taxNumberLabel: "HMRC VAT Registration Number",
      taxInvoiceRequired: true
    },
    authorities: [
      {
        code: "National Highways",
        name: "National Highways",
        category: "Roads & Highways",
        description: "Strategic road network, motorways, and major A-roads across England."
      },
      {
        code: "Network Rail",
        name: "Network Rail",
        category: "Rail & Transit",
        description: "Railway track infrastructure, electrification masts, and major terminal stations."
      }
    ],
    climateWindowNote: "Winter frost and rain windows require heated aggregates for asphalt surfacing and concrete curing blankets.",
    regulatoryStandardNotes: [
      "CDM (Construction Design and Management) Regulations 2015",
      "BSI (British Standards Institution) and Eurocode structural standards",
      "Environment Agency discharge consents for groundwater dewatering"
    ]
  },

  US: {
    id: "us-pack",
    countryCode: "US",
    countryName: "United States",
    regionCategory: "North America",
    currencyCode: "USD",
    currencySymbol: "$",
    locale: "en-US",
    timezone: "America/New_York",
    measurementSystem: "imperial",
    defaultLanguage: "en",
    supportedLanguages: [
      { code: "en", label: "English", nativeLabel: "English" },
      { code: "es", label: "Spanish", nativeLabel: "Español" }
    ],
    defaultContractFramework: "NEC4",
    tax: {
      taxName: "Sales Tax",
      standardRate: 8.5,
      withholdingTaxRate: 0,
      taxAuthorityName: "IRS / State Department of Revenue",
      taxNumberLabel: "Federal EIN (Employer Identification Number)",
      taxInvoiceRequired: true
    },
    authorities: [
      {
        code: "FHWA",
        name: "Federal Highway Administration",
        category: "Roads & Highways",
        description: "Interstate highway system funding, bridge inspection standards, and national corridor safety."
      },
      {
        code: "USACE",
        name: "US Army Corps of Engineers",
        category: "Ports & Maritime",
        description: "Inland waterways, flood control dams, harbor dredging, and wetland permit administration."
      }
    ],
    climateWindowNote: "Seasonal freeze-thaw cycles in northern states require DOT-approved sub-base frost blankets.",
    regulatoryStandardNotes: [
      "OSHA 1926 Construction Safety and Health Standards",
      "AASHTO highway and bridge design specifications",
      "EPA Clean Water Act Section 404 permit compliance"
    ]
  }
};

export const DEFAULT_REGIONAL_PACK = REGIONAL_PACKS["TZ"];

export function getRegionalPack(countryCodeOrId?: string | null): RegionalPack {
  if (!countryCodeOrId) return DEFAULT_REGIONAL_PACK;
  const upper = countryCodeOrId.toUpperCase();
  if (REGIONAL_PACKS[upper]) return REGIONAL_PACKS[upper];

  // Try finding by pack id
  const found = Object.values(REGIONAL_PACKS).find(
    (p) => p.id.toLowerCase() === countryCodeOrId.toLowerCase()
  );
  if (found) return found;

  // Dynamically resolve from RegionConfig
  const rc = getRegionConfig(upper);
  if (rc) {
    const currInfo = getCurrencyInfo((rc.currency || "USD") as SupportedCurrency);
    return {
      id: `${upper.toLowerCase()}-pack`,
      countryCode: rc.countryCode,
      countryName: rc.countryName,
      regionCategory: (currInfo?.region || "Global Major") as any,
      currencyCode: (rc.currency || "USD") as SupportedCurrency,
      currencySymbol: currInfo?.symbol || "$",
      locale: rc.locale || "en",
      timezone: rc.timezone || "UTC",
      measurementSystem: rc.measurementSystem || "metric",
      defaultLanguage: rc.defaultLanguage || "en",
      supportedLanguages: [
        { code: "en", label: "English", nativeLabel: "English" }
      ],
      defaultContractFramework: DEFAULT_CONTRACT_FRAMEWORK,
      tax: {
        taxName: (rc.taxName as any) || "VAT",
        standardRate: rc.defaultTaxRate || 15,
        withholdingTaxRate: 0,
        taxAuthorityName: rc.publicAuthorities?.[0] || `${rc.countryName} Revenue Authority`,
        taxNumberLabel: `${rc.taxName || "Tax"} Identification Number`,
        taxInvoiceRequired: true
      },
      authorities: (rc.publicAuthorities || []).map((authName, idx) => ({
        code: `AUTH-${idx + 1}`,
        name: authName,
        category: "Roads & Highways",
        description: `Statutory oversight and infrastructure administration for ${rc.countryName}.`
      })),
      climateWindowNote: `Standard construction logistics and environmental scheduling in ${rc.countryName}.`,
      regulatoryStandardNotes: [
        `Statutory procurement and civil works compliance standards for ${rc.countryName}.`
      ]
    };
  }

  return DEFAULT_REGIONAL_PACK;
}

export function getAllRegionalPacks(): RegionalPack[] {
  return Object.values(REGIONAL_PACKS);
}
