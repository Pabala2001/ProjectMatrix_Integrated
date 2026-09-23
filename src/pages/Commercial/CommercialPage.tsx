import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate, useOutletContext } from "react-router-dom";
import {
  Coins,
  Calculator,
  DollarSign,
  Truck,
  FileCheck,
  Building2,
  Landmark,
  FileText,
  Upload,
  Layers,
  Filter,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Clock
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useRegionalSettings } from "../../hooks/useRegionalSettings";
import {
  CommercialOverviewMetrics,
  BudgetLineItem,
  ForecastLineItem,
  CommitmentRegisterItem,
  ActualCostRegisterItem,
  ClientCertificateRecord,
  SupplierInvoiceRecord,
  SupplierDirectoryItem,
  BankTransactionRecord,
  CommercialAuditEntry,
  SourceProvenance,
  CommercialCategory
} from "../../types/commercialWorkspace";
import { CommercialWorkspaceService } from "../../services/commercialWorkspaceService";
import { CommercialOverviewView } from "../../components/commercial/views/CommercialOverviewView";
import { CommercialBudgetForecastView } from "../../components/commercial/views/CommercialBudgetForecastView";
import { CommercialCommitmentsView } from "../../components/commercial/views/CommercialCommitmentsView";
import { CommercialActualCostsView } from "../../components/commercial/views/CommercialActualCostsView";
import { CommercialClientAccountsView } from "../../components/commercial/views/CommercialClientAccountsView";
import { CommercialSupplierAccountsView } from "../../components/commercial/views/CommercialSupplierAccountsView";
import { CommercialCashBankView } from "../../components/commercial/views/CommercialCashBankView";
import { CommercialReportsAuditView } from "../../components/commercial/views/CommercialReportsAuditView";
import { CommercialDataUploadModal } from "../../components/commercial/CommercialDataUploadModal";
import { SourceTraceabilityModal } from "../../components/commercial/SourceTraceabilityModal";

export type CommercialTabKey =
  | "overview"
  | "budget-forecast"
  | "commitments"
  | "actual-costs"
  | "client-accounts"
  | "supplier-accounts"
  | "cash-bank"
  | "reports-audit";

const TABS: { key: CommercialTabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "overview", label: "Overview", icon: Coins },
  { key: "budget-forecast", label: "Budget & Forecast", icon: Calculator },
  { key: "commitments", label: "Commitments", icon: Truck },
  { key: "actual-costs", label: "Actual Costs", icon: DollarSign },
  { key: "client-accounts", label: "Client Accounts", icon: FileCheck },
  { key: "supplier-accounts", label: "Supplier Accounts", icon: Building2 },
  { key: "cash-bank", label: "Cash & Bank", icon: Landmark },
  { key: "reports-audit", label: "Reports & Audit", icon: FileText }
];

