import { previewStorage } from "../../integration/previewStorage";
import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  FileSpreadsheet, 
  ArrowDownToLine, 
  Save, 
  Trash2, 
  RotateCcw,
  Plus, 
  Briefcase,
  Users,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowLeft,
  ChevronRight,
  UserCheck,
  Lock,
  Unlock,
  Loader2,
  Calendar,
  Layers,
  PiggyBank,
  AlertTriangle,
  UploadCloud,
  FileCheck,
  Activity
} from "lucide-react";

import { PayrollInfo, PayrollSettings, LabourPayrollRow } from "../../types/payroll";
import PayrollInformationCard from "../../components/payroll/PayrollInformationCard";
import PayrollSettingsCard from "../../components/payroll/PayrollSettingsCard";
import PayrollSummaryCards from "../../components/payroll/PayrollSummaryCards";
import LabourPayrollTable from "../../components/payroll/LabourPayrollTable";
import { exportToExcel, generateExcelBlob } from "../../utils/payrollExcelExport";
import { calculateRow, calculateTotals } from "../../utils/payrollCalculations";
import { supabase, isApiKeyError } from "../../lib/supabase";
import { useRegionalSettings } from "../../hooks/useRegionalSettings";
import { SupportedCurrency, currencySymbols } from "../../config/currencies";
import { 
  uploadPayrollWorkbook, 
  downloadPayrollWorkbook, 
  createPayrollWorkbookSignedUrl, 
  deletePayrollWorkbook 
} from "../../services/labourPayrollStorageService";

interface LabourPayrollEntryDatabaseRow {
  id: string;
  payroll_id: string;
  employee_number: string | null;
  first_name: string;
  last_name: string;
  full_name: string;
  id_number: string | null;
  staff_category: string | null;
  contact_number: string | null;
  pay_type: "Hourly" | "Salaried";
  bank_name: string | null;
  account_holder: string | null;
  account_number: string | null;
  branch_code: string | null;
  account_type: string | null;
  normal_hourly_rate: number | string;
  normal_hours: number | string;
  base_salary: number | string;
  normal_wages: number | string;
  overtime_hourly_rate: number | string;
  overtime_hours: number | string;
  overtime_wages: number | string;
  sunday_holiday_hourly_rate: number | string;
  sunday_holiday_hours: number | string;
  sunday_holiday_wages: number | string;
  gross_wage: number | string;
  uif_deduction: number | string;
  other_deductions: number | string;
  net_pay: number | string;
  created_at: string;
  updated_at: string;
}

export const isValidUuid = (value: unknown): value is string => {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
};

export interface PayrollRegisterRpcRow {
  id?: string;
  payroll_id?: string;
  company_id?: string;
  project_id?: string;
  payroll_title?: string;
  payroll_month?: string;
  month?: string;
  payroll_year?: string;
  year?: string;
  period_start?: string;
  period_end?: string;
  prepared_by?: string;
  date_prepared?: string;
  currency_code?: string;
  currency_symbol?: string;
  status?: string;
  staff_count?: any;
  gross_payroll?: any;
  net_payroll?: any;
  uif_total?: any;
  other_deductions_total?: any;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  excel_storage_path?: string | null;
  excel_file_name?: string | null;
  excel_file_size?: any;
  excel_mime_type?: string | null;
  excel_uploaded_at?: string | null;
  excel_uploader_name?: string | null;
  decimal_places?: number;
  currency_locale?: string;
}

export interface PayrollRegisterItem {
  id: string;
  companyId?: string;
  projectId?: string;
  payrollTitle?: string;
  payrollMonth?: string;
  payrollYear?: number;
  periodStart?: string;
  periodEnd?: string;
  preparedBy?: string;
  datePrepared?: string;
  currencyCode?: string;
  currencySymbol?: string;
  status?: string;
  staffCount?: number;
  grossPayroll?: number;
  netPayroll?: number;
  uifTotal?: number;
  otherDeductionsTotal?: number;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;

  // Plus all properties from SupabasePayrollRecord for maximum compatibility and safety:
  company_id?: string;
  project_id?: string;
  payroll_title?: string;
  payroll_month?: string;
  payroll_year?: string;
  period_start?: string;
  period_end?: string;
  prepared_by?: string;
  date_prepared?: string;
  notes?: string | null;
  currency_code?: string;
  currency_symbol?: string;
  normal_multiplier?: number;
  overtime_multiplier?: number;
  sunday_holiday_multiplier?: number;
  uif_percentage?: number;
  decimal_places?: number;
  created_by?: string | null;
  created_at?: string;
  approved_by?: string | null;
  approved_at?: string | null;
  updated_at?: string;
  entries?: any[];
  currencyLocale?: string;
  excel_storage_path?: string | null;
  excel_file_name?: string | null;
  excel_file_size?: number | null;
  excel_mime_type?: string | null;
  excel_uploaded_at?: string | null;
  excel_uploader_name?: string | null;
  decimalPlaces?: number;
}

export type SupabasePayrollRecord = PayrollRegisterItem;

export const mapPayrollRegisterRow = (
  row: PayrollRegisterRpcRow
): PayrollRegisterItem => {
  const finalId = typeof row.id === "string" ? row.id : (typeof row.payroll_id === "string" ? row.payroll_id : "");
  return {
    id: finalId,
    companyId: row.company_id,
    projectId: row.project_id,
    payrollTitle: row.payroll_title,
    payrollMonth: row.payroll_month || row.month,
    payrollYear: Number(row.payroll_year || row.year),
    periodStart: row.period_start,
    periodEnd: row.period_end,
    preparedBy: row.prepared_by ?? "",
    datePrepared: row.date_prepared,
    currencyCode: row.currency_code ?? "ZAR",
    currencySymbol: row.currency_symbol ?? "R",
    status: row.status,
    staffCount: toSafeNumber(row.staff_count),
    grossPayroll: toSafeNumber(row.gross_payroll),
    netPayroll: toSafeNumber(row.net_payroll),
    uifTotal: toSafeNumber(row.uif_total),
    otherDeductionsTotal: toSafeNumber(row.other_deductions_total),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,

    // Aliases to support existing UI properties
    company_id: row.company_id,
    project_id: row.project_id,
    payroll_title: row.payroll_title,
    payroll_month: row.payroll_month || row.month,
    payroll_year: String(row.payroll_year || row.year || ""),
    period_start: row.period_start,
    period_end: row.period_end,
    prepared_by: row.prepared_by ?? "",
    currency_code: row.currency_code ?? "ZAR",
    currency_symbol: row.currency_symbol ?? "R",
    created_at: row.created_at,
    excel_storage_path: row.excel_storage_path,
    excel_file_name: row.excel_file_name,
    excel_file_size: row.excel_file_size ? toSafeNumber(row.excel_file_size) : null,
    excel_mime_type: row.excel_mime_type,
    excel_uploaded_at: row.excel_uploaded_at,
    excel_uploader_name: row.excel_uploader_name,
    decimalPlaces: row.decimal_places ?? 2,
    currencyLocale: row.currency_locale || "en-ZA"
  };
};

export const toSafeNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const normalised = value
      .replace(/\s/g, "")
      .replace(/,/g, "");

    const parsed = Number(normalised);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

export const formatPayrollCurrency = (
  value: unknown,
  currencyCode?: string,
  currencyLocale?: string,
  decimalPlaces: number = 2
): string => {
  const code = (currencyCode || "ZAR") as SupportedCurrency;
  const sym = currencySymbols[code] || "R";
  const num = toSafeNumber(value);
  const formattedNum = num.toLocaleString(undefined, {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  });
  return `${sym} ${formattedNum}`;
};

