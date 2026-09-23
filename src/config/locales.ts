export interface LocaleInfo {
  code: string;
  name: string;
  nativeName: string;
  direction: "ltr" | "rtl";
  dateFormat: string;
  timeFormat: string;
  firstDayOfWeek: number; // 0 = Sunday, 1 = Monday, 6 = Saturday
  numberFormat: {
    decimalSeparator: string;
    groupSeparator: string;
  };
}

export const SUPPORTED_LOCALES: Record<string, LocaleInfo> = {
  "en-TZ": {
    code: "en-TZ",
    name: "English (Tanzania)",
    nativeName: "English (Tanzania)",
    direction: "ltr",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "HH:mm:ss",
    firstDayOfWeek: 1,
    numberFormat: {
      decimalSeparator: ".",
      groupSeparator: ","
    }
  },
  "sw-TZ": {
    code: "sw-TZ",
    name: "Swahili (Tanzania)",
    nativeName: "Kiswahili",
    direction: "ltr",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "HH:mm:ss",
    firstDayOfWeek: 1,
    numberFormat: {
      decimalSeparator: ".",
      groupSeparator: ","
    }
  },
  "en-ZA": {
    code: "en-ZA",
    name: "English (South Africa)",
    nativeName: "English (South Africa)",
    direction: "ltr",
    dateFormat: "YYYY/MM/DD",
    timeFormat: "HH:mm:ss",
    firstDayOfWeek: 1,
    numberFormat: {
      decimalSeparator: ",",
      groupSeparator: " "
    }
  },
  "en-AE": {
    code: "en-AE",
    name: "English (UAE)",
    nativeName: "English (UAE)",
    direction: "ltr",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "HH:mm:ss",
    firstDayOfWeek: 1,
    numberFormat: {
      decimalSeparator: ".",
      groupSeparator: ","
    }
  },
  "ar-AE": {
    code: "ar-AE",
    name: "Arabic (UAE)",
    nativeName: "العربية (الإمارات)",
    direction: "rtl",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "HH:mm:ss",
    firstDayOfWeek: 1,
    numberFormat: {
      decimalSeparator: "٫",
      groupSeparator: "٬"
    }
  },
  "en-SA": {
    code: "en-SA",
    name: "English (Saudi Arabia)",
    nativeName: "English (Saudi Arabia)",
    direction: "ltr",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "HH:mm:ss",
    firstDayOfWeek: 0,
    numberFormat: {
      decimalSeparator: ".",
      groupSeparator: ","
    }
  },
  "ar-SA": {
    code: "ar-SA",
    name: "Arabic (Saudi Arabia)",
    nativeName: "العربية (السعودية)",
    direction: "rtl",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "HH:mm:ss",
    firstDayOfWeek: 0,
    numberFormat: {
      decimalSeparator: "٫",
      groupSeparator: "٬"
    }
  },
  "en-US": {
    code: "en-US",
    name: "English (United States)",
    nativeName: "English (United States)",
    direction: "ltr",
    dateFormat: "MM/DD/YYYY",
    timeFormat: "hh:mm:ss A",
    firstDayOfWeek: 0,
    numberFormat: {
      decimalSeparator: ".",
      groupSeparator: ","
    }
  },
  "en-GB": {
    code: "en-GB",
    name: "English (United Kingdom)",
    nativeName: "English (UK)",
    direction: "ltr",
    dateFormat: "DD/MM/YYYY",
    timeFormat: "HH:mm:ss",
    firstDayOfWeek: 1,
    numberFormat: {
      decimalSeparator: ".",
      groupSeparator: ","
    }
  }
};

export const DEFAULT_LOCALE = "en-TZ";

export function getLocaleInfo(code?: string): LocaleInfo {
  if (!code) return SUPPORTED_LOCALES[DEFAULT_LOCALE];
  return SUPPORTED_LOCALES[code] || SUPPORTED_LOCALES[DEFAULT_LOCALE];
}
