import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { 
  ShieldCheck, 
  CheckSquare, 
  HardHat, 
  Leaf, 
  ClipboardCheck, 
  AlertTriangle, 
  Plus, 
  Calendar, 
  CheckCircle2, 
  FileText, 
  Activity, 
  Users, 
  Scale, 
  Layers, 
  Search, 
  AlertCircle, 
  Clock, 
  FileSpreadsheet, 
  Flame, 
  Download, 
  Check, 
  ExternalLink,
  ChevronRight,
  Sparkles,
  BookOpen,
  Eye,
  Edit,
  Trash2,
  Trees
} from "lucide-react";
import ProjectShell from "../../components/layout/ProjectShell";
import { MetricCard } from "../../components/ui/MetricCard";
import { DataTable } from "../../components/ui/DataTable";
import { Panel } from "../../components/ui/Panel";
import QualityPage from "../Quality/QualityPage";
import { CrudAdapter } from "../../services/crudAdapter";
import { QualityControlStorage } from "../../utils/qualityControlStorage";
import { QualityControlRecord } from "../../types/qualityControl";
import {
  ITPItem,
  NCRItem,
  TestResultItem,
  SafetyIncidentItem,
  ToolboxTalkItem,
  PermitToWorkItem,
  EnvironmentalItem,
  AuditItem,
} from "../../types/hseq";
import { exportObjectsToCsv, exportRowsToCsv, CsvColumn } from "../../utils/csvExport";

import ITPModal from "../../components/hseq/ITPModal";
import NCRModal from "../../components/hseq/NCRModal";
import TestResultModal from "../../components/hseq/TestResultModal";
import SafetyIncidentModal from "../../components/hseq/SafetyIncidentModal";
import ToolboxTalkModal from "../../components/hseq/ToolboxTalkModal";
import PermitToWorkModal from "../../components/hseq/PermitToWorkModal";
import EnvironmentalModal from "../../components/hseq/EnvironmentalModal";
import AuditModal from "../../components/hseq/AuditModal";
import InspectionModal from "../../components/hseq/InspectionModal";
import HSEQDeleteConfirmModal from "../../components/hseq/HSEQDeleteConfirmModal";

export type HSEQMainTab = "overview" | "quality" | "safety" | "environment" | "audits";
export type QualitySubTab = "itps" | "inspections" | "ncrs" | "test-results";
export type SafetySubTab = "incidents" | "toolbox-talks" | "permits";

