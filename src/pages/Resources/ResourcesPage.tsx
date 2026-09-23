import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { 
  Users, 
  HardHat, 
  Truck, 
  Boxes, 
  Navigation,
  Calendar, 
  Clock, 
  Search, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  Award, 
  ShieldCheck, 
  FileSpreadsheet, 
  Filter, 
  ChevronRight,
  UserCheck,
  Building,
  Wrench,
  Layers,
  Fuel,
  ArrowUpDown,
  MapPin,
  ClipboardList,
  CheckCircle,
  FileCheck,
  Send,
  AlertCircle
} from "lucide-react";
import ProjectShell from "../../components/layout/ProjectShell";
import { MetricCard } from "../../components/ui/MetricCard";
import { DataTable } from "../../components/ui/DataTable";
import { Panel } from "../../components/ui/Panel";
import { usePermissions } from "../../hooks/usePermissions";
import { resourceService } from "../../services/resourceService";
import { ResourceRowActions } from "../../components/resources/ResourceRowActions";
import { ResourceFormModal } from "../../components/resources/ResourceFormModal";
import { ResourceDetailModal } from "../../components/resources/ResourceDetailModal";
import { ResourceDeleteModal } from "../../components/resources/ResourceDeleteModal";
import { ResourceRecordType } from "../../types/resources";

export type ResourceDomainTab = "workforce" | "plant" | "materials" | "logistics";
export type WorkforceSubTab = "staff" | "labourers" | "artisans" | "foremen" | "drivers" | "timesheets" | "competency";
export type PlantSubTab = "fleet" | "allocation" | "hours" | "maintenance";
export type MaterialsSubTab = "inventory" | "consumption" | "deliveries";
export type LogisticsSubTab = "transport" | "dispatch" | "movement";

interface ModalState {
  type: ResourceRecordType;
  mode: "add" | "edit" | "view" | "delete";
  data?: any;
}

