import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase, isApiKeyError } from "../../lib/supabase";
import { Company, Project } from "../../types";
import { 
  Plus, Search, Filter, RotateCcw, Truck, Wrench, Shield, AlertTriangle, 
  Layers, Calendar, CheckSquare, FileText, Download, Eye, Edit, ChevronRight, X, MapPin, Archive
} from "lucide-react";
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, 
  BarChart, Bar, Legend, PieChart, Pie, Cell 
} from "recharts";

// TypeScript interfaces
interface FleetAsset {
  id: string;
  assetNumber: string;
  category: "Plant" | "Automobiles" | "Commercial Vehicles";
  type: string;
  makeModel: string;
  registration: string;
  year: number;
  status: "Available" | "In Use" | "Under Maintenance" | "Out of Service";
  driver: string;
  location: string;
  hoursOrOdo: number;
  nextService: string;
  isArchived: boolean;
  vinChassisNumber?: string;
  lastServiceDate?: string;
  notes?: string;
  currentProjectId?: string | null;
}

interface OutletContext {
  activeCompany: Company | null;
  activeProject: Project | null;
}

interface TripEntry {
  id: string;
  company_id: string;
  project_id: string | null;
  fleet_asset_id: string;
  driver_first_name: string;
  driver_last_name: string;
  start_destination: string;
  end_destination: string | null;
  started_at: string;
  ended_at: string | null;
  kilometres_travelled: number;
  fuel_quantity: number;
  fuel_unit: "L" | "gal";
  fuel_litres: number;
  status: "In Progress" | "Completed" | "Delayed" | "Cancelled";
  notes: string | null;
  registration_snapshot: string | null;
  vehicle_type_snapshot: string | null;
  category_snapshot: string | null;
  is_archived: boolean;
  archived_at: string | null;
  archived_by: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

interface TripFormState {
  fleet_asset_id: string;
  project_id: string | null;
  driver_first_name: string;
  driver_last_name: string;
  start_destination: string;
  end_destination: string;
  startedAtLocal: string;
  endedAtLocal: string;
  kilometres_travelled: number;
  fuel_quantity: number;
  fuel_unit: "L" | "gal";
  status: "In Progress" | "Completed" | "Delayed" | "Cancelled";
  notes: string;
}

interface MonitoringTrip {
  id: string;
  company_id: string;
  project_id: string | null;
  fleet_asset_id: string;
  started_at: string;
  ended_at: string | null;
  kilometres_travelled: number | string | null;
  fuel_quantity: number | string | null;
  fuel_unit: "L" | "gal" | null;
  fuel_litres: number | string | null;
  status: "In Progress" | "Completed" | "Delayed" | "Cancelled";
  is_archived: boolean;
}

const getSASTNow = (): Date => {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + (3600000 * 2));
};

