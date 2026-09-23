export type SupportedCurrency =
  // Southern Africa
  | "ZAR" // South African Rand
  | "BWP" // Botswana Pula
  | "NAD" // Namibian Dollar
  | "SZL" // Eswatini Lilangeni
  | "LSL" // Lesotho Loti
  | "ZMW" // Zambian Kwacha
  | "ZWG" // Zimbabwe Gold (ZiG)
  | "MZN" // Mozambican Metical
  | "MWK" // Malawian Kwacha
  | "AOA" // Angolan Kwanza
  | "MGA" // Malagasy Ariary
  | "MUR" // Mauritian Rupee
  | "SCR" // Seychellois Rupee
  | "KMF" // Comorian Franc

  // East Africa
  | "TZS" // Tanzanian Shilling
  | "KES" // Kenyan Shilling
  | "UGX" // Ugandan Shilling
  | "RWF" // Rwandan Franc
  | "BIF" // Burundian Franc
  | "ETB" // Ethiopian Birr
  | "ERN" // Eritrean Nakfa
  | "DJF" // Djiboutian Franc
  | "SOS" // Somali Shilling
  | "SSP" // South Sudanese Pound
  | "SDG" // Sudanese Pound

  // West Africa
  | "NGN" // Nigerian Naira
  | "GHS" // Ghanaian Cedi
  | "XOF" // West African CFA Franc (UEMOA: Benin, Burkina Faso, Côte d'Ivoire, Guinea-Bissau, Mali, Niger, Senegal, Togo)
  | "GNF" // Guinean Franc
  | "SLE" // Sierra Leonean Leone
  | "LRD" // Liberian Dollar
  | "GMD" // Gambian Dalasi
  | "CVE" // Cape Verdean Escudo
  | "MRU" // Mauritanian Ouguiya

  // Central Africa
  | "XAF" // Central African CFA Franc (CEMAC: Cameroon, CAR, Chad, Congo-Brazzaville, Eq. Guinea, Gabon)
  | "CDF" // Congolese Franc (DR Congo)
  | "STN" // São Tomé and Príncipe Dobra

  // North Africa
  | "EGP" // Egyptian Pound
  | "MAD" // Moroccan Dirham
  | "DZD" // Algerian Dinar
  | "TND" // Tunisian Dinar
  | "LYD" // Libyan Dinar

  // Major Global / International Currencies
  | "USD" // US Dollar
  | "EUR" // Euro
  | "GBP" // British Pound
  | "CHF" // Swiss Franc
  | "JPY" // Japanese Yen
  | "CNY" // Chinese Yuan
  | "AUD" // Australian Dollar
  | "CAD" // Canadian Dollar
  | "SGD" // Singapore Dollar
  | "HKD" // Hong Kong Dollar
  | "NZD" // New Zealand Dollar
  | "INR" // Indian Rupee
  | "BRL" // Brazilian Real
  | "SEK" // Swedish Krona
  | "NOK" // Norwegian Krone
  | "DKK" // Danish Krone
  | "TRY" // Turkish Lira

  // Middle East & Gulf (GCC)
  | "SAR" // Saudi Riyal
  | "AED" // UAE Dirham
  | "QAR" // Qatari Riyal
  | "KWD" // Kuwaiti Dinar
  | "OMR" // Omani Rial
  | "BHD"; // Bahraini Dinar

export type CurrencyRegion = 
  | "Southern Africa"
  | "East Africa"
  | "West Africa"
  | "Central Africa"
  | "North Africa"
  | "Global Major"
  | "Middle East & Gulf";