export default function LabourPayrollPage() {
  const context = useOutletContext<any>() || {};
  const { 
    profile, 
    activeCompany, 
    activeProject,
    setSuccessMsg,
    setErrorMsg,
    companyPersonnel
  } = context;

  const storageKey = "projectmatrix_labour_payroll_draft";

  // 1. Navigation State
  const [view, setView] = useState<"register" | "editor">("register");
  const [selectedPayrollId, setSelectedPayrollId] = useState<string | null>(null);

  // 2. Data Fetching & Sync State
  const [payrolls, setPayrolls] = useState<SupabasePayrollRecord[]>([]);
  const [isLoadingRegister, setIsLoadingRegister] = useState(true);
  const [isLoadingEditor, setIsLoadingEditor] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null); // tracks id of payroll undergoing submit/approve/etc

  // 3. Active Editor State (for the loaded payroll)
  const [payrollInfo, setPayrollInfo] = useState<PayrollInfo>({
    project: "",
    employerName: "",
    payrollTitle: "",
    payrollMonth: "",
    payrollYear: "",
    startDate: "",
    endDate: "",
    preparedBy: "",
    datePrepared: "",
    notes: ""
  });

  const { currencyCode, currencySymbol, setCurrencyCode } = useRegionalSettings();

  const [settings, setSettings] = useState<PayrollSettings>({
    normalMultiplier: 1.0,
    overtimeMultiplier: 1.5,
    sundayHolidayMultiplier: 2.0,
    uifPercentage: 1.0,
    currency: currencyCode || "ZAR",
    currencySymbol: currencySymbol || "R",
    decimalPlaces: 2
  });

  // Keep settings currency in sync when regional settings change in Settings tab
  useEffect(() => {
    if (currencyCode) {
      setSettings(prev => ({
        ...prev,
        currency: currencyCode,
        currencySymbol: currencySymbol || "R"
      }));
    }
  }, [currencyCode, currencySymbol]);

  const [rows, setRows] = useState<LabourPayrollRow[]>([]);
  const [currentStatus, setCurrentStatus] = useState<string>("Draft");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Filter States for Register
  const [registerFilterStatus, setRegisterFilterStatus] = useState<string>("All");
  const [registerSearch, setRegisterSearch] = useState<string>("");

  // Local Storage Draft Detection state
  const [hasLocalDraft, setHasLocalDraft] = useState(false);

  // Custom confirmation state for in-app delete modal
  const [pendingDeletePayrollId, setPendingDeletePayrollId] = useState<string | null>(null);

  // Find active member in company_members using logged-in user's profile ID
  const activeMember = (companyPersonnel || []).find((p: any) => p.profile_id === profile?.id);
  const isCompanyAdmin = activeMember?.is_company_admin === true;
  const userDesignation = activeMember?.designation || profile?.role;

  // Check if current user is an authorized payroll manager/approver
  // CEO, COO, CFO, Director, Project Manager, Site Agent/Manager, Quantity Surveyor, Procurement Officer, Foreman, or if they are a Company Admin
  const isManager = [
    "ceo",
    "coo",
    "cfo",
    "director",
    "project_manager",
    "site_agent_manager",
    "quantity_surveyor",
    "procurement_officer",
    "foreman"
  ].includes(userDesignation?.trim().toLowerCase().replace(/\s+/g, "_").replace(/\//g, "_")) || isCompanyAdmin;

  // Default initializers for new database payrolls
  const defaultInfo = (): PayrollInfo => ({
    project: activeProject?.name || "Mbhonya Jabulani Res",
    employerName: activeCompany?.name || "Mbhonya Construction",
    payrollTitle: `Staff Payroll – ${new Date().toLocaleString("default", { month: "long" })} ${new Date().getFullYear()}`,
    payrollMonth: new Date().toLocaleString("default", { month: "long" }),
    payrollYear: String(new Date().getFullYear()),
    startDate: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`,
    endDate: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-28`,
    preparedBy: profile?.full_name || "Site Administrator",
    datePrepared: new Date().toISOString().split("T")[0],
    notes: "Site staff wages, overtime allowances, and statutory UIF employee deductions."
  });

  const defaultSettings = (): PayrollSettings => ({
    normalMultiplier: 1.0,
    overtimeMultiplier: 1.5,
    sundayHolidayMultiplier: 2.0,
    uifPercentage: 1.0,
    currency: currencyCode || "ZAR",
    currencySymbol: currencySymbol || "R",
    decimalPlaces: 2
  });

  const defaultRows = (): LabourPayrollRow[] => [
    {
      id: "row-1",
      employeeNumber: "EMP-101",
      firstName: "Themba",
      lastName: "Dube",
      idNumber: "8805125123081",
      jobTitle: "Senior Bricklayer",
      contactNumber: "+27 72 123 4567",
      bankName: "Standard Bank",
      accountHolder: "T Dube",
      accountNumber: "123456789",
      branchCode: "051001",
      accountType: "Savings",
      payType: "hourly",
      normalHourlyRate: 65.00,
      normalHours: 160,
      baseSalary: 0,
      overtimeHours: 12.5,
      sundayHolidayHours: 8,
      otherDeductions: 150.00
    },
    {
      id: "row-2",
      employeeNumber: "EMP-102",
      firstName: "Sipho",
      lastName: "Mahlangu",
      idNumber: "9211045987084",
      jobTitle: "General Worker",
      contactNumber: "+27 83 987 6543",
      bankName: "FNB",
      accountHolder: "S Mahlangu",
      accountNumber: "9876543210",
      branchCode: "250655",
      accountType: "Cheque",
      payType: "hourly",
      normalHourlyRate: 45.00,
      normalHours: 160,
      baseSalary: 0,
      overtimeHours: 8,
      sundayHolidayHours: 0,
      otherDeductions: 0
    },
    {
      id: "row-3",
      employeeNumber: "EMP-103",
      firstName: "Johannes",
      lastName: "Modise",
      idNumber: "7904035612089",
      jobTitle: "Site Supervisor",
      contactNumber: "+27 71 456 7890",
      bankName: "Nedbank",
      accountHolder: "J Modise",
      accountNumber: "456123789",
      branchCode: "198765",
      accountType: "Savings",
      payType: "salaried",
      normalHourlyRate: 0,
      normalHours: 160,
      baseSalary: 14500.00,
      overtimeHours: 15,
      sundayHolidayHours: 4,
      otherDeductions: 350.00
    }
  ];

  // 4. Initial Checks: Detect Local Storage Drafts & Load Register
  useEffect(() => {
    try {
      const saved = previewStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.rows && parsed.rows.length > 0) {
          setHasLocalDraft(true);
        }
      }
    } catch (e) {
      console.warn("Error reading local storage cache:", e);
    }
  }, []);

  useEffect(() => {
    if (activeProject?.id) {
      fetchPayrolls();
      // Reset editor when switching active project
      setView("register");
      setSelectedPayrollId(null);
    } else {
      setPayrolls([]);
      setIsLoadingRegister(false);
    }
  }, [activeProject, activeCompany]);

  // Sync editor names when project/company changes and editor is open but unmodified
  useEffect(() => {
    if (view === "editor" && !hasUnsavedChanges) {
      if (activeProject?.name) {
        setPayrollInfo(prev => ({ ...prev, project: activeProject.name }));
      }
      if (activeCompany?.name) {
        setPayrollInfo(prev => ({ ...prev, employerName: activeCompany.name }));
      }
    }
  }, [activeProject, activeCompany, view, hasUnsavedChanges]);

  // 5. Database Fetching Functions
  const fetchPayrolls = async () => {
    if (!activeProject?.id) return;
    setIsLoadingRegister(true);
    try {
      let data: any = null;
      let error: any = null;

      try {
        const res = await supabase.rpc("get_payroll_register", {
          p_project_id: activeProject.id,
        });
        data = res.data;
        error = res.error;
      } catch (e) {
        error = e;
      }

      // If RPC is missing or fails, fall back to direct table query
      if (error) {
        const fallback = await supabase
          .from("labour_payrolls")
          .select("*")
          .eq("project_id", activeProject.id)
          .order("created_at", { ascending: false });
        if (!fallback.error && fallback.data) {
          data = fallback.data;
          error = null;
        }
      }

      if (error) throw error;

      console.debug("Payroll register row:", data?.[0]);

      setPayrolls(
        (data ?? []).map(mapPayrollRegisterRow)
      );
    } catch (err: any) {
      console.warn("Notice when fetching payrolls:", err?.message || err);
      if (isApiKeyError(err)) {
        // Swallowed quietly for unconfigured or invalid API key environment
      } else if (setErrorMsg) {
        setErrorMsg(`Failed to load payroll register: ${err?.message || err}`);
      }
    } finally {
      setIsLoadingRegister(false);
    }
  };

  const handleEditPayroll = async (payrollId: string) => {
    if (!isValidUuid(payrollId)) {
      console.error("Invalid payroll ID for edit:", payrollId);
      if (setErrorMsg) setErrorMsg("This payroll register is missing a valid database ID. Refresh the page and try again.");
      return;
    }

    setIsLoadingEditor(true);
    setSelectedPayrollId(payrollId);
    try {
      // Robust split parent-child queries to completely bypass PostgREST join schema cache constraints
      const { data, error } = await supabase
        .from("labour_payrolls")
        .select("*")
        .eq("id", payrollId)
        .single();

      if (error) throw error;

      let dbEntries: any[] = [];
      if (data) {
        const { data: entriesData, error: entriesError } = await supabase
          .from("labour_payroll_entries")
          .select("*")
          .eq("payroll_id", payrollId);
        
        if (entriesError) {
          if (!isApiKeyError(entriesError)) {
            console.error("Non-fatal entries load fallback error:", entriesError);
          }
        } else {
          dbEntries = entriesData || [];
        }
      }

      if (data) {
        setPayrollInfo({
          project: data.payroll_title ? (activeProject?.name || data.payroll_title) : data.payroll_title,
          employerName: data.prepared_by ? (activeCompany?.name || "Company Name") : "Company Name", // safer fallback
          payrollTitle: data.payroll_title,
          payrollMonth: data.payroll_month,
          payrollYear: data.payroll_year,
          startDate: data.period_start,
          endDate: data.period_end,
          preparedBy: data.prepared_by,
          datePrepared: data.date_prepared,
          notes: data.notes || ""
        });

        // Map settings from record
        setSettings({
          normalMultiplier: Number(data.normal_multiplier) || 1.0,
          overtimeMultiplier: Number(data.overtime_multiplier) || 1.5,
          sundayHolidayMultiplier: Number(data.sunday_holiday_multiplier) || 2.0,
          uifPercentage: Number(data.uif_percentage) || 1.0,
          currency: data.currency_code || "ZAR",
          currencySymbol: data.currency_symbol || "R",
          decimalPlaces: data.decimal_places || 2
        });

        // Map entries
        const mappedRows: LabourPayrollRow[] = (dbEntries || []).map((e: any) => ({
          id: e.id,
          employeeNumber: e.employee_number,
          firstName: e.first_name,
          lastName: e.last_name,
          idNumber: e.id_number || "",
          jobTitle: e.staff_category || "General Worker",
          contactNumber: e.contact_number || "",
          payType: e.pay_type ? (e.pay_type.toLowerCase() as "hourly" | "salaried") : "hourly",
          bankName: e.bank_name || "",
          accountHolder: e.account_holder || "",
          accountNumber: e.account_number || "",
          branchCode: e.branch_code || "",
          accountType: e.account_type || "Savings",
          normalHourlyRate: Number(e.normal_hourly_rate) || 0,
          normalHours: Number(e.normal_hours) || 0,
          baseSalary: Number(e.base_salary) || 0,
          overtimeHours: Number(e.overtime_hours) || 0,
          sundayHolidayHours: Number(e.sunday_holiday_hours) || 0,
          otherDeductions: Number(e.other_deductions) || 0
        }));

        setRows(mappedRows);
        setCurrentStatus(data.status);
        setHasUnsavedChanges(false);
        setView("editor");
      }
    } catch (err: any) {
      if (!isApiKeyError(err)) {
        console.error("Error loading payroll details:", err);
        if (setErrorMsg) setErrorMsg(`Failed to open payroll editor: ${err.message || err}`);
      }
    } finally {
      setIsLoadingEditor(false);
    }
  };

  // 6. DB Mutators
  const handleSavePayroll = async () => {
    assertOperationalAction("write", "pages/LabourPayroll/LabourPayrollPage.tsx");
    if (!selectedPayrollId || !activeCompany?.id || !activeProject?.id) return;
    
    // Period Duplicate Prevention check
    const isDuplicate = payrolls.some(p => 
      p.id !== selectedPayrollId &&
      (p.payroll_month || "").toLowerCase().trim() === (payrollInfo.payrollMonth || "").toLowerCase().trim() &&
      (p.payroll_year || "").trim() === (payrollInfo.payrollYear || "").trim()
    );

    if (isDuplicate) {
      if (setErrorMsg) {
        setErrorMsg(`Constraint Violation: A payroll register already exists for the project during ${payrollInfo.payrollMonth} ${payrollInfo.payrollYear}. Duplicate periods are locked.`);
      }
      return;
    }

    setIsSaving(true);
    try {
      // 1. Construct the payroll header payload
      const payrollPayload = {
        id: selectedPayrollId,
        company_id: activeCompany.id,
        project_id: activeProject.id,
        payroll_title: payrollInfo.payrollTitle,
        payroll_month: payrollInfo.payrollMonth,
        payroll_year: payrollInfo.payrollYear,
        period_start: payrollInfo.startDate,
        period_end: payrollInfo.endDate,
        prepared_by: payrollInfo.preparedBy,
        date_prepared: payrollInfo.datePrepared,
        notes: payrollInfo.notes,
        normal_multiplier: settings.normalMultiplier,
        overtime_multiplier: settings.overtimeMultiplier,
        sunday_holiday_multiplier: settings.sundayHolidayMultiplier,
        uif_percentage: settings.uifPercentage,
        currency_code: settings.currency,
        currency_symbol: settings.currencySymbol,
        decimal_places: settings.decimalPlaces,
        status: currentStatus,
        updated_at: new Date().toISOString()
      };

      // 2. Construct the entries payload exactly as requested
      const entriesPayload = rows.map((row) => {
        const calculated = calculateRow(row, settings);

        return {
          id: (row.id && !row.id.startsWith("row-")) ? row.id : null,
          employee_number: row.employeeNumber || null,
          first_name: (row.firstName || "").trim(),
          last_name: (row.lastName || "").trim(),
          full_name: `${row.firstName || ""} ${row.lastName || ""}`.trim(),
          id_number: row.idNumber || null,
          staff_category: row.jobTitle || null,
          contact_number: row.contactNumber || null,
          pay_type: row.payType === "salaried" ? "Salaried" : "Hourly",
          bank_name: row.bankName || null,
          account_holder: row.accountHolder || null,
          account_number: row.accountNumber || null,
          branch_code: row.branchCode || null,
          account_type: row.accountType || null,
          normal_hourly_rate: Number(row.normalHourlyRate) || 0,
          normal_hours: Number(row.normalHours) || 0,
          base_salary: Number(row.baseSalary) || 0,
          normal_wages: Number(calculated.normalWages) || 0,
          overtime_hourly_rate: Number(calculated.overtimeHourlyRate) || 0,
          overtime_hours: Number(row.overtimeHours) || 0,
          overtime_wages: Number(calculated.overtimeWages) || 0,
          sunday_holiday_hourly_rate: Number(calculated.sundayHolidayHourlyRate) || 0,
          sunday_holiday_hours: Number(row.sundayHolidayHours) || 0,
          sunday_holiday_wages: Number(calculated.sundayHolidayWages) || 0,
          gross_wage: Number(calculated.grossWage) || 0,
          uif_deduction: Number(calculated.uifDeduction) || 0,
          other_deductions: Number(row.otherDeductions) || 0,
          net_pay: Number(calculated.netPay) || 0,
        };
      });

      // 3. Save via transactional secure RPC
      const { data: savedId, error: saveErr } = await supabase.rpc("save_labour_payroll", {
        p_payroll: payrollPayload,
        p_entries: entriesPayload
      });

      if (saveErr) throw saveErr;

      if (savedId) {
        setSelectedPayrollId(savedId);
      }

      setHasUnsavedChanges(false);
      if (setSuccessMsg) setSuccessMsg("Payroll ledger successfully synced to cloud secure database.");
      
      // Refresh list
      await fetchPayrolls();
    } catch (err: any) {
      console.error("Error saving payroll:", err);
      if (setErrorMsg) setErrorMsg(`Database Sync Failed: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNewPayroll = async () => {
    assertOperationalAction("create", "pages/LabourPayroll/LabourPayrollPage.tsx");
    if (!activeCompany?.id || !activeProject?.id) {
      if (setErrorMsg) setErrorMsg("Select a company and project to initialize labor payroll.");
      return;
    }

    const infoDefault = defaultInfo();
    const settingsDefault = defaultSettings();

    // Check period duplication
    const isDuplicate = payrolls.some(p => 
      (p.payroll_month || "").toLowerCase().trim() === (infoDefault.payrollMonth || "").toLowerCase().trim() &&
      (p.payroll_year || "").trim() === (infoDefault.payrollYear || "").trim()
    );

    if (isDuplicate) {
      if (setErrorMsg) {
        setErrorMsg(`Conflict: A payroll register already exists for this project in ${infoDefault.payrollMonth} ${infoDefault.payrollYear}.`);
      }
      return;
    }

    setIsLoadingEditor(true);
    try {
      // Create primary payroll record
      const { data, error } = await supabase
        .from("labour_payrolls")
        .insert({
          company_id: activeCompany.id,
          project_id: activeProject.id,
          payroll_title: infoDefault.payrollTitle,
          payroll_month: infoDefault.payrollMonth,
          payroll_year: infoDefault.payrollYear,
          period_start: infoDefault.startDate,
          period_end: infoDefault.endDate,
          prepared_by: infoDefault.preparedBy,
          date_prepared: infoDefault.datePrepared,
          notes: infoDefault.notes,
          normal_multiplier: settingsDefault.normalMultiplier,
          overtime_multiplier: settingsDefault.overtimeMultiplier,
          sunday_holiday_multiplier: settingsDefault.sundayHolidayMultiplier,
          uif_percentage: settingsDefault.uifPercentage,
          currency_code: settingsDefault.currency,
          currency_symbol: settingsDefault.currencySymbol,
          decimal_places: settingsDefault.decimalPlaces,
          status: "Draft",
          created_by: profile?.id || null
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setSelectedPayrollId(data.id);
        setPayrollInfo(infoDefault);
        setSettings(settingsDefault);
        
        // Seed default rows in State
        const seededRows = defaultRows();
        setRows(seededRows);
        setCurrentStatus("Draft");

        // Initial blank rows remain in state until user explicitly clicks Save. No direct seeding.
        setHasUnsavedChanges(true);
        if (setSuccessMsg) setSuccessMsg("Initialized a new secure labor payroll draft with standard templates.");
        setView("editor");
        await fetchPayrolls();
      }
    } catch (err: any) {
      console.error("Error creating payroll:", err);
      if (setErrorMsg) setErrorMsg(`Database creation failed: ${err.message || err}`);
    } finally {
      setIsLoadingEditor(false);
    }
  };

  const handleImportLocalDraft = async () => {
    assertOperationalAction("write", "pages/LabourPayroll/LabourPayrollPage.tsx");
    if (!activeCompany?.id || !activeProject?.id) {
      if (setErrorMsg) setErrorMsg("Select an active company and project to import local draft.");
      return;
    }

    setIsLoadingEditor(true);
    try {
      const saved = previewStorage.getItem(storageKey);
      if (!saved) throw new Error("No offline local draft found.");

      const parsed = JSON.parse(saved);
      const importedInfo: PayrollInfo = parsed.payrollInfo || defaultInfo();
      const importedSettings: PayrollSettings = parsed.settings || defaultSettings();
      const importedRows: LabourPayrollRow[] = parsed.rows || [];

      // Append copy indicator to avoid unique period collisions on DB
      const suffix = ` (Imported)`;
      const finalMonth = importedInfo.payrollMonth.includes("Imported") 
        ? importedInfo.payrollMonth 
        : `${importedInfo.payrollMonth}${suffix}`;

      // Insert primary
      const { data, error } = await supabase
        .from("labour_payrolls")
        .insert({
          company_id: activeCompany.id,
          project_id: activeProject.id,
          payroll_title: `${importedInfo.payrollTitle} (Imported)`,
          payroll_month: finalMonth,
          payroll_year: importedInfo.payrollYear,
          period_start: importedInfo.startDate,
          period_end: importedInfo.endDate,
          prepared_by: importedInfo.preparedBy,
          date_prepared: importedInfo.datePrepared,
          notes: importedInfo.notes || "Imported from local browser cache.",
          normal_multiplier: importedSettings.normalMultiplier,
          overtime_multiplier: importedSettings.overtimeMultiplier,
          sunday_holiday_multiplier: importedSettings.sundayHolidayMultiplier,
          uif_percentage: importedSettings.uifPercentage,
          currency_code: importedSettings.currency,
          currency_symbol: importedSettings.currencySymbol,
          decimal_places: importedSettings.decimalPlaces,
          status: "Draft",
          created_by: profile?.id || null
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        // Construct the entries payload for rpc saving
        const entriesPayload = importedRows.map(r => {
          const calc = calculateRow(r, importedSettings);
          return {
            id: null,
            employee_number: r.employeeNumber || `EMP-${Math.floor(Math.random() * 900) + 100}`,
            first_name: (r.firstName || "Unnamed").trim(),
            last_name: (r.lastName || "Staff").trim(),
            full_name: `${r.firstName || "Unnamed"} ${r.lastName || "Staff"}`.trim(),
            id_number: r.idNumber || null,
            staff_category: r.jobTitle || "General Worker",
            contact_number: r.contactNumber || null,
            pay_type: r.payType === "salaried" ? "Salaried" : "Hourly",
            bank_name: r.bankName || null,
            account_holder: r.accountHolder || null,
            account_number: r.accountNumber || null,
            branch_code: r.branchCode || null,
            account_type: r.accountType || null,
            normal_hourly_rate: Number(r.normalHourlyRate) || 0,
            normal_hours: Number(r.normalHours) || 0,
            base_salary: Number(r.baseSalary) || 0,
            normal_wages: Number(calc.normalWages) || 0,
            overtime_hourly_rate: Number(calc.overtimeHourlyRate) || 0,
            overtime_hours: Number(r.overtimeHours) || 0,
            overtime_wages: Number(calc.overtimeWages) || 0,
            sunday_holiday_hourly_rate: Number(calc.sundayHolidayHourlyRate) || 0,
            sunday_holiday_hours: Number(r.sundayHolidayHours) || 0,
            sunday_holiday_wages: Number(calc.sundayHolidayWages) || 0,
            gross_wage: Number(calc.grossWage) || 0,
            uif_deduction: Number(calc.uifDeduction) || 0,
            other_deductions: Number(r.otherDeductions) || 0,
            net_pay: Number(calc.netPay) || 0
          };
        });

        const payrollPayload = {
          id: data.id,
          company_id: activeCompany.id,
          project_id: activeProject.id,
          payroll_title: `${importedInfo.payrollTitle} (Imported)`,
          payroll_month: finalMonth,
          payroll_year: importedInfo.payrollYear,
          period_start: importedInfo.startDate,
          period_end: importedInfo.endDate,
          prepared_by: importedInfo.preparedBy,
          date_prepared: importedInfo.datePrepared,
          notes: importedInfo.notes || "Imported from local browser cache.",
          normal_multiplier: importedSettings.normalMultiplier,
          overtime_multiplier: importedSettings.overtimeMultiplier,
          sunday_holiday_multiplier: importedSettings.sundayHolidayMultiplier,
          uif_percentage: importedSettings.uifPercentage,
          currency_code: importedSettings.currency,
          currency_symbol: importedSettings.currencySymbol,
          decimal_places: importedSettings.decimalPlaces,
          status: "Draft",
          updated_at: new Date().toISOString()
        };

        const { error: saveErr } = await supabase.rpc("save_labour_payroll", {
          p_payroll: payrollPayload,
          p_entries: entriesPayload
        });

        if (saveErr) throw saveErr;

        // Wipe local storage so banner goes away
        previewStorage.removeItem(storageKey);
        setHasLocalDraft(false);

        if (setSuccessMsg) setSuccessMsg("Successfully migrated your browser offline draft into Supabase cloud database!");
        await handleEditPayroll(data.id);
        await fetchPayrolls();
      }
    } catch (err: any) {
      console.error("Import local draft error:", err);
      if (setErrorMsg) setErrorMsg(`Migration failed: ${err.message || err}`);
    } finally {
      setIsLoadingEditor(false);
    }
  };

  const handleDuplicatePayroll = async (payrollId: string) => {
    if (!isValidUuid(payrollId)) {
      console.error("Invalid payroll ID:", payrollId);
      if (setErrorMsg) setErrorMsg("This payroll register is missing a valid database ID. Refresh the page and try again.");
      return;
    }

    setIsLoadingRegister(true);
    try {
      const { data: newPayrollId, error } = await supabase.rpc(
        "duplicate_labour_payroll",
        {
          p_payroll_id: payrollId,
        }
      );

      if (error) throw error;

      if (setSuccessMsg) setSuccessMsg("Payroll duplicated successfully.");
      await fetchPayrolls();
    } catch (err: any) {
      console.error("Duplication failed:", err);
      if (setErrorMsg) setErrorMsg(`Payroll Duplication Failed: ${err.message || err}`);
    } finally {
      setIsLoadingRegister(false);
    }
  };

  const handleDeletePayroll = async (id: string) => {
    assertOperationalAction("delete", "pages/LabourPayroll/LabourPayrollPage.tsx");
    if (!isValidUuid(id)) {
      console.error("Invalid payroll ID:", id);
      if (setErrorMsg) setErrorMsg("This payroll register is missing a valid database ID. Refresh the page and try again.");
      return;
    }

    setIsLoadingRegister(true);
    try {
      const { error } = await supabase
        .from("labour_payrolls")
        .delete()
        .eq("id", id);

      if (error) throw error;
      if (setSuccessMsg) setSuccessMsg("Archived payroll draft completely deleted from database.");
      await fetchPayrolls();
    } catch (err: any) {
      console.error("Deletion failed:", err);
      if (setErrorMsg) setErrorMsg(`Failed to delete record: ${err.message || err}`);
    } finally {
      setIsLoadingRegister(false);
    }
  };

  const confirmDeletePayroll = async () => {
    const payrollId = pendingDeletePayrollId;

    if (!isValidUuid(payrollId)) {
      console.error("Invalid payroll ID for deletion:", payrollId);
      return;
    }

    setIsLoadingRegister(true);
    try {
      const { error } = await supabase
        .from("labour_payrolls")
        .delete()
        .eq("id", payrollId);

      if (error) throw error;
      if (setSuccessMsg) setSuccessMsg("Archived payroll draft completely deleted from database.");
      setPendingDeletePayrollId(null);
      await fetchPayrolls();
    } catch (err: any) {
      console.error("Deletion failed:", err);
      if (setErrorMsg) setErrorMsg(`Failed to delete record: ${err.message || err}`);
    } finally {
      setIsLoadingRegister(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    assertOperationalAction("edit", "pages/LabourPayroll/LabourPayrollPage.tsx");
    if (!isValidUuid(id)) {
      console.error("Invalid payroll ID:", id);
      if (setErrorMsg) setErrorMsg("This payroll register is missing a valid database ID. Refresh the page and try again.");
      return;
    }

    const payrollItem = payrolls.find(p => p.id === id);
    const oldStatus = payrollItem ? payrollItem.status : currentStatus;

    if (oldStatus === newStatus) return;

    setIsActionLoading(id);
    try {
      let rpcName = "";
      if (newStatus === "Draft") {
        rpcName = "reopen_labour_payroll";
      } else if (newStatus === "Submitted") {
        if (oldStatus === "Approved") {
          rpcName = "reopen_labour_payroll";
        } else {
          rpcName = "submit_labour_payroll";
        }
      } else if (newStatus === "Approved") {
        if (oldStatus === "Locked") {
          rpcName = "reopen_labour_payroll";
        } else {
          rpcName = "approve_labour_payroll";
        }
      } else if (newStatus === "Locked") {
        rpcName = "lock_labour_payroll";
      }

      if (!rpcName) {
        throw new Error(`Unsupported transition from ${oldStatus} to ${newStatus}`);
      }

      const { error } = await supabase.rpc(rpcName, { p_payroll_id: id });

      if (error) throw error;

      if (setSuccessMsg) {
        setSuccessMsg(`Payroll state transitioned successfully to [${newStatus}] via [${rpcName}].`);
      }

      if (view === "editor" && selectedPayrollId === id) {
        setCurrentStatus(newStatus);
      }

      await fetchPayrolls();
    } catch (err: any) {
      console.error("Status transition failed:", err);
      if (setErrorMsg) setErrorMsg(`Transition failed: ${err.message || err}`);
    } finally {
      setIsActionLoading(null);
    }
  };

  // 7. Local Editor Event Handlers (UI triggers)
  const handleInfoChange = (key: keyof PayrollInfo, value: string) => {
    setPayrollInfo(prev => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  };

  const handleSettingsChange = (key: keyof PayrollSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    if (key === "currency" && value) {
      const code = value as SupportedCurrency;
      const sym = currencySymbols[code] || "R";
      setSettings(prev => ({ ...prev, currency: code, currencySymbol: sym }));
      setCurrencyCode(code);
    }
    setHasUnsavedChanges(true);
  };

  const handleRestoreSettingsDefaults = () => {
    setSettings(defaultSettings());
    setHasUnsavedChanges(true);
    if (setSuccessMsg) {
      setSuccessMsg("Restored default multiplier and UIF settings.");
    }
  };

  const handleUpdateRow = (id: string, updated: Partial<LabourPayrollRow>) => {
    assertOperationalAction("edit", "pages/LabourPayroll/LabourPayrollPage.tsx");
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...updated } : r));
    setHasUnsavedChanges(true);
  };

  const handleAddRow = () => {
    assertOperationalAction("create", "pages/LabourPayroll/LabourPayrollPage.tsx");
    const newId = `row-${Date.now()}`;
    const nextCodeNum = rows.length + 101;
    const newStaff: LabourPayrollRow = {
      id: newId,
      employeeNumber: `EMP-${nextCodeNum}`,
      firstName: "",
      lastName: "",
      idNumber: "",
      jobTitle: "General Worker",
      contactNumber: "",
      bankName: "",
      accountHolder: "",
      accountNumber: "",
      branchCode: "",
      accountType: "Savings",
      payType: "hourly",
      normalHourlyRate: 0,
      normalHours: 0,
      baseSalary: 0,
      overtimeHours: 0,
      sundayHolidayHours: 0,
      otherDeductions: 0
    };
    setRows(prev => [...prev, newStaff]);
    setHasUnsavedChanges(true);
    if (setSuccessMsg) {
      setSuccessMsg("Added a new editable staff row.");
    }
  };

  const handleDuplicateRow = (row: LabourPayrollRow) => {
    const duplicated: LabourPayrollRow = {
      ...row,
      id: `row-${Date.now()}`,
      employeeNumber: `${row.employeeNumber}_COPY`,
      firstName: `${row.firstName} (Copy)`
    };
    setRows(prev => [...prev, duplicated]);
    setHasUnsavedChanges(true);
    if (setSuccessMsg) {
      setSuccessMsg(`Duplicated row for ${row.firstName || "Staff Member"}.`);
    }
  };

  const handleDeleteRow = (id: string) => {
    assertOperationalAction("delete", "pages/LabourPayroll/LabourPayrollPage.tsx");
    setRows(prev => prev.filter(r => r.id !== id));
    setHasUnsavedChanges(true);
    if (setSuccessMsg) {
      setSuccessMsg("Removed staff row successfully.");
    }
  };

  const handleClearRow = (id: string) => {
    setRows(prev => prev.map(r => r.id === id ? {
      ...r,
      normalHourlyRate: 0,
      normalHours: 0,
      baseSalary: 0,
      overtimeHours: 0,
      sundayHolidayHours: 0,
      otherDeductions: 0
    } : r));
    setHasUnsavedChanges(true);
    if (setSuccessMsg) {
      setSuccessMsg("Wiped numeric values for selected row.");
    }
  };

  const handleClearFullPayroll = () => {
    setRows([]);
    setHasUnsavedChanges(true);
    if (setSuccessMsg) {
      setSuccessMsg("Cleared all rows from payroll sheet.");
    }
  };

  // Helper to fetch a complete payroll with its entries
  const getPayrollWithEntries = async (payrollId: string): Promise<any> => {
    // Fetch header
    const { data: header, error: headerError } = await supabase
      .from("labour_payrolls")
      .select("*")
      .eq("id", payrollId)
      .single();

    if (headerError) throw headerError;

    // Fetch entries
    const { data: entries, error: entriesError } = await supabase
      .from("labour_payroll_entries")
      .select("*")
      .eq("payroll_id", payrollId);

    if (entriesError) throw entriesError;

    return {
      ...header,
      entries: entries || []
    };
  };

  const handleGenerateAndStore = async (payrollId: string) => {
    if (!isValidUuid(payrollId)) {
      console.error("Invalid payroll ID:", payrollId);
      if (setErrorMsg) setErrorMsg("This payroll register is missing a valid database ID. Refresh the page and try again.");
      return;
    }

    setIsLoadingRegister(true);
    try {
      const payroll = await getPayrollWithEntries(payrollId);

      const mappedRows: LabourPayrollRow[] = (payroll.entries || []).map((e: any) => ({
        id: e.id,
        employeeNumber: e.employee_number,
        firstName: e.first_name,
        lastName: e.last_name,
        idNumber: e.id_number || "",
        jobTitle: e.staff_category || "General Worker",
        contactNumber: e.contact_number || "",
        payType: e.pay_type ? (e.pay_type.toLowerCase() as "hourly" | "salaried") : "hourly",
        bankName: e.bank_name || "",
        accountHolder: e.account_holder || "",
        accountNumber: e.account_number || "",
        branchCode: e.branch_code || "",
        accountType: e.account_type || "Savings",
        normalHourlyRate: Number(e.normal_hourly_rate) || 0,
        normalHours: Number(e.normal_hours) || 0,
        base_salary: Number(e.base_salary) || 0,
        baseSalary: Number(e.base_salary) || 0,
        overtimeHours: Number(e.overtime_hours) || 0,
        sundayHolidayHours: Number(e.sunday_holiday_hours) || 0,
        otherDeductions: Number(e.other_deductions) || 0
      }));

      const info: PayrollInfo = {
        project: payroll.payroll_title,
        employerName: activeCompany?.name || "Company Name",
        payrollTitle: payroll.payroll_title,
        payrollMonth: payroll.payroll_month,
        payrollYear: payroll.payroll_year,
        startDate: payroll.period_start,
        endDate: payroll.period_end,
        preparedBy: payroll.prepared_by,
        datePrepared: payroll.date_prepared,
        notes: payroll.notes || ""
      };

      const s: PayrollSettings = {
        normalMultiplier: Number(payroll.normal_multiplier) || 1.0,
        overtimeMultiplier: Number(payroll.overtime_multiplier) || 1.5,
        sundayHolidayMultiplier: Number(payroll.sunday_holiday_multiplier) || 2.0,
        uifPercentage: Number(payroll.uif_percentage) || 1.0,
        currency: payroll.currency_code || "ZAR",
        currencySymbol: payroll.currency_symbol || "R",
        decimalPlaces: payroll.decimal_places || 2
      };

      // Generate Excel workbook Blob
      const { blob, filename } = generateExcelBlob(info, s, mappedRows);

      // Upload and register workbook
      await uploadPayrollWorkbook(
        payroll.company_id,
        payroll.project_id,
        payroll.id,
        filename,
        blob,
        payroll.status === "Draft"
      );

      if (setSuccessMsg) {
        setSuccessMsg(`Successfully generated and stored Excel workbook "${filename}" on cloud storage.`);
      }

      // Refresh list
      await fetchPayrolls();
    } catch (e: any) {
      console.error("Generate and store failed:", e);
      if (setErrorMsg) {
        setErrorMsg(`Failed to generate and store Excel workbook: ${e.message || e}`);
      }
    } finally {
      setIsLoadingRegister(false);
    }
  };

  const handleDeleteStoredExcel = async (payrollId: string) => {
    assertOperationalAction("delete", "pages/LabourPayroll/LabourPayrollPage.tsx");
    if (!isValidUuid(payrollId)) {
      console.error("Invalid payroll ID:", payrollId);
      if (setErrorMsg) setErrorMsg("This payroll register is missing a valid database ID. Refresh the page and try again.");
      return;
    }

    setIsLoadingRegister(true);
    try {
      const payrollRecord = await getPayrollWithEntries(payrollId);
      if (payrollRecord.status !== "Draft") {
        if (setErrorMsg) setErrorMsg("Stored workbook deletion is only allowed for Draft registers.");
        return;
      }

      await deletePayrollWorkbook(payrollRecord.id, payrollRecord.excel_storage_path || "");
      if (setSuccessMsg) {
        setSuccessMsg("Successfully deleted Excel workbook from cloud storage.");
      }
      await fetchPayrolls();
    } catch (e: any) {
      console.error(e);
      if (setErrorMsg) {
        setErrorMsg(`Failed to delete stored workbook: ${e.message || e}`);
      }
    } finally {
      setIsLoadingRegister(false);
    }
  };

  const handleDownloadPayroll = async (payrollId: string) => {
    assertOperationalAction("export", "pages/LabourPayroll/LabourPayrollPage.tsx");
    if (!isValidUuid(payrollId)) {
      console.error("Invalid payroll ID:", payrollId);
      if (setErrorMsg) setErrorMsg("This payroll register is missing a valid database ID. Refresh the page and try again.");
      return;
    }

    try {
      const payroll = await getPayrollWithEntries(payrollId);

      if (payroll.excel_storage_path) {
        setIsLoadingRegister(true);
        let downloadUrl = "";
        const isSecure = payroll.status === "Approved" || payroll.status === "Locked";

        if (isSecure) {
          downloadUrl = await createPayrollWorkbookSignedUrl(payroll.excel_storage_path, 600);
        } else {
          const blob = await downloadPayrollWorkbook(payroll.excel_storage_path);
          downloadUrl = URL.createObjectURL(blob);
        }

        const link = document.createElement("a");
        link.href = downloadUrl;
        link.setAttribute("download", payroll.excel_file_name || "Employee_Payroll.xlsx");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (setSuccessMsg) {
          setSuccessMsg(`Successfully downloaded stored Excel workbook "${payroll.excel_file_name}".`);
        }
        return;
      }

      // Fallback: Generate local workbook and trigger browser download
      const mappedRows: LabourPayrollRow[] = (payroll.entries || []).map((e: any) => ({
        id: e.id,
        employeeNumber: e.employee_number,
        firstName: e.first_name,
        lastName: e.last_name,
        idNumber: e.id_number || "",
        jobTitle: e.staff_category || "General Worker",
        contactNumber: e.contact_number || "",
        payType: e.pay_type ? (e.pay_type.toLowerCase() as "hourly" | "salaried") : "hourly",
        bankName: e.bank_name || "",
        accountHolder: e.account_holder || "",
        accountNumber: e.account_number || "",
        branchCode: e.branch_code || "",
        accountType: e.account_type || "Savings",
        normalHourlyRate: Number(e.normal_hourly_rate) || 0,
        normalHours: Number(e.normal_hours) || 0,
        base_salary: Number(e.base_salary) || 0,
        baseSalary: Number(e.base_salary) || 0,
        overtimeHours: Number(e.overtime_hours) || 0,
        sundayHolidayHours: Number(e.sunday_holiday_hours) || 0,
        otherDeductions: Number(e.other_deductions) || 0
      }));

      const info: PayrollInfo = {
        project: payroll.payroll_title,
        employerName: activeCompany?.name || "Company Name",
        payrollTitle: payroll.payroll_title,
        payrollMonth: payroll.payroll_month,
        payrollYear: payroll.payroll_year,
        startDate: payroll.period_start,
        endDate: payroll.period_end,
        preparedBy: payroll.prepared_by,
        datePrepared: payroll.date_prepared,
        notes: payroll.notes || ""
      };

      const s: PayrollSettings = {
        normalMultiplier: Number(payroll.normal_multiplier) || 1.0,
        overtimeMultiplier: Number(payroll.overtime_multiplier) || 1.5,
        sundayHolidayMultiplier: Number(payroll.sunday_holiday_multiplier) || 2.0,
        uifPercentage: Number(payroll.uif_percentage) || 1.0,
        currency: payroll.currency_code || "ZAR",
        currencySymbol: payroll.currency_symbol || "R",
        decimalPlaces: payroll.decimal_places || 2
      };

      exportToExcel(info, s, mappedRows);
      if (setSuccessMsg) setSuccessMsg(`Exported Excel workbook for "${payroll.payroll_title}" successfully.`);
    } catch (e: any) {
      console.error(e);
      if (setErrorMsg) {
        setErrorMsg(`Failed to download stored workbook: ${e.message || e}`);
      }
    } finally {
      setIsLoadingRegister(false);
    }
  };

  // Status Check helpers
  const isReadOnly = currentStatus === "Approved" || currentStatus === "Locked";

  // Calculate stats across all records in the Register
  const totalApprovedPayrollValue = payrolls
    .filter(p => p.status === "Approved" || p.status === "Locked")
    .reduce((sum, p) => sum + (p.netPayroll || 0), 0);

  const pendingApprovalCount = payrolls.filter(p => p.status === "Submitted").length;
  const totalUniqueStaffPaid = payrolls.reduce((sum, p) => sum + (p.staffCount || 0), 0);

  // Filter & Search Saved Payrolls list
  const filteredPayrollsList = payrolls.filter(p => {
    const matchesSearch = p.payroll_title.toLowerCase().includes(registerSearch.toLowerCase()) ||
                          p.prepared_by.toLowerCase().includes(registerSearch.toLowerCase()) ||
                          p.payroll_month.toLowerCase().includes(registerSearch.toLowerCase());
    const matchesStatus = registerFilterStatus === "All" || p.status === registerFilterStatus;
    return matchesSearch && matchesStatus;
  });

  // UI Renders
  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-slate-900/60 border border-slate-800 rounded-3xl p-8 max-w-xl mx-auto shadow-2xl">
        <Briefcase className="w-16 h-16 text-slate-600 mb-4 animate-pulse" />
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-1.5">No Active Project Selected</h3>
        <p className="text-xs text-slate-500 max-w-sm leading-relaxed mb-6">
          To manage personnel records and compile staff labor payroll schedules, please select an active construction project from the top workspace navigation header.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      
      {/* ----------------- LOCAL STORAGE IMPORT BANNER ----------------- */}
      {hasLocalDraft && view === "register" && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-500 rounded-xl">
              <UploadCloud className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h4 className="text-xs font-black text-white uppercase tracking-wider">Browser Cache Draft Detected</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                We found an offline labor payroll worksheet in your local browser cache. Migrate it to Supabase to save it securely forever.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                previewStorage.removeItem(storageKey);
                setHasLocalDraft(false);
                if (setSuccessMsg) setSuccessMsg("Offline cache dismissed successfully.");
              }}
              className="px-3.5 py-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-850 text-slate-400 hover:text-white rounded-xl text-[11px] font-bold cursor-pointer transition-colors"
            >
              Dismiss Cache
            </button>
            <button
              type="button"
              onClick={handleImportLocalDraft}
              className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-[11px] font-black uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1 shadow-md shadow-amber-500/10"
            >
              <FileCheck className="w-4 h-4" />
              Migrate into Cloud
            </button>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------- */}
      {/*                       1. THE REGISTER VIEW                      */}
      {/* --------------------------------------------------------------- */}
      {view === "register" && (
        <div className="space-y-8 animate-fadeIn">
          
          {/* Header */}
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between bg-slate-900/90 border border-slate-800/80 backdrop-blur-md p-6 rounded-2xl shadow-xl">
            <div className="flex min-w-0 items-start gap-4">
              <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-amber-500 shrink-0">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <div className="min-w-0">
                <h1 className="break-words text-xl sm:text-2xl font-black text-white uppercase tracking-tight">Employee Payroll Register</h1>
                <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed break-words">
                  Consolidated ledger registry for active project {activeProject.name}. Submit drafts, audit financial snapshots, and export payrolls securely.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 w-full lg:w-auto items-center gap-3">
              <button
                type="button"
                onClick={handleCreateNewPayroll}
                className="w-full lg:w-auto px-5 h-11 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/10"
              >
                <Plus className="w-4.5 h-4.5" />
                Create New Payroll Period
              </button>
            </div>
          </div>

          {/* Stats Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-lg flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500 border border-blue-500/20 shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Total Staff Paid</span>
                <span className="text-lg font-black text-white">{totalUniqueStaffPaid} Personnel</span>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-lg flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20 shrink-0">
                <PiggyBank className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Approved Net Payout</span>
                <span className="text-lg font-black text-white">{formatPayrollCurrency(totalApprovedPayrollValue, currencyCode)}</span>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-lg flex items-center gap-4">
              <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500 border border-amber-500/20 shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Pending Approval</span>
                <span className="text-lg font-black text-white">{pendingApprovalCount} Periods</span>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-lg flex items-center gap-4">
              <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400 border border-purple-500/20 shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Total Registers</span>
                <span className="text-lg font-black text-white">{payrolls.length} Active Lists</span>
              </div>
            </div>
          </div>

          {/* Filters & Grid Header */}
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-2">
              <h3 className="text-xs font-black tracking-widest text-slate-400 uppercase flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-amber-500" />
                Periods and Wages Registers
              </h3>
              
              {/* Search and filter controls */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Search */}
                <input
                  type="text"
                  placeholder="Search registers..."
                  value={registerSearch}
                  onChange={(e) => setRegisterSearch(e.target.value)}
                  className="px-4 py-2 bg-slate-950 border border-slate-800 focus:border-amber-500 focus:outline-none rounded-xl text-xs font-semibold text-white placeholder-slate-600 w-full sm:w-56"
                />

                {/* Status selector */}
                <div className="flex bg-slate-950 border border-slate-850 p-1 rounded-xl">
                  {["All", "Draft", "Submitted", "Approved", "Locked"].map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setRegisterFilterStatus(st)}
                      className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg cursor-pointer transition-colors ${
                        registerFilterStatus === st 
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Register List */}
            {isLoadingRegister ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-3" />
                <span className="text-xs font-bold uppercase tracking-wider">Synchronizing schemas with Supabase...</span>
              </div>
            ) : filteredPayrollsList.length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {filteredPayrollsList.map(p => {
                  return (
                    <div 
                      key={p.id}
                      className="bg-slate-900/90 border border-slate-850 hover:border-slate-750 p-5 rounded-2xl shadow-md transition-all flex flex-col xl:flex-row xl:items-center justify-between gap-6"
                    >
                      {/* Meta information */}
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <h4 className="text-sm font-black text-white tracking-tight">{p.payroll_title}</h4>
                          
                          {/* Status Badge */}
                          <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase border ${
                            p.status === "Draft" ? "bg-slate-500/10 border-slate-500/25 text-slate-400" :
                            p.status === "Submitted" ? "bg-amber-500/10 border-amber-500/25 text-amber-400 animate-pulse" :
                            p.status === "Approved" ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400" :
                            "bg-cyan-500/10 border-cyan-500/25 text-cyan-400" // Locked
                          }`}>
                            {p.status}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 md:flex md:items-center md:gap-5 text-[11px] text-slate-400 font-semibold flex-wrap">
                          <span className="flex items-center gap-1 shrink-0">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            {p.payroll_month} {p.payroll_year}
                          </span>
                          <span className="hidden md:inline text-slate-700">•</span>
                          <span className="shrink-0">
                            Range: {p.period_start} to {p.period_end}
                          </span>
                          <span className="hidden md:inline text-slate-700">•</span>
                          <span className="shrink-0">
                            Staff Paid: <strong className="text-amber-500 font-black">{p.staffCount || 0} Workers</strong>
                          </span>
                        </div>
                      </div>

                      {/* Calculations / Summary */}
                      <div className="grid grid-cols-2 gap-4 md:flex md:items-center md:gap-8 bg-slate-950/40 border border-slate-850/60 p-3.5 rounded-xl xl:min-w-[320px] justify-between">
                        <div>
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Gross Payroll</span>
                          <span className="text-xs font-black text-slate-300">
                            {formatPayrollCurrency(
                              p.grossPayroll,
                              p.currencyCode,
                              p.currencyLocale,
                              p.decimalPlaces
                            )}
                          </span>
                        </div>
                        <div className="border-l border-slate-800 pl-4 h-8 hidden md:block"></div>
                        <div>
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Net Disbursed</span>
                          <span className="text-xs font-black text-emerald-400">
                            {formatPayrollCurrency(
                              p.netPayroll,
                              p.currencyCode,
                              p.currencyLocale,
                              p.decimalPlaces
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3 xl:justify-end shrink-0">
                        {/* Status selector */}
                        <div className="relative shrink-0">
                          {isActionLoading === p.id ? (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-[10px] font-black uppercase text-slate-400">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                              <span>Updating...</span>
                            </div>
                          ) : (
                            <div className="relative">
                              <select
                                disabled={!isManager}
                                value={p.status}
                                onChange={(e) => handleUpdateStatus(p.id, e.target.value)}
                                className={`appearance-none cursor-pointer pl-3 pr-8 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border outline-none transition-all ${
                                  p.status === "Draft" ? "bg-slate-500/10 border-slate-500/25 text-slate-400 hover:bg-slate-500/20" :
                                  p.status === "Submitted" ? "bg-amber-500/10 border-amber-500/25 text-amber-400 hover:bg-amber-500/20" :
                                  p.status === "Approved" ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/20" :
                                  "bg-purple-500/10 border-purple-500/25 text-purple-400 hover:bg-purple-500/20" // Locked
                                } ${!isManager ? "cursor-not-allowed opacity-75" : ""}`}
                                style={{
                                  backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${
                                    p.status === "Draft" ? "%2394a3b8" :
                                    p.status === "Submitted" ? "%23fbbf24" :
                                    p.status === "Approved" ? "%2334d399" :
                                    "%23c084fc"
                                  }' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                                  backgroundPosition: "right 8px center",
                                  backgroundSize: "12px",
                                  backgroundRepeat: "no-repeat"
                                }}
                              >
                                <option value="Draft" disabled={p.status !== "Draft" && p.status !== "Submitted"} className="bg-slate-900 text-slate-400 font-bold uppercase text-xs">
                                  Draft
                                </option>
                                <option value="Submitted" disabled={p.status !== "Draft" && p.status !== "Submitted" && p.status !== "Approved"} className="bg-slate-900 text-amber-400 font-bold uppercase text-xs">
                                  Submitted
                                </option>
                                <option value="Approved" disabled={(p.status !== "Submitted" && p.status !== "Approved" && p.status !== "Locked") || !isCompanyAdmin} className="bg-slate-900 text-emerald-400 font-bold uppercase text-xs">
                                  Approved
                                </option>
                                <option value="Locked" disabled={(p.status !== "Approved" && p.status !== "Locked") || !isCompanyAdmin} className="bg-slate-900 text-purple-400 font-bold uppercase text-xs">
                                  Locked
                                </option>
                              </select>
                            </div>
                          )}
                        </div>

                        {/* View or Edit */}
                        <button
                          type="button"
                          onClick={() => handleEditPayroll(p.id)}
                          className="px-4 py-2 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-200 hover:text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                        >
                          Edit Sheet
                        </button>

                        {/* Delete Draft only */}
                        {p.status === "Draft" && (
                          <button
                            type="button"
                            onClick={() => setPendingDeletePayrollId(p.id)}
                            className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-red-400 hover:text-red-300 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center shrink-0"
                            title="Delete Draft"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-slate-900/40 border border-slate-850 border-dashed rounded-3xl p-8 max-w-xl mx-auto">
                <FileSpreadsheet className="w-12 h-12 text-slate-600 mb-3 animate-pulse" />
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">No Payroll Registers</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed mb-5">
                  There are no payroll schedules recorded for project {activeProject.name}. Start by creating a new period structure.
                </p>
                <button
                  type="button"
                  onClick={handleCreateNewPayroll}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl uppercase tracking-wider cursor-pointer"
                >
                  Create New Period
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------- */}
      {/*                       2. THE EDITOR VIEW                        */}
      {/* --------------------------------------------------------------- */}
      {view === "editor" && (
        <div className="space-y-8 animate-fadeIn">
          
          {/* Breadcrumb Navigation & Action bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900/95 border border-slate-800/90 backdrop-blur-md p-5 rounded-2xl shadow-xl">
            <div className="flex items-center gap-4 flex-wrap">
              <button
                type="button"
                onClick={async () => {
                  if (hasUnsavedChanges) {
                    if (!confirm("You have unsaved worksheet edits! Are you sure you want to exit to the register without saving?")) {
                      return;
                    }
                  }
                  setView("register");
                  setSelectedPayrollId(null);
                  setHasUnsavedChanges(false);
                  await fetchPayrolls();
                }}
                className="px-3 py-2 bg-slate-950 hover:bg-slate-850 border border-slate-850 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-amber-500" />
                Back to Register
              </button>
              
              <div className="border-l border-slate-800 h-6 hidden sm:block"></div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black text-white uppercase tracking-tight">{payrollInfo.payrollTitle || "Active Period Details"}</h2>
                  
                  {/* Status Indicator Badge */}
                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase border ${
                    currentStatus === "Draft" ? "bg-slate-500/10 border-slate-500/25 text-slate-400" :
                    currentStatus === "Submitted" ? "bg-amber-500/10 border-amber-500/25 text-amber-400 animate-pulse" :
                    currentStatus === "Approved" ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400" :
                    "bg-cyan-500/10 border-cyan-500/25 text-cyan-400"
                  }`}>
                    {currentStatus}
                  </span>
                </div>
                
                {/* Cloud Saving Indicator */}
                <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
                  {isSaving ? (
                    <span className="text-amber-500 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Saving changes to database...
                    </span>
                  ) : hasUnsavedChanges ? (
                    <span className="text-amber-400/80">⚠️ Unsaved local edits detected</span>
                  ) : (
                    <span className="text-emerald-500">✓ All edits safely secured in cloud</span>
                  )}
                </span>
              </div>
            </div>

            {/* Actions Panel */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Save Draft/Edits (Disabled if Approved/Locked) */}
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={handleSavePayroll}
                  disabled={isSaving}
                  className="px-4 py-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-amber-500" />}
                  Save Worksheet
                </button>
              )}

              {/* Status Action Buttons for Managers */}
              {isManager && selectedPayrollId && (
                <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
                  {currentStatus === "Draft" && (
                    <button
                      type="button"
                      onClick={async () => {
                        // Save first to avoid loss
                        await handleSavePayroll();
                        await handleUpdateStatus(selectedPayrollId, "Submitted");
                      }}
                      className="px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:text-amber-300 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      Submit for Approval
                    </button>
                  )}

                  {currentStatus === "Submitted" && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(selectedPayrollId, "Approved")}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <UserCheck className="w-4 h-4" />
                        Approve Payroll
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(selectedPayrollId, "Draft")}
                        className="px-3.5 py-2.5 bg-slate-950 border border-slate-850 hover:border-slate-750 text-slate-400 hover:text-white rounded-xl text-xs font-semibold cursor-pointer"
                      >
                        Revert to Draft
                      </button>
                    </>
                  )}

                  {currentStatus === "Approved" && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(selectedPayrollId, "Locked")}
                        className="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Lock className="w-4 h-4" />
                        Lock Register
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(selectedPayrollId, "Draft")}
                        className="px-3.5 py-2.5 bg-slate-950 border border-slate-850 hover:border-slate-750 text-slate-400 hover:text-white rounded-xl text-xs font-semibold cursor-pointer"
                      >
                        Reopen to Draft
                      </button>
                    </>
                  )}

                  {currentStatus === "Locked" && (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(selectedPayrollId, "Approved")}
                      className="px-4 py-2.5 bg-slate-950 hover:bg-slate-850 border border-slate-850 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <Unlock className="w-4 h-4 text-slate-500" />
                      Unlock Register
                    </button>
                  )}
                </div>
              )}

              {/* Download Excel */}
              <button
                type="button"
                onClick={() => {
                  const hasInvalidRows = rows.some(r => !(r.firstName || "").trim() || !(r.lastName || "").trim() || !(r.employeeNumber || "").trim());
                  try {
                    exportToExcel(payrollInfo, settings, rows);
                    if (setSuccessMsg) {
                      setSuccessMsg(
                        hasInvalidRows 
                          ? "Excel compiled with warnings! Note that some employee fields are blank."
                          : "Successfully compiled and downloaded Excel spreadsheet."
                      );
                    }
                  } catch (e: any) {
                    console.error(e);
                    if (setErrorMsg) setErrorMsg(`Export failed: ${e.message || e}`);
                  }
                }}
                className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-slate-950 font-black text-xs rounded-xl uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-emerald-500/10"
              >
                <ArrowDownToLine className="w-4.5 h-4.5" />
                Download Excel
              </button>
            </div>
          </div>

          {/* Read-Only State Alerts */}
          {isReadOnly && (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-start gap-3">
              <Lock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-black text-white uppercase tracking-wider">
                  {currentStatus === "Approved" ? "Approved Worksheet Locked" : "Locked & Archived"}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  This payroll schedule has been officially {currentStatus.toLowerCase()} and is frozen to maintain auditing integrity. Values cannot be changed unless an authorized manager reopens it.
                </p>
              </div>
            </div>
          )}

          {/* 2. Editable Info and settings in balanced twin column grid (1fr 1fr) */}
          <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
            <PayrollInformationCard info={payrollInfo} onChange={handleInfoChange} readOnly={isReadOnly} />
            <PayrollSettingsCard 
              settings={settings} 
              onChange={handleSettingsChange} 
              onRestoreDefaults={handleRestoreSettingsDefaults} 
              readOnly={isReadOnly}
            />
          </div>

          {/* 3. Aggregated Summary cards */}
          <PayrollSummaryCards rows={rows} settings={settings} />

          {/* 4. Dense Excel simulator table */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-xs font-black tracking-widest text-slate-400 uppercase">
                Active Staff Ledger
              </h3>
            </div>
            <LabourPayrollTable
              rows={rows}
              settings={settings}
              onUpdateRow={handleUpdateRow}
              onAddRow={handleAddRow}
              onDuplicateRow={handleDuplicateRow}
              onDeleteRow={handleDeleteRow}
              onClearRow={handleClearRow}
              onClearFullPayroll={handleClearFullPayroll}
              readOnly={isReadOnly}
            />
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Deletion */}
      <AnimatePresence>
        {pendingDeletePayrollId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPendingDeletePayrollId(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            
            {/* Modal Body */}
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Confirm Deletion</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Are you sure you want to permanently delete this payroll register? All entries and records under this schedule will be completely wiped. This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPendingDeletePayrollId(null)}
                  className="px-4 py-2 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-750 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeletePayroll}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Delete Permanently
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
