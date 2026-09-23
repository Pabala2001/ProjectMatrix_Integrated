import { previewStorage } from "../../integration/previewStorage";
import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { 
  ShieldAlert, 
  Building2, 
  Coins, 
  Leaf, 
  Plus, 
  Calendar, 
  Filter, 
  X, 
  AlertCircle, 
  TrendingUp, 
  CheckCircle2, 
  Trash2, 
  Eye, 
  Edit2, 
  FileText, 
  ChevronRight, 
  Paperclip, 
  SlidersHorizontal,
  FolderOpen,
  DollarSign,
  FileSpreadsheet
} from "lucide-react";
import { supabase, isApiKeyError } from "../../lib/supabase";
import { validateTenantContext } from "../../utils/tenantGuard";
import * as XLSX from "xlsx";
import { useRegionalSettings } from "../../hooks/useRegionalSettings";
import { currencySymbols } from "../../config/currencies";
import InventoryStatusView from "../../components/inventory/InventoryStatusView";

// Types
export type ProcurementCategory = "OHS" | "Site Establishment" | "Operational Costs" | "Environmental" | "all";

export interface ProcurementItem {
  id: string;
  company_id: string;
  project_id: string;
  category: ProcurementCategory;
  subcategory: string;
  item_name: string;
  supplier_name: string;
  quotation_number: string;
  procurement_date: string; // YYYY-MM-DD
  required_by_date: string; // YYYY-MM-DD
  quantity: number;
  unit: string;
  unit_rate: number;
  vat_percentage: number;
  amount_excl_vat: number;
  vat_amount: number;
  total_amount: number;
  status: "Pending" | "Quotation Received" | "Approved" | "Procured" | "Delivered" | "Paid" | "Cancelled";
  priority: "Low" | "Medium" | "High" | "Critical";
  notes: string;
  quotation_file_path?: string | null;
  quotation_file_name?: string | null;
  quotation_file_type?: string | null;
  quotation_file_size?: number | null;
  proof_of_payment_path?: string | null;
  proof_of_payment_file_name?: string | null;
  proof_of_payment_file_type?: string | null;
  proof_of_payment_file_size?: number | null;
  paid_at?: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  programme_id?: string | null;
  programme_activity_id?: string | null;
}

const monthsList = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" }
];

