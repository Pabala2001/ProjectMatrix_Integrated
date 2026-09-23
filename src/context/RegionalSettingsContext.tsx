import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase, isApiKeyError } from "../lib/supabase";
import { SupportedCurrency, currencyLocales, currencySymbols, getCurrencyInfo } from "../config/currencies";
import { 
  formatCurrency as utilsFormatCurrency, 
  formatCompactCurrency as utilsFormatCompactCurrency,
  convertCurrency as utilsConvertCurrency,
  getCurrencyHoverTitle as utilsGetCurrencyHoverTitle
} from "../utils/currency";
import { exchangeRateService, ExchangeRateState } from "../services/exchangeRateService";
import { getTodayInTimezone as utilsGetTodayInTimezone, formatDateOnly as utilsFormatDateOnly, formatDateTimeInTimezone as utilsFormatDateTimeInTimezone } from "../utils/dateTime";
import { ContractFramework, DEFAULT_CONTRACT_FRAMEWORK } from "../config/contracts";
import { getRegionConfig, DEFAULT_COUNTRY_CODE } from "../config/countries";

export interface RegionalSettingsContextType {
  countryCode: string;
  currencyCode: SupportedCurrency;
  currencySymbol: string;
  timezone: string;
  locale: string;
  complianceFramework: ContractFramework;
  exchangeRateState: ExchangeRateState;
  refreshExchangeRates: () => Promise<ExchangeRateState>;
  setCountryCode: (code: string, syncCurrency?: boolean) => Promise<boolean>;
  setCurrencyCode: (code: SupportedCurrency) => Promise<boolean>;
  setTimezone: (tz: string) => Promise<boolean>;
  setComplianceFramework: (framework: ContractFramework) => Promise<boolean>;
  convertAmount: (value: number | string | null | undefined, fromCurrency?: SupportedCurrency | string, targetCurrency?: SupportedCurrency | string) => number | null;
  formatCurrency: (value: number | string | null | undefined, options?: Intl.NumberFormatOptions, fromCurrency?: SupportedCurrency | string) => string;
  formatCompactCurrency: (value: number | string | null | undefined, fromCurrency?: SupportedCurrency | string) => string;
  getCurrencyHoverTitle: (value: number | string | null | undefined, fromCurrency?: SupportedCurrency | string) => string | undefined;
  formatDate: (value: string | null | undefined) => string;
  formatDateTime: (value: string | Date | null | undefined, includeTimeOrTimezone?: boolean | string, explicitTimezone?: string) => string;
  getTodayInTimezone: () => string;
  isLoading: boolean;
}

const RegionalSettingsContext = createContext<RegionalSettingsContextType | undefined>(undefined);

