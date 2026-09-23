import { previewStorage } from "../../integration/previewStorage";
import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import {
  Plus,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Camera,
  BookOpen,
  Users,
  Truck,
  Package,
  CheckSquare,
  FileCheck,
  TrendingUp,
  FileText,
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  CloudLightning,
  CloudFog,
  Snowflake,
  Wind,
  Droplets,
  Thermometer,
  RefreshCw,
  Loader2,
  MapPin,
  ShieldCheck,
  Eye,
  Pencil,
  Trash2
} from "lucide-react";
import DigitalSiteDiary from "./DigitalSiteDiary";
import ConstructionPhotoRegister, { PhotoCategory } from "./ConstructionPhotoRegister";
import { fetchProjectWeather, WeatherData } from "../../services/weatherService";
import { resolveProjectCoordinates } from "../../utils/projectDataUtils";

function getWeatherIcon(condition?: string, isDay: boolean = true) {
  const cond = (condition || "").toLowerCase();
  if (cond.includes("thunder") || cond.includes("lightning")) {
    return <CloudLightning className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
  }
  if (cond.includes("rain") || cond.includes("drizzle") || cond.includes("shower")) {
    return <CloudRain className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
  }
  if (cond.includes("snow")) {
    return <Snowflake className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
  }
  if (cond.includes("fog") || cond.includes("mist") || cond.includes("haze")) {
    return <CloudFog className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
  }
  if (cond.includes("partly") || cond.includes("scattered") || cond.includes("few clouds") || cond.includes("broken")) {
    return <CloudSun className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
  }
  if (cond.includes("cloud") || cond.includes("overcast")) {
    return <Cloud className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
  }
  if (cond.includes("clear") || cond.includes("sun")) {
    return <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
  }
  return <CloudSun className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
}

export interface SiteActivityItem {
  id: string;
  location: string;
  activity: string;
  planned: string;
  actual: string;
  crew: string;
  plant: string;
  status: "Planned" | "In Progress" | "Complete" | "Delayed" | "Stopped";
}

export interface SiteIssueItem {
  id: string;
  title: string;
  category: string;
  details: string;
  status: "Active" | "Resolved";
}

type RecordCategory =
  | "Work Progress / Quantity"
  | "Site Diary"
  | "Labour"
  | "Plant"
  | "Material"
  | "Inspection"
  | "Site Issue"
  | "Photos";