export default function ProcurementPage() {
  const { activeProject, activeCompany, profile } = useOutletContext<any>() || {};
  const { currencyCode, formatCurrency: globalFormatCurrency, getTodayInTimezone } = useRegionalSettings();

  // State
  const [items, setItems] = useState<ProcurementItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Programme Linkage States
  const [programmes, setProgrammes] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [selectedProgrammeId, setSelectedProgrammeId] = useState<string>("");
  const [selectedActivityId, setSelectedActivityId] = useState<string>("");
  const [dbProgrammeLinkageExists, setDbProgrammeLinkageExists] = useState<boolean>(true);
  
  // Export states
  const [exportMonth, setExportMonth] = useState<number>(new Date().getMonth() + 1); // 1-12
  const [exportYear, setExportYear] = useState<number>(new Date().getFullYear());
  const [isExporting, setIsExporting] = useState<boolean>(false);
  
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<ProcurementItem | null>(null);
  const [viewingItem, setViewingItem] = useState<ProcurementItem | null>(null);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);
  
  // Form Field States
  const [category, setCategory] = useState<ProcurementCategory>("OHS");
  const [subcategory, setSubcategory] = useState<string>("");
  const [itemName, setItemName] = useState<string>("");
  const [supplierName, setSupplierName] = useState<string>("");
  const [quotationNumber, setQuotationNumber] = useState<string>("");
  const [procurementDate, setProcurementDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [requiredByDate, setRequiredByDate] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [unit, setUnit] = useState<string>("Each");
  const [unitRate, setUnitRate] = useState<number>(0);
  const [vatPercentage, setVatPercentage] = useState<number>(15);
  const [status, setStatus] = useState<ProcurementItem["status"]>("Pending");
  const [priority, setPriority] = useState<ProcurementItem["priority"]>("Medium");
  const [notes, setNotes] = useState<string>("");
  
  // File state
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [quotationFile, setQuotationFile] = useState<{ name: string; size: string } | null>(null);
  const [selectedProofOfPaymentFile, setSelectedProofOfPaymentFile] = useState<File | null>(null);
  const [proofOfPaymentFileState, setProofOfPaymentFileState] = useState<{ name: string; size: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  
  // Validation / Toast feedback
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Controlled deletion state
  const [pendingDeleteRecord, setPendingDeleteRecord] = useState<ProcurementItem | null>(null);
  const [pendingDeleteForecast, setPendingDeleteForecast] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Active Tab Selector
  const [activeTab, setActiveTab] = useState<"ledger" | "forecast" | "inventory-status">("ledger");

  // Forecast states
  const [forecasts, setForecasts] = useState<any[]>([]);
  const [forecastLoading, setForecastLoading] = useState<boolean>(false);
  const [dbForecastExists, setDbForecastExists] = useState<boolean | null>(null);
  const [forecastYearFilter, setForecastYearFilter] = useState<number>(new Date().getFullYear());
  const [isForecastFormOpen, setIsForecastFormOpen] = useState<boolean>(false);
  const [editingForecast, setEditingForecast] = useState<any | null>(null);

  // Forecast Form fields
  const [fcMonth, setFcMonth] = useState<number>(new Date().getMonth() + 1);
  const [fcYear, setFcYear] = useState<number>(new Date().getFullYear());
  const [fcCategory, setFcCategory] = useState<string>("OHS");
  const [fcExclVat, setFcExclVat] = useState<number>(0);
  const [fcVat, setFcVat] = useState<number>(0);
  const [fcTotal, setFcTotal] = useState<number>(0);
  const [fcNotes, setFcNotes] = useState<string>("");

  // Auto calculate total spend on forecast when excluding VAT or VAT changes
  useEffect(() => {
    setFcTotal(Number(fcExclVat) + Number(fcVat));
  }, [fcExclVat, fcVat]);

  const handleExclVatChange = (val: number) => {
    setFcExclVat(val);
    const calculatedVat = Math.round(val * 15) / 100; // default to 15% South African VAT
    setFcVat(calculatedVat);
  };

  // Fetch forecast records from Supabase, or fall back to localStorage
  const fetchForecasts = useCallback(async () => {
    if (!activeCompany?.id || !activeProject?.id || activeProject.company_id !== activeCompany.id) {
      setForecasts([]);
      return;
    }
    setForecastLoading(true);
    try {
      const { data, error } = await supabase
        .from("procurement_forecasts")
        .select("*")
        .eq("company_id", activeProject.company_id)
        .eq("project_id", activeProject.id)
        .order("forecast_year", { ascending: true })
        .order("forecast_month", { ascending: true });

      if (error) {
        if (error.code === "PGRST116" || error.message?.includes("relation") || error.message?.includes("does not exist") || isApiKeyError(error)) {
          setDbForecastExists(false);
          const localData = previewStorage.getItem(`forecasts_${activeCompany.id}_${activeProject.id}`);
          if (localData) {
            setForecasts(JSON.parse(localData));
          } else {
            setForecasts([]);
          }
        } else {
          showToast("Error loading forecasts: " + error.message);
        }
      } else {
        setDbForecastExists(true);
        setForecasts(data || []);
      }
    } catch (err: any) {
      console.error("Forecast loading error, falling back to local state:", err);
      setDbForecastExists(false);
      const localData = previewStorage.getItem(`forecasts_${activeCompany.id}_${activeProject.id}`);
      if (localData) {
        setForecasts(JSON.parse(localData));
      } else {
        setForecasts([]);
      }
    } finally {
      setForecastLoading(false);
    }
  }, [activeCompany?.id, activeProject?.id]);

  useEffect(() => {
    fetchForecasts();
  }, [fetchForecasts]);

  // Open the Forecast modal
  const handleOpenForecastForm = (item: any | null = null) => {
    if (item) {
      setEditingForecast(item);
      setFcMonth(item.forecast_month);
      setFcYear(item.forecast_year);
      setFcCategory(item.category);
      setFcExclVat(item.forecast_amount_excl_vat || 0);
      setFcVat(item.forecast_vat || 0);
      setFcTotal(item.forecast_total_amount || 0);
      setFcNotes(item.notes || "");
    } else {
      setEditingForecast(null);
      setFcMonth(new Date().getMonth() + 1);
      setFcYear(forecastYearFilter);
      setFcCategory("OHS");
      setFcExclVat(0);
      setFcVat(0);
      setFcTotal(0);
      setFcNotes("");
    }
    setIsForecastFormOpen(true);
  };

  // Save single forecast item
  const handleSaveForecast = async (e: React.FormEvent) => {
    assertOperationalAction("write", "pages/Procurement/ProcurementPage.tsx");
    e.preventDefault();
    try {
      validateTenantContext(activeCompany, activeProject, profile);
    } catch (err: any) {
      showToast(err.message);
      return;
    }

    const payload = {
      company_id: activeProject.company_id,
      project_id: activeProject.id,
      forecast_month: fcMonth,
      forecast_year: fcYear,
      category: fcCategory,
      forecast_amount_excl_vat: Number(fcExclVat),
      forecast_vat: Number(fcVat),
      forecast_total_amount: Number(fcExclVat) + Number(fcVat),
      notes: fcNotes,
    };

    try {
      if (dbForecastExists) {
        if (editingForecast) {
          const { error } = await supabase
            .from("procurement_forecasts")
            .update(payload)
            .eq("id", editingForecast.id);
          if (error) throw error;
          showToast("Forecast row updated successfully in database.");
        } else {
          const { error } = await supabase
            .from("procurement_forecasts")
            .insert([payload]);
          if (error) throw error;
          showToast("Forecast row added successfully to database.");
        }
        fetchForecasts();
      } else {
        let updatedList = [...forecasts];
        if (editingForecast) {
          updatedList = updatedList.map(item => 
            item.id === editingForecast.id ? { ...item, ...payload } : item
          );
          showToast("Forecast row updated in local storage.");
        } else {
          const newItem = {
            id: "local_" + Math.random().toString(36).substr(2, 9),
            created_at: new Date().toISOString(),
            ...payload
          };
          updatedList.push(newItem);
          showToast("Forecast row added to local storage.");
        }
        setForecasts(updatedList);
        previewStorage.setItem(`forecasts_${activeCompany.id}_${activeProject.id}`, JSON.stringify(updatedList));
      }
      setIsForecastFormOpen(false);
      setEditingForecast(null);
    } catch (err: any) {
      showToast("Error saving forecast: " + err.message);
    }
  };

  // Delete single forecast item
  const handleDeleteForecast = (f: any) => {
    assertOperationalAction("delete", "pages/Procurement/ProcurementPage.tsx");
    setPendingDeleteForecast(f);
  };

  const confirmDeleteForecastRecord = async () => {
    const f = pendingDeleteForecast;
    if (!f) return;

    setIsDeleting(true);
    try {
      if (dbForecastExists && !String(f.id).startsWith("local_")) {
        const { error } = await supabase
          .from("procurement_forecasts")
          .delete()
          .eq("id", f.id);
        if (error) throw error;
        showToast("Forecast row deleted from database.");
        fetchForecasts();
      } else {
        const updatedList = forecasts.filter(item => item.id !== f.id);
        setForecasts(updatedList);
        if (activeCompany?.id && activeProject?.id) {
          previewStorage.setItem(`forecasts_${activeCompany.id}_${activeProject.id}`, JSON.stringify(updatedList));
        }
        showToast("Forecast row deleted from local storage.");
      }
      setPendingDeleteForecast(null);
    } catch (err: any) {
      console.error("Forecast delete failed:", err);
      showToast("Error deleting forecast: " + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper to format bytes to user friendly size string
  const formatBytes = (bytes: number | null | undefined): string => {
    if (!bytes) return "";
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Helper to sanitize file names
  const sanitizeFileName = (name: string): string => {
    const lastDotIndex = name.lastIndexOf(".");
    const baseName = lastDotIndex !== -1 ? name.substring(0, lastDotIndex) : name;
    const ext = lastDotIndex !== -1 ? name.substring(lastDotIndex + 1) : "";
    const sanitizedBase = baseName
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9-_]/g, "");
    return ext ? `${sanitizedBase}.${ext}` : sanitizedBase;
  };

  // Fetch Items from Supabase
  const fetchItems = async () => {
    setIsLoading(true);
    try {
      if (!activeCompany?.id || !activeProject?.id || activeProject.company_id !== activeCompany.id) {
        setItems([]);
        setIsLoading(false);
        return;
      }
      
      const { data, error } = await supabase
        .from("procurement_items")
        .select("*")
        .eq("company_id", activeProject.company_id)
        .eq("project_id", activeProject.id)
        .order("procurement_date", { ascending: false });

      if (error) {
        if (isApiKeyError(error)) {
          console.warn("Supabase API key unconfigured when loading procurement items.");
          setItems([]);
        } else {
          showToast("Error loading procurement items: " + error.message);
          console.error("Supabase Select Error:", error);
        }
      } else {
        setItems(data || []);
      }
    } catch (err: any) {
      showToast("An unexpected error occurred: " + err.message);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Linkage data from Supabase
  const fetchLinkageData = useCallback(async () => {
    if (!activeCompany?.id || !activeProject?.id || activeProject.company_id !== activeCompany.id) {
      setProgrammes([]);
      setActivities([]);
      return;
    }
    try {
      // 1. Fetch programmes
      const { data: progs, error: progsError } = await supabase
        .from("programmes")
        .select("*")
        .eq("company_id", activeProject.company_id)
        .eq("project_id", activeProject.id)
        .order("programme_name", { ascending: true });

      if (progsError) {
        if (!isApiKeyError(progsError)) {
          console.error("Error loading programmes for linkage:", progsError);
        }
        return;
      }

      setProgrammes(progs || []);

      // 2. Fetch activities of those programmes
      if (progs && progs.length > 0) {
        const progIds = progs.map(p => p.id);
        const { data: acts, error: actsError } = await supabase
          .from("programme_activities")
          .select("*")
          .in("programme_id", progIds)
          .order("sort_order", { ascending: true });

        if (actsError) {
          if (!isApiKeyError(actsError)) {
            console.error("Error loading activities for linkage:", actsError);
          }
        } else {
          setActivities(acts || []);
        }
      } else {
        setActivities([]);
      }

      // 3. Check if columns exist in procurement_items
      const { error: columnCheckError } = await supabase
        .from("procurement_items")
        .select("programme_id, programme_activity_id")
        .limit(1);

      if (columnCheckError) {
        setDbProgrammeLinkageExists(false);
      } else {
        setDbProgrammeLinkageExists(true);
      }

    } catch (err) {
      if (!isApiKeyError(err)) {
        console.error("Failed to load linkage data:", err);
      }
    }
  }, [activeCompany?.id, activeProject?.id]);

  const enrichedItems = React.useMemo(() => {
    if (dbProgrammeLinkageExists) return items;
    if (!activeCompany?.id || !activeProject?.id) return items;
    const localKey = `procurement_linkages_${activeCompany.id}_${activeProject.id}`;
    const localData = previewStorage.getItem(localKey);
    if (!localData) return items;
    try {
      const linkageMap = JSON.parse(localData);
      return items.map(item => {
        const linkage = linkageMap[item.id];
        if (linkage) {
          return {
            ...item,
            programme_id: linkage.programme_id,
            programme_activity_id: linkage.programme_activity_id
          };
        }
        return item;
      });
    } catch {
      return items;
    }
  }, [items, dbProgrammeLinkageExists, activeCompany?.id, activeProject?.id]);

  // Fetch items when context changes
  useEffect(() => {
    fetchItems();
    fetchLinkageData();
  }, [activeCompany?.id, activeProject?.id, fetchLinkageData]);

  // Prevent page scroll when modal is open
  useEffect(() => {
    if (isFormOpen || viewingItem || isForecastFormOpen) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => {
      document.body.classList.remove("overflow-hidden");
    };
  }, [isFormOpen, viewingItem, isForecastFormOpen]);

  // Dynamic Subcategory Options
  const getSubcategories = (cat: ProcurementCategory): string[] => {
    if (cat === "all") {
      const allCats: ProcurementCategory[] = ["OHS", "Site Establishment", "Operational Costs", "Environmental"];
      const allSubs = allCats.flatMap(c => {
        switch (c) {
          case "Site Establishment":
            return ["Fixed Cost", "Running Cost"];
          case "Operational Costs":
            return ["Subcontractor", "Plant Hire", "Equipment Hire", "Transport", "Fuel", "Other"];
          case "OHS":
            return ["PPE", "Signage", "First Aid", "Safety File", "Training", "Other"];
          case "Environmental":
            return ["Waste Disposal", "Dust Control", "Environmental Monitoring", "Permits", "Rehabilitation", "Other"];
          default:
            return [];
        }
      });
      return Array.from(new Set(allSubs))
        .filter(sub => sub && sub.trim() !== "")
        .sort((a, b) => a.localeCompare(b));
    }
    switch (cat) {
      case "Site Establishment":
        return ["Fixed Cost", "Running Cost"];
      case "Operational Costs":
        return ["Subcontractor", "Plant Hire", "Equipment Hire", "Transport", "Fuel", "Other"];
      case "OHS":
        return ["PPE", "Signage", "First Aid", "Safety File", "Training", "Other"];
      case "Environmental":
        return ["Waste Disposal", "Dust Control", "Environmental Monitoring", "Permits", "Rehabilitation", "Other"];
      default:
        return [];
    }
  };

  // Set default subcategory whenever category changes
  useEffect(() => {
    const subs = getSubcategories(category);
    if (subs.length > 0 && !subs.includes(subcategory)) {
      setSubcategory(subs[0]);
    }
  }, [category]);

  // Open modal for new item
  const handleOpenNewForm = (preselectedCategory?: ProcurementCategory) => {
    setEditingItem(null);
    setFormError(null);
    setSelectedUploadFile(null);
    setSelectedProofOfPaymentFile(null);
    
    // Set default field states
    setCategory(preselectedCategory || "OHS");
    setSubcategory(getSubcategories(preselectedCategory || "OHS")[0]);
    setItemName("");
    setSupplierName("");
    setQuotationNumber("");
    setProcurementDate(new Date().toISOString().split("T")[0]);
    setRequiredByDate("");
    setQuantity(1);
    setUnit("Each");
    setUnitRate(0);
    setVatPercentage(15);
    setStatus("Pending");
    setPriority("Medium");
    setNotes("");
    setQuotationFile(null);
    setProofOfPaymentFileState(null);

    setSelectedProgrammeId("");
    setSelectedActivityId("");
    
    setIsFormOpen(true);
  };

  // Open modal for editing
  const handleOpenEditForm = (item: ProcurementItem) => {
    setEditingItem(item);
    setFormError(null);
    setSelectedUploadFile(null);
    setSelectedProofOfPaymentFile(null);
    
    setCategory(item.category);
    setSubcategory(item.subcategory);
    setItemName(item.item_name);
    setSupplierName(item.supplier_name);
    setQuotationNumber(item.quotation_number);
    setProcurementDate(item.procurement_date);
    setRequiredByDate(item.required_by_date || "");
    setQuantity(item.quantity);
    setUnit(item.unit);
    setUnitRate(item.unit_rate);
    setVatPercentage(item.vat_percentage);
    setStatus(item.status);
    setPriority(item.priority);
    setNotes(item.notes);
    setQuotationFile(item.quotation_file_name ? { name: item.quotation_file_name, size: formatBytes(item.quotation_file_size) } : null);
    setProofOfPaymentFileState(item.proof_of_payment_file_name ? { name: item.proof_of_payment_file_name, size: formatBytes(item.proof_of_payment_file_size) } : null);

    setSelectedProgrammeId(item.programme_id || "");
    setSelectedActivityId(item.programme_activity_id || "");
    
    setIsFormOpen(true);
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = [
        "application/pdf", 
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "image/png", 
        "image/jpeg", 
        "image/jpg"
      ];
      
      const fileExt = file.name.split(".").pop()?.toLowerCase();
      const allowedExts = ["pdf", "docx", "xlsx", "png", "jpg", "jpeg"];
      
      if (!allowedTypes.includes(file.type) && !allowedExts.includes(fileExt || "")) {
        setFormError("Unsupported file type. Please upload PDF, DOCX, XLSX, PNG, or JPEG.");
        return;
      }

      setSelectedUploadFile(file);
      setQuotationFile({ name: file.name, size: formatBytes(file.size) });
      console.log("Selected Quotation File Metadata:", {
        fileName: file.name,
        fileType: file.type,
        fileSizeRaw: file.size,
        lastModified: new Date(file.lastModified).toISOString()
      });
      setFormError(null);
    }
  };

  // Handle proof of payment file selection
  const handleProofOfPaymentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = [
        "application/pdf", 
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "image/png", 
        "image/jpeg", 
        "image/jpg"
      ];
      
      const fileExt = file.name.split(".").pop()?.toLowerCase();
      const allowedExts = ["pdf", "docx", "xlsx", "png", "jpg", "jpeg"];
      
      if (!allowedTypes.includes(file.type) && !allowedExts.includes(fileExt || "")) {
        setFormError("Unsupported file type. Please upload PDF, DOCX, XLSX, PNG, or JPEG.");
        return;
      }

      setSelectedProofOfPaymentFile(file);
      setProofOfPaymentFileState({ name: file.name, size: formatBytes(file.size) });
      setFormError(null);
    }
  };

  // Calculations
  const amountExclVat = Number((quantity * unitRate).toFixed(2));
  const vatAmount = Number((amountExclVat * (vatPercentage / 100)).toFixed(2));
  const totalAmountInclVat = Number((amountExclVat + vatAmount).toFixed(2));

  // Form Submit (Save Procurement Item to Supabase)
  const handleSaveItem = async (e: React.FormEvent) => {
    assertOperationalAction("write", "pages/Procurement/ProcurementPage.tsx");
    e.preventDefault();
    setFormError(null);
    try {
      validateTenantContext(activeCompany, activeProject, profile);
    } catch (err: any) {
      setFormError(err.message);
      return;
    }
    setIsSubmitting(true);

    // Validation
    if (!itemName.trim()) {
      setFormError("Item / Service Name is required.");
      setIsSubmitting(false);
      return;
    }
    if (!supplierName.trim()) {
      setFormError("Supplier / Contractor Name is required.");
      setIsSubmitting(false);
      return;
    }
    if (!procurementDate) {
      setFormError("Procurement Date is required.");
      setIsSubmitting(false);
      return;
    }
    if (quantity <= 0) {
      setFormError("Quantity must be greater than zero.");
      setIsSubmitting(false);
      return;
    }
    if (unitRate < 0) {
      setFormError("Unit Rate cannot be negative.");
      setIsSubmitting(false);
      return;
    }

    // Proof of Payment validation
    const needsProofOfPayment = ["Procured", "Delivered", "Paid"].includes(status);
    const hasPoPFile = selectedProofOfPaymentFile || (editingItem && editingItem.proof_of_payment_path);
    if (needsProofOfPayment && !hasPoPFile) {
      setFormError("Proof of payment is required when an item is procured, delivered, or paid.");
      setIsSubmitting(false);
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const loggedInUserId = user?.id || null;

      if (editingItem) {
        // Edit record
        let updatedFilePath = editingItem.quotation_file_path;
        let updatedFileName = editingItem.quotation_file_name;
        let updatedFileType = editingItem.quotation_file_type;
        let updatedFileSize = editingItem.quotation_file_size;

        if (selectedUploadFile) {
          // If replacement quotation is selected:
          // 1. Delete old file from storage if it exists
          if (editingItem.quotation_file_path) {
            const { error: removeError } = await supabase.storage
              .from("procurement-quotations")
              .remove([editingItem.quotation_file_path]);
            if (removeError) {
              console.warn("Could not delete old quotation file:", removeError.message);
            }
          }

          // 2. Upload new file
          const sanitizedName = sanitizeFileName(selectedUploadFile.name);
          const storagePath = `${activeProject.company_id}/${activeProject.id}/${editingItem.id}/quotation/${sanitizedName}`;

          const { error: uploadError } = await supabase.storage
            .from("procurement-quotations")
            .upload(storagePath, selectedUploadFile, {
              cacheControl: "3600",
              upsert: true
            });

          if (uploadError) {
            setFormError(uploadError.message);
            setIsSubmitting(false);
            return;
          }

          updatedFilePath = storagePath;
          updatedFileName = selectedUploadFile.name;
          updatedFileType = selectedUploadFile.type;
          updatedFileSize = selectedUploadFile.size;
        }

        let updatedPoPPath = editingItem.proof_of_payment_path;
        let updatedPoPName = editingItem.proof_of_payment_file_name;
        let updatedPoPType = editingItem.proof_of_payment_file_type;
        let updatedPoPSize = editingItem.proof_of_payment_file_size;

        if (selectedProofOfPaymentFile) {
          // If replacement proof of payment is selected:
          // 1. Delete old file from storage if it exists
          if (editingItem.proof_of_payment_path) {
            const { error: removeError } = await supabase.storage
              .from("procurement-quotations")
              .remove([editingItem.proof_of_payment_path]);
            if (removeError) {
              console.warn("Could not delete old proof of payment file:", removeError.message);
            }
          }

          // 2. Upload new file
          const sanitizedPoPName = sanitizeFileName(selectedProofOfPaymentFile.name);
          const popStoragePath = `${activeProject.company_id}/${activeProject.id}/${editingItem.id}/proof-of-payment/${sanitizedPoPName}`;

          const { error: uploadError } = await supabase.storage
            .from("procurement-quotations")
            .upload(popStoragePath, selectedProofOfPaymentFile, {
              cacheControl: "3600",
              upsert: true
            });

          if (uploadError) {
            setFormError(uploadError.message);
            setIsSubmitting(false);
            return;
          }

          updatedPoPPath = popStoragePath;
          updatedPoPName = selectedProofOfPaymentFile.name;
          updatedPoPType = selectedProofOfPaymentFile.type;
          updatedPoPSize = selectedProofOfPaymentFile.size;
        }

        const updatePayload: any = {
          category,
          subcategory,
          item_name: itemName.trim(),
          supplier_name: supplierName.trim(),
          quotation_number: quotationNumber.trim() || "N/A",
          procurement_date: procurementDate,
          required_by_date: requiredByDate || procurementDate,
          quantity,
          unit,
          unit_rate: unitRate,
          vat_percentage: vatPercentage,
          amount_excl_vat: amountExclVat,
          vat_amount: vatAmount,
          total_amount: totalAmountInclVat,
          status,
          priority,
          notes: notes.trim(),
          quotation_file_path: updatedFilePath,
          quotation_file_name: updatedFileName,
          quotation_file_type: updatedFileType,
          quotation_file_size: updatedFileSize,
          proof_of_payment_path: updatedPoPPath,
          proof_of_payment_file_name: updatedPoPName,
          proof_of_payment_file_type: updatedPoPType,
          proof_of_payment_file_size: updatedPoPSize,
          paid_at: status === "Paid" ? (editingItem.paid_at || new Date().toISOString()) : null,
          updated_at: new Date().toISOString()
        };

        if (dbProgrammeLinkageExists) {
          updatePayload.programme_id = selectedProgrammeId || null;
          updatePayload.programme_activity_id = selectedActivityId || null;
        } else {
          const localKey = `procurement_linkages_${activeProject.company_id}_${activeProject.id}`;
          const localData = previewStorage.getItem(localKey);
          const linkageMap = localData ? JSON.parse(localData) : {};
          linkageMap[editingItem.id] = {
            programme_id: selectedProgrammeId || null,
            programme_activity_id: selectedActivityId || null
          };
          previewStorage.setItem(localKey, JSON.stringify(linkageMap));
        }

        const { error: updateError } = await supabase
          .from("procurement_items")
          .update(updatePayload)
          .eq("id", editingItem.id);

        if (updateError) {
          setFormError("Failed to update procurement item: " + updateError.message);
          showToast("Failed to update: " + updateError.message);
          setIsSubmitting(false);
          return;
        }

        showToast("Procurement item details updated successfully!");
      } else {
        // Create new record
        const insertPayload: any = {
          company_id: activeProject.company_id,
          project_id: activeProject.id,
          category,
          subcategory,
          item_name: itemName.trim(),
          supplier_name: supplierName.trim(),
          quotation_number: quotationNumber.trim() || "N/A",
          procurement_date: procurementDate,
          required_by_date: requiredByDate || procurementDate,
          quantity,
          unit,
          unit_rate: unitRate,
          vat_percentage: vatPercentage,
          amount_excl_vat: amountExclVat,
          vat_amount: vatAmount,
          total_amount: totalAmountInclVat,
          status,
          priority,
          notes: notes.trim(),
          created_by: loggedInUserId,
          paid_at: status === "Paid" ? new Date().toISOString() : null
        };

        if (dbProgrammeLinkageExists) {
          insertPayload.programme_id = selectedProgrammeId || null;
          insertPayload.programme_activity_id = selectedActivityId || null;
        }

        const { data: insertedData, error: insertError } = await supabase
          .from("procurement_items")
          .insert([insertPayload])
          .select()
          .single();

        if (insertError) {
          setFormError("Failed to save procurement item: " + insertError.message);
          showToast("Failed to save procurement item: " + insertError.message);
          setIsSubmitting(false);
          return;
        }

        if (!dbProgrammeLinkageExists && insertedData && activeProject?.company_id && activeProject?.id) {
          const localKey = `procurement_linkages_${activeProject.company_id}_${activeProject.id}`;
          const localData = previewStorage.getItem(localKey);
          const linkageMap = localData ? JSON.parse(localData) : {};
          linkageMap[insertedData.id] = {
            programme_id: selectedProgrammeId || null,
            programme_activity_id: selectedActivityId || null
          };
          previewStorage.setItem(localKey, JSON.stringify(linkageMap));
        }

        let quotationStoragePath = "";
        let popStoragePath = "";

        // Handle file upload if file is selected
        if (selectedUploadFile && insertedData) {
          const sanitizedName = sanitizeFileName(selectedUploadFile.name);
          quotationStoragePath = `${activeProject.company_id}/${activeProject.id}/${insertedData.id}/quotation/${sanitizedName}`;

          const { error: uploadError } = await supabase.storage
            .from("procurement-quotations")
            .upload(quotationStoragePath, selectedUploadFile, {
              cacheControl: "3600",
              upsert: true
            });

          if (uploadError) {
            // Delete the inserted row if file upload fails
            await supabase
              .from("procurement_items")
              .delete()
              .eq("id", insertedData.id);

            setFormError(uploadError.message);
            setIsSubmitting(false);
            return;
          }
        }

        // Handle Proof of Payment file upload if file is selected
        if (selectedProofOfPaymentFile && insertedData) {
          const sanitizedPoPName = sanitizeFileName(selectedProofOfPaymentFile.name);
          popStoragePath = `${activeProject.company_id}/${activeProject.id}/${insertedData.id}/proof-of-payment/${sanitizedPoPName}`;

          const { error: uploadError } = await supabase.storage
            .from("procurement-quotations")
            .upload(popStoragePath, selectedProofOfPaymentFile, {
              cacheControl: "3600",
              upsert: true
            });

          if (uploadError) {
            // Cleanup: delete quotation file from storage if uploaded
            if (quotationStoragePath) {
              await supabase.storage.from("procurement-quotations").remove([quotationStoragePath]);
            }
            // Delete the inserted row if file upload fails
            await supabase
              .from("procurement_items")
              .delete()
              .eq("id", insertedData.id);

            setFormError(uploadError.message);
            setIsSubmitting(false);
            return;
          }
        }

        // Update metadata
        const updateMetadata: any = {};
        if (selectedUploadFile) {
          updateMetadata.quotation_file_path = quotationStoragePath;
          updateMetadata.quotation_file_name = selectedUploadFile.name;
          updateMetadata.quotation_file_type = selectedUploadFile.type;
          updateMetadata.quotation_file_size = selectedUploadFile.size;
        }
        if (selectedProofOfPaymentFile) {
          updateMetadata.proof_of_payment_path = popStoragePath;
          updateMetadata.proof_of_payment_file_name = selectedProofOfPaymentFile.name;
          updateMetadata.proof_of_payment_file_type = selectedProofOfPaymentFile.type;
          updateMetadata.proof_of_payment_file_size = selectedProofOfPaymentFile.size;
        }

        if (Object.keys(updateMetadata).length > 0) {
          const { error: updateMetaError } = await supabase
            .from("procurement_items")
            .update(updateMetadata)
            .eq("id", insertedData.id);

          if (updateMetaError) {
            // Cleanup
            if (quotationStoragePath) {
              await supabase.storage.from("procurement-quotations").remove([quotationStoragePath]);
            }
            if (popStoragePath) {
              await supabase.storage.from("procurement-quotations").remove([popStoragePath]);
            }
            await supabase
              .from("procurement_items")
              .delete()
              .eq("id", insertedData.id);

            setFormError("Failed to update quotation metadata: " + updateMetaError.message);
            showToast("Metadata update failed: " + updateMetaError.message);
            setIsSubmitting(false);
            return;
          }
        }

        showToast("New procurement item saved to secure ledger!");
      }

      setIsFormOpen(false);
      fetchItems();
    } catch (err: any) {
      setFormError("An unexpected error occurred: " + err.message);
      showToast("Error saving: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Validate database UUID
  const isValidUuid = (value: unknown): value is string =>
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

  // Delete Action trigger
  const handleDeleteItem = (id: string) => {
    assertOperationalAction("delete", "pages/Procurement/ProcurementPage.tsx");
    const itemToDelete = items.find(item => item.id === id);
    if (itemToDelete) {
      setPendingDeleteRecord(itemToDelete);
    }
  };

  const confirmDeleteProcurementRecord = async () => {
    const record = pendingDeleteRecord;

    if (!record || !isValidUuid(record.id)) {
      showToast("This procurement record is missing a valid database ID.");
      return;
    }

    setIsDeleting(true);

    try {
      // 1. Delete quotation and proof of payment files from storage if they exist
      const storagePaths = [
        record.quotation_file_path,
        record.proof_of_payment_path,
      ].filter((value): value is string => typeof value === "string" && value.trim() !== "");

      if (storagePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from("procurement-quotations")
          .remove(storagePaths);

        if (storageError) {
          console.warn("Storage files deletion warning:", storageError.message);
        }
      }

      // 2. Delete database record
      const { error: dbError } = await supabase
        .from("procurement_items")
        .delete()
        .eq("id", record.id);

      if (dbError) {
        console.error("Procurement delete failed:", {
          code: dbError.code,
          message: dbError.message,
          details: dbError.details,
          hint: dbError.hint,
        });
        throw dbError;
      }

      if (!dbProgrammeLinkageExists && activeCompany?.id && activeProject?.id) {
        const localKey = `procurement_linkages_${activeCompany.id}_${activeProject.id}`;
        const localData = previewStorage.getItem(localKey);
        if (localData) {
          try {
            const linkageMap = JSON.parse(localData);
            delete linkageMap[record.id];
            previewStorage.setItem(localKey, JSON.stringify(linkageMap));
          } catch (e) {
            console.error("Failed to clean up local storage linkages:", e);
          }
        }
      }

      setPendingDeleteRecord(null);
      showToast("Procurement record deleted successfully.");
      await fetchItems();
    } catch (error: any) {
      const message = error?.message || "Unable to delete the procurement record.";
      showToast("Deletion failed: " + message);
    } finally {
      setIsDeleting(false);
    }
  };

  // View Quotation
  const handleViewQuotation = async (item: ProcurementItem) => {
    if (!item.quotation_file_path) return;
    try {
      const { data, error } = await supabase.storage
        .from("procurement-quotations")
        .createSignedUrl(item.quotation_file_path, 60);

      if (error) {
        showToast("Error generating view URL: " + error.message);
        return;
      }

      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (err: any) {
      showToast("An error occurred: " + err.message);
    }
  };

  // Download Quotation
  const handleDownloadQuotation = async (item: ProcurementItem) => {
    assertOperationalAction("export", "pages/Procurement/ProcurementPage.tsx");
    if (!item.quotation_file_path) return;
    try {
      const { data, error } = await supabase.storage
        .from("procurement-quotations")
        .createSignedUrl(item.quotation_file_path, 60, {
          download: item.quotation_file_name || true
        });

      if (error) {
        showToast("Error generating download URL: " + error.message);
        return;
      }

      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (err: any) {
      showToast("An error occurred: " + err.message);
    }
  };

  // View Proof of Payment
  const handleViewProofOfPayment = async (item: ProcurementItem) => {
    if (!item.proof_of_payment_path) return;
    try {
      const { data, error } = await supabase.storage
        .from("procurement-quotations")
        .createSignedUrl(item.proof_of_payment_path, 60);

      if (error) {
        showToast("Error generating view URL: " + error.message);
        return;
      }

      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (err: any) {
      showToast("An error occurred: " + err.message);
    }
  };

  // Download Proof of Payment
  const handleDownloadProofOfPayment = async (item: ProcurementItem) => {
    assertOperationalAction("export", "pages/Procurement/ProcurementPage.tsx");
    if (!item.proof_of_payment_path) return;
    try {
      const { data, error } = await supabase.storage
        .from("procurement-quotations")
        .createSignedUrl(item.proof_of_payment_path, 60, {
          download: item.proof_of_payment_file_name || true
        });

      if (error) {
        showToast("Error generating download URL: " + error.message);
        return;
      }

      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch (err: any) {
      showToast("An error occurred: " + err.message);
    }
  };

  // Toast helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Formatting Date Helper (YYYY-MM-DD to DD MMMM YYYY)
  const formatUserFriendlyDate = (isoStr: string) => {
    if (!isoStr) return "";
    try {
      const dateObj = new Date(isoStr);
      if (isNaN(dateObj.getTime())) return isoStr;
      return dateObj.toLocaleDateString("en-ZA", {
        day: "2-digit",
        month: "long",
        year: "numeric"
      });
    } catch {
      return isoStr;
    }
  };

  // Currency Formatter
  const formatCurrency = (val: number | string | null | undefined) => {
    return globalFormatCurrency(val);
  };

  // Helper to format worksheets in SheetJS
  const formatWorksheet = (
    ws: any, 
    options: {
      isTableSheet?: boolean; 
      currencyCols?: number[]; 
      numberCols?: number[]; 
      percentCols?: number[]; 
      dateCols?: number[]; 
      freezeHeader?: boolean;
      enableFilter?: boolean;
      headerRowsCount?: number;
    } = {}
  ) => {
    const {
      isTableSheet = true,
      currencyCols = [],
      numberCols = [],
      percentCols = [],
      dateCols = [],
      freezeHeader = true,
      enableFilter = true,
      headerRowsCount = 1
    } = options;

    if (!ws) return;

    const ref = ws["!ref"];
    if (!ref) return;
    const range = XLSX.utils.decode_range(ref);

    // Apply cell formatting (.z)
    for (let r = range.s.r; r <= range.e.r; r++) {
      if (r < headerRowsCount) continue; // skip header row(s)

      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        const cell = ws[cellRef];
        if (!cell) continue;

        if (currencyCols.includes(c)) {
          cell.t = "n";
          cell.z = `"${currencySymbols[currencyCode] || "R"}"#,##0.00`;
        } else if (percentCols.includes(c)) {
          cell.t = "n";
          cell.z = '0.00%';
        } else if (numberCols.includes(c)) {
          cell.t = "n";
          cell.z = '#,##0';
        } else if (dateCols.includes(c)) {
          cell.z = 'yyyy-mm-dd';
        }
      }
    }

    // Auto-fit column widths
    const colWidths: number[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      let maxLength = 0;
      for (let r = range.s.r; r <= range.e.r; r++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        const cell = ws[cellRef];
        if (cell && cell.v !== undefined) {
          let valStr = String(cell.v);
          if (currencyCols.includes(c)) {
            valStr = "R " + valStr + ".00";
          }
          maxLength = Math.max(maxLength, valStr.length);
        }
      }
      colWidths.push(maxLength + 4);
    }
    ws["!cols"] = colWidths.map(w => ({ wch: Math.max(w, 10) }));

    // Freeze Pane
    if (freezeHeader) {
      ws["!views"] = [{ state: "frozen", ySplit: headerRowsCount }];
    }

    // Auto Filter
    if (enableFilter && isTableSheet) {
      const startCol = XLSX.utils.encode_col(range.s.c);
      const endCol = XLSX.utils.encode_col(range.e.c);
      ws["!autofilter"] = { ref: `${startCol}${headerRowsCount}:${endCol}${headerRowsCount}` };
    }
  };

  // Main Monthly Procurement Excel Export Action
  const handleExportMonthlyReport = async () => {
    assertOperationalAction("export", "pages/Procurement/ProcurementPage.tsx");
    if (!activeCompany?.id || !activeProject?.id) {
      showToast("Select a valid company and project first.");
      return;
    }

    setIsExporting(true);

    try {
      const monthStr = String(exportMonth).padStart(2, "0");
      const yearStr = String(exportYear);
      const startDate = `${yearStr}-${monthStr}-01`;
      
      const lastDay = new Date(exportYear, exportMonth, 0).getDate();
      const endDate = `${yearStr}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

      const { data, error } = await supabase
        .from("procurement_items")
        .select("*")
        .eq("company_id", activeCompany.id)
        .eq("project_id", activeProject.id)
        .gte("procurement_date", startDate)
        .lte("procurement_date", endDate)
        .order("procurement_date", { ascending: true });

      if (error) {
        showToast("Error retrieving records: " + error.message);
        setIsExporting(false);
        return;
      }

      const monthLabel = monthsList.find(m => m.value === exportMonth)?.label || "Selected Month";

      if (!data || data.length === 0) {
        showToast(`No procurement records found for ${monthLabel} ${exportYear}.`);
        setIsExporting(false);
        return;
      }

      // Generate sheets
      const totalSpend = data.reduce((sum, item) => sum + (item.total_amount || 0), 0);
      const totalExcl = data.reduce((sum, item) => sum + (item.amount_excl_vat || 0), 0);
      const totalVatVal = data.reduce((sum, item) => sum + (item.vat_amount || 0), 0);

      // Status lists spend sums
      const pendingTotal = data.filter(item => item.status === "Pending").reduce((sum, item) => sum + (item.total_amount || 0), 0);
      const quotationReceivedTotal = data.filter(item => item.status === "Quotation Received").reduce((sum, item) => sum + (item.total_amount || 0), 0);
      const approvedTotal = data.filter(item => item.status === "Approved").reduce((sum, item) => sum + (item.total_amount || 0), 0);
      const procuredTotal = data.filter(item => item.status === "Procured").reduce((sum, item) => sum + (item.total_amount || 0), 0);
      const deliveredTotal = data.filter(item => item.status === "Delivered").reduce((sum, item) => sum + (item.total_amount || 0), 0);
      const paidTotal = data.filter(item => item.status === "Paid").reduce((sum, item) => sum + (item.total_amount || 0), 0);
      const cancelledTotal = data.filter(item => item.status === "Cancelled").reduce((sum, item) => sum + (item.total_amount || 0), 0);

      // Sheet 1: Monthly Summary
      const summaryAOA = [
        ["MONTHLY PROCUREMENT SUMMARY REPORT"],
        [],
        ["Metadata Field", "Value"],
        ["Company Name", activeCompany?.name || "N/A"],
        ["Project Name", activeProject?.name || "N/A"],
        ["Month", monthLabel],
        ["Year", exportYear],
        [],
        ["Financial Indicators", `Amount (${currencyCode})`],
        ["Total Procurement Spend (Incl. VAT)", totalSpend],
        ["Total Excluding VAT", totalExcl],
        ["Total VAT Amount", totalVatVal],
        [],
        ["Summary Metrics", "Value"],
        ["Number of Procurement Items", data.length],
        [],
        ["Spend by Workflow Status", `Total Amount (${currencyCode})`],
        ["Pending Spend", pendingTotal],
        ["Quotation Received Spend", quotationReceivedTotal],
        ["Approved Spend", approvedTotal],
        ["Procured Spend", procuredTotal],
        ["Delivered Spend", deliveredTotal],
        ["Paid Spend", paidTotal],
        ["Cancelled Spend", cancelledTotal]
      ];

      const ws1 = XLSX.utils.aoa_to_sheet(summaryAOA);
      const currencyRowsS1 = [9, 10, 11, 17, 18, 19, 20, 21, 22, 23];
      currencyRowsS1.forEach(r => {
        const cellRef = XLSX.utils.encode_cell({ r, c: 1 });
        if (ws1[cellRef]) {
          ws1[cellRef].t = "n";
          ws1[cellRef].z = `"${currencySymbols[currencyCode] || "R"}"#,##0.00`;
        }
      });
      const countCellRefS1 = XLSX.utils.encode_cell({ r: 14, c: 1 });
      if (ws1[countCellRefS1]) {
        ws1[countCellRefS1].t = "n";
        ws1[countCellRefS1].z = '#,##0';
      }

      // Calculate column widths manually for sheet 1
      const ref1 = ws1["!ref"];
      if (ref1) {
        const range1 = XLSX.utils.decode_range(ref1);
        const colWidths1: number[] = [];
        for (let c = range1.s.c; c <= range1.e.c; c++) {
          let maxL = 0;
          for (let r = range1.s.r; r <= range1.e.r; r++) {
            const cell = ws1[XLSX.utils.encode_cell({ r, c })];
            if (cell && cell.v !== undefined) {
              maxL = Math.max(maxL, String(cell.v).length);
            }
          }
          colWidths1.push(maxL + 5);
        }
        ws1["!cols"] = colWidths1.map(w => ({ wch: Math.max(w, 12) }));
      }

      // Sheet 2: Procurement Register
      const registerHeaders = [
        "Procurement Date",
        "Required By Date",
        "Category",
        "Subcategory",
        "Item / Service Name",
        "Supplier",
        "Invoice / Quotation Number",
        "Quantity",
        "Unit",
        "Unit Rate",
        "VAT %",
        "Amount Excl. VAT",
        "VAT Amount",
        "Total Amount Incl. VAT",
        "Status",
        "Priority",
        "Notes",
        "Quotation File Name",
        "Proof of Payment File Name"
      ];

      const registerRows = data.map(item => [
        item.procurement_date,
        item.required_by_date,
        item.category,
        item.subcategory,
        item.item_name,
        item.supplier_name,
        item.quotation_number,
        item.quantity,
        item.unit,
        item.unit_rate,
        item.vat_percentage,
        item.amount_excl_vat,
        item.vat_amount,
        item.total_amount,
        item.status,
        item.priority,
        item.notes || "",
        item.quotation_file_name || "",
        item.proof_of_payment_file_name || ""
      ]);

      const sumQty = data.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const sumExcl = data.reduce((sum, item) => sum + (item.amount_excl_vat || 0), 0);
      const sumVat = data.reduce((sum, item) => sum + (item.vat_amount || 0), 0);
      const sumTotal = data.reduce((sum, item) => sum + (item.total_amount || 0), 0);

      const totalRow = [
        "Total / Summary",
        "",
        "",
        "",
        "",
        "",
        "",
        sumQty,
        "",
        "",
        "",
        sumExcl,
        sumVat,
        sumTotal,
        "",
        "",
        "",
        "",
        ""
      ];

      const registerAOA = [registerHeaders, ...registerRows, totalRow];
      const ws2 = XLSX.utils.aoa_to_sheet(registerAOA);

      formatWorksheet(ws2, {
        isTableSheet: true,
        currencyCols: [9, 11, 12, 13],
        numberCols: [7, 10],
        dateCols: [0, 1],
        freezeHeader: true,
        enableFilter: true,
        headerRowsCount: 1
      });

      // Format total row cells
      const totalRowIdx = data.length + 1;
      const totalQtyCell = ws2[XLSX.utils.encode_cell({ r: totalRowIdx, c: 7 })];
      if (totalQtyCell) {
        totalQtyCell.t = "n";
        totalQtyCell.z = '#,##0';
      }
      [11, 12, 13].forEach(c => {
        const cell = ws2[XLSX.utils.encode_cell({ r: totalRowIdx, c })];
        if (cell) {
          cell.t = "n";
          cell.z = `"${currencySymbols[currencyCode] || "R"}"#,##0.00`;
        }
      });

      // Sheet 3: Category Breakdown
      const categories: ProcurementCategory[] = ["OHS", "Site Establishment", "Operational Costs", "Environmental"];
      const categoryBreakdownRows = categories.map(cat => {
        const catItems = data.filter(item => item.category === cat);
        const count = catItems.length;
        const excl = catItems.reduce((sum, item) => sum + (item.amount_excl_vat || 0), 0);
        const vat = catItems.reduce((sum, item) => sum + (item.vat_amount || 0), 0);
        const total = catItems.reduce((sum, item) => sum + (item.total_amount || 0), 0);
        return [cat, count, excl, vat, total];
      });

      const catSumCount = categoryBreakdownRows.reduce((sum, r) => sum + Number(r[1]), 0);
      const catSumExcl = categoryBreakdownRows.reduce((sum, r) => sum + Number(r[2]), 0);
      const catSumVat = categoryBreakdownRows.reduce((sum, r) => sum + Number(r[3]), 0);
      const catSumTotal = categoryBreakdownRows.reduce((sum, r) => sum + Number(r[4]), 0);

      const categoryTotalRow = ["Total", catSumCount, catSumExcl, catSumVat, catSumTotal];
      const categoryHeaders = ["Category", "Number of Items", "Amount Excl. VAT", "VAT Amount", "Total Amount"];
      
      const categoryAOA = [categoryHeaders, ...categoryBreakdownRows, categoryTotalRow];
      const ws3 = XLSX.utils.aoa_to_sheet(categoryAOA);

      formatWorksheet(ws3, {
        isTableSheet: true,
        currencyCols: [2, 3, 4],
        numberCols: [1],
        freezeHeader: true,
        enableFilter: true,
        headerRowsCount: 1
      });

      const catTotalRowIdx = 5;
      const catTotalCountCell = ws3[XLSX.utils.encode_cell({ r: catTotalRowIdx, c: 1 })];
      if (catTotalCountCell) {
        catTotalCountCell.t = "n";
        catTotalCountCell.z = '#,##0';
      }
      [2, 3, 4].forEach(c => {
        const cell = ws3[XLSX.utils.encode_cell({ r: catTotalRowIdx, c })];
        if (cell) {
          cell.t = "n";
          cell.z = `"${currencySymbols[currencyCode] || "R"}"#,##0.00`;
        }
      });

      // Sheet 4: Supplier Breakdown
      const suppliersSet = new Set<string>();
      data.forEach(item => {
        if (item.supplier_name) {
          suppliersSet.add(item.supplier_name.trim());
        }
      });
      const uniqueSuppliers = Array.from(suppliersSet);

      const supplierBreakdownRows = uniqueSuppliers.map(supplier => {
        const supplierItems = data.filter(item => item.supplier_name && item.supplier_name.trim() === supplier);
        const count = supplierItems.length;
        const total = supplierItems.reduce((sum, item) => sum + (item.total_amount || 0), 0);
        const paid = supplierItems.filter(item => item.status === "Paid").reduce((sum, item) => sum + (item.total_amount || 0), 0);
        const pending = supplierItems.filter(item => item.status === "Pending").reduce((sum, item) => sum + (item.total_amount || 0), 0);
        return [supplier, count, total, paid, pending];
      });

      const suppSumCount = supplierBreakdownRows.reduce((sum, r) => sum + Number(r[1]), 0);
      const suppSumTotal = supplierBreakdownRows.reduce((sum, r) => sum + Number(r[2]), 0);
      const suppSumPaid = supplierBreakdownRows.reduce((sum, r) => sum + Number(r[3]), 0);
      const suppSumPending = supplierBreakdownRows.reduce((sum, r) => sum + Number(r[4]), 0);

      const supplierTotalRow = ["Total", suppSumCount, suppSumTotal, suppSumPaid, suppSumPending];
      const supplierHeaders = ["Supplier / Contractor", "Number of Items", "Total Amount", "Paid Amount", "Pending Amount"];

      const supplierAOA = [supplierHeaders, ...supplierBreakdownRows, supplierTotalRow];
      const ws4 = XLSX.utils.aoa_to_sheet(supplierAOA);

      formatWorksheet(ws4, {
        isTableSheet: true,
        currencyCols: [2, 3, 4],
        numberCols: [1],
        freezeHeader: true,
        enableFilter: true,
        headerRowsCount: 1
      });

      const suppTotalRowIdx = uniqueSuppliers.length + 1;
      const suppTotalCountCell = ws4[XLSX.utils.encode_cell({ r: suppTotalRowIdx, c: 1 })];
      if (suppTotalCountCell) {
        suppTotalCountCell.t = "n";
        suppTotalCountCell.z = '#,##0';
      }
      [2, 3, 4].forEach(c => {
        const cell = ws4[XLSX.utils.encode_cell({ r: suppTotalRowIdx, c })];
        if (cell) {
          cell.t = "n";
          cell.z = `"${currencySymbols[currencyCode] || "R"}"#,##0.00`;
        }
      });

      // Sheet 5: Status Breakdown
      const statuses = ["Pending", "Quotation Received", "Approved", "Procured", "Delivered", "Paid", "Cancelled"];
      const statusBreakdownRows = statuses.map(status => {
        const statusItems = data.filter(item => item.status === status);
        const count = statusItems.length;
        const total = statusItems.reduce((sum, item) => sum + (item.total_amount || 0), 0);
        return [status, count, total];
      });

      const statusSumCount = statusBreakdownRows.reduce((sum, r) => sum + Number(r[1]), 0);
      const statusSumTotal = statusBreakdownRows.reduce((sum, r) => sum + Number(r[2]), 0);

      const statusTotalRow = ["Total", statusSumCount, statusSumTotal];
      const statusHeaders = ["Workflow Status", "Number of Items", "Total Amount"];

      const statusAOA = [statusHeaders, ...statusBreakdownRows, statusTotalRow];
      const ws5 = XLSX.utils.aoa_to_sheet(statusAOA);

      formatWorksheet(ws5, {
        isTableSheet: true,
        currencyCols: [2],
        numberCols: [1],
        freezeHeader: true,
        enableFilter: true,
        headerRowsCount: 1
      });

      const statusTotalRowIdx = statuses.length + 1;
      const statusTotalCountCell = ws5[XLSX.utils.encode_cell({ r: statusTotalRowIdx, c: 1 })];
      if (statusTotalCountCell) {
        statusTotalCountCell.t = "n";
        statusTotalCountCell.z = '#,##0';
      }
      const statusTotalAmtCell = ws5[XLSX.utils.encode_cell({ r: statusTotalRowIdx, c: 2 })];
      if (statusTotalAmtCell) {
        statusTotalAmtCell.t = "n";
        statusTotalAmtCell.z = `"${currencySymbols[currencyCode] || "R"}"#,##0.00`;
      }

      // Compile into workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws1, "Monthly Summary");
      XLSX.utils.book_append_sheet(wb, ws2, "Procurement Register");
      XLSX.utils.book_append_sheet(wb, ws3, "Category Breakdown");
      XLSX.utils.book_append_sheet(wb, ws4, "Supplier Breakdown");
      XLSX.utils.book_append_sheet(wb, ws5, "Status Breakdown");

      // Save file
      const projectName = activeProject?.name || "Project";
      const fileName = `Procurement Report - ${projectName} - ${monthLabel} ${exportYear}.xlsx`;
      XLSX.writeFile(wb, fileName);
      showToast(`Exported monthly procurement report to Local Downloads.`);
    } catch (err: any) {
      showToast("Excel creation failed: " + err.message);
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  // Filtering Logic
  const filteredItems = enrichedItems.filter(item => {
    const matchesDate = selectedDate ? item.procurement_date === selectedDate : true;
    const matchesCategory = activeCategoryFilter ? item.category === activeCategoryFilter : true;
    return matchesDate && matchesCategory;
  });

  // Date-Based filter view items (for dynamic analytics that react to the date filter)
  const dateFilteredItems = enrichedItems.filter(item => {
    return selectedDate ? item.procurement_date === selectedDate : true;
  });

  // 1. Grand Total Panel Metrics (dynamically computed from date-filtered items to see totals for that selected date only)
  const totalProcurementSpend = dateFilteredItems.reduce((sum, item) => sum + Number(item.total_amount), 0);
  const totalExclVat = dateFilteredItems.reduce((sum, item) => sum + Number(item.amount_excl_vat), 0);
  const totalVat = dateFilteredItems.reduce((sum, item) => sum + Number(item.vat_amount), 0);
  const totalProcurementCount = dateFilteredItems.length;
  const totalPendingCount = dateFilteredItems.filter(item => item.status === "Pending").length;
  const totalProcuredCount = dateFilteredItems.filter(item => 
    item.status === "Procured" || 
    item.status === "Delivered" || 
    item.status === "Paid" || 
    !!item.proof_of_payment_path
  ).length;

  // 2. Category Breakdown Metrics
  const categoriesList: { category: ProcurementCategory; label: string; bg: string; text: string; barColor: string }[] = [
    { category: "OHS", label: "OHS", bg: "bg-rose-50 border-rose-100", text: "text-rose-700", barColor: "bg-rose-500" },
    { category: "Site Establishment", label: "Site Establishment", bg: "bg-blue-50 border-blue-100", text: "text-blue-700", barColor: "bg-blue-500" },
    { category: "Operational Costs", label: "Operational Costs", bg: "bg-amber-50 border-amber-100", text: "text-amber-700", barColor: "bg-[#FF9F1C]" },
    { category: "Environmental", label: "Environmental", bg: "bg-emerald-50 border-emerald-100", text: "text-emerald-700", barColor: "bg-emerald-500" },
  ];

  const categoryBreakdown = categoriesList.map(cat => {
    const catItems = dateFilteredItems.filter(item => item.category === cat.category);
    const amount = catItems.reduce((sum, item) => sum + Number(item.total_amount), 0);
    const count = catItems.length;
    const percentage = totalProcurementSpend > 0 ? (amount / totalProcurementSpend) * 100 : 0;
    return { ...cat, amount, count, percentage };
  });

  // 3. Status Breakdown Metrics
  const statusesList: { status: ProcurementItem["status"]; bg: string; border: string; text: string }[] = [
    { status: "Pending", bg: "bg-amber-50/70", border: "border-amber-100", text: "text-amber-800" },
    { status: "Quotation Received", bg: "bg-blue-50/70", border: "border-blue-100", text: "text-blue-800" },
    { status: "Approved", bg: "bg-purple-50/70", border: "border-purple-100", text: "text-purple-800" },
    { status: "Procured", bg: "bg-green-50/70", border: "border-green-100", text: "text-green-800" },
    { status: "Delivered", bg: "bg-emerald-50/70", border: "border-emerald-100", text: "text-emerald-800" },
    { status: "Paid", bg: "bg-teal-50/70", border: "border-teal-100", text: "text-teal-800" },
    { status: "Cancelled", bg: "bg-rose-50/70", border: "border-rose-100", text: "text-rose-800" },
  ];

  const statusBreakdown = statusesList.map(st => {
    const stItems = dateFilteredItems.filter(item => item.status === st.status);
    const amount = stItems.reduce((sum, item) => sum + Number(item.total_amount), 0);
    const count = stItems.length;
    return { ...st, amount, count };
  });

  // 4. Priority Breakdown Metrics
  const prioritiesList: { priority: ProcurementItem["priority"]; bg: string; text: string; barColor: string }[] = [
    { priority: "Critical", bg: "bg-rose-50 border border-rose-100", text: "text-rose-800", barColor: "bg-rose-600" },
    { priority: "High", bg: "bg-amber-50 border border-amber-100", text: "text-amber-800", barColor: "bg-amber-500" },
    { priority: "Medium", bg: "bg-blue-50 border border-blue-100", text: "text-blue-800", barColor: "bg-blue-500" },
    { priority: "Low", bg: "bg-slate-50 border border-slate-100", text: "text-slate-800", barColor: "bg-slate-500" },
  ];

  const priorityBreakdown = prioritiesList.map(pr => {
    const prItems = dateFilteredItems.filter(item => item.priority === pr.priority);
    const amount = prItems.reduce((sum, item) => sum + Number(item.total_amount), 0);
    const count = prItems.length;
    const percentage = totalProcurementSpend > 0 ? (amount / totalProcurementSpend) * 100 : 0;
    return { ...pr, amount, count, percentage };
  });

  // 5. Supplier Spend Summary (Top Suppliers by total_amount)
  const supplierMap: { [key: string]: { name: string; total: number; count: number } } = {};
  dateFilteredItems.forEach(item => {
    const name = item.supplier_name.trim();
    const key = name.toLowerCase();
    if (!supplierMap[key]) {
      supplierMap[key] = { name, total: 0, count: 0 };
    }
    supplierMap[key].total += Number(item.total_amount);
    supplierMap[key].count += 1;
  });
  const supplierSpendSummary = Object.values(supplierMap)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // 6. Required By Date Alerts
  // Scanning all `enrichedItems` so that the user has complete visibility into what is upcoming and overdue
  const todayDate = new Date("2026-07-08"); // Project standard current local time

  const requiredSoonItems = enrichedItems.filter(item => {
    if (!item.required_by_date || item.status === "Delivered" || item.status === "Cancelled") return false;
    const reqDate = new Date(item.required_by_date);
    const diffTime = reqDate.getTime() - todayDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  });

  const overduePendingItems = enrichedItems.filter(item => {
    if (!item.required_by_date || item.status !== "Pending") return false;
    const reqDate = new Date(item.required_by_date);
    return reqDate.getTime() < todayDate.getTime();
  });

  // Category counts (for legacy references or backward compatibility if any)
  const getCategoryCount = (cat: ProcurementCategory) => {
    return enrichedItems.filter(item => item.category === cat).length;
  };

  const getPendingCount = (cat: ProcurementCategory) => {
    return enrichedItems.filter(item => item.category === cat && item.status === "Pending").length;
  };

  const getCategorySpendText = (cat: ProcurementCategory) => {
    const total = enrichedItems
      .filter(item => item.category === cat)
      .reduce((sum, item) => sum + Number(item.total_amount), 0);
    return total > 0 ? formatCurrency(total) : "No data yet";
  };

  const getCategoryPendingText = (cat: ProcurementCategory) => {
    const count = getPendingCount(cat);
    return count > 0 ? `${count} Pending` : "No data yet";
  };

  // Status counts helpers
  const getStatusCount = (statusVal: ProcurementItem["status"]) => {
    return enrichedItems.filter(item => item.status === statusVal).length;
  };

  // Styling maps
  const statusBadgeStyle = (stat: ProcurementItem["status"]) => {
    switch (stat) {
      case "Pending":
        return "bg-amber-50 border border-amber-200 text-amber-800";
      case "Quotation Received":
        return "bg-blue-50 border border-blue-200 text-blue-800";
      case "Approved":
        return "bg-purple-50 border border-purple-200 text-purple-800";
      case "Procured":
        return "bg-green-50 border border-green-200 text-green-800";
      case "Delivered":
        return "bg-emerald-50 border border-emerald-200 text-emerald-800";
      case "Paid":
        return "bg-teal-50 border border-teal-200 text-teal-800";
      case "Cancelled":
        return "bg-rose-50 border border-rose-200 text-rose-800";
      default:
        return "bg-slate-50 border border-slate-200 text-slate-800";
    }
  };

  const priorityBadgeStyle = (prio: ProcurementItem["priority"]) => {
    switch (prio) {
      case "Low":
        return "bg-slate-100 text-slate-700";
      case "Medium":
        return "bg-blue-100 text-blue-700";
      case "High":
        return "bg-amber-100 text-amber-700";
      case "Critical":
        return "bg-rose-100 text-rose-700 font-extrabold animate-pulse";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  return (
    <div className="space-y-8 pb-16">
      
      {/* SUCCESS TOAST */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 bg-[#07182E] text-white rounded-2xl border-l-4 border-[#FF9F1C] shadow-2xl flex items-center gap-3 animate-fade-in max-w-sm">
          <CheckCircle2 className="w-5 h-5 text-[#FF9F1C] shrink-0" />
          <p className="text-xs font-bold">{toastMessage}</p>
        </div>
      )}

      {/* TOP SECTION: TITLE, CTAS, FILTERS */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-3xl border border-[#E2E8F0]">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#FF9F1C]">Procurement Control Centre</span>
          <h1 className="text-2xl font-extrabold text-[#07182E] mt-0.5 tracking-tight">Procurement</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl font-semibold">
            Track quotations, procurement costs, pending items, and time-based spending.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* DATE FILTER */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-700 border-none focus:outline-none cursor-pointer"
              title="Select procurement date"
            />
            {selectedDate && (
              <button 
                onClick={() => setSelectedDate("")}
                className="p-0.5 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-600 transition-colors"
                title="Clear date filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={() => handleOpenNewForm()}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#FF9F1C] to-[#E58A13] hover:from-[#FFA933] hover:to-[#FF9F1C] text-white font-extrabold text-xs rounded-xl shadow-lg shadow-[#FF9F1C]/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Add Procurement Item
          </button>
        </div>
      </div>

      {/* TAB SELECTOR */}
      <div className="flex border-b border-slate-200 overflow-x-auto whitespace-nowrap scrollbar-hide">
        <button
          onClick={() => setActiveTab("ledger")}
          className={`px-6 py-3 font-extrabold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer shrink-0 ${
            activeTab === "ledger"
              ? "border-[#FF9F1C] text-[#07182E]"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Procurement Ledger
        </button>
        <button
          onClick={() => setActiveTab("forecast")}
          className={`px-6 py-3 font-extrabold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer shrink-0 ${
            activeTab === "forecast"
              ? "border-[#FF9F1C] text-[#07182E]"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          Forecast Plan
        </button>
        <button
          onClick={() => setActiveTab("inventory-status")}
          className={`px-6 py-3 font-extrabold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer shrink-0 ${
            activeTab === "inventory-status"
              ? "border-[#FF9F1C] text-[#07182E]"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          INVENTORY AND STATUS
        </button>
      </div>

      {activeTab === "ledger" ? (
        <>
          {/* CATEGORY & DATE FILTER OVERVIEWS */}
      <div className="flex flex-wrap items-center gap-2">
        {activeCategoryFilter && (
          <div className="flex items-center gap-2 bg-[#102846]/10 border border-[#102846]/20 px-4 py-1.5 rounded-xl w-fit">
            <span className="text-xs font-extrabold text-[#102846]">Showing category: {activeCategoryFilter}</span>
            <button 
              onClick={() => setActiveCategoryFilter(null)}
              className="p-0.5 hover:bg-[#102846]/25 rounded text-[#102846] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {selectedDate && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-4 py-1.5 rounded-xl w-fit">
            <span className="text-xs font-extrabold text-amber-800">Date filtered: {formatUserFriendlyDate(selectedDate)}</span>
            <button 
              onClick={() => setSelectedDate("")}
              className="p-0.5 hover:bg-amber-100 rounded text-amber-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {items.length === 0 && !isLoading ? (
        /* NO PROCUREMENT DATA OVERALL EMPTY STATE */
        <div className="bg-white p-12 text-center rounded-3xl border border-[#E2E8F0] shadow-xs">
          <div className="p-4 bg-slate-50 border border-slate-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
            <FolderOpen className="w-8 h-8 text-slate-300" />
          </div>
          <p className="text-sm font-bold text-slate-500">No procurement data yet.</p>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Start building your secure procurement ledger by entering site establishment, OHS, operational, or environmental costs.
          </p>
          <button
            onClick={() => handleOpenNewForm()}
            className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-extrabold text-white bg-[#FF9F1C] hover:bg-[#FFA933] rounded-xl shadow-md transition-all cursor-pointer"
          >
            Add First Procurement Item <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        /* EXECUTIVE ANALYTICS AND COST CONTROL DASHBOARD */
        <div className="space-y-6">
          
          {/* TOP ANALYTICS GRID: GRAND TOTAL PANEL */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            
            {/* Dark Spend Highlight Card */}
            <div className="bg-[#07182E] p-6 rounded-3xl text-white flex flex-col justify-between relative overflow-hidden shadow-md border border-[#07182E]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full translate-x-12 -translate-y-12 animate-pulse" />
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF9F1C]">Total Procurement Spend</span>
                  {selectedDate && (
                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-[8px] font-black uppercase rounded">Single Date</span>
                  )}
                </div>
                <h3 className="text-3xl font-black mt-2 text-white">
                  {formatCurrency(totalProcurementSpend)}
                </h3>
                <p className="text-[10px] text-slate-400 mt-1.5 font-bold">
                  {selectedDate 
                    ? `Calculated for date ${formatUserFriendlyDate(selectedDate)}` 
                    : `Active ledger sum across ${totalProcurementCount} items.`}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-6 mt-6 border-t border-white/10 text-xs">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">Excl. VAT</span>
                  <span className="font-extrabold text-slate-200 mt-0.5 block">{formatCurrency(totalExclVat)}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">VAT Portion</span>
                  <span className="font-extrabold text-[#FF9F1C] mt-0.5 block">{formatCurrency(totalVat)}</span>
                </div>
              </div>
            </div>

            {/* General metrics cards container */}
            <div className="xl:col-span-2 grid grid-cols-2 md:grid-cols-3 gap-4">
              
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs flex flex-col justify-between">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Total Items</span>
                  <span className="text-2xl font-extrabold text-[#07182E] mt-1 block">{totalProcurementCount}</span>
                </div>
                <div className="text-[10px] text-slate-400 font-semibold mt-4 pt-2 border-t border-slate-50">
                  Registered procurement lines
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs flex flex-col justify-between">
                <div>
                  <span className="text-[9px] font-bold text-amber-500 uppercase tracking-wider block">Pending items</span>
                  <span className="text-2xl font-extrabold text-amber-600 mt-1 block">{totalPendingCount}</span>
                </div>
                <div className="text-[10px] text-slate-400 font-semibold mt-4 pt-2 border-t border-slate-50">
                  Awaiting review or quotations
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-2xs flex flex-col justify-between col-span-2 md:col-span-1">
                <div>
                  <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider block">Procured items</span>
                  <span className="text-2xl font-extrabold text-emerald-600 mt-1 block">{totalProcuredCount}</span>
                </div>
                <div className="text-[10px] text-slate-400 font-semibold mt-4 pt-2 border-t border-slate-50">
                  Orders officially dispatched
                </div>
              </div>

            </div>

          </div>

          {/* SECOND ROW: REQUIRED BY DATE ALERTS & SUPPLIER SPEND SUMMARY */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Required By Date Alerts Card */}
            <div className="bg-white p-6 rounded-3xl border border-[#E2E8F0] shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                  <h3 className="text-xs font-extrabold text-[#07182E] uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldAlert className="w-4.5 h-4.5 text-rose-500 shrink-0" />
                    Required By Date Alerts & Risks
                  </h3>
                  <span className="px-2 py-0.5 bg-rose-50 border border-rose-100 text-rose-700 text-[10px] font-bold rounded-lg">
                    {overduePendingItems.length + requiredSoonItems.length} active alerts
                  </span>
                </div>

                <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                  {overduePendingItems.length === 0 && requiredSoonItems.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs font-bold flex flex-col items-center gap-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                      <div>
                        <p className="text-slate-700 font-extrabold">All items on track</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-0.5">No overdue items or critical upcoming dates detected.</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Overdue Section */}
                      {overduePendingItems.map(item => (
                        <div key={item.id} className="p-3 bg-rose-50/50 border border-rose-100 rounded-xl flex items-center justify-between gap-2">
                          <div className="truncate">
                            <span className="text-[8px] font-extrabold bg-rose-100 text-rose-700 uppercase px-1.5 py-0.5 rounded mr-2">Overdue Pending</span>
                            <span className="text-xs font-extrabold text-[#07182E] block mt-1 truncate" title={item.item_name}>
                              {item.item_name}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[9px] text-slate-400 font-bold block">Required By</span>
                            <span className="text-[10px] text-rose-700 font-extrabold">{formatUserFriendlyDate(item.required_by_date)}</span>
                          </div>
                        </div>
                      ))}

                      {/* Required within 7 Days Section */}
                      {requiredSoonItems.map(item => (
                        <div key={item.id} className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl flex items-center justify-between gap-2">
                          <div className="truncate">
                            <span className="text-[8px] font-extrabold bg-amber-100 text-amber-700 uppercase px-1.5 py-0.5 rounded mr-2">Due in 7 Days</span>
                            <span className="text-xs font-extrabold text-[#07182E] block mt-1 truncate" title={item.item_name}>
                              {item.item_name}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[9px] text-slate-400 font-bold block">Required By</span>
                            <span className="text-[10px] text-amber-700 font-extrabold">{formatUserFriendlyDate(item.required_by_date)}</span>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
              
              <div className="text-[10px] text-slate-400 font-semibold mt-4 pt-3 border-t border-slate-50">
                Alerts scan the complete project ledger regardless of date filter constraints.
              </div>
            </div>

            {/* Supplier Spend Summary Card */}
            <div className="bg-white p-6 rounded-3xl border border-[#E2E8F0] shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                  <h3 className="text-xs font-extrabold text-[#07182E] uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-4.5 h-4.5 text-[#FF9F1C] shrink-0" />
                    Supplier Spend Ranking
                  </h3>
                  <span className="text-[10px] text-slate-400 font-bold">Top 5 by total spend</span>
                </div>

                <div className="space-y-3">
                  {supplierSpendSummary.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs font-bold">
                      No supplier spend recorded for the active filters.
                    </div>
                  ) : (
                    supplierSpendSummary.map((supp, idx) => {
                      const spendPercent = totalProcurementSpend > 0 ? (supp.total / totalProcurementSpend) * 100 : 0;
                      return (
                        <div key={idx} className="space-y-1.5">
                          <div className="flex justify-between text-xs font-bold">
                            <div className="flex items-center gap-2 truncate">
                              <span className="w-4.5 h-4.5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[9px] font-black shrink-0">
                                {idx + 1}
                              </span>
                              <span className="text-slate-700 truncate" title={supp.name}>{supp.name}</span>
                              <span className="text-[9px] text-slate-400 font-semibold">({supp.count} items)</span>
                            </div>
                            <span className="text-[#07182E] font-extrabold shrink-0">{formatCurrency(supp.total)}</span>
                          </div>
                          
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-[#FF9F1C] h-1.5 transition-all duration-500" style={{ width: `${spendPercent}%` }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              
              <div className="text-[10px] text-slate-400 font-semibold mt-4 pt-3 border-t border-slate-50">
                Supplier totals represent dynamic active selections.
              </div>
            </div>

          </div>

          {/* THIRD ROW: BREAKDOWN GRID (CATEGORY, STATUS, PRIORITY) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Category Breakdown Panel */}
            <div className="bg-white p-6 rounded-3xl border border-[#E2E8F0] shadow-2xs space-y-4">
              <div className="pb-3 border-b border-slate-100">
                <h3 className="text-xs font-extrabold text-[#07182E] uppercase tracking-wider block">Category Breakdown</h3>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Distribution of active spend</span>
              </div>

              <div className="space-y-4">
                {categoryBreakdown.map((cat, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${cat.text} ${cat.bg}`}>
                        {cat.label}
                      </span>
                      <div className="text-right font-bold text-slate-600">
                        <span>{formatCurrency(cat.amount)}</span>
                        <span className="text-[10px] text-slate-400 font-semibold ml-2">({cat.count} items • {cat.percentage.toFixed(0)}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className={`${cat.barColor} h-1.5`} style={{ width: `${cat.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Status Breakdown Panel */}
            <div className="bg-white p-6 rounded-3xl border border-[#E2E8F0] shadow-2xs space-y-4">
              <div className="pb-3 border-b border-slate-100">
                <h3 className="text-xs font-extrabold text-[#07182E] uppercase tracking-wider block">Status Breakdown</h3>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Costs grouped by workflow stage</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {statusBreakdown.map((st, idx) => (
                  <div key={idx} className={`p-2.5 rounded-xl border border-slate-100 ${st.bg} flex flex-col justify-between`}>
                    <span className={`text-[9px] font-black uppercase tracking-wider ${st.text}`}>{st.status}</span>
                    <div className="mt-2">
                      <span className="text-xs font-extrabold text-[#07182E] block">{formatCurrency(st.amount)}</span>
                      <span className="text-[9px] text-slate-400 font-bold block">{st.count} registered records</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Priority Breakdown Panel */}
            <div className="bg-white p-6 rounded-3xl border border-[#E2E8F0] shadow-2xs space-y-4">
              <div className="pb-3 border-b border-slate-100">
                <h3 className="text-xs font-extrabold text-[#07182E] uppercase tracking-wider block">Priority Breakdown</h3>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Criticality and urgent expenditures</span>
              </div>

              <div className="space-y-4">
                {priorityBreakdown.map((pr, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${pr.text} ${pr.bg}`}>
                        {pr.priority}
                      </span>
                      <div className="text-right font-bold text-slate-600">
                        <span>{formatCurrency(pr.amount)}</span>
                        <span className="text-[10px] text-slate-400 font-semibold ml-2">({pr.count} items • {pr.percentage.toFixed(0)}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className={`${pr.barColor} h-1.5`} style={{ width: `${pr.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

        </div>
      )}


      {/* FOURTH SECTION: PROCUREMENT LEDGER / TABLE */}
      <div className="bg-white border border-[#E2E8F0] rounded-3xl overflow-hidden shadow-xs">
        <div className="p-6 border-b border-[#E2E8F0] flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-extrabold text-[#07182E] uppercase tracking-wide">Procurement Ledger</h2>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Secure, real-time index of quotations, order status, and allocations.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 xl:justify-end shrink-0">
            {/* RECORD COUNT */}
            <span className="text-slate-400 text-xs font-bold mr-1">
              {filteredItems.length} records found
            </span>

            {/* MONTH EXPORT PANEL */}
            <div className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Report Month:</span>
              <select
                value={exportMonth}
                onChange={(e) => setExportMonth(Number(e.target.value))}
                className="bg-transparent text-xs font-bold text-[#07182E] border-none focus:outline-none cursor-pointer"
                title="Select month to export"
              >
                {monthsList.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              
              <select
                value={exportYear}
                onChange={(e) => setExportYear(Number(e.target.value))}
                className="bg-transparent text-xs font-bold text-[#07182E] border-none focus:outline-none cursor-pointer border-l border-slate-200 pl-2 ml-1"
                title="Select year to export"
              >
                {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleExportMonthlyReport}
                disabled={isExporting}
                className="ml-2 flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-xs"
                title="Export Monthly Procurement Report to Excel"
              >
                {isExporting ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                )}
                <span>Export Monthly Report</span>
              </button>
            </div>
          </div>
        </div>

        {/* LEDGER AREA */}
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 font-semibold text-xs">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF9F1C] mx-auto mb-3"></div>
            Loading procurement items from Supabase ledger...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center">
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
              <FolderOpen className="w-8 h-8 text-slate-300" />
            </div>
            {selectedDate ? (
              <p className="text-xs font-bold text-slate-400">
                No procurement items recorded on {formatUserFriendlyDate(selectedDate)}.
              </p>
            ) : (
              <div>
                <p className="text-xs font-bold text-slate-500">No procurement items have been recorded yet.</p>
                <button
                  onClick={() => handleOpenNewForm()}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-extrabold text-[#FF9F1C] hover:text-[#E58A13] uppercase tracking-wider cursor-pointer"
                >
                  Create your first record <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-[#E2E8F0]">
                  <th className="py-4 px-6">Date</th>
                  <th className="py-4 px-4">Category</th>
                  <th className="py-4 px-4">Subcategory</th>
                  <th className="py-4 px-4">Item / Service</th>
                  <th className="py-4 px-4">Allocation Link</th>
                  <th className="py-4 px-4">Supplier</th>
                  <th className="py-4 px-4">Invoice / Quotation No.</th>
                  <th className="py-4 px-4 text-center">Quantity</th>
                  <th className="py-4 px-4 text-right">Unit Rate</th>
                  <th className="py-4 px-4 text-right">Total Amount</th>
                  <th className="py-4 px-4 text-center">Status</th>
                  <th className="py-4 px-4 text-center">Priority</th>
                  <th className="py-4 px-6 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredItems.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Date */}
                    <td className="py-4 px-6 font-bold text-slate-600 whitespace-nowrap">
                      {formatUserFriendlyDate(item.procurement_date)}
                    </td>
                    
                    {/* Category */}
                    <td className="py-4 px-4 font-extrabold text-[#07182E] uppercase tracking-wide">
                      {item.category}
                    </td>
                    
                    {/* Subcategory */}
                    <td className="py-4 px-4 font-semibold text-slate-500">
                      {item.subcategory}
                    </td>
                    
                    {/* Item */}
                    <td className="py-4 px-4 font-extrabold text-[#07182E] max-w-[180px] truncate" title={item.item_name}>
                      {item.item_name}
                    </td>

                    {/* Allocation Link */}
                    <td className="py-4 px-4 text-xs font-semibold whitespace-nowrap">
                      {item.programme_id ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-extrabold text-[#FF9F1C] truncate max-w-[150px]" title={programmes.find(p => p.id === item.programme_id)?.programme_name || "Programme"}>
                            {programmes.find(p => p.id === item.programme_id)?.programme_name || "Programme"}
                          </span>
                          {item.programme_activity_id && (
                            <span className="text-[10px] text-slate-400 font-bold truncate max-w-[150px]" title={activities.find(a => a.id === item.programme_activity_id)?.activity_name || "Activity"}>
                              ↳ {activities.find(a => a.id === item.programme_activity_id)?.wbs_code ? `[${activities.find(a => a.id === item.programme_activity_id)?.wbs_code}] ` : ""}{activities.find(a => a.id === item.programme_activity_id)?.activity_name || "Activity"}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300 font-bold italic">Unlinked</span>
                      )}
                    </td>
                    
                    {/* Supplier */}
                    <td className="py-4 px-4 font-bold text-slate-600 truncate max-w-[140px]" title={item.supplier_name}>
                      {item.supplier_name}
                    </td>
                    
                    {/* Quotation */}
                    <td className="py-4 px-4 font-mono font-bold text-slate-400">
                      {item.quotation_number}
                    </td>
                    
                    {/* Quantity */}
                    <td className="py-4 px-4 text-center font-bold text-slate-700 whitespace-nowrap">
                      {item.quantity} <span className="text-[10px] text-slate-400 font-semibold">{item.unit}</span>
                    </td>
                    
                    {/* Rate */}
                    <td className="py-4 px-4 text-right font-semibold text-slate-500">
                      {formatCurrency(item.unit_rate)}
                    </td>
                    
                    {/* Total */}
                    <td className="py-4 px-4 text-right font-extrabold text-[#07182E] whitespace-nowrap">
                      {formatCurrency(item.total_amount)}
                    </td>
                    
                    {/* Status */}
                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${statusBadgeStyle(item.status)}`}>
                          {item.status}
                        </span>
                        {item.proof_of_payment_path && (
                          <span className="text-[8px] font-black text-blue-600 bg-blue-50 px-1 rounded border border-blue-200 flex items-center gap-0.5" title="Proof of Payment Attached">
                            <Paperclip className="w-2 h-2 text-blue-500 shrink-0" /> PoP Added
                          </span>
                        )}
                      </div>
                    </td>
                    
                    {/* Priority */}
                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${priorityBadgeStyle(item.priority)}`}>
                        {item.priority}
                      </span>
                    </td>
                    
                    {/* Actions */}
                    <td className="py-4 px-6 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-3">
                        {/* Core actions */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setViewingItem(item)}
                            className="p-1.5 text-slate-400 hover:text-[#07182E] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEditForm(item)}
                            className="p-1.5 text-slate-400 hover:text-[#FF9F1C] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteRecord(item)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Delete"
                            aria-label={`Delete ${item.item_name ?? "procurement record"}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Quotation files actions */}
                        <div className="flex items-center gap-1 border-l border-slate-200 pl-3">
                          {item.quotation_file_path ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleViewQuotation(item)}
                                className="px-2 py-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded transition-colors cursor-pointer animate-fade-in"
                                title="View Quotation"
                              >
                                View Quotation
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadQuotation(item)}
                                className="px-2 py-1 text-[10px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded transition-colors cursor-pointer animate-fade-in"
                                title="Download Quotation"
                              >
                                Download Quotation
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-300 font-medium italic px-2">No Quotation</span>
                          )}
                        </div>

                        {/* Proof of Payment files actions */}
                        <div className="flex items-center gap-1 border-l border-slate-200 pl-3">
                          {item.proof_of_payment_path ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleViewProofOfPayment(item)}
                                className="px-2 py-1 text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors cursor-pointer animate-fade-in"
                                title="View Proof of Payment"
                              >
                                View Proof of Payment
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadProofOfPayment(item)}
                                className="px-2 py-1 text-[10px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded transition-colors cursor-pointer animate-fade-in"
                                title="Download Proof of Payment"
                              >
                                Download Proof of Payment
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-300 font-medium italic px-2">No Proof of Payment</span>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      ) : activeTab === "forecast" ? (
        <div className="space-y-6">
          {/* SQL SCHEMA SETUP BANNER IF TABLE IS LACKING */}
          {!dbForecastExists && dbForecastExists !== null && (
            <div className="bg-amber-50 border border-amber-200 p-6 rounded-3xl space-y-4">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-black uppercase text-amber-800 tracking-wider">Local Storage Sandbox Active</h3>
                  <p className="text-xs text-amber-700 mt-1 font-semibold">
                    The <strong>procurement_forecasts</strong> database table was not detected in your Supabase project. 
                    All forecast adjustments will save locally in your browser sandbox until the table is initialized.
                  </p>
                </div>
              </div>
              <details className="bg-amber-100/50 rounded-xl p-3 border border-amber-200 cursor-pointer">
                <summary className="text-[11px] font-bold text-amber-800 select-none">View Minimal SQL for Supabase Editor</summary>
                <div className="mt-2 text-[10px] font-mono bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto select-all leading-relaxed">
                  {`CREATE TABLE IF NOT EXISTS public.procurement_forecasts (
    id uuid primary key default gen_random_uuid(),
    company_id uuid not null references public.companies(id) on delete cascade,
    project_id uuid not null references public.projects(id) on delete cascade,
    forecast_month integer not null check (forecast_month between 1 and 12),
    forecast_year integer not null,
    category text not null,
    forecast_amount_excl_vat numeric default 0,
    forecast_vat numeric default 0,
    forecast_total_amount numeric default 0,
    notes text,
    created_by uuid references auth.users(id),
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Row Level Security
ALTER TABLE public.procurement_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all for project members"
ON public.procurement_forecasts FOR ALL
USING (public.verify_membership_access(company_id, project_id))
WITH CHECK (public.verify_membership_access(company_id, project_id));`}
                </div>
              </details>
            </div>
          )}

          {/* FORECAST PLAN CONTROLS */}
          <div className="bg-white p-6 rounded-3xl border border-[#E2E8F0] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-black text-[#07182E] uppercase tracking-wider">Select Planning Year:</span>
              <select
                value={forecastYearFilter}
                onChange={(e) => setForecastYearFilter(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 text-xs font-extrabold text-[#07182E] rounded-xl px-4 py-2 focus:outline-none"
              >
                {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => handleOpenForecastForm(null)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#FF9F1C] to-[#E58A13] hover:from-[#FFA933] hover:to-[#FF9F1C] text-white font-extrabold text-xs rounded-xl shadow-lg shadow-[#FF9F1C]/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              Add Forecast Entry
            </button>
          </div>

          {/* MONTHLY FORECAST OVERVIEW */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Array.from({ length: 12 }, (_, i) => {
              const monthNum = i + 1;
              const monthName = monthsList.find(m => m.value === monthNum)?.label || "";
              const monthForecasts = forecasts.filter(f => f.forecast_year === forecastYearFilter && f.forecast_month === monthNum);
              const exclVatTotal = monthForecasts.reduce((acc, f) => acc + (f.forecast_amount_excl_vat || 0), 0);
              const vatTotal = monthForecasts.reduce((acc, f) => acc + (f.forecast_vat || 0), 0);
              const totalAmount = monthForecasts.reduce((acc, f) => acc + (f.forecast_total_amount || 0), 0);

              return (
                <div key={monthNum} className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col justify-between shadow-2xs">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wide">{monthName}</span>
                  <div className="mt-2">
                    <span className="text-sm font-extrabold text-[#07182E] block">{formatCurrency(totalAmount)}</span>
                    <span className="text-[9px] text-slate-400 font-bold block mt-0.5">Excl. {formatCurrency(exclVatTotal)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* OVERALL ANNUAL TOTAL */}
          <div className="bg-[#07182E] p-6 rounded-3xl text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF9F1C]">Annual Planning Summary ({forecastYearFilter})</span>
              <h3 className="text-3xl font-black mt-1">
                {formatCurrency(forecasts.filter(f => f.forecast_year === forecastYearFilter).reduce((acc, f) => acc + (f.forecast_total_amount || 0), 0))}
              </h3>
            </div>
            <div className="grid grid-cols-3 gap-6 text-xs border-l md:border-l border-white/10 pl-0 md:pl-6">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Entries</span>
                <span className="font-extrabold text-slate-200 mt-0.5 block">{forecasts.filter(f => f.forecast_year === forecastYearFilter).length} rows</span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Total Excl. VAT</span>
                <span className="font-extrabold text-slate-200 mt-0.5 block">
                  {formatCurrency(forecasts.filter(f => f.forecast_year === forecastYearFilter).reduce((acc, f) => acc + (f.forecast_amount_excl_vat || 0), 0))}
                </span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Total VAT</span>
                <span className="font-extrabold text-[#FF9F1C] mt-0.5 block">
                  {formatCurrency(forecasts.filter(f => f.forecast_year === forecastYearFilter).reduce((acc, f) => acc + (f.forecast_vat || 0), 0))}
                </span>
              </div>
            </div>
          </div>

          {/* FORECAST REGISTER TABLE */}
          <div className="bg-white border border-[#E2E8F0] rounded-3xl overflow-hidden shadow-xs">
            <div className="p-6 border-b border-[#E2E8F0]">
              <h2 className="text-sm font-extrabold text-[#07182E] uppercase tracking-wide">Forecast Registry</h2>
              <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Budget boundaries and plans configured for {forecastYearFilter}.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    <th className="py-3.5 px-6">Month</th>
                    <th className="py-3.5 px-4 text-center">Category</th>
                    <th className="py-3.5 px-4 text-right">Excl. VAT ({currencyCode})</th>
                    <th className="py-3.5 px-4 text-right">VAT ({currencyCode})</th>
                    <th className="py-3.5 px-4 text-right">Total ({currencyCode})</th>
                    <th className="py-3.5 px-6">Notes</th>
                    <th className="py-3.5 px-6 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {forecasts.filter(f => f.forecast_year === forecastYearFilter).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 font-bold italic">
                        No forecast plans recorded for {forecastYearFilter}. Click 'Add Forecast Entry' to initialize.
                      </td>
                    </tr>
                  ) : (
                    forecasts
                      .filter(f => f.forecast_year === forecastYearFilter)
                      .sort((a, b) => a.forecast_month - b.forecast_month)
                      .map((f) => (
                        <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-4 px-6 font-extrabold text-[#07182E]">
                            {monthsList.find(m => m.value === f.forecast_month)?.label}
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[9px] font-extrabold uppercase rounded">
                              {f.category}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right font-bold text-slate-600">
                            {formatCurrency(f.forecast_amount_excl_vat || 0)}
                          </td>
                          <td className="py-4 px-4 text-right font-bold text-slate-600">
                            {formatCurrency(f.forecast_vat || 0)}
                          </td>
                          <td className="py-4 px-4 text-right font-black text-[#07182E]">
                            {formatCurrency(f.forecast_total_amount || 0)}
                          </td>
                          <td className="py-4 px-6 text-slate-500 max-w-xs truncate" title={f.notes}>
                            {f.notes || "—"}
                          </td>
                          <td className="py-4 px-6 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleOpenForecastForm(f)}
                                className="p-1.5 text-slate-400 hover:text-[#FF9F1C] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Edit Forecast"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteForecast(f)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Delete Forecast"
                                aria-label={`Delete forecast row for ${monthsList.find(m => m.value === f.forecast_month)?.label ?? "month"}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* INVENTORY AND STATUS VIEW */
        <InventoryStatusView
          companyId={activeCompany?.id}
          projectId={activeProject?.id}
          procurementItems={items}
        />
      )}

      {/* FORECAST FORM MODAL */}
      {isForecastFormOpen && (
        <div className="fixed inset-0 bg-[#07182E]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <form
            onSubmit={handleSaveForecast}
            className="bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl w-full max-w-[720px] max-h-[90vh] flex flex-col overflow-hidden animate-scale-up"
          >
            {/* Header */}
            <div className="bg-[#07182E] p-5 text-white flex items-center justify-between shrink-0">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#FF9F1C]">Forecast Plan</span>
                <h3 className="text-sm font-extrabold flex items-center gap-2 mt-0.5 uppercase tracking-wide">
                  {editingForecast ? "Edit Forecast entry" : "Create Forecast Entry"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsForecastFormOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <div 
              className="p-6 space-y-4 overflow-y-auto pb-[120px]"
              style={{ maxHeight: "calc(90vh - 160px)" }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-[#07182E] tracking-wider block mb-1">Month</label>
                  <select
                    value={fcMonth}
                    onChange={(e) => setFcMonth(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
                    required
                  >
                    {monthsList.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-[#07182E] tracking-wider block mb-1">Year</label>
                  <input
                    type="number"
                    value={fcYear}
                    onChange={(e) => setFcYear(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
                    min="2020"
                    max="2035"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-[#07182E] tracking-wider block mb-1">Category</label>
                <select
                  value={fcCategory}
                  onChange={(e) => setFcCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
                  required
                >
                  <option value="OHS">OHS</option>
                  <option value="Site Establishment">Site Establishment</option>
                  <option value="Operational Costs">Operational Costs</option>
                  <option value="Environmental">Environmental</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-[#07182E] tracking-wider block mb-1">Forecast Excl. VAT (R)</label>
                  <input
                    type="number"
                    value={fcExclVat}
                    onChange={(e) => handleExclVatChange(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-[#07182E] tracking-wider block mb-1">Forecast VAT (R)</label>
                  <input
                    type="number"
                    value={fcVat}
                    onChange={(e) => setFcVat(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Calculated Total (R)</label>
                <div className="bg-[#07182E]/5 text-[#07182E] p-3 rounded-xl text-sm font-black border border-[#07182E]/10">
                  {formatCurrency(fcTotal)}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-[#07182E] tracking-wider block mb-1">Notes</label>
                <textarea
                  value={fcNotes}
                  onChange={(e) => setFcNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none h-20 resize-none"
                  placeholder="Budget notes, reference identifiers, etc..."
                />
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 flex items-center justify-end gap-2 p-5 bg-white border-t border-slate-150 shrink-0 z-10">
              <button
                type="button"
                onClick={() => setIsForecastFormOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-slate-500 font-bold text-xs hover:bg-slate-100 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#FF9F1C] hover:bg-[#FFA933] text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer shadow-md shadow-[#FF9F1C]/10"
              >
                {editingForecast ? "Update Row" : "Save Entry"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FORM MODAL: ADD / EDIT PROCUREMENT ITEM */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-[#07182E]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <form
            onSubmit={handleSaveItem}
            className="bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl w-full max-w-2xl h-full sm:h-auto max-h-full sm:max-h-[90vh] flex flex-col overflow-hidden animate-scale-up"
          >
            {/* Header - Fixed/Sticky at top */}
            <div className="bg-[#07182E] p-5 text-white flex items-center justify-between shrink-0">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#FF9F1C]">Procurement Portal</span>
                <h3 className="text-sm font-extrabold flex items-center gap-2 mt-0.5 uppercase tracking-wide">
                  {editingItem ? "Edit Procurement Item" : "Create Procurement Entry"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1 sm:max-h-[calc(90vh-140px)] max-h-[calc(100vh-140px)] pb-12">
              
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-xl text-[11px] font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Categorization & Details Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* 1. Category */}
                <div>
                  <label className="block text-[9px] font-extrabold text-[#07182E] uppercase tracking-wider mb-1">
                    Procurement Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ProcurementCategory)}
                    className="w-full px-3 py-2 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#FF9F1C] focus:bg-white focus:ring-1 focus:ring-[#FF9F1C] outline-none transition-all cursor-pointer"
                  >
                    <option value="all">All Categories</option>
                    <option value="OHS">Occupational Health and Safety (OHS)</option>
                    <option value="Site Establishment">Site Establishment</option>
                    <option value="Operational Costs">Operational Costs</option>
                    <option value="Environmental">Environmental</option>
                  </select>
                </div>

                {/* 2. Subcategory */}
                <div>
                  <label className="block text-[9px] font-extrabold text-[#07182E] uppercase tracking-wider mb-1">
                    Subcategory
                  </label>
                  <select
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#FF9F1C] focus:bg-white focus:ring-1 focus:ring-[#FF9F1C] outline-none transition-all cursor-pointer"
                  >
                    {getSubcategories(category).map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>

                {/* 3. Item Name */}
                <div className="sm:col-span-2">
                  <label className="block text-[9px] font-extrabold text-[#07182E] uppercase tracking-wider mb-1">
                    Item / Service Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 50x Reflector Vests Class 2, Site Grading Support..."
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold text-[#07182E] bg-slate-50 border border-slate-200 rounded-xl focus:border-[#FF9F1C] focus:bg-white focus:ring-1 focus:ring-[#FF9F1C] outline-none transition-all"
                  />
                </div>

                {/* 4. Supplier */}
                <div>
                  <label className="block text-[9px] font-extrabold text-[#07182E] uppercase tracking-wider mb-1">
                    Supplier / Contractor Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BuildSafe Suppliers, Rapid Plant Hire..."
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold text-[#07182E] bg-slate-50 border border-slate-200 rounded-xl focus:border-[#FF9F1C] focus:bg-white focus:ring-1 focus:ring-[#FF9F1C] outline-none transition-all"
                  />
                </div>

                {/* 5. Quotation Number */}
                <div>
                  <label className="block text-[9px] font-extrabold text-[#07182E] uppercase tracking-wider mb-1">
                    Invoice / Quotation Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. INV-1024, QT-99808, PR-445"
                    value={quotationNumber}
                    onChange={(e) => setQuotationNumber(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#FF9F1C] focus:bg-white focus:ring-1 focus:ring-[#FF9F1C] outline-none transition-all"
                  />
                </div>

                {/* 6. Procurement Date */}
                <div>
                  <label className="block text-[9px] font-extrabold text-[#07182E] uppercase tracking-wider mb-1">
                    Procurement Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={procurementDate}
                    onChange={(e) => setProcurementDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#FF9F1C] focus:bg-white focus:ring-1 focus:ring-[#FF9F1C] outline-none transition-all cursor-pointer"
                  />
                </div>

                {/* 7. Required By Date */}
                <div>
                  <label className="block text-[9px] font-extrabold text-[#07182E] uppercase tracking-wider mb-1">
                    Required By Date
                  </label>
                  <input
                    type="date"
                    value={requiredByDate}
                    onChange={(e) => setRequiredByDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#FF9F1C] focus:bg-white focus:ring-1 focus:ring-[#FF9F1C] outline-none transition-all cursor-pointer"
                  />
                </div>

                {/* 8-11. Calculations & Values */}
                <div className="grid grid-cols-2 gap-3 sm:col-span-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  
                  <div>
                    <label className="block text-[9px] font-extrabold text-[#07182E] uppercase tracking-wider mb-1">
                      Quantity *
                    </label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="any"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full px-3 py-1.5 text-xs font-bold text-[#07182E] bg-white border border-slate-200 rounded-xl outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-extrabold text-[#07182E] uppercase tracking-wider mb-1">
                      Unit
                    </label>
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-xl outline-none cursor-pointer"
                    >
                      <option value="Each">Each</option>
                      <option value="m">m (Metres)</option>
                      <option value="m2">m² (Square Metres)</option>
                      <option value="m3">m³ (Cubic Metres)</option>
                      <option value="kg">kg (Kilograms)</option>
                      <option value="ton">Tons</option>
                      <option value="Litre">Litres</option>
                      <option value="Hours">Hours</option>
                      <option value="Days">Days</option>
                      <option value="Lump Sum">Lump Sum</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-extrabold text-[#07182E] uppercase tracking-wider mb-1">
                      Unit Rate ({currencyCode}) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={unitRate}
                      onChange={(e) => setUnitRate(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full px-3 py-1.5 text-xs font-bold text-[#07182E] bg-white border border-slate-200 rounded-xl outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-extrabold text-[#07182E] uppercase tracking-wider mb-1">
                      VAT %
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      max="100"
                      step="any"
                      value={vatPercentage}
                      onChange={(e) => setVatPercentage(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full px-3 py-1.5 text-xs font-bold text-[#07182E] bg-white border border-slate-200 rounded-xl outline-none"
                    />
                  </div>

                  {/* Calculations breakdown display */}
                  <div className="col-span-2 grid grid-cols-3 gap-2 pt-3 border-t border-slate-200 text-center text-xs">
                    <div>
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wide block">Excluding VAT</span>
                      <span className="font-extrabold text-slate-700 block mt-0.5">{formatCurrency(amountExclVat)}</span>
                    </div>
                    <div>
                      <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-wide block">VAT Amount</span>
                      <span className="font-extrabold text-slate-500 block mt-0.5">{formatCurrency(vatAmount)}</span>
                    </div>
                    <div className="bg-[#07182E]/5 rounded-xl py-1">
                      <span className="text-[8px] font-extrabold text-slate-500 uppercase tracking-wide block">Total Cost</span>
                      <span className="font-black text-[#FF9F1C] block mt-0.5">{formatCurrency(totalAmountInclVat)}</span>
                    </div>
                  </div>

                </div>

                {/* 15. Status */}
                <div>
                  <label className="block text-[9px] font-extrabold text-[#07182E] uppercase tracking-wider mb-1">
                    Ledger Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ProcurementItem["status"])}
                    className="w-full px-3 py-2 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#FF9F1C] focus:bg-white focus:ring-1 focus:ring-[#FF9F1C] outline-none transition-all cursor-pointer"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Quotation Received">Quotation Received</option>
                    <option value="Approved">Approved</option>
                    <option value="Procured">Procured</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Paid">Paid</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                {/* 16. Priority */}
                <div>
                  <label className="block text-[9px] font-extrabold text-[#07182E] uppercase tracking-wider mb-1">
                    Priority Rating
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as ProcurementItem["priority"])}
                    className="w-full px-3 py-2 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:border-[#FF9F1C] focus:bg-white focus:ring-1 focus:ring-[#FF9F1C] outline-none transition-all cursor-pointer"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>

                {/* PROGRAMME LINKAGE SECTION */}
                <div className="sm:col-span-2 bg-[#07182E]/5 p-4 rounded-2xl border border-[#07182E]/10 space-y-3">
                  <h4 className="text-[10px] font-black text-[#07182E] uppercase tracking-wider flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[#FF9F1C]" />
                    Programme Linkage
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Programme Dropdown */}
                    <div>
                      <label className="block text-[9px] font-extrabold text-[#07182E] uppercase tracking-wider mb-1">
                        Programme
                      </label>
                      <select
                        value={selectedProgrammeId}
                        onChange={(e) => {
                          setSelectedProgrammeId(e.target.value);
                          setSelectedActivityId(""); // reset activity when programme changes
                        }}
                        className="w-full px-3 py-2 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-xl outline-none transition-all cursor-pointer"
                      >
                        <option value="">-- Unlinked / General --</option>
                        {programmes.map((prog) => (
                          <option key={prog.id} value={prog.id}>
                            {prog.programme_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Programme Activity Dropdown */}
                    <div>
                      <label className="block text-[9px] font-extrabold text-[#07182E] uppercase tracking-wider mb-1">
                        Programme Activity
                      </label>
                      <select
                        value={selectedActivityId}
                        disabled={!selectedProgrammeId}
                        onChange={(e) => setSelectedActivityId(e.target.value)}
                        className={`w-full px-3 py-2 text-xs font-bold text-slate-800 border rounded-xl outline-none transition-all cursor-pointer ${
                          !selectedProgrammeId 
                            ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed" 
                            : "bg-white border-slate-200"
                        }`}
                      >
                        <option value="">-- Select Activity --</option>
                        {activities
                          .filter((act) => act.programme_id === selectedProgrammeId)
                          .map((act) => (
                            <option key={act.id} value={act.id}>
                              {act.wbs_code ? `[${act.wbs_code}] ` : ""}{act.activity_name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 17. Notes */}
                <div className="sm:col-span-2">
                  <label className="block text-[9px] font-extrabold text-[#07182E] uppercase tracking-wider mb-1">
                    Procurement Notes / Justification
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Provide additional details, delivery constraints, sub-location specifics..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold text-[#07182E] bg-slate-50 border border-slate-200 rounded-xl focus:border-[#FF9F1C] focus:bg-white focus:ring-1 focus:ring-[#FF9F1C] outline-none transition-all"
                  />
                </div>

                {/* 18. Quotation Upload (Real Storage Upload) */}
                <div className="sm:col-span-2">
                  <label className="block text-[9px] font-extrabold text-[#07182E] uppercase tracking-wider mb-1">
                    Upload Quotation File (PDF, DOCX, XLSX, PNG, JPG)
                  </label>
                  <div className="mt-1 border-2 border-dashed border-slate-200 rounded-2xl p-4 hover:border-[#FF9F1C]/50 transition-colors bg-slate-50/50 flex flex-col items-center justify-center relative">
                    <input
                      type="file"
                      accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    
                    <Paperclip className="w-6 h-6 text-slate-400 mb-1.5" />
                    
                    {quotationFile ? (
                      <div className="text-center">
                        <span className="text-xs font-extrabold text-[#07182E] block max-w-xs truncate">{quotationFile.name}</span>
                        <span className="text-[10px] text-slate-400 font-bold block mt-0.5">{quotationFile.size} • Click or drag to replace</span>
                      </div>
                    ) : (
                      <div className="text-center">
                        <span className="text-xs font-extrabold text-slate-600 block">Drag file here or click to select</span>
                        <span className="text-[10px] text-slate-400 font-bold block mt-0.5">Max size 10MB • Secured on ledger</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 19. Proof of Payment Upload */}
                <div className="sm:col-span-2">
                  <label className="block text-[9px] font-extrabold text-[#07182E] uppercase tracking-wider mb-1">
                    Upload Proof of Payment File (PDF, DOCX, XLSX, PNG, JPG) {["Procured", "Delivered", "Paid"].includes(status) ? <span className="text-rose-500 font-bold">* (Required)</span> : <span className="text-slate-400 font-normal">(Optional)</span>}
                  </label>
                  <div className={`mt-1 border-2 border-dashed rounded-2xl p-4 transition-colors flex flex-col items-center justify-center relative ${["Procured", "Delivered", "Paid"].includes(status) ? "border-rose-200 hover:border-rose-400 bg-rose-50/10" : "border-slate-200 hover:border-[#FF9F1C]/50 bg-slate-50/50"}`}>
                    <input
                      type="file"
                      accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
                      onChange={handleProofOfPaymentFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    
                    <Paperclip className="w-6 h-6 text-slate-400 mb-1.5" />
                    
                    {proofOfPaymentFileState ? (
                      <div className="text-center">
                        <span className="text-xs font-extrabold text-[#07182E] block max-w-xs truncate">{proofOfPaymentFileState.name}</span>
                        <span className="text-[10px] text-slate-400 font-bold block mt-0.5">{proofOfPaymentFileState.size} • Click or drag to replace</span>
                      </div>
                    ) : (
                      <div className="text-center">
                        <span className="text-xs font-extrabold text-slate-600 block">Drag file here or click to select</span>
                        <span className="text-[10px] text-slate-400 font-bold block mt-0.5">Max size 10MB • Secured on ledger</span>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* Footer - Sticky/Fixed at bottom */}
            <div className="flex items-center justify-end gap-3 p-5 bg-white border-t border-slate-100 sticky bottom-0 z-10 shrink-0">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-[#07182E] border border-slate-200 bg-white rounded-xl cursor-pointer"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-extrabold text-white bg-[#FF9F1C] hover:bg-[#FFA933] rounded-xl shadow-md shadow-[#FF9F1C]/10 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    Saving...
                  </>
                ) : (
                  "Save Procurement Item"
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* DETAIL MODAL: VIEW DETAILS */}
      {viewingItem && (
        <div className="fixed inset-0 bg-[#07182E]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl w-full max-w-md h-full sm:h-auto max-h-full sm:max-h-[90vh] flex flex-col overflow-hidden animate-scale-up">
            {/* Header - Fixed/Sticky at top */}
            <div className="bg-[#07182E] p-5 text-white flex items-center justify-between shrink-0">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#FF9F1C]">{viewingItem.category} Details</span>
                <h3 className="text-sm font-extrabold mt-0.5 uppercase tracking-wide">
                  {viewingItem.item_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingItem(null)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1 sm:max-h-[calc(90vh-140px)] max-h-[calc(100vh-140px)] pb-12 text-xs">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Category</span>
                  <span className="font-extrabold text-[#07182E] mt-0.5 block">{viewingItem.category}</span>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Subcategory</span>
                  <span className="font-extrabold text-slate-600 mt-0.5 block">{viewingItem.subcategory}</span>
                </div>
                
                <div className="col-span-2 border-t border-slate-100 pt-3">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Item / Service Name</span>
                  <span className="font-bold text-[#07182E] mt-0.5 block text-sm">{viewingItem.item_name}</span>
                </div>

                <div className="col-span-2 border-t border-slate-100 pt-3">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Supplier / Contractor</span>
                  <span className="font-bold text-slate-700 mt-0.5 block">{viewingItem.supplier_name}</span>
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Invoice / Quotation No.</span>
                  <span className="font-mono font-bold text-slate-800 mt-0.5 block">{viewingItem.quotation_number}</span>
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Required By Date</span>
                  <span className="font-bold text-slate-800 mt-0.5 block">{formatUserFriendlyDate(viewingItem.required_by_date)}</span>
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Quantity & Unit</span>
                  <span className="font-bold text-[#07182E] mt-0.5 block">{viewingItem.quantity} {viewingItem.unit}</span>
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Unit Rate</span>
                  <span className="font-bold text-slate-600 mt-0.5 block">{formatCurrency(viewingItem.unit_rate)}</span>
                </div>

                <div className="col-span-2 border-t border-slate-100 pt-3 bg-slate-50 p-3 rounded-2xl border border-slate-100 grid grid-cols-2 gap-2 text-center">
                  <div>
                    <span className="text-[8px] font-bold text-slate-400 uppercase block">Amount Excl. VAT</span>
                    <span className="font-bold text-slate-700 block mt-0.5">{formatCurrency(viewingItem.amount_excl_vat)}</span>
                  </div>
                  <div>
                    <span className="text-[8px] font-bold text-slate-400 uppercase block">Total Incl. VAT</span>
                    <span className="font-black text-[#FF9F1C] block mt-0.5">{formatCurrency(viewingItem.total_amount)}</span>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Ledger Status</span>
                  <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${statusBadgeStyle(viewingItem.status)}`}>
                    {viewingItem.status}
                  </span>
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Priority</span>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-bold ${priorityBadgeStyle(viewingItem.priority)}`}>
                    {viewingItem.priority}
                  </span>
                </div>

                {viewingItem.notes && (
                  <div className="col-span-2 border-t border-slate-100 pt-3">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Notes</span>
                    <p className="text-slate-600 mt-1 leading-relaxed whitespace-pre-wrap">{viewingItem.notes}</p>
                  </div>
                )}

                {/* Programme Linkage Info */}
                <div className="col-span-2 border-t border-slate-100 pt-3">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Allocation / Linkage</span>
                  {viewingItem.programme_id ? (
                    <div className="mt-1.5 p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Linked Programme:</span>
                        <span className="font-bold text-[#07182E] truncate max-w-[200px]">
                          {programmes.find(p => p.id === viewingItem.programme_id)?.programme_name || "Programme"}
                        </span>
                      </div>
                      {viewingItem.programme_activity_id && (
                        <div className="flex justify-between items-center text-xs border-t border-slate-100 pt-1.5 mt-1.5">
                          <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Linked Activity:</span>
                          <span className="font-bold text-slate-600 truncate max-w-[200px]">
                            {activities.find(a => a.id === viewingItem.programme_activity_id)?.wbs_code ? `[${activities.find(a => a.id === viewingItem.programme_activity_id)?.wbs_code}] ` : ""}
                            {activities.find(a => a.id === viewingItem.programme_activity_id)?.activity_name || "Activity"}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-400 font-bold italic mt-1 block">Unlinked / General Ledger Item</span>
                  )}
                </div>

                {viewingItem.quotation_file_name && (
                  <div className="col-span-2 border-t border-slate-100 pt-3 flex items-center justify-between gap-2 bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
                    <div className="flex items-center gap-2">
                      <Paperclip className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Quotation Attachment</span>
                        <span className="font-extrabold text-emerald-800 text-[11px] block">{viewingItem.quotation_file_name} ({formatBytes(viewingItem.quotation_file_size)})</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleViewQuotation(viewingItem)}
                        className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-700 rounded-lg cursor-pointer"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadQuotation(viewingItem)}
                        className="px-2 py-1 bg-[#FF9F1C] hover:bg-[#FFA933] text-white text-[10px] font-extrabold rounded-lg cursor-pointer"
                      >
                        Download
                      </button>
                    </div>
                  </div>
                )}

                {viewingItem.proof_of_payment_file_name && (
                  <div className="col-span-2 border-t border-slate-100 pt-3 flex items-center justify-between gap-2 bg-blue-50 p-2.5 rounded-xl border border-blue-100">
                    <div className="flex items-center gap-2">
                      <Paperclip className="w-4 h-4 text-blue-600 shrink-0" />
                      <div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Proof of Payment Attachment</span>
                        <span className="font-extrabold text-blue-800 text-[11px] block">{viewingItem.proof_of_payment_file_name} ({formatBytes(viewingItem.proof_of_payment_file_size)})</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleViewProofOfPayment(viewingItem)}
                        className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-700 rounded-lg cursor-pointer"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadProofOfPayment(viewingItem)}
                        className="px-2 py-1 bg-[#FF9F1C] hover:bg-[#FFA933] text-white text-[10px] font-extrabold rounded-lg cursor-pointer"
                      >
                        Download
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Footer - Sticky/Fixed at bottom */}
            <div className="flex items-center justify-end p-5 bg-white border-t border-slate-100 sticky bottom-0 z-10 shrink-0">
              <button
                type="button"
                onClick={() => setViewingItem(null)}
                className="px-5 py-2 text-xs font-extrabold text-white bg-[#07182E] hover:bg-[#102846] rounded-xl transition-all cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTROLLED DELETION MODAL: PROCUREMENT RECORD */}
      {pendingDeleteRecord && (
        <div className="fixed inset-0 bg-[#07182E]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-scale-up">
            {/* Header */}
            <div className="bg-rose-950 p-5 text-white flex items-center justify-between shrink-0">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-rose-300">Danger Zone</span>
                <h3 className="text-sm font-extrabold flex items-center gap-2 mt-0.5 uppercase tracking-wide">
                  Delete Procurement Record?
                </h3>
              </div>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setPendingDeleteRecord(null)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-500 leading-relaxed font-semibold">
                This action will permanently remove this procurement record and any related file references. This action cannot be undone.
              </p>

              {/* Identifying Info Panel */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2 text-slate-700">
                <div className="flex justify-between items-start gap-4">
                  <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider mt-0.5">Item/Description:</span>
                  <span className="font-black text-[#07182E] text-right">{pendingDeleteRecord.item_name}</span>
                </div>
                <div className="flex justify-between items-center gap-4">
                  <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Supplier:</span>
                  <span className="font-extrabold text-slate-700 text-right">{pendingDeleteRecord.supplier_name || "—"}</span>
                </div>
                <div className="flex justify-between items-center gap-4">
                  <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Quotation Number:</span>
                  <span className="font-mono text-slate-600 text-right">{pendingDeleteRecord.quotation_number || "—"}</span>
                </div>
                <div className="flex justify-between items-center gap-4">
                  <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Total Amount:</span>
                  <span className="font-black text-rose-600 text-right">{formatCurrency(pendingDeleteRecord.total_amount)}</span>
                </div>
                <div className="flex justify-between items-center gap-4">
                  <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Current Status:</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${statusBadgeStyle ? statusBadgeStyle(pendingDeleteRecord.status) : "bg-slate-100 text-slate-700"}`}>
                    {pendingDeleteRecord.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-5 bg-slate-50 border-t border-slate-100 sticky bottom-0 z-10 shrink-0">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setPendingDeleteRecord(null)}
                className="px-4 py-2 text-xs font-extrabold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDeleteProcurementRecord}
                className="px-5 py-2 text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                    Deleting…
                  </>
                ) : (
                  "Delete Record"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTROLLED DELETION MODAL: FORECAST RECORD */}
      {pendingDeleteForecast && (
        <div className="fixed inset-0 bg-[#07182E]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-scale-up">
            {/* Header */}
            <div className="bg-rose-950 p-5 text-white flex items-center justify-between shrink-0">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-wider text-rose-300">Danger Zone</span>
                <h3 className="text-sm font-extrabold flex items-center gap-2 mt-0.5 uppercase tracking-wide">
                  Delete Forecast Record?
                </h3>
              </div>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setPendingDeleteForecast(null)}
                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-500 leading-relaxed font-semibold">
                This action will permanently remove this forecast record from the database/local storage. This action cannot be undone.
              </p>

              {/* Identifying Info Panel */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-2 text-slate-700">
                <div className="flex justify-between items-center gap-4">
                  <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Month:</span>
                  <span className="font-black text-[#07182E] text-right">
                    {monthsList.find(m => m.value === pendingDeleteForecast.forecast_month)?.label || pendingDeleteForecast.forecast_month}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-4">
                  <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Year:</span>
                  <span className="font-extrabold text-slate-700 text-right">{pendingDeleteForecast.forecast_year}</span>
                </div>
                <div className="flex justify-between items-center gap-4">
                  <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Category:</span>
                  <span className="font-extrabold text-slate-700 text-right">{pendingDeleteForecast.category}</span>
                </div>
                <div className="flex justify-between items-center gap-4">
                  <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Excl. VAT Amount:</span>
                  <span className="font-bold text-slate-600 text-right">{formatCurrency(pendingDeleteForecast.forecast_amount_excl_vat)}</span>
                </div>
                <div className="flex justify-between items-center gap-4">
                  <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Total Amount:</span>
                  <span className="font-black text-rose-600 text-right">{formatCurrency(pendingDeleteForecast.forecast_total_amount)}</span>
                </div>
                {pendingDeleteForecast.notes && (
                  <div className="border-t border-slate-200/60 pt-2 flex flex-col gap-1">
                    <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Notes:</span>
                    <span className="font-semibold text-slate-600 leading-normal">{pendingDeleteForecast.notes}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-5 bg-slate-50 border-t border-slate-100 sticky bottom-0 z-10 shrink-0">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setPendingDeleteForecast(null)}
                className="px-4 py-2 text-xs font-extrabold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDeleteForecastRecord}
                className="px-5 py-2 text-xs font-extrabold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                    Deleting…
                  </>
                ) : (
                  "Delete Record"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