const getSASTTodayString = (): string => {
  const sast = getSASTNow();
  const yyyy = sast.getFullYear();
  const mm = String(sast.getMonth() + 1).padStart(2, '0');
  const dd = String(sast.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getSASTMonthString = (): string => {
  const sast = getSASTNow();
  const yyyy = sast.getFullYear();
  const mm = String(sast.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
};

const getSASTWeekString = (): string => {
  const date = getSASTNow();
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  const tdt = new Date(monday.valueOf());
  const dayn = (monday.getDay() + 6) % 7;
  tdt.setDate(tdt.getDate() - dayn + 3);
  const firstThursday = tdt.valueOf();
  tdt.setMonth(0, 1);
  if (tdt.getDay() !== 4) {
    tdt.setMonth(0, 1 + ((4 - tdt.getDay() + 7) % 7));
  }
  const weekNum = 1 + Math.ceil((firstThursday - tdt.valueOf()) / 604800000);
  return `${monday.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
};

const parseWeekToMonday = (weekStr: string): Date => {
  const parts = weekStr.split("-W");
  if (parts.length !== 2) return new Date();
  const year = parseInt(parts[0], 10);
  const week = parseInt(parts[1], 10);
  const firstDayOfYear = new Date(Date.UTC(year, 0, 1));
  const dayOfFirstDay = firstDayOfYear.getUTCDay();
  const mondayOfW1 = new Date(firstDayOfYear);
  if (dayOfFirstDay <= 4) {
    mondayOfW1.setUTCDate(1 - (dayOfFirstDay === 0 ? 6 : dayOfFirstDay - 1));
  } else {
    mondayOfW1.setUTCDate(1 + (8 - dayOfFirstDay));
  }
  return new Date(mondayOfW1.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
};

const getNextDaySAST = (dateStr: string): string => {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + 1);
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getPeriodBoundaries = (
  period: "all" | "daily" | "weekly" | "monthly",
  dailyVal: string,
  weeklyVal: string,
  monthlyVal: string
): { start: string; end: string } | null => {
  try {
    if (period === "all") return null;
    if (period === "daily") {
      if (!dailyVal || !/^\d{4}-\d{2}-\d{2}$/.test(dailyVal)) return null;
      const start = `${dailyVal}T00:00:00+02:00`;
      const nextDay = getNextDaySAST(dailyVal);
      const end = `${nextDay}T00:00:00+02:00`;
      return { start, end };
    } else if (period === "weekly") {
      if (!weeklyVal || !/^\d{4}-W\d{2}$/.test(weeklyVal)) return null;
      const mondayDate = parseWeekToMonday(weeklyVal);
      const y1 = mondayDate.getUTCFullYear();
      const m1 = String(mondayDate.getUTCMonth() + 1).padStart(2, '0');
      const d1 = String(mondayDate.getUTCDate()).padStart(2, '0');
      const start = `${y1}-${m1}-${d1}T00:00:00+02:00`;
      const nextMondayDate = new Date(mondayDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      const y2 = nextMondayDate.getUTCFullYear();
      const m2 = String(nextMondayDate.getUTCMonth() + 1).padStart(2, '0');
      const d2 = String(nextMondayDate.getUTCDate()).padStart(2, '0');
      const end = `${y2}-${m2}-${d2}T00:00:00+02:00`;
      return { start, end };
    } else {
      if (!monthlyVal || !/^\d{4}-\d{2}$/.test(monthlyVal)) return null;
      const [year, month] = monthlyVal.split("-").map(Number);
      const start = `${monthlyVal}-01T00:00:00+02:00`;
      const nextMonthDate = new Date(Date.UTC(year, month, 1));
      const y2 = nextMonthDate.getUTCFullYear();
      const m2 = String(nextMonthDate.getUTCMonth() + 1).padStart(2, '0');
      const end = `${y2}-${m2}-01T00:00:00+02:00`;
      return { start, end };
    }
  } catch (err) {
    console.error("Error calculating boundaries:", err);
    return null;
  }
};

const getWeeklyDates = (weekStr: string): string[] => {
  const monday = parseWeekToMonday(weekStr);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getTime() + i * 24 * 60 * 60 * 1000);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
  }
  return dates;
};

const getMonthlyDates = (monthStr: string): string[] => {
  if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) return [];
  const [year, month] = monthStr.split("-").map(Number);
  const dates: string[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let i = 1; i <= daysInMonth; i++) {
    const dd = String(i).padStart(2, '0');
    const mm = String(month).padStart(2, '0');
    dates.push(`${year}-${mm}-${dd}`);
  }
  return dates;
};

const getSASTDateStringFromTimestamp = (timestampStr: string | null): string => {
  if (!timestampStr) return "";
  try {
    const date = new Date(timestampStr);
    if (isNaN(date.getTime())) return "";
    const utc = date.getTime();
    const sastDate = new Date(utc + (2 * 60 * 60 * 1000));
    const yyyy = sastDate.getUTCFullYear();
    const mm = String(sastDate.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(sastDate.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch (err) {
    console.error("Error formatting timestamp to SAST:", err);
    return "";
  }
};

const convertLocalToSASTTimestamp = (localStr: string | null | undefined): string | null => {
  if (!localStr) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(localStr)) return null;
  const parts = localStr.split(":");
  if (parts.length === 2) {
    return `${localStr}:00+02:00`;
  }
  return `${localStr}+02:00`;
};

const convertSASTTimestampToLocal = (sastStr: string | null | undefined): string => {
  if (!sastStr) return "";
  try {
    const date = new Date(sastStr);
    if (isNaN(date.getTime())) return "";
    const utc = date.getTime();
    const sastTime = new Date(utc + (2 * 60 * 60 * 1000));
    const yyyy = sastTime.getUTCFullYear();
    const mm = String(sastTime.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(sastTime.getUTCDate()).padStart(2, '0');
    const hh = String(sastTime.getUTCHours()).padStart(2, '0');
    const min = String(sastTime.getUTCMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  } catch (err) {
    console.error("Error converting SAST to local:", err);
    return "";
  }
};

const formatSASTTimestampForDisplay = (sastStr: string | null | undefined): string => {
  if (!sastStr) return "—";
  try {
    const date = new Date(sastStr);
    if (isNaN(date.getTime())) return "—";
    const utc = date.getTime();
    const sastTime = new Date(utc + (2 * 60 * 60 * 1000));
    const yyyy = sastTime.getUTCFullYear();
    const mm = String(sastTime.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(sastTime.getUTCDate()).padStart(2, '0');
    const hh = String(sastTime.getUTCHours()).padStart(2, '0');
    const min = String(sastTime.getUTCMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  } catch (err) {
    return "—";
  }
};

const mapErrorMessage = (err: any): string => {
  if (!err) return "An unexpected error occurred.";
  const msg = String(err.message || "").toLowerCase();
  const code = String(err.code || "");

  if (code === "42501" || msg.includes("row-level security") || msg.includes("permission denied")) {
    return "Permission denied: You do not have access to this company's fleet records.";
  }
  if (msg.includes("cross-company violation") || msg.includes("does not belong to the same company") || msg.includes("does not belong to the asset company")) {
    return "Cross-company violation: Fleet asset or project belongs to a different company.";
  }
  if (msg.includes("referenced fleet asset does not exist") || msg.includes("fleet_asset_id")) {
    return "Referenced fleet asset does not exist or belongs to another company.";
  }
  if (msg.includes("project does not belong to the asset company") || msg.includes("project_id")) {
    return "Cross-company violation: Project belongs to a different company.";
  }
  if (msg.includes("chk_fleet_trips_driver_first_name_not_empty") || msg.includes("driver first name cannot be blank")) {
    return "Driver Name is required and cannot be empty.";
  }
  if (msg.includes("chk_fleet_trips_driver_last_name_not_empty") || msg.includes("driver last name cannot be blank")) {
    return "Driver Surname is required and cannot be empty.";
  }
  if (msg.includes("chk_fleet_trips_start_destination_not_empty") || msg.includes("start destination cannot be blank")) {
    return "Start Destination is required and cannot be empty.";
  }
  if (msg.includes("chk_fleet_trips_ended_at") || msg.includes("end before start")) {
    return "End Date & Time cannot be earlier than Start Date & Time.";
  }
  if (msg.includes("chk_fleet_trips_completed") || msg.includes("completed trips require")) {
    return "Completed trips require both an End Destination and an End Date/Time.";
  }
  if (msg.includes("chk_fleet_trips_kilometres") || msg.includes("kilometres cannot be negative")) {
    return "Kilometres Travelled cannot be negative.";
  }
  if (msg.includes("chk_fleet_trips_fuel") || msg.includes("fuel consumption cannot be negative")) {
    return "Fuel Quantity cannot be negative.";
  }
  if (msg.includes("chk_fleet_trips_fuel_unit") || msg.includes("invalid fuel unit")) {
    return "Selected fuel unit is invalid.";
  }
  if (msg.includes("chk_fleet_trips_status") || msg.includes("invalid status")) {
    return "The selected trip status is invalid.";
  }
  if (msg.includes("zero-row") || msg.includes("no record was returned") || msg.includes("could not be updated")) {
    return "The update could not be completed. The record may have been deleted or modified.";
  }
  if (msg.includes("network") || msg.includes("fetch failed") || msg.includes("failed to fetch")) {
    return "Network communication failed. Please check your connection and try again.";
  }

  return `Error: ${err.message || "Unknown error"} (Code: ${err.code || "N/A"})`;
};

const parseDefensiveNumber = (val: any): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") {
    if (isNaN(val) || !isFinite(val)) return 0;
    return val;
  }
  const parsed = parseFloat(String(val));
  if (isNaN(parsed) || !isFinite(parsed)) return 0;
  return parsed;
};

const isServiceDueSoon = (nextServiceDateStr: string, todayStr: string): boolean => {
  if (!nextServiceDateStr) return false;
  const [ty, tm, td] = todayStr.split("-").map(Number);
  const todayDate = new Date(Date.UTC(ty, tm - 1, td));
  const [ny, nm, nd] = nextServiceDateStr.split("-").map(Number);
  const nextDate = new Date(Date.UTC(ny, nm - 1, nd));
  const diffTime = nextDate.getTime() - todayDate.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 30;
};

export default function LogisticsPage() {
  const { activeCompany, activeProject } = useOutletContext<OutletContext>() || {};
  const [activeSection, setActiveSection] = useState<"inventory" | "monitoring" | "trips">("inventory");
  const [assets, setAssets] = useState<FleetAsset[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [trips, setTrips] = useState<TripEntry[]>([]);
  
  // --- SECTION 3: TRIP TRACKING STATE INITIALIZATION ---
  interface TripFormState {
    fleet_asset_id: string;
    project_id: string | null;
    driver_first_name: string;
    driver_last_name: string;
    start_destination: string;
    end_destination: string;
    startedAtLocal: string;
    endedAtLocal: string;
    kilometres_travelled: number;
    fuel_quantity: number;
    fuel_unit: "L" | "gal";
    status: "In Progress" | "Completed" | "Delayed" | "Cancelled";
    notes: string;
  }

  const [tripsLoading, setTripsLoading] = useState<boolean>(false);
  const [tripsError, setTripsError] = useState<string | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<TripEntry | null>(null);
  const [isAddTripOpen, setIsAddTripOpen] = useState<boolean>(false);
  const [isEditTripOpen, setIsEditTripOpen] = useState<boolean>(false);
  const [isTripDetailsOpen, setIsTripDetailsOpen] = useState<boolean>(false);
  const [tripPendingArchive, setTripPendingArchive] = useState<TripEntry | null>(null);
  const [tripArchiveSubmitting, setTripArchiveSubmitting] = useState<boolean>(false);
  const [tripProjectFilter, setTripProjectFilter] = useState<string>("All");
  const [tripSearch, setTripSearch] = useState<string>("");
  const [tripDriverFilter, setTripDriverFilter] = useState<string>("All");
  const [tripAssetFilter, setTripAssetFilter] = useState<string>("All");
  const [tripTypeFilter, setTripTypeFilter] = useState<string>("All");
  const [tripCatFilter, setTripCatFilter] = useState<string>("All");
  const [tripStatusFilter, setTripStatusFilter] = useState<string>("All");
  const [tripPage, setTripPage] = useState<number>(1);
  const [showArchivedTrips, setShowArchivedTrips] = useState<boolean>(false);

  const [tripPeriod, setTripPeriod] = useState<"all" | "daily" | "weekly" | "monthly">("all");
  const [tripDailyDate, setTripDailyDate] = useState(getSASTTodayString());
  const [tripWeeklyRange, setTripWeeklyRange] = useState(getSASTWeekString());
  const [tripMonthlyVal, setTripMonthlyVal] = useState(getSASTMonthString());

  const [tripForm, setTripForm] = useState<TripFormState>({
    fleet_asset_id: "",
    project_id: null,
    driver_first_name: "",
    driver_last_name: "",
    start_destination: "",
    end_destination: "",
    startedAtLocal: "",
    endedAtLocal: "",
    kilometres_travelled: 0,
    fuel_quantity: 0,
    fuel_unit: "L",
    status: "Completed",
    notes: ""
  });

  const [tripErrors, setTripErrors] = useState<Partial<Record<keyof TripFormState, string>>>({});
  const tripsFetchIdRef = useRef<number>(0);
  const activeCompanyIdRef = useRef<string | null>(activeCompany?.id ?? null);

  useEffect(() => {
    activeCompanyIdRef.current = activeCompany?.id ?? null;
  }, [activeCompany?.id]);
  
  // Database Query States
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [mutationLoading, setMutationLoading] = useState<boolean>(false);
  const [logisticsRevision, setLogisticsRevision] = useState<number>(0);

  // General Notification / Message toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  // --- SECTION 1: INVENTORY STATES ---
  const [invSearch, setInvSearch] = useState("");
  const [invCategory, setInvCategory] = useState<string>("All");
  const [invStatus, setInvStatus] = useState<string>("All");
  const [invSortField, setInvSortField] = useState<keyof FleetAsset>("assetNumber");
  const [invSortOrder, setInvSortOrder] = useState<"asc" | "desc">("asc");
  const [invPage, setInvPage] = useState(1);
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const itemsPerPage = 5;

  // --- SECTION 2: MONITORING STATES ---
  const [monPeriod, setMonPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [monDailyDate, setMonDailyDate] = useState(getSASTTodayString());
  const [monWeeklyRange, setMonWeeklyRange] = useState(getSASTWeekString()); // Represents week
  const [monMonthlyVal, setMonMonthlyVal] = useState(getSASTMonthString());

  const [monitoringTrips, setMonitoringTrips] = useState<MonitoringTrip[]>([]);
  const [monitoringTripsLoading, setMonitoringTripsLoading] = useState<boolean>(false);
  const [monitoringTripsError, setMonitoringTripsError] = useState<string | null>(null);
  const [monitoringProjectFilter, setMonitoringProjectFilter] = useState<string>("All");

  // Asset Modals & Drawers
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [isEditAssetOpen, setIsEditAssetOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<FleetAsset | null>(null);
  const [isAssetDrawerOpen, setIsAssetDrawerOpen] = useState(false);
  const [assetPendingArchive, setAssetPendingArchive] = useState<FleetAsset | null>(null);
  const [archiveSubmitting, setArchiveSubmitting] = useState<boolean>(false);

  // Asset Form State
  const [assetForm, setAssetForm] = useState<{
    assetNumber: string;
    category: "Plant" | "Automobiles" | "Commercial Vehicles";
    type: string;
    makeModel: string;
    registration: string;
    vinChassisNumber: string;
    year: number;
    status: "Available" | "In Use" | "Under Maintenance" | "Out of Service";
    driver: string;
    location: string;
    hoursOrOdo: number;
    lastServiceDate: string;
    nextService: string;
    notes: string;
    currentProjectId: string | null;
  }>({
    assetNumber: "",
    category: "Plant",
    type: "",
    makeModel: "",
    registration: "",
    vinChassisNumber: "",
    year: new Date().getFullYear(),
    status: "Available",
    driver: "",
    location: "",
    hoursOrOdo: 0,
    lastServiceDate: "",
    nextService: "",
    notes: "",
    currentProjectId: null
  });

  const assetsFetchIdRef = useRef<number>(0);
  const projectsFetchIdRef = useRef<number>(0);
  const monitoringTripsFetchIdRef = useRef<number>(0);

  // Query Function for Assets
  const fetchAssets = useCallback(async (companyId: string) => {
    if (!companyId) {
      setAssets([]);
      setLoading(false);
      return;
    }
    const currentFetchId = ++assetsFetchIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("fleet_assets")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (currentFetchId === assetsFetchIdRef.current && companyId === activeCompany?.id) {
        const mapped: FleetAsset[] = (data || []).map((row: any) => ({
          id: row.id,
          assetNumber: row.asset_number,
          category: row.category,
          type: row.asset_type,
          makeModel: row.make_model,
          registration: row.registration || "",
          year: row.model_year || new Date().getFullYear(),
          status: row.status,
          driver: row.assigned_driver_operator || "",
          location: row.current_location || "",
          hoursOrOdo: row.category === "Plant" ? Number(row.operating_hours) : Number(row.odometer_reading),
          nextService: row.next_service_date || "",
          isArchived: row.is_archived,
          vinChassisNumber: row.vin_chassis_number || "",
          lastServiceDate: row.last_service_date || "",
          notes: row.notes || "",
          currentProjectId: row.current_project_id
        }));
        setAssets(mapped);
        setLoading(false);
      }
    } catch (err: any) {
      if (!isApiKeyError(err)) {
        console.error("Error fetching fleet assets:", err);
      }
      if (currentFetchId === assetsFetchIdRef.current && companyId === activeCompany?.id) {
        // Fallback sample assets if unconfigured
        const fallbackAssets: FleetAsset[] = [
          {
            id: "asset-fl-1",
            assetNumber: "EX-01",
            category: "Plant",
            type: "Excavator",
            makeModel: "CAT 320D L Hydraulic Excavator",
            registration: "CAT-320D-01",
            year: 2023,
            status: "Available",
            driver: "Thabo Molefe",
            location: "Riyadh Station Package C",
            hoursOrOdo: 1420,
            nextService: "2026-10-15",
            isArchived: false,
            vinChassisNumber: "CAT320DL9821034",
            lastServiceDate: "2026-06-10",
            notes: "Heavy civil excavation plant",
            currentProjectId: activeProject?.id || null
          },
          {
            id: "asset-fl-2",
            assetNumber: "TRK-01",
            category: "Commercial Vehicles",
            type: "Tipper Truck",
            makeModel: "Mercedes-Benz Actros 3340 6x4",
            registration: "DXB-98421",
            year: 2022,
            status: "In Use",
            driver: "Ahmed Al-Mansoor",
            location: "Dubai Metro Viaduct Site",
            hoursOrOdo: 84500,
            nextService: "2026-09-20",
            isArchived: false,
            vinChassisNumber: "WDB9340321K87654",
            lastServiceDate: "2026-05-18",
            notes: "Aggregate haulage fleet",
            currentProjectId: activeProject?.id || null
          },
          {
            id: "asset-fl-3",
            assetNumber: "BAK-01",
            category: "Automobiles",
            type: "Double Cab 4x4",
            makeModel: "Toyota Hilux 2.8 GD-6 4x4",
            registration: "JHB-349-GP",
            year: 2024,
            status: "Available",
            driver: "Sipho Dlamini",
            location: "Dar es Salaam Depot",
            hoursOrOdo: 21500,
            nextService: "2026-11-01",
            isArchived: false,
            vinChassisNumber: "AHTER39G40712398",
            lastServiceDate: "2026-07-02",
            notes: "Site Supervision & Inspection",
            currentProjectId: activeProject?.id || null
          }
        ];
        setAssets(fallbackAssets);
        setLoading(false);
      }
    }
  }, [activeCompany?.id, activeProject?.id]);

  // Query Function for Projects (to populate dropdown)
  const fetchProjects = useCallback(async (companyId: string) => {
    if (!companyId) {
      setProjects([]);
      return;
    }
    const currentFetchId = ++projectsFetchIdRef.current;
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("company_id", companyId);

      if (error) throw error;

      if (currentFetchId === projectsFetchIdRef.current && companyId === activeCompany?.id) {
        setProjects(data || []);
      }
    } catch (err) {
      if (!isApiKeyError(err)) {
        console.error("Error fetching company projects:", err);
      }
    }
  }, [activeCompany?.id]);

  // Effect for active company-switching and setup
  useEffect(() => {
    // Increment refs to immediately invalidate any in-flight requests from prior companies
    assetsFetchIdRef.current++;
    projectsFetchIdRef.current++;
    monitoringTripsFetchIdRef.current++;
    tripsFetchIdRef.current++;

    setAssets([]);
    setProjects([]);
    setSelectedAsset(null);
    setIsAssetDrawerOpen(false);
    setIsEditAssetOpen(false);
    setIsAddAssetOpen(false);
    setAssetPendingArchive(null);
    setArchiveSubmitting(false);

    setMonitoringProjectFilter("All");
    setMonitoringTrips([]);
    setMonitoringTripsError(null);

    setTrips([]);
    setTripsError(null);
    setSelectedTrip(null);
    setIsAddTripOpen(false);
    setIsEditTripOpen(false);
    setIsTripDetailsOpen(false);
    setTripPendingArchive(null);
    setTripArchiveSubmitting(false);
    setTripProjectFilter("All");

    setTripSearch("");
    setTripPeriod("all");
    setTripDriverFilter("All");
    setTripAssetFilter("All");
    setTripTypeFilter("All");
    setTripCatFilter("All");
    setTripStatusFilter("All");
    setTripPage(1);

    setTripForm({
      fleet_asset_id: "",
      project_id: null,
      driver_first_name: "",
      driver_last_name: "",
      start_destination: "",
      end_destination: "",
      startedAtLocal: "",
      endedAtLocal: "",
      kilometres_travelled: 0,
      fuel_quantity: 0,
      fuel_unit: "L",
      status: "Completed",
      notes: ""
    });
    setTripErrors({});

    if (activeCompany?.id) {
      fetchAssets(activeCompany.id);
      fetchProjects(activeCompany.id);
    } else {
      setLoading(false);
    }
  }, [activeCompany?.id, fetchAssets, fetchProjects]);

  const fetchMonitoringTrips = useCallback(async (
    companyId: string,
    period: "daily" | "weekly" | "monthly",
    dailyVal: string,
    weeklyVal: string,
    monthlyVal: string,
    projectFilter: string
  ) => {
    if (!companyId) {
      setMonitoringTrips([]);
      setMonitoringTripsLoading(false);
      return;
    }

    const currentFetchId = ++monitoringTripsFetchIdRef.current;
    setMonitoringTripsLoading(true);
    setMonitoringTripsError(null);

    try {
      const boundaries = getPeriodBoundaries(period, dailyVal, weeklyVal, monthlyVal);
      if (!boundaries) {
        throw new Error("Invalid period input");
      }

      let query = supabase
        .from("fleet_trips")
        .select(`
          id,
          company_id,
          project_id,
          fleet_asset_id,
          started_at,
          ended_at,
          kilometres_travelled,
          fuel_quantity,
          fuel_unit,
          fuel_litres,
          status,
          is_archived
        `)
        .eq("company_id", companyId)
        .gte("started_at", boundaries.start)
        .lt("started_at", boundaries.end)
        .eq("is_archived", false);

      if (projectFilter !== "All") {
        if (projectFilter === "unassigned") {
          query = query.is("project_id", null);
        } else {
          query = query.eq("project_id", projectFilter);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      if (currentFetchId === monitoringTripsFetchIdRef.current) {
        const mapped: MonitoringTrip[] = (data || []).map((row: any) => ({
          id: row.id,
          company_id: row.company_id,
          project_id: row.project_id,
          fleet_asset_id: row.fleet_asset_id,
          started_at: row.started_at,
          ended_at: row.ended_at,
          kilometres_travelled: row.kilometres_travelled,
          fuel_quantity: row.fuel_quantity,
          fuel_unit: row.fuel_unit,
          fuel_litres: row.fuel_litres,
          status: row.status,
          is_archived: row.is_archived
        }));
        setMonitoringTrips(mapped);
        setMonitoringTripsLoading(false);
      }
    } catch (err: any) {
      if (!isApiKeyError(err)) {
        console.error("Error fetching monitoring trips:", err);
      }
      if (currentFetchId === monitoringTripsFetchIdRef.current) {
        setMonitoringTrips([]);
        setMonitoringTripsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (activeCompany?.id) {
      fetchMonitoringTrips(
        activeCompany.id,
        monPeriod,
        monDailyDate,
        monWeeklyRange,
        monMonthlyVal,
        monitoringProjectFilter
      );
    } else {
      setMonitoringTrips([]);
      setMonitoringTripsLoading(false);
    }
  }, [
    activeCompany?.id,
    monPeriod,
    monDailyDate,
    monWeeklyRange,
    monMonthlyVal,
    monitoringProjectFilter,
    logisticsRevision,
    fetchMonitoringTrips
  ]);

  const fetchTrips = useCallback(async (
    companyId: string,
    period: "all" | "daily" | "weekly" | "monthly",
    dailyVal: string,
    weeklyVal: string,
    monthlyVal: string,
    projectFilter: string,
    showArchived: boolean
  ) => {
    if (!companyId) {
      setTrips([]);
      setTripsLoading(false);
      return;
    }

    const currentFetchId = ++tripsFetchIdRef.current;
    setTripsLoading(true);
    setTripsError(null);

    try {
      let query = supabase
        .from("fleet_trips")
        .select(`
          id,
          company_id,
          project_id,
          fleet_asset_id,
          driver_first_name,
          driver_last_name,
          start_destination,
          end_destination,
          started_at,
          ended_at,
          kilometres_travelled,
          fuel_quantity,
          fuel_unit,
          fuel_litres,
          status,
          notes,
          registration_snapshot,
          vehicle_type_snapshot,
          category_snapshot,
          is_archived,
          archived_at,
          archived_by,
          created_by,
          updated_by,
          created_at,
          updated_at
        `)
        .eq("company_id", companyId);

      if (period !== "all") {
        const boundaries = getPeriodBoundaries(period, dailyVal, weeklyVal, monthlyVal);
        if (boundaries) {
          query = query
            .gte("started_at", boundaries.start)
            .lt("started_at", boundaries.end);
        } else {
          throw new Error("Invalid period boundaries");
        }
      }

      if (projectFilter !== "All") {
        if (projectFilter === "unassigned") {
          query = query.is("project_id", null);
        } else {
          query = query.eq("project_id", projectFilter);
        }
      }

      if (!showArchived) {
        query = query.eq("is_archived", false);
      }

      query = query.order("started_at", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      if (currentFetchId === tripsFetchIdRef.current && companyId === activeCompany?.id) {
        const mapped: TripEntry[] = (data || []).map((row: any) => ({
          id: row.id,
          company_id: row.company_id,
          project_id: row.project_id,
          fleet_asset_id: row.fleet_asset_id,
          driver_first_name: row.driver_first_name,
          driver_last_name: row.driver_last_name,
          start_destination: row.start_destination,
          end_destination: row.end_destination,
          started_at: row.started_at,
          ended_at: row.ended_at,
          kilometres_travelled: parseDefensiveNumber(row.kilometres_travelled),
          fuel_quantity: parseDefensiveNumber(row.fuel_quantity),
          fuel_unit: row.fuel_unit,
          fuel_litres: parseDefensiveNumber(row.fuel_litres),
          status: row.status,
          notes: row.notes,
          registration_snapshot: row.registration_snapshot,
          vehicle_type_snapshot: row.vehicle_type_snapshot,
          category_snapshot: row.category_snapshot,
          is_archived: row.is_archived,
          archived_at: row.archived_at,
          archived_by: row.archived_by,
          created_by: row.created_by,
          updated_by: row.updated_by,
          created_at: row.created_at,
          updated_at: row.updated_at
        }));
        setTrips(mapped);
        setTripsLoading(false);
      }
    } catch (err: any) {
      if (!isApiKeyError(err)) {
        console.error("Error fetching trips:", err);
      }
      if (currentFetchId === tripsFetchIdRef.current && companyId === activeCompany?.id) {
        setTrips([]);
        setTripsLoading(false);
      }
    }
  }, [activeCompany?.id]);

  useEffect(() => {
    if (activeCompany?.id) {
      fetchTrips(
        activeCompany.id,
        tripPeriod,
        tripDailyDate,
        tripWeeklyRange,
        tripMonthlyVal,
        tripProjectFilter,
        showArchivedTrips
      );
    } else {
      setTrips([]);
      setTripsLoading(false);
    }
  }, [
    activeCompany?.id,
    tripPeriod,
    tripDailyDate,
    tripWeeklyRange,
    tripMonthlyVal,
    tripProjectFilter,
    showArchivedTrips,
    logisticsRevision,
    fetchTrips
  ]);

  useEffect(() => {
    setTripPage(1);
  }, [tripPeriod]);

  // --- DATA FILTERING & CALCULATIONS ---

  // 1. INVENTORY CALCULATIONS
  const filteredAssets = useMemo(() => {
    return assets.filter(item => {
      // Filter out archived unless showArchived is true
      if (!showArchived && item.isArchived) return false;

      const matchesSearch = 
        item.id.toLowerCase().includes(invSearch.toLowerCase()) ||
        (item.assetNumber || "").toLowerCase().includes(invSearch.toLowerCase()) ||
        item.makeModel.toLowerCase().includes(invSearch.toLowerCase()) ||
        item.registration.toLowerCase().includes(invSearch.toLowerCase()) ||
        item.driver.toLowerCase().includes(invSearch.toLowerCase()) ||
        item.type.toLowerCase().includes(invSearch.toLowerCase());
      const matchesCat = invCategory === "All" || item.category === invCategory;
      const matchesStatus = invStatus === "All" || item.status === invStatus;
      return matchesSearch && matchesCat && matchesStatus;
    }).sort((a, b) => {
      const valA = a[invSortField];
      const valB = b[invSortField];
      if (typeof valA === "number" && typeof valB === "number") {
        return invSortOrder === "asc" ? valA - valB : valB - valA;
      }
      return invSortOrder === "asc" 
        ? String(valA).localeCompare(String(valB)) 
        : String(valB).localeCompare(String(valA));
    });
  }, [assets, invSearch, invCategory, invStatus, invSortField, invSortOrder, showArchived]);

  const paginatedAssets = useMemo(() => {
    const start = (invPage - 1) * itemsPerPage;
    return filteredAssets.slice(start, start + itemsPerPage);
  }, [filteredAssets, invPage]);

  const totalInvPages = Math.ceil(filteredAssets.length / itemsPerPage) || 1;

  // Dynamic Category Stats for Inventory tab (excluding archived assets)
  const categoryStats = useMemo(() => {
    const stats = {
      Plant: { total: 0, available: 0, inUse: 0, maintenance: 0, outOfService: 0 },
      Automobiles: { total: 0, available: 0, inUse: 0, maintenance: 0, outOfService: 0 },
      Commercial: { total: 0, available: 0, inUse: 0, maintenance: 0, outOfService: 0 }
    };
    assets.forEach(a => {
      if (a.isArchived) return; // Do not count archived assets
      const key = a.category === "Plant" ? "Plant" : a.category === "Automobiles" ? "Automobiles" : "Commercial";
      stats[key].total++;
      if (a.status === "Available") stats[key].available++;
      else if (a.status === "In Use") stats[key].inUse++;
      else if (a.status === "Under Maintenance") stats[key].maintenance++;
      else if (a.status === "Out of Service") stats[key].outOfService++;
    });
    return stats;
  }, [assets]);


  // Helper to test if a trip fits the selected monitoring period
  const matchesPeriod = (tripDate: string, period: "daily" | "weekly" | "monthly", dateVal: string, weekVal: string, monthVal: string) => {
    if (period === "daily") {
      return tripDate === dateVal;
    } else if (period === "weekly") {
      // Very simple week matching: Parse "2026-W29" and map to a date range
      // For this prototype, we'll extract the week number and check if trip falls within a realistic week window
      // Let's assume W29 covers 2026-07-13 to 2026-07-19
      if (weekVal === "2026-W29") {
        return tripDate >= "2026-07-13" && tripDate <= "2026-07-19";
      }
      return true; // fallback
    } else {
      // "monthly": "2026-07"
      return tripDate.startsWith(monthVal);
    }
  };

  // 2. MONITORING CALCULATIONS (Report-period filtered list & stats)
  const monitoringStats = useMemo(() => {
    const activeAssets = assets.filter(a => !a.isArchived);
    const total = activeAssets.length;
    let available = 0;
    let inUse = 0;
    let plantInOperation = 0;
    let underMaintenance = 0;
    let outOfService = 0;
    const todaySAST = getSASTTodayString();

    activeAssets.forEach(a => {
      if (a.status === "Available") available++;
      else if (a.status === "In Use") {
        inUse++;
        if (a.category === "Plant") plantInOperation++;
      }
      else if (a.status === "Under Maintenance") {
        underMaintenance++;
      }
      else if (a.status === "Out of Service") {
        outOfService++;
      }
    });

    // Deduplicate Requiring Attention
    const thirtyDaysFromTodayDate = getSASTNow();
    thirtyDaysFromTodayDate.setDate(thirtyDaysFromTodayDate.getDate() + 30);
    const thirtyDaysFromTodaySAST = `${thirtyDaysFromTodayDate.getFullYear()}-${String(thirtyDaysFromTodayDate.getMonth() + 1).padStart(2, '0')}-${String(thirtyDaysFromTodayDate.getDate()).padStart(2, '0')}`;

    const attentionAssetIds = new Set<string>();
    activeAssets.forEach(a => {
      let requiresAttention = false;
      if (a.status === "Under Maintenance" || a.status === "Out of Service") {
        requiresAttention = true;
      }
      const hasNextService = !!a.nextService && /^\d{4}-\d{2}-\d{2}$/.test(a.nextService);
      if (hasNextService) {
        if (a.nextService < todaySAST) {
          requiresAttention = true;
        } else if (a.nextService >= todaySAST && a.nextService <= thirtyDaysFromTodaySAST) {
          requiresAttention = true;
        }
      }
      if (requiresAttention) {
        attentionAssetIds.add(a.id);
      }
    });
    const requiringAttention = attentionAssetIds.size;

    // Derive metrics from monitoringTrips
    const loggedTripsCount = monitoringTrips.length;
    const completedTripsCount = monitoringTrips.filter(t => t.status === "Completed").length;
    const inProgressTripsCount = monitoringTrips.filter(t => t.status === "In Progress").length;
    const delayedTripsCount = monitoringTrips.filter(t => t.status === "Delayed").length;
    const cancelledTripsCount = monitoringTrips.filter(t => t.status === "Cancelled").length;

    const nonCancelledTrips = monitoringTrips.filter(t => t.status !== "Cancelled");
    const operationalTripsCount = nonCancelledTrips.length;

    // Distinct operational assets (non-cancelled trips belonging to activeAssets)
    const activeAssetIds = new Set(activeAssets.map(a => a.id));
    const distinctOperationalAssetIds = new Set(
      nonCancelledTrips
        .map(t => t.fleet_asset_id)
        .filter(id => activeAssetIds.has(id))
    );
    const distinctOperationalCount = distinctOperationalAssetIds.size;

    // Recorded distance and fuel totals using all non-cancelled trips
    let totalDistance = 0;
    let totalFuelLitres = 0;
    nonCancelledTrips.forEach(t => {
      totalDistance += parseDefensiveNumber(t.kilometres_travelled);
      totalFuelLitres += parseDefensiveNumber(t.fuel_litres);
    });

    // Average fuel consumption (only non-cancelled, ended_at is not null, kilometres_travelled > 0)
    let efficiencyDistance = 0;
    let efficiencyFuelLitres = 0;
    nonCancelledTrips.forEach(t => {
      const km = parseDefensiveNumber(t.kilometres_travelled);
      const fuel = parseDefensiveNumber(t.fuel_litres);
      if (t.ended_at !== null && km > 0) {
        efficiencyDistance += km;
        efficiencyFuelLitres += fuel;
      }
    });

    const averageFuelConsumption = efficiencyDistance > 0
      ? Number(((efficiencyFuelLitres / efficiencyDistance) * 100).toFixed(2))
      : null;

    // Separate calculations
    const currentFleetUtilization = total > 0
      ? Math.round((inUse / total) * 100)
      : 0;

    const periodFleetActivity = total > 0
      ? Math.round((distinctOperationalCount / total) * 100)
      : 0;

    return {
      total,
      available,
      inUse,
      plantInOperation,
      underMaintenance,
      outOfService,
      currentFleetUtilization,
      periodFleetActivity,
      requiringAttention,
      loggedTripsCount,
      completedTripsCount,
      inProgressTripsCount,
      delayedTripsCount,
      cancelledTripsCount,
      operationalTripsCount,
      distinctOperationalCount,
      totalDistance,
      totalFuelLitres,
      averageFuelConsumption,
      efficiencyDistance,
      attentionAssetIds: Array.from(attentionAssetIds)
    };
  }, [assets, monitoringTrips]);

  const utilisationTrendData = useMemo(() => {
    const activeAssets = assets.filter(a => !a.isArchived);
    const total = activeAssets.length;
    if (total === 0) return [];

    const activeAssetIds = new Set(activeAssets.map(a => a.id));

    if (monPeriod === "daily") {
      const blocks = [
        { label: "00:00-04:00", startHour: 0, endHour: 4 },
        { label: "04:00-08:00", startHour: 4, endHour: 8 },
        { label: "08:00-12:00", startHour: 8, endHour: 12 },
        { label: "12:00-16:00", startHour: 12, endHour: 16 },
        { label: "16:00-20:00", startHour: 16, endHour: 20 },
        { label: "20:00-00:00", startHour: 20, endHour: 24 }
      ];

      return blocks.map(b => {
        const tripsInBlock = monitoringTrips.filter(t => {
          if (t.status === "Cancelled") return false;
          try {
            const started = new Date(t.started_at);
            const utc = started.getTime() + started.getTimezoneOffset() * 60000;
            const sast = new Date(utc + (3600000 * 2));
            const hour = sast.getHours();
            return hour >= b.startHour && hour < b.endHour;
          } catch (e) {
            return false;
          }
        });

        const activeInBlock = new Set(
          tripsInBlock
            .map(t => t.fleet_asset_id)
            .filter(id => activeAssetIds.has(id))
        );

        const pfa = total > 0 ? Math.round((activeInBlock.size / total) * 100) : 0;
        return { date: b.label, periodFleetActivity: pfa };
      });
    } else if (monPeriod === "weekly") {
      const dates = getWeeklyDates(monWeeklyRange);
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      return dates.map((d, index) => {
        const tripsOnDay = monitoringTrips.filter(t => {
          if (t.status === "Cancelled") return false;
          const tripDayStr = getSASTDateStringFromTimestamp(t.started_at);
          return tripDayStr === d;
        });

        const activeOnDay = new Set(
          tripsOnDay
            .map(t => t.fleet_asset_id)
            .filter(id => activeAssetIds.has(id))
        );

        const pfa = total > 0 ? Math.round((activeOnDay.size / total) * 100) : 0;
        return { date: `${days[index]} ${d.substring(8, 10)}`, periodFleetActivity: pfa };
      });
    } else {
      const dates = getMonthlyDates(monMonthlyVal);
      return dates.map(d => {
        const tripsOnDay = monitoringTrips.filter(t => {
          if (t.status === "Cancelled") return false;
          const tripDayStr = getSASTDateStringFromTimestamp(t.started_at);
          return tripDayStr === d;
        });

        const activeOnDay = new Set(
          tripsOnDay
            .map(t => t.fleet_asset_id)
            .filter(id => activeAssetIds.has(id))
        );

        const pfa = total > 0 ? Math.round((activeOnDay.size / total) * 100) : 0;
        return { date: d.substring(8, 10), periodFleetActivity: pfa };
      });
    }
  }, [assets, monPeriod, monDailyDate, monWeeklyRange, monMonthlyVal, monitoringTrips]);

  // 3. TRIP TRACKING CALCULATIONS & FUEL CONVERSION
  const activeAnalyticsTrips = useMemo(() => trips.filter(trip => !trip.is_archived), [trips]);

  const filteredAnalyticsTrips = useMemo(() => {
    return activeAnalyticsTrips.filter(t => {
      const searchLower = tripSearch.toLowerCase();
      const matchesSearch = !tripSearch ? true : (
        (t.registration_snapshot || "").toLowerCase().includes(searchLower) ||
        (t.start_destination || "").toLowerCase().includes(searchLower) ||
        (t.end_destination || "").toLowerCase().includes(searchLower) ||
        (t.driver_first_name || "").toLowerCase().includes(searchLower) ||
        (t.driver_last_name || "").toLowerCase().includes(searchLower) ||
        (t.vehicle_type_snapshot || "").toLowerCase().includes(searchLower) ||
        (t.notes || "").toLowerCase().includes(searchLower)
      );

      if (!matchesSearch) return false;

      if (tripDriverFilter !== "All") {
        const fullName = `${t.driver_first_name} ${t.driver_last_name}`;
        if (fullName !== tripDriverFilter) return false;
      }
      if (tripAssetFilter !== "All" && t.fleet_asset_id !== tripAssetFilter) return false;
      if (tripStatusFilter !== "All" && t.status !== tripStatusFilter) return false;

      return true;
    });
  }, [activeAnalyticsTrips, tripSearch, tripDriverFilter, tripAssetFilter, tripStatusFilter]);

  const filteredTrips = useMemo(() => {
    return trips.filter(t => {
      const searchLower = tripSearch.toLowerCase();
      const matchesSearch = !tripSearch ? true : (
        (t.registration_snapshot || "").toLowerCase().includes(searchLower) ||
        (t.start_destination || "").toLowerCase().includes(searchLower) ||
        (t.end_destination || "").toLowerCase().includes(searchLower) ||
        (t.driver_first_name || "").toLowerCase().includes(searchLower) ||
        (t.driver_last_name || "").toLowerCase().includes(searchLower) ||
        (t.vehicle_type_snapshot || "").toLowerCase().includes(searchLower) ||
        (t.notes || "").toLowerCase().includes(searchLower)
      );

      if (!matchesSearch) return false;

      if (tripDriverFilter !== "All") {
        const fullName = `${t.driver_first_name} ${t.driver_last_name}`;
        if (fullName !== tripDriverFilter) return false;
      }
      if (tripAssetFilter !== "All" && t.fleet_asset_id !== tripAssetFilter) return false;
      if (tripStatusFilter !== "All" && t.status !== tripStatusFilter) return false;

      return true;
    });
  }, [trips, tripSearch, tripDriverFilter, tripAssetFilter, tripStatusFilter]);

  const dynamicDrivers = useMemo(() => {
    const drivers = new Set<string>();
    trips.forEach(t => {
      const first = (t.driver_first_name || "").trim();
      const last = (t.driver_last_name || "").trim();
      if (first || last) {
        drivers.add(`${first} ${last}`);
      }
    });
    return Array.from(drivers).sort();
  }, [trips]);

  const paginatedTrips = useMemo(() => {
    const start = (tripPage - 1) * itemsPerPage;
    return filteredTrips.slice(start, start + itemsPerPage);
  }, [filteredTrips, tripPage]);

  const totalTripPages = Math.ceil(filteredTrips.length / itemsPerPage) || 1;

  const tripSummaryStats = useMemo(() => {
    const activeTrips = filteredAnalyticsTrips;
    const loggedTripsCount = activeTrips.length;

    const operationalTrips = activeTrips.filter(t => t.status !== "Cancelled");

    let totalKm = 0;
    let totalFuelL = 0;
    let totalTimeMinutes = 0;
    const activeDriversSet = new Set<string>();

    operationalTrips.forEach(t => {
      totalKm += t.kilometres_travelled;
      const fuelVal = parseDefensiveNumber(t.fuel_litres);
      totalFuelL += fuelVal;

      const first = (t.driver_first_name || "").trim();
      const last = (t.driver_last_name || "").trim();
      if (first || last) {
        activeDriversSet.add(`${first.toLowerCase()} ${last.toLowerCase()}`);
      }

      if (t.started_at && t.ended_at) {
        const startMs = new Date(t.started_at).getTime();
        const endMs = new Date(t.ended_at).getTime();
        const diff = endMs - startMs;
        if (diff > 0) {
          totalTimeMinutes += diff / (1000 * 60);
        }
      }
    });

    let eligibleKm = 0;
    let eligibleFuelL = 0;
    operationalTrips.forEach(t => {
      if (t.ended_at && t.kilometres_travelled > 0) {
        eligibleKm += t.kilometres_travelled;
        const fuelVal = parseDefensiveNumber(t.fuel_litres);
        eligibleFuelL += fuelVal;
      }
    });

    const averageConsumption = eligibleKm > 0 ? (eligibleFuelL / eligibleKm) * 100 : null;

    return {
      totalTrips: loggedTripsCount,
      totalKm: Math.round(totalKm * 10) / 10,
      totalFuelL: Math.round(totalFuelL * 10) / 10,
      averageConsumption: averageConsumption !== null ? Math.round(averageConsumption * 10) / 10 : null,
      totalDrivingTimeHours: Math.round((totalTimeMinutes / 60) * 10) / 10,
      activeDrivers: activeDriversSet.size
    };
  }, [filteredAnalyticsTrips]);

  const barChartData = useMemo(() => {
    return filteredAnalyticsTrips.map(t => ({
      registration: t.registration_snapshot || "No Reg",
      km: t.kilometres_travelled,
      fuel: Math.round(parseDefensiveNumber(t.fuel_litres) * 10) / 10
    }));
  }, [filteredAnalyticsTrips]);


  // --- FORM ACTIONS ---

  const handleAddAssetSubmit = async (e: React.FormEvent) => {
    assertOperationalAction("create", "pages/Logistics/LogisticsPage.tsx");
    e.preventDefault();
    if (!activeCompany?.id) {
      showToast("Cannot add asset: no active company selected.");
      return;
    }
    const targetCompanyId = activeCompany.id;

    setMutationLoading(true);

    const payload = {
      company_id: targetCompanyId,
      asset_number: assetForm.assetNumber,
      category: assetForm.category,
      asset_type: assetForm.type,
      make_model: assetForm.makeModel,
      registration: assetForm.registration ? assetForm.registration.trim() : null,
      vin_chassis_number: assetForm.vinChassisNumber ? assetForm.vinChassisNumber.trim() : null,
      model_year: assetForm.year || null,
      status: assetForm.status,
      assigned_driver_operator: assetForm.driver ? assetForm.driver.trim() : null,
      current_location: assetForm.location ? assetForm.location.trim() : null,
      odometer_reading: assetForm.category === "Plant" ? 0 : Number(assetForm.hoursOrOdo),
      operating_hours: assetForm.category === "Plant" ? Number(assetForm.hoursOrOdo) : 0,
      last_service_date: assetForm.lastServiceDate || null,
      next_service_date: assetForm.nextService || null,
      notes: assetForm.notes ? assetForm.notes.trim() : null,
      current_project_id: assetForm.currentProjectId || null
    };

    try {
      const { data, error } = await supabase
        .from("fleet_assets")
        .insert(payload)
        .select("id, company_id")
        .single();

      if (activeCompanyIdRef.current !== targetCompanyId) {
        return;
      }

      if (error) throw error;
      if (!data) {
        throw new Error("No data returned from database insert confirmation.");
      }

      showToast("Fleet asset successfully created!");
      setIsAddAssetOpen(false);
      fetchAssets(targetCompanyId);
    } catch (err: any) {
      console.error("Error creating fleet asset:", err);
      if (err.code === "23505") {
        const errorMsgStr = (err.message || "").toLowerCase() + " " + (err.detail || "").toLowerCase();
        if (errorMsgStr.includes("asset_number") || errorMsgStr.includes("uniq_asset_number") || errorMsgStr.includes("asset_number_uniq")) {
          showToast("An asset with this asset number already exists.");
        } else if (errorMsgStr.includes("reg") || errorMsgStr.includes("registration")) {
          showToast("A fleet asset with this registration already exists.");
        } else {
          showToast("A unique constraint violation occurred: " + err.message);
        }
      } else {
        showToast(err.message || "An error occurred while creating the asset.");
      }
    } finally {
      if (activeCompanyIdRef.current === targetCompanyId) {
        setMutationLoading(false);
      }
    }
  };

  const handleEditAssetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompany?.id || !selectedAsset) {
      showToast("Cannot edit asset: no active company or asset selected.");
      return;
    }
    const targetCompanyId = activeCompany.id;

    setMutationLoading(true);

    const payload: any = {
      asset_number: assetForm.assetNumber,
      category: assetForm.category,
      asset_type: assetForm.type,
      make_model: assetForm.makeModel,
      registration: assetForm.registration ? assetForm.registration.trim() : null,
      vin_chassis_number: assetForm.vinChassisNumber ? assetForm.vinChassisNumber.trim() : null,
      model_year: assetForm.year || null,
      status: assetForm.status,
      assigned_driver_operator: assetForm.driver ? assetForm.driver.trim() : null,
      current_location: assetForm.location ? assetForm.location.trim() : null,
      last_service_date: assetForm.lastServiceDate || null,
      next_service_date: assetForm.nextService || null,
      notes: assetForm.notes ? assetForm.notes.trim() : null,
      current_project_id: assetForm.currentProjectId || null
    };

    if (assetForm.category === "Plant") {
      payload.operating_hours = Number(assetForm.hoursOrOdo);
    } else {
      payload.odometer_reading = Number(assetForm.hoursOrOdo);
    }

    try {
      const { data, error } = await supabase
        .from("fleet_assets")
        .update(payload)
        .eq("id", selectedAsset.id)
        .eq("company_id", targetCompanyId)
        .select("id, company_id, is_archived")
        .single();

      if (activeCompanyIdRef.current !== targetCompanyId) {
        return;
      }

      if (error) throw error;
      if (!data) {
        throw new Error("The asset could not be updated. It may no longer exist or you may no longer have access to it.");
      }

      showToast("Fleet asset successfully updated!");
      setIsEditAssetOpen(false);
      setIsAssetDrawerOpen(false);
      fetchAssets(targetCompanyId);
    } catch (err: any) {
      console.error("Error updating fleet asset:", err);
      if (err.code === "23505") {
        const errorMsgStr = (err.message || "").toLowerCase() + " " + (err.detail || "").toLowerCase();
        if (errorMsgStr.includes("asset_number") || errorMsgStr.includes("uniq_asset_number") || errorMsgStr.includes("asset_number_uniq")) {
          showToast("An asset with this asset number already exists.");
        } else if (errorMsgStr.includes("reg") || errorMsgStr.includes("registration")) {
          showToast("A fleet asset with this registration already exists.");
        } else {
          showToast("A unique constraint violation occurred. Please check the entered values.");
        }
      } else {
        showToast(err.message || "An error occurred while updating the asset.");
      }
    } finally {
      if (activeCompanyIdRef.current === targetCompanyId) {
        setMutationLoading(false);
      }
    }
  };

  const handleOpenEditAsset = (a: FleetAsset) => {
    setSelectedAsset(a);
    setAssetForm({
      assetNumber: a.assetNumber || "",
      category: a.category,
      type: a.type,
      makeModel: a.makeModel,
      registration: a.registration,
      vinChassisNumber: a.vinChassisNumber || "",
      year: a.year,
      status: a.status,
      driver: a.driver,
      location: a.location,
      hoursOrOdo: a.hoursOrOdo,
      lastServiceDate: a.lastServiceDate || "",
      nextService: a.nextService,
      notes: a.notes || "",
      currentProjectId: a.currentProjectId || null
    });
    setIsEditAssetOpen(true);
  };

  const handleConfirmArchive = async () => {
    if (!assetPendingArchive || !activeCompany?.id) return;
    if (archiveSubmitting) return;

    // Confirm the pending asset belongs to the currently active company context
    const belongsToActiveCompany = assets.some(a => a.id === assetPendingArchive.id);
    if (!belongsToActiveCompany) {
      showToast("Selected asset does not belong to the active company context.");
      return;
    }

    const targetCompanyId = activeCompany.id;
    const targetAssetId = assetPendingArchive.id;
    const targetAssetNum = assetPendingArchive.assetNumber;

    setArchiveSubmitting(true);
    setMutationLoading(true);
    try {
      const { data, error } = await supabase
        .from("fleet_assets")
        .update({ is_archived: true })
        .eq("id", targetAssetId)
        .eq("company_id", targetCompanyId)
        .select("id, company_id, is_archived, archived_at, archived_by")
        .single();

      // If the company changed during the mutation, do not display a success state or alter visible state
      if (activeCompany?.id !== targetCompanyId) {
        return;
      }

      if (error) throw error;
      if (!data || data.is_archived !== true) {
        throw new Error("No record was returned or archiving failed on the server.");
      }

      showToast(`Asset ${targetAssetNum} successfully archived.`);
      setAssetPendingArchive(null);
      setIsAssetDrawerOpen(false);
      fetchAssets(targetCompanyId);
    } catch (err: any) {
      console.error("Error archiving asset:", err);
      if (activeCompany?.id !== targetCompanyId) {
        return;
      }
      showToast(err.message || "An error occurred while archiving the asset.");
    } finally {
      if (activeCompany?.id === targetCompanyId) {
        setArchiveSubmitting(false);
        setMutationLoading(false);
      }
    }
  };

  // Keyboard listener for Escape key to close the confirmation modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && assetPendingArchive && !archiveSubmitting) {
        setAssetPendingArchive(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [assetPendingArchive, archiveSubmitting]);

  const handleRestoreAsset = async (asset: FleetAsset) => {
    if (!activeCompany?.id) return;
    const targetCompanyId = activeCompany.id;
    setMutationLoading(true);
    try {
      const { data, error } = await supabase
        .from("fleet_assets")
        .update({ is_archived: false })
        .eq("id", asset.id)
        .eq("company_id", targetCompanyId)
        .select("id, company_id, is_archived")
        .single();

      if (activeCompanyIdRef.current !== targetCompanyId) {
        return;
      }

      if (error) throw error;
      if (!data || data.is_archived !== false) {
        throw new Error("No record was returned or restoring failed on the server.");
      }

      showToast(`Asset ${asset.assetNumber} successfully restored.`);
      setIsAssetDrawerOpen(false);
      fetchAssets(targetCompanyId);
    } catch (err: any) {
      console.error("Error restoring asset:", err);
      showToast(err.message || "An error occurred while restoring the asset.");
    } finally {
      if (activeCompanyIdRef.current === targetCompanyId) {
        setMutationLoading(false);
      }
    }
  };

  const handleAddTripSubmit = async (e: React.FormEvent) => {
    assertOperationalAction("create", "pages/Logistics/LogisticsPage.tsx");
    e.preventDefault();
    if (!activeCompany?.id) {
      showToast("Cannot create trip: no active company context.");
      return;
    }
    const targetCompanyId = activeCompany.id;

    const errors: Record<string, string> = {};
    if (!tripForm.fleet_asset_id) errors.registration = "Fleet asset selection is required.";
    if (!tripForm.driver_first_name.trim()) errors.driver = "Driver First Name is required.";
    if (!tripForm.driver_last_name.trim()) errors.driverLast = "Driver Last Name is required.";
    if (!tripForm.start_destination.trim()) errors.start = "Start Destination is required.";
    if (!tripForm.startedAtLocal) errors.startedAtLocal = "Start Date & Time is required.";

    const startedAtSAST = convertLocalToSASTTimestamp(tripForm.startedAtLocal);
    if (tripForm.startedAtLocal && !startedAtSAST) {
      errors.startedAtLocal = "Start Date & Time could not be resolved.";
    }

    const endedAtSAST =
      tripForm.status === "In Progress"
        ? null
        : convertLocalToSASTTimestamp(tripForm.endedAtLocal);

    if (tripForm.status !== "In Progress" && tripForm.endedAtLocal && !endedAtSAST) {
      errors.endedAtLocal = "End Date & Time could not be resolved.";
    }

    if (tripForm.fuel_unit !== "L" && tripForm.fuel_unit !== "gal") {
      errors.fuel = "Fuel unit must be L or gal.";
    }

    const kmVal = Number(tripForm.kilometres_travelled);
    if (isNaN(kmVal) || !isFinite(kmVal) || kmVal < 0) {
      errors.km = "Kilometres must be a non-negative finite number.";
    }
    const fuelVal = Number(tripForm.fuel_quantity);
    if (isNaN(fuelVal) || !isFinite(fuelVal) || fuelVal < 0) {
      errors.fuel = "Fuel quantity must be a non-negative finite number.";
    }

    if (tripForm.status === "Completed") {
      if (!tripForm.end_destination || !tripForm.end_destination.trim()) {
        errors.endDest = "Completed trips require an End Destination.";
      }
      if (!tripForm.endedAtLocal) {
        errors.endedAtLocal = "Completed trips require an End Date & Time.";
      }
    } else if (tripForm.status === "In Progress") {
      if (tripForm.endedAtLocal) {
        errors.endedAtLocal = "In Progress trips cannot have an End Date & Time.";
      }
    } else if (tripForm.status === "Delayed" || tripForm.status === "Cancelled") {
      if (tripForm.endedAtLocal && (!tripForm.end_destination || !tripForm.end_destination.trim())) {
        errors.endDest = "An End Destination is required when an End Date & Time is specified.";
      }
    }

    if (startedAtSAST && endedAtSAST) {
      const startMs = new Date(startedAtSAST).getTime();
      const endMs = new Date(endedAtSAST).getTime();
      if (endMs < startMs) {
        errors.endedAtLocal = "End Date & Time cannot be earlier than Start Date & Time.";
      }
    }

    if (Object.keys(errors).length > 0) {
      setTripErrors(errors);
      return;
    }

    setMutationLoading(true);

    const payload = {
      company_id: targetCompanyId,
      project_id: tripForm.project_id || null,
      fleet_asset_id: tripForm.fleet_asset_id,
      driver_first_name: tripForm.driver_first_name.trim(),
      driver_last_name: tripForm.driver_last_name.trim(),
      start_destination: tripForm.start_destination.trim(),
      end_destination: tripForm.end_destination?.trim() ? tripForm.end_destination.trim() : null,
      started_at: startedAtSAST,
      ended_at: endedAtSAST,
      kilometres_travelled: Number(tripForm.kilometres_travelled),
      fuel_quantity: Number(tripForm.fuel_quantity),
      fuel_unit: tripForm.fuel_unit,
      status: tripForm.status,
      notes: tripForm.notes ? tripForm.notes.trim() : null
    };

    try {
      const { data, error } = await supabase
        .from("fleet_trips")
        .insert(payload)
        .select(`
          id,
          company_id,
          fleet_asset_id,
          project_id,
          is_archived
        `)
        .single();

      if (activeCompanyIdRef.current !== targetCompanyId) {
        throw new Error("Active company context has changed.");
      }

      if (error) throw error;
      if (!data) throw new Error("No data returned from database insert confirmation.");
      if (data.company_id !== targetCompanyId) {
        throw new Error("Created record does not match active company context.");
      }
      if (data.fleet_asset_id !== payload.fleet_asset_id) {
        throw new Error("Created record does not match submitted asset.");
      }
      if (data.project_id !== payload.project_id) {
        throw new Error("Created record does not match submitted project.");
      }
      if (data.is_archived !== false) {
        throw new Error("Created record has incorrect archive status.");
      }

      showToast("Trip entry successfully logged!");
      setIsAddTripOpen(false);
      setLogisticsRevision(prev => prev + 1);
    } catch (err: any) {
      console.error("Error creating trip entry:", err);
      showToast(mapErrorMessage(err));
    } finally {
      if (activeCompanyIdRef.current === targetCompanyId) {
        setMutationLoading(false);
      }
    }
  };

  const handleEditTripSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompany?.id || !selectedTrip) {
      showToast("Cannot update trip: no active trip or company context.");
      return;
    }
    const targetCompanyId = activeCompany.id;

    const errors: Record<string, string> = {};
    if (!tripForm.fleet_asset_id) errors.registration = "Fleet asset selection is required.";
    if (!tripForm.driver_first_name.trim()) errors.driver = "Driver First Name is required.";
    if (!tripForm.driver_last_name.trim()) errors.driverLast = "Driver Last Name is required.";
    if (!tripForm.start_destination.trim()) errors.start = "Start Destination is required.";
    if (!tripForm.startedAtLocal) errors.startedAtLocal = "Start Date & Time is required.";

    const startedAtSAST = convertLocalToSASTTimestamp(tripForm.startedAtLocal);
    if (tripForm.startedAtLocal && !startedAtSAST) {
      errors.startedAtLocal = "Start Date & Time could not be resolved.";
    }

    const endedAtSAST =
      tripForm.status === "In Progress"
        ? null
        : convertLocalToSASTTimestamp(tripForm.endedAtLocal);

    if (tripForm.status !== "In Progress" && tripForm.endedAtLocal && !endedAtSAST) {
      errors.endedAtLocal = "End Date & Time could not be resolved.";
    }

    if (tripForm.fuel_unit !== "L" && tripForm.fuel_unit !== "gal") {
      errors.fuel = "Fuel unit must be L or gal.";
    }

    const kmVal = Number(tripForm.kilometres_travelled);
    if (isNaN(kmVal) || !isFinite(kmVal) || kmVal < 0) {
      errors.km = "Kilometres must be a non-negative finite number.";
    }
    const fuelVal = Number(tripForm.fuel_quantity);
    if (isNaN(fuelVal) || !isFinite(fuelVal) || fuelVal < 0) {
      errors.fuel = "Fuel quantity must be a non-negative finite number.";
    }

    if (tripForm.status === "Completed") {
      if (!tripForm.end_destination || !tripForm.end_destination.trim()) {
        errors.endDest = "Completed trips require an End Destination.";
      }
      if (!tripForm.endedAtLocal) {
        errors.endedAtLocal = "Completed trips require an End Date & Time.";
      }
    } else if (tripForm.status === "In Progress") {
      if (tripForm.endedAtLocal) {
        errors.endedAtLocal = "In Progress trips cannot have an End Date & Time.";
      }
    } else if (tripForm.status === "Delayed" || tripForm.status === "Cancelled") {
      if (tripForm.endedAtLocal && (!tripForm.end_destination || !tripForm.end_destination.trim())) {
        errors.endDest = "An End Destination is required when an End Date & Time is specified.";
      }
    }

    if (startedAtSAST && endedAtSAST) {
      const startMs = new Date(startedAtSAST).getTime();
      const endMs = new Date(endedAtSAST).getTime();
      if (endMs < startMs) {
        errors.endedAtLocal = "End Date & Time cannot be earlier than Start Date & Time.";
      }
    }

    if (Object.keys(errors).length > 0) {
      setTripErrors(errors);
      return;
    }

    setMutationLoading(true);

    const payload = {
      project_id: tripForm.project_id || null,
      fleet_asset_id: tripForm.fleet_asset_id,
      driver_first_name: tripForm.driver_first_name.trim(),
      driver_last_name: tripForm.driver_last_name.trim(),
      start_destination: tripForm.start_destination.trim(),
      end_destination: tripForm.end_destination?.trim() ? tripForm.end_destination.trim() : null,
      started_at: startedAtSAST,
      ended_at: endedAtSAST,
      kilometres_travelled: Number(tripForm.kilometres_travelled),
      fuel_quantity: Number(tripForm.fuel_quantity),
      fuel_unit: tripForm.fuel_unit,
      status: tripForm.status,
      notes: tripForm.notes ? tripForm.notes.trim() : null
    };

    try {
      const { data, error } = await supabase
        .from("fleet_trips")
        .update(payload)
        .eq("id", selectedTrip.id)
        .eq("company_id", targetCompanyId)
        .select(`
          id,
          company_id,
          fleet_asset_id,
          project_id,
          is_archived
        `)
        .single();

      if (activeCompanyIdRef.current !== targetCompanyId) {
        throw new Error("Active company context has changed.");
      }

      if (error) throw error;
      if (!data) throw new Error("No data returned or record could not be updated.");
      if (data.id !== selectedTrip.id) {
        throw new Error("Updated record ID mismatch.");
      }
      if (data.company_id !== targetCompanyId) {
        throw new Error("Updated record does not match active company context.");
      }
      if (data.fleet_asset_id !== payload.fleet_asset_id) {
        throw new Error("Updated record does not match submitted asset.");
      }
      if (data.project_id !== payload.project_id) {
        throw new Error("Updated record does not match submitted project.");
      }
      if (data.is_archived !== false) {
        throw new Error("Updated record has incorrect archive status.");
      }

      showToast("Trip entry successfully updated!");
      setIsEditTripOpen(false);
      setSelectedTrip(null);
      setLogisticsRevision(prev => prev + 1);
    } catch (err: any) {
      console.error("Error updating trip entry:", err);
      showToast(mapErrorMessage(err));
    } finally {
      if (activeCompanyIdRef.current === targetCompanyId) {
        setMutationLoading(false);
      }
    }
  };

  const handleOpenEditTrip = (t: TripEntry) => {
    setSelectedTrip(t);
    setTripForm({
      fleet_asset_id: t.fleet_asset_id,
      project_id: t.project_id,
      driver_first_name: t.driver_first_name,
      driver_last_name: t.driver_last_name,
      start_destination: t.start_destination,
      end_destination: t.end_destination || "",
      startedAtLocal: convertSASTTimestampToLocal(t.started_at),
      endedAtLocal: convertSASTTimestampToLocal(t.ended_at),
      kilometres_travelled: t.kilometres_travelled,
      fuel_quantity: t.fuel_quantity,
      fuel_unit: t.fuel_unit,
      status: t.status,
      notes: t.notes || ""
    });
    setTripErrors({});
    setIsEditTripOpen(true);
  };

  const handleConfirmTripArchive = async () => {
    if (!tripPendingArchive || !activeCompany?.id) return;
    if (tripArchiveSubmitting) return;

    const targetCompanyId = activeCompany.id;
    setTripArchiveSubmitting(true);
    setMutationLoading(true);
    try {
      const { data, error } = await supabase
        .from("fleet_trips")
        .update({ is_archived: true })
        .eq("id", tripPendingArchive.id)
        .eq("company_id", targetCompanyId)
        .select(`
          id,
          company_id,
          is_archived,
          archived_at,
          archived_by
        `)
        .single();

      if (activeCompanyIdRef.current !== targetCompanyId) {
        return; // ignore if company changed in React closure
      }

      if (error) throw error;
      if (!data) {
        throw new Error("No record was returned or archiving failed on the server.");
      }
      if (data.id !== tripPendingArchive.id) {
        throw new Error("Archived record ID mismatch.");
      }
      if (data.company_id !== targetCompanyId) {
        throw new Error("Archived record does not match active company context.");
      }
      if (data.is_archived !== true) {
        throw new Error("Archiving failed: record is_archived status is false.");
      }
      if (!data.archived_at) {
        throw new Error("Archived record is missing archived_at timestamp.");
      }
      if (!data.archived_by) {
        throw new Error("Archived record is missing archived_by identification.");
      }

      showToast("Trip successfully archived.");
      setTripPendingArchive(null);
      setIsTripDetailsOpen(false);
      setLogisticsRevision(prev => prev + 1);
    } catch (err: any) {
      console.error("Error archiving trip:", err);
      showToast(mapErrorMessage(err));
    } finally {
      if (activeCompanyIdRef.current === targetCompanyId) {
        setTripArchiveSubmitting(false);
        setMutationLoading(false);
      }
    }
  };

  const handleRestoreTrip = async (trip: TripEntry) => {
    if (!activeCompany?.id) return;
    const targetCompanyId = activeCompany.id;
    setMutationLoading(true);
    try {
      const { data, error } = await supabase
        .from("fleet_trips")
        .update({ is_archived: false })
        .eq("id", trip.id)
        .eq("company_id", targetCompanyId)
        .select(`
          id,
          company_id,
          is_archived,
          archived_at,
          archived_by
        `)
        .single();

      if (activeCompanyIdRef.current !== targetCompanyId) {
        return; // ignore if company changed in React closure
      }

      if (error) throw error;
      if (!data) {
        throw new Error("No record was returned or restoring failed on the server.");
      }
      if (data.id !== trip.id) {
        throw new Error("Restored record ID mismatch.");
      }
      if (data.company_id !== targetCompanyId) {
        throw new Error("Restored record does not match active company context.");
      }
      if (data.is_archived !== false) {
        throw new Error("Restoring failed: record is_archived status is true.");
      }
      if (data.archived_at !== null) {
        throw new Error("Restored record should have null archived_at.");
      }
      if (data.archived_by !== null) {
        throw new Error("Restored record should have null archived_by.");
      }

      showToast("Trip successfully restored.");
      setLogisticsRevision(prev => prev + 1);
    } catch (err: any) {
      console.error("Error restoring trip:", err);
      showToast(mapErrorMessage(err));
    } finally {
      if (activeCompanyIdRef.current === targetCompanyId) {
        setMutationLoading(false);
      }
    }
  };

  const handleAssetSelectForTrip = (assetId: string) => {
    const asset = assets.find(a => a.id === assetId);
    if (asset) {
      setTripForm(prev => ({
        ...prev,
        fleet_asset_id: asset.id
      }));
    } else {
      setTripForm(prev => ({
        ...prev,
        fleet_asset_id: ""
      }));
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-fadeIn relative text-slate-800">
      
      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-4 right-4 bg-[#07182E] text-white border border-[#1E3A5F] px-4 py-3 rounded-xl shadow-lg z-50 flex items-center gap-2 animate-bounce">
          <CheckSquare className="w-5 h-5 text-[#FF9F1C]" />
          <span className="text-xs font-semibold">{toast}</span>
        </div>
      )}

      {/* Hero Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#07182E] to-[#0F2D54] p-6 rounded-3xl border border-[#1E3A5F] shadow-lg text-white">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#102846] rounded-xl text-[#FF9F1C] border border-[#1E3A5F]">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">Logistics Hub</h1>
              <p className="text-xs text-[#CBD5E1] font-medium">Construction Fleet & Logistics Operations Portal</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {activeSection === "inventory" && (
            <button 
              onClick={() => {
                setAssetForm({
                  assetNumber: "",
                  category: "Plant",
                  type: "",
                  makeModel: "",
                  registration: "",
                  vinChassisNumber: "",
                  year: new Date().getFullYear(),
                  status: "Available",
                  driver: "",
                  location: "",
                  hoursOrOdo: 0,
                  lastServiceDate: "",
                  nextService: "",
                  notes: "",
                  currentProjectId: null
                });
                setIsAddAssetOpen(true);
              }}
              className="px-4 py-2 bg-[#FF9F1C] hover:bg-[#E08610] text-slate-900 font-bold rounded-xl text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Fleet Asset
            </button>
          )}

          {activeSection === "trips" && (
            <button 
              onClick={() => {
                const nowSast = getSASTNow();
                const nowSastStr = nowSast.toISOString().substring(0, 16); // format: YYYY-MM-DDTHH:MM
                setTripForm({
                  fleet_asset_id: "",
                  project_id: null,
                  driver_first_name: "",
                  driver_last_name: "",
                  start_destination: "",
                  end_destination: "",
                  startedAtLocal: nowSastStr,
                  endedAtLocal: "",
                  kilometres_travelled: 0,
                  fuel_quantity: 0,
                  fuel_unit: "L",
                  status: "In Progress",
                  notes: ""
                });
                setTripErrors({});
                setIsAddTripOpen(true);
              }}
              className="px-4 py-2 bg-[#FF9F1C] hover:bg-[#E08610] text-slate-900 font-bold rounded-xl text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" /> Add Trip Entry
            </button>
          )}
 
          {activeSection === "monitoring" && (
            <div className="flex flex-col items-end">
              <button 
                disabled={true}
                className="px-4 py-2 bg-slate-700/50 border border-slate-600 text-slate-400 font-bold rounded-xl text-xs transition-colors flex items-center gap-2 cursor-not-allowed shadow-none"
              >
                <Download className="w-4 h-4" /> Export Report
              </button>
              <span className="text-[10px] text-[#A5B4FC]/60 font-medium mt-1">Export offline until backend integration is completed</span>
            </div>
          )}
        </div>
      </div>

      {/* Internal Tabs Segmented Control */}
      <div className="bg-white p-1 rounded-2xl border border-[#E2E8F0] shadow-xs flex max-w-lg">
        <button
          onClick={() => setActiveSection("inventory")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
            activeSection === "inventory"
              ? "bg-[#07182E] text-white shadow-md"
              : "text-slate-500 hover:text-[#07182E] hover:bg-slate-50"
          }`}
        >
          Fleet Inventory
        </button>
        <button
          onClick={() => setActiveSection("monitoring")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
            activeSection === "monitoring"
              ? "bg-[#07182E] text-white shadow-md"
              : "text-slate-500 hover:text-[#07182E] hover:bg-slate-50"
          }`}
        >
          Fleet Monitoring
        </button>
        <button
          onClick={() => setActiveSection("trips")}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
            activeSection === "trips"
              ? "bg-[#07182E] text-white shadow-md"
              : "text-slate-500 hover:text-[#07182E] hover:bg-slate-50"
          }`}
        >
          Trip Tracking & Fuel
        </button>
      </div>

      {/* TAB CONTENT 1: FLEET INVENTORY */}
      {activeSection === "inventory" && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Quick Categories Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Plant Card */}
            <div className="bg-white p-5 border border-[#E2E8F0] rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.02)] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-[#FF9F1C]" />
                  <h3 className="font-bold text-sm text-[#07182E]">Plant Machinery</h3>
                </div>
                <span className="text-xs font-bold bg-[#F1F5F9] text-slate-700 px-2 py-1 rounded-md">
                  {categoryStats.Plant.total} Total
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-emerald-50 text-emerald-800 p-2 rounded-xl">
                  <div className="font-bold">{categoryStats.Plant.available}</div>
                  <div className="text-[10px] text-emerald-600 font-semibold">Available</div>
                </div>
                <div className="bg-[#EBF5FF] text-[#1E40AF] p-2 rounded-xl">
                  <div className="font-bold">{categoryStats.Plant.inUse}</div>
                  <div className="text-[10px] text-[#2563EB] font-semibold">In Operation</div>
                </div>
                <div className="bg-amber-50 text-amber-800 p-2 rounded-xl">
                  <div className="font-bold">{categoryStats.Plant.maintenance}</div>
                  <div className="text-[10px] text-amber-600 font-semibold">Maintenance</div>
                </div>
                <div className="bg-rose-50 text-rose-800 p-2 rounded-xl">
                  <div className="font-bold">{categoryStats.Plant.outOfService}</div>
                  <div className="text-[10px] text-rose-600 font-semibold">Out of Service</div>
                </div>
              </div>
            </div>

            {/* Automobiles Card */}
            <div className="bg-white p-5 border border-[#E2E8F0] rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.02)] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-sky-500" />
                  <h3 className="font-bold text-sm text-[#07182E]">Automobiles</h3>
                </div>
                <span className="text-xs font-bold bg-[#F1F5F9] text-slate-700 px-2 py-1 rounded-md">
                  {categoryStats.Automobiles.total} Total
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-emerald-50 text-emerald-800 p-2 rounded-xl">
                  <div className="font-bold">{categoryStats.Automobiles.available}</div>
                  <div className="text-[10px] text-emerald-600 font-semibold">Available</div>
                </div>
                <div className="bg-[#EBF5FF] text-[#1E40AF] p-2 rounded-xl">
                  <div className="font-bold">{categoryStats.Automobiles.inUse}</div>
                  <div className="text-[10px] text-[#2563EB] font-semibold">In Use</div>
                </div>
                <div className="bg-amber-50 text-amber-800 p-2 rounded-xl">
                  <div className="font-bold">{categoryStats.Automobiles.maintenance}</div>
                  <div className="text-[10px] text-amber-600 font-semibold">Maintenance</div>
                </div>
                <div className="bg-rose-50 text-rose-800 p-2 rounded-xl">
                  <div className="font-bold">{categoryStats.Automobiles.outOfService}</div>
                  <div className="text-[10px] text-rose-600 font-semibold">Out of Service</div>
                </div>
              </div>
            </div>

            {/* Commercial Vehicles Card */}
            <div className="bg-white p-5 border border-[#E2E8F0] rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.02)] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-500" />
                  <h3 className="font-bold text-sm text-[#07182E]">Commercial Vehicles</h3>
                </div>
                <span className="text-xs font-bold bg-[#F1F5F9] text-slate-700 px-2 py-1 rounded-md">
                  {categoryStats.Commercial.total} Total
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-emerald-50 text-emerald-800 p-2 rounded-xl">
                  <div className="font-bold">{categoryStats.Commercial.available}</div>
                  <div className="text-[10px] text-emerald-600 font-semibold">Available</div>
                </div>
                <div className="bg-[#EBF5FF] text-[#1E40AF] p-2 rounded-xl">
                  <div className="font-bold">{categoryStats.Commercial.inUse}</div>
                  <div className="text-[10px] text-[#2563EB] font-semibold">In Use</div>
                </div>
                <div className="bg-amber-50 text-amber-800 p-2 rounded-xl">
                  <div className="font-bold">{categoryStats.Commercial.maintenance}</div>
                  <div className="text-[10px] text-amber-600 font-semibold">Maintenance</div>
                </div>
                <div className="bg-rose-50 text-rose-800 p-2 rounded-xl">
                  <div className="font-bold">{categoryStats.Commercial.outOfService}</div>
                  <div className="text-[10px] text-rose-600 font-semibold">Out of Service</div>
                </div>
              </div>
            </div>

          </div>

          {/* Table & Filtering */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden">
            <div className="p-5 border-b border-[#E2E8F0] flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-[#07182E]" />
                <h2 className="font-extrabold text-sm text-[#07182E]">Inventory Register</h2>
              </div>

              {/* Filters Panel */}
              <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
                <div className="relative flex-1 md:flex-none min-w-[200px]">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={invSearch}
                    onChange={(e) => { setInvSearch(e.target.value); setInvPage(1); }}
                    placeholder="Search asset, type, driver..."
                    className="w-full pl-9 pr-4 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#FF9F1C]"
                  />
                </div>

                <select
                  value={invCategory}
                  onChange={(e) => { setInvCategory(e.target.value); setInvPage(1); }}
                  className="bg-white border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs text-slate-600 focus:outline-none"
                >
                  <option value="All">All Categories</option>
                  <option value="Plant">Plant</option>
                  <option value="Automobiles">Automobiles</option>
                  <option value="Commercial Vehicles">Commercial Vehicles</option>
                </select>

                <select
                  value={invStatus}
                  onChange={(e) => { setInvStatus(e.target.value); setInvPage(1); }}
                  className="bg-white border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs text-slate-600 focus:outline-none"
                >
                  <option value="All">All Statuses</option>
                  <option value="Available">Available</option>
                  <option value="In Use">In Use</option>
                  <option value="Under Maintenance">Under Maintenance</option>
                  <option value="Out of Service">Out of Service</option>
                </select>

                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 border border-[#E2E8F0] rounded-xl px-3 py-1.5 bg-white cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(e) => { setShowArchived(e.target.checked); setInvPage(1); }}
                    className="rounded text-[#FF9F1C] focus:ring-[#FF9F1C] h-3.5 w-3.5 border-[#E2E8F0]"
                  />
                  <span>Show Archived</span>
                </label>

                <button
                  onClick={() => {
                    setInvSearch("");
                    setInvCategory("All");
                    setInvStatus("All");
                    setInvSortField("assetNumber");
                    setInvSortOrder("asc");
                    setInvPage(1);
                    setShowArchived(false);
                  }}
                  className="p-1.5 bg-[#F1F5F9] hover:bg-[#E2E8F0] rounded-xl text-slate-600 transition-colors cursor-pointer"
                  title="Clear Filters"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Loading, Error and Inventory Register Content wrapper */}
            {loading ? (
              <div className="p-12 text-center flex flex-col items-center justify-center space-y-3 bg-white border-t border-[#E2E8F0]">
                <div className="flex space-x-2 justify-center items-center">
                  <div className="h-2.5 w-2.5 bg-[#07182E] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="h-2.5 w-2.5 bg-[#07182E] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="h-2.5 w-2.5 bg-[#07182E] rounded-full animate-bounce"></div>
                </div>
                <p className="text-xs text-slate-500 font-semibold">Connecting to fleet database...</p>
              </div>
            ) : error ? (
              <div className="p-12 text-center flex flex-col items-center justify-center space-y-3 bg-white border-t border-[#E2E8F0]">
                <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 shadow-xs">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-extrabold text-sm text-[#07182E]">Database Connection Failed</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">{error}</p>
                </div>
                <button
                  onClick={() => {
                    if (activeCompany?.id) {
                      fetchAssets(activeCompany.id);
                    }
                  }}
                  className="px-4 py-2 bg-[#07182E] text-[#FF9F1C] hover:bg-[#07182E]/90 text-xs font-bold rounded-xl cursor-pointer transition-colors"
                >
                  Retry Connection
                </button>
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center space-y-3 bg-white border-t border-[#E2E8F0]">
                <div className="p-3 bg-slate-50 text-slate-400 rounded-2xl border border-slate-100">
                  <Truck className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-extrabold text-sm text-[#07182E]">No fleet assets found</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {assets.length === 0 
                      ? "Register a fleet asset to begin managing plant, automobiles and commercial vehicles."
                      : "No assets match your current filter settings."}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-slate-500 font-bold text-[10px] tracking-wider uppercase">
                        <th className="p-4 cursor-pointer" onClick={() => { setInvSortField("assetNumber"); setInvSortOrder(invSortOrder === "asc" ? "desc" : "asc"); }}>Asset No</th>
                        <th className="p-4 cursor-pointer" onClick={() => { setInvSortField("category"); setInvSortOrder(invSortOrder === "asc" ? "desc" : "asc"); }}>Category</th>
                        <th className="p-4 cursor-pointer" onClick={() => { setInvSortField("type"); setInvSortOrder(invSortOrder === "asc" ? "desc" : "asc"); }}>Type</th>
                        <th className="p-4">Make & Model</th>
                        <th className="p-4">Reg / Plate</th>
                        <th className="p-4 cursor-pointer text-center" onClick={() => { setInvSortField("status"); setInvSortOrder(invSortOrder === "asc" ? "desc" : "asc"); }}>Status</th>
                        <th className="p-4">Assigned Driver</th>
                        <th className="p-4">Hours / Odo</th>
                        <th className="p-4">Next Service</th>
                        <th className="p-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F5F9] text-xs font-medium text-slate-700">
                      {paginatedAssets.map(a => (
                        <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 font-bold text-[#07182E]">
                            <span>{a.assetNumber}</span>
                          </td>
                          <td className="p-4 text-slate-500">{a.category}</td>
                          <td className="p-4 font-semibold">{a.type}</td>
                          <td className="p-4 text-slate-900">{a.makeModel}</td>
                          <td className="p-4 font-mono font-bold text-slate-600 bg-slate-50 px-2 py-1 rounded-md inline-block my-2">{a.registration || "—"}</td>
                          <td className="p-4 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              a.status === "Available" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                              a.status === "In Use" ? "bg-[#EBF5FF] text-[#1E40AF] border border-[#BFDBFE]" :
                              a.status === "Under Maintenance" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                              "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}>
                              {a.status}
                            </span>
                            {a.isArchived && (
                              <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs">
                                Archived
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-slate-900">{a.driver || "Unassigned"}</td>
                          <td className="p-4 text-slate-600">
                            {a.category === "Plant" ? `${a.hoursOrOdo.toLocaleString()} hrs` : `${a.hoursOrOdo.toLocaleString()} km`}
                          </td>
                          <td className="p-4 text-slate-500">{a.nextService || "—"}</td>
                          <td className="p-4">
                            <div className="flex items-center justify-center gap-1.5">
                              <button 
                                onClick={() => { setSelectedAsset(a); setIsAssetDrawerOpen(true); }}
                                className="p-1.5 text-[#1E293B] hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                                title="View Asset"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleOpenEditAsset(a)}
                                className="p-1.5 text-sky-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                                title="Edit Asset"
                                disabled={mutationLoading}
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              {a.isArchived ? (
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRestoreAsset(a);
                                  }}
                                  className="p-1.5 text-emerald-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                                  title="Restore Asset"
                                  disabled={mutationLoading}
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                              ) : (
                                <button 
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAssetPendingArchive(a);
                                  }}
                                  className="p-1.5 text-rose-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                                  title="Archive Asset"
                                  disabled={mutationLoading}
                                >
                                  <Archive className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden p-4 space-y-4">
                  {paginatedAssets.map(a => (
                    <div key={a.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="font-bold text-[#07182E]">{a.assetNumber}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 items-center justify-end">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            a.status === "Available" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                            a.status === "In Use" ? "bg-[#EBF5FF] text-[#1E40AF] border border-[#BFDBFE]" :
                            a.status === "Under Maintenance" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                            "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}>
                            {a.status}
                          </span>
                          {a.isArchived && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                              Archived
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-y-2 text-xs">
                        <div>
                          <span className="text-slate-400 text-[10px]">Type / Category</span>
                          <div className="font-semibold">{a.type} ({a.category})</div>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px]">Make & Model</span>
                          <div className="font-semibold">{a.makeModel}</div>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px]">Registration</span>
                          <div className="font-mono font-bold">{a.registration || "—"}</div>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px]">Driver</span>
                          <div className="font-semibold">{a.driver || "Unassigned"}</div>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px]">Usage Metrics</span>
                          <div className="font-semibold">
                            {a.category === "Plant" ? `${a.hoursOrOdo} hrs` : `${a.hoursOrOdo} km`}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px]">Next Service</span>
                          <div className="font-semibold text-slate-600">{a.nextService || "—"}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                        <button 
                          onClick={() => { setSelectedAsset(a); setIsAssetDrawerOpen(true); }}
                          className="px-2.5 py-1.5 bg-white text-xs font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
                        >
                          View Details
                        </button>
                        <button 
                          onClick={() => handleOpenEditAsset(a)}
                          className="px-2.5 py-1.5 bg-[#FF9F1C] text-xs font-bold text-slate-900 rounded-lg hover:bg-[#E08610] cursor-pointer"
                          disabled={mutationLoading}
                        >
                          Edit
                        </button>
                        {a.isArchived ? (
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRestoreAsset(a);
                            }}
                            className="px-2.5 py-1.5 bg-emerald-600 text-xs font-bold text-white rounded-lg hover:bg-emerald-700 cursor-pointer"
                            disabled={mutationLoading}
                          >
                            Restore
                          </button>
                        ) : (
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAssetPendingArchive(a);
                            }}
                            className="px-2.5 py-1.5 bg-rose-600 text-xs font-bold text-white rounded-lg hover:bg-rose-700 cursor-pointer"
                            disabled={mutationLoading}
                          >
                            Archive
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination Controls */}
                <div className="p-4 border-t border-[#E2E8F0] flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    Showing {filteredAssets.length ? (invPage - 1) * itemsPerPage + 1 : 0} to {Math.min(invPage * itemsPerPage, filteredAssets.length)} of {filteredAssets.length} assets
                  </span>
                  <div className="flex gap-1">
                    <button
                      disabled={invPage === 1}
                      onClick={() => setInvPage(prev => Math.max(prev - 1, 1))}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border border-[#E2E8F0]"
                    >
                      Previous
                    </button>
                    <button
                      disabled={invPage === totalInvPages}
                      onClick={() => setInvPage(prev => Math.min(prev + 1, totalInvPages))}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border border-[#E2E8F0]"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}

          </div>
        </div>
      )}

      {/* TAB CONTENT 2: FLEET MONITORING */}
      {activeSection === "monitoring" && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Segmented Period Selector and Controls */}
          <div className="bg-white p-5 border border-[#E2E8F0] rounded-2xl shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-extrabold text-sm text-[#07182E]">Select Report Period</h3>
                <p className="text-xs text-slate-500">View overall performance reports and analytics below.</p>
              </div>

              {/* Segmented Period Buttons */}
              <div className="flex bg-[#F1F5F9] p-1 rounded-xl w-fit">
                <button
                  onClick={() => setMonPeriod("daily")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    monPeriod === "daily" ? "bg-[#07182E] text-white shadow-sm" : "text-slate-500 hover:text-[#07182E]"
                  }`}
                >
                  Daily
                </button>
                <button
                  onClick={() => setMonPeriod("weekly")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    monPeriod === "weekly" ? "bg-[#07182E] text-white shadow-sm" : "text-slate-500 hover:text-[#07182E]"
                  }`}
                >
                  Weekly
                </button>
                <button
                  onClick={() => setMonPeriod("monthly")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    monPeriod === "monthly" ? "bg-[#07182E] text-white shadow-sm" : "text-slate-500 hover:text-[#07182E]"
                  }`}
                >
                  Monthly
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-100">
              {monPeriod === "daily" && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Selected Date</label>
                  <input
                    type="date"
                    value={monDailyDate}
                    onChange={(e) => setMonDailyDate(e.target.value)}
                    className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs text-slate-700 focus:outline-none"
                  />
                </div>
              )}
              {monPeriod === "weekly" && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Selected Week</label>
                  <input
                    type="week"
                    value={monWeeklyRange}
                    onChange={(e) => setMonWeeklyRange(e.target.value)}
                    className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs text-slate-700 focus:outline-none"
                  />
                </div>
              )}
              {monPeriod === "monthly" && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Selected Month</label>
                  <input
                    type="month"
                    value={monMonthlyVal}
                    onChange={(e) => setMonMonthlyVal(e.target.value)}
                    className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs text-slate-700 focus:outline-none"
                  />
                </div>
              )}

              {/* Optional Project Filter */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Project Filter</label>
                <select
                  value={monitoringProjectFilter}
                  onChange={(e) => setMonitoringProjectFilter(e.target.value)}
                  className="bg-white border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs text-slate-700 focus:outline-none block min-w-[200px]"
                >
                  <option value="All">All Company Projects</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                  <option value="unassigned">Unassigned / No Project</option>
                </select>
              </div>
            </div>
          </div>

          {/* Monitoring Dashboard Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className="bg-white p-5 border border-[#E2E8F0] rounded-2xl shadow-xs">
              <div className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Current Fleet Utilization</div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-extrabold text-[#07182E]">{monitoringStats.currentFleetUtilization}%</span>
                <span className="text-xs text-emerald-600 font-bold">Optimal</span>
              </div>
              <div className="mt-2 text-[10px] text-slate-500 font-semibold">Active vs total non-archived assets.</div>
            </div>

            <div className="bg-white p-5 border border-[#E2E8F0] rounded-2xl shadow-xs">
              <div className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Operating Plant</div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-extrabold text-[#07182E]">{monitoringStats.plantInOperation}</span>
                <span className="text-xs text-slate-500 font-semibold">Units</span>
              </div>
              <div className="mt-2 text-[10px] text-slate-500 font-semibold">Machinery currently active on site.</div>
            </div>

            <div className="bg-white p-5 border border-[#E2E8F0] rounded-2xl shadow-xs">
              <div className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Under Maintenance</div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-extrabold text-amber-600">{monitoringStats.underMaintenance}</span>
                <span className="text-xs text-slate-500 font-semibold">Assets</span>
              </div>
              <div className="mt-2 text-[10px] text-slate-500 font-semibold">In workshop or undergoing service.</div>
            </div>

            <div className="bg-[#FFF5F5] p-5 border border-rose-100 rounded-2xl shadow-xs">
              <div className="text-rose-500 font-bold text-[10px] uppercase tracking-wider">Requiring Attention</div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="text-2xl font-extrabold text-rose-700">{monitoringStats.requiringAttention}</span>
                <span className="text-xs text-rose-600 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> High Alert
                </span>
              </div>
              <div className="mt-2 text-[10px] text-rose-600 font-semibold">Includes expired service schedules.</div>
            </div>

          </div>

          {/* Period Activity & Fuel Summary */}
          <div className="space-y-4">
            <h3 className="font-extrabold text-xs text-[#07182E] uppercase tracking-wider">Period Activity & Fuel Summary</h3>
            {monitoringTripsLoading ? (
              <div className="p-8 text-center flex flex-col items-center justify-center bg-slate-50 border border-dashed border-[#E2E8F0] rounded-2xl h-32">
                <div className="flex space-x-2 justify-center items-center">
                  <div className="h-2 w-2 bg-[#07182E] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="h-2 w-2 bg-[#07182E] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="h-2 w-2 bg-[#07182E] rounded-full animate-bounce"></div>
                </div>
                <p className="text-xs text-slate-500 mt-2 font-semibold">Loading period trip analytics...</p>
              </div>
            ) : monitoringTripsError ? (
              <div className="p-8 text-center flex flex-col items-center justify-center bg-rose-50 border border-rose-100 rounded-2xl">
                <AlertTriangle className="w-8 h-8 text-rose-500 mb-2" />
                <h4 className="font-bold text-xs text-[#07182E]">Failed to load trip analytics</h4>
                <p className="text-[10px] text-slate-500 max-w-sm mt-1">{monitoringTripsError}</p>
                <button
                  onClick={() => {
                    if (activeCompany?.id) {
                      fetchMonitoringTrips(
                        activeCompany.id,
                        monPeriod,
                        monDailyDate,
                        monWeeklyRange,
                        monMonthlyVal,
                        monitoringProjectFilter
                      );
                    }
                  }}
                  className="mt-3 px-3 py-1.5 bg-[#07182E] hover:bg-[#07182E]/90 text-[#FF9F1C] text-[10px] font-bold rounded-lg cursor-pointer"
                >
                  Retry Query
                </button>
              </div>
            ) : monitoringTrips.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl h-32 animate-fadeIn">
                <Calendar className="w-8 h-8 text-slate-400 mb-2" />
                <h4 className="font-bold text-xs text-[#07182E]">No trips logged during this period</h4>
                <p className="text-[10px] text-slate-500 mt-1">
                  {monitoringProjectFilter !== "All"
                    ? "No trip records match the selected project in this timeframe."
                    : "No operations have been recorded in the active calendar boundary."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 animate-fadeIn">
                
                <div className="bg-white p-4 border border-[#E2E8F0] rounded-2xl shadow-xs space-y-1">
                  <span className="text-slate-400 font-bold text-[10px] uppercase">Logged / Completed</span>
                  <div className="text-lg font-extrabold text-[#07182E]">
                    {monitoringStats.loggedTripsCount} <span className="text-xs text-slate-400 font-normal">/ {monitoringStats.completedTripsCount} Done</span>
                  </div>
                  <p className="text-[9px] text-slate-400">Total logged versus completed trips</p>
                </div>

                <div className="bg-white p-4 border border-[#E2E8F0] rounded-2xl shadow-xs space-y-1">
                  <span className="text-slate-400 font-bold text-[10px] uppercase">Active Fleet Units</span>
                  <div className="text-lg font-extrabold text-emerald-600">
                    {monitoringStats.distinctOperationalCount} <span className="text-xs text-slate-400 font-normal">/ {monitoringStats.total} total</span>
                  </div>
                  <p className="text-[9px] text-slate-400">Operational assets with active trips</p>
                </div>

                <div className="bg-white p-4 border border-[#E2E8F0] rounded-2xl shadow-xs space-y-1">
                  <span className="text-slate-400 font-bold text-[10px] uppercase">Total Distance</span>
                  <div className="text-lg font-extrabold text-[#07182E]">
                    {monitoringStats.totalDistance.toLocaleString()} <span className="text-xs text-slate-400 font-normal">km</span>
                  </div>
                  <p className="text-[9px] text-slate-400">Cumulative distance travelled</p>
                </div>

                <div className="bg-white p-4 border border-[#E2E8F0] rounded-2xl shadow-xs space-y-1">
                  <span className="text-slate-400 font-bold text-[10px] uppercase">Total Recorded Fuel</span>
                  <div className="text-lg font-extrabold text-[#07182E]">
                    {monitoringStats.totalFuelLitres.toLocaleString()}{" "}
                    <span className="text-xs text-slate-400 font-normal">L equivalent</span>
                  </div>
                  <p className="text-[9px] text-slate-400">Litre-equivalent fuel consumed</p>
                </div>

                <div className="bg-white p-4 border border-[#E2E8F0] rounded-2xl shadow-xs space-y-1 col-span-2 lg:col-span-1">
                  <span className="text-slate-400 font-bold text-[10px] uppercase">Average Fuel Consumption</span>
                  <div className="text-lg font-extrabold text-[#FF9F1C]">
                    {monitoringStats.averageFuelConsumption !== null
                      ? `${monitoringStats.averageFuelConsumption.toLocaleString()}`
                      : "—"}{" "}
                    <span className="text-xs text-slate-400 font-normal">L equivalent/100 km</span>
                  </div>
                  <p className="text-[9px] text-slate-400">Average consumption rate</p>
                </div>

              </div>
            )}
          </div>

          {/* Recharts Performance Visualizations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Chart 1: Category Status Summary */}
            <div className="bg-white p-5 border border-[#E2E8F0] rounded-2xl shadow-xs space-y-4">
              <h4 className="text-xs font-bold text-[#07182E] uppercase tracking-wider">Fleet Status Distribution</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { name: "Plant", Available: categoryStats.Plant.available, "In Use": categoryStats.Plant.inUse, "Maintenance": categoryStats.Plant.maintenance, "Out of Service": categoryStats.Plant.outOfService },
                    { name: "Commercial", Available: categoryStats.Commercial.available, "In Use": categoryStats.Commercial.inUse, "Maintenance": categoryStats.Commercial.maintenance, "Out of Service": categoryStats.Commercial.outOfService },
                    { name: "Automobiles", Available: categoryStats.Automobiles.available, "In Use": categoryStats.Automobiles.inUse, "Maintenance": categoryStats.Automobiles.maintenance, "Out of Service": categoryStats.Automobiles.outOfService }
                  ]}>
                    <XAxis dataKey="name" fontSize={11} stroke="#94A3B8" />
                    <YAxis fontSize={11} stroke="#94A3B8" />
                    <Tooltip cursor={{ fill: "transparent" }} />
                    <Legend wrapperStyle={{ fontSize: 10, fontWeight: "bold" }} />
                    <Bar dataKey="Available" fill="#10B981" />
                    <Bar dataKey="In Use" fill="#2563EB" />
                    <Bar dataKey="Maintenance" fill="#F59E0B" />
                    <Bar dataKey="Out of Service" fill="#EF4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Fleet Utilisation Trends over selected date bounds */}
            <div className="bg-white p-5 border border-[#E2E8F0] rounded-2xl shadow-xs space-y-4">
              <h4 className="text-xs font-bold text-[#07182E] uppercase tracking-wider">Period Fleet Activity (%)</h4>
              <div className="h-64 flex flex-col items-center justify-center">
                {monitoringTripsLoading ? (
                  <div className="flex space-x-2 items-center justify-center">
                    <div className="h-2 w-2 bg-[#07182E] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="h-2 w-2 bg-[#07182E] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="h-2 w-2 bg-[#07182E] rounded-full animate-bounce"></div>
                  </div>
                ) : monitoringTripsError ? (
                  <div className="text-center text-rose-600 space-y-1">
                    <AlertTriangle className="w-6 h-6 mx-auto animate-pulse" />
                    <p className="text-[10px] font-bold">Failed to load trend</p>
                  </div>
                ) : monitoringTrips.length === 0 ? (
                  <div className="text-center text-slate-400 space-y-1">
                    <Calendar className="w-6 h-6 mx-auto" />
                    <p className="text-[10px] font-bold">No trips recorded in this period</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={utilisationTrendData}>
                      <XAxis dataKey="date" fontSize={11} stroke="#94A3B8" />
                      <YAxis fontSize={11} stroke="#94A3B8" domain={[0, 100]} />
                      <Tooltip />
                      <Area type="monotone" dataKey="periodFleetActivity" stroke="#FF9F1C" fill="#FFFBEB" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

          </div>

          {/* Fleet Status register */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden">
            <div className="p-5 border-b border-[#E2E8F0]">
              <h3 className="font-extrabold text-sm text-[#07182E]">Live Fleet Status Register</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-slate-500 font-bold text-[10px] tracking-wider uppercase">
                    <th className="p-4">Asset No</th>
                    <th className="p-4">License Plate</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Category</th>
                    <th className="p-4 text-center">Current Status</th>
                    <th className="p-4">Assigned Personnel</th>
                    <th className="p-4">Current Location</th>
                    <th className="p-4">Usage Metric</th>
                    <th className="p-4">Service Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9] text-xs font-medium text-slate-700">
                  {assets.filter(a => !a.isArchived).map(a => {
                    const todaySAST = getSASTTodayString();
                    const isServiceOverdue = a.nextService && a.nextService < todaySAST;
                    return (
                      <tr key={a.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-bold text-[#07182E]">{a.assetNumber}</td>
                        <td className="p-4 font-mono font-bold text-slate-600">{a.registration}</td>
                        <td className="p-4 font-semibold">{a.type}</td>
                        <td className="p-4 text-slate-500">{a.category}</td>
                        <td className="p-4 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            a.status === "Available" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                            a.status === "In Use" ? "bg-[#EBF5FF] text-[#1E40AF] border border-[#BFDBFE]" :
                            a.status === "Under Maintenance" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                            "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}>
                            {a.status}
                          </span>
                        </td>
                        <td className="p-4 text-slate-900">{a.driver || "Unassigned"}</td>
                        <td className="p-4 text-slate-600">{a.location}</td>
                        <td className="p-4 text-slate-600">
                          {a.category === "Plant" ? `${a.hoursOrOdo} hrs` : `${a.hoursOrOdo} km`}
                        </td>
                        <td className="p-4">
                          {isServiceOverdue ? (
                            <span className="text-rose-600 font-bold flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Service Overdue
                            </span>
                          ) : (
                            <span className="text-emerald-600 font-semibold">Schedule Active</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TAB CONTENT 3: TRIP TRACKING & FUEL CONSUMPTION */}
      {activeSection === "trips" && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Segmented Period Controls */}
          <div className="bg-white p-5 border border-[#E2E8F0] rounded-2xl shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-extrabold text-sm text-[#07182E]">Trip Log Reporting Boundaries</h3>
                <p className="text-xs text-slate-500">Filter historical journeys, fuel calculations and driving durations.</p>
              </div>

              <div className="flex bg-[#F1F5F9] p-1 rounded-xl w-fit">
                <button
                  onClick={() => setTripPeriod("all")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    tripPeriod === "all" ? "bg-[#07182E] text-white shadow-sm" : "text-slate-500 hover:text-[#07182E]"
                  }`}
                >
                  ALL TRIPS
                </button>
                <button
                  onClick={() => setTripPeriod("daily")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    tripPeriod === "daily" ? "bg-[#07182E] text-white shadow-sm" : "text-slate-500 hover:text-[#07182E]"
                  }`}
                >
                  Daily
                </button>
                <button
                  onClick={() => setTripPeriod("weekly")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    tripPeriod === "weekly" ? "bg-[#07182E] text-white shadow-sm" : "text-slate-500 hover:text-[#07182E]"
                  }`}
                >
                  Weekly
                </button>
                <button
                  onClick={() => setTripPeriod("monthly")}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    tripPeriod === "monthly" ? "bg-[#07182E] text-white shadow-sm" : "text-slate-500 hover:text-[#07182E]"
                  }`}
                >
                  Monthly
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-100">
              {tripPeriod === "all" && (
                <div className="space-y-1.5 py-1.5">
                  <span className="text-xs font-bold text-slate-500">Complete trip history</span>
                </div>
              )}
              {tripPeriod === "daily" && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Selected Day</label>
                  <input
                    type="date"
                    value={tripDailyDate}
                    onChange={(e) => setTripDailyDate(e.target.value)}
                    className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs text-slate-700 focus:outline-none"
                  />
                </div>
              )}
              {tripPeriod === "weekly" && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Selected Week</label>
                  <input
                    type="week"
                    value={tripWeeklyRange}
                    onChange={(e) => setTripWeeklyRange(e.target.value)}
                    className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs text-slate-700 focus:outline-none"
                  />
                </div>
              )}
              {tripPeriod === "monthly" && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Selected Month</label>
                  <input
                    type="month"
                    value={tripMonthlyVal}
                    onChange={(e) => setTripMonthlyVal(e.target.value)}
                    className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs text-slate-700 focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Trips Calculated Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            
            <div className="bg-white p-4 border border-[#E2E8F0] rounded-2xl shadow-xs">
              <div className="text-slate-400 font-bold text-[10px] uppercase">Total Trips</div>
              <div className="text-xl font-extrabold text-[#07182E] mt-1">{tripSummaryStats.totalTrips}</div>
            </div>

            <div className="bg-white p-4 border border-[#E2E8F0] rounded-2xl shadow-xs">
              <div className="text-slate-400 font-bold text-[10px] uppercase">Distance</div>
              <div className="text-xl font-extrabold text-[#07182E] mt-1">{tripSummaryStats.totalKm} km</div>
            </div>

            <div className="bg-white p-4 border border-[#E2E8F0] rounded-2xl shadow-xs">
              <div className="text-slate-400 font-bold text-[10px] uppercase">Fuel Used</div>
              <div className="text-xl font-extrabold text-[#07182E] mt-1">{tripSummaryStats.totalFuelL} L equivalent</div>
            </div>

            <div className="bg-white p-4 border border-[#E2E8F0] rounded-2xl shadow-xs">
              <div className="text-slate-400 font-bold text-[10px] uppercase">Avg Consumption</div>
              <div className="text-xl font-extrabold text-[#FF9F1C] mt-1">
                {tripSummaryStats.averageConsumption !== null ? `${tripSummaryStats.averageConsumption} L equivalent/100 km` : "N/A"}
              </div>
            </div>

            <div className="bg-white p-4 border border-[#E2E8F0] rounded-2xl shadow-xs">
              <div className="text-slate-400 font-bold text-[10px] uppercase">Driving Time</div>
              <div className="text-xl font-extrabold text-[#07182E] mt-1">{tripSummaryStats.totalDrivingTimeHours} hrs</div>
            </div>

            <div className="bg-white p-4 border border-[#E2E8F0] rounded-2xl shadow-xs">
              <div className="text-slate-400 font-bold text-[10px] uppercase">Active Operators</div>
              <div className="text-xl font-extrabold text-emerald-600 mt-1">{tripSummaryStats.activeDrivers}</div>
            </div>

          </div>

          {/* Visual Trip charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            <div className="bg-white p-5 border border-[#E2E8F0] rounded-2xl shadow-xs space-y-4 lg:col-span-2">
              <h4 className="text-xs font-bold text-[#07182E] uppercase">Distance (km) vs Fuel Consumption (L equivalent)</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData}>
                    <XAxis dataKey="registration" fontSize={11} stroke="#94A3B8" />
                    <YAxis fontSize={11} stroke="#94A3B8" />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 10, fontWeight: "bold" }} />
                    <Bar dataKey="km" fill="#FF9F1C" name="Kilometres" />
                    <Bar dataKey="fuel" fill="#07182E" name="Fuel (L equivalent)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-5 border border-[#E2E8F0] rounded-2xl shadow-xs space-y-4">
              <h4 className="text-xs font-bold text-[#07182E] uppercase">Trip Status Ratios</h4>
              <div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Completed", value: filteredAnalyticsTrips.filter(t => t.status === "Completed").length },
                        { name: "In Progress", value: filteredAnalyticsTrips.filter(t => t.status === "In Progress").length },
                        { name: "Delayed", value: filteredAnalyticsTrips.filter(t => t.status === "Delayed").length },
                        { name: "Cancelled", value: filteredAnalyticsTrips.filter(t => t.status === "Cancelled").length }
                      ]}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      <Cell fill="#10B981" />
                      <Cell fill="#2563EB" />
                      <Cell fill="#F59E0B" />
                      <Cell fill="#EF4444" />
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Trips Register Table & Comprehensive Filtering */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xs overflow-hidden">
            
            <div className="p-5 border-b border-[#E2E8F0] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <h3 className="font-extrabold text-sm text-[#07182E]">Detailed Journey Logs</h3>
                  <div className="flex items-center gap-2 bg-slate-50 border border-[#E2E8F0] px-3 py-1 rounded-xl">
                    <input
                      type="checkbox"
                      id="showArchivedTrips"
                      checked={showArchivedTrips}
                      onChange={(e) => setShowArchivedTrips(e.target.checked)}
                      className="rounded border-slate-300 text-[#FF9F1C] focus:ring-[#FF9F1C] h-4 w-4 cursor-pointer"
                    />
                    <label htmlFor="showArchivedTrips" className="text-xs font-bold text-slate-600 select-none cursor-pointer">
                      Show Archived
                    </label>
                  </div>
                </div>
                <span className="text-xs bg-[#FFF5F5] text-rose-600 px-3 py-1 rounded-full font-bold w-fit">
                  Flags active for incomplete, delayed or anomaly logs
                </span>
              </div>

              {/* Filtering matrix */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={tripSearch}
                    onChange={(e) => { setTripSearch(e.target.value); setTripPage(1); }}
                    placeholder="Search query..."
                    className="w-full pl-9 pr-4 py-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-xs focus:outline-none"
                  />
                </div>

                <select
                  value={tripDriverFilter}
                  onChange={(e) => { setTripDriverFilter(e.target.value); setTripPage(1); }}
                  className="bg-white border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs text-slate-600 focus:outline-none"
                >
                  <option value="All">All Drivers</option>
                  {dynamicDrivers.map((d, idx) => <option key={`${d}-${idx}`} value={d}>{d}</option>)}
                </select>

                <select
                  value={tripAssetFilter}
                  onChange={(e) => { setTripAssetFilter(e.target.value); setTripPage(1); }}
                  className="bg-white border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs text-slate-600 focus:outline-none"
                >
                  <option value="All">All Vehicles</option>
                  {assets.map(a => {
                    const regText = a.registration ? a.registration : "No Reg";
                    const label = `${a.assetNumber} ${regText} — ${a.makeModel} (${a.type} · ${a.category})${a.isArchived ? " (Archived)" : ""}`;
                    return (
                      <option key={a.id} value={a.id}>
                        {label}
                      </option>
                    );
                  })}
                </select>

                <select
                  value={tripStatusFilter}
                  onChange={(e) => { setTripStatusFilter(e.target.value); setTripPage(1); }}
                  className="bg-white border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs text-slate-600 focus:outline-none"
                >
                  <option value="All">All Trip Statuses</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Delayed">Delayed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>

              </div>
            </div>

            {/* Trips Desktop Register & Empty State handling */}
            {trips.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center space-y-3 bg-white border-t border-[#E2E8F0]">
                <div className="p-3 bg-slate-50 text-slate-400 rounded-2xl border border-slate-100">
                  <MapPin className="w-8 h-8 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-extrabold text-sm text-[#07182E]">No operational logs found</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Register a driver dispatch or vehicle journey under Section 3 to start tracking routes, distance and fuel consumption.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-slate-500 font-bold text-[10px] tracking-wider uppercase">
                        <th className="p-4">Log Date</th>
                        <th className="p-4">Reg Plate</th>
                        <th className="p-4">Driver / Operator</th>
                        <th className="p-4">Vehicle Detail</th>
                        <th className="p-4">Start Destination</th>
                        <th className="p-4">End Destination</th>
                        <th className="p-4">Start Time</th>
                        <th className="p-4">End Time</th>
                        <th className="p-4 text-right">Distance (km)</th>
                        <th className="p-4 text-right">Fuel Logged</th>
                        <th className="p-4 text-center">Status</th>
                        <th className="p-4 text-center">Flags</th>
                        <th className="p-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F5F9] text-xs font-medium text-slate-700">
                      {paginatedTrips.map(t => {
                        const isMissingEnd = t.status === "In Progress" && (!t.end_destination || !t.ended_at);
                        const isZeroDistance = t.status === "Completed" && t.kilometres_travelled === 0;
                        const isDelayed = t.status === "Delayed";
                        const fuelLVal = parseDefensiveNumber(t.fuel_litres);
                        const km = parseDefensiveNumber(t.kilometres_travelled);
                        const consumption = km > 0 ? (fuelLVal / km) * 100 : null;
                        const isHighFuel = 
                          !t.is_archived && 
                          t.status !== "Cancelled" && 
                          t.ended_at !== null && 
                          km > 0 && 
                          consumption !== null && 
                          consumption > 25;

                        const rawFuelUnit = t.fuel_unit === "gal" ? "US gal" : "L";

                        return (
                          <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-4 text-slate-900 font-semibold">{t.started_at.substring(0, 10)}</td>
                            <td className="p-4 font-mono font-bold text-[#07182E]">{t.registration_snapshot}</td>
                            <td className="p-4 font-semibold text-slate-900">{t.driver_first_name} {t.driver_last_name}</td>
                            <td className="p-4 text-slate-500">{t.vehicle_type_snapshot}</td>
                            <td className="p-4 text-slate-800">{t.start_destination}</td>
                            <td className="p-4 text-slate-800">{t.end_destination || <span className="text-amber-500 italic">Incomplete</span>}</td>
                            <td className="p-4 text-slate-600">{t.started_at.substring(11, 16)}</td>
                            <td className="p-4 text-slate-600">{t.ended_at ? t.ended_at.substring(11, 16) : "—"}</td>
                            <td className="p-4 text-right font-bold text-[#07182E]">{t.kilometres_travelled} km</td>
                            <td className="p-4 text-right font-bold text-[#07182E]">{t.fuel_quantity} {rawFuelUnit}</td>
                            <td className="p-4 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                t.status === "Completed" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                t.status === "In Progress" ? "bg-sky-50 text-sky-700 border border-sky-200" :
                                t.status === "Delayed" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                "bg-rose-50 text-rose-700 border border-rose-200"
                              }`}>
                                {t.status}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex justify-center gap-1">
                                {isMissingEnd && (
                                  <span className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.5 rounded font-bold" title="Trip in progress / Missing destinations">
                                    ACTIVE
                                  </span>
                                )}
                                {isZeroDistance && (
                                  <span className="bg-rose-100 text-rose-800 text-[9px] px-1.5 py-0.5 rounded font-bold" title="Completed trip logged with 0 distance">
                                    NO-KM
                                  </span>
                                )}
                                {isDelayed && (
                                  <span className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0.5 rounded font-bold" title="Delayed status flag active">
                                    DELAYED
                                  </span>
                                )}
                                {isHighFuel && (
                                  <span className="bg-rose-100 text-rose-800 text-[9px] px-1.5 py-0.5 rounded font-bold" title="High fuel consumption detected (>25L/100km)">
                                    HIGH-FUEL
                                  </span>
                                )}
                                {!isMissingEnd && !isZeroDistance && !isDelayed && !isHighFuel && (
                                  <span className="text-emerald-500 font-bold">✓ OK</span>
                                )}
                              </div>
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleOpenEditTrip(t)}
                                  className="p-1 hover:bg-slate-100 rounded-lg text-[#07182E] transition-colors cursor-pointer"
                                  title="Edit Trip"
                                  disabled={mutationLoading}
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                {t.is_archived ? (
                                  <button
                                    onClick={() => handleRestoreTrip(t)}
                                    className="p-1 hover:bg-emerald-50 rounded-lg text-emerald-600 transition-colors cursor-pointer"
                                    title="Restore Trip"
                                    disabled={mutationLoading}
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => setTripPendingArchive(t)}
                                    className="p-1 hover:bg-rose-50 rounded-lg text-rose-600 transition-colors cursor-pointer"
                                    title="Archive Trip"
                                    disabled={mutationLoading}
                                  >
                                    <Archive className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {paginatedTrips.length === 0 && (
                        <tr>
                          <td colSpan={13} className="p-8 text-center text-slate-400">
                            {tripPeriod === "all" ? "No trips have been recorded." : "No trips matching the selected report boundaries."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Trips register cards */}
                <div className="lg:hidden p-4 space-y-4">
                  {paginatedTrips.map(t => {
                    const rawFuelUnit = t.fuel_unit === "gal" ? "US gal" : "L";
                    return (
                      <div key={t.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-xs font-bold text-slate-800">{t.registration_snapshot}</span>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              t.status === "Completed" ? "bg-emerald-50 text-emerald-700" :
                              t.status === "In Progress" ? "bg-sky-50 text-sky-700" :
                              t.status === "Delayed" ? "bg-amber-50 text-amber-700" :
                              "bg-rose-50 text-rose-700"
                            }`}>
                              {t.status}
                            </span>
                            <button
                              onClick={() => handleOpenEditTrip(t)}
                              className="p-1 hover:bg-slate-200 rounded text-slate-700 transition-colors cursor-pointer"
                              title="Edit Trip"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            {t.is_archived ? (
                              <button
                                onClick={() => handleRestoreTrip(t)}
                                className="p-1 hover:bg-emerald-100 rounded text-emerald-600 transition-colors cursor-pointer"
                                title="Restore Trip"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={() => setTripPendingArchive(t)}
                                className="p-1 hover:bg-rose-100 rounded text-rose-600 transition-colors cursor-pointer"
                                title="Archive Trip"
                              >
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="text-xs space-y-1">
                          <div><span className="text-slate-400">Driver:</span> {t.driver_first_name} {t.driver_last_name}</div>
                          <div><span className="text-slate-400">Journey:</span> {t.start_destination} → {t.end_destination || "Incomplete"}</div>
                          <div><span className="text-slate-400">Time:</span> {t.started_at.substring(11, 16)} - {t.ended_at ? t.ended_at.substring(11, 16) : "—"}</div>
                          <div><span className="text-slate-400">Logistics Metric:</span> {t.kilometres_travelled} km | {t.fuel_quantity} {rawFuelUnit}</div>
                        </div>
                      </div>
                    );
                  })}
                  {paginatedTrips.length === 0 && (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      {tripPeriod === "all" ? "No trips have been recorded." : "No trips matching the selected report boundaries."}
                    </div>
                  )}
                </div>

                {/* Trips Pagination */}
                <div className="p-4 border-t border-[#E2E8F0] flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    Page {tripPage} of {totalTripPages}
                  </span>
                  <div className="flex gap-1">
                    <button
                      disabled={tripPage === 1}
                      onClick={() => setTripPage(prev => Math.max(prev - 1, 1))}
                      className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold disabled:opacity-50 cursor-pointer"
                    >
                      Previous
                    </button>
                    <button
                      disabled={tripPage === totalTripPages}
                      onClick={() => setTripPage(prev => Math.min(prev + 1, totalTripPages))}
                      className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold disabled:opacity-50 cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}

          </div>

        </div>
      )}

      {/* --- ADD / EDIT ASSET MODAL --- */}
      {(isAddAssetOpen || isEditAssetOpen) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl border border-[#E2E8F0] max-w-2xl w-full max-h-[90vh] flex flex-col shadow-xl animate-scaleUp overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 p-6 pb-4">
              <h3 className="font-extrabold text-[#07182E] text-base flex items-center gap-2">
                <Truck className="w-5 h-5 text-[#FF9F1C]" />
                {isAddAssetOpen ? "Add New Fleet Asset" : `Edit Asset: ${selectedAsset?.assetNumber}`}
              </h3>
              <button 
                onClick={() => { setIsAddAssetOpen(false); setIsEditAssetOpen(false); }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-colors"
                disabled={mutationLoading}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={isAddAssetOpen ? handleAddAssetSubmit : handleEditAssetSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Asset Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FA-001"
                    value={assetForm.assetNumber}
                    onChange={(e) => setAssetForm({ ...assetForm, assetNumber: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#FF9F1C] font-semibold text-slate-800"
                    disabled={isEditAssetOpen || mutationLoading}
                  />
                  <p className="text-[9px] text-slate-400">Unique identifier for tracking (cannot be changed later).</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Category *</label>
                  <select
                    value={assetForm.category}
                    onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value as any })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#FF9F1C] text-slate-800"
                    disabled={mutationLoading}
                  >
                    <option value="Plant">Plant</option>
                    <option value="Automobiles">Automobiles</option>
                    <option value="Commercial Vehicles">Commercial Vehicles</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Type / Classification *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Excavator, Tipper Truck, SUV"
                    value={assetForm.type}
                    onChange={(e) => setAssetForm({ ...assetForm, type: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#FF9F1C] text-slate-800"
                    disabled={mutationLoading}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Make & Model *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Caterpillar 320D"
                    value={assetForm.makeModel}
                    onChange={(e) => setAssetForm({ ...assetForm, makeModel: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#FF9F1C] text-slate-800"
                    disabled={mutationLoading}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Registration / License Plate *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. CA 123-456"
                    value={assetForm.registration}
                    onChange={(e) => setAssetForm({ ...assetForm, registration: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#FF9F1C] font-mono text-slate-800"
                    disabled={mutationLoading}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">VIN / Chassis Number (Optional)</label>
                  <input
                    type="text"
                    placeholder="17-character VIN"
                    value={assetForm.vinChassisNumber}
                    onChange={(e) => setAssetForm({ ...assetForm, vinChassisNumber: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#FF9F1C] font-mono text-slate-800"
                    disabled={mutationLoading}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Model Year *</label>
                  <input
                    type="number"
                    required
                    min={1900}
                    max={new Date().getFullYear() + 2}
                    value={assetForm.year}
                    onChange={(e) => setAssetForm({ ...assetForm, year: Number(e.target.value) })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#FF9F1C] text-slate-800"
                    disabled={mutationLoading}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Current Status *</label>
                  <select
                    value={assetForm.status}
                    onChange={(e) => setAssetForm({ ...assetForm, status: e.target.value as any })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#FF9F1C] text-slate-800"
                    disabled={mutationLoading}
                  >
                    <option value="Available">Available</option>
                    <option value="In Use">In Use</option>
                    <option value="Under Maintenance">Under Maintenance</option>
                    <option value="Out of Service">Out of Service</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Assigned Driver / Operator</label>
                  <input
                    type="text"
                    placeholder="e.g. Sipho Ndlovu"
                    value={assetForm.driver}
                    onChange={(e) => setAssetForm({ ...assetForm, driver: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#FF9F1C] text-slate-800"
                    disabled={mutationLoading}
                  />
                  <p className="text-[9px] text-slate-400">Manual text input of full name.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Current Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Midrand Yard"
                    value={assetForm.location}
                    onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#FF9F1C] text-slate-800"
                    disabled={mutationLoading}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">
                    {assetForm.category === "Plant" ? "Operating Hours *" : "Odometer (km) *"}
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={assetForm.hoursOrOdo}
                    onChange={(e) => setAssetForm({ ...assetForm, hoursOrOdo: Number(e.target.value) })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#FF9F1C] text-slate-800"
                    disabled={mutationLoading}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Assigned Project (Optional)</label>
                  <select
                    value={assetForm.currentProjectId || ""}
                    onChange={(e) => setAssetForm({ ...assetForm, currentProjectId: e.target.value ? e.target.value : null })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#FF9F1C] text-slate-800"
                    disabled={mutationLoading}
                  >
                    <option value="">-- No Project Assignment --</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Last Service Date (Optional)</label>
                  <input
                    type="date"
                    value={assetForm.lastServiceDate}
                    onChange={(e) => setAssetForm({ ...assetForm, lastServiceDate: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#FF9F1C] text-slate-800"
                    disabled={mutationLoading}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Next Service Schedule (Optional)</label>
                  <input
                    type="date"
                    value={assetForm.nextService}
                    onChange={(e) => setAssetForm({ ...assetForm, nextService: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#FF9F1C] text-slate-800"
                    disabled={mutationLoading}
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Operational Notes / Comments</label>
                  <textarea
                    rows={2}
                    placeholder="Enter any vehicle history, parts replacement notes, or operational status details..."
                    value={assetForm.notes}
                    onChange={(e) => setAssetForm({ ...assetForm, notes: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#FF9F1C] text-slate-800 resize-none"
                    disabled={mutationLoading}
                  />
                </div>

              </div>

              </div>

              <div className="flex justify-end gap-2.5 p-6 pt-4 border-t border-slate-100 bg-white rounded-b-3xl">
                <button
                  type="button"
                  onClick={() => { setIsAddAssetOpen(false); setIsEditAssetOpen(false); }}
                  className="px-4 py-2 border border-[#E2E8F0] rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                  disabled={mutationLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#07182E] text-[#FF9F1C] font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer hover:bg-[#07182E]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  disabled={mutationLoading}
                >
                  {mutationLoading ? (
                    <>
                      <div className="w-3 h-3 border-2 border-[#FF9F1C] border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Asset Details</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD / EDIT TRIP MODAL --- */}
      {(isAddTripOpen || isEditTripOpen) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl border border-[#E2E8F0] max-w-xl w-full max-h-[90vh] flex flex-col shadow-xl animate-scaleUp overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 p-6 pb-4">
              <h3 className="font-extrabold text-[#07182E]">
                {isAddTripOpen ? "Log New Trip" : "Edit Trip Log"}
              </h3>
              <button 
                onClick={() => { setIsAddTripOpen(false); setIsEditTripOpen(false); }} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-colors"
                disabled={mutationLoading}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={isAddTripOpen ? handleAddTripSubmit : handleEditTripSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                
                <div className="space-y-1.5 col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Select Fleet Asset *</label>
                  <select
                    value={tripForm.fleet_asset_id || ""}
                    onChange={(e) => handleAssetSelectForTrip(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#FF9F1C] text-slate-800"
                    disabled={mutationLoading}
                  >
                    <option value="">-- Choose Asset registration --</option>
                    {assets.filter(a => !a.isArchived || a.id === tripForm.fleet_asset_id).map(a => {
                      const regText = a.registration ? a.registration : "No Reg";
                      const label = `${a.assetNumber} ${regText} — ${a.makeModel} (${a.type} · ${a.category})${a.isArchived ? " (Archived)" : ""}`;
                      return (
                        <option key={a.id} value={a.id}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                  {tripErrors.registration && <span className="text-rose-600 text-[10px] font-bold">{tripErrors.registration}</span>}
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Project (Optional)</label>
                  <select
                    value={tripForm.project_id || ""}
                    onChange={(e) => setTripForm({ ...tripForm, project_id: e.target.value ? e.target.value : null })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#FF9F1C] text-slate-800"
                    disabled={mutationLoading}
                  >
                    <option value="">-- No Project Assignment --</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Driver Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="First Name"
                    value={tripForm.driver_first_name}
                    onChange={(e) => setTripForm({ ...tripForm, driver_first_name: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#FF9F1C] text-slate-800"
                    disabled={mutationLoading}
                  />
                  {tripErrors.driver && <span className="text-rose-600 text-[10px] font-bold">{tripErrors.driver}</span>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Driver Surname *</label>
                  <input
                    type="text"
                    required
                    placeholder="Surname"
                    value={tripForm.driver_last_name}
                    onChange={(e) => setTripForm({ ...tripForm, driver_last_name: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#FF9F1C] text-slate-800"
                    disabled={mutationLoading}
                  />
                  {tripErrors.driverLast && <span className="text-rose-600 text-[10px] font-bold">{tripErrors.driverLast}</span>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Start Destination *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Midrand Quarry"
                    value={tripForm.start_destination}
                    onChange={(e) => setTripForm({ ...tripForm, start_destination: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#FF9F1C] text-slate-800"
                    disabled={mutationLoading}
                  />
                  {tripErrors.start && <span className="text-rose-600 text-[10px] font-bold">{tripErrors.start}</span>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">End Destination</label>
                  <input
                    type="text"
                    placeholder="e.g. Pretoria East Site"
                    value={tripForm.end_destination}
                    onChange={(e) => setTripForm({ ...tripForm, end_destination: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#FF9F1C] text-slate-800"
                    disabled={mutationLoading}
                  />
                  {tripErrors.endDest && <span className="text-rose-600 text-[10px] font-bold">{tripErrors.endDest}</span>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Start Date & Time *</label>
                  <input
                    type="datetime-local"
                    required
                    value={tripForm.startedAtLocal}
                    onChange={(e) => setTripForm({ ...tripForm, startedAtLocal: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#FF9F1C] text-slate-800"
                    disabled={mutationLoading}
                  />
                  {tripErrors.startedAtLocal && <span className="text-rose-600 text-[10px] font-bold">{tripErrors.startedAtLocal}</span>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">End Date & Time</label>
                  <input
                    type="datetime-local"
                    value={tripForm.endedAtLocal}
                    onChange={(e) => setTripForm({ ...tripForm, endedAtLocal: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#FF9F1C] text-slate-800 disabled:opacity-50"
                    disabled={mutationLoading || tripForm.status === "In Progress"}
                  />
                  {tripErrors.endedAtLocal && <span className="text-rose-600 text-[10px] font-bold">{tripErrors.endedAtLocal}</span>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Kilometres Travelled</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={tripForm.kilometres_travelled}
                    onChange={(e) => setTripForm({ ...tripForm, kilometres_travelled: Number(e.target.value) })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#FF9F1C] text-slate-800"
                    disabled={mutationLoading}
                  />
                  {tripErrors.km && <span className="text-rose-600 text-[10px] font-bold">{tripErrors.km}</span>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Fuel Used</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={tripForm.fuel_quantity}
                      onChange={(e) => setTripForm({ ...tripForm, fuel_quantity: Number(e.target.value) })}
                      className="flex-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#FF9F1C] text-slate-800"
                      disabled={mutationLoading}
                    />
                    <select
                      value={tripForm.fuel_unit}
                      onChange={(e) => setTripForm({ ...tripForm, fuel_unit: e.target.value as any })}
                      className="bg-white border border-[#E2E8F0] rounded-xl px-2 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#FF9F1C] text-slate-800"
                      disabled={mutationLoading}
                    >
                      <option value="L">L</option>
                      <option value="gal">gal</option>
                    </select>
                  </div>
                  {tripErrors.fuel && <span className="text-rose-600 text-[10px] font-bold">{tripErrors.fuel}</span>}
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Trip Status *</label>
                  <select
                    value={tripForm.status}
                    onChange={(e) => {
                      const newStatus = e.target.value as any;
                      if (newStatus === "In Progress") {
                        setTripForm({ ...tripForm, status: newStatus, endedAtLocal: "" });
                      } else {
                        setTripForm({ ...tripForm, status: newStatus });
                      }
                    }}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#FF9F1C] text-slate-800"
                    disabled={mutationLoading}
                  >
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Delayed">Delayed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Operational Notes / Comments</label>
                  <textarea
                    rows={2}
                    placeholder="Enter any route delays, cargo details, refuel notes or trip incidents..."
                    value={tripForm.notes}
                    onChange={(e) => setTripForm({ ...tripForm, notes: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#FF9F1C] text-slate-800 resize-none"
                    disabled={mutationLoading}
                  />
                </div>

              </div>

              </div>

              <div className="flex justify-end gap-2.5 p-6 pt-4 border-t border-slate-100 bg-white rounded-b-3xl">
                <button
                  type="button"
                  onClick={() => { setIsAddTripOpen(false); setIsEditTripOpen(false); }}
                  className="px-4 py-2 border border-[#E2E8F0] rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                  disabled={mutationLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#07182E] text-[#FF9F1C] font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer hover:bg-[#07182E]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  disabled={mutationLoading}
                >
                  {mutationLoading ? (
                    <>
                      <div className="w-3 h-3 border-2 border-[#FF9F1C] border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{isAddTripOpen ? "Log Trip Entry" : "Save Trip Changes"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ARCHIVE CONFIRMATION MODAL --- */}
      {assetPendingArchive && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
          onClick={() => {
            if (!archiveSubmitting) setAssetPendingArchive(null);
          }}
        >
          <div 
            className="bg-white rounded-3xl border border-[#E2E8F0] max-w-md w-full p-6 shadow-xl space-y-4 animate-scaleUp overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-modal-title"
          >
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-50 rounded-2xl border border-rose-100">
                <Archive className="w-6 h-6" />
              </div>
              <h3 id="archive-modal-title" className="font-extrabold text-[#07182E] text-base">
                Archive fleet asset?
              </h3>
            </div>

            <div className="space-y-2.5">
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to archive asset <strong className="text-slate-900">{assetPendingArchive.assetNumber}</strong> ({assetPendingArchive.makeModel})?
              </p>
              <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
                The asset will be hidden from active fleet records but can be restored using <strong>Show Archived</strong>.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={archiveSubmitting}
                onClick={() => setAssetPendingArchive(null)}
                className="px-4 py-2 border border-[#E2E8F0] rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={archiveSubmitting}
                onClick={handleConfirmArchive}
                className="px-4 py-2 bg-rose-600 text-white font-bold rounded-xl text-xs hover:bg-rose-700 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
              >
                {archiveSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Archiving...
                  </>
                ) : (
                  "Archive Asset"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- TRIP ARCHIVE CONFIRMATION MODAL --- */}
      {tripPendingArchive && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
          onClick={() => {
            if (!tripArchiveSubmitting) setTripPendingArchive(null);
          }}
        >
          <div 
            className="bg-white rounded-3xl border border-[#E2E8F0] max-w-md w-full p-6 shadow-xl space-y-4 animate-scaleUp overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="trip-archive-modal-title"
          >
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-50 rounded-2xl border border-rose-100">
                <Archive className="w-6 h-6" />
              </div>
              <h3 id="trip-archive-modal-title" className="font-extrabold text-[#07182E] text-base">
                Archive trip record?
              </h3>
            </div>

            <div className="space-y-2.5">
              <p className="text-xs text-slate-600 leading-relaxed">
                Are you sure you want to archive the trip log for <strong className="text-slate-900">{tripPendingArchive.registration_snapshot}</strong> driven by <strong className="text-slate-900">{tripPendingArchive.driver_first_name} {tripPendingArchive.driver_last_name}</strong>?
              </p>
              <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
                This record will be hidden from journey logs but can be restored using the <strong>Show Archived Trips</strong> filter.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={tripArchiveSubmitting}
                onClick={() => setTripPendingArchive(null)}
                className="px-4 py-2 border border-[#E2E8F0] rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={tripArchiveSubmitting}
                onClick={handleConfirmTripArchive}
                className="px-4 py-2 bg-rose-600 text-white font-bold rounded-xl text-xs hover:bg-rose-700 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
              >
                {tripArchiveSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Archiving...
                  </>
                ) : (
                  "Archive Trip"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- ASSET DRAWER --- */}
      {isAssetDrawerOpen && selectedAsset && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex justify-end z-50">
          <div className="bg-white max-w-md w-full h-full p-6 shadow-xl space-y-6 overflow-y-auto animate-slideLeft flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold bg-[#EBF5FF] text-[#1E40AF] px-2 py-0.5 rounded-md border border-[#BFDBFE]">
                      {selectedAsset.category}
                    </span>
                    {selectedAsset.isArchived && (
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-300">
                        Archived
                      </span>
                    )}
                  </div>
                  <h3 className="font-extrabold text-[#07182E] text-lg mt-1">{selectedAsset.assetNumber}</h3>
                  <span className="text-[9px] font-mono text-slate-400 block mt-0.5">DB System ID: {selectedAsset.id}</span>
                </div>
                <button 
                  onClick={() => setIsAssetDrawerOpen(false)} 
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-5 text-xs font-medium text-slate-700">
                <div className="space-y-1">
                  <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Make & Model</div>
                  <div className="text-sm font-extrabold text-[#07182E]">{selectedAsset.makeModel}</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Type / Classification</div>
                    <div className="font-semibold text-slate-800">{selectedAsset.type}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Registration</div>
                    <div className="font-mono font-bold text-slate-800 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md inline-block">
                      {selectedAsset.registration || "—"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Model Year</div>
                    <div className="font-semibold text-slate-800">{selectedAsset.year}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Status</div>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedAsset.status === "Available" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                      selectedAsset.status === "In Use" ? "bg-[#EBF5FF] text-[#1E40AF] border border-[#BFDBFE]" :
                      selectedAsset.status === "Under Maintenance" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                      "bg-rose-50 text-rose-700 border border-rose-200"
                    }`}>
                      {selectedAsset.status}
                    </span>
                  </div>
                </div>

                {selectedAsset.vinChassisNumber && (
                  <div className="space-y-1 border-t border-slate-50 pt-3">
                    <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">VIN / Chassis Number</div>
                    <div className="font-mono text-slate-800 font-semibold">{selectedAsset.vinChassisNumber}</div>
                  </div>
                )}

                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <div className="space-y-1">
                    <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Assigned Project</div>
                    <div className="font-semibold text-slate-800">
                      {selectedAsset.currentProjectId 
                        ? projects.find(p => p.id === selectedAsset.currentProjectId)?.name || `Project (ID: ${selectedAsset.currentProjectId.substring(0,8)})`
                        : "No active project assignment"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Assigned Driver / Operator</div>
                    <div className="font-bold text-[#07182E]">{selectedAsset.driver || "Unassigned"}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Last Known Location</div>
                    <div className="font-semibold text-slate-800">{selectedAsset.location || "Not Specified"}</div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <div className="space-y-1">
                    <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Usage metrics</div>
                    <div className="font-semibold text-slate-800">
                      {selectedAsset.category === "Plant" 
                        ? `${selectedAsset.hoursOrOdo.toLocaleString()} operating hours` 
                        : `${selectedAsset.hoursOrOdo.toLocaleString()} kilometres (odometer)`}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Last Serviced</div>
                      <div className="font-semibold text-slate-800">{selectedAsset.lastServiceDate || "None Logged"}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Next Scheduled Service</div>
                      <div className="font-semibold text-rose-700 font-bold">{selectedAsset.nextService || "No Schedule Set"}</div>
                    </div>
                  </div>
                </div>

                {selectedAsset.notes && (
                  <div className="border-t border-slate-100 pt-4 space-y-1">
                    <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Operational Notes</div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-slate-600 font-normal leading-relaxed whitespace-pre-wrap">
                      {selectedAsset.notes}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex gap-2">
              <button
                onClick={() => { setIsAssetDrawerOpen(false); handleOpenEditAsset(selectedAsset); }}
                className="w-full py-2.5 bg-[#07182E] hover:bg-[#07182E]/90 text-[#FF9F1C] font-extrabold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                <Edit className="w-4 h-4" /> Edit Asset Particulars
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