export interface CurrencyInfo {
  code: SupportedCurrency;
  symbol: string;
  label: string;
  name: string;
  country: string;
  flag: string;
  region: CurrencyRegion;
  locale: string;
  decimalDigits: number;
  rateToUSD: number;
}

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  // ==========================================================================
  // SOUTHERN AFRICA
  // ==========================================================================
  {
    code: "ZAR",
    symbol: "R",
    name: "South African Rand",
    label: "South African Rand (ZAR — R)",
    country: "South Africa, Lesotho, Namibia, Eswatini",
    flag: "🇿🇦",
    region: "Southern Africa",
    locale: "en-ZA",
    decimalDigits: 2,
    rateToUSD: 0.054
  },
  {
    code: "BWP",
    symbol: "P",
    name: "Botswana Pula",
    label: "Botswana Pula (BWP — P)",
    country: "Botswana",
    flag: "🇧🇼",
    region: "Southern Africa",
    locale: "en-BW",
    decimalDigits: 2,
    rateToUSD: 0.073
  },
  {
    code: "NAD",
    symbol: "N$",
    name: "Namibian Dollar",
    label: "Namibian Dollar (NAD — N$)",
    country: "Namibia",
    flag: "🇳🇦",
    region: "Southern Africa",
    locale: "en-NA",
    decimalDigits: 2,
    rateToUSD: 0.054
  },
  {
    code: "SZL",
    symbol: "E",
    name: "Eswatini Lilangeni",
    label: "Eswatini Lilangeni (SZL — E)",
    country: "Eswatini",
    flag: "🇸🇿",
    region: "Southern Africa",
    locale: "en-SZ",
    decimalDigits: 2,
    rateToUSD: 0.054
  },
  {
    code: "LSL",
    symbol: "L",
    name: "Lesotho Loti",
    label: "Lesotho Loti (LSL — L)",
    country: "Lesotho",
    flag: "🇱🇸",
    region: "Southern Africa",
    locale: "en-LS",
    decimalDigits: 2,
    rateToUSD: 0.054
  },
  {
    code: "ZMW",
    symbol: "K",
    name: "Zambian Kwacha",
    label: "Zambian Kwacha (ZMW — K)",
    country: "Zambia",
    flag: "🇿🇲",
    region: "Southern Africa",
    locale: "en-ZM",
    decimalDigits: 2,
    rateToUSD: 0.038
  },
  {
    code: "ZWG",
    symbol: "ZiG",
    name: "Zimbabwe Gold",
    label: "Zimbabwe Gold (ZWG — ZiG)",
    country: "Zimbabwe",
    flag: "🇿🇼",
    region: "Southern Africa",
    locale: "en-ZW",
    decimalDigits: 2,
    rateToUSD: 0.074
  },
  {
    code: "MZN",
    symbol: "MT",
    name: "Mozambican Metical",
    label: "Mozambican Metical (MZN — MT)",
    country: "Mozambique",
    flag: "🇲🇿",
    region: "Southern Africa",
    locale: "pt-MZ",
    decimalDigits: 2,
    rateToUSD: 0.016
  },
  {
    code: "MWK",
    symbol: "MK",
    name: "Malawian Kwacha",
    label: "Malawian Kwacha (MWK — MK)",
    country: "Malawi",
    flag: "🇲🇼",
    region: "Southern Africa",
    locale: "en-MW",
    decimalDigits: 2,
    rateToUSD: 0.00058
  },
  {
    code: "AOA",
    symbol: "Kz",
    name: "Angolan Kwanza",
    label: "Angolan Kwanza (AOA — Kz)",
    country: "Angola",
    flag: "🇦🇴",
    region: "Southern Africa",
    locale: "pt-AO",
    decimalDigits: 2,
    rateToUSD: 0.0011
  },
  {
    code: "MGA",
    symbol: "Ar",
    name: "Malagasy Ariary",
    label: "Malagasy Ariary (MGA — Ar)",
    country: "Madagascar",
    flag: "🇲🇬",
    region: "Southern Africa",
    locale: "mg-MG",
    decimalDigits: 0,
    rateToUSD: 0.00022
  },
  {
    code: "MUR",
    symbol: "₨",
    name: "Mauritian Rupee",
    label: "Mauritian Rupee (MUR — ₨)",
    country: "Mauritius",
    flag: "🇲🇺",
    region: "Southern Africa",
    locale: "en-MU",
    decimalDigits: 2,
    rateToUSD: 0.022
  },
  {
    code: "SCR",
    symbol: "SR",
    name: "Seychellois Rupee",
    label: "Seychellois Rupee (SCR — SR)",
    country: "Seychelles",
    flag: "🇸🇨",
    region: "Southern Africa",
    locale: "en-SC",
    decimalDigits: 2,
    rateToUSD: 0.073
  },
  {
    code: "KMF",
    symbol: "CF",
    name: "Comorian Franc",
    label: "Comorian Franc (KMF — CF)",
    country: "Comoros",
    flag: "🇰🇲",
    region: "Southern Africa",
    locale: "fr-KM",
    decimalDigits: 0,
    rateToUSD: 0.0022
  },

  // ==========================================================================
  // EAST AFRICA
  // ==========================================================================
  {
    code: "TZS",
    symbol: "TSh",
    name: "Tanzanian Shilling",
    label: "Tanzanian Shilling (TZS — TSh)",
    country: "Tanzania",
    flag: "🇹🇿",
    region: "East Africa",
    locale: "en-TZ",
    decimalDigits: 0,
    rateToUSD: 0.00039
  },
  {
    code: "KES",
    symbol: "KSh",
    name: "Kenyan Shilling",
    label: "Kenyan Shilling (KES — KSh)",
    country: "Kenya",
    flag: "🇰🇪",
    region: "East Africa",
    locale: "en-KE",
    decimalDigits: 2,
    rateToUSD: 0.0077
  },
  {
    code: "UGX",
    symbol: "USh",
    name: "Ugandan Shilling",
    label: "Ugandan Shilling (UGX — USh)",
    country: "Uganda",
    flag: "🇺🇬",
    region: "East Africa",
    locale: "en-UG",
    decimalDigits: 0,
    rateToUSD: 0.00027
  },
  {
    code: "RWF",
    symbol: "FRw",
    name: "Rwandan Franc",
    label: "Rwandan Franc (RWF — FRw)",
    country: "Rwanda",
    flag: "🇷🇼",
    region: "East Africa",
    locale: "en-RW",
    decimalDigits: 0,
    rateToUSD: 0.00075
  },
  {
    code: "BIF",
    symbol: "FBu",
    name: "Burundian Franc",
    label: "Burundian Franc (BIF — FBu)",
    country: "Burundi",
    flag: "🇧🇮",
    region: "East Africa",
    locale: "fr-BI",
    decimalDigits: 0,
    rateToUSD: 0.00035
  },
  {
    code: "ETB",
    symbol: "Br",
    name: "Ethiopian Birr",
    label: "Ethiopian Birr (ETB — Br)",
    country: "Ethiopia",
    flag: "🇪🇹",
    region: "East Africa",
    locale: "am-ET",
    decimalDigits: 2,
    rateToUSD: 0.0084
  },
  {
    code: "ERN",
    symbol: "Nfk",
    name: "Eritrean Nakfa",
    label: "Eritrean Nakfa (ERN — Nfk)",
    country: "Eritrea",
    flag: "🇪🇷",
    region: "East Africa",
    locale: "ti-ER",
    decimalDigits: 2,
    rateToUSD: 0.067
  },
  {
    code: "DJF",
    symbol: "Fdj",
    name: "Djiboutian Franc",
    label: "Djiboutian Franc (DJF — Fdj)",
    country: "Djibouti",
    flag: "🇩🇯",
    region: "East Africa",
    locale: "fr-DJ",
    decimalDigits: 0,
    rateToUSD: 0.0056
  },
  {
    code: "SOS",
    symbol: "Sh.So.",
    name: "Somali Shilling",
    label: "Somali Shilling (SOS — Sh.So.)",
    country: "Somalia",
    flag: "🇸🇴",
    region: "East Africa",
    locale: "so-SO",
    decimalDigits: 2,
    rateToUSD: 0.00175
  },
  {
    code: "SSP",
    symbol: "SSP",
    name: "South Sudanese Pound",
    label: "South Sudanese Pound (SSP)",
    country: "South Sudan",
    flag: "🇸🇸",
    region: "East Africa",
    locale: "en-SS",
    decimalDigits: 2,
    rateToUSD: 0.00077
  },
  {
    code: "SDG",
    symbol: "SD",
    name: "Sudanese Pound",
    label: "Sudanese Pound (SDG — SD)",
    country: "Sudan",
    flag: "🇸🇩",
    region: "East Africa",
    locale: "ar-SD",
    decimalDigits: 2,
    rateToUSD: 0.00167
  },

  // ==========================================================================
  // WEST AFRICA
  // ==========================================================================
  {
    code: "NGN",
    symbol: "₦",
    name: "Nigerian Naira",
    label: "Nigerian Naira (NGN — ₦)",
    country: "Nigeria",
    flag: "🇳🇬",
    region: "West Africa",
    locale: "en-NG",
    decimalDigits: 2,
    rateToUSD: 0.00067
  },
  {
    code: "GHS",
    symbol: "GH₵",
    name: "Ghanaian Cedi",
    label: "Ghanaian Cedi (GHS — GH₵)",
    country: "Ghana",
    flag: "🇬🇭",
    region: "West Africa",
    locale: "en-GH",
    decimalDigits: 2,
    rateToUSD: 0.065
  },
  {
    code: "XOF",
    symbol: "CFA",
    name: "West African CFA Franc",
    label: "West African CFA Franc (XOF — CFA)",
    country: "Senegal, Côte d'Ivoire, Benin, Mali, Burkina Faso, Niger, Togo, Guinea-Bissau",
    flag: "🌍",
    region: "West Africa",
    locale: "fr-SN",
    decimalDigits: 0,
    rateToUSD: 0.00166
  },
  {
    code: "GNF",
    symbol: "FG",
    name: "Guinean Franc",
    label: "Guinean Franc (GNF — FG)",
    country: "Guinea",
    flag: "🇬🇳",
    region: "West Africa",
    locale: "fr-GN",
    decimalDigits: 0,
    rateToUSD: 0.000116
  },
  {
    code: "SLE",
    symbol: "Le",
    name: "Sierra Leonean Leone",
    label: "Sierra Leonean Leone (SLE — Le)",
    country: "Sierra Leone",
    flag: "🇸🇱",
    region: "West Africa",
    locale: "en-SL",
    decimalDigits: 2,
    rateToUSD: 0.044
  },
  {
    code: "LRD",
    symbol: "L$",
    name: "Liberian Dollar",
    label: "Liberian Dollar (LRD — L$)",
    country: "Liberia",
    flag: "🇱🇷",
    region: "West Africa",
    locale: "en-LR",
    decimalDigits: 2,
    rateToUSD: 0.0051
  },
  {
    code: "GMD",
    symbol: "D",
    name: "Gambian Dalasi",
    label: "Gambian Dalasi (GMD — D)",
    country: "Gambia",
    flag: "🇬🇲",
    region: "West Africa",
    locale: "en-GM",
    decimalDigits: 2,
    rateToUSD: 0.0145
  },
  {
    code: "CVE",
    symbol: "Esc",
    name: "Cape Verdean Escudo",
    label: "Cape Verdean Escudo (CVE — Esc)",
    country: "Cabo Verde",
    flag: "🇨🇻",
    region: "West Africa",
    locale: "pt-CV",
    decimalDigits: 2,
    rateToUSD: 0.0099
  },
  {
    code: "MRU",
    symbol: "UM",
    name: "Mauritanian Ouguiya",
    label: "Mauritanian Ouguiya (MRU — UM)",
    country: "Mauritania",
    flag: "🇲🇷",
    region: "West Africa",
    locale: "ar-MR",
    decimalDigits: 2,
    rateToUSD: 0.025
  },

  // ==========================================================================
  // CENTRAL AFRICA
  // ==========================================================================
  {
    code: "XAF",
    symbol: "FCFA",
    name: "Central African CFA Franc",
    label: "Central African CFA Franc (XAF — FCFA)",
    country: "Cameroon, Gabon, Chad, Congo (Rep.), CAR, Eq. Guinea",
    flag: "🌍",
    region: "Central Africa",
    locale: "fr-CM",
    decimalDigits: 0,
    rateToUSD: 0.00166
  },
  {
    code: "CDF",
    symbol: "FC",
    name: "Congolese Franc",
    label: "Congolese Franc (CDF — FC)",
    country: "DR Congo",
    flag: "🇨🇩",
    region: "Central Africa",
    locale: "fr-CD",
    decimalDigits: 2,
    rateToUSD: 0.00035
  },
  {
    code: "STN",
    symbol: "Db",
    name: "São Tomé and Príncipe Dobra",
    label: "São Tomé Dobra (STN — Db)",
    country: "São Tomé and Príncipe",
    flag: "🇸🇹",
    region: "Central Africa",
    locale: "pt-ST",
    decimalDigits: 2,
    rateToUSD: 0.044
  },

  // ==========================================================================
  // NORTH AFRICA
  // ==========================================================================
  {
    code: "EGP",
    symbol: "E£",
    name: "Egyptian Pound",
    label: "Egyptian Pound (EGP — E£)",
    country: "Egypt",
    flag: "🇪🇬",
    region: "North Africa",
    locale: "en-EG",
    decimalDigits: 2,
    rateToUSD: 0.021
  },
  {
    code: "MAD",
    symbol: "MAD",
    name: "Moroccan Dirham",
    label: "Moroccan Dirham (MAD)",
    country: "Morocco, Western Sahara",
    flag: "🇲🇦",
    region: "North Africa",
    locale: "fr-MA",
    decimalDigits: 2,
    rateToUSD: 0.10
  },
  {
    code: "DZD",
    symbol: "DA",
    name: "Algerian Dinar",
    label: "Algerian Dinar (DZD — DA)",
    country: "Algeria",
    flag: "🇩🇿",
    region: "North Africa",
    locale: "fr-DZ",
    decimalDigits: 2,
    rateToUSD: 0.0074
  },
  {
    code: "TND",
    symbol: "DT",
    name: "Tunisian Dinar",
    label: "Tunisian Dinar (TND — DT)",
    country: "Tunisia",
    flag: "🇹🇳",
    region: "North Africa",
    locale: "fr-TN",
    decimalDigits: 3,
    rateToUSD: 0.32
  },
  {
    code: "LYD",
    symbol: "LD",
    name: "Libyan Dinar",
    label: "Libyan Dinar (LYD — LD)",
    country: "Libya",
    flag: "🇱🇾",
    region: "North Africa",
    locale: "ar-LY",
    decimalDigits: 3,
    rateToUSD: 0.207
  },

  // ==========================================================================
  // GLOBAL MAJOR / INTERNATIONAL CURRENCIES
  // ==========================================================================
  {
    code: "USD",
    symbol: "$",
    name: "United States Dollar",
    label: "United States Dollar (USD — $)",
    country: "United States & Global Reference",
    flag: "🇺🇸",
    region: "Global Major",
    locale: "en-US",
    decimalDigits: 2,
    rateToUSD: 1.0
  },
  {
    code: "EUR",
    symbol: "€",
    name: "Euro",
    label: "Euro (EUR — €)",
    country: "European Union Eurozone",
    flag: "🇪🇺",
    region: "Global Major",
    locale: "en-IE",
    decimalDigits: 2,
    rateToUSD: 1.09
  },
  {
    code: "GBP",
    symbol: "£",
    name: "British Pound Sterling",
    label: "British Pound Sterling (GBP — £)",
    country: "United Kingdom",
    flag: "🇬🇧",
    region: "Global Major",
    locale: "en-GB",
    decimalDigits: 2,
    rateToUSD: 1.28
  },
  {
    code: "CHF",
    symbol: "CHF",
    name: "Swiss Franc",
    label: "Swiss Franc (CHF)",
    country: "Switzerland, Liechtenstein",
    flag: "🇨🇭",
    region: "Global Major",
    locale: "de-CH",
    decimalDigits: 2,
    rateToUSD: 1.14
  },
  {
    code: "JPY",
    symbol: "¥",
    name: "Japanese Yen",
    label: "Japanese Yen (JPY — ¥)",
    country: "Japan",
    flag: "🇯🇵",
    region: "Global Major",
    locale: "ja-JP",
    decimalDigits: 0,
    rateToUSD: 0.0067
  },
  {
    code: "CNY",
    symbol: "CN¥",
    name: "Chinese Yuan Renminbi",
    label: "Chinese Yuan (CNY — CN¥)",
    country: "China",
    flag: "🇨🇳",
    region: "Global Major",
    locale: "zh-CN",
    decimalDigits: 2,
    rateToUSD: 0.14
  },
  {
    code: "AUD",
    symbol: "A$",
    name: "Australian Dollar",
    label: "Australian Dollar (AUD — A$)",
    country: "Australia",
    flag: "🇦🇺",
    region: "Global Major",
    locale: "en-AU",
    decimalDigits: 2,
    rateToUSD: 0.65
  },
  {
    code: "CAD",
    symbol: "C$",
    name: "Canadian Dollar",
    label: "Canadian Dollar (CAD — C$)",
    country: "Canada",
    flag: "🇨🇦",
    region: "Global Major",
    locale: "en-CA",
    decimalDigits: 2,
    rateToUSD: 0.73
  },
  {
    code: "SGD",
    symbol: "S$",
    name: "Singapore Dollar",
    label: "Singapore Dollar (SGD — S$)",
    country: "Singapore",
    flag: "🇸🇬",
    region: "Global Major",
    locale: "en-SG",
    decimalDigits: 2,
    rateToUSD: 0.76
  },
  {
    code: "HKD",
    symbol: "HK$",
    name: "Hong Kong Dollar",
    label: "Hong Kong Dollar (HKD — HK$)",
    country: "Hong Kong",
    flag: "🇭🇰",
    region: "Global Major",
    locale: "en-HK",
    decimalDigits: 2,
    rateToUSD: 0.128
  },
  {
    code: "NZD",
    symbol: "NZ$",
    name: "New Zealand Dollar",
    label: "New Zealand Dollar (NZD — NZ$)",
    country: "New Zealand",
    flag: "🇳🇿",
    region: "Global Major",
    locale: "en-NZ",
    decimalDigits: 2,
    rateToUSD: 0.61
  },
  {
    code: "INR",
    symbol: "₹",
    name: "Indian Rupee",
    label: "Indian Rupee (INR — ₹)",
    country: "India",
    flag: "🇮🇳",
    region: "Global Major",
    locale: "en-IN",
    decimalDigits: 2,
    rateToUSD: 0.012
  },
  {
    code: "BRL",
    symbol: "R$",
    name: "Brazilian Real",
    label: "Brazilian Real (BRL — R$)",
    country: "Brazil",
    flag: "🇧🇷",
    region: "Global Major",
    locale: "pt-BR",
    decimalDigits: 2,
    rateToUSD: 0.18
  },
  {
    code: "SEK",
    symbol: "kr",
    name: "Swedish Krona",
    label: "Swedish Krona (SEK — kr)",
    country: "Sweden",
    flag: "🇸🇪",
    region: "Global Major",
    locale: "sv-SE",
    decimalDigits: 2,
    rateToUSD: 0.096
  },
  {
    code: "NOK",
    symbol: "kr",
    name: "Norwegian Krone",
    label: "Norwegian Krone (NOK — kr)",
    country: "Norway",
    flag: "🇳🇴",
    region: "Global Major",
    locale: "nb-NO",
    decimalDigits: 2,
    rateToUSD: 0.094
  },
  {
    code: "DKK",
    symbol: "kr",
    name: "Danish Krone",
    label: "Danish Krone (DKK — kr)",
    country: "Denmark",
    flag: "🇩🇰",
    region: "Global Major",
    locale: "da-DK",
    decimalDigits: 2,
    rateToUSD: 0.146
  },
  {
    code: "TRY",
    symbol: "₺",
    name: "Turkish Lira",
    label: "Turkish Lira (TRY — ₺)",
    country: "Turkey",
    flag: "🇹🇷",
    region: "Global Major",
    locale: "tr-TR",
    decimalDigits: 2,
    rateToUSD: 0.029
  },

  // ==========================================================================
  // MIDDLE EAST & GULF (GCC)
  // ==========================================================================
  {
    code: "SAR",
    symbol: "﷼",
    name: "Saudi Riyal",
    label: "Saudi Riyal (SAR — ﷼)",
    country: "Saudi Arabia",
    flag: "🇸🇦",
    region: "Middle East & Gulf",
    locale: "en-SA",
    decimalDigits: 2,
    rateToUSD: 0.27
  },
  {
    code: "AED",
    symbol: "د.إ",
    name: "UAE Dirham",
    label: "UAE Dirham (AED — د.إ)",
    country: "United Arab Emirates",
    flag: "🇦🇪",
    region: "Middle East & Gulf",
    locale: "en-AE",
    decimalDigits: 2,
    rateToUSD: 0.272
  },
  {
    code: "QAR",
    symbol: "QR",
    name: "Qatari Riyal",
    label: "Qatari Riyal (QAR — QR)",
    country: "Qatar",
    flag: "🇶🇦",
    region: "Middle East & Gulf",
    locale: "en-QA",
    decimalDigits: 2,
    rateToUSD: 0.275
  },
  {
    code: "KWD",
    symbol: "KD",
    name: "Kuwaiti Dinar",
    label: "Kuwaiti Dinar (KWD — KD)",
    country: "Kuwait",
    flag: "🇰🇼",
    region: "Middle East & Gulf",
    locale: "en-KW",
    decimalDigits: 3,
    rateToUSD: 3.25
  },
  {
    code: "OMR",
    symbol: "OMR",
    name: "Omani Rial",
    label: "Omani Rial (OMR)",
    country: "Oman",
    flag: "🇴🇲",
    region: "Middle East & Gulf",
    locale: "en-OM",
    decimalDigits: 3,
    rateToUSD: 2.60
  },
  {
    code: "BHD",
    symbol: "BD",
    name: "Bahraini Dinar",
    label: "Bahraini Dinar (BHD — BD)",
    country: "Bahrain",
    flag: "🇧🇭",
    region: "Middle East & Gulf",
    locale: "en-BH",
    decimalDigits: 3,
    rateToUSD: 2.65
  }
];