export const CommercialPage: React.FC = () => {
  const { activeCompany: authCompany, profile } = useAuth();
  const outletCtx = useOutletContext<any>() || {};
  const activeCompany = outletCtx.activeCompany || authCompany;
  const activeProject = outletCtx.activeProject;
  const allProjects = outletCtx.allProjects;
  const onProjectChange = outletCtx.onProjectChange;
  const { currencyCode: globalCurrencyCode } = useRegionalSettings();

  const location = useLocation();
  const navigate = useNavigate();

  // Active Company & Project from Top Header
  const companyId = activeCompany?.id || "default_company";
  const companyName = activeCompany?.name || "Corporate Enterprise";
  const projectId = activeProject?.id;
  const activeProjectName = activeProject?.name || "Active Project";
  const currency = globalCurrencyCode || activeProject?.currency_code || activeProject?.currency || "USD";

  // Determine active tab from URL path
  const currentTab = useMemo<CommercialTabKey>(() => {
    const path = location.pathname.toLowerCase();
    if (path.includes("/budget-forecast") || path.includes("/boq")) return "budget-forecast";
    if (path.includes("/commitments") || path.includes("/procurement")) return "commitments";
    if (path.includes("/actual-costs") || path.includes("/costs")) return "actual-costs";
    if (path.includes("/client-accounts") || path.includes("/certificates")) return "client-accounts";
    if (path.includes("/supplier-accounts") || path.includes("/accounts")) return "supplier-accounts";
    if (path.includes("/cash-bank") || path.includes("/cashflow")) return "cash-bank";
    if (path.includes("/reports-audit")) return "reports-audit";
    return "overview";
  }, [location.pathname]);

  const [activeTab, setActiveTab] = useState<CommercialTabKey>(currentTab);

  useEffect(() => {
    setActiveTab(currentTab);
  }, [currentTab]);

  // Synchronize active project if passed via URL parameter (?project=...)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const targetProjectId = params.get("project");
    if (targetProjectId && targetProjectId !== projectId && allProjects && onProjectChange) {
      const target = allProjects.find((p: any) => p.id === targetProjectId);
      if (target) {
        onProjectChange(target);
      }
    }
  }, [location.search, projectId, allProjects, onProjectChange]);

  // Data states
  const [loading, setLoading] = useState<boolean>(true);
  const [overviewMetrics, setOverviewMetrics] = useState<CommercialOverviewMetrics>({
    originalContractValue: null,
    approvedVariations: null,
    revisedContractValue: null,
    certifiedToDate: null,
    paidToDate: null,
    outstandingReceivables: null,
    approvedBudget: null,
    actualCost: null,
    committedCost: null,
    forecastCostToComplete: null,
    forecastFinalCost: null,
    currentCashPosition: null,
    currency
  });

  const [budgets, setBudgets] = useState<BudgetLineItem[]>([]);
  const [forecasts, setForecasts] = useState<ForecastLineItem[]>([]);
  const [commitments, setCommitments] = useState<CommitmentRegisterItem[]>([]);
  const [actualCosts, setActualCosts] = useState<ActualCostRegisterItem[]>([]);
  const [clientCertificates, setClientCertificates] = useState<ClientCertificateRecord[]>([]);
  const [supplierInvoices, setSupplierInvoices] = useState<SupplierInvoiceRecord[]>([]);
  const [supplierDirectory, setSupplierDirectory] = useState<SupplierDirectoryItem[]>([]);
  const [bankTransactions, setBankTransactions] = useState<BankTransactionRecord[]>([]);
  const [auditTrail, setAuditTrail] = useState<CommercialAuditEntry[]>([]);

  // Modals state
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [uploadCategoryPreset, setUploadCategoryPreset] = useState<CommercialCategory | undefined>(undefined);

  // Source Traceability Modal
  const [isTraceabilityOpen, setIsTraceabilityOpen] = useState<boolean>(false);
  const [traceabilityDetails, setTraceabilityDetails] = useState<{
    title: string;
    value: any;
    source?: SourceProvenance;
    fieldName?: string;
  }>({
    title: "",
    value: null
  });

  // Load Commercial Data strictly for activeProject and companyId
  const loadCommercialData = async () => {
    if (!projectId) {
      setLoading(false);
      setOverviewMetrics({
        originalContractValue: null,
        approvedVariations: null,
        revisedContractValue: null,
        certifiedToDate: null,
        paidToDate: null,
        outstandingReceivables: null,
        approvedBudget: null,
        actualCost: null,
        committedCost: null,
        forecastCostToComplete: null,
        forecastFinalCost: null,
        currentCashPosition: null,
        currency
      });
      setBudgets([]);
      setForecasts([]);
      setCommitments([]);
      setActualCosts([]);
      setClientCertificates([]);
      setSupplierInvoices([]);
      setSupplierDirectory([]);
      setBankTransactions([]);
      setAuditTrail([]);
      return;
    }

    setLoading(true);

    try {
      const [
        metricsData,
        budgetsData,
        forecastsData,
        commitmentsData,
        actualsData,
        certsData,
        sinvsData,
        sdirData,
        bankData,
        auditData
      ] = await Promise.all([
        CommercialWorkspaceService.getOverviewMetrics(companyId, projectId, currency),
        CommercialWorkspaceService.getBudgetLines(companyId, projectId),
        CommercialWorkspaceService.getForecastLines(companyId, projectId),
        CommercialWorkspaceService.getCommitments(companyId, projectId),
        CommercialWorkspaceService.getActualCosts(companyId, projectId),
        CommercialWorkspaceService.getClientCertificates(companyId, projectId),
        CommercialWorkspaceService.getSupplierInvoices(companyId, projectId),
        CommercialWorkspaceService.getSupplierDirectory(companyId),
        CommercialWorkspaceService.getBankTransactions(companyId, projectId),
        CommercialWorkspaceService.getAuditTrail(companyId, projectId)
      ]);

      setOverviewMetrics(metricsData);
      setBudgets(budgetsData);
      setForecasts(forecastsData);
      setCommitments(commitmentsData);
      setActualCosts(actualsData);
      setClientCertificates(certsData);
      setSupplierInvoices(sinvsData);
      setSupplierDirectory(sdirData);
      setBankTransactions(bankData);
      setAuditTrail(auditData);
    } catch (err) {
      console.error("Error refreshing commercial data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCommercialData();
  }, [companyId, projectId, currency]);

  // Handle Tab Switch
  const handleTabChange = (key: CommercialTabKey) => {
    setActiveTab(key);
    navigate(`/commercial/${key}`);
  };

  // Inspect Source Trigger
  const handleInspectSource = (title: string, value: any, source?: SourceProvenance, fieldName?: string) => {
    setTraceabilityDetails({
      title,
      value,
      source,
      fieldName
    });
    setIsTraceabilityOpen(true);
  };

  const handleOpenUpload = (category?: CommercialCategory | string) => {
    if (category) {
      setUploadCategoryPreset(category as CommercialCategory);
    }
    setIsUploadOpen(true);
  };

  return (
    <div className="controls-page-container overflow-hidden max-w-full min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* 1. HEADER & GLOBAL CONTEXT BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-3xl shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                Commercial Management
              </h1>
              <span className="px-2.5 py-0.5 text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full border border-slate-200 dark:border-slate-700">
                Verified Records
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Source-driven financial controls, budgets, commitments, actuals & reconciliations
            </p>
          </div>
        </div>

        {/* Global Context Indicators (Header Linked) & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Active Project Indicator */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Layers className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className="text-slate-400 dark:text-slate-500 font-normal">Project:</span>
            <span className="font-bold text-slate-900 dark:text-white max-w-[220px] truncate" title={activeProject?.name || "No Project Selected"}>
              {activeProject ? `${activeProject.code ? `[${activeProject.code}] ` : ""}${activeProject.name}` : "No Project Selected"}
            </span>
          </div>

          {/* Active Currency Indicator */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300">
            <DollarSign className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="text-slate-400 dark:text-slate-500 font-normal">Currency:</span>
            <span className="font-bold text-slate-900 dark:text-white font-mono">
              {currency}
            </span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={loadCommercialData}
            title="Refresh Verified Data"
            className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-600" : ""}`} />
          </button>

          {/* Primary Action Button */}
          <button
            onClick={() => handleOpenUpload()}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-2xs"
          >
            <Upload className="w-4 h-4" />
            Upload Commercial Data
          </button>
        </div>
      </div>

      {/* 2. COMMERCIAL NAVIGATION TABS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl p-1.5 shadow-2xs overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? "bg-slate-900 text-white shadow-2xs dark:bg-amber-600"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-amber-400 dark:text-white" : "text-slate-500"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. ACTIVE SUB-VIEW CONTENT */}
      <div className="transition-opacity duration-150">
        {activeTab === "overview" && (
          <CommercialOverviewView
            budgets={budgets}
            forecasts={forecasts}
            commitments={commitments}
            actualCosts={actualCosts}
            clientCertificates={clientCertificates}
            supplierInvoices={supplierInvoices}
            bankTransactions={bankTransactions}
            auditTrail={auditTrail}
            currency={currency}
            projectId={projectId}
            projectName={activeProjectName}
            onNavigateTab={(tabKey) => {
              if (tabKey === "BUDGET_FORECAST") handleTabChange("budget-forecast");
              else if (tabKey === "COMMITMENTS") handleTabChange("commitments");
              else if (tabKey === "ACTUAL_COSTS") handleTabChange("actual-costs");
              else if (tabKey === "CLIENT_ACCOUNTS") handleTabChange("client-accounts");
              else if (tabKey === "SUPPLIER_ACCOUNTS") handleTabChange("supplier-accounts");
              else if (tabKey === "CASH_BANK") handleTabChange("cash-bank");
              else if (tabKey === "REPORTS_AUDIT") handleTabChange("reports-audit");
            }}
            onOpenUpload={handleOpenUpload}
            onInspectSource={handleInspectSource}
          />
        )}

        {activeTab === "budget-forecast" && (
          <CommercialBudgetForecastView
            budgets={budgets}
            forecasts={forecasts}
            currency={currency}
            projectId={projectId}
            companyId={companyId}
            onOpenUpload={handleOpenUpload}
            onInspectSource={handleInspectSource}
            onRefreshData={loadCommercialData}
          />
        )}

        {activeTab === "commitments" && (
          <CommercialCommitmentsView
            commitments={commitments}
            currency={currency}
            projectId={projectId}
            companyId={companyId}
            onOpenUpload={handleOpenUpload}
            onInspectSource={handleInspectSource}
            onRefreshData={loadCommercialData}
          />
        )}

        {activeTab === "actual-costs" && (
          <CommercialActualCostsView
            actualCosts={actualCosts}
            commitments={commitments}
            currency={currency}
            projectId={projectId}
            companyId={companyId}
            onOpenUpload={handleOpenUpload}
            onInspectSource={handleInspectSource}
            onRefreshData={loadCommercialData}
            onUpdateCost={(updated) => {
              setActualCosts((prev) => prev.map((c) => (c.id === updated.id || c.reference === updated.reference ? updated : c)));
            }}
          />
        )}

        {activeTab === "client-accounts" && (
          <CommercialClientAccountsView
            certificates={clientCertificates}
            currency={currency}
            projectId={projectId}
            companyId={companyId}
            onOpenUpload={handleOpenUpload}
            onInspectSource={handleInspectSource}
            onRefreshData={loadCommercialData}
          />
        )}

        {activeTab === "supplier-accounts" && (
          <CommercialSupplierAccountsView
            invoices={supplierInvoices}
            currency={currency}
            projectId={projectId}
            companyId={companyId}
            onOpenUpload={handleOpenUpload}
            onInspectSource={handleInspectSource}
            onRefreshData={loadCommercialData}
          />
        )}

        {activeTab === "cash-bank" && (
          <CommercialCashBankView
            transactions={bankTransactions}
            currency={currency}
            projectId={projectId}
            companyId={companyId}
            onOpenUpload={handleOpenUpload}
            onInspectSource={handleInspectSource}
            onRefreshData={loadCommercialData}
          />
        )}

        {activeTab === "reports-audit" && (
          <CommercialReportsAuditView
            auditTrail={auditTrail}
            metrics={overviewMetrics}
            budgets={budgets}
            forecasts={forecasts}
            commitments={commitments}
            actualCosts={actualCosts}
            clientCertificates={clientCertificates}
            supplierInvoices={supplierInvoices}
            bankTransactions={bankTransactions}
            currency={currency}
          />
        )}
      </div>

      {/* 4. DATA UPLOAD MODAL */}
      <CommercialDataUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        companyId={companyId}
        projectId={projectId}
        companyName={companyName}
        projectName={activeProjectName}
        onImportComplete={loadCommercialData}
      />

      {/* 5. SOURCE TRACEABILITY MODAL */}
      <SourceTraceabilityModal
        isOpen={isTraceabilityOpen}
        onClose={() => setIsTraceabilityOpen(false)}
        title={traceabilityDetails.title}
        source={traceabilityDetails.source}
        currentValue={traceabilityDetails.value}
        fieldName={traceabilityDetails.fieldName}
        currency={currency}
        auditTrail={auditTrail}
      />
    </div>
  );
};

