export interface RegionConfig {
  countryCode: string;
  countryName: string;
  currency: string;
  locale: string;
  timezone: string;
  measurementSystem: "metric" | "imperial";
  defaultLanguage: string;
  taxName?: string;
  defaultTaxRate?: number;
  publicAuthorities?: string[];
  callingCode?: string;
  flagEmoji?: string;
}

export const REGION_CONFIGS: Record<string, RegionConfig> = {
  TZ: {
    countryCode: "TZ",
    countryName: "Tanzania",
    currency: "TZS",
    locale: "en-TZ",
    timezone: "Africa/Dar_es_Salaam",
    measurementSystem: "metric",
    defaultLanguage: "en",
    taxName: "VAT",
    defaultTaxRate: 18,
    publicAuthorities: [
      "TANROADS (Tanzania National Roads Agency)",
      "TARURA (Tanzania Rural and Urban Roads Agency)",
      "TRC (Tanzania Railways Corporation)",
      "TPA (Tanzania Ports Authority)",
      "TANESCO (Tanzania Electric Supply Company)"
    ],
    callingCode: "+255",
    flagEmoji: "🇹🇿"
  },

  ZA: {
    countryCode: "ZA",
    countryName: "South Africa",
    currency: "ZAR",
    locale: "en-ZA",
    timezone: "Africa/Johannesburg",
    measurementSystem: "metric",
    defaultLanguage: "en",
    taxName: "VAT",
    defaultTaxRate: 15,
    publicAuthorities: [
      "SANRAL (South African National Roads Agency)",
      "Transnet Freight Rail",
      "Gautrain Management Agency (GMA)",
      "Rand Water",
      "Eskom Megawatt Park"
    ],
    callingCode: "+27",
    flagEmoji: "🇿🇦"
  },

  AE: {
    countryCode: "AE",
    countryName: "United Arab Emirates",
    currency: "AED",
    locale: "en-AE",
    timezone: "Asia/Dubai",
    measurementSystem: "metric",
    defaultLanguage: "en",
    taxName: "VAT",
    defaultTaxRate: 5,
    publicAuthorities: [
      "RTA (Roads and Transport Authority Dubai)",
      "Etihad Rail Company",
      "Musanada (Abu Dhabi General Services)",
      "Dubai Municipality",
      "Abu Dhabi Department of Transport (DoT)"
    ],
    callingCode: "+971",
    flagEmoji: "🇦🇪"
  },

  SA: {
    countryCode: "SA",
    countryName: "Saudi Arabia",
    currency: "SAR",
    locale: "en-SA",
    timezone: "Asia/Riyadh",
    measurementSystem: "metric",
    defaultLanguage: "en",
    taxName: "VAT",
    defaultTaxRate: 15,
    publicAuthorities: [
      "RCRC (Royal Commission for Riyadh City)",
      "MOTLS (Ministry of Transport and Logistic Services)",
      "RCJY (Royal Commission for Jubail & Yanbu)",
      "NEOM Infrastructure Authority",
      "Saudi Arabia Railways (SAR)"
    ],
    callingCode: "+966",
    flagEmoji: "🇸🇦"
  },

  QA: {
    countryCode: "QA",
    countryName: "Qatar",
    currency: "QAR",
    locale: "en-QA",
    timezone: "Asia/Qatar",
    measurementSystem: "metric",
    defaultLanguage: "en",
    taxName: "Customs & Excise",
    defaultTaxRate: 0,
    publicAuthorities: [
      "Ashghal (Public Works Authority)",
      "Qatar Rail",
      "Kahramaa (Qatar General Electricity & Water)",
      "Ministry of Municipality"
    ],
    callingCode: "+974",
    flagEmoji: "🇶🇦"
  },

  KW: {
    countryCode: "KW",
    countryName: "Kuwait",
    currency: "KWD",
    locale: "en-KW",
    timezone: "Asia/Kuwait",
    measurementSystem: "metric",
    defaultLanguage: "en",
    taxName: "Corporate Tax",
    defaultTaxRate: 0,
    publicAuthorities: [
      "MPW (Ministry of Public Works)",
      "PAHW (Public Authority for Housing Welfare)",
      "PART (Public Authority for Roads and Transportation)"
    ],
    callingCode: "+965",
    flagEmoji: "🇰🇼"
  },

  OM: {
    countryCode: "OM",
    countryName: "Oman",
    currency: "OMR",
    locale: "en-OM",
    timezone: "Asia/Muscat",
    measurementSystem: "metric",
    defaultLanguage: "en",
    taxName: "VAT",
    defaultTaxRate: 5,
    publicAuthorities: [
      "MTCIT (Ministry of Transport, Communications and IT)",
      "Asyad Group",
      "Nama Holding"
    ],
    callingCode: "+968",
    flagEmoji: "🇴🇲"
  },

  KE: {
    countryCode: "KE",
    countryName: "Kenya",
    currency: "KES",
    locale: "en-KE",
    timezone: "Africa/Nairobi",
    measurementSystem: "metric",
    defaultLanguage: "en",
    taxName: "VAT",
    defaultTaxRate: 16,
    publicAuthorities: [
      "KeNHA (Kenya National Highways Authority)",
      "KURA (Kenya Urban Roads Authority)",
      "KeRRA (Kenya Rural Roads Authority)",
      "Kenya Railways Corporation"
    ],
    callingCode: "+254",
    flagEmoji: "🇰🇪"
  },

  UG: {
    countryCode: "UG",
    countryName: "Uganda",
    currency: "UGX",
    locale: "en-UG",
    timezone: "Africa/Kampala",
    measurementSystem: "metric",
    defaultLanguage: "en",
    taxName: "VAT",
    defaultTaxRate: 18,
    publicAuthorities: [
      "UNRA (Uganda National Roads Authority)",
      "Uganda Railways Corporation"
    ],
    callingCode: "+256",
    flagEmoji: "🇺🇬"
  },

  RW: {
    countryCode: "RW",
    countryName: "Rwanda",
    currency: "RWF",
    locale: "en-RW",
    timezone: "Africa/Kigali",
    measurementSystem: "metric",
    defaultLanguage: "en",
    taxName: "VAT",
    defaultTaxRate: 18,
    publicAuthorities: [
      "RTDA (Rwanda Transport Development Agency)",
      "WASAC (Water and Sanitation Corporation)"
    ],
    callingCode: "+250",
    flagEmoji: "🇷🇼"
  },

  GB: {
    countryCode: "GB",
    countryName: "United Kingdom",
    currency: "GBP",
    locale: "en-GB",
    timezone: "Europe/London",
    measurementSystem: "metric",
    defaultLanguage: "en",
    taxName: "VAT",
    defaultTaxRate: 20,
    publicAuthorities: [
      "National Highways",
      "Network Rail",
      "Environment Agency"
    ],
    callingCode: "+44",
    flagEmoji: "🇬🇧"
  },

  US: {
    countryCode: "US",
    countryName: "United States",
    currency: "USD",
    locale: "en-US",
    timezone: "America/New_York",
    measurementSystem: "imperial",
    defaultLanguage: "en",
    taxName: "Sales Tax",
    defaultTaxRate: 8.5,
    publicAuthorities: [
      "Federal Highway Administration (FHWA)",
      "US Army Corps of Engineers (USACE)",
      "Department of Transportation (DOT)"
    ],
    callingCode: "+1",
    flagEmoji: "🇺🇸"
  },

  AU: {
    countryCode: "AU",
    countryName: "Australia",
    currency: "AUD",
    locale: "en-AU",
    timezone: "Australia/Sydney",
    measurementSystem: "metric",
    defaultLanguage: "en",
    taxName: "GST",
    defaultTaxRate: 10,
    publicAuthorities: [
      "Transport for NSW",
      "Major Transport Infrastructure Authority (Victoria)",
      "Department of Transport and Main Roads (Qld)"
    ],
    callingCode: "+61",
    flagEmoji: "🇦🇺"
  },

  BW: {
    countryCode: "BW",
    countryName: "Botswana",
    currency: "BWP",
    locale: "en-BW",
    timezone: "Africa/Gaborone",
    measurementSystem: "metric",
    defaultLanguage: "en",
    taxName: "VAT",
    defaultTaxRate: 14,
    publicAuthorities: [
      "Department of Roads (Ministry of Transport & Communications)",
      "Water Utilities Corporation (WUC)",
      "Botswana Power Corporation (BPC)"
    ],
    callingCode: "+267",
    flagEmoji: "🇧🇼"
  },

  NA: {
    countryCode: "NA",
    countryName: "Namibia",
    currency: "NAD",
    locale: "en-NA",
    timezone: "Africa/Windhoek",
    measurementSystem: "metric",
    defaultLanguage: "en",
    taxName: "VAT",
    defaultTaxRate: 15,
    publicAuthorities: [
      "Roads Authority Namibia",
      "NamPower",
      "NamWater"
    ],
    callingCode: "+264",
    flagEmoji: "🇳🇦"
  },

  NG: {
    countryCode: "NG",
    countryName: "Nigeria",
    currency: "NGN",
    locale: "en-NG",
    timezone: "Africa/Lagos",
    measurementSystem: "metric",
    defaultLanguage: "en",
    taxName: "VAT",
    defaultTaxRate: 7.5,
    publicAuthorities: [
      "Federal Ministry of Works & Housing (FMWH)",
      "FERMA (Federal Road Maintenance Agency)",
      "Nigerian Ports Authority (NPA)"
    ],
    callingCode: "+234",
    flagEmoji: "🇳🇬"
  },

  GH: {
    countryCode: "GH",
    countryName: "Ghana",
    currency: "GHS",
    locale: "en-GH",
    timezone: "Africa/Accra",
    measurementSystem: "metric",
    defaultLanguage: "en",
    taxName: "VAT / NHIL",
    defaultTaxRate: 15,
    publicAuthorities: [
      "Ghana Highway Authority (GHA)",
      "Department of Urban Roads (DUR)",
      "Ghana Railway Development Authority (GRDA)"
    ],
    callingCode: "+233",
    flagEmoji: "🇬🇭"
  },

  ZM: {
    countryCode: "ZM",
    countryName: "Zambia",
    currency: "ZMW",
    locale: "en-ZM",
    timezone: "Africa/Lusaka",
    measurementSystem: "metric",
    defaultLanguage: "en",
    taxName: "VAT",
    defaultTaxRate: 16,
    publicAuthorities: [
      "RDA (Road Development Agency)",
      "ZESCO",
      "Zambia Railways Limited"
    ],
    callingCode: "+260",
    flagEmoji: "🇿🇲"
  },

  ZW: {
    countryCode: "ZW",
    countryName: "Zimbabwe",
    currency: "ZWG",
    locale: "en-ZW",
    timezone: "Africa/Harare",
    measurementSystem: "metric",
    defaultLanguage: "en",
    taxName: "VAT",
    defaultTaxRate: 15,
    publicAuthorities: [
      "Department of Roads",
      "ZINARA (Zimbabwe National Road Administration)",
      "ZESA Holdings"
    ],
    callingCode: "+263",
    flagEmoji: "🇿🇼"
  },

  MZ: {
    countryCode: "MZ",
    countryName: "Mozambique",
    currency: "MZN",
    locale: "pt-MZ",
    timezone: "Africa/Maputo",
    measurementSystem: "metric",
    defaultLanguage: "pt",
    taxName: "IVA",
    defaultTaxRate: 16,
    publicAuthorities: [
      "ANE (Administração Nacional de Estradas)",
      "CFM (Portos e Caminhos de Ferro de Moçambique)",
      "EDM (Electricidade de Moçambique)"
    ],
    callingCode: "+258",
    flagEmoji: "🇲🇿"
  },

  MU: {
    countryCode: "MU",
    countryName: "Mauritius",
    currency: "MUR",
    locale: "en-MU",
    timezone: "Indian/Mauritius",
    measurementSystem: "metric",
    defaultLanguage: "en",
    taxName: "VAT",
    defaultTaxRate: 15,
    publicAuthorities: [
      "Road Development Authority (RDA)",
      "Metro Express Ltd",
      "Central Water Authority (CWA)"
    ],
    callingCode: "+230",
    flagEmoji: "🇲🇺"
  },

  EG: {
    countryCode: "EG",
    countryName: "Egypt",
    currency: "EGP",
    locale: "ar-EG",
    timezone: "Africa/Cairo",
    measurementSystem: "metric",
    defaultLanguage: "ar",
    taxName: "VAT",
    defaultTaxRate: 14,
    publicAuthorities: [
      "General Authority for Roads, Bridges and Land Transport (GARBLT)",
      "National Authority for Tunnels (NAT)",
      "New Urban Communities Authority (NUCA)"
    ],
    callingCode: "+20",
    flagEmoji: "🇪🇬"
  },

  DE: {
    countryCode: "DE",
    countryName: "Germany (European Union)",
    currency: "EUR",
    locale: "de-DE",
    timezone: "Europe/Berlin",
    measurementSystem: "metric",
    defaultLanguage: "de",
    taxName: "MwSt / VAT",
    defaultTaxRate: 19,
    publicAuthorities: [
      "Die Autobahn GmbH des Bundes",
      "Deutsche Bahn (DB Netze)",
      "Wasserstraßen- und Schifffahrtsverwaltung (WSV)"
    ],
    callingCode: "+49",
    flagEmoji: "🇩🇪"
  },

  CA: {
    countryCode: "CA",
    countryName: "Canada",
    currency: "CAD",
    locale: "en-CA",
    timezone: "America/Toronto",
    measurementSystem: "metric",
    defaultLanguage: "en",
    taxName: "HST / GST",
    defaultTaxRate: 13,
    publicAuthorities: [
      "Infrastructure Canada",
      "Metrolinx",
      "Ministry of Transportation Ontario (MTO)"
    ],
    callingCode: "+1",
    flagEmoji: "🇨🇦"
  },

  IN: {
    countryCode: "IN",
    countryName: "India",
    currency: "INR",
    locale: "en-IN",
    timezone: "Asia/Kolkata",
    measurementSystem: "metric",
    defaultLanguage: "en",
    taxName: "GST",
    defaultTaxRate: 18,
    publicAuthorities: [
      "NHAI (National Highways Authority of India)",
      "Indian Railways",
      "CPWD (Central Public Works Department)"
    ],
    callingCode: "+91",
    flagEmoji: "🇮🇳"
  }
};

export const DEFAULT_COUNTRY_CODE = "TZ";

export function getRegionConfig(countryCode?: string | null): RegionConfig {
  if (!countryCode) return REGION_CONFIGS[DEFAULT_COUNTRY_CODE];
  const upper = countryCode.toUpperCase();
  return REGION_CONFIGS[upper] || REGION_CONFIGS[DEFAULT_COUNTRY_CODE];
}

export function getAllRegionConfigs(): RegionConfig[] {
  return Object.values(REGION_CONFIGS);
}