export default function ResourcesPage() {
  const context = useOutletContext<any>() || {};
  const activeProject = context.activeProject;
  const [searchParams, setSearchParams] = useSearchParams();
  const { can } = usePermissions();

  // Granular Permissions
  const canWorkforceView = can("resources.workforce.view");
  const canWorkforceCreate = can("resources.workforce.create");
  const canWorkforceEdit = can("resources.workforce.edit");
  const canWorkforceDelete = can("resources.workforce.delete");

  const canPlantView = can("resources.plant.view");
  const canPlantCreate = can("resources.plant.create");
  const canPlantEdit = can("resources.plant.edit");
  const canPlantDelete = can("resources.plant.delete");

  const canMaterialsView = can("resources.materials.view");
  const canMaterialsCreate = can("resources.materials.create");
  const canMaterialsEdit = can("resources.materials.edit");
  const canMaterialsDelete = can("resources.materials.delete");

  const canLogisticsView = can("resources.logistics.view");
  const canLogisticsCreate = can("resources.logistics.create");
  const canLogisticsEdit = can("resources.logistics.edit");
  const canLogisticsDelete = can("resources.logistics.delete");

  // Determine initial valid domain tab
  const getFirstValidTab = (): ResourceDomainTab => {
    if (canWorkforceView) return "workforce";
    if (canPlantView) return "plant";
    if (canMaterialsView) return "materials";
    if (canLogisticsView) return "logistics";
    return "workforce";
  };

  // Primary Domain Tab (Workforce | Plant | Materials | Logistics)
  const rawTab = searchParams.get("tab") || "";
  const [activeDomainTab, setActiveDomainTab] = useState<ResourceDomainTab>(() => {
    if (rawTab === "plant" && canPlantView) return "plant";
    if (rawTab === "materials" && canMaterialsView) return "materials";
    if (rawTab === "logistics" && canLogisticsView) return "logistics";
    if (rawTab === "workforce") return "workforce";
    return getFirstValidTab();
  });

  // Secondary Sub-tabs
  const rawSub = searchParams.get("sub");
  const [workforceSub, setWorkforceSub] = useState<WorkforceSubTab>(() => {
    if (rawSub && ["staff", "labourers", "artisans", "foremen", "drivers", "timesheets", "competency"].includes(rawSub)) {
      return rawSub as WorkforceSubTab;
    }
    if (rawTab === "skills") return "competency";
    if (rawTab === "timesheets") return "timesheets";
    if (rawTab === "labour" || rawTab === "labourers") return "labourers";
    if (rawTab === "staff" || rawTab === "people" || rawTab === "all") return "staff";
    return "staff";
  });
  const [plantSub, setPlantSub] = useState<PlantSubTab>((rawSub as PlantSubTab) || "fleet");
  const [materialsSub, setMaterialsSub] = useState<MaterialsSubTab>((rawSub as MaterialsSubTab) || "inventory");
  const [logisticsSub, setLogisticsSub] = useState<LogisticsSubTab>((rawSub as LogisticsSubTab) || "transport");

  const [searchQuery, setSearchQuery] = useState("");
  
  // Reactivity version tracker for live state updates
  const [dataVersion, setDataVersion] = useState(0);
  const refreshData = useCallback(() => setDataVersion((v) => v + 1), []);

  // Modal State Manager
  const [modalState, setModalState] = useState<ModalState | null>(null);

  // Synchronize state when URL search params change
  useEffect(() => {
    const currentTab = searchParams.get("tab");
    const currentSub = searchParams.get("sub");

    if (currentTab === "plant" || currentTab === "materials" || currentTab === "logistics" || currentTab === "workforce") {
      setActiveDomainTab(currentTab);
    } else if (currentTab === "people" || currentTab === "staff") {
      setActiveDomainTab("workforce");
      setWorkforceSub("staff");
    } else if (currentTab === "labour" || currentTab === "labourers") {
      setActiveDomainTab("workforce");
      setWorkforceSub("labourers");
    } else if (currentTab === "skills") {
      setActiveDomainTab("workforce");
      setWorkforceSub("competency");
    } else if (currentTab === "timesheets") {
      setActiveDomainTab("workforce");
      setWorkforceSub("timesheets");
    }

    if (currentSub) {
      if (activeDomainTab === "workforce") {
        if (currentSub === "all" || currentSub === "labour") {
          setWorkforceSub(currentSub === "all" ? "staff" : "labourers");
        } else {
          setWorkforceSub(currentSub as WorkforceSubTab);
        }
      }
      if (activeDomainTab === "plant") setPlantSub(currentSub as PlantSubTab);
      if (activeDomainTab === "materials") setMaterialsSub(currentSub as MaterialsSubTab);
      if (activeDomainTab === "logistics") setLogisticsSub(currentSub as LogisticsSubTab);
    }
  }, [searchParams, activeDomainTab]);

  const handleDomainChange = (domain: ResourceDomainTab) => {
    setActiveDomainTab(domain);
    setSearchQuery("");
    let defaultSub = "staff";
    if (domain === "plant") defaultSub = "fleet";
    if (domain === "materials") defaultSub = "inventory";
    if (domain === "logistics") defaultSub = "transport";
    setSearchParams({ tab: domain, sub: defaultSub });
  };

  const handleSubTabChange = (sub: string) => {
    if (activeDomainTab === "workforce") setWorkforceSub(sub as WorkforceSubTab);
    if (activeDomainTab === "plant") setPlantSub(sub as PlantSubTab);
    if (activeDomainTab === "materials") setMaterialsSub(sub as MaterialsSubTab);
    if (activeDomainTab === "logistics") setLogisticsSub(sub as LogisticsSubTab);
    setSearchParams({ tab: activeDomainTab, sub });
  };

  // --- DATA RETRIEVAL (Reactive to activeProject.id and dataVersion) ---

  // 1. Workforce Records
  const staffData = useMemo(() => {
    if (!activeProject?.id) return [];
    return resourceService.getStaff(activeProject.id);
  }, [activeProject?.id, dataVersion]);

  const labourersData = useMemo(() => {
    if (!activeProject?.id) return [];
    return resourceService.getLabourers(activeProject.id);
  }, [activeProject?.id, dataVersion]);

  const competencyMatrixData = useMemo(() => {
    if (!activeProject?.id) return [];
    return resourceService.getCompetencies(activeProject.id);
  }, [activeProject?.id, dataVersion]);

  const timesheetData = useMemo(() => {
    if (!activeProject?.id) return [];
    return resourceService.getTimesheets(activeProject.id);
  }, [activeProject?.id, dataVersion]);

  // 2. Plant Records
  const plantFleetData = useMemo(() => {
    if (!activeProject?.id) return [];
    return resourceService.getPlantAssets(activeProject.id);
  }, [activeProject?.id, dataVersion]);

  const plantAllocationData = useMemo(() => {
    if (!activeProject?.id) return [];
    return resourceService.getPlantAllocations(activeProject.id);
  }, [activeProject?.id, dataVersion]);

  const plantHoursData = useMemo(() => {
    if (!activeProject?.id) return [];
    return resourceService.getPlantHours(activeProject.id);
  }, [activeProject?.id, dataVersion]);

  const plantMaintenanceData = useMemo(() => {
    if (!activeProject?.id) return [];
    return resourceService.getPlantMaintenance(activeProject.id);
  }, [activeProject?.id, dataVersion]);

  // 3. Materials Records
  const materialsData = useMemo(() => {
    if (!activeProject?.id) return [];
    return resourceService.getMaterialInventory(activeProject.id);
  }, [activeProject?.id, dataVersion]);

  const materialConsumptionData = useMemo(() => {
    if (!activeProject?.id) return [];
    return resourceService.getMaterialConsumption(activeProject.id);
  }, [activeProject?.id, dataVersion]);

  const materialDeliveriesData = useMemo(() => {
    if (!activeProject?.id) return [];
    return resourceService.getMaterialDeliveries(activeProject.id);
  }, [activeProject?.id, dataVersion]);

  // 4. Logistics Records
  const logisticsData = useMemo(() => {
    if (!activeProject?.id) return [];
    return resourceService.getLogisticsTransports(activeProject.id);
  }, [activeProject?.id, dataVersion]);

  const logisticsDispatchData = useMemo(() => {
    if (!activeProject?.id) return [];
    return resourceService.getLogisticsDispatches(activeProject.id);
  }, [activeProject?.id, dataVersion]);

  const logisticsMovementData = useMemo(() => {
    if (!activeProject?.id) return [];
    return resourceService.getLogisticsMovements(activeProject.id);
  }, [activeProject?.id, dataVersion]);

  // --- FILTERED DATASETS FOR WORKFORCE ---
  const filteredStaff = useMemo(() => {
    let list = staffData;
    if (workforceSub === "artisans") {
      list = staffData.filter(p => p.category === "Artisans");
    } else if (workforceSub === "foremen") {
      list = staffData.filter(p => p.category === "Foremen");
    } else if (workforceSub === "drivers") {
      list = staffData.filter(p => p.category === "Drivers");
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => 
        p.name?.toLowerCase().includes(q) || 
        p.role?.toLowerCase().includes(q) || 
        p.trade?.toLowerCase().includes(q) || 
        p.cert?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.location?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [staffData, workforceSub, searchQuery]);

  const filteredLabourers = useMemo(() => {
    let list = labourersData;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(l => 
        l.name?.toLowerCase().includes(q) || 
        l.role?.toLowerCase().includes(q) || 
        l.squad?.toLowerCase().includes(q) || 
        l.trade?.toLowerCase().includes(q) || 
        l.lead?.toLowerCase().includes(q) ||
        l.location?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [labourersData, searchQuery]);

  const filteredTimesheets = useMemo(() => {
    let list = timesheetData;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t => 
        t.worker?.toLowerCase().includes(q) || 
        t.role?.toLowerCase().includes(q) || 
        t.category?.toLowerCase().includes(q) ||
        t.verifiedBy?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [timesheetData, searchQuery]);

  // --- SAVE / DELETE MUTATIONS ---

  const handleSaveRecord = (formData: any) => {
    assertOperationalAction("write", "pages/Resources/ResourcesPage.tsx");
    if (!activeProject?.id || !modalState) return;
    const { type, mode } = modalState;

    if (mode === "add") {
      switch (type) {
        case "workforce_staff": resourceService.addStaff(activeProject.id, formData); break;
        case "workforce_labourer": resourceService.addLabourer(activeProject.id, formData); break;
        case "workforce_competency": resourceService.addCompetency(activeProject.id, formData); break;
        case "workforce_timesheet": resourceService.addTimesheet(activeProject.id, formData); break;
        case "plant_asset": resourceService.addPlantAsset(activeProject.id, formData); break;
        case "plant_allocation": resourceService.addPlantAllocation(activeProject.id, formData); break;
        case "plant_hours": resourceService.addPlantHours(activeProject.id, formData); break;
        case "plant_maintenance": resourceService.addPlantMaintenance(activeProject.id, formData); break;
        case "material_inventory": resourceService.addMaterialInventory(activeProject.id, formData); break;
        case "material_delivery": resourceService.addMaterialDelivery(activeProject.id, formData); break;
        case "material_consumption": resourceService.addMaterialConsumption(activeProject.id, formData); break;
        case "logistics_transport": resourceService.addLogisticsTransport(activeProject.id, formData); break;
        case "logistics_dispatch": resourceService.addLogisticsDispatch(activeProject.id, formData); break;
        case "logistics_movement": resourceService.addLogisticsMovement(activeProject.id, formData); break;
      }
    } else if (mode === "edit") {
      switch (type) {
        case "workforce_staff": resourceService.updateStaff(activeProject.id, formData); break;
        case "workforce_labourer": resourceService.updateLabourer(activeProject.id, formData); break;
        case "workforce_competency": resourceService.updateCompetency(activeProject.id, formData); break;
        case "workforce_timesheet": resourceService.updateTimesheet(activeProject.id, formData); break;
        case "plant_asset": resourceService.updatePlantAsset(activeProject.id, formData); break;
        case "plant_allocation": resourceService.updatePlantAllocation(activeProject.id, formData); break;
        case "plant_hours": resourceService.updatePlantHours(activeProject.id, formData); break;
        case "plant_maintenance": resourceService.updatePlantMaintenance(activeProject.id, formData); break;
        case "material_inventory": resourceService.updateMaterialInventory(activeProject.id, formData); break;
        case "material_delivery": resourceService.updateMaterialDelivery(activeProject.id, formData); break;
        case "material_consumption": resourceService.updateMaterialConsumption(activeProject.id, formData); break;
        case "logistics_transport": resourceService.updateLogisticsTransport(activeProject.id, formData); break;
        case "logistics_dispatch": resourceService.updateLogisticsDispatch(activeProject.id, formData); break;
        case "logistics_movement": resourceService.updateLogisticsMovement(activeProject.id, formData); break;
      }
    }

    refreshData();
  };

  const handleDeleteRecord = () => {
    assertOperationalAction("delete", "pages/Resources/ResourcesPage.tsx");
    if (!activeProject?.id || !modalState || !modalState.data?.id) return;
    const { type, data } = modalState;

    switch (type) {
      case "workforce_staff": resourceService.deleteStaff(activeProject.id, data.id); break;
      case "workforce_labourer": resourceService.deleteLabourer(activeProject.id, data.id); break;
      case "workforce_competency": resourceService.deleteCompetency(activeProject.id, data.id); break;
      case "workforce_timesheet": resourceService.deleteTimesheet(activeProject.id, data.id); break;
      case "plant_asset": resourceService.deletePlantAsset(activeProject.id, data.id); break;
      case "plant_allocation": resourceService.deletePlantAllocation(activeProject.id, data.id); break;
      case "plant_hours": resourceService.deletePlantHours(activeProject.id, data.id); break;
      case "plant_maintenance": resourceService.deletePlantMaintenance(activeProject.id, data.id); break;
      case "material_inventory": resourceService.deleteMaterialInventory(activeProject.id, data.id); break;
      case "material_delivery": resourceService.deleteMaterialDelivery(activeProject.id, data.id); break;
      case "material_consumption": resourceService.deleteMaterialConsumption(activeProject.id, data.id); break;
      case "logistics_transport": resourceService.deleteLogisticsTransport(activeProject.id, data.id); break;
      case "logistics_dispatch": resourceService.deleteLogisticsDispatch(activeProject.id, data.id); break;
      case "logistics_movement": resourceService.deleteLogisticsMovement(activeProject.id, data.id); break;
    }

    setModalState(null);
    refreshData();
  };

  // Helper to open modal
  const openModal = (type: ResourceRecordType, mode: "add" | "edit" | "view" | "delete", data?: any) => {
    setModalState({ type, mode, data });
  };

  // Render a clean Add Button for panel headers
  const renderAddButton = (type: ResourceRecordType, label: string, canCreate: boolean) => {
    if (!canCreate) return null;
    return (
      <button
        type="button"
        onClick={() => openModal(type, "add")}
        className="px-3 py-1.5 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 active:bg-amber-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>{label}</span>
      </button>
    );
  };

  return (
    <ProjectShell project={activeProject} section="overview">
      <div className="space-y-6 max-w-7xl mx-auto pb-12" id="resources-consolidated-module">
        
        {/* Top Consolidated Domain Tabs: Workforce | Plant | Materials | Logistics */}
        <div className="bg-white dark:bg-[#0B172A] border border-[#E6E9EF] dark:border-slate-800 rounded-2xl p-2 shadow-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            
            {/* Workforce Tab */}
            <button
              onClick={() => handleDomainChange("workforce")}
              className={`px-4 py-3 rounded-xl text-left transition-all cursor-pointer flex items-center gap-3 ${
                activeDomainTab === "workforce"
                  ? "bg-[#0B172A] text-white shadow-xs dark:bg-white dark:text-[#0B172A]"
                  : "text-[#667085] dark:text-slate-400 hover:bg-[#F7F8FA] dark:hover:bg-slate-800/80 hover:text-[#172033] dark:hover:text-white"
              }`}
            >
              <div className={`p-2 rounded-lg shrink-0 ${activeDomainTab === "workforce" ? "bg-amber-500 text-white dark:bg-amber-500 dark:text-white" : "bg-[#F7F8FA] dark:bg-slate-800 text-[#667085]"}`}>
                <Users className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold leading-tight">Workforce</div>
                <div className={`text-[10px] truncate ${activeDomainTab === "workforce" ? "text-slate-300 dark:text-slate-600" : "text-[#667085]"}`}>
                  Staff · Labourers · Artisans · Timesheets
                </div>
              </div>
            </button>

            {/* Plant Tab */}
            <button
              onClick={() => handleDomainChange("plant")}
              className={`px-4 py-3 rounded-xl text-left transition-all cursor-pointer flex items-center gap-3 ${
                activeDomainTab === "plant"
                  ? "bg-[#0B172A] text-white shadow-xs dark:bg-white dark:text-[#0B172A]"
                  : "text-[#667085] dark:text-slate-400 hover:bg-[#F7F8FA] dark:hover:bg-slate-800/80 hover:text-[#172033] dark:hover:text-white"
              }`}
            >
              <div className={`p-2 rounded-lg shrink-0 ${activeDomainTab === "plant" ? "bg-amber-500 text-white dark:bg-amber-500 dark:text-white" : "bg-[#F7F8FA] dark:bg-slate-800 text-[#667085]"}`}>
                <Truck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold leading-tight">Plant</div>
                <div className={`text-[10px] truncate ${activeDomainTab === "plant" ? "text-slate-300 dark:text-slate-600" : "text-[#667085]"}`}>
                  Fleet · Allocation · Hours · Maint.
                </div>
              </div>
            </button>

            {/* Materials Tab */}
            <button
              onClick={() => handleDomainChange("materials")}
              className={`px-4 py-3 rounded-xl text-left transition-all cursor-pointer flex items-center gap-3 ${
                activeDomainTab === "materials"
                  ? "bg-[#0B172A] text-white shadow-xs dark:bg-white dark:text-[#0B172A]"
                  : "text-[#667085] dark:text-slate-400 hover:bg-[#F7F8FA] dark:hover:bg-slate-800/80 hover:text-[#172033] dark:hover:text-white"
              }`}
            >
              <div className={`p-2 rounded-lg shrink-0 ${activeDomainTab === "materials" ? "bg-amber-500 text-white dark:bg-amber-500 dark:text-white" : "bg-[#F7F8FA] dark:bg-slate-800 text-[#667085]"}`}>
                <Boxes className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold leading-tight">Materials</div>
                <div className={`text-[10px] truncate ${activeDomainTab === "materials" ? "text-slate-300 dark:text-slate-600" : "text-[#667085]"}`}>
                  Inventory · Consumption · Stock
                </div>
              </div>
            </button>

            {/* Logistics Tab */}
            <button
              onClick={() => handleDomainChange("logistics")}
              className={`px-4 py-3 rounded-xl text-left transition-all cursor-pointer flex items-center gap-3 ${
                activeDomainTab === "logistics"
                  ? "bg-[#0B172A] text-white shadow-xs dark:bg-white dark:text-[#0B172A]"
                  : "text-[#667085] dark:text-slate-400 hover:bg-[#F7F8FA] dark:hover:bg-slate-800/80 hover:text-[#172033] dark:hover:text-white"
              }`}
            >
              <div className={`p-2 rounded-lg shrink-0 ${activeDomainTab === "logistics" ? "bg-amber-500 text-white dark:bg-amber-500 dark:text-white" : "bg-[#F7F8FA] dark:bg-slate-800 text-[#667085]"}`}>
                <Navigation className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold leading-tight">Logistics</div>
                <div className={`text-[10px] truncate ${activeDomainTab === "logistics" ? "text-slate-300 dark:text-slate-600" : "text-[#667085]"}`}>
                  Transport · Dispatch · Movement
                </div>
              </div>
            </button>

          </div>
        </div>

        {/* DOMAIN 1: WORKFORCE */}
        {activeDomainTab === "workforce" && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* Workforce Key Metrics Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label="Site Workforce Count"
                value={staffData.length + labourersData.length > 0 ? `${staffData.length + labourersData.length} on site` : "-"}
                subValue={staffData.length + labourersData.length > 0 ? `${staffData.length} Staff + ${labourersData.length} Labour` : "-"}
                icon={Users}
              />
              <MetricCard
                label="Active Staff"
                value={staffData.length > 0 ? `${staffData.length} Roster Members` : "-"}
                subValue={staffData.length > 0 ? "Labourers, Drivers, Artisans & Foremen" : "-"}
                icon={HardHat}
              />
              <MetricCard
                label="Competency Compliance"
                value={competencyMatrixData.length > 0 ? `${Math.round((competencyMatrixData.filter((c: any) => c.status && (c.status.includes('100%') || c.status.includes('Valid') || c.status.includes('Refreshed'))).length / competencyMatrixData.length) * 100)}%` : "-"}
                subValue={competencyMatrixData.length > 0 ? `${competencyMatrixData.length} legal certifications verified` : "-"}
                icon={Award}
                intent={competencyMatrixData.length > 0 ? "good" : "neutral"}
              />
              <MetricCard
                label="Weekly Hours Verified"
                value={timesheetData.length > 0 ? `${timesheetData.reduce((sum: number, t: any) => sum + (Number(t.total) || 0), 0).toLocaleString()} hrs` : "-"}
                subValue={timesheetData.length > 0 ? `${timesheetData.length} audited timesheets` : "-"}
                icon={Clock}
              />
            </div>

            {/* Workforce Sub-Navigation Filter Bar */}
            <div className="bg-[#F7F8FA] dark:bg-slate-900/60 p-1.5 border border-[#E6E9EF] dark:border-slate-800 rounded-xl flex items-center justify-between gap-2 overflow-x-auto">
              <div className="flex items-center gap-1 min-w-max">
                {[
                  { id: "staff", label: "Staff", icon: Users },
                  { id: "labourers", label: "Labourers", icon: HardHat },
                  { id: "artisans", label: "Artisans", icon: Wrench },
                  { id: "foremen", label: "Foremen", icon: UserCheck },
                  { id: "drivers", label: "Drivers / Operators", icon: Truck },
                  { id: "timesheets", label: "Timesheets", icon: Clock },
                  { id: "competency", label: "Competency & Accreditation", icon: Award },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSubTabChange(item.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                      workforceSub === item.id
                        ? "bg-white dark:bg-[#0B172A] text-[#172033] dark:text-white shadow-2xs font-bold border border-[#E6E9EF] dark:border-slate-700"
                        : "text-[#667085] dark:text-slate-400 hover:text-[#172033] dark:hover:text-white"
                    }`}
                  >
                    <item.icon className="w-3.5 h-3.5 text-amber-500" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>

              <div className="hidden sm:flex items-center gap-2 pr-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter personnel..."
                    className="pl-8 pr-3 py-1 text-xs bg-white dark:bg-slate-800 border border-[#E6E9EF] dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden focus:border-amber-500 w-40"
                  />
                </div>
              </div>
            </div>

            {/* VIEW A: STAFF COMBINATION / ARTISANS / FOREMEN / DRIVERS */}
            {(workforceSub === "staff" || workforceSub === "artisans" || workforceSub === "foremen" || workforceSub === "drivers") && (
              <Panel
                title={
                  workforceSub === "staff" ? "Consolidated Site Staff & Personnel Roster" :
                  workforceSub === "artisans" ? "Artisans, Craftsmen & Trade Specialists" :
                  workforceSub === "foremen" ? "General Foremen & Section Supervisors" :
                  "Plant Drivers & Heavy Machinery Operators"
                }
                subtitle={
                  workforceSub === "staff" ? "Combined workforce roster encompassing Labour, Drivers/Operators, Artisans, and Foremen" :
                  "Personnel deployment on active corridor chainages, designated trades, and field accreditations"
                }
                actions={
                  renderAddButton(
                    "workforce_staff",
                    workforceSub === "artisans" ? "+ Add Artisan" :
                    workforceSub === "foremen" ? "+ Add Foreman" :
                    workforceSub === "drivers" ? "+ Add Driver / Operator" :
                    "+ Add Staff Member",
                    canWorkforceCreate
                  )
                }
              >
                <DataTable
                  columns={[
                    { header: "Personnel Name", accessor: (r: any) => <strong className="text-slate-900 dark:text-white font-semibold">{r.name}</strong> },
                    { 
                      header: "Staff Category", 
                      accessor: (r: any) => {
                        const colors: Record<string, string> = {
                          "Foremen": "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
                          "Artisans": "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
                          "Drivers": "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
                          "Labour": "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
                          "Management": "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
                        };
                        return (
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${colors[r.category] || "bg-slate-100 text-slate-700"}`}>
                            {r.category === "Labour" ? "Labour / Labourer" : r.category === "Drivers" ? "Driver / Operator" : r.category}
                          </span>
                        );
                      } 
                    },
                    { header: "Designated Role", accessor: (r: any) => <span className="text-slate-700 dark:text-slate-300 font-medium">{r.role}</span> },
                    { header: "Trade / Craft", accessor: (r: any) => <span className="text-slate-600 dark:text-slate-400">{r.trade}</span> },
                    { header: "Credentials & Accreditation", accessor: (r: any) => <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300 bg-[#F7F8FA] dark:bg-slate-800 px-2 py-0.5 rounded border border-[#E6E9EF] dark:border-slate-700">{r.cert}</span> },
                    { header: "Site Location", accessor: (r: any) => <span className="text-slate-600 dark:text-slate-400">{r.location}</span> },
                    { header: "Contact", accessor: (r: any) => <span className="font-mono text-xs text-slate-500">{r.contact}</span> },
                    {
                      header: "Actions",
                      accessor: (r: any) => (
                        <ResourceRowActions
                          onView={() => openModal("workforce_staff", "view", r)}
                          onEdit={() => openModal("workforce_staff", "edit", r)}
                          onDelete={() => openModal("workforce_staff", "delete", r)}
                          canEdit={canWorkforceEdit}
                          canDelete={canWorkforceDelete}
                        />
                      )
                    }
                  ]}
                  data={filteredStaff}
                />
              </Panel>
            )}

            {/* VIEW B: LABOURERS */}
            {workforceSub === "labourers" && (
              <div className="space-y-6">
                <Panel
                  title="Site Labourers & Field Operatives"
                  subtitle="Dedicated deployment register of general civil hands, earthworks labourers, concrete placement operatives, and trenching crews"
                  actions={renderAddButton("workforce_labourer", "+ Add Labourer", canWorkforceCreate)}
                >
                  <DataTable
                    columns={[
                      { header: "Labourer Name", accessor: (r: any) => <strong className="text-slate-900 dark:text-white font-semibold">{r.name}</strong> },
                      { header: "Designated Duty", accessor: (r: any) => <span className="text-slate-700 dark:text-slate-300 font-medium">{r.role}</span> },
                      { header: "Assigned Squad / Crew", accessor: (r: any) => <span className="text-slate-800 dark:text-slate-200 font-semibold">{r.squad}</span> },
                      { header: "Trade Specialty", accessor: (r: any) => <span className="text-slate-600 dark:text-slate-400">{r.trade}</span> },
                      { header: "Supervising Lead", accessor: (r: any) => <span className="text-slate-700 dark:text-slate-300 font-medium">{r.lead}</span> },
                      { header: "Shift Hours", accessor: (r: any) => <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{r.shift}</span> },
                      { header: "Daily Rate", accessor: (r: any) => <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{r.dailyRate}</span> },
                      { header: "Site Location", accessor: (r: any) => <span className="text-slate-600 dark:text-slate-400">{r.location}</span> },
                      { 
                        header: "Status", 
                        accessor: (r: any) => (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            {r.status}
                          </span>
                        ) 
                      },
                      {
                        header: "Actions",
                        accessor: (r: any) => (
                          <ResourceRowActions
                            onView={() => openModal("workforce_labourer", "view", r)}
                            onEdit={() => openModal("workforce_labourer", "edit", r)}
                            onDelete={() => openModal("workforce_labourer", "delete", r)}
                            canEdit={canWorkforceEdit}
                            canDelete={canWorkforceDelete}
                          />
                        )
                      }
                    ]}
                    data={filteredLabourers}
                  />
                </Panel>
              </div>
            )}

            {/* VIEW C: COMPETENCY & SAFETY ACCREDITATION MATRIX */}
            {workforceSub === "competency" && (
              <div className="space-y-6">
                <Panel
                  title="Competency & Safety Accreditation Matrix"
                  subtitle="Unified compliance register: Legal qualifications, heavy equipment licenses, high-risk work permits, and safety accreditation renewals"
                  actions={renderAddButton("workforce_competency", "+ Add Competency / Accreditation", canWorkforceCreate)}
                >
                  <div className="space-y-4">
                    <DataTable
                      columns={[
                        { header: "Personnel / Squad", accessor: (r: any) => <strong className="text-slate-900 dark:text-white">{r.person}</strong> },
                        { header: "Designated Role", accessor: (r: any) => <span className="text-slate-600 dark:text-slate-400 text-xs">{r.role}</span> },
                        { header: "Accreditation Title", accessor: (r: any) => <span className="font-semibold text-slate-800 dark:text-slate-200">{r.accreditation}</span> },
                        { header: "Registration / License No.", accessor: (r: any) => <span className="font-mono text-xs text-slate-600 dark:text-slate-300 bg-[#F7F8FA] dark:bg-slate-800 px-2 py-0.5 rounded border border-[#E6E9EF] dark:border-slate-700">{r.certNumber}</span> },
                        { header: "Issuing Authority", accessor: (r: any) => <span className="text-slate-600 dark:text-slate-400">{r.issuingBody}</span> },
                        { header: "Expiry / Validity", accessor: (r: any) => <span className="font-mono text-xs font-semibold text-slate-700 dark:text-slate-300">{r.validUntil}</span> },
                        { 
                          header: "Compliance State", 
                          accessor: (r: any) => (
                            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              {r.status}
                            </span>
                          ) 
                        },
                        {
                          header: "Actions",
                          accessor: (r: any) => (
                            <ResourceRowActions
                              onView={() => openModal("workforce_competency", "view", r)}
                              onEdit={() => openModal("workforce_competency", "edit", r)}
                              onDelete={() => openModal("workforce_competency", "delete", r)}
                              canEdit={canWorkforceEdit}
                              canDelete={canWorkforceDelete}
                            />
                          )
                        }
                      ]}
                      data={competencyMatrixData}
                    />
                  </div>
                </Panel>
              </div>
            )}

            {/* VIEW D: TIMESHEETS FOR ALL STAFF MEMBERS */}
            {workforceSub === "timesheets" && (
              <Panel
                title="Verified Site Timesheets & Daily Audit Log"
                subtitle="Weekly labor hours cross-checked against Site Diaries and Inspector sign-offs for all site staff members"
                actions={renderAddButton("workforce_timesheet", "+ Add Timesheet Record", canWorkforceCreate)}
              >
                <DataTable
                  columns={[
                    { header: "Staff Member", accessor: (r: any) => <strong className="text-slate-900 dark:text-white">{r.worker}</strong> },
                    { 
                      header: "Category", 
                      accessor: (r: any) => {
                        const colors: Record<string, string> = {
                          "Foremen": "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
                          "Artisans": "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
                          "Drivers": "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
                          "Labour": "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
                          "Management": "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
                        };
                        return (
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${colors[r.category] || "bg-slate-100 text-slate-700"}`}>
                            {r.category === "Labour" ? "Labourer" : r.category === "Drivers" ? "Driver / Operator" : r.category}
                          </span>
                        );
                      } 
                    },
                    { header: "Designated Role", accessor: (r: any) => <span className="text-slate-600 dark:text-slate-400">{r.role}</span> },
                    { header: "Week Ending", accessor: (r: any) => <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{r.weekEnding}</span> },
                    { header: "Regular Hours", accessor: (r: any) => <span className="font-mono">{r.regularHours}h</span> },
                    { header: "Overtime Hours", accessor: (r: any) => <span className="font-mono font-bold text-amber-600">+{r.overtimeHours}h</span> },
                    { header: "Total Logged", accessor: (r: any) => <span className="font-mono font-bold text-slate-900 dark:text-white">{r.total}h</span> },
                    { header: "Audit Trail & Verification", accessor: (r: any) => <span className="text-xs text-slate-600 dark:text-slate-400">{r.verifiedBy}</span> },
                    { 
                      header: "Status", 
                      accessor: (r: any) => (
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                          r.status === "Approved" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-amber-50 text-amber-800 border-amber-200"
                        }`}>
                          {r.status}
                        </span>
                      ) 
                    },
                    {
                      header: "Actions",
                      accessor: (r: any) => (
                        <ResourceRowActions
                          onView={() => openModal("workforce_timesheet", "view", r)}
                          onEdit={() => openModal("workforce_timesheet", "edit", r)}
                          onDelete={() => openModal("workforce_timesheet", "delete", r)}
                          canEdit={canWorkforceEdit}
                          canDelete={canWorkforceDelete}
                        />
                      )
                    }
                  ]}
                  data={filteredTimesheets}
                />
              </Panel>
            )}

          </div>
        )}

        {/* DOMAIN 2: PLANT */}
        {activeDomainTab === "plant" && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* Plant Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label="Heavy Fleet Assets"
                value={plantFleetData.length > 0 ? `${plantFleetData.length} Units Active` : "-"}
                subValue={plantFleetData.length > 0 ? "Fleet readiness verified" : "-"}
                icon={Truck}
              />
              <MetricCard
                label="Shift Utilization Rate"
                value={plantFleetData.length > 0 ? `${plantFleetData.filter((p: any) => p.status === "In Use" || p.condition === "Operational").length}/${plantFleetData.length} Active` : "-"}
                subValue={plantFleetData.length > 0 ? "Operational shift status" : "-"}
                icon={Clock}
                intent={plantFleetData.length > 0 ? "good" : "neutral"}
              />
              <MetricCard
                label="Total Operating Hours"
                value={plantHoursData.length > 0 ? `${plantHoursData.reduce((sum, h) => sum + (Number(h.totalHours) || 0), 0)} hrs` : "-"}
                subValue={plantHoursData.length > 0 ? `${plantHoursData.length} shifts recorded` : "-"}
                icon={Fuel}
              />
              <MetricCard
                label="Maintenance Records"
                value={plantMaintenanceData.length > 0 ? `${plantMaintenanceData.length} Logs` : "-"}
                subValue={plantMaintenanceData.length > 0 ? `${plantMaintenanceData.filter((m: any) => m.status === "Completed").length} Completed` : "-"}
                icon={Wrench}
                intent="neutral"
              />
            </div>

            {/* Plant Sub-Navigation */}
            <div className="bg-[#F7F8FA] dark:bg-slate-900/60 p-1.5 border border-[#E6E9EF] dark:border-slate-800 rounded-xl flex items-center justify-between gap-2 overflow-x-auto">
              <div className="flex items-center gap-1 min-w-max">
                {[
                  { id: "fleet", label: "Fleet & Machinery", icon: Truck },
                  { id: "allocation", label: "Allocation & Staging", icon: Calendar },
                  { id: "hours", label: "Operating Hours", icon: Clock },
                  { id: "maintenance", label: "Maintenance & Inspection", icon: Wrench },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSubTabChange(item.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                      plantSub === item.id
                        ? "bg-white dark:bg-[#0B172A] text-[#172033] dark:text-white shadow-2xs font-bold border border-[#E6E9EF] dark:border-slate-700"
                        : "text-[#667085] dark:text-slate-400 hover:text-[#172033] dark:hover:text-white"
                    }`}
                  >
                    <item.icon className="w-3.5 h-3.5 text-amber-500" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* SUB-VIEW 1: Plant Fleet Table */}
            {plantSub === "fleet" && (
              <Panel
                title="Heavy Machinery Fleet & Telematics Register"
                subtitle="Excavators, mobile cranes, concrete batching, haulers, and compactors deployed on active corridor sections"
                actions={renderAddButton("plant_asset", "+ Add Plant / Equipment", canPlantCreate)}
              >
                <DataTable
                  columns={[
                    { header: "Asset Code", accessor: (r: any) => <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{r.tag}</span> },
                    { header: "Plant Model & Specs", accessor: (r: any) => <strong className="text-slate-900 dark:text-white">{r.name}</strong> },
                    { header: "Category", accessor: (r: any) => <span className="text-slate-600 dark:text-slate-400">{r.category}</span> },
                    { header: "Active Workface", accessor: (r: any) => <span className="text-slate-700 dark:text-slate-300 font-medium">{r.allocation}</span> },
                    { header: "Operator", accessor: (r: any) => <span className="text-slate-700 dark:text-slate-300">{r.operator}</span> },
                    { header: "Daily Shift Hours", accessor: (r: any) => <span className="font-mono font-semibold">{r.hoursToday}</span> },
                    { header: "Fuel Level", accessor: (r: any) => <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{r.fuelPct}</span> },
                    { header: "Service Due In", accessor: (r: any) => <span className="font-mono text-xs text-amber-600 font-bold">{r.nextService}</span> },
                    { 
                      header: "Condition", 
                      accessor: (r: any) => (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {r.condition}
                        </span>
                      ) 
                    },
                    {
                      header: "Actions",
                      accessor: (r: any) => (
                        <ResourceRowActions
                          onView={() => openModal("plant_asset", "view", r)}
                          onEdit={() => openModal("plant_asset", "edit", r)}
                          onDelete={() => openModal("plant_asset", "delete", r)}
                          canEdit={canPlantEdit}
                          canDelete={canPlantDelete}
                        />
                      )
                    }
                  ]}
                  data={plantFleetData}
                />
              </Panel>
            )}

            {/* SUB-VIEW 2: Plant Allocation */}
            {plantSub === "allocation" && (
              <Panel
                title="Plant Allocation & Workface Staging Register"
                subtitle="Corridor chainage staging, operator assignments, and mobilization schedule"
                actions={renderAddButton("plant_allocation", "+ Add Plant Allocation", canPlantCreate)}
              >
                <DataTable
                  columns={[
                    { header: "Plant Tag", accessor: (r: any) => <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{r.tag}</span> },
                    { header: "Plant Description", accessor: (r: any) => <strong className="text-slate-900 dark:text-white">{r.plantName || r.tag}</strong> },
                    { header: "Workface / Chainage", accessor: (r: any) => <span className="text-slate-700 dark:text-slate-300 font-medium">{r.workface}</span> },
                    { header: "Assigned Operator", accessor: (r: any) => <span className="text-slate-600 dark:text-slate-400">{r.operator || "—"}</span> },
                    { header: "Start Date", accessor: (r: any) => <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{r.startDate}</span> },
                    { header: "End Date", accessor: (r: any) => <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{r.endDate}</span> },
                    { 
                      header: "Status", 
                      accessor: (r: any) => (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {r.status}
                        </span>
                      ) 
                    },
                    {
                      header: "Actions",
                      accessor: (r: any) => (
                        <ResourceRowActions
                          onView={() => openModal("plant_allocation", "view", r)}
                          onEdit={() => openModal("plant_allocation", "edit", r)}
                          onDelete={() => openModal("plant_allocation", "delete", r)}
                          canEdit={canPlantEdit}
                          canDelete={canPlantDelete}
                        />
                      )
                    }
                  ]}
                  data={plantAllocationData}
                />
              </Panel>
            )}

            {/* SUB-VIEW 3: Plant Operating Hours */}
            {plantSub === "hours" && (
              <Panel
                title="Plant Operating Hours & Shift Telematics"
                subtitle="Daily machine hours, fuel consumption logs, and shift operator verification"
                actions={renderAddButton("plant_hours", "+ Add Operating Hours", canPlantCreate)}
              >
                <DataTable
                  columns={[
                    { header: "Plant Tag", accessor: (r: any) => <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{r.tag}</span> },
                    { header: "Date", accessor: (r: any) => <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{r.date}</span> },
                    { header: "Shift", accessor: (r: any) => <span className="text-slate-700 dark:text-slate-300 font-medium">{r.shift}</span> },
                    { header: "Operating Hours", accessor: (r: any) => <span className="font-mono font-bold text-slate-900 dark:text-white">{r.totalHours} hrs</span> },
                    { header: "Fuel Consumed", accessor: (r: any) => <span className="font-mono text-amber-600 font-semibold">{r.fuelConsumedLiters} L</span> },
                    { header: "Operator", accessor: (r: any) => <span className="text-slate-600 dark:text-slate-400">{r.operator || "—"}</span> },
                    { header: "Supervisor", accessor: (r: any) => <span className="text-xs text-slate-500">{r.supervisor || "—"}</span> },
                    {
                      header: "Actions",
                      accessor: (r: any) => (
                        <ResourceRowActions
                          onView={() => openModal("plant_hours", "view", r)}
                          onEdit={() => openModal("plant_hours", "edit", r)}
                          onDelete={() => openModal("plant_hours", "delete", r)}
                          canEdit={canPlantEdit}
                          canDelete={canPlantDelete}
                        />
                      )
                    }
                  ]}
                  data={plantHoursData}
                />
              </Panel>
            )}

            {/* SUB-VIEW 4: Plant Maintenance */}
            {plantSub === "maintenance" && (
              <Panel
                title="Plant Maintenance, Servicing & Inspection Register"
                subtitle="Scheduled 250h/500h/1000h servicing, breakdown repairs, oil analyses, and parts replacement"
                actions={renderAddButton("plant_maintenance", "+ Add Maintenance Record", canPlantCreate)}
              >
                <DataTable
                  columns={[
                    { header: "Plant Tag", accessor: (r: any) => <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{r.tag}</span> },
                    { header: "Service Type", accessor: (r: any) => <strong className="text-slate-900 dark:text-white">{r.serviceType}</strong> },
                    { header: "Service Date", accessor: (r: any) => <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{r.serviceDate}</span> },
                    { header: "Technician / Workshop", accessor: (r: any) => <span className="text-slate-700 dark:text-slate-300">{r.technician || "—"}</span> },
                    { header: "Parts Replaced", accessor: (r: any) => <span className="text-xs text-slate-600 dark:text-slate-400">{r.partsReplaced || "—"}</span> },
                    { header: "Next Service Due", accessor: (r: any) => <span className="font-mono text-xs text-amber-600 font-semibold">{r.nextDueDate || "—"}</span> },
                    { 
                      header: "Status", 
                      accessor: (r: any) => (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {r.status}
                        </span>
                      ) 
                    },
                    {
                      header: "Actions",
                      accessor: (r: any) => (
                        <ResourceRowActions
                          onView={() => openModal("plant_maintenance", "view", r)}
                          onEdit={() => openModal("plant_maintenance", "edit", r)}
                          onDelete={() => openModal("plant_maintenance", "delete", r)}
                          canEdit={canPlantEdit}
                          canDelete={canPlantDelete}
                        />
                      )
                    }
                  ]}
                  data={plantMaintenanceData}
                />
              </Panel>
            )}

          </div>
        )}

        {/* DOMAIN 3: MATERIALS */}
        {activeDomainTab === "materials" && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* Materials Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label="Tracked Materials"
                value={materialsData.length > 0 ? `${materialsData.length} Items` : "-"}
                subValue={materialsData.length > 0 ? "Inventory items logged" : "-"}
                icon={Boxes}
              />
              <MetricCard
                label="Stock Status"
                value={materialsData.length > 0 ? `${materialsData.filter((m: any) => m.status === "Adequate" || m.status === "Optimal").length}/${materialsData.length} Optimal` : "-"}
                subValue={materialsData.length > 0 ? "Threshold verification" : "-"}
                icon={Boxes}
              />
              <MetricCard
                label="Recorded Deliveries"
                value={materialDeliveriesData.length > 0 ? `${materialDeliveriesData.length} GRN Batches` : "-"}
                subValue={materialDeliveriesData.length > 0 ? "Supplier receipts verified" : "-"}
                icon={CheckCircle2}
                intent={materialDeliveriesData.length > 0 ? "good" : "neutral"}
              />
              <MetricCard
                label="Issues / Consumption"
                value={materialConsumptionData.length > 0 ? `${materialConsumptionData.length} Vouchers` : "-"}
                subValue={materialConsumptionData.length > 0 ? "Workface issues logged" : "-"}
                icon={Fuel}
                intent="neutral"
              />
            </div>

            {/* Materials Sub-Navigation */}
            <div className="bg-[#F7F8FA] dark:bg-slate-900/60 p-1.5 border border-[#E6E9EF] dark:border-slate-800 rounded-xl flex items-center justify-between gap-2 overflow-x-auto">
              <div className="flex items-center gap-1 min-w-max">
                {[
                  { id: "inventory", label: "Inventory & Stock", icon: Boxes },
                  { id: "consumption", label: "Daily Consumption", icon: Clock },
                  { id: "deliveries", label: "Supplier Deliveries", icon: Truck },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSubTabChange(item.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                      materialsSub === item.id
                        ? "bg-white dark:bg-[#0B172A] text-[#172033] dark:text-white shadow-2xs font-bold border border-[#E6E9EF] dark:border-slate-700"
                        : "text-[#667085] dark:text-slate-400 hover:text-[#172033] dark:hover:text-white"
                    }`}
                  >
                    <item.icon className="w-3.5 h-3.5 text-amber-500" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* SUB-VIEW 1: Raw Materials Inventory */}
            {materialsSub === "inventory" && (
              <Panel
                title="Bulk Raw Materials Inventory & QA Mill Verification"
                subtitle="Stock on hand, daily burn rate, safety buffer thresholds, and QA mill test batch certificates"
                actions={renderAddButton("material_inventory", "+ Add Material Item", canMaterialsCreate)}
              >
                <DataTable
                  columns={[
                    { header: "Material SKU", accessor: (r: any) => <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{r.code}</span> },
                    { header: "Description", accessor: (r: any) => <strong className="text-slate-900 dark:text-white">{r.name}</strong> },
                    { header: "Stock on Hand", accessor: (r: any) => <span className="font-mono font-bold text-slate-900 dark:text-white">{r.stockOnHand} {r.unit || ""}</span> },
                    { header: "Daily Burn Rate", accessor: (r: any) => <span className="font-mono text-slate-600 dark:text-slate-400">{r.dailyConsumption}</span> },
                    { header: "Reorder Level", accessor: (r: any) => <span className="font-mono text-slate-500">{r.reorderLevel}</span> },
                    { header: "QA Batch Certificate", accessor: (r: any) => <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{r.batchCert}</span> },
                    { header: "Approved Supplier", accessor: (r: any) => <span className="text-slate-600 dark:text-slate-400">{r.supplier}</span> },
                    { 
                      header: "Status", 
                      accessor: (r: any) => (
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {r.status}
                        </span>
                      ) 
                    },
                    {
                      header: "Actions",
                      accessor: (r: any) => (
                        <ResourceRowActions
                          onView={() => openModal("material_inventory", "view", r)}
                          onEdit={() => openModal("material_inventory", "edit", r)}
                          onDelete={() => openModal("material_inventory", "delete", r)}
                          canEdit={canMaterialsEdit}
                          canDelete={canMaterialsDelete}
                        />
                      )
                    }
                  ]}
                  data={materialsData}
                />
              </Panel>
            )}

            {/* SUB-VIEW 2: Daily Consumption */}
            {materialsSub === "consumption" && (
              <Panel
                title="Material Consumption & Workface Issue Vouchers"
                subtitle="Issued raw materials, aggregates, binders, and steel quantities distributed to active workfaces"
                actions={renderAddButton("material_consumption", "+ Add Consumption Voucher", canMaterialsCreate)}
              >
                <DataTable
                  columns={[
                    { header: "Issue Ref", accessor: (r: any) => <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{r.issueRef}</span> },
                    { header: "Material Description", accessor: (r: any) => <strong className="text-slate-900 dark:text-white">{r.materialName}</strong> },
                    { header: "Quantity Issued", accessor: (r: any) => <span className="font-mono font-bold text-slate-900 dark:text-white">{r.quantityIssued} {r.unit}</span> },
                    { header: "Workface Section", accessor: (r: any) => <span className="text-slate-700 dark:text-slate-300 font-medium">{r.workface}</span> },
                    { header: "Date Issued", accessor: (r: any) => <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{r.issueDate}</span> },
                    { header: "Issued To (Foreman)", accessor: (r: any) => <span className="text-slate-600 dark:text-slate-400">{r.issuedTo || "—"}</span> },
                    { header: "Approved By", accessor: (r: any) => <span className="text-xs text-slate-500">{r.approvedBy || "—"}</span> },
                    {
                      header: "Actions",
                      accessor: (r: any) => (
                        <ResourceRowActions
                          onView={() => openModal("material_consumption", "view", r)}
                          onEdit={() => openModal("material_consumption", "edit", r)}
                          onDelete={() => openModal("material_consumption", "delete", r)}
                          canEdit={canMaterialsEdit}
                          canDelete={canMaterialsDelete}
                        />
                      )
                    }
                  ]}
                  data={materialConsumptionData}
                />
              </Panel>
            )}

            {/* SUB-VIEW 3: Supplier Deliveries */}
            {materialsSub === "deliveries" && (
              <Panel
                title="Supplier Deliveries & Goods Received Notes (GRN)"
                subtitle="Inbound materials receipt, QA batch inspection, weighbridge tickets, and delivery acceptance"
                actions={renderAddButton("material_delivery", "+ Add Delivery Record", canMaterialsCreate)}
              >
                <DataTable
                  columns={[
                    { header: "GRN Reference", accessor: (r: any) => <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{r.deliveryRef}</span> },
                    { header: "Material Description", accessor: (r: any) => <strong className="text-slate-900 dark:text-white">{r.materialName}</strong> },
                    { header: "Quantity Received", accessor: (r: any) => <span className="font-mono font-bold text-slate-900 dark:text-white">{r.quantityReceived} {r.unit}</span> },
                    { header: "Supplier", accessor: (r: any) => <span className="text-slate-700 dark:text-slate-300 font-medium">{r.supplier}</span> },
                    { header: "Delivery Date", accessor: (r: any) => <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{r.deliveryDate}</span> },
                    { header: "QA Batch Cert", accessor: (r: any) => <span className="font-mono text-xs text-emerald-600 font-semibold">{r.batchCert || "—"}</span> },
                    { 
                      header: "Status", 
                      accessor: (r: any) => (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {r.status}
                        </span>
                      ) 
                    },
                    {
                      header: "Actions",
                      accessor: (r: any) => (
                        <ResourceRowActions
                          onView={() => openModal("material_delivery", "view", r)}
                          onEdit={() => openModal("material_delivery", "edit", r)}
                          onDelete={() => openModal("material_delivery", "delete", r)}
                          canEdit={canMaterialsEdit}
                          canDelete={canMaterialsDelete}
                        />
                      )
                    }
                  ]}
                  data={materialDeliveriesData}
                />
              </Panel>
            )}

          </div>
        )}

        {/* DOMAIN 4: LOGISTICS */}
        {activeDomainTab === "logistics" && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* Logistics Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label="Active Consignments"
                value={logisticsData.length > 0 ? `${logisticsData.length} Trips` : "-"}
                subValue={logisticsData.length > 0 ? `${logisticsData.filter((l: any) => l.status === "In Transit").length} In Transit, ${logisticsData.filter((l: any) => l.status !== "In Transit").length} Delivered` : "-"}
                icon={Navigation}
              />
              <MetricCard
                label="Active Transits"
                value={logisticsData.length > 0 ? `${logisticsData.filter((l: any) => l.status === "In Transit").length} En Route` : "-"}
                subValue={logisticsData.length > 0 ? "Fleet tracking live" : "-"}
                icon={Truck}
              />
              <MetricCard
                label="Dispatches Logged"
                value={logisticsDispatchData.length > 0 ? `${logisticsDispatchData.length} Dispatches` : "-"}
                subValue={logisticsDispatchData.length > 0 ? "Consignments scheduled" : "-"}
                icon={Send}
                intent={logisticsDispatchData.length > 0 ? "good" : "neutral"}
              />
              <MetricCard
                label="Checkpoint Records"
                value={logisticsMovementData.length > 0 ? `${logisticsMovementData.length} Logged` : "-"}
                subValue={logisticsMovementData.length > 0 ? "Waybill scan checkpoints" : "-"}
                icon={Clock}
                intent="neutral"
              />
            </div>

            {/* Logistics Sub-Navigation */}
            <div className="bg-[#F7F8FA] dark:bg-slate-900/60 p-1.5 border border-[#E6E9EF] dark:border-slate-800 rounded-xl flex items-center justify-between gap-2 overflow-x-auto">
              <div className="flex items-center gap-1 min-w-max">
                {[
                  { id: "transport", label: "Transport & Fleet Trips", icon: Truck },
                  { id: "dispatch", label: "Dispatch & Consignments", icon: Send },
                  { id: "movement", label: "Movement & Tracking", icon: MapPin },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSubTabChange(item.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                      logisticsSub === item.id
                        ? "bg-white dark:bg-[#0B172A] text-[#172033] dark:text-white shadow-2xs font-bold border border-[#E6E9EF] dark:border-slate-700"
                        : "text-[#667085] dark:text-slate-400 hover:text-[#172033] dark:hover:text-white"
                    }`}
                  >
                    <item.icon className="w-3.5 h-3.5 text-amber-500" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* SUB-VIEW 1: Logistics Transport */}
            {logisticsSub === "transport" && (
              <Panel
                title="Site Freight Transport & Consignment Tracking"
                subtitle="Real-time freight dispatches, haulier waybills, transit ETAs, and site gate receipts"
                actions={renderAddButton("logistics_transport", "+ Add Transport / Trip", canLogisticsCreate)}
              >
                <DataTable
                  columns={[
                    { header: "Consignment Ref", accessor: (r: any) => <strong className="text-blue-600 dark:text-blue-400 font-mono text-xs">{r.consignment}</strong> },
                    { header: "Origin Point", accessor: (r: any) => <span className="text-slate-600 dark:text-slate-400">{r.origin}</span> },
                    { header: "Site Delivery Point", accessor: (r: any) => <span className="text-slate-800 dark:text-slate-200 font-semibold">{r.destination}</span> },
                    { header: "Haul Vehicle & Driver", accessor: (r: any) => <div><div className="font-semibold text-slate-800 dark:text-slate-200 text-xs">{r.driver}</div><div className="text-[11px] text-slate-500 font-mono">{r.vehicle}</div></div> },
                    { header: "Load Tonnage", accessor: (r: any) => <span className="font-mono font-bold text-slate-900 dark:text-white">{r.loadWeight}</span> },
                    { header: "Departure / ETA", accessor: (r: any) => <div className="font-mono text-xs text-slate-600 dark:text-slate-400"><div>Dep: {r.departure}</div><div>ETA: {r.eta}</div></div> },
                    { 
                      header: "Status", 
                      accessor: (r: any) => (
                        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md border ${
                          r.status === "In Transit" ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-emerald-50 text-emerald-800 border-emerald-200"
                        }`}>
                          {r.status}
                        </span>
                      ) 
                    },
                    {
                      header: "Actions",
                      accessor: (r: any) => (
                        <ResourceRowActions
                          onView={() => openModal("logistics_transport", "view", r)}
                          onEdit={() => openModal("logistics_transport", "edit", r)}
                          onDelete={() => openModal("logistics_transport", "delete", r)}
                          canEdit={canLogisticsEdit}
                          canDelete={canLogisticsDelete}
                        />
                      )
                    }
                  ]}
                  data={logisticsData}
                />
              </Panel>
            )}

            {/* SUB-VIEW 2: Logistics Dispatch */}
            {logisticsSub === "dispatch" && (
              <Panel
                title="Consignment Dispatch Register"
                subtitle="Scheduled shipments, dispatch origins, and vehicle assignment"
                actions={renderAddButton("logistics_dispatch", "+ Add Dispatch Record", canLogisticsCreate)}
              >
                <DataTable
                  columns={[
                    { header: "Dispatch Ref", accessor: (r: any) => <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{r.dispatchRef}</span> },
                    { header: "Transporter", accessor: (r: any) => <strong className="text-slate-900 dark:text-white">{r.transporter || "—"}</strong> },
                    { header: "Origin", accessor: (r: any) => <span className="text-slate-600 dark:text-slate-400">{r.origin}</span> },
                    { header: "Destination", accessor: (r: any) => <span className="text-slate-800 dark:text-slate-200 font-semibold">{r.destination}</span> },
                    { header: "Load Details", accessor: (r: any) => <span className="text-slate-700 dark:text-slate-300 font-medium">{r.loadWeight}</span> },
                    { header: "Driver", accessor: (r: any) => <span className="text-slate-600 dark:text-slate-400">{r.driver || "—"}</span> },
                    { header: "Departure Date", accessor: (r: any) => <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{r.departureDate}</span> },
                    { 
                      header: "Status", 
                      accessor: (r: any) => (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200">
                          {r.status}
                        </span>
                      ) 
                    },
                    {
                      header: "Actions",
                      accessor: (r: any) => (
                        <ResourceRowActions
                          onView={() => openModal("logistics_dispatch", "view", r)}
                          onEdit={() => openModal("logistics_dispatch", "edit", r)}
                          onDelete={() => openModal("logistics_dispatch", "delete", r)}
                          canEdit={canLogisticsEdit}
                          canDelete={canLogisticsDelete}
                        />
                      )
                    }
                  ]}
                  data={logisticsDispatchData}
                />
              </Panel>
            )}

            {/* SUB-VIEW 3: Logistics Movement */}
            {logisticsSub === "movement" && (
              <Panel
                title="Consignment Tracking & Checkpoint Scans"
                subtitle="Live checkpoint timestamps, weighbridge scale entries, and site gate logging"
                actions={renderAddButton("logistics_movement", "+ Add Checkpoint Scan", canLogisticsCreate)}
              >
                <DataTable
                  columns={[
                    { header: "Tracking Ref", accessor: (r: any) => <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{r.trackingRef}</span> },
                    { header: "Waybill Ref", accessor: (r: any) => <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{r.waybillRef || "—"}</span> },
                    { header: "Checkpoint", accessor: (r: any) => <strong className="text-slate-900 dark:text-white">{r.checkpoint}</strong> },
                    { header: "Time Logged", accessor: (r: any) => <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{r.timestamp}</span> },
                    { header: "Driver", accessor: (r: any) => <span className="text-slate-600 dark:text-slate-400">{r.driver || "—"}</span> },
                    { header: "Vehicle Reg", accessor: (r: any) => <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{r.vehicleReg || "—"}</span> },
                    { 
                      header: "Status", 
                      accessor: (r: any) => (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {r.status}
                        </span>
                      ) 
                    },
                    {
                      header: "Actions",
                      accessor: (r: any) => (
                        <ResourceRowActions
                          onView={() => openModal("logistics_movement", "view", r)}
                          onEdit={() => openModal("logistics_movement", "edit", r)}
                          onDelete={() => openModal("logistics_movement", "delete", r)}
                          canEdit={canLogisticsEdit}
                          canDelete={canLogisticsDelete}
                        />
                      )
                    }
                  ]}
                  data={logisticsMovementData}
                />
              </Panel>
            )}

          </div>
        )}

      </div>

      {/* MODALS */}
      {modalState && (
        <>
          {/* Add / Edit Modal */}
          {(modalState.mode === "add" || modalState.mode === "edit") && (
            <ResourceFormModal
              isOpen={true}
              onClose={() => setModalState(null)}
              onSave={handleSaveRecord}
              initialData={modalState.mode === "edit" ? modalState.data : undefined}
              type={modalState.type}
              projectId={activeProject?.id || ""}
            />
          )}

          {/* View Details Modal */}
          {modalState.mode === "view" && (
            <ResourceDetailModal
              isOpen={true}
              onClose={() => setModalState(null)}
              record={modalState.data}
              type={modalState.type}
              onEdit={() => setModalState({ type: modalState.type, mode: "edit", data: modalState.data })}
              canEdit={
                modalState.type.startsWith("workforce") ? canWorkforceEdit :
                modalState.type.startsWith("plant") ? canPlantEdit :
                modalState.type.startsWith("material") ? canMaterialsEdit :
                canLogisticsEdit
              }
            />
          )}

          {/* Delete Confirmation Modal */}
          {modalState.mode === "delete" && (
            <ResourceDeleteModal
              isOpen={true}
              onClose={() => setModalState(null)}
              onConfirm={handleDeleteRecord}
              title={`Delete ${modalState.type.replace(/_/g, " ")} Record`}
              itemName={
                modalState.data?.name || 
                modalState.data?.person || 
                modalState.data?.worker || 
                modalState.data?.tag || 
                modalState.data?.code || 
                modalState.data?.deliveryRef || 
                modalState.data?.issueRef || 
                modalState.data?.consignment || 
                modalState.data?.dispatchRef || 
                modalState.data?.trackingRef || 
                modalState.data?.id
              }
              itemType={modalState.type.replace(/_/g, " ")}
            />
          )}
        </>
      )}

    </ProjectShell>
  );
}
