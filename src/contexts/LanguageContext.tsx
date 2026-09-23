import React, { createContext, useContext, useState, useEffect } from "react";
import { LanguageCode, LanguageInfo } from "../types/language";
import { SUPPORTED_LANGUAGES, TRANSLATIONS } from "../data/translations";

interface LanguageContextType {
  currentLanguage: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  currentLanguageInfo: LanguageInfo;
  languages: LanguageInfo[];
  isRTL: boolean;
  direction: "ltr" | "rtl";
  t: (key: string, defaultText?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [currentLanguage, setCurrentLanguageState] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem("projectmatrix_lang") as LanguageCode;
    if (saved && ["en", "ar", "fr", "pt", "sw"].includes(saved)) {
      return saved;
    }
    return "en";
  });

  const currentLanguageInfo = SUPPORTED_LANGUAGES.find(l => l.code === currentLanguage) || SUPPORTED_LANGUAGES[0];
  const isRTL = currentLanguageInfo.direction === "rtl";
  const direction = currentLanguageInfo.direction;

  const setLanguage = (lang: LanguageCode) => {
    setCurrentLanguageState(lang);
    localStorage.setItem("projectmatrix_lang", lang);
  };

  // Sync RTL / LTR on the document root element
  useEffect(() => {
    document.documentElement.setAttribute("dir", direction);
    document.documentElement.setAttribute("lang", currentLanguage);
    
    if (direction === "rtl") {
      document.documentElement.classList.add("rtl");
      document.body.classList.add("font-arabic");
    } else {
      document.documentElement.classList.remove("rtl");
      document.body.classList.remove("font-arabic");
    }
  }, [currentLanguage, direction]);

  const t = (key: string, defaultText?: string): string => {
    const langDict = TRANSLATIONS[currentLanguage] || TRANSLATIONS.en;
    if (langDict && langDict[key]) {
      return langDict[key];
    }
    const enDict = TRANSLATIONS.en;
    if (enDict && enDict[key]) {
      return enDict[key];
    }
    return defaultText || key;
  };

  return (
    <LanguageContext.Provider
      value={{
        currentLanguage,
        setLanguage,
        currentLanguageInfo,
        languages: SUPPORTED_LANGUAGES,
        isRTL,
        direction,
        t
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