export default function HSEQHubPage() {
  const context = useOutletContext<any>() || {};
  const activeProject = context.activeProject;
  const activeCompany = context.activeCompany || activeProject?.company;
  const projectId = activeProject?.id || "proj-001";
  const companyId = activeCompany?.id || activeProject?.company_id || "comp-001";

  const [searchParams, setSearchParams] = useSearchParams();

  // Primary HSEQ Domain Tab: Overview | Quality | Safety | Environment | Audits
  const rawTab = searchParams.get("tab") || "overview";
  const [activeMainTab, setActiveMainTab] = useState<HSEQMainTab>(() => {
    if (rawTab === "quality" || rawTab === "safety" || rawTab === "environment" || rawTab === "audits") {
      return rawTab;
    }
    if (rawTab === "environmental") return "environment";
    return "overview";
  });

  // Secondary Sub-Tabs
  const rawSub = searchParams.get("sub");
  const [qualitySub, setQualitySub] = useState<QualitySubTab>(
    rawSub === "inspections" || rawSub === "ncrs" || rawSub === "test-results" ? rawSub : "itps"
  );
  const [safetySub, setSafetySub] = useState<SafetySubTab>(
    rawSub === "toolbox-talks" || rawSub === "permits" ? rawSub : "incidents"
  );

  // Synchronize Tab state with searchParams
  useEffect(() => {
    const qTab = searchParams.get("tab");
    const qSub = searchParams.get("sub");

    if (qTab === "overview" || qTab === "quality" || qTab === "safety" || qTab === "environment" || qTab === "audits") {
      setActiveMainTab(qTab);
    } else if (qTab === "environmental") {
      setActiveMainTab("environment");
    }

    if (qSub) {
      if (activeMainTab === "quality" && (qSub === "itps" || qSub === "inspections" || qSub === "ncrs" || qSub === "test-results")) {
        setQualitySub(qSub);
      }
      if (activeMainTab === "safety" && (qSub === "incidents" || qSub === "toolbox-talks" || qSub === "permits")) {
        setSafetySub(qSub);
      }
    }
  }, [searchParams, activeMainTab]);

  const handleMainTabChange = (tab: HSEQMainTab) => {
    setActiveMainTab(tab);
    let defaultSub = "";
    if (tab === "quality") defaultSub = "itps";
    if (tab === "safety") defaultSub = "incidents";
    setSearchParams(defaultSub ? { tab, sub: defaultSub } : { tab });
  };

  const handleSubTabChange = (sub: string) => {
    if (activeMainTab === "quality") setQualitySub(sub as QualitySubTab);
    if (activeMainTab === "safety") setSafetySub(sub as SafetySubTab);
    setSearchParams({ tab: activeMainTab, sub });
  };

  // --- STATE REGISTERS ---
  const [itpData, setItpData] = useState<ITPItem[]>([]);
  const [ncrData, setNcrData] = useState<NCRItem[]>([]);
  const [testResultsData, setTestResultsData] = useState<TestResultItem[]>([]);
  const [safetyIncidentsData, setSafetyIncidentsData] = useState<SafetyIncidentItem[]>([]);
  const [toolboxTalksData, setToolboxTalksData] = useState<ToolboxTalkItem[]>([]);
  const [permitsData, setPermitsData] = useState<PermitToWorkItem[]>([]);
  const [environmentalData, setEnvironmentalData] = useState<EnvironmentalItem[]>([]);
  const [auditsData, setAuditsData] = useState<AuditItem[]>([]);
  const [inspectionsCount, setInspectionsCount] = useState<number>(0);
  const [qcRecordsData, setQcRecordsData] = useState<QualityControlRecord[]>([]);

  // --- LOAD DATA FROM DUAL PERSISTENCE ADAPTER ---
  const loadAllRegisters = useCallback(async () => {
    if (!projectId) return;

    try {
      // 1. ITPs
      const itps = await CrudAdapter.getRecords<ITPItem>({
        tableName: "hseq_itp",
        companyId,
        projectId,
        storageKey: `pm_hseq_itp_${projectId}`,
      });
      setItpData(itps);

      // 2. NCRs
      const ncrs = await CrudAdapter.getRecords<NCRItem>({
        tableName: "hseq_ncr",
        companyId,
        projectId,
        storageKey: `pm_hseq_ncr_${projectId}`,
      });
      setNcrData(ncrs);

      // 3. Test Results
      const tests = await CrudAdapter.getRecords<TestResultItem>({
        tableName: "hseq_tests",
        companyId,
        projectId,
        storageKey: `pm_hseq_tests_${projectId}`,
      });
      setTestResultsData(tests);

      // 4. Safety Incidents
      const incidents = await CrudAdapter.getRecords<SafetyIncidentItem>({
        tableName: "hseq_safety",
        companyId,
        projectId,
        storageKey: `pm_hseq_safety_${projectId}`,
      });
      setSafetyIncidentsData(incidents);

      // 5. Toolbox Talks
      const talks = await CrudAdapter.getRecords<ToolboxTalkItem>({
        tableName: "hseq_toolbox",
        companyId,
        projectId,
        storageKey: `pm_hseq_toolbox_${projectId}`,
      });
      setToolboxTalksData(talks);

      // 6. Permits
      const permits = await CrudAdapter.getRecords<PermitToWorkItem>({
        tableName: "hseq_permits",
        companyId,
        projectId,
        storageKey: `pm_hseq_permits_${projectId}`,
      });
      setPermitsData(permits);

      // 7. Environmental
      const env = await CrudAdapter.getRecords<EnvironmentalItem>({
        tableName: "hseq_env",
        companyId,
        projectId,
        storageKey: `pm_hseq_env_${projectId}`,
      });
      setEnvironmentalData(env);

      // 8. Audits
      const audits = await CrudAdapter.getRecords<AuditItem>({
        tableName: "hseq_audits",
        companyId,
        projectId,
        storageKey: `pm_hseq_audits_${projectId}`,
      });
      setAuditsData(audits);

      // 9. Inspection QC Records Count
      const qcRecords = await QualityControlStorage.getRecords(projectId);
      setInspectionsCount(qcRecords.length);
      setQcRecordsData(qcRecords);
    } catch (e) {
      console.warn("Error loading HSEQ registers:", e);
    }
  }, [projectId, companyId]);

  useEffect(() => {
    loadAllRegisters();
  }, [loadAllRegisters]);

  // --- MODAL STATES ---
  // ITP Modal
  const [itpModal, setItpModal] = useState<{ isOpen: boolean; mode: "create" | "edit" | "view"; data: ITPItem | null }>({
    isOpen: false,
    mode: "create",
    data: null,
  });

  // NCR Modal
  const [ncrModal, setNcrModal] = useState<{ isOpen: boolean; mode: "create" | "edit" | "view"; data: NCRItem | null }>({
    isOpen: false,
    mode: "create",
    data: null,
  });

  // Test Result Modal
  const [testModal, setTestModal] = useState<{ isOpen: boolean; mode: "create" | "edit" | "view"; data: TestResultItem | null }>({
    isOpen: false,
    mode: "create",
    data: null,
  });

  // Safety Incident Modal
  const [incidentModal, setIncidentModal] = useState<{ isOpen: boolean; mode: "create" | "edit" | "view"; data: SafetyIncidentItem | null }>({
    isOpen: false,
    mode: "create",
    data: null,
  });

  // Toolbox Talk Modal
  const [toolboxModal, setToolboxModal] = useState<{ isOpen: boolean; mode: "create" | "edit" | "view"; data: ToolboxTalkItem | null }>({
    isOpen: false,
    mode: "create",
    data: null,
  });

  // Permit To Work Modal
  const [permitModal, setPermitModal] = useState<{ isOpen: boolean; mode: "create" | "edit" | "view"; data: PermitToWorkItem | null }>({
    isOpen: false,
    mode: "create",
    data: null,
  });

  // Environmental Modal
  const [envModal, setEnvModal] = useState<{ isOpen: boolean; mode: "create" | "edit" | "view"; data: EnvironmentalItem | null }>({
    isOpen: false,
    mode: "create",
    data: null,
  });

  // Inspection Modal
  const [inspectionModal, setInspectionModal] = useState<{ isOpen: boolean; mode: "create" | "edit" | "view"; data: QualityControlRecord | null }>({
    isOpen: false,
    mode: "create",
    data: null,
  });

  // Audit Modal
  const [auditModal, setAuditModal] = useState<{ isOpen: boolean; mode: "create" | "edit" | "view"; data: AuditItem | null }>({
    isOpen: false,
    mode: "create",
    data: null,
  });

  // Generic Delete Confirmation Modal
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    title: string;
    itemRef?: string;
    itemName?: string;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: "Delete Record",
    onConfirm: async () => {},
  });

  // --- CRUD HANDLERS ---

  // 1. ITP Handlers
  const handleSaveITP = async (item: ITPItem) => {
    assertOperationalAction("write", "pages/HSEQ/HSEQHubPage.tsx");
    const payload = { ...item, company_id: companyId, project_id: projectId };
    const saved = await CrudAdapter.saveRecord<ITPItem>(
      { tableName: "hseq_itp", companyId, projectId, storageKey: `pm_hseq_itp_${projectId}` },
      payload
    );
    setItpData((prev) => {
      const idx = prev.findIndex((i) => i.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setItpModal({ isOpen: false, mode: "create", data: null });
  };

  const handleDeleteITP = (item: ITPItem) => {
    assertOperationalAction("delete", "pages/HSEQ/HSEQHubPage.tsx");
    setDeleteConfirm({
      isOpen: true,
      title: "Delete Inspection & Test Plan",
      itemRef: item.id,
      itemName: item.title,
      onConfirm: async () => {
        await CrudAdapter.deleteRecord(
          { tableName: "hseq_itp", companyId, projectId, storageKey: `pm_hseq_itp_${projectId}` },
          item.id
        );
        setItpData((prev) => prev.filter((i) => i.id !== item.id));
        setDeleteConfirm((d) => ({ ...d, isOpen: false }));
      },
    });
  };

  // 2. NCR Handlers
  const handleSaveNCR = async (item: NCRItem) => {
    assertOperationalAction("write", "pages/HSEQ/HSEQHubPage.tsx");
    const payload = { ...item, company_id: companyId, project_id: projectId };
    const saved = await CrudAdapter.saveRecord<NCRItem>(
      { tableName: "hseq_ncr", companyId, projectId, storageKey: `pm_hseq_ncr_${projectId}` },
      payload
    );
    setNcrData((prev) => {
      const idx = prev.findIndex((i) => i.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setNcrModal({ isOpen: false, mode: "create", data: null });
  };

  const handleDeleteNCR = (item: NCRItem) => {
    assertOperationalAction("delete", "pages/HSEQ/HSEQHubPage.tsx");
    setDeleteConfirm({
      isOpen: true,
      title: "Delete Non-Conformance Report",
      itemRef: item.id,
      itemName: item.title,
      onConfirm: async () => {
        await CrudAdapter.deleteRecord(
          { tableName: "hseq_ncr", companyId, projectId, storageKey: `pm_hseq_ncr_${projectId}` },
          item.id
        );
        setNcrData((prev) => prev.filter((i) => i.id !== item.id));
        setDeleteConfirm((d) => ({ ...d, isOpen: false }));
      },
    });
  };

  // 3. Test Results Handlers
  const handleSaveTestResult = async (item: TestResultItem) => {
    assertOperationalAction("write", "pages/HSEQ/HSEQHubPage.tsx");
    const payload = { ...item, company_id: companyId, project_id: projectId };
    const saved = await CrudAdapter.saveRecord<TestResultItem>(
      { tableName: "hseq_tests", companyId, projectId, storageKey: `pm_hseq_tests_${projectId}` },
      payload
    );
    setTestResultsData((prev) => {
      const idx = prev.findIndex((i) => i.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setTestModal({ isOpen: false, mode: "create", data: null });
  };

  const handleDeleteTestResult = (item: TestResultItem) => {
    assertOperationalAction("delete", "pages/HSEQ/HSEQHubPage.tsx");
    setDeleteConfirm({
      isOpen: true,
      title: "Delete Material Test Result",
      itemRef: item.id,
      itemName: item.testType,
      onConfirm: async () => {
        await CrudAdapter.deleteRecord(
          { tableName: "hseq_tests", companyId, projectId, storageKey: `pm_hseq_tests_${projectId}` },
          item.id
        );
        setTestResultsData((prev) => prev.filter((i) => i.id !== item.id));
        setDeleteConfirm((d) => ({ ...d, isOpen: false }));
      },
    });
  };

  // 4. Safety Incidents Handlers
  const handleSaveSafetyIncident = async (item: SafetyIncidentItem) => {
    assertOperationalAction("write", "pages/HSEQ/HSEQHubPage.tsx");
    const payload = { ...item, company_id: companyId, project_id: projectId };
    const saved = await CrudAdapter.saveRecord<SafetyIncidentItem>(
      { tableName: "hseq_safety", companyId, projectId, storageKey: `pm_hseq_safety_${projectId}` },
      payload
    );
    setSafetyIncidentsData((prev) => {
      const idx = prev.findIndex((i) => i.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setIncidentModal({ isOpen: false, mode: "create", data: null });
  };

  const handleDeleteSafetyIncident = (item: SafetyIncidentItem) => {
    assertOperationalAction("delete", "pages/HSEQ/HSEQHubPage.tsx");
    setDeleteConfirm({
      isOpen: true,
      title: "Delete Safety Incident Record",
      itemRef: item.id,
      itemName: item.description,
      onConfirm: async () => {
        await CrudAdapter.deleteRecord(
          { tableName: "hseq_safety", companyId, projectId, storageKey: `pm_hseq_safety_${projectId}` },
          item.id
        );
        setSafetyIncidentsData((prev) => prev.filter((i) => i.id !== item.id));
        setDeleteConfirm((d) => ({ ...d, isOpen: false }));
      },
    });
  };

  // 5. Toolbox Talks Handlers
  const handleSaveToolboxTalk = async (item: ToolboxTalkItem) => {
    assertOperationalAction("write", "pages/HSEQ/HSEQHubPage.tsx");
    const payload = { ...item, company_id: companyId, project_id: projectId };
    const saved = await CrudAdapter.saveRecord<ToolboxTalkItem>(
      { tableName: "hseq_toolbox", companyId, projectId, storageKey: `pm_hseq_toolbox_${projectId}` },
      payload
    );
    setToolboxTalksData((prev) => {
      const idx = prev.findIndex((i) => i.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setToolboxModal({ isOpen: false, mode: "create", data: null });
  };

  const handleDeleteToolboxTalk = (item: ToolboxTalkItem) => {
    assertOperationalAction("delete", "pages/HSEQ/HSEQHubPage.tsx");
    setDeleteConfirm({
      isOpen: true,
      title: "Delete Toolbox Talk Record",
      itemRef: item.id,
      itemName: item.topic,
      onConfirm: async () => {
        await CrudAdapter.deleteRecord(
          { tableName: "hseq_toolbox", companyId, projectId, storageKey: `pm_hseq_toolbox_${projectId}` },
          item.id
        );
        setToolboxTalksData((prev) => prev.filter((i) => i.id !== item.id));
        setDeleteConfirm((d) => ({ ...d, isOpen: false }));
      },
    });
  };

  // 6. Permits Handlers
  const handleSavePermit = async (item: PermitToWorkItem) => {
    assertOperationalAction("write", "pages/HSEQ/HSEQHubPage.tsx");
    const payload = { ...item, company_id: companyId, project_id: projectId };
    const saved = await CrudAdapter.saveRecord<PermitToWorkItem>(
      { tableName: "hseq_permits", companyId, projectId, storageKey: `pm_hseq_permits_${projectId}` },
      payload
    );
    setPermitsData((prev) => {
      const idx = prev.findIndex((i) => i.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setPermitModal({ isOpen: false, mode: "create", data: null });
  };

  const handleDeletePermit = (item: PermitToWorkItem) => {
    assertOperationalAction("delete", "pages/HSEQ/HSEQHubPage.tsx");
    setDeleteConfirm({
      isOpen: true,
      title: "Delete Permit to Work",
      itemRef: item.id,
      itemName: item.type,
      onConfirm: async () => {
        await CrudAdapter.deleteRecord(
          { tableName: "hseq_permits", companyId, projectId, storageKey: `pm_hseq_permits_${projectId}` },
          item.id
        );
        setPermitsData((prev) => prev.filter((i) => i.id !== item.id));
        setDeleteConfirm((d) => ({ ...d, isOpen: false }));
      },
    });
  };

  // 7. Environmental Handlers
  const handleSaveEnvironmental = async (item: EnvironmentalItem) => {
    assertOperationalAction("write", "pages/HSEQ/HSEQHubPage.tsx");
    const payload = { ...item, company_id: companyId, project_id: projectId };
    const saved = await CrudAdapter.saveRecord<EnvironmentalItem>(
      { tableName: "hseq_env", companyId, projectId, storageKey: `pm_hseq_env_${projectId}` },
      payload
    );
    setEnvironmentalData((prev) => {
      const idx = prev.findIndex((i) => i.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setEnvModal({ isOpen: false, mode: "create", data: null });
  };

  const handleDeleteEnvironmental = (item: EnvironmentalItem) => {
    assertOperationalAction("delete", "pages/HSEQ/HSEQHubPage.tsx");
    setDeleteConfirm({
      isOpen: true,
      title: "Delete Environmental Record",
      itemRef: item.id,
      itemName: item.parameter,
      onConfirm: async () => {
        await CrudAdapter.deleteRecord(
          { tableName: "hseq_env", companyId, projectId, storageKey: `pm_hseq_env_${projectId}` },
          item.id
        );
        setEnvironmentalData((prev) => prev.filter((i) => i.id !== item.id));
        setDeleteConfirm((d) => ({ ...d, isOpen: false }));
      },
    });
  };

  // 8. Audit Handlers
  const handleSaveAudit = async (item: AuditItem) => {
    assertOperationalAction("write", "pages/HSEQ/HSEQHubPage.tsx");
    const payload = { ...item, company_id: companyId, project_id: projectId };
    const saved = await CrudAdapter.saveRecord<AuditItem>(
      { tableName: "hseq_audits", companyId, projectId, storageKey: `pm_hseq_audits_${projectId}` },
      payload
    );
    setAuditsData((prev) => {
      const idx = prev.findIndex((i) => i.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setAuditModal({ isOpen: false, mode: "create", data: null });
  };

  const handleDeleteAudit = (item: AuditItem) => {
    assertOperationalAction("delete", "pages/HSEQ/HSEQHubPage.tsx");
    setDeleteConfirm({
      isOpen: true,
      title: "Delete Governance Audit",
      itemRef: item.id,
      itemName: item.title,
      onConfirm: async () => {
        await CrudAdapter.deleteRecord(
          { tableName: "hseq_audits", companyId, projectId, storageKey: `pm_hseq_audits_${projectId}` },
          item.id
        );
        setAuditsData((prev) => prev.filter((i) => i.id !== item.id));
        setDeleteConfirm((d) => ({ ...d, isOpen: false }));
      },
    });
  };

  // 9. Inspection Handlers
  const handleSaveInspection = async (record: QualityControlRecord) => {
    assertOperationalAction("write", "pages/HSEQ/HSEQHubPage.tsx");
    await QualityControlStorage.saveRecord(record, projectId, context.profile?.id);
    await loadAllRegisters();
    setInspectionModal({ isOpen: false, mode: "create", data: null });
  };

  // --- DERIVED METRICS FOR OVERVIEW ---
  const ltiCount = useMemo(() => {
    return safetyIncidentsData.filter((i) => i.type === "Lost Time Injury (LTI)").length;
  }, [safetyIncidentsData]);

  const approvedItpsCount = useMemo(() => {
    return itpData.filter((i) => i.status && i.status.toLowerCase().includes("approved")).length;
  }, [itpData]);

  const compliantEnvCount = useMemo(() => {
    return environmentalData.filter((e) => e.compliance === "Compliant").length;
  }, [environmentalData]);

  const majorNcrCount = useMemo(() => {
    return ncrData.filter((n) => (n.severity === "Major" || n.severity === "Critical") && n.status !== "Closed" && n.status !== "Resolved & Closed").length;
  }, [ncrData]);

  // --- CSV EXPORT FUNCTIONS FOR EACH REGISTER & VIEW ---
  const exportItpsCsv = () => {
    assertOperationalAction("export", "pages/HSEQ/HSEQHubPage.tsx");
    const timestamp = new Date().toISOString().slice(0, 10);
    const prjCode = activeProject?.code || activeProject?.contract_code || "PRJ";
    const columns: CsvColumn<ITPItem>[] = [
      { key: "id", label: "ITP Reference" },
      { key: "title", label: "Scope of Work / Element" },
      { key: "specClause", label: "Specification Clause" },
      { key: "holdPoints", label: "Hold Points (HP)" },
      { key: "witnessPoints", label: "Witness Points (WP)" },
      { key: "leadAuditor", label: "Lead QA Sign-Off" },
      { key: "status", label: "Approval Status" },
      { key: "revision", label: "Revision", formatter: (v) => v || "Rev 0" },
      { key: "date", label: "Date Approved", formatter: (v) => v || "-" },
      { key: "notes", label: "Notes / Acceptance Criteria", formatter: (v) => v || "-" },
    ];
    exportObjectsToCsv(`HSEQ_ITP_Register_${prjCode}_${timestamp}`, columns, itpData);
  };

  const exportInspectionsCsv = () => {
    assertOperationalAction("export", "pages/HSEQ/HSEQHubPage.tsx");
    const timestamp = new Date().toISOString().slice(0, 10);
    const prjCode = activeProject?.code || activeProject?.contract_code || "PRJ";
    const columns: CsvColumn<QualityControlRecord>[] = [
      { key: "id", label: "Form ID" },
      { key: "formTitle", label: "Form Title" },
      { key: "projectName", label: "Project Name" },
      { key: "contractNumber", label: "Contract Number" },
      { key: "contractor", label: "Contractor" },
      { key: "location", label: "Location / Chainage" },
      { key: "item", label: "Work Item" },
      { key: "inspector", label: "Lead Inspector" },
      { key: "date", label: "Inspection Date" },
      { key: "status", label: "Status" },
    ];
    exportObjectsToCsv(`HSEQ_QC_Inspections_${prjCode}_${timestamp}`, columns, qcRecordsData);
  };

  const exportNcrsCsv = () => {
    assertOperationalAction("export", "pages/HSEQ/HSEQHubPage.tsx");
    const timestamp = new Date().toISOString().slice(0, 10);
    const prjCode = activeProject?.code || activeProject?.contract_code || "PRJ";
    const columns: CsvColumn<NCRItem>[] = [
      { key: "id", label: "NCR Reference" },
      { key: "title", label: "Deficiency Summary" },
      { key: "clause", label: "Specification Clause" },
      { key: "severity", label: "Severity" },
      { key: "dateRaised", label: "Date Raised" },
      { key: "raisedBy", label: "Raised By" },
      { key: "location", label: "Location / Chainage", formatter: (v) => v || "-" },
      { key: "rootCause", label: "Root Cause", formatter: (v) => v || "-" },
      { key: "correctiveAction", label: "Corrective Action (CAPA)" },
      { key: "targetDate", label: "Target Closure Date", formatter: (v) => v || "-" },
      { key: "status", label: "Closure Status" },
    ];
    exportObjectsToCsv(`HSEQ_NCR_Register_${prjCode}_${timestamp}`, columns, ncrData);
  };

  const exportTestResultsCsv = () => {
    assertOperationalAction("export", "pages/HSEQ/HSEQHubPage.tsx");
    const timestamp = new Date().toISOString().slice(0, 10);
    const prjCode = activeProject?.code || activeProject?.contract_code || "PRJ";
    const columns: CsvColumn<TestResultItem>[] = [
      { key: "id", label: "Test Reference" },
      { key: "testType", label: "Test Description" },
      { key: "sampleRef", label: "Sampled Element / Location" },
      { key: "requiredSpec", label: "Required Specification" },
      { key: "achievedResult", label: "Achieved Result" },
      { key: "resultStatus", label: "Compliance Status" },
      { key: "lab", label: "Testing Authority / Lab" },
      { key: "tester", label: "Technician / Engineer", formatter: (v) => v || "-" },
      { key: "testDate", label: "Test Date", formatter: (v) => v || "-" },
      { key: "remarks", label: "Remarks", formatter: (v) => v || "-" },
    ];
    exportObjectsToCsv(`HSEQ_Test_Results_${prjCode}_${timestamp}`, columns, testResultsData);
  };

  const exportSafetyIncidentsCsv = () => {
    assertOperationalAction("export", "pages/HSEQ/HSEQHubPage.tsx");
    const timestamp = new Date().toISOString().slice(0, 10);
    const prjCode = activeProject?.code || activeProject?.contract_code || "PRJ";
    const columns: CsvColumn<SafetyIncidentItem>[] = [
      { key: "id", label: "Incident ID" },
      { key: "date", label: "Date & Time" },
      { key: "type", label: "Incident Category" },
      { key: "severity", label: "Severity" },
      { key: "location", label: "Site Location" },
      { key: "description", label: "Incident Summary" },
      { key: "action", label: "Preventative / Immediate Action" },
      { key: "rootCause", label: "Root Cause", formatter: (v) => v || "-" },
      { key: "reportedBy", label: "Reported By", formatter: (v) => v || "-" },
      { key: "status", label: "Investigation Status" },
    ];
    exportObjectsToCsv(`HSEQ_Safety_Incidents_${prjCode}_${timestamp}`, columns, safetyIncidentsData);
  };

  const exportToolboxTalksCsv = () => {
    assertOperationalAction("export", "pages/HSEQ/HSEQHubPage.tsx");
    const timestamp = new Date().toISOString().slice(0, 10);
    const prjCode = activeProject?.code || activeProject?.contract_code || "PRJ";
    const columns: CsvColumn<ToolboxTalkItem>[] = [
      { key: "id", label: "Talk ID" },
      { key: "topic", label: "Briefing Topic" },
      { key: "category", label: "Hazard Category" },
      { key: "date", label: "Date Conducted" },
      { key: "presenter", label: "Supervisor / Presenter" },
      { key: "attendees", label: "Attendees Count" },
      { key: "status", label: "Sign-Off Status" },
      { key: "notes", label: "Discussion Notes", formatter: (v) => v || "-" },
    ];
    exportObjectsToCsv(`HSEQ_Toolbox_Talks_${prjCode}_${timestamp}`, columns, toolboxTalksData);
  };

  const exportPermitsCsv = () => {
    assertOperationalAction("export", "pages/HSEQ/HSEQHubPage.tsx");
    const timestamp = new Date().toISOString().slice(0, 10);
    const prjCode = activeProject?.code || activeProject?.contract_code || "PRJ";
    const columns: CsvColumn<PermitToWorkItem>[] = [
      { key: "id", label: "Permit Reference" },
      { key: "type", label: "Permit Type" },
      { key: "location", label: "Authorized Location" },
      { key: "issuedTo", label: "Issued To / Contractor" },
      { key: "validFrom", label: "Valid From" },
      { key: "validTo", label: "Valid To" },
      { key: "pic", label: "Person In Charge (PIC)" },
      { key: "status", label: "Permit Status" },
      { key: "precautions", label: "Mandatory Safety Precautions", formatter: (v) => v || "-" },
    ];
    exportObjectsToCsv(`HSEQ_Permits_To_Work_${prjCode}_${timestamp}`, columns, permitsData);
  };

  const exportEnvironmentalCsv = () => {
    assertOperationalAction("export", "pages/HSEQ/HSEQHubPage.tsx");
    const timestamp = new Date().toISOString().slice(0, 10);
    const prjCode = activeProject?.code || activeProject?.contract_code || "PRJ";
    const columns: CsvColumn<EnvironmentalItem>[] = [
      { key: "id", label: "Record Reference" },
      { key: "parameter", label: "Parameter Monitored" },
      { key: "location", label: "Sampling Workface" },
      { key: "reading", label: "Measured Reading vs Limit" },
      { key: "compliance", label: "Compliance Status" },
      { key: "frequency", label: "Mitigation / Frequency" },
      { key: "lastChecked", label: "Last Verified Date" },
      { key: "inspector", label: "Environmental Officer", formatter: (v) => v || "-" },
      { key: "notes", label: "Monitoring Observations", formatter: (v) => v || "-" },
    ];
    exportObjectsToCsv(`HSEQ_Environmental_Monitoring_${prjCode}_${timestamp}`, columns, environmentalData);
  };

  const exportAuditsCsv = () => {
    assertOperationalAction("export", "pages/HSEQ/HSEQHubPage.tsx");
    const timestamp = new Date().toISOString().slice(0, 10);
    const prjCode = activeProject?.code || activeProject?.contract_code || "PRJ";
    const columns: CsvColumn<AuditItem>[] = [
      { key: "id", label: "Audit Number" },
      { key: "title", label: "Audit Title" },
      { key: "standard", label: "Standard / Framework" },
      { key: "auditDate", label: "Audit Date" },
      { key: "auditor", label: "Lead Auditor" },
      { key: "findings", label: "Summary of Findings" },
      { key: "outcome", label: "Audit Outcome" },
      { key: "carCount", label: "CAR / Non-Conformance Count", formatter: (v) => v ?? 0 },
      { key: "scope", label: "Audit Scope / Area", formatter: (v) => v || "-" },
    ];
    exportObjectsToCsv(`HSEQ_Audit_Ledger_${prjCode}_${timestamp}`, columns, auditsData);
  };

  const exportOverviewCsv = () => {
    assertOperationalAction("export", "pages/HSEQ/HSEQHubPage.tsx");
    const timestamp = new Date().toISOString().slice(0, 10);
    const prjCode = activeProject?.code || activeProject?.contract_code || "PRJ";

    const headers = ["Domain / Pillar", "Metric / Register Ref", "Value / Detail", "Operational Notes"];
    const rows: (string | number)[][] = [
      ["HSEQ Governance", "Project Code", prjCode, "-"],
      ["HSEQ Governance", "Project Name", activeProject?.name || "HSEQ Project", "-"],
      ["HSEQ Governance", "Company / Organization", activeCompany?.name || "-", "-"],
      ["Safety Pillar", "Lost Time Injuries (LTI)", ltiCount, ltiCount === 0 ? "Target Zero Maintained" : "Active Safety Stand-Downs"],
      ["Safety Pillar", "Total Incidents & Near Misses", safetyIncidentsData.length, "Logged in Safety Register"],
      ["Safety Pillar", "Toolbox Talks Logged", toolboxTalksData.length, `${toolboxTalksData.reduce((acc, t) => acc + (t.attendees || 0), 0)} Total Attendees`],
      ["Safety Pillar", "Active Permits to Work", permitsData.filter(p => p.status?.includes("Active")).length, `${permitsData.length} Total Issued`],
      ["Quality Pillar", "Approved ITPs", `${approvedItpsCount} / ${itpData.length}`, itpData.length === 0 ? "No ITPs logged" : `${Math.round((approvedItpsCount / Math.max(1, itpData.length)) * 100)}% Pass Rate`],
      ["Quality Pillar", "Open Major/Critical NCRs", majorNcrCount, majorNcrCount === 0 ? "Compliant Quality Assurance" : "Urgent Resolution Required"],
      ["Quality Pillar", "Material & Field Tests", testResultsData.length, `${testResultsData.filter(t => t.resultStatus === "Compliant").length} Compliant Tests`],
      ["Quality Pillar", "QC Inspection Forms", qcRecordsData.length, "Signed Off Inspection Records"],
      ["Environmental Pillar", "Compliant Monitoring Logs", `${compliantEnvCount} / ${environmentalData.length}`, environmentalData.length === 0 ? "No logs" : `${Math.round((compliantEnvCount / Math.max(1, environmentalData.length)) * 100)}% Compliance`],
      ["Audits Pillar", "Conducted ISO Audits", auditsData.length, `${auditsData.filter(a => a.outcome?.includes("Passed")).length} Passed Audits`]
    ];

    if (safetyIncidentsData.length > 0) {
      safetyIncidentsData.forEach((inc) => {
        rows.push(["Safety Register Summary", inc.id, `${inc.type} (${inc.severity})`, `${inc.description} | Action: ${inc.action}`]);
      });
    }

    if (ncrData.length > 0) {
      ncrData.forEach((ncr) => {
        rows.push(["Quality NCR Summary", ncr.id, `${ncr.severity} - ${ncr.title}`, `Raised: ${ncr.dateRaised} | CAPA: ${ncr.correctiveAction} | Status: ${ncr.status}`]);
      });
    }

    exportRowsToCsv(`HSEQ_Governance_Executive_Summary_${prjCode}_${timestamp}`, headers, rows);
  };

  const getCurrentViewName = (): string => {
    switch (activeMainTab) {
      case "overview": return "Overview";
      case "quality":
        switch (qualitySub) {
          case "itps": return "ITPs";
          case "inspections": return "Inspections";
          case "ncrs": return "NCRs";
          case "test-results": return "Test Results";
        }
        return "Quality";
      case "safety":
        switch (safetySub) {
          case "incidents": return "Incidents";
          case "toolbox-talks": return "Toolbox Talks";
          case "permits": return "Permits";
        }
        return "Safety";
      case "environment": return "Environmental";
      case "audits": return "Audits";
      default: return "Current View";
    }
  };

  const handleExportCurrentViewCsv = () => {
    assertOperationalAction("export", "pages/HSEQ/HSEQHubPage.tsx");
    switch (activeMainTab) {
      case "overview":
        exportOverviewCsv();
        break;
      case "quality":
        if (qualitySub === "itps") exportItpsCsv();
        else if (qualitySub === "inspections") exportInspectionsCsv();
        else if (qualitySub === "ncrs") exportNcrsCsv();
        else if (qualitySub === "test-results") exportTestResultsCsv();
        break;
      case "safety":
        if (safetySub === "incidents") exportSafetyIncidentsCsv();
        else if (safetySub === "toolbox-talks") exportToolboxTalksCsv();
        else if (safetySub === "permits") exportPermitsCsv();
        break;
      case "environment":
        exportEnvironmentalCsv();
        break;
      case "audits":
        exportAuditsCsv();
        break;
    }
  };

  return (
    <ProjectShell 
      project={activeProject} 
      section="hseq"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCurrentViewCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold text-xs rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs transition-all cursor-pointer"
            title={`Export ${getCurrentViewName()} register data to CSV for reporting`}
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Export CSV ({getCurrentViewName()})</span>
          </button>
          {activeMainTab === "quality" && qualitySub === "itps" && (
            <button
              type="button"
              onClick={() => setItpModal({ isOpen: true, mode: "create", data: null })}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              title="Create new Inspection & Test Plan"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add ITP</span>
            </button>
          )}
          {activeMainTab === "quality" && qualitySub === "ncrs" && (
            <button
              type="button"
              onClick={() => setNcrModal({ isOpen: true, mode: "create", data: null })}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
              title="Add Non-Conformance Report & Corrective Action (CAPA)"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add NCR</span>
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-6 max-w-7xl mx-auto pb-12" id="hseq-unified-module">
        
        {/* Top Unified HSEQ Module Navigation: Overview | Quality | Safety | Environment | Audits */}
        <div className="bg-white dark:bg-[#0B172A] border border-[#E6E9EF] dark:border-slate-800 rounded-2xl p-2 shadow-xs">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
            
            {/* Overview */}
            <button
              onClick={() => handleMainTabChange("overview")}
              className={`px-3.5 py-3 rounded-xl text-left transition-all cursor-pointer flex items-center gap-3 ${
                activeMainTab === "overview"
                  ? "bg-[#0B172A] text-white shadow-xs dark:bg-white dark:text-[#0B172A]"
                  : "text-[#667085] dark:text-slate-400 hover:bg-[#F7F8FA] dark:hover:bg-slate-800/80 hover:text-[#172033] dark:hover:text-white"
              }`}
            >
              <div className={`p-2 rounded-lg shrink-0 ${activeMainTab === "overview" ? "bg-amber-500 text-white dark:bg-amber-500 dark:text-white" : "bg-[#F7F8FA] dark:bg-slate-800 text-[#667085]"}`}>
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold leading-tight">Overview</div>
                <div className={`text-[10px] truncate ${activeMainTab === "overview" ? "text-slate-300 dark:text-slate-600" : "text-[#667085]"}`}>
                  HSEQ Governance & Radar
                </div>
              </div>
            </button>

            {/* Quality */}
            <button
              onClick={() => handleMainTabChange("quality")}
              className={`px-3.5 py-3 rounded-xl text-left transition-all cursor-pointer flex items-center gap-3 ${
                activeMainTab === "quality"
                  ? "bg-[#0B172A] text-white shadow-xs dark:bg-white dark:text-[#0B172A]"
                  : "text-[#667085] dark:text-slate-400 hover:bg-[#F7F8FA] dark:hover:bg-slate-800/80 hover:text-[#172033] dark:hover:text-white"
              }`}
            >
              <div className={`p-2 rounded-lg shrink-0 ${activeMainTab === "quality" ? "bg-amber-500 text-white dark:bg-amber-500 dark:text-white" : "bg-[#F7F8FA] dark:bg-slate-800 text-[#667085]"}`}>
                <CheckSquare className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold leading-tight">Quality</div>
                <div className={`text-[10px] truncate ${activeMainTab === "quality" ? "text-slate-300 dark:text-slate-600" : "text-[#667085]"}`}>
                  ITPs · Inspections · NCRs · Tests
                </div>
              </div>
            </button>

            {/* Safety */}
            <button
              onClick={() => handleMainTabChange("safety")}
              className={`px-3.5 py-3 rounded-xl text-left transition-all cursor-pointer flex items-center gap-3 ${
                activeMainTab === "safety"
                  ? "bg-[#0B172A] text-white shadow-xs dark:bg-white dark:text-[#0B172A]"
                  : "text-[#667085] dark:text-slate-400 hover:bg-[#F7F8FA] dark:hover:bg-slate-800/80 hover:text-[#172033] dark:hover:text-white"
              }`}
            >
              <div className={`p-2 rounded-lg shrink-0 ${activeMainTab === "safety" ? "bg-amber-500 text-white dark:bg-amber-500 dark:text-white" : "bg-[#F7F8FA] dark:bg-slate-800 text-[#667085]"}`}>
                <HardHat className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold leading-tight">Safety</div>
                <div className={`text-[10px] truncate ${activeMainTab === "safety" ? "text-slate-300 dark:text-slate-600" : "text-[#667085]"}`}>
                  Incidents · Talks · Permits
                </div>
              </div>
            </button>

            {/* Environment */}
            <button
              onClick={() => handleMainTabChange("environment")}
              className={`px-3.5 py-3 rounded-xl text-left transition-all cursor-pointer flex items-center gap-3 ${
                activeMainTab === "environment"
                  ? "bg-[#0B172A] text-white shadow-xs dark:bg-white dark:text-[#0B172A]"
                  : "text-[#667085] dark:text-slate-400 hover:bg-[#F7F8FA] dark:hover:bg-slate-800/80 hover:text-[#172033] dark:hover:text-white"
              }`}
            >
              <div className={`p-2 rounded-lg shrink-0 ${activeMainTab === "environment" ? "bg-amber-500 text-white dark:bg-amber-500 dark:text-white" : "bg-[#F7F8FA] dark:bg-slate-800 text-[#667085]"}`}>
                <Leaf className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold leading-tight">Environment</div>
                <div className={`text-[10px] truncate ${activeMainTab === "environment" ? "text-slate-300 dark:text-slate-600" : "text-[#667085]"}`}>
                  EIA · Dust · Noise · Turbidity
                </div>
              </div>
            </button>

            {/* Audits */}
            <button
              onClick={() => handleMainTabChange("audits")}
              className={`px-3.5 py-3 rounded-xl text-left transition-all cursor-pointer flex items-center gap-3 ${
                activeMainTab === "audits"
                  ? "bg-[#0B172A] text-white shadow-xs dark:bg-white dark:text-[#0B172A]"
                  : "text-[#667085] dark:text-slate-400 hover:bg-[#F7F8FA] dark:hover:bg-slate-800/80 hover:text-[#172033] dark:hover:text-white"
              }`}
            >
              <div className={`p-2 rounded-lg shrink-0 ${activeMainTab === "audits" ? "bg-amber-500 text-white dark:bg-amber-500 dark:text-white" : "bg-[#F7F8FA] dark:bg-slate-800 text-[#667085]"}`}>
                <Scale className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold leading-tight">Audits</div>
                <div className={`text-[10px] truncate ${activeMainTab === "audits" ? "text-slate-300 dark:text-slate-600" : "text-[#667085]"}`}>
                  ISO 9001 · 14001 · 45001
                </div>
              </div>
            </button>

          </div>
        </div>

        {/* 1. OVERVIEW VIEW */}
        {activeMainTab === "overview" && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* Top 4 KPI Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label="LTI Safe Work Status"
                value={safetyIncidentsData.length > 0 ? (ltiCount === 0 ? "Zero LTIs" : `${ltiCount} LTI Logged`) : "-"}
                subValue={safetyIncidentsData.length > 0 ? `${safetyIncidentsData.length} total events logged` : "No incidents logged"}
                icon={HardHat}
                intent={safetyIncidentsData.length > 0 ? (ltiCount === 0 ? "good" : "bad") : "neutral"}
              />
              <MetricCard
                label="Quality ITP Pass Rate"
                value={itpData.length > 0 ? `${approvedItpsCount}/${itpData.length} Approved` : "-"}
                subValue={itpData.length > 0 ? `${inspectionsCount} QC sign-offs executed` : "No ITPs registered"}
                icon={CheckSquare}
                intent={itpData.length > 0 ? "good" : "neutral"}
              />
              <MetricCard
                label="Environmental Index"
                value={environmentalData.length > 0 ? `${compliantEnvCount}/${environmentalData.length} Compliant` : "-"}
                subValue={environmentalData.length > 0 ? "EIA continuous monitoring" : "No monitoring logged"}
                icon={Leaf}
                intent={environmentalData.length > 0 ? "good" : "neutral"}
              />
              <MetricCard
                label="Active Major NCRs"
                value={ncrData.length > 0 ? `${majorNcrCount} Major` : "-"}
                subValue={ncrData.length > 0 ? `${ncrData.length} total logged` : "No NCRs logged"}
                icon={ShieldCheck}
                intent={majorNcrCount === 0 ? "good" : "bad"}
              />
            </div>

            {/* HSEQ Summary Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Quality & Safety Radar */}
              <div className="lg:col-span-2 space-y-6">
                <Panel
                  title="Integrated HSEQ Compliance Status"
                  subtitle="Unified quality assurance, site safety controls, environmental monitoring, and audit readiness"
                >
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl border border-[#E6E9EF] dark:border-slate-800 bg-[#F7F8FA] dark:bg-slate-900/40 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                          <CheckSquare className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white">Quality Assurance & ITPs</div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                            {itpData.length > 0 
                              ? `${itpData.length} active ITPs registered, ${testResultsData.length} lab tests recorded, and ${ncrData.length} NCRs tracked.` 
                              : "No ITP quality plans recorded for this project."}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                        {itpData.length > 0 ? `${itpData.length} Registered` : "-"}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl border border-[#E6E9EF] dark:border-slate-800 bg-[#F7F8FA] dark:bg-slate-900/40 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                          <HardHat className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white">Occupational Health & Site Safety</div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                            {safetyIncidentsData.length > 0 || toolboxTalksData.length > 0 || permitsData.length > 0
                              ? `${toolboxTalksData.length} toolbox talks conducted, ${permitsData.length} permits issued, ${safetyIncidentsData.length} incidents logged.`
                              : "No safety incidents or permits recorded for this project."}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                        {safetyIncidentsData.length > 0 ? `${safetyIncidentsData.length} Logged` : "-"}
                      </span>
                    </div>

                    <div className="p-4 rounded-xl border border-[#E6E9EF] dark:border-slate-800 bg-[#F7F8FA] dark:bg-slate-900/40 flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                          <Leaf className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white">Environmental Protection (EIA)</div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                            {environmentalData.length > 0
                              ? `${environmentalData.length} environmental monitoring parameters tracked against statutory limits.`
                              : "No environmental parameters recorded for this project."}
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                        {environmentalData.length > 0 ? `${environmentalData.length} Monitored` : "-"}
                      </span>
                    </div>
                  </div>
                </Panel>
              </div>

              {/* Quick Action Navigation Card */}
              <div className="space-y-6">
                <Panel
                  title="Quick Record Entry"
                  subtitle="Open individual entry modal forms"
                  action={
                    <button
                      type="button"
                      onClick={exportOverviewCsv}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                      title="Export HSEQ Governance Executive Summary to CSV"
                    >
                      <Download className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>Export Summary</span>
                    </button>
                  }
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                    <button
                      onClick={() => setItpModal({ isOpen: true, mode: "create", data: null })}
                      className="w-full p-2.5 rounded-xl border border-[#E6E9EF] dark:border-slate-800 bg-[#F7F8FA] hover:bg-amber-500/10 hover:border-amber-500/30 transition-all flex items-center justify-between text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Plus className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">New ITP Quality Plan</span>
                      </div>
                      <span className="text-[10px] font-medium text-slate-400">Modal →</span>
                    </button>

                    <button
                      onClick={() => setInspectionModal({ isOpen: true, mode: "create", data: null })}
                      className="w-full p-2.5 rounded-xl border border-[#E6E9EF] dark:border-slate-800 bg-[#F7F8FA] hover:bg-amber-500/10 hover:border-amber-500/30 transition-all flex items-center justify-between text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Plus className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Log Site Inspection</span>
                      </div>
                      <span className="text-[10px] font-medium text-slate-400">Modal →</span>
                    </button>

                    <button
                      onClick={() => setNcrModal({ isOpen: true, mode: "create", data: null })}
                      className="w-full p-2.5 rounded-xl border border-[#E6E9EF] dark:border-slate-800 bg-[#F7F8FA] hover:bg-amber-500/10 hover:border-amber-500/30 transition-all flex items-center justify-between text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Plus className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Raise NCR Notice</span>
                      </div>
                      <span className="text-[10px] font-medium text-slate-400">Modal →</span>
                    </button>

                    <button
                      onClick={() => setTestModal({ isOpen: true, mode: "create", data: null })}
                      className="w-full p-2.5 rounded-xl border border-[#E6E9EF] dark:border-slate-800 bg-[#F7F8FA] hover:bg-amber-500/10 hover:border-amber-500/30 transition-all flex items-center justify-between text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Plus className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Log Material Test Result</span>
                      </div>
                      <span className="text-[10px] font-medium text-slate-400">Modal →</span>
                    </button>

                    <button
                      onClick={() => setIncidentModal({ isOpen: true, mode: "create", data: null })}
                      className="w-full p-2.5 rounded-xl border border-[#E6E9EF] dark:border-slate-800 bg-[#F7F8FA] hover:bg-amber-500/10 hover:border-amber-500/30 transition-all flex items-center justify-between text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Plus className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Report Incident / Near Miss</span>
                      </div>
                      <span className="text-[10px] font-medium text-slate-400">Modal →</span>
                    </button>

                    <button
                      onClick={() => setPermitModal({ isOpen: true, mode: "create", data: null })}
                      className="w-full p-2.5 rounded-xl border border-[#E6E9EF] dark:border-slate-800 bg-[#F7F8FA] hover:bg-amber-500/10 hover:border-amber-500/30 transition-all flex items-center justify-between text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Plus className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Issue Permit to Work</span>
                      </div>
                      <span className="text-[10px] font-medium text-slate-400">Modal →</span>
                    </button>

                    <button
                      onClick={() => setEnvModal({ isOpen: true, mode: "create", data: null })}
                      className="w-full p-2.5 rounded-xl border border-[#E6E9EF] dark:border-slate-800 bg-[#F7F8FA] hover:bg-amber-500/10 hover:border-amber-500/30 transition-all flex items-center justify-between text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Plus className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Log Environmental Metric</span>
                      </div>
                      <span className="text-[10px] font-medium text-slate-400">Modal →</span>
                    </button>

                    <button
                      onClick={() => setAuditModal({ isOpen: true, mode: "create", data: null })}
                      className="w-full p-2.5 rounded-xl border border-[#E6E9EF] dark:border-slate-800 bg-[#F7F8FA] hover:bg-amber-500/10 hover:border-amber-500/30 transition-all flex items-center justify-between text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Plus className="w-3.5 h-3.5 text-amber-500" />
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">Schedule ISO Audit</span>
                      </div>
                      <span className="text-[10px] font-medium text-slate-400">Modal →</span>
                    </button>
                  </div>
                </Panel>

                <Panel
                  title="HSEQ Modules"
                  subtitle="Direct access to operational registers"
                >
                  <div className="space-y-2">
                    <button
                      onClick={() => handleMainTabChange("quality")}
                      className="w-full p-3 rounded-xl border border-[#E6E9EF] dark:border-slate-800 hover:bg-[#F7F8FA] dark:hover:bg-slate-800 transition-all flex items-center justify-between text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <CheckSquare className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Quality Management</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">ITPs & Inspections →</span>
                    </button>

                    <button
                      onClick={() => handleMainTabChange("safety")}
                      className="w-full p-3 rounded-xl border border-[#E6E9EF] dark:border-slate-800 hover:bg-[#F7F8FA] dark:hover:bg-slate-800 transition-all flex items-center justify-between text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <HardHat className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Safety & HSE Registers</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">Incidents & Talks →</span>
                    </button>

                    <button
                      onClick={() => handleMainTabChange("environment")}
                      className="w-full p-3 rounded-xl border border-[#E6E9EF] dark:border-slate-800 hover:bg-[#F7F8FA] dark:hover:bg-slate-800 transition-all flex items-center justify-between text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <Leaf className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Environmental Monitoring</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">Dust & Silt →</span>
                    </button>

                    <button
                      onClick={() => handleMainTabChange("audits")}
                      className="w-full p-3 rounded-xl border border-[#E6E9EF] dark:border-slate-800 hover:bg-[#F7F8FA] dark:hover:bg-slate-800 transition-all flex items-center justify-between text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <Scale className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">ISO Governance Audits</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">ISO 9001/14001 →</span>
                    </button>
                  </div>
                </Panel>
              </div>

            </div>

          </div>
        )}

        {/* 2. QUALITY VIEW (ITPs · Inspections · NCRs · Test Results) */}
        {activeMainTab === "quality" && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* Quality Sub-Navigation */}
            <div className="bg-[#F7F8FA] dark:bg-slate-900/60 p-1.5 border border-[#E6E9EF] dark:border-slate-800 rounded-xl flex items-center justify-between gap-2 overflow-x-auto">
              <div className="flex items-center gap-1 min-w-max">
                {[
                  { id: "itps", label: "ITPs (Inspection Test Plans)", icon: CheckSquare },
                  { id: "inspections", label: "Inspections Register", icon: ClipboardCheck },
                  { id: "ncrs", label: "NCRs (Non-Conformance)", icon: AlertTriangle },
                  { id: "test-results", label: "Lab & Field Test Results", icon: FileSpreadsheet },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSubTabChange(item.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                      qualitySub === item.id
                        ? "bg-white dark:bg-[#0B172A] text-[#172033] dark:text-white shadow-2xs font-bold border border-[#E6E9EF] dark:border-slate-700"
                        : "text-[#667085] dark:text-slate-400 hover:text-[#172033] dark:hover:text-white"
                    }`}
                  >
                    <item.icon className="w-3.5 h-3.5 text-amber-500" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
              {qualitySub === "itps" && (
                <button
                  type="button"
                  onClick={() => setItpModal({ isOpen: true, mode: "create", data: null })}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors shrink-0 mr-0.5"
                  title="Add new Inspection & Test Plan"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add ITP</span>
                </button>
              )}
              {qualitySub === "ncrs" && (
                <button
                  type="button"
                  onClick={() => setNcrModal({ isOpen: true, mode: "create", data: null })}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors shrink-0 mr-0.5"
                  title="Add Non-Conformance Report & Corrective Action (CAPA)"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add NCR</span>
                </button>
              )}
            </div>

            {/* Quality Sub-View 1: ITPs */}
            {qualitySub === "itps" && (
              <Panel
                title="Approved Inspection & Test Plans (ITP) Matrix"
                subtitle="Hold points, witness stages, and surveillance requirements governing active structural & civil works"
                action={
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={exportItpsCsv}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                      title="Export ITP register to CSV"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Export CSV</span>
                    </button>
                    <button
                      onClick={() => setItpModal({ isOpen: true, mode: "create", data: null })}
                      className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add ITP</span>
                    </button>
                  </div>
                }
              >
                {itpData.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    No records found. Click "+ Add ITP" to create an inspection &amp; test plan.
                  </div>
                ) : (
                  <DataTable
                    columns={[
                      { header: "ITP Reference", accessor: (r: any) => <strong className="text-blue-600 dark:text-blue-400 font-mono text-xs">{r.id}</strong> },
                      { header: "Scope of Work / Element", accessor: (r: any) => <span className="font-semibold text-slate-800 dark:text-slate-200">{r.title}</span> },
                      { header: "Standard Spec", accessor: (r: any) => <span className="text-xs font-mono text-slate-600 dark:text-slate-400">{r.specClause}</span> },
                      { header: "Contract Hold Points (HP)", accessor: (r: any) => <span className="text-xs text-rose-600 font-medium">{r.holdPoints}</span> },
                      { header: "Witness Points (WP)", accessor: (r: any) => <span className="text-xs text-amber-600">{r.witnessPoints}</span> },
                      { header: "Lead QA Sign-Off", accessor: (r: any) => <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">{r.leadAuditor}</span> },
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
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setItpModal({ isOpen: true, mode: "view", data: r })}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                              title="View Plan"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setItpModal({ isOpen: true, mode: "edit", data: r })}
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                              title="Edit Plan"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteITP(r)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                              title="Delete Plan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ),
                      },
                    ]}
                    data={itpData}
                  />
                )}
              </Panel>
            )}

            {/* Quality Sub-View 2: Inspections (Embedded QualityPage without redundant ProjectShell) */}
            {qualitySub === "inspections" && (
              <div className="space-y-4">
                <QualityPage embedded={true} />
              </div>
            )}

            {/* Quality Sub-View 3: NCRs */}
            {qualitySub === "ncrs" && (
              <Panel
                title="Non-Conformance Reports (NCR) & Corrective Action (CAPA)"
                subtitle="Deficiency notices raised by Resident Engineer, approved engineering remedies, and sign-off closeouts"
                action={
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={exportNcrsCsv}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                      title="Export NCR register to CSV"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Export CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNcrModal({ isOpen: true, mode: "create", data: null })}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                      title="Add Non-Conformance Report & Corrective Action (CAPA)"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add NCR</span>
                    </button>
                  </div>
                }
              >
                {ncrData.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    No records found. Click "+ Add NCR" to record a non-conformance report and corrective action plan.
                  </div>
                ) : (
                  <DataTable
                    columns={[
                      { header: "NCR Reference", accessor: (r: any) => <strong className="text-rose-600 font-mono text-xs">{r.id}</strong> },
                      { header: "Deficiency Summary", accessor: (r: any) => <span className="font-semibold text-slate-800 dark:text-slate-200">{r.title}</span> },
                      { header: "Specification Clause", accessor: (r: any) => <span className="text-xs font-mono text-blue-600 dark:text-blue-400">{r.clause}</span> },
                      { header: "Date Raised", accessor: (r: any) => <span className="font-mono text-xs text-slate-500">{r.dateRaised}</span> },
                      { header: "Raised By", accessor: (r: any) => <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">{r.raisedBy}</span> },
                      { header: "Approved Corrective Action", accessor: (r: any) => <span className="text-xs text-slate-600 dark:text-slate-400">{r.correctiveAction}</span> },
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
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setNcrModal({ isOpen: true, mode: "view", data: r })}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                              title="View NCR"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setNcrModal({ isOpen: true, mode: "edit", data: r })}
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                              title="Edit NCR"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteNCR(r)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                              title="Delete NCR"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ),
                      },
                    ]}
                    data={ncrData}
                  />
                )}
              </Panel>
            )}

            {/* Quality Sub-View 4: Test Results */}
            {qualitySub === "test-results" && (
              <Panel
                title="Laboratory & Field Material Test Results"
                subtitle="Compressive concrete cube strengths, nuclear compaction densities, rebar tensile tests, and aggregate ACV"
                action={
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={exportTestResultsCsv}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                      title="Export material test results to CSV"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Export CSV</span>
                    </button>
                    <button
                      onClick={() => setTestModal({ isOpen: true, mode: "create", data: null })}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Log Test Result</span>
                    </button>
                  </div>
                }
              >
                {testResultsData.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    No records found. Click "+ Log Test Result" to record laboratory or field testing.
                  </div>
                ) : (
                  <DataTable
                    columns={[
                      { header: "Test Certificate", accessor: (r: any) => <strong className="text-blue-600 dark:text-blue-400 font-mono text-xs">{r.id}</strong> },
                      { header: "Test Description", accessor: (r: any) => <span className="font-semibold text-slate-800 dark:text-slate-200">{r.testType}</span> },
                      { header: "Sampled Element", accessor: (r: any) => <span className="text-xs text-slate-600 dark:text-slate-400">{r.sampleRef}</span> },
                      { header: "Required Specification", accessor: (r: any) => <span className="font-mono text-xs text-slate-500">{r.requiredSpec}</span> },
                      { header: "Achieved Result", accessor: (r: any) => <span className="font-mono text-xs font-bold text-emerald-600">{r.achievedResult}</span> },
                      { header: "Testing Authority", accessor: (r: any) => <span className="text-xs text-slate-600 dark:text-slate-400">{r.lab}</span> },
                      { 
                        header: "Compliance", 
                        accessor: (r: any) => (
                          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {r.resultStatus}
                          </span>
                        ) 
                      },
                      {
                        header: "Actions",
                        accessor: (r: any) => (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setTestModal({ isOpen: true, mode: "view", data: r })}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                              title="View Result"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setTestModal({ isOpen: true, mode: "edit", data: r })}
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                              title="Edit Result"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteTestResult(r)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                              title="Delete Result"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ),
                      },
                    ]}
                    data={testResultsData}
                  />
                )}
              </Panel>
            )}

          </div>
        )}

        {/* 3. SAFETY VIEW (Incidents · Toolbox Talks · Permits) */}
        {activeMainTab === "safety" && (
          <div className="space-y-6 animate-fadeIn">
            
            {/* Safety Sub-Navigation */}
            <div className="bg-[#F7F8FA] dark:bg-slate-900/60 p-1.5 border border-[#E6E9EF] dark:border-slate-800 rounded-xl flex items-center justify-between gap-2 overflow-x-auto">
              <div className="flex items-center gap-1 min-w-max">
                {[
                  { id: "incidents", label: "Incidents & Near Misses", icon: AlertTriangle },
                  { id: "toolbox-talks", label: "Toolbox Talks", icon: Users },
                  { id: "permits", label: "Permits to Work (PTW)", icon: FileText },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSubTabChange(item.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                      safetySub === item.id
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

            {/* Safety Sub-View 1: Incidents */}
            {safetySub === "incidents" && (
              <Panel
                title="Site Safety Incidents & Proactive Near-Miss Log"
                subtitle="Immediate investigations, root-cause analyses, preventative measures, and regulatory compliance"
                action={
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={exportSafetyIncidentsCsv}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                      title="Export safety incidents register to CSV"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Export CSV</span>
                    </button>
                    <button
                      onClick={() => setIncidentModal({ isOpen: true, mode: "create", data: null })}
                      className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Log Incident / Near Miss</span>
                    </button>
                  </div>
                }
              >
                {safetyIncidentsData.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    No records found. Click "+ Log Incident / Near Miss" to record safety events.
                  </div>
                ) : (
                  <DataTable
                    columns={[
                      { header: "Incident Reference", accessor: (r: any) => <strong className="text-blue-600 dark:text-blue-400 font-mono text-xs">{r.id}</strong> },
                      { header: "Date", accessor: (r: any) => <span className="font-mono text-xs text-slate-500">{r.date}</span> },
                      { header: "Classification", accessor: (r: any) => <span className="font-semibold text-slate-800 dark:text-slate-200">{r.type}</span> },
                      { header: "Location / Workface", accessor: (r: any) => <span className="text-xs text-slate-600 dark:text-slate-400">{r.location}</span> },
                      { header: "Incident Summary", accessor: (r: any) => <span className="text-xs text-slate-600 dark:text-slate-400">{r.description}</span> },
                      { header: "Preventative Action Taken", accessor: (r: any) => <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">{r.action}</span> },
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
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setIncidentModal({ isOpen: true, mode: "view", data: r })}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                              title="View Incident"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setIncidentModal({ isOpen: true, mode: "edit", data: r })}
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                              title="Edit Incident"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSafetyIncident(r)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                              title="Delete Incident"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ),
                      },
                    ]}
                    data={safetyIncidentsData}
                  />
                )}
              </Panel>
            )}

            {/* Safety Sub-View 2: Toolbox Talks */}
            {safetySub === "toolbox-talks" && (
              <Panel
                title="Daily & Weekly Site Toolbox Talks Register"
                subtitle="Pre-shift hazard briefings, high-risk safety protocols, and trade staff attendance logs"
                action={
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={exportToolboxTalksCsv}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                      title="Export toolbox talks to CSV"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Export CSV</span>
                    </button>
                    <button
                      onClick={() => setToolboxModal({ isOpen: true, mode: "create", data: null })}
                      className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Record Toolbox Talk</span>
                    </button>
                  </div>
                }
              >
                {toolboxTalksData.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    No records found. Click "+ Record Toolbox Talk" to log daily briefings.
                  </div>
                ) : (
                  <DataTable
                    columns={[
                      { header: "Talk Ref", accessor: (r: any) => <strong className="text-blue-600 dark:text-blue-400 font-mono text-xs">{r.id}</strong> },
                      { header: "Briefing Topic", accessor: (r: any) => <span className="font-semibold text-slate-800 dark:text-slate-200">{r.topic}</span> },
                      { header: "Category", accessor: (r: any) => <span className="text-xs text-slate-600 dark:text-slate-400">{r.category}</span> },
                      { header: "Date Conducted", accessor: (r: any) => <span className="font-mono text-xs text-slate-500">{r.date}</span> },
                      { header: "Supervisor / Presenter", accessor: (r: any) => <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">{r.presenter}</span> },
                      { header: "Attendees", accessor: (r: any) => <span className="font-mono font-bold text-slate-900 dark:text-white">{r.attendees} workers</span> },
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
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setToolboxModal({ isOpen: true, mode: "view", data: r })}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                              title="View Talk"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setToolboxModal({ isOpen: true, mode: "edit", data: r })}
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                              title="Edit Talk"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteToolboxTalk(r)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                              title="Delete Talk"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ),
                      },
                    ]}
                    data={toolboxTalksData}
                  />
                )}
              </Panel>
            )}

            {/* Safety Sub-View 3: Permits */}
            {safetySub === "permits" && (
              <Panel
                title="High-Risk Permit to Work (PTW) Control System"
                subtitle="Formal authorizations for deep trenching, heavy tandem lifting, hot work, and night shifts"
                action={
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={exportPermitsCsv}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                      title="Export permits to work to CSV"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Export CSV</span>
                    </button>
                    <button
                      onClick={() => setPermitModal({ isOpen: true, mode: "create", data: null })}
                      className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Issue Permit (PTW)</span>
                    </button>
                  </div>
                }
              >
                {permitsData.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    No records found. Click "+ Issue Permit (PTW)" to issue a high-risk work clearance.
                  </div>
                ) : (
                  <DataTable
                    columns={[
                      { header: "Permit Number", accessor: (r: any) => <strong className="text-blue-600 dark:text-blue-400 font-mono text-xs">{r.id}</strong> },
                      { header: "High Risk Scope", accessor: (r: any) => <span className="font-semibold text-slate-800 dark:text-slate-200">{r.type}</span> },
                      { header: "Authorized Location", accessor: (r: any) => <span className="text-xs text-slate-600 dark:text-slate-400">{r.location}</span> },
                      { header: "Assigned Crew", accessor: (r: any) => <span className="text-xs text-slate-700 dark:text-slate-300">{r.issuedTo}</span> },
                      { header: "Validity Window", accessor: (r: any) => <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{r.validFrom} → {r.validTo}</span> },
                      { header: "Person In Charge (PIC)", accessor: (r: any) => <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{r.pic}</span> },
                      { 
                        header: "Status", 
                        accessor: (r: any) => (
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                            r.status.includes("Active") ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-emerald-50 text-emerald-800 border-emerald-200"
                          }`}>
                            {r.status}
                          </span>
                        ) 
                      },
                      {
                        header: "Actions",
                        accessor: (r: any) => (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setPermitModal({ isOpen: true, mode: "view", data: r })}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                              title="View Permit"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setPermitModal({ isOpen: true, mode: "edit", data: r })}
                              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                              title="Edit Permit"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeletePermit(r)}
                              className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                              title="Delete Permit"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ),
                      },
                    ]}
                    data={permitsData}
                  />
                )}
              </Panel>
            )}

          </div>
        )}

        {/* 4. ENVIRONMENT VIEW */}
        {activeMainTab === "environment" && (
          <div className="space-y-6 animate-fadeIn">
            <Panel
              title="Environmental Impact Assessment (EIA) Continuous Monitoring"
              subtitle="Statutory compliance: Dust suppression (PM10/2.5), noise dB(A) thresholds, water runoff turbidity, and fuel bund integrity"
              action={
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={exportEnvironmentalCsv}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                    title="Export environmental monitoring records to CSV"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    onClick={() => setEnvModal({ isOpen: true, mode: "create", data: null })}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Log Monitoring Record</span>
                  </button>
                </div>
              }
            >
              {environmentalData.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No records found. Click "+ Log Monitoring Record" to record environmental checks.
                </div>
              ) : (
                <DataTable
                  columns={[
                    { header: "Parameter Monitored", accessor: (r: any) => <strong className="text-slate-900 dark:text-white">{r.parameter}</strong> },
                    { header: "Sampling Workface", accessor: (r: any) => <span className="text-xs text-slate-600 dark:text-slate-400">{r.location}</span> },
                    { header: "Measured Reading vs Limit", accessor: (r: any) => <span className="font-mono text-xs font-bold text-emerald-600">{r.reading}</span> },
                    { header: "Mitigation Measure", accessor: (r: any) => <span className="text-xs text-slate-600 dark:text-slate-400">{r.frequency}</span> },
                    { header: "Last Verified", accessor: (r: any) => <span className="font-mono text-xs text-slate-500">{r.lastChecked}</span> },
                    { 
                      header: "Status", 
                      accessor: (r: any) => (
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {r.compliance}
                        </span>
                      ) 
                    },
                    {
                      header: "Actions",
                      accessor: (r: any) => (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEnvModal({ isOpen: true, mode: "view", data: r })}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                            title="View Record"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEnvModal({ isOpen: true, mode: "edit", data: r })}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                            title="Edit Record"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteEnvironmental(r)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                            title="Delete Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ),
                    },
                  ]}
                  data={environmentalData}
                />
              )}
            </Panel>
          </div>
        )}

        {/* 5. AUDITS VIEW */}
        {activeMainTab === "audits" && (
          <div className="space-y-6 animate-fadeIn">
            <Panel
              title="Statutory & Corporate Governance Audits Register"
              subtitle="ISO 9001 (Quality), ISO 14001 (Environmental), and ISO 45001 (OH&S) audit records, external reviewer scores, and renewal schedules"
              action={
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={exportAuditsCsv}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                    title="Export audits register to CSV"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Export CSV</span>
                  </button>
                  <button
                    onClick={() => setAuditModal({ isOpen: true, mode: "create", data: null })}
                    className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Schedule Audit</span>
                  </button>
                </div>
              }
            >
              {auditsData.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No records found. Click "+ Schedule Audit" to record a governance audit.
                </div>
              ) : (
                <DataTable
                  columns={[
                    { header: "Audit Ref", accessor: (r: any) => <strong className="text-blue-600 dark:text-blue-400 font-mono text-xs">{r.id}</strong> },
                    { header: "Audit Title", accessor: (r: any) => <span className="font-semibold text-slate-800 dark:text-slate-200">{r.title}</span> },
                    { header: "Governing Standard", accessor: (r: any) => <span className="text-xs font-mono text-slate-600 dark:text-slate-400">{r.standard}</span> },
                    { header: "Audit Date", accessor: (r: any) => <span className="font-mono text-xs text-slate-500">{r.auditDate}</span> },
                    { header: "Lead Auditor", accessor: (r: any) => <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">{r.auditor}</span> },
                    { header: "Summary of Findings", accessor: (r: any) => <span className="text-xs text-slate-600 dark:text-slate-400">{r.findings}</span> },
                    { 
                      header: "Audit Result", 
                      accessor: (r: any) => (
                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {r.outcome}
                        </span>
                      ) 
                    },
                    {
                      header: "Actions",
                      accessor: (r: any) => (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setAuditModal({ isOpen: true, mode: "view", data: r })}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                            title="View Audit"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setAuditModal({ isOpen: true, mode: "edit", data: r })}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                            title="Edit Audit"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteAudit(r)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors"
                            title="Delete Audit"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ),
                    },
                  ]}
                  data={auditsData}
                />
              )}
            </Panel>
          </div>
        )}

        {/* --- ALL HSEQ MODALS --- */}
        <ITPModal
          isOpen={itpModal.isOpen}
          mode={itpModal.mode}
          initialData={itpModal.data}
          onSave={handleSaveITP}
          onClose={() => setItpModal({ isOpen: false, mode: "create", data: null })}
          onSwitchToEdit={() => setItpModal((prev) => ({ ...prev, mode: "edit" }))}
        />

        <NCRModal
          isOpen={ncrModal.isOpen}
          mode={ncrModal.mode}
          initialData={ncrModal.data}
          onSave={handleSaveNCR}
          onClose={() => setNcrModal({ isOpen: false, mode: "create", data: null })}
          onSwitchToEdit={() => setNcrModal((prev) => ({ ...prev, mode: "edit" }))}
        />

        <TestResultModal
          isOpen={testModal.isOpen}
          mode={testModal.mode}
          initialData={testModal.data}
          onSave={handleSaveTestResult}
          onClose={() => setTestModal({ isOpen: false, mode: "create", data: null })}
          onSwitchToEdit={() => setTestModal((prev) => ({ ...prev, mode: "edit" }))}
        />

        <SafetyIncidentModal
          isOpen={incidentModal.isOpen}
          mode={incidentModal.mode}
          initialData={incidentModal.data}
          onSave={handleSaveSafetyIncident}
          onClose={() => setIncidentModal({ isOpen: false, mode: "create", data: null })}
          onSwitchToEdit={() => setIncidentModal((prev) => ({ ...prev, mode: "edit" }))}
        />

        <ToolboxTalkModal
          isOpen={toolboxModal.isOpen}
          mode={toolboxModal.mode}
          initialData={toolboxModal.data}
          onSave={handleSaveToolboxTalk}
          onClose={() => setToolboxModal({ isOpen: false, mode: "create", data: null })}
          onSwitchToEdit={() => setToolboxModal((prev) => ({ ...prev, mode: "edit" }))}
        />

        <PermitToWorkModal
          isOpen={permitModal.isOpen}
          mode={permitModal.mode}
          initialData={permitModal.data}
          onSave={handleSavePermit}
          onClose={() => setPermitModal({ isOpen: false, mode: "create", data: null })}
          onSwitchToEdit={() => setPermitModal((prev) => ({ ...prev, mode: "edit" }))}
        />

        <EnvironmentalModal
          isOpen={envModal.isOpen}
          mode={envModal.mode}
          initialData={envModal.data}
          onSave={handleSaveEnvironmental}
          onClose={() => setEnvModal({ isOpen: false, mode: "create", data: null })}
          onSwitchToEdit={() => setEnvModal((prev) => ({ ...prev, mode: "edit" }))}
        />

        <AuditModal
          isOpen={auditModal.isOpen}
          mode={auditModal.mode}
          initialData={auditModal.data}
          onSave={handleSaveAudit}
          onClose={() => setAuditModal({ isOpen: false, mode: "create", data: null })}
          onSwitchToEdit={() => setAuditModal((prev) => ({ ...prev, mode: "edit" }))}
        />

        <InspectionModal
          isOpen={inspectionModal.isOpen}
          mode={inspectionModal.mode}
          initialData={inspectionModal.data}
          projectId={projectId}
          companyId={companyId}
          projectName={activeProject?.name || ""}
          onSave={handleSaveInspection}
          onClose={() => setInspectionModal({ isOpen: false, mode: "create", data: null })}
          onSwitchToEdit={() => setInspectionModal((prev) => ({ ...prev, mode: "edit" }))}
        />

        <HSEQDeleteConfirmModal
          isOpen={deleteConfirm.isOpen}
          title={deleteConfirm.title}
          itemRef={deleteConfirm.itemRef}
          itemName={deleteConfirm.itemName}
          onConfirm={deleteConfirm.onConfirm}
          onCancel={() => setDeleteConfirm((d) => ({ ...d, isOpen: false }))}
        />

      </div>
    </ProjectShell>
  );
}