// Helper maps derived from SUPPORTED_CURRENCIES
export const currencyLocales: Record<SupportedCurrency, string> = SUPPORTED_CURRENCIES.reduce(
  (acc, curr) => {
    acc[curr.code] = curr.locale;
    return acc;
  },
  {} as Record<SupportedCurrency, string>
);

export const currencySymbols: Record<SupportedCurrency, string> = SUPPORTED_CURRENCIES.reduce(
  (acc, curr) => {
    acc[curr.code] = curr.symbol;
    return acc;
  },
  {} as Record<SupportedCurrency, string>
);

export const CURRENCY_REGIONS: CurrencyRegion[] = [
  "Southern Africa",
  "East Africa",
  "West Africa",
  "Central Africa",
  "North Africa",
  "Global Major",
  "Middle East & Gulf"
];

export function getCurrencyInfo(code: string): CurrencyInfo {
  const found = SUPPORTED_CURRENCIES.find((c) => c.code === code);
  return found || SUPPORTED_CURRENCIES[0];
}

export function getCurrenciesByRegion(region: CurrencyRegion): CurrencyInfo[] {
  return SUPPORTED_CURRENCIES.filter((c) => c.region === region);
}

export function searchCurrencies(query: string): CurrencyInfo[] {
  if (!query || !query.trim()) return SUPPORTED_CURRENCIES;
  const q = query.toLowerCase().trim();
  return SUPPORTED_CURRENCIES.filter(
    (c) =>
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.country.toLowerCase().includes(q) ||
      c.symbol.toLowerCase().includes(q) ||
      c.region.toLowerCase().includes(q)
  );
}