export function RegionalSettingsProvider({
  children,
  companyId,
  projectId
}: {
  children: React.ReactNode;
  companyId?: string | null;
  projectId?: string | null;
}) {
  const [countryCode, setCountryCodeState] = useState<string>(() => {
    return localStorage.getItem("projectmatrix_country_global") || DEFAULT_COUNTRY_CODE;
  });
  const [currencyCode, setCurrencyState] = useState<SupportedCurrency>("ZAR");
  const [timezone, setTimezoneState] = useState<string>("Africa/Johannesburg");
  const [complianceFramework, setComplianceFrameworkState] = useState<ContractFramework>(DEFAULT_CONTRACT_FRAMEWORK);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [exchangeRateState, setExchangeRateState] = useState<ExchangeRateState>(() => exchangeRateService.getState());

  // Subscribe to live exchange rate updates
  useEffect(() => {
    const unsubscribe = exchangeRateService.subscribe((newState) => {
      setExchangeRateState(newState);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const refreshExchangeRates = async () => {
    return await exchangeRateService.fetchLiveRates(true);
  };


  const locale = currencyLocales[currencyCode] || "en-TZ";

  // Helper local storage keys
  const getLocalStorageKeys = () => {
    const suffix = projectId ? `_proj_${projectId}` : companyId ? `_comp_${companyId}` : "_global";
    return {
      country: `projectmatrix_country${suffix}`,
      currency: `projectmatrix_currency${suffix}`,
      timezone: `projectmatrix_timezone${suffix}`,
      complianceFramework: `projectmatrix_compliance_framework${suffix}`
    };
  };

  const loadFromLocalStorage = () => {
    const keys = getLocalStorageKeys();
    const storedCountry = localStorage.getItem(keys.country) || localStorage.getItem("projectmatrix_country_global");
    const storedCurrency = localStorage.getItem(keys.currency) as SupportedCurrency | null;
    const storedTimezone = localStorage.getItem(keys.timezone);
    const storedFramework = localStorage.getItem(keys.complianceFramework) as ContractFramework | null;

    let activeCountry = storedCountry || DEFAULT_COUNTRY_CODE;

    // Check company profile if country exists
    if (companyId) {
      try {
        const compStr = localStorage.getItem(`pm_company_profile_${companyId}`);
        if (compStr) {
          const compObj = JSON.parse(compStr);
          if (compObj.countryCode) activeCountry = compObj.countryCode;
          else if (compObj.country) {
            const rcMatch = getRegionConfig(compObj.country);
            if (rcMatch) activeCountry = rcMatch.countryCode;
          }
        }
      } catch (_) {}
    }

    setCountryCodeState(activeCountry);
    const rc = getRegionConfig(activeCountry);

    if (storedCurrency) {
      setCurrencyState(storedCurrency);
    } else if (projectId) {
      // Check if project record in local storage has currency_code
      let projCurrency: SupportedCurrency | null = null;
      try {
        if (companyId) {
          const cachedProjs = localStorage.getItem(`pm_projects_${companyId}`);
          if (cachedProjs) {
            const list = JSON.parse(cachedProjs);
            const found = list.find((p: any) => p.id === projectId);
            if (found && (found.currency_code || found.currency)) {
              projCurrency = (found.currency_code || found.currency) as SupportedCurrency;
            }
          }
        }
        if (!projCurrency) {
          const allProjs = localStorage.getItem("pm_all_projects");
          if (allProjs) {
            const list = JSON.parse(allProjs);
            const found = list.find((p: any) => p.id === projectId);
            if (found && (found.currency_code || found.currency)) {
              projCurrency = (found.currency_code || found.currency) as SupportedCurrency;
            }
          }
        }
      } catch (_) {}

      if (projCurrency) {
        setCurrencyState(projCurrency);
        localStorage.setItem(keys.currency, projCurrency);
      } else {
        const compSuffix = companyId ? `_comp_${companyId}` : "";
        const compCurrency = compSuffix ? localStorage.getItem(`projectmatrix_currency${compSuffix}`) as SupportedCurrency | null : null;
        setCurrencyState(compCurrency || (rc?.currency as SupportedCurrency) || "TZS");
      }
    } else {
      const compSuffix = companyId ? `_comp_${companyId}` : "";
      const compCurrency = compSuffix ? localStorage.getItem(`projectmatrix_currency${compSuffix}`) as SupportedCurrency | null : null;
      setCurrencyState(compCurrency || (rc?.currency as SupportedCurrency) || "TZS");
    }

    if (storedTimezone) {
      setTimezoneState(storedTimezone);
    } else if (rc?.timezone) {
      setTimezoneState(rc.timezone);
    } else {
      setTimezoneState("Africa/Dar_es_Salaam");
    }

    if (storedFramework) {
      setComplianceFrameworkState(storedFramework);
    } else {
      setComplianceFrameworkState(DEFAULT_CONTRACT_FRAMEWORK);
    }
  };

  const saveToLocalStorage = (
    newCountry: string,
    newCurrency: SupportedCurrency, 
    newTimezone: string, 
    newFramework: ContractFramework
  ) => {
    const keys = getLocalStorageKeys();
    localStorage.setItem(keys.country, newCountry);
    localStorage.setItem("projectmatrix_country_global", newCountry);
    localStorage.setItem(keys.currency, newCurrency);
    localStorage.setItem("projectmatrix_currency_global", newCurrency);
    localStorage.setItem(keys.timezone, newTimezone);
    localStorage.setItem(keys.complianceFramework, newFramework);
  };

  // Helper to validate UUIDs
  const isUuid = (id: any): boolean => {
    if (typeof id !== "string") return false;
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return regex.test(id);
  };

  // Fetch settings from Supabase, fallback to localStorage
  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      // Always seed from local storage first to prevent flashes of incorrect settings
      loadFromLocalStorage();

      const isProjectValid = projectId ? isUuid(projectId) : false;
      const isCompanyValid = companyId ? isUuid(companyId) : false;

      if (!isProjectValid && !isCompanyValid) {
        setIsLoading(false);
        return;
      }

      try {
        console.log("Regional settings request", {
          operation: "fetchSettings",
          table: "erp_regional_settings",
          payload: null,
          companyId,
          projectId,
          currencyCode,
          timezone
        });

        let query = supabase.from("erp_regional_settings").select("*");
        if (isProjectValid) {
          query = query.eq("project_id", projectId);
        } else if (isCompanyValid) {
          query = query.eq("company_id", companyId).is("project_id", null);
        }

        const { data, error } = await query.maybeSingle();
        if (error) {
          if (isApiKeyError(error)) {
            // Unconfigured or invalid Supabase keys: regional settings work offline/locally
            console.debug("Regional settings operating in offline/localStorage mode:", error?.message);
          } else {
            console.warn("Regional settings query notice:", {
              code: error?.code,
              message: error?.message,
              hint: error?.hint,
            });
          }
        } else if (data) {
          if (data.currency_code) {
            setCurrencyState(data.currency_code as SupportedCurrency);
          }
          if (data.timezone) {
            setTimezoneState(data.timezone);
          }
          let fetchedFramework = complianceFramework;
          if (data.compliance_framework) {
            fetchedFramework = data.compliance_framework as ContractFramework;
            setComplianceFrameworkState(fetchedFramework);
          } else if (data.contract_type) {
            fetchedFramework = data.contract_type as ContractFramework;
            setComplianceFrameworkState(fetchedFramework);
          } else if (data.contract_agreement_option) {
            fetchedFramework = data.contract_agreement_option as ContractFramework;
            setComplianceFrameworkState(fetchedFramework);
          }
          // Sync to local storage for fast load next time
          saveToLocalStorage(
            countryCode,
            data.currency_code as SupportedCurrency, 
            data.timezone, 
            fetchedFramework
          );
        }
      } catch (err) {
        console.warn("Error fetching regional settings:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [companyId, projectId]);

  // Persist country / region selection and optionally sync currency & timezone
  const setCountryCode = async (newCountry: string, syncCurrency: boolean = true): Promise<boolean> => {
    setCountryCodeState(newCountry);
    const rc = getRegionConfig(newCountry);
    let newCurr = currencyCode;
    let newTz = timezone;

    if (rc) {
      if (syncCurrency && rc.currency) {
        newCurr = rc.currency as SupportedCurrency;
        setCurrencyState(newCurr);
      }
      if (rc.timezone) {
        newTz = rc.timezone;
        setTimezoneState(newTz);
      }
    }

    saveToLocalStorage(newCountry, newCurr, newTz, complianceFramework);
    return true;
  };

  // Persist currency selection
  const setCurrencyCode = async (newCurrency: SupportedCurrency): Promise<boolean> => {
    // Always update local state & local storage immediately
    setCurrencyState(newCurrency);
    saveToLocalStorage(countryCode, newCurrency, timezone, complianceFramework);

    if (projectId) {
      localStorage.setItem(`projectmatrix_currency_proj_${projectId}`, newCurrency);
      try {
        if (companyId) {
          const key = `pm_projects_${companyId}`;
          const cached = localStorage.getItem(key);
          if (cached) {
            const list = JSON.parse(cached);
            const updated = list.map((p: any) => p.id === projectId ? { ...p, currency_code: newCurrency, currency: newCurrency } : p);
            localStorage.setItem(key, JSON.stringify(updated));
          }
        }
        const allKey = "pm_all_projects";
        const allCached = localStorage.getItem(allKey);
        if (allCached) {
          const list = JSON.parse(allCached);
          const updated = list.map((p: any) => p.id === projectId ? { ...p, currency_code: newCurrency, currency: newCurrency } : p);
          localStorage.setItem(allKey, JSON.stringify(updated));
        }
      } catch (_) {}
    }

    const isProjectValid = projectId ? isUuid(projectId) : false;
    const isCompanyValid = companyId ? isUuid(companyId) : false;

    if (!isProjectValid && !isCompanyValid) {
      return true;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = {
        company_id: isCompanyValid ? companyId : null,
        project_id: isProjectValid ? projectId : null,
        currency_code: newCurrency,
        timezone: timezone,
        updated_at: new Date().toISOString()
      };
      if (user?.id) {
        payload.created_by = user.id;
      }

      // Query if an entry already exists for this exact scope
      let query = supabase.from("erp_regional_settings").select("id");
      if (isProjectValid) {
        query = query.eq("project_id", projectId);
      } else {
        query = query.eq("company_id", companyId).is("project_id", null);
      }

      const { data: existing, error: findError } = await query.maybeSingle();
      if (findError) {
        if (!isApiKeyError(findError)) {
          console.warn("Regional settings Supabase notice:", findError?.message);
        }
        return true; // Local storage updated successfully
      }

      let dbError;
      if (existing?.id) {
        const { error } = await supabase
          .from("erp_regional_settings")
          .update(payload)
          .eq("id", existing.id);
        dbError = error;
      } else {
        const { error } = await supabase
          .from("erp_regional_settings")
          .insert(payload);
        dbError = error;
      }

      if (dbError && !isApiKeyError(dbError)) {
        console.warn("Regional settings persistence notice:", dbError?.message);
      }
      return true;
    } catch (err) {
      console.warn("Notice while saving currency to Supabase:", err);
      return true;
    }
  };

  // Persist timezone selection
  const setTimezone = async (newTimezone: string): Promise<boolean> => {
    // Always update local state & local storage immediately
    setTimezoneState(newTimezone);
    saveToLocalStorage(countryCode, currencyCode, newTimezone, complianceFramework);

    const isProjectValid = projectId ? isUuid(projectId) : false;
    const isCompanyValid = companyId ? isUuid(companyId) : false;

    if (!isProjectValid && !isCompanyValid) {
      return true;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = {
        company_id: isCompanyValid ? companyId : null,
        project_id: isProjectValid ? projectId : null,
        currency_code: currencyCode,
        timezone: newTimezone,
        updated_at: new Date().toISOString()
      };
      if (user?.id) {
        payload.created_by = user.id;
      }

      let query = supabase.from("erp_regional_settings").select("id");
      if (isProjectValid) {
        query = query.eq("project_id", projectId);
      } else {
        query = query.eq("company_id", companyId).is("project_id", null);
      }

      const { data: existing, error: findError } = await query.maybeSingle();
      if (findError) {
        if (!isApiKeyError(findError)) {
          console.warn("Regional settings Supabase notice:", findError?.message);
        }
        return true; // Local storage updated successfully
      }

      let dbError;
      if (existing?.id) {
        const { error } = await supabase
          .from("erp_regional_settings")
          .update(payload)
          .eq("id", existing.id);
        dbError = error;
      } else {
        const { error } = await supabase
          .from("erp_regional_settings")
          .insert(payload);
        dbError = error;
      }

      if (dbError && !isApiKeyError(dbError)) {
        console.warn("Regional settings persistence notice:", dbError?.message);
      }
      return true;
    } catch (err) {
      console.warn("Notice while saving timezone to Supabase:", err);
      return true;
    }
  };

  // Persist compliance framework selection
  const setComplianceFramework = async (newFramework: ContractFramework): Promise<boolean> => {
    setComplianceFrameworkState(newFramework);
    saveToLocalStorage(countryCode, currencyCode, timezone, newFramework);

    const isProjectValid = projectId ? isUuid(projectId) : false;
    const isCompanyValid = companyId ? isUuid(companyId) : false;

    if (!isProjectValid && !isCompanyValid) {
      return true;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = {
        company_id: isCompanyValid ? companyId : null,
        project_id: isProjectValid ? projectId : null,
        currency_code: currencyCode,
        timezone: timezone,
        updated_at: new Date().toISOString()
      };
      if (user?.id) {
        payload.created_by = user.id;
      }

      let query = supabase.from("erp_regional_settings").select("id");
      if (isProjectValid) {
        query = query.eq("project_id", projectId);
      } else {
        query = query.eq("company_id", companyId).is("project_id", null);
      }

      const { data: existing } = await query.maybeSingle();

      if (existing?.id) {
        // Try updating compliance_framework first
        const { error: err1 } = await supabase
          .from("erp_regional_settings")
          .update({ ...payload, compliance_framework: newFramework })
          .eq("id", existing.id);
        
        if (err1) {
          // Fallback options
          const { error: err2 } = await supabase
            .from("erp_regional_settings")
            .update({ ...payload, contract_type: newFramework })
            .eq("id", existing.id);

          if (err2) {
            await supabase
              .from("erp_regional_settings")
              .update(payload)
              .eq("id", existing.id);
          }
        }
      } else {
        const { error: err1 } = await supabase
          .from("erp_regional_settings")
          .insert({ ...payload, compliance_framework: newFramework });
        
        if (err1) {
          const { error: err2 } = await supabase
            .from("erp_regional_settings")
            .insert({ ...payload, contract_type: newFramework });

          if (err2) {
            await supabase
              .from("erp_regional_settings")
              .insert(payload);
          }
        }
      }
    } catch (e) {
      console.warn("Could not save contract framework to database, falling back to local storage:", e);
    }
    return true;
  };

  // Local helper wrappers with live FX conversion
  const convertAmount = (
    value: number | string | null | undefined,
    fromCurrency?: SupportedCurrency | string,
    targetCurrency?: SupportedCurrency | string
  ) => {
    const from = fromCurrency || currencyCode;
    const to = targetCurrency || currencyCode;
    return utilsConvertCurrency(value, from, to);
  };

  const formatCurrency = (
    value: number | string | null | undefined,
    options?: Intl.NumberFormatOptions,
    fromCurrency?: SupportedCurrency | string
  ) => {
    return utilsFormatCurrency(value, currencyCode, options, fromCurrency);
  };

  const formatCompactCurrency = (
    value: number | string | null | undefined,
    fromCurrency?: SupportedCurrency | string
  ) => {
    return utilsFormatCompactCurrency(value, currencyCode, fromCurrency);
  };

  const getCurrencyHoverTitle = (
    value: number | string | null | undefined,
    fromCurrency?: SupportedCurrency | string
  ) => {
    return utilsGetCurrencyHoverTitle(value, fromCurrency || currencyCode, currencyCode);
  };

  const formatDate = (value: string | null | undefined) => {
    return utilsFormatDateOnly(value);
  };

  const formatDateTime = (
    value: string | Date | null | undefined,
    includeTimeOrTimezone: boolean | string = true,
    explicitTimezone?: string
  ) => {
    let includeTime = true;
    let tz = timezone;

    if (typeof includeTimeOrTimezone === "string") {
      tz = includeTimeOrTimezone;
    } else {
      includeTime = includeTimeOrTimezone;
      if (explicitTimezone) {
        tz = explicitTimezone;
      }
    }
    return utilsFormatDateTimeInTimezone(value, tz, includeTime);
  };


  const getTodayInTimezone = () => {
    return utilsGetTodayInTimezone(timezone);
  };

  const currencySymbol = currencySymbols[currencyCode] || "R";

  return (
    <RegionalSettingsContext.Provider
      value={{
        countryCode,
        currencyCode,
        currencySymbol,
        timezone,
        locale,
        complianceFramework,
        exchangeRateState,
        refreshExchangeRates,
        setCountryCode,
        setCurrencyCode,
        setTimezone,
        setComplianceFramework,
        convertAmount,
        formatCurrency,
        formatCompactCurrency,
        getCurrencyHoverTitle,
        formatDate,
        formatDateTime,
        getTodayInTimezone,
        isLoading
      }}
    >
      {children}
    </RegionalSettingsContext.Provider>
  );
}

export function useRegionalSettings() {
  const context = useContext(RegionalSettingsContext);
  if (context === undefined) {
    throw new Error("useRegionalSettings must be used within a RegionalSettingsProvider");
  }
  return context;
}