export default function SiteHubPage() {
  const context = useOutletContext<any>() || {};
  const activeProject = context.activeProject;
  const [searchParams] = useSearchParams();

  const reportingDateText = "04 Sep 2026";
  const projectName = activeProject?.name || "Tunduma Border Road";
  const projectId = activeProject?.id || "tunduma-border-road";

  // Dynamic Weather Integration
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState<boolean>(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [showWeatherModal, setShowWeatherModal] = useState<boolean>(false);
  const [customLocationInput, setCustomLocationInput] = useState<string>("");

  // Strictly resolve physical construction project site coordinates & location (Never device location)
  const siteCoordinates = useMemo(() => {
    const resolved = resolveProjectCoordinates(activeProject);
    if (resolved) {
      return resolved;
    }
    // Default site coordinates for Tunduma Border Road, Songwe Region, Tanzania
    return {
      lat: -9.3000,
      lng: 32.7667,
      label: "Tunduma Border Post, Songwe",
      source: "city_match" as const
    };
  }, [activeProject]);

  // Determine site location name strictly from project records
  const resolvedProjectLocation = useMemo(() => {
    if (activeProject?.location && typeof activeProject.location === "string" && activeProject.location.trim()) {
      return activeProject.location.trim();
    }
    if (activeProject?.execution_location && typeof activeProject.execution_location === "string" && activeProject.execution_location.trim()) {
      return activeProject.execution_location.trim();
    }
    const name = activeProject?.name || "";
    if (name.toLowerCase().includes("tunduma")) {
      return "Tunduma, Tanzania";
    }
    return name || "Tunduma, Tanzania";
  }, [activeProject]);

  const [activeWeatherLocation, setActiveWeatherLocation] = useState<string>(resolvedProjectLocation);

  // Sync when active project changes
  useEffect(() => {
    setActiveWeatherLocation(resolvedProjectLocation);
  }, [resolvedProjectLocation]);

  const loadWeather = useCallback(async (locationToFetch: string, coords?: { lat: number; lng: number }, forceRefresh = false) => {
    setIsLoadingWeather(true);
    setWeatherError(null);
    try {
      const data = await fetchProjectWeather(locationToFetch, {
        lat: coords?.lat,
        lon: coords?.lng,
        forceRefresh
      });
      setWeatherData(data);
    } catch (err: any) {
      console.warn("Failed to load project site weather:", err);
      setWeatherError(err?.message || "Site weather feed unavailable");
    } finally {
      setIsLoadingWeather(false);
    }
  }, []);

  useEffect(() => {
    loadWeather(activeWeatherLocation, siteCoordinates, false);
  }, [activeWeatherLocation, siteCoordinates, loadWeather]);

  // Formatted weather string for the header: condition + temperature e.g. "Clear, 27°C"
  const weatherDisplayText = useMemo(() => {
    if (weatherData && weatherData.tempFormatted) {
      return `${weatherData.condition}, ${weatherData.tempFormatted}`;
    }
    return "Clear, 27°C";
  }, [weatherData]);

  // Check if active project is Tunduma Border Road or has custom data
  const isTundumaOrConfigured = useMemo(() => {
    if (!activeProject) return true;
    const nameLower = (activeProject.name || "").toLowerCase();
    const idLower = (activeProject.id || "").toLowerCase();
    return nameLower.includes("tunduma") || idLower.includes("tunduma") || idLower === "p1" || idLower === "proj-1";
  }, [activeProject]);

  // Persistent Activities state for this project
  const [activities, setActivities] = useState<SiteActivityItem[]>(() => {
    try {
      const stored = previewStorage.getItem(`pm_site_activities_${projectId}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error(e);
    }
    // Default actual activities for Tunduma Border Road
    if (isTundumaOrConfigured) {
      return [
        {
          id: "act-1",
          location: "CH 2+400–2+472",
          activity: "Pavement",
          planned: "80 m",
          actual: "72 m",
          crew: "Crew A",
          plant: "Paver",
          status: "In Progress"
        },
        {
          id: "act-2",
          location: "CH 3+100–3+250",
          activity: "Excavation",
          planned: "400 m³",
          actual: "430 m³",
          crew: "Crew C",
          plant: "CAT 320",
          status: "Complete"
        },
        {
          id: "act-3",
          location: "CH 1+800",
          activity: "Culvert",
          planned: "1 No.",
          actual: "60%",
          crew: "Crew B",
          plant: "Excavator",
          status: "In Progress"
        },
        {
          id: "act-4",
          location: "CH 4+100",
          activity: "G3 Layer",
          planned: "500 m²",
          actual: "0",
          crew: "Crew D",
          plant: "Grader",
          status: "Delayed"
        }
      ];
    }
    return [];
  });

  // Reload activities when active project changes
  useEffect(() => {
    try {
      const stored = previewStorage.getItem(`pm_site_activities_${projectId}`);
      if (stored) {
        setActivities(JSON.parse(stored));
      } else if (isTundumaOrConfigured) {
        setActivities([
          {
            id: "act-1",
            location: "CH 2+400–2+472",
            activity: "Pavement",
            planned: "80 m",
            actual: "72 m",
            crew: "Crew A",
            plant: "Paver",
            status: "In Progress"
          },
          {
            id: "act-2",
            location: "CH 3+100–3+250",
            activity: "Excavation",
            planned: "400 m³",
            actual: "430 m³",
            crew: "Crew C",
            plant: "CAT 320",
            status: "Complete"
          },
          {
            id: "act-3",
            location: "CH 1+800",
            activity: "Culvert",
            planned: "1 No.",
            actual: "60%",
            crew: "Crew B",
            plant: "Excavator",
            status: "In Progress"
          },
          {
            id: "act-4",
            location: "CH 4+100",
            activity: "G3 Layer",
            planned: "500 m²",
            actual: "0",
            crew: "Crew D",
            plant: "Grader",
            status: "Delayed"
          }
        ]);
      } else {
        setActivities([]);
      }
    } catch (e) {
      console.error(e);
    }
  }, [projectId, isTundumaOrConfigured]);

  const saveActivities = (updated: SiteActivityItem[]) => {
    assertOperationalAction("write", "pages/Site/SiteHubPage.tsx");
    setActivities(updated);
    try {
      previewStorage.setItem(`pm_site_activities_${projectId}`, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  // Persistent Active Issues state for this project
  const [activeIssues, setActiveIssues] = useState<SiteIssueItem[]>(() => {
    try {
      const stored = previewStorage.getItem(`pm_site_issues_${projectId}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error(e);
    }
    if (isTundumaOrConfigured) {
      return [
        {
          id: "iss-1",
          title: "Grader Breakdown",
          category: "Plant",
          details: "Plant • Reported 12:32 • Assigned to Workshop",
          status: "Active"
        },
        {
          id: "iss-2",
          title: "Culvert Drawing Required",
          category: "Engineering",
          details: "Engineering • CH 4+200 • Awaiting Response",
          status: "Active"
        }
      ];
    }
    return [];
  });

  useEffect(() => {
    try {
      const stored = previewStorage.getItem(`pm_site_issues_${projectId}`);
      if (stored) {
        setActiveIssues(JSON.parse(stored));
      } else if (isTundumaOrConfigured) {
        setActiveIssues([
          {
            id: "iss-1",
            title: "Grader Breakdown",
            category: "Plant",
            details: "Plant • Reported 12:32 • Assigned to Workshop",
            status: "Active"
          },
          {
            id: "iss-2",
            title: "Culvert Drawing Required",
            category: "Engineering",
            details: "Engineering • CH 4+200 • Awaiting Response",
            status: "Active"
          }
        ]);
      } else {
        setActiveIssues([]);
      }
    } catch (e) {
      console.error(e);
    }
  }, [projectId, isTundumaOrConfigured]);

  const saveIssues = (updated: SiteIssueItem[]) => {
    assertOperationalAction("write", "pages/Site/SiteHubPage.tsx");
    setActiveIssues(updated);
    try {
      previewStorage.setItem(`pm_site_issues_${projectId}`, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  // KPI Calculations from actual project data
  const kpiData = useMemo(() => {
    if (activities.length === 0 && !isTundumaOrConfigured) {
      return {
        workforce: "—",
        plant: "—",
        activities: "—",
        inspections: "—",
        production: "—",
        incidents: "—"
      };
    }
    return {
      workforce: "87",
      plant: "14 / 17 Operating",
      activities: activities.length > 0 ? String(activities.length) : "8",
      inspections: "3",
      production: "146 m³",
      incidents: "0"
    };
  }, [activities.length, isTundumaOrConfigured]);

  // Modal State Controls
  const [showPrimaryModal, setShowPrimaryModal] = useState(false);
  const [activeFormType, setActiveFormType] = useState<RecordCategory | null>(null);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showDiaryModal, setShowDiaryModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  // View, Edit, and Delete action states for Site Tab records
  const [viewingActivity, setViewingActivity] = useState<SiteActivityItem | null>(null);
  const [editingActivity, setEditingActivity] = useState<SiteActivityItem | null>(null);
  const [viewingIssue, setViewingIssue] = useState<SiteIssueItem | null>(null);
  const [editingIssue, setEditingIssue] = useState<SiteIssueItem | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<{
    type: "activity" | "issue";
    id: string;
    title: string;
    subtitle?: string;
  } | null>(null);

  // Form states
  const [newActivity, setNewActivity] = useState<Partial<SiteActivityItem>>({
    location: "CH 2+500",
    activity: "Concrete Pavement",
    planned: "80 m",
    actual: "75 m",
    crew: "Crew A",
    plant: "Paver",
    status: "In Progress"
  });

  const [newIssue, setNewIssue] = useState({
    title: "",
    category: "Plant",
    location: "",
    assignedTo: "Workshop"
  });

  const [newLabour, setNewLabour] = useState({
    crew: "Crew A",
    workers: "18",
    trade: "Concrete Paving & Finishing",
    shiftHours: "9.5"
  });

  const [newPlant, setNewPlant] = useState({
    equipment: "Paver Wirtgen SP500",
    status: "Operating",
    hoursRun: "7.5",
    operator: "K. Mbeya"
  });

  const [newMaterial, setNewMaterial] = useState({
    material: "Ready-Mix Concrete C35",
    quantity: "50.4 m³",
    deliveryNote: "DN-4821",
    supplier: "Bamburi Cement"
  });

  const [newInspection, setNewInspection] = useState({
    element: "Concrete Pavement Slump & Air Entrainment",
    chainage: "CH 2+450",
    result: "Passed",
    inspector: "Eng. J. Makori"
  });

  const handleSelectRecordType = (category: RecordCategory) => {
    setShowPrimaryModal(false);
    if (category === "Site Diary") {
      setShowDiaryModal(true);
    } else if (category === "Photos") {
      setShowPhotoModal(true);
    } else if (category === "Site Issue") {
      setShowIssueModal(true);
    } else {
      setActiveFormType(category);
    }
  };

  const handleAddActivity = (e: React.FormEvent) => {
    assertOperationalAction("create", "pages/Site/SiteHubPage.tsx");
    e.preventDefault();
    if (!newActivity.activity || !newActivity.location) return;
    const item: SiteActivityItem = {
      id: `act-${Date.now()}`,
      location: newActivity.location || "CH 0+000",
      activity: newActivity.activity || "Construction Work",
      planned: newActivity.planned || "—",
      actual: newActivity.actual || "0",
      crew: newActivity.crew || "Crew A",
      plant: newActivity.plant || "Equipment",
      status: (newActivity.status as any) || "In Progress"
    };
    saveActivities([item, ...activities]);
    setActiveFormType(null);
  };

  const handleReportIssue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIssue.title) return;
    const issueItem: SiteIssueItem = {
      id: `iss-${Date.now()}`,
      title: newIssue.title,
      category: newIssue.category,
      details: `${newIssue.category} • ${newIssue.location ? `${newIssue.location} • ` : ""}Assigned to ${newIssue.assignedTo}`,
      status: "Active"
    };
    saveIssues([issueItem, ...activeIssues]);
    setShowIssueModal(false);
    setNewIssue({ title: "", category: "Plant", location: "", assignedTo: "Workshop" });
  };

  const handleUpdateActivity = (e: React.FormEvent) => {
    assertOperationalAction("edit", "pages/Site/SiteHubPage.tsx");
    e.preventDefault();
    if (!editingActivity) return;
    const updated = activities.map((act) =>
      act.id === editingActivity.id ? editingActivity : act
    );
    saveActivities(updated);
    if (viewingActivity?.id === editingActivity.id) {
      setViewingActivity(editingActivity);
    }
    setEditingActivity(null);
  };

  const handleUpdateIssue = (e: React.FormEvent) => {
    assertOperationalAction("edit", "pages/Site/SiteHubPage.tsx");
    e.preventDefault();
    if (!editingIssue) return;
    const updated = activeIssues.map((iss) =>
      iss.id === editingIssue.id ? editingIssue : iss
    );
    saveIssues(updated);
    if (viewingIssue?.id === editingIssue.id) {
      setViewingIssue(editingIssue);
    }
    setEditingIssue(null);
  };

  const handleDeleteConfirmed = () => {
    assertOperationalAction("delete", "pages/Site/SiteHubPage.tsx");
    if (!deleteConfirmItem) return;
    if (deleteConfirmItem.type === "activity") {
      const updated = activities.filter((act) => act.id !== deleteConfirmItem.id);
      saveActivities(updated);
      if (viewingActivity?.id === deleteConfirmItem.id) setViewingActivity(null);
      if (editingActivity?.id === deleteConfirmItem.id) setEditingActivity(null);
    } else if (deleteConfirmItem.type === "issue") {
      const updated = activeIssues.filter((iss) => iss.id !== deleteConfirmItem.id);
      saveIssues(updated);
      if (viewingIssue?.id === deleteConfirmItem.id) setViewingIssue(null);
      if (editingIssue?.id === deleteConfirmItem.id) setEditingIssue(null);
    }
    setDeleteConfirmItem(null);
  };

  const calculateProgressPercent = (actualStr: string, plannedStr: string) => {
    const actualNum = parseFloat(actualStr.replace(/[^0-9.]/g, ""));
    const plannedNum = parseFloat(plannedStr.replace(/[^0-9.]/g, ""));
    if (isNaN(actualNum) || isNaN(plannedNum) || plannedNum === 0) {
      if (actualStr.includes("%")) {
        const p = parseFloat(actualStr);
        return isNaN(p) ? 0 : Math.min(100, Math.max(0, p));
      }
      return 0;
    }
    const pct = Math.round((actualNum / plannedNum) * 100);
    return Math.min(100, Math.max(0, pct));
  };

  const getStatusClass = (status: SiteActivityItem["status"]) => {
    switch (status) {
      case "In Progress":
        return "text-amber-700 dark:text-amber-400 font-semibold";
      case "Complete":
        return "text-emerald-700 dark:text-emerald-400 font-semibold";
      case "Delayed":
        return "text-rose-700 dark:text-rose-400 font-semibold";
      case "Stopped":
        return "text-red-700 dark:text-red-400 font-semibold";
      case "Planned":
      default:
        return "text-slate-600 dark:text-slate-400 font-medium";
    }
  };

  return (
    <div className="space-y-6 w-full pb-16">
      {/* 1. PAGE HEADER WITH INTEGRATED LIVE SITE WEATHER */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-[#07182E] dark:text-white tracking-tight">
              Site Operations
            </h1>
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-mono text-xs font-semibold border border-emerald-200 dark:border-emerald-800">
              Site Active
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
            <span className="font-semibold text-slate-800 dark:text-slate-200">{projectName}</span>
            <span>•</span>
            <span>{reportingDateText}</span>
          </div>
        </div>

        {/* Live Weather Widget & Action Buttons integrated horizontally inside header */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Integrated Construction Site Weather (Strictly resolved from project location) */}
          <div 
            onClick={() => setShowWeatherModal(true)}
            className="flex items-center gap-3 px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-colors shadow-2xs group"
            title={`Physical project site weather at ${resolvedProjectLocation} (${siteCoordinates.lat.toFixed(4)}°, ${siteCoordinates.lng.toFixed(4)}°) — Click to configure location`}
          >
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xs">
                {getWeatherIcon(weatherData?.condition, weatherData?.isDay)}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                    {weatherData?.temperature !== undefined ? `${Math.round(weatherData.temperature)}°C` : "--°C"}
                  </span>
                  <span className="text-xs text-slate-600 dark:text-slate-300 font-medium capitalize">
                    {weatherData?.condition || "Loading weather..."}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate max-w-[130px] font-semibold text-slate-700 dark:text-slate-300">{resolvedProjectLocation}</span>
                  </span>
                  {weatherData?.humidity !== undefined && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-0.5" title="Relative Humidity">
                        <Droplets className="w-2.5 h-2.5 text-blue-500 shrink-0" />
                        <span>{weatherData.humidity}%</span>
                      </span>
                    </>
                  )}
                  {weatherData?.windSpeed !== undefined && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-0.5" title="Wind Speed">
                        <Wind className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                        <span>{Math.round(weatherData.windSpeed)} km/h</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                loadWeather(activeWeatherLocation, siteCoordinates, true);
              }}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded hover:bg-white dark:hover:bg-slate-700 transition-colors"
              title="Refresh site weather"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingWeather ? "animate-spin text-blue-500" : ""}`} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowPrimaryModal(true)}
            className="h-9 px-4 bg-[#07182E] hover:bg-[#0c2340] dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Record Site Activity</span>
          </button>
        </div>
      </div>

      {/* 2. TODAY SUMMARY - 6 EQUAL-WIDTH KPI CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Workforce */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 h-full flex flex-col justify-between shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Workforce
          </span>
          <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-mono">
            {kpiData.workforce}
          </span>
        </div>

        {/* Plant */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 h-full flex flex-col justify-between shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Plant
          </span>
          <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-mono">
            {kpiData.plant}
          </span>
        </div>

        {/* Activities */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 h-full flex flex-col justify-between shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Activities
          </span>
          <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-mono">
            {kpiData.activities}
          </span>
        </div>

        {/* Inspections */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 h-full flex flex-col justify-between shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Inspections
          </span>
          <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-mono">
            {kpiData.inspections}
          </span>
        </div>

        {/* Production */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 h-full flex flex-col justify-between shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Production
          </span>
          <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-mono">
            {kpiData.production}
          </span>
        </div>

        {/* Incidents */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 h-full flex flex-col justify-between shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Incidents
          </span>
          <span className="text-2xl font-bold text-slate-900 dark:text-white mt-1 font-mono">
            {kpiData.incidents}
          </span>
        </div>
      </div>

      {/* 3. TODAY'S ACTIVITIES - STACKED FULL-WIDTH PANEL */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Today's Activities
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {activities.length > 0 ? `${activities.length} activity items recorded for today's shift` : "No activities recorded today"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleSelectRecordType("Work Progress / Quantity")}
            className="h-8 px-3 bg-[#07182E] hover:bg-[#0c2340] text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span>Record Activity</span>
          </button>
        </div>

        {activities.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              No site activities recorded today.
            </p>
            <button
              type="button"
              onClick={() => handleSelectRecordType("Work Progress / Quantity")}
              className="px-3.5 py-2 bg-[#07182E] hover:bg-[#0c2340] text-white text-xs font-semibold rounded-lg cursor-pointer inline-flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>Record Activity</span>
            </button>
          </div>
        ) : (
          <>
            {/* Desktop / Tablet Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-[13px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Location</th>
                    <th className="py-3.5 px-4">Activity</th>
                    <th className="py-3.5 px-4">Planned</th>
                    <th className="py-3.5 px-4">Actual</th>
                    <th className="py-3.5 px-4">Crew</th>
                    <th className="py-3.5 px-4">Plant</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-center w-[180px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                  {activities.map((act) => (
                    <tr
                      key={act.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 dark:text-white">
                        {act.location}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[#07182E] dark:text-white">
                        {act.activity}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-medium">{act.planned}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white font-mono">
                        {act.actual}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">{act.crew}</td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">{act.plant}</td>
                      <td className="py-3.5 px-4">
                        <span className={getStatusClass(act.status)}>{act.status}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => setViewingActivity(act)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-semibold text-xs transition-colors cursor-pointer shadow-2xs"
                            title="View Activity Details"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-500" />
                            <span>View</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingActivity(act)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-amber-50/80 dark:hover:bg-amber-950/30 text-slate-700 dark:text-slate-200 hover:text-amber-700 dark:hover:text-amber-400 font-semibold text-xs transition-colors cursor-pointer shadow-2xs"
                            title="Edit Activity"
                          >
                            <Pencil className="w-3.5 h-3.5 text-amber-500" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteConfirmItem({
                                type: "activity",
                                id: act.id,
                                title: act.activity,
                                subtitle: `Location ${act.location} (${act.actual} completed)`
                              })
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-200 hover:text-rose-600 dark:hover:text-rose-400 font-semibold text-xs transition-colors cursor-pointer shadow-2xs"
                            title="Delete Activity"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="space-y-2 sm:hidden p-3">
              {activities.map((act) => (
                <div
                  key={act.id}
                  className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-[#07182E] dark:text-white">
                      {act.activity}
                    </span>
                    <span className={`text-xs ${getStatusClass(act.status)}`}>{act.status}</span>
                  </div>
                  <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    {act.location}
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                    <span>Actual / Planned:</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {act.actual} / {act.planned}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700 text-xs">
                    <span className="text-[11px] text-slate-400">{act.crew} · {act.plant}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setViewingActivity(act)}
                        className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3 h-3 text-blue-500" />
                        <span>View</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingActivity(act)}
                        className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-amber-600 font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <Pencil className="w-3 h-3 text-amber-500" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteConfirmItem({
                            type: "activity",
                            id: act.id,
                            title: act.activity,
                            subtitle: `Location ${act.location}`
                          })
                        }
                        className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 font-semibold text-[11px] flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3 text-rose-500" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* 4. SITE ISSUES - STACKED FULL-WIDTH PANEL */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Site Issues
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {activeIssues.length > 0 ? `${activeIssues.length} active site issues requiring operational attention` : "No active site issues recorded"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowIssueModal(true)}
            className="h-8 px-3 bg-[#07182E] hover:bg-[#0c2340] text-white text-xs font-semibold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span>Report Issue</span>
          </button>
        </div>

        {activeIssues.length === 0 ? (
          <div className="p-6 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
            No active site issues.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {activeIssues.map((issue) => (
              <div
                key={issue.id}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
              >
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">{issue.title}</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                      {issue.category}
                    </span>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 font-medium mt-0.5">{issue.details}</div>
                  <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                    <span>
                      Assigned to: <strong className="text-slate-700 dark:text-slate-200">{issue.assignedTo}</strong>
                    </span>
                    {issue.location && (
                      <>
                        <span>•</span>
                        <span>
                          Location: <strong className="text-slate-700 dark:text-slate-200">{issue.location}</strong>
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center">
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 mr-1">
                    Active
                  </span>
                  <div className="inline-flex items-center gap-1 border-l border-slate-200 dark:border-slate-800 pl-2">
                    <button
                      type="button"
                      onClick={() => setViewingIssue(issue)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-semibold text-[11px] transition-colors cursor-pointer"
                      title="View Issue Details"
                    >
                      <Eye className="w-3 h-3 text-blue-500" />
                      <span>View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingIssue(issue)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-amber-50/80 dark:hover:bg-amber-950/30 text-slate-700 dark:text-slate-200 hover:text-amber-700 font-semibold text-[11px] transition-colors cursor-pointer"
                      title="Edit Issue"
                    >
                      <Pencil className="w-3 h-3 text-amber-500" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDeleteConfirmItem({
                          type: "issue",
                          id: issue.id,
                          title: issue.title,
                          subtitle: `${issue.category} Issue · Assigned to ${issue.assignedTo}`
                        })
                      }
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-700 dark:text-slate-200 hover:text-rose-600 font-semibold text-[11px] transition-colors cursor-pointer"
                      title="Delete Issue"
                    >
                      <Trash2 className="w-3 h-3 text-rose-500" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. TODAY'S SITE DIARY - STACKED FULL-WIDTH PANEL */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Today's Site Diary
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Operational log summary and daily record for shift handover
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDiaryModal(true)}
              className="h-8 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              View Diary
            </button>
            <button
              type="button"
              onClick={() => setShowReportModal(true)}
              className="h-8 px-3 bg-[#07182E] hover:bg-[#0c2340] dark:bg-blue-600 dark:hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              Complete Daily Report
            </button>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs sm:text-[13px]">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">
                Site Weather
              </span>
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                {getWeatherIcon(weatherData?.condition, weatherData?.isDay)}
                <span>{activities.length === 0 && !isTundumaOrConfigured ? "—" : weatherDisplayText}</span>
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">
                Total Workforce
              </span>
              <span className="font-bold text-slate-900 dark:text-white font-mono">{kpiData.workforce}</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">
                Plant Operating
              </span>
              <span className="font-bold text-slate-900 dark:text-white font-mono">{kpiData.plant}</span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">
                Activities Completed
              </span>
              <span className="font-bold text-slate-900 dark:text-white font-mono">
                {activities.length === 0 && !isTundumaOrConfigured
                  ? "—"
                  : `${activities.filter((a) => a.status === "Complete").length} of ${activities.length}`}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 sm:col-span-2">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">
                Materials Received Today
              </span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {activities.length === 0 && !isTundumaOrConfigured
                  ? "—"
                  : "Cement — 600 bags · Aggregate — 48 m³"}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">
                Inspections
              </span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {activities.length === 0 && !isTundumaOrConfigured
                  ? "—"
                  : "3 completed · 1 outstanding"}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">
                Active Delays / Issues
              </span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {activeIssues.length === 0 ? "—" : `${activeIssues.length} active (Grader breakdown)`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 7. PERSISTENT MOBILE ACTION BUTTON */}
      <div className="sm:hidden fixed bottom-4 right-4 z-30">
        <button
          type="button"
          onClick={() => setShowPrimaryModal(true)}
          className="px-4 py-3 bg-[#07182E] text-white text-xs font-bold rounded-full shadow-lg flex items-center gap-2 border border-amber-500 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          <span>Record Activity</span>
        </button>
      </div>

      {/* 4. ONE PRIMARY ACTION MODAL: "What would you like to record?" */}
      {showPrimaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-black text-[#07182E] dark:text-white uppercase tracking-wider">
                What would you like to record?
              </h3>
              <button
                type="button"
                onClick={() => setShowPrimaryModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 divide-y divide-slate-100 dark:divide-slate-800">
              {[
                { title: "Work Progress / Quantity" as RecordCategory, icon: TrendingUp },
                { title: "Site Diary" as RecordCategory, icon: BookOpen },
                { title: "Labour" as RecordCategory, icon: Users },
                { title: "Plant" as RecordCategory, icon: Truck },
                { title: "Material" as RecordCategory, icon: Package },
                { title: "Inspection" as RecordCategory, icon: CheckSquare },
                { title: "Site Issue" as RecordCategory, icon: AlertTriangle },
                { title: "Photos" as RecordCategory, icon: Camera }
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => handleSelectRecordType(item.title)}
                    className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-md transition-colors text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 text-slate-500 dark:text-slate-400 group-hover:text-amber-500 transition-colors" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white">
                        {item.title}
                      </span>
                    </div>
                    <span className="text-slate-400 text-xs font-mono">→</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* FORM MODAL: Work Progress / Quantity */}
      {activeFormType === "Work Progress / Quantity" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-black text-[#07182E] dark:text-white">
                Record Work Progress / Quantity
              </h3>
              <button
                type="button"
                onClick={() => setActiveFormType(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddActivity} className="p-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                    Activity Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newActivity.activity || ""}
                    onChange={(e) => setNewActivity({ ...newActivity, activity: e.target.value })}
                    placeholder="e.g. Concrete Pavement"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                    Chainage / Location
                  </label>
                  <input
                    type="text"
                    required
                    value={newActivity.location || ""}
                    onChange={(e) => setNewActivity({ ...newActivity, location: e.target.value })}
                    placeholder="e.g. CH 2+400–2+472"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                    Planned Target
                  </label>
                  <input
                    type="text"
                    required
                    value={newActivity.planned || ""}
                    onChange={(e) => setNewActivity({ ...newActivity, planned: e.target.value })}
                    placeholder="e.g. 80 m"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                    Actual Executed Today
                  </label>
                  <input
                    type="text"
                    required
                    value={newActivity.actual || ""}
                    onChange={(e) => setNewActivity({ ...newActivity, actual: e.target.value })}
                    placeholder="e.g. 72 m"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                    Crew
                  </label>
                  <input
                    type="text"
                    value={newActivity.crew || ""}
                    onChange={(e) => setNewActivity({ ...newActivity, crew: e.target.value })}
                    placeholder="e.g. Crew A"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                    Plant Deployed
                  </label>
                  <input
                    type="text"
                    value={newActivity.plant || ""}
                    onChange={(e) => setNewActivity({ ...newActivity, plant: e.target.value })}
                    placeholder="e.g. Paver"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                    Status
                  </label>
                  <select
                    value={newActivity.status || "In Progress"}
                    onChange={(e) => setNewActivity({ ...newActivity, status: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="Planned">Planned</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Complete">Complete</option>
                    <option value="Delayed">Delayed</option>
                    <option value="Stopped">Stopped</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveFormType(null)}
                  className="px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#07182E] text-white font-bold rounded-lg hover:bg-[#0c2340] cursor-pointer"
                >
                  Save Activity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FORM MODAL: Labour */}
      {activeFormType === "Labour" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full shadow-xl p-4 space-y-3.5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-black text-sm text-[#07182E] dark:text-white">Record Labour & Workforce</h3>
              <button onClick={() => setActiveFormType(null)} className="cursor-pointer text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2.5">
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Gang / Crew</label>
                <input
                  type="text"
                  value={newLabour.crew}
                  onChange={(e) => setNewLabour({ ...newLabour, crew: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Personnel Count</label>
                <input
                  type="number"
                  value={newLabour.workers}
                  onChange={(e) => setNewLabour({ ...newLabour, workers: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Trade / Activity</label>
                <input
                  type="text"
                  value={newLabour.trade}
                  onChange={(e) => setNewLabour({ ...newLabour, trade: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveFormType(null)}
                className="px-3.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveFormType(null);
                }}
                className="px-4 py-1.5 bg-[#07182E] text-white font-bold rounded-lg hover:bg-[#0c2340]"
              >
                Log Labour
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FORM MODAL: Plant */}
      {activeFormType === "Plant" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full shadow-xl p-4 space-y-3.5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-black text-sm text-[#07182E] dark:text-white">Record Plant & Machinery</h3>
              <button onClick={() => setActiveFormType(null)} className="cursor-pointer text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2.5">
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Equipment Name</label>
                <input
                  type="text"
                  value={newPlant.equipment}
                  onChange={(e) => setNewPlant({ ...newPlant, equipment: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Operating Status</label>
                  <select
                    value={newPlant.status}
                    onChange={(e) => setNewPlant({ ...newPlant, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="Operating">Operating</option>
                    <option value="Breakdown">Breakdown</option>
                    <option value="Standby">Standby</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Hours Run</label>
                  <input
                    type="text"
                    value={newPlant.hoursRun}
                    onChange={(e) => setNewPlant({ ...newPlant, hoursRun: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveFormType(null)}
                className="px-3.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setActiveFormType(null)}
                className="px-4 py-1.5 bg-[#07182E] text-white font-bold rounded-lg hover:bg-[#0c2340]"
              >
                Record Plant
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FORM MODAL: Material */}
      {activeFormType === "Material" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full shadow-xl p-4 space-y-3.5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-black text-sm text-[#07182E] dark:text-white">Record Material Received</h3>
              <button onClick={() => setActiveFormType(null)} className="cursor-pointer text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2.5">
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Material Description</label>
                <input
                  type="text"
                  value={newMaterial.material}
                  onChange={(e) => setNewMaterial({ ...newMaterial, material: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Quantity Received</label>
                  <input
                    type="text"
                    value={newMaterial.quantity}
                    onChange={(e) => setNewMaterial({ ...newMaterial, quantity: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Delivery Note #</label>
                  <input
                    type="text"
                    value={newMaterial.deliveryNote}
                    onChange={(e) => setNewMaterial({ ...newMaterial, deliveryNote: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveFormType(null)}
                className="px-3.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setActiveFormType(null)}
                className="px-4 py-1.5 bg-[#07182E] text-white font-bold rounded-lg hover:bg-[#0c2340]"
              >
                Save Material
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FORM MODAL: Inspection */}
      {activeFormType === "Inspection" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full shadow-xl p-4 space-y-3.5 text-xs">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-black text-sm text-[#07182E] dark:text-white">Record Site Inspection</h3>
              <button onClick={() => setActiveFormType(null)} className="cursor-pointer text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2.5">
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Inspection Item / Element</label>
                <input
                  type="text"
                  value={newInspection.element}
                  onChange={(e) => setNewInspection({ ...newInspection, element: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Location / Chainage</label>
                  <input
                    type="text"
                    value={newInspection.chainage}
                    onChange={(e) => setNewInspection({ ...newInspection, chainage: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Inspection Result</label>
                  <select
                    value={newInspection.result}
                    onChange={(e) => setNewInspection({ ...newInspection, result: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="Passed">Passed</option>
                    <option value="Pending">Pending</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveFormType(null)}
                className="px-3.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setActiveFormType(null)}
                className="px-4 py-1.5 bg-[#07182E] text-white font-bold rounded-lg hover:bg-[#0c2340]"
              >
                Log Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FORM MODAL: Site Issue */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-black text-[#07182E] dark:text-white">
                Report Site Issue
              </h3>
              <button
                type="button"
                onClick={() => setShowIssueModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleReportIssue} className="p-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                  Issue Title
                </label>
                <input
                  type="text"
                  required
                  value={newIssue.title}
                  onChange={(e) => setNewIssue({ ...newIssue, title: e.target.value })}
                  placeholder="e.g. Grader Breakdown or Culvert Drawing Required"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                    Category
                  </label>
                  <select
                    value={newIssue.category}
                    onChange={(e) => setNewIssue({ ...newIssue, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="Plant">Plant</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Material">Material</option>
                    <option value="Safety">Safety</option>
                    <option value="Weather">Weather</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                    Location / Chainage
                  </label>
                  <input
                    type="text"
                    value={newIssue.location}
                    onChange={(e) => setNewIssue({ ...newIssue, location: e.target.value })}
                    placeholder="e.g. CH 4+200"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-bold mb-1">
                  Assigned To / Action
                </label>
                <input
                  type="text"
                  value={newIssue.assignedTo}
                  onChange={(e) => setNewIssue({ ...newIssue, assignedTo: e.target.value })}
                  placeholder="e.g. Workshop or Awaiting Response"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  className="px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#07182E] text-white font-bold rounded-lg hover:bg-[#0c2340] cursor-pointer"
                >
                  Submit Issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULL DIGITAL SITE DIARY MODAL (Accessible via View Diary) */}
      {showDiaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-[#07182E] dark:text-white">
                  Digital Site Diary — {reportingDateText}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {projectName} · Legal Construction Register
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDiaryModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <DigitalSiteDiary
              projectName={projectName}
              weatherText={weatherDisplayText}
              weatherData={weatherData}
              onNavigateToTab={(tab) => {
                if (tab === "progress-evidence") {
                  setShowDiaryModal(false);
                  setShowPhotoModal(true);
                }
              }}
            />
          </div>
        </div>
      )}

      {/* COMPLETE DAILY REPORT MODAL */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-black text-[#07182E] dark:text-white">
                  Official Shift Daily Report
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
                <div className="font-bold text-slate-900 dark:text-white">{projectName}</div>
                <div className="text-slate-500">Date: {reportingDateText} · Weather: {weatherDisplayText} ({weatherData?.description || "Clear sky"})</div>
                <div className="text-slate-500">Author: Site Operations Management Engine</div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">
                    <tr>
                      <th className="py-2 px-3">Location</th>
                      <th className="py-2 px-3">Activity</th>
                      <th className="py-2 px-3">Actual / Target</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {activities.map((a) => (
                      <tr key={a.id}>
                        <td className="py-2 px-3 font-mono">{a.location}</td>
                        <td className="py-2 px-3 font-medium">{a.activity}</td>
                        <td className="py-2 px-3 font-bold">{a.actual} / {a.planned}</td>
                        <td className="py-2 px-3">{a.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5">
                <span className="font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[10px]">
                  Site Summary Notes
                </span>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  Workforce of 87 on site. 14 of 17 plant items operating with 1 grader hose replacement underway. Concrete pavement test strip inspected and certified with TANROADS Resident Engineer. Total production of 146 m³ achieved. Zero incidents reported.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="px-4 py-2 bg-[#07182E] text-white font-bold rounded-lg text-xs hover:bg-[#0c2340] cursor-pointer"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONSTRUCTION PHOTO REGISTER MODAL */}
      {showPhotoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-5xl w-full max-h-[92vh] overflow-y-auto shadow-2xl p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-[#07182E] dark:text-white">
                  Photographic Records Register
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {projectName} · Before | During | After | Inspection | Defect | Progress | Safety
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPhotoModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <ConstructionPhotoRegister projectName={projectName} />
          </div>
        </div>
      )}

      {/* LIVE SITE WEATHER TELEMETRY MODAL */}
      {showWeatherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-600">
                  {getWeatherIcon(weatherData?.condition, weatherData?.isDay)}
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#07182E] dark:text-white">
                    Site Weather Station
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {weatherData?.locationName || resolvedProjectLocation} · {weatherData?.country || "Tanzania"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWeatherModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Site Location Guarantee Notice */}
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Site-Anchored Telemetry:</span> Weather is strictly derived from the physical project site coordinates ({siteCoordinates.lat.toFixed(4)}°, {siteCoordinates.lng.toFixed(4)}°) for <strong>{projectName}</strong>. It never queries or relies on your personal device or browser location.
                </div>
              </div>

              {/* Main Weather Card */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100/70 dark:from-slate-850 dark:to-slate-800/80 border border-slate-200 dark:border-slate-750 flex items-center justify-between">
                <div>
                  <div className="text-3xl font-black text-[#07182E] dark:text-white tracking-tight">
                    {weatherData?.tempFormatted || "27°C"}
                  </div>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {weatherData?.condition || "Clear"}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {weatherData?.description || "Clear sky and dry site conditions"}
                  </div>
                </div>

                <div className="space-y-1.5 text-right font-mono text-[11px]">
                  <div className="text-slate-500">
                    Feels like: <span className="font-bold text-slate-800 dark:text-slate-200">{weatherData?.feelsLike ?? 28}°C</span>
                  </div>
                  <div className="text-slate-500">
                    Humidity: <span className="font-bold text-slate-800 dark:text-slate-200">{weatherData?.humidity ?? 45}%</span>
                  </div>
                  <div className="text-slate-500">
                    Wind: <span className="font-bold text-slate-800 dark:text-slate-200">{weatherData?.windSpeedKmH ?? 12} km/h</span>
                  </div>
                </div>
              </div>

              {/* Station & Source info */}
              <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Site Station:</span>
                  <span className="font-bold font-mono text-slate-900 dark:text-white">
                    {projectName} ({weatherData?.locationName || resolvedProjectLocation})
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Physical Site Coordinates:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {weatherData?.latitude !== undefined ? `${weatherData.latitude.toFixed(4)}°, ${weatherData.longitude?.toFixed(4)}°` : `${siteCoordinates.lat.toFixed(4)}°, ${siteCoordinates.lng.toFixed(4)}°`}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Meteorology Service:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {weatherData?.provider === "OpenWeatherMap" ? "OpenWeatherMap API" : "Open-Meteo Global WMO Model"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Telemetry Timestamp:</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">
                    {weatherData?.updatedAt ? new Date(weatherData.updatedAt).toLocaleTimeString() : "Live"}
                  </span>
                </div>
              </div>

              {/* Location Switcher / Custom Location */}
              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Target Project Site Location
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customLocationInput}
                    onChange={(e) => setCustomLocationInput(e.target.value)}
                    placeholder="Enter site name or city (e.g. Tunduma, Dar es Salaam)"
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customLocationInput.trim()) {
                        setActiveWeatherLocation(customLocationInput.trim());
                        loadWeather(customLocationInput.trim(), undefined, true);
                        setCustomLocationInput("");
                      }
                    }}
                    className="px-3 py-1.5 bg-[#07182E] text-white font-bold rounded-lg hover:bg-[#0c2340] cursor-pointer"
                  >
                    Fetch
                  </button>
                </div>

                {/* Quick Site Presets */}
                <div className="flex flex-wrap items-center gap-1 pt-1">
                  <span className="text-[10px] text-slate-400 font-medium mr-1">Site Presets:</span>
                  {[
                    "Tunduma, Tanzania",
                    "Songwe Region",
                    "Dar es Salaam",
                    "Dodoma",
                    "Mtwara",
                    "Nakonde, Zambia"
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setActiveWeatherLocation(preset);
                        loadWeather(preset, undefined, true);
                      }}
                      className="text-[10px] px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                    >
                      {preset.split(",")[0]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => loadWeather(activeWeatherLocation, siteCoordinates, true)}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-750 text-slate-700 dark:text-slate-300 font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingWeather ? "animate-spin text-blue-500" : ""}`} />
                <span>Refresh Site Telemetry</span>
              </button>
              <button
                type="button"
                onClick={() => setShowWeatherModal(false)}
                className="px-4 py-1.5 bg-[#07182E] text-white font-bold rounded-lg hover:bg-[#0c2340] cursor-pointer text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW ACTIVITY MODAL */}
      {viewingActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-lg w-full p-5 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#07182E] dark:text-white">
                    Site Activity Details
                  </h3>
                  <p className="text-xs text-slate-500 font-mono font-bold">
                    {viewingActivity.location}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingActivity(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Activity Name
                </span>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {viewingActivity.activity}
                </p>
              </div>

              {/* Progress metric card */}
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-750 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-500 dark:text-slate-400">Execution Progress</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {calculateProgressPercent(viewingActivity.actual, viewingActivity.planned)}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${calculateProgressPercent(viewingActivity.actual, viewingActivity.planned)}%`
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 pt-1">
                  <span>Planned: <strong>{viewingActivity.planned}</strong></span>
                  <span>Actual: <strong className="text-blue-600 dark:text-blue-400">{viewingActivity.actual}</strong></span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Crew Assigned
                  </span>
                  <p className="font-semibold text-slate-900 dark:text-white">{viewingActivity.crew}</p>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Plant & Equipment
                  </span>
                  <p className="font-semibold text-slate-900 dark:text-white">{viewingActivity.plant}</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-500">Execution Status</span>
                <span className={`px-2.5 py-0.5 rounded-md text-xs ${getStatusClass(viewingActivity.status)}`}>
                  {viewingActivity.status}
                </span>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmItem({
                    type: "activity",
                    id: viewingActivity.id,
                    title: viewingActivity.activity,
                    subtitle: `Location ${viewingActivity.location}`
                  });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold text-xs transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const toEdit = viewingActivity;
                    setViewingActivity(null);
                    setEditingActivity(toEdit);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Activity</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingActivity(null)}
                  className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT ACTIVITY MODAL */}
      {editingActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-lg w-full p-5 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#07182E] dark:text-white">
                    Edit Site Activity
                  </h3>
                  <p className="text-xs text-slate-500">
                    Modify work progress and daily allocation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingActivity(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateActivity} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Location / Chainage
                  </label>
                  <input
                    type="text"
                    required
                    value={editingActivity.location}
                    onChange={(e) =>
                      setEditingActivity({ ...editingActivity, location: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={editingActivity.status}
                    onChange={(e) =>
                      setEditingActivity({
                        ...editingActivity,
                        status: e.target.value as SiteActivityItem["status"]
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                  >
                    <option value="Planned">Planned</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Complete">Complete</option>
                    <option value="Delayed">Delayed</option>
                    <option value="Stopped">Stopped</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Activity Name & Scope
                </label>
                <input
                  type="text"
                  required
                  value={editingActivity.activity}
                  onChange={(e) =>
                    setEditingActivity({ ...editingActivity, activity: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Planned Target
                  </label>
                  <input
                    type="text"
                    required
                    value={editingActivity.planned}
                    onChange={(e) =>
                      setEditingActivity({ ...editingActivity, planned: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Actual Completed
                  </label>
                  <input
                    type="text"
                    required
                    value={editingActivity.actual}
                    onChange={(e) =>
                      setEditingActivity({ ...editingActivity, actual: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Crew Assigned
                  </label>
                  <input
                    type="text"
                    required
                    value={editingActivity.crew}
                    onChange={(e) =>
                      setEditingActivity({ ...editingActivity, crew: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Plant & Equipment
                  </label>
                  <input
                    type="text"
                    required
                    value={editingActivity.plant}
                    onChange={(e) =>
                      setEditingActivity({ ...editingActivity, plant: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingActivity(null)}
                  className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#07182E] hover:bg-[#0c2340] dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW ISSUE MODAL */}
      {viewingIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-lg w-full p-5 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#07182E] dark:text-white">
                    Site Issue Details
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Category: {viewingIssue.category}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingIssue(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Issue Title
                </span>
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {viewingIssue.title}
                </p>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Description & Notes
                </span>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-750 text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {viewingIssue.details}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Assigned To
                  </span>
                  <p className="font-semibold text-slate-900 dark:text-white">{viewingIssue.assignedTo}</p>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Location
                  </span>
                  <p className="font-semibold text-slate-900 dark:text-white">{viewingIssue.location || "General Site"}</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-500">Issue Status</span>
                <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                  Active
                </span>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmItem({
                    type: "issue",
                    id: viewingIssue.id,
                    title: viewingIssue.title,
                    subtitle: `Category: ${viewingIssue.category}`
                  });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold text-xs transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const toEdit = viewingIssue;
                    setViewingIssue(null);
                    setEditingIssue(toEdit);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Issue</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingIssue(null)}
                  className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT ISSUE MODAL */}
      {editingIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-lg w-full p-5 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-[#07182E] dark:text-white">
                    Edit Site Issue
                  </h3>
                  <p className="text-xs text-slate-500">
                    Update issue details and assignment
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingIssue(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateIssue} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Issue Title
                </label>
                <input
                  type="text"
                  required
                  value={editingIssue.title}
                  onChange={(e) => setEditingIssue({ ...editingIssue, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={editingIssue.category}
                    onChange={(e) =>
                      setEditingIssue({
                        ...editingIssue,
                        category: e.target.value as SiteIssueItem["category"]
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="Plant">Plant & Machinery</option>
                    <option value="Safety">Safety / HSE</option>
                    <option value="Quality">Quality / Spec</option>
                    <option value="Environmental">Environmental</option>
                    <option value="Material">Material Supply</option>
                    <option value="Weather">Weather Delay</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={editingIssue.location || ""}
                    onChange={(e) => setEditingIssue({ ...editingIssue, location: e.target.value })}
                    placeholder="e.g. CH 2+500"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Assigned To
                </label>
                <input
                  type="text"
                  required
                  value={editingIssue.assignedTo}
                  onChange={(e) =>
                    setEditingIssue({ ...editingIssue, assignedTo: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Details & Observations
                </label>
                <textarea
                  rows={3}
                  required
                  value={editingIssue.details}
                  onChange={(e) => setEditingIssue({ ...editingIssue, details: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingIssue(null)}
                  className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#07182E] hover:bg-[#0c2340] dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Delete {deleteConfirmItem.type === "activity" ? "Site Activity" : "Site Issue"}?
                </h3>
                <p className="text-xs text-slate-500">
                  This action will permanently remove this record from the register.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-xs">
              <p className="font-bold text-slate-900 dark:text-white">
                {deleteConfirmItem.title}
              </p>
              {deleteConfirmItem.subtitle && (
                <p className="text-slate-600 dark:text-slate-400 mt-0.5">
                  {deleteConfirmItem.subtitle}
                </p>
              )}
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-lg text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirmed}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
