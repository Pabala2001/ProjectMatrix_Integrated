import { previewStorage } from "../integration/previewStorage";
import { assertOperationalAction } from "../integration/operationalAccess";
import { supabase, isApiKeyError } from "../lib/supabase";
import {
  CommercialOverviewMetrics,
  BudgetLineItem,
  BudgetVersionRecord,
  ForecastLineItem,
  CommitmentRegisterItem,
  ActualCostRegisterItem,
  ClientCertificateRecord,
  SupplierInvoiceRecord,
  SupplierDirectoryItem,
  BankTransactionRecord,
  SourceProvenance,
  CommercialAuditEntry,
  DataConflictRecord,
  CommercialCategory,
  CommercialRecordType,
  CommercialSupportingDocument
} from "../types/commercialWorkspace";

const STORAGE_PREFIX = "pm_commercial_v2_";

// Helper to get safe local storage key
const getStorageKey = (key: string, companyId: string, projectId?: string) => {
  return `${STORAGE_PREFIX}${key}_${companyId}_${projectId || "all"}`;
};

export class CommercialWorkspaceService {
  /**
   * Broadcast change event so Command Centre and other tabs update live
   */
  static notifyUpdate(companyId?: string, projectId?: string) {
    try {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("pm_commercial_data_updated", { detail: { companyId, projectId } }));
        window.dispatchEvent(new Event("storage"));
      }
    } catch {
      // ignore
    }
  }

  /**
   * Fetch All Commercial Overview Metrics strictly from verified records
   */
  static async getOverviewMetrics(
    companyId: string,
    projectId?: string,
    currency: string = "USD"
  ): Promise<CommercialOverviewMetrics> {
    if (!companyId) {
      return {
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
      };
    }

    try {
      // 1. Fetch Budgets
      const budgets = await this.getBudgetLines(companyId, projectId);
      const approvedBudget = budgets.length > 0
        ? budgets.reduce((acc, b) => acc + (b.revisedBudget || b.originalBudget || 0), 0)
        : null;

      // 2. Fetch Actual Costs
      const actuals = await this.getActualCosts(companyId, projectId);
      const actualCost = actuals.length > 0
        ? actuals
            .filter(a => a.status === "Posted")
            .reduce((acc, a) => acc + (a.net ?? a.total ?? 0), 0)
        : null;

      // 3. Fetch Commitments
      const commitments = await this.getCommitments(companyId, projectId);
      const committedCost = commitments.length > 0
        ? commitments
            .filter(c => c.status === "Approved" || c.status === "Closed" || c.status === "Submitted")
            .reduce((acc, c) => acc + (c.currentCommitment ?? c.originalValue ?? 0), 0)
        : null;

      // 4. Fetch Forecasts
      const forecasts = await this.getForecastLines(companyId, projectId);
      const forecastCostToComplete = forecasts.length > 0
        ? forecasts.reduce((acc, f) => acc + (f.forecastToComplete ?? 0), 0)
        : null;

      let forecastFinalCost: number | null = null;
      if (forecasts.length > 0) {
        forecastFinalCost = forecasts.reduce((acc, f) => acc + (f.forecastFinalCost ?? 0), 0);
      } else if (actualCost !== null || committedCost !== null) {
        forecastFinalCost = (actualCost || 0) + (committedCost || 0) + (forecastCostToComplete || 0);
      }

      // 5. Fetch Client Accounts / Certificates
      const clientCerts = await this.getClientCertificates(companyId, projectId);
      const certifiedToDate = clientCerts.length > 0
        ? clientCerts.reduce((acc, c) => acc + (c.certifiedAmount ?? c.appliedAmount ?? 0), 0)
        : null;

      const paidToDate = clientCerts.length > 0
        ? clientCerts.reduce((acc, c) => acc + (c.paidAmount ?? 0), 0)
        : null;

      const outstandingReceivables = certifiedToDate !== null && paidToDate !== null
        ? Math.max(0, certifiedToDate - paidToDate)
        : null;

      // 6. Contract Value & Variations from verified contracts or stored baseline
      const contractData = await this.getContractValues(companyId, projectId);
      const originalContractValue = contractData.originalContractValue;
      const approvedVariations = contractData.approvedVariations;
      const revisedContractValue = originalContractValue !== null
        ? originalContractValue + (approvedVariations || 0)
        : null;

      // 7. Cash & Bank position from verified bank transactions
      const bankTxs = await this.getBankTransactions(companyId, projectId);
      let currentCashPosition: number | null = null;
      if (bankTxs.length > 0) {
        const inflows = bankTxs.reduce((acc, t) => acc + (t.inflow || 0), 0);
        const outflows = bankTxs.reduce((acc, t) => acc + (t.outflow || 0), 0);
        currentCashPosition = inflows - outflows;
      }

      return {
        originalContractValue,
        approvedVariations,
        revisedContractValue,
        certifiedToDate,
        paidToDate,
        outstandingReceivables,
        approvedBudget,
        actualCost,
        committedCost,
        forecastCostToComplete,
        forecastFinalCost,
        currentCashPosition,
        currency
      };
    } catch (err) {
      console.error("Error calculating commercial overview metrics:", err);
      return {
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
      };
    }
  }

  /**
   * Get Contract Baseline & Approved Variations
   */
  static async getContractValues(
    companyId: string,
    projectId?: string
  ): Promise<{ originalContractValue: number | null; approvedVariations: number | null; revisedContractValue?: number | null }> {
    const key = getStorageKey("contract_values", companyId, projectId);
    let localResult: { originalContractValue: number | null; approvedVariations: number | null; revisedContractValue?: number | null } = {
      originalContractValue: null,
      approvedVariations: null,
      revisedContractValue: null
    };

    try {
      const stored = previewStorage.getItem(key);
      if (stored) {
        localResult = JSON.parse(stored);
      }
    } catch (e) {
      console.error("Failed to read contract values from storage:", e);
    }

    try {
      if (supabase && projectId) {
        const { data, error } = await supabase
          .from("projects")
          .select("contract_value, contract_currency")
          .eq("id", projectId)
          .maybeSingle();

        if (!error && data && data.contract_value) {
          const cv = Number(data.contract_value) || null;
          if (cv !== null) {
            return {
              originalContractValue: localResult.originalContractValue ?? cv,
              approvedVariations: localResult.approvedVariations ?? 0,
              revisedContractValue: (localResult.originalContractValue ?? cv) + (localResult.approvedVariations || 0)
            };
          }
        }
      }
    } catch {
      // ignore
    }

    return localResult;
  }

  static async saveContractValues(
    companyId: string,
    projectId: string | undefined,
    data: { originalContractValue: number | null; approvedVariations: number | null; source: SourceProvenance }
  ): Promise<void> {
    assertOperationalAction("write", "services/commercialWorkspaceService.ts");
    const key = getStorageKey("contract_values", companyId, projectId);
    previewStorage.setItem(key, JSON.stringify(data));
    this.notifyUpdate(companyId, projectId);
    this.addAuditEntry(companyId, projectId, {
      id: "aud-" + Date.now(),
      timestamp: new Date().toISOString(),
      action: "UPDATE",
      changedBy: data.source.uploadedBy || "System User",
      fieldName: "Contract Value & Variations",
      newValue: data,
      sourceDocument: data.source.originalFilename
    });
  }

  /**
   * 1. Budget Lines
   */
  static async getBudgetLines(companyId: string, projectId?: string): Promise<BudgetLineItem[]> {
    const key = getStorageKey("budgets", companyId, projectId);
    try {
      // 1. Try Supabase
      if (supabase) {
        let query = supabase.from("budget_lines").select("*").eq("company_id", companyId);
        if (projectId) query = query.eq("project_id", projectId);
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return data.map((b: any) => ({
            id: b.id,
            companyId: b.company_id,
            projectId: b.project_id,
            costCode: b.line_code || b.cost_category || "CODE-00",
            description: b.description || b.cost_category || "Budget Line",
            originalBudget: b.amount_excl_vat || 0,
            approvedChanges: 0,
            revisedBudget: b.amount_excl_vat || 0,
            currency: "USD",
            source: {
              originalFilename: "Database Synchronized",
              uploadDate: b.created_at || new Date().toISOString(),
              uploadedBy: "Database Record",
              importStatus: "VERIFIED",
              approvalStatus: "APPROVED"
            }
          }));
        }
      }

      // 2. Fallback to LocalStorage
      const local = previewStorage.getItem(key);
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.error("Error loading budget lines:", err);
    }
    return [];
  }

  static async saveBudgetLines(
    companyId: string,
    projectId: string | undefined,
    lines: BudgetLineItem[]
  ): Promise<void> {
    assertOperationalAction("write", "services/commercialWorkspaceService.ts");
    const key = getStorageKey("budgets", companyId, projectId);
    previewStorage.setItem(key, JSON.stringify(lines));
    this.notifyUpdate(companyId, projectId);
  }

  static async saveBudgetLine(
    companyId: string,
    projectId: string | undefined,
    item: BudgetLineItem,
    user: string = "User"
  ): Promise<BudgetLineItem[]> {
    assertOperationalAction("write", "services/commercialWorkspaceService.ts");
    const existing = await this.getBudgetLines(companyId, projectId);
    const index = existing.findIndex((b) => b.id === item.id);
    let updated: BudgetLineItem[];
    if (index >= 0) {
      updated = [...existing];
      updated[index] = { ...existing[index], ...item };
      this.addAuditEntry(companyId, projectId, {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: "UPDATE",
        changedBy: user,
        fieldName: "Budget Line",
        newValue: item.revisedBudget || item.originalBudget,
        notes: `Updated budget line ${item.costCode}`
      });
    } else {
      updated = [item, ...existing];
      this.addAuditEntry(companyId, projectId, {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: "CREATE",
        changedBy: user,
        fieldName: "Budget Line",
        newValue: item.revisedBudget || item.originalBudget,
        notes: `Created new budget line ${item.costCode}`
      });
    }
    await this.saveBudgetLines(companyId, projectId, updated);
    return updated;
  }

  static async deleteBudgetLine(
    companyId: string,
    projectId: string | undefined,
    id: string,
    user: string = "User"
  ): Promise<BudgetLineItem[]> {
    assertOperationalAction("delete", "services/commercialWorkspaceService.ts");
    const existing = await this.getBudgetLines(companyId, projectId);
    const item = existing.find((b) => b.id === id || b.costCode === id);
    const updated = existing.filter((b) => b.id !== id && b.costCode !== id);
    await this.saveBudgetLines(companyId, projectId, updated);
    this.addAuditEntry(companyId, projectId, {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: "DELETE",
      changedBy: user,
      fieldName: "Budget Line",
      notes: `Deleted budget line ${item?.costCode || id}`
    });
    return updated;
  }

  /**
   * Budget Versions
   */
  static async getBudgetVersions(companyId: string, projectId?: string): Promise<BudgetVersionRecord[]> {
    const key = getStorageKey("budget_versions", companyId, projectId);
    try {
      if (supabase) {
        let query = supabase.from("budget_versions").select("*").eq("company_id", companyId);
        if (projectId) query = query.eq("project_id", projectId);
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return data.map((b: any) => ({
            id: b.id,
            companyId: b.company_id,
            projectId: b.project_id,
            version: b.version_number || b.version || "Version",
            description: b.title || b.description || "Budget Snapshot",
            status: b.status === "APPROVED" ? "Current" : b.status === "REJECTED" ? "Superseded" : "Draft",
            effectiveDate: b.effective_date || b.created_at || new Date().toISOString().split("T")[0],
            originalBudget: b.original_budget ?? null,
            revisedBudget: b.total_budget ?? b.revised_budget ?? null,
            createdBy: b.created_by || "Authorized User",
            createdOn: b.created_at ? new Date(b.created_at).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
            documentsCount: b.documents_count || 0,
            documents: b.documents || []
          }));
        }
      }

      const local = previewStorage.getItem(key);
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.error("Error loading budget versions:", err);
    }
    return [];
  }

  static async saveBudgetVersions(
    companyId: string,
    projectId: string | undefined,
    versions: BudgetVersionRecord[]
  ): Promise<void> {
    assertOperationalAction("write", "services/commercialWorkspaceService.ts");
    const key = getStorageKey("budget_versions", companyId, projectId);
    previewStorage.setItem(key, JSON.stringify(versions));
    this.notifyUpdate(companyId, projectId);
  }

  static async saveBudgetVersion(
    companyId: string,
    projectId: string | undefined,
    version: BudgetVersionRecord,
    user: string = "User"
  ): Promise<BudgetVersionRecord[]> {
    assertOperationalAction("write", "services/commercialWorkspaceService.ts");
    const existing = await this.getBudgetVersions(companyId, projectId);
    const index = existing.findIndex((v) => v.id === version.id || v.version === version.version);
    let updated: BudgetVersionRecord[];
    if (index >= 0) {
      updated = [...existing];
      updated[index] = { ...existing[index], ...version };
    } else {
      updated = [version, ...existing];
    }
    await this.saveBudgetVersions(companyId, projectId, updated);
    this.addAuditEntry(companyId, projectId, {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: index >= 0 ? "UPDATE" : "CREATE",
      changedBy: user,
      fieldName: "Budget Version",
      newValue: version.version,
      notes: `Saved budget version ${version.version}`
    });
    return updated;
  }

  static async deleteBudgetVersion(
    companyId: string,
    projectId: string | undefined,
    id: string,
    user: string = "User"
  ): Promise<BudgetVersionRecord[]> {
    assertOperationalAction("delete", "services/commercialWorkspaceService.ts");
    const existing = await this.getBudgetVersions(companyId, projectId);
    const updated = existing.filter((v) => v.id !== id && v.version !== id);
    await this.saveBudgetVersions(companyId, projectId, updated);
    this.addAuditEntry(companyId, projectId, {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: "DELETE",
      changedBy: user,
      fieldName: "Budget Version",
      notes: `Deleted budget version ${id}`
    });
    return updated;
  }

  /**
   * 2. Forecast Lines
   */
  static async getForecastLines(companyId: string, projectId?: string): Promise<ForecastLineItem[]> {
    const key = getStorageKey("forecasts", companyId, projectId);
    try {
      const local = previewStorage.getItem(key);
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.error("Error loading forecast lines:", err);
    }
    return [];
  }

  static async saveForecastLines(
    companyId: string,
    projectId: string | undefined,
    lines: ForecastLineItem[]
  ): Promise<void> {
    assertOperationalAction("write", "services/commercialWorkspaceService.ts");
    const key = getStorageKey("forecasts", companyId, projectId);
    previewStorage.setItem(key, JSON.stringify(lines));
    this.notifyUpdate(companyId, projectId);
  }

  /**
   * 3. Commitments Register
   */
  static async getCommitments(companyId: string, projectId?: string): Promise<CommitmentRegisterItem[]> {
    const key = getStorageKey("commitments", companyId, projectId);
    try {
      if (supabase) {
        let query = supabase.from("financial_commitments").select("*").eq("company_id", companyId);
        if (projectId) query = query.eq("project_id", projectId);
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return data.map((c: any) => ({
            id: c.id,
            companyId: c.company_id,
            projectId: c.project_id,
            ref: c.commitment_reference || "REF-00",
            counterparty: c.counterparty_name || "Supplier",
            description: c.description || "",
            type: c.commitment_type || "Purchase Order",
            originalValue: c.original_amount_excl_vat || 0,
            changes: c.approved_variations_excl_vat || 0,
            currentCommitment: c.revised_commitment_excl_vat || c.original_amount_excl_vat || 0,
            paid: 0,
            outstanding: c.revised_commitment_excl_vat || c.original_amount_excl_vat || 0,
            status: c.status || "Approved",
            currency: c.currency_code || "USD",
            startDate: c.start_date,
            completionDate: c.completion_date,
            source: {
              originalFilename: "Database Synchronized",
              uploadDate: c.created_at || new Date().toISOString(),
              uploadedBy: "Database Record",
              importStatus: "VERIFIED",
              approvalStatus: "APPROVED"
            }
          }));
        }
      }

      const local = previewStorage.getItem(key);
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.error("Error loading commitments:", err);
    }
    return [];
  }

  static async saveCommitments(
    companyId: string,
    projectId: string | undefined,
    items: CommitmentRegisterItem[]
  ): Promise<void> {
    assertOperationalAction("write", "services/commercialWorkspaceService.ts");
    const key = getStorageKey("commitments", companyId, projectId);
    previewStorage.setItem(key, JSON.stringify(items));
    this.notifyUpdate(companyId, projectId);
  }

  static async saveCommitment(
    companyId: string,
    projectId: string | undefined,
    item: CommitmentRegisterItem,
    user: string = "User"
  ): Promise<CommitmentRegisterItem[]> {
    assertOperationalAction("write", "services/commercialWorkspaceService.ts");
    const existing = await this.getCommitments(companyId, projectId);
    const index = existing.findIndex((c) => c.id === item.id);
    let updated: CommitmentRegisterItem[];
    if (index >= 0) {
      updated = [...existing];
      updated[index] = { ...existing[index], ...item };
      this.addAuditEntry(companyId, projectId, {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: "UPDATE",
        changedBy: user,
        fieldName: "Commitment",
        newValue: item.currentCommitment ?? item.originalValue,
        notes: `Updated commitment ${item.ref} (${item.counterparty})`
      });
    } else {
      updated = [item, ...existing];
      this.addAuditEntry(companyId, projectId, {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: "CREATE",
        changedBy: user,
        fieldName: "Commitment",
        newValue: item.currentCommitment ?? item.originalValue,
        notes: `Created commitment ${item.ref} (${item.counterparty})`
      });
    }
    await this.saveCommitments(companyId, projectId, updated);
    return updated;
  }

  static async deleteCommitment(
    companyId: string,
    projectId: string | undefined,
    id: string,
    user: string = "User"
  ): Promise<CommitmentRegisterItem[]> {
    assertOperationalAction("delete", "services/commercialWorkspaceService.ts");
    const existing = await this.getCommitments(companyId, projectId);
    const item = existing.find((c) => c.id === id || c.ref === id);
    const updated = existing.filter((c) => c.id !== id && c.ref !== id);
    await this.saveCommitments(companyId, projectId, updated);
    this.addAuditEntry(companyId, projectId, {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: "DELETE",
      changedBy: user,
      fieldName: "Commitment",
      notes: `Deleted commitment ${item?.ref || id}`
    });
    return updated;
  }

  /**
   * 4. Actual Costs Register
   */
  static async getActualCosts(companyId: string, projectId?: string): Promise<ActualCostRegisterItem[]> {
    const key = getStorageKey("actual_costs", companyId, projectId);
    try {
      if (supabase) {
        let query = supabase.from("financial_cost_postings").select("*").eq("company_id", companyId);
        if (projectId) query = query.eq("project_id", projectId);
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return data.map((a: any) => ({
            id: a.id,
            companyId: a.company_id,
            projectId: a.project_id,
            date: a.posting_date || new Date().toISOString().split("T")[0],
            costCode: a.cost_category || "COST-00",
            description: a.description || "",
            supplier: a.source_reference || "Vendor",
            reference: a.posting_reference || "TX-00",
            net: a.amount_excl_vat || 0,
            tax: 0,
            total: a.amount_excl_vat || 0,
            sourceType: a.source_type || "Supplier Invoice",
            status: a.status || "Posted",
            currency: a.currency_code || "USD",
            source: {
              originalFilename: "Database Synchronized",
              uploadDate: a.created_at || new Date().toISOString(),
              uploadedBy: "Database Record",
              importStatus: "VERIFIED",
              approvalStatus: "POSTED"
            }
          }));
        }
      }

      const local = previewStorage.getItem(key);
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.error("Error loading actual costs:", err);
    }
    return [];
  }

  static async saveActualCosts(
    companyId: string,
    projectId: string | undefined,
    items: ActualCostRegisterItem[]
  ): Promise<void> {
    assertOperationalAction("write", "services/commercialWorkspaceService.ts");
    const key = getStorageKey("actual_costs", companyId, projectId);
    previewStorage.setItem(key, JSON.stringify(items));
    this.notifyUpdate(companyId, projectId);
  }

  static async saveActualCost(
    companyId: string,
    projectId: string | undefined,
    item: ActualCostRegisterItem,
    user: string = "User"
  ): Promise<ActualCostRegisterItem[]> {
    assertOperationalAction("write", "services/commercialWorkspaceService.ts");
    const existing = await this.getActualCosts(companyId, projectId);
    const index = existing.findIndex((c) => c.id === item.id);
    let updated: ActualCostRegisterItem[];
    if (index >= 0) {
      updated = [...existing];
      updated[index] = { ...existing[index], ...item };
      this.addAuditEntry(companyId, projectId, {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: "UPDATE",
        changedBy: user,
        fieldName: "Actual Cost",
        newValue: item.total || item.net,
        notes: `Updated actual cost ${item.reference} (${item.supplier})`
      });
    } else {
      updated = [item, ...existing];
      this.addAuditEntry(companyId, projectId, {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: "CREATE",
        changedBy: user,
        fieldName: "Actual Cost",
        newValue: item.total || item.net,
        notes: `Created actual cost ${item.reference} (${item.supplier})`
      });
    }
    await this.saveActualCosts(companyId, projectId, updated);
    return updated;
  }

  static async deleteActualCost(
    companyId: string,
    projectId: string | undefined,
    id: string,
    user: string = "User"
  ): Promise<ActualCostRegisterItem[]> {
    assertOperationalAction("delete", "services/commercialWorkspaceService.ts");
    const existing = await this.getActualCosts(companyId, projectId);
    const item = existing.find((c) => c.id === id || c.reference === id);
    const updated = existing.filter((c) => c.id !== id && c.reference !== id);
    await this.saveActualCosts(companyId, projectId, updated);
    this.addAuditEntry(companyId, projectId, {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: "DELETE",
      changedBy: user,
      fieldName: "Actual Cost",
      notes: `Deleted cost record ${item?.reference || id}`
    });
    return updated;
  }

  /**
   * 5. Client Accounts & Certificates
   */
  static async getClientCertificates(
    companyId: string,
    projectId?: string
  ): Promise<ClientCertificateRecord[]> {
    const key = getStorageKey("client_certificates", companyId, projectId);
    let localRecords: ClientCertificateRecord[] = [];
    try {
      const local = previewStorage.getItem(key);
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) localRecords = parsed;
      }
    } catch (err) {
      console.error("Error loading client certificates:", err);
    }

    try {
      if (supabase) {
        let query = supabase.from("client_certificates").select("*").eq("company_id", companyId);
        if (projectId) query = query.eq("project_id", projectId);
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          const dbRecords: ClientCertificateRecord[] = data.map((c: any) => ({
            id: c.id,
            companyId: c.company_id,
            projectId: c.project_id,
            certificateNumber: c.certificate_number || c.cert_number || "IPC-00",
            period: c.period || "Current",
            client: c.client_name || "Employer",
            issueDate: c.issue_date || new Date().toISOString().split("T")[0],
            paymentDueDate: c.due_date || new Date().toISOString().split("T")[0],
            appliedAmount: c.applied_amount || c.claimed_amount || 0,
            certifiedAmount: c.certified_amount || c.amount || 0,
            invoicedAmount: c.invoiced_amount ?? c.certified_amount ?? null,
            retentionWithheld: c.retention_amount || 0,
            paidAmount: c.paid_amount || 0,
            outstandingAmount: (c.certified_amount || 0) - (c.paid_amount || 0),
            status: c.status || "Certified",
            currency: c.currency || "USD",
            source: {
              originalFilename: "Database Synchronized",
              uploadDate: c.created_at || new Date().toISOString(),
              uploadedBy: "Database Record",
              importStatus: "VERIFIED",
              approvalStatus: "APPROVED"
            }
          }));
          const idMap = new Map<string, ClientCertificateRecord>();
          dbRecords.forEach((r: ClientCertificateRecord) => idMap.set(r.id, r));
          localRecords.forEach((r: ClientCertificateRecord) => { if (!idMap.has(r.id)) idMap.set(r.id, r); });
          return Array.from(idMap.values());
        }
      }
    } catch {
      // ignore
    }

    return localRecords;
  }

  static async saveClientCertificates(
    companyId: string,
    projectId: string | undefined,
    items: ClientCertificateRecord[]
  ): Promise<void> {
    assertOperationalAction("write", "services/commercialWorkspaceService.ts");
    const key = getStorageKey("client_certificates", companyId, projectId);
    previewStorage.setItem(key, JSON.stringify(items));
    this.notifyUpdate(companyId, projectId);
  }

  static async saveClientCertificate(
    companyId: string,
    projectId: string | undefined,
    item: ClientCertificateRecord,
    user: string = "User"
  ): Promise<ClientCertificateRecord[]> {
    assertOperationalAction("write", "services/commercialWorkspaceService.ts");
    const existing = await this.getClientCertificates(companyId, projectId);
    const index = existing.findIndex((c) => c.id === item.id);
    let updated: ClientCertificateRecord[];
    if (index >= 0) {
      updated = [...existing];
      updated[index] = { ...existing[index], ...item };
      this.addAuditEntry(companyId, projectId, {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: "UPDATE",
        changedBy: user,
        fieldName: "Client Certificate",
        newValue: item.certifiedAmount ?? item.appliedAmount,
        notes: `Updated certificate ${item.certificateNumber}`
      });
    } else {
      updated = [item, ...existing];
      this.addAuditEntry(companyId, projectId, {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: "CREATE",
        changedBy: user,
        fieldName: "Client Certificate",
        newValue: item.certifiedAmount ?? item.appliedAmount,
        notes: `Created certificate ${item.certificateNumber}`
      });
    }
    await this.saveClientCertificates(companyId, projectId, updated);
    return updated;
  }

  static async deleteClientCertificate(
    companyId: string,
    projectId: string | undefined,
    id: string,
    user: string = "User"
  ): Promise<ClientCertificateRecord[]> {
    assertOperationalAction("delete", "services/commercialWorkspaceService.ts");
    const existing = await this.getClientCertificates(companyId, projectId);
    const item = existing.find((c) => c.id === id || c.certificateNumber === id || c.claimReference === id);
    const updated = existing.filter((c) => c.id !== id && c.certificateNumber !== id && c.claimReference !== id);
    await this.saveClientCertificates(companyId, projectId, updated);
    this.addAuditEntry(companyId, projectId, {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: "DELETE",
      changedBy: user,
      fieldName: "Client Certificate",
      notes: `Deleted client certificate ${item?.certificateNumber || id}`
    });
    return updated;
  }

  /**
   * 6. Supplier Invoices & Directory
   */
  static async getSupplierInvoices(
    companyId: string,
    projectId?: string
  ): Promise<SupplierInvoiceRecord[]> {
    const key = getStorageKey("supplier_invoices", companyId, projectId);
    try {
      if (supabase) {
        let query = supabase.from("supplier_invoices").select("*").eq("company_id", companyId);
        if (projectId) query = query.eq("project_id", projectId);
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return data.map((inv: any) => ({
            id: inv.id,
            companyId: inv.company_id,
            projectId: inv.project_id,
            invoiceNumber: inv.supplier_invoice_number || "INV-00",
            supplier: inv.external_reference || "Supplier",
            supplierId: inv.supplier_account_id,
            date: inv.invoice_date || new Date().toISOString().split("T")[0],
            dueDate: inv.due_date || new Date().toISOString().split("T")[0],
            net: inv.subtotal_excl_vat || 0,
            tax: inv.vat_amount || 0,
            total: inv.total_incl_vat || 0,
            paid: 0,
            outstanding: inv.total_incl_vat || 0,
            status: inv.status || "Approved",
            currency: inv.currency || "USD",
            source: {
              originalFilename: "Database Synchronized",
              uploadDate: inv.created_at || new Date().toISOString(),
              uploadedBy: "Database Record",
              importStatus: "VERIFIED",
              approvalStatus: "POSTED"
            }
          }));
        }
      }

      const local = previewStorage.getItem(key);
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.error("Error loading supplier invoices:", err);
    }
    return [];
  }

  static async saveSupplierInvoices(
    companyId: string,
    projectId: string | undefined,
    items: SupplierInvoiceRecord[]
  ): Promise<void> {
    assertOperationalAction("write", "services/commercialWorkspaceService.ts");
    const key = getStorageKey("supplier_invoices", companyId, projectId);
    previewStorage.setItem(key, JSON.stringify(items));
    this.notifyUpdate(companyId, projectId);
  }

  static async saveSupplierInvoice(
    companyId: string,
    projectId: string | undefined,
    item: SupplierInvoiceRecord,
    user: string = "User"
  ): Promise<SupplierInvoiceRecord[]> {
    assertOperationalAction("write", "services/commercialWorkspaceService.ts");
    const existing = await this.getSupplierInvoices(companyId, projectId);
    const index = existing.findIndex((c) => c.id === item.id);
    let updated: SupplierInvoiceRecord[];
    if (index >= 0) {
      updated = [...existing];
      updated[index] = { ...existing[index], ...item };
      this.addAuditEntry(companyId, projectId, {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: "UPDATE",
        changedBy: user,
        fieldName: "Supplier Invoice",
        newValue: item.total || item.amount,
        notes: `Updated invoice ${item.invoiceNumber} (${item.supplier || item.supplierName})`
      });
    } else {
      updated = [item, ...existing];
      this.addAuditEntry(companyId, projectId, {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: "CREATE",
        changedBy: user,
        fieldName: "Supplier Invoice",
        newValue: item.total || item.amount,
        notes: `Created invoice ${item.invoiceNumber} (${item.supplier || item.supplierName})`
      });
    }
    await this.saveSupplierInvoices(companyId, projectId, updated);
    return updated;
  }

  static async deleteSupplierInvoice(
    companyId: string,
    projectId: string | undefined,
    id: string,
    user: string = "User"
  ): Promise<SupplierInvoiceRecord[]> {
    assertOperationalAction("delete", "services/commercialWorkspaceService.ts");
    const existing = await this.getSupplierInvoices(companyId, projectId);
    const item = existing.find((c) => c.id === id || c.invoiceNumber === id);
    const updated = existing.filter((c) => c.id !== id && c.invoiceNumber !== id);
    await this.saveSupplierInvoices(companyId, projectId, updated);
    this.addAuditEntry(companyId, projectId, {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: "DELETE",
      changedBy: user,
      fieldName: "Supplier Invoice",
      notes: `Deleted supplier invoice ${item?.invoiceNumber || id}`
    });
    return updated;
  }

  static async getSupplierDirectory(companyId: string): Promise<SupplierDirectoryItem[]> {
    const key = getStorageKey("supplier_directory", companyId);
    try {
      const local = previewStorage.getItem(key);
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.error("Error loading supplier directory:", err);
    }
    return [];
  }

  static async saveSupplierDirectory(
    companyId: string,
    items: SupplierDirectoryItem[]
  ): Promise<void> {
    assertOperationalAction("write", "services/commercialWorkspaceService.ts");
    const key = getStorageKey("supplier_directory", companyId);
    previewStorage.setItem(key, JSON.stringify(items));
  }

  /**
   * 7. Cash & Bank Transactions
   */
  static async getBankTransactions(
    companyId: string,
    projectId?: string
  ): Promise<BankTransactionRecord[]> {
    const key = getStorageKey("bank_transactions", companyId, projectId);
    let localRecords: BankTransactionRecord[] = [];
    try {
      const local = previewStorage.getItem(key);
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) localRecords = parsed;
      }
    } catch (err) {
      console.error("Error loading bank transactions:", err);
    }

    try {
      if (supabase) {
        let query = supabase.from("bank_transactions").select("*").eq("company_id", companyId);
        if (projectId) query = query.eq("project_id", projectId);
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          const dbRecords: BankTransactionRecord[] = data.map((t: any) => ({
            id: t.id,
            companyId: t.company_id,
            projectId: t.project_id,
            bankAccountId: t.bank_account_id || "acc-main",
            accountName: t.account_name || "Main Treasury",
            date: t.transaction_date || t.date || new Date().toISOString().split("T")[0],
            transactionType: t.transaction_type || (t.inflow > 0 ? "Receipt" : "Payment"),
            reference: t.reference || t.ref || "TX-00",
            payeeOrPayer: t.payee_or_payer || t.payee || "Entity",
            description: t.description || "Bank Entry",
            inflow: t.inflow || t.credit || 0,
            outflow: t.outflow || t.debit || 0,
            balanceAfter: t.balance_after || t.balance || 0,
            status: t.status || (t.reconciled ? "Reconciled" : "Unreconciled"),
            reconciled: t.reconciled ?? true,
            currency: t.currency || "USD",
            source: {
              originalFilename: "Database Synchronized",
              uploadDate: t.created_at || new Date().toISOString(),
              uploadedBy: "Database Record",
              importStatus: "VERIFIED",
              approvalStatus: "APPROVED"
            }
          }));
          const idMap = new Map<string, BankTransactionRecord>();
          dbRecords.forEach((r: BankTransactionRecord) => idMap.set(r.id, r));
          localRecords.forEach((r: BankTransactionRecord) => { if (!idMap.has(r.id)) idMap.set(r.id, r); });
          return Array.from(idMap.values());
        }
      }
    } catch {
      // ignore
    }

    return localRecords;
  }

  static async saveBankTransactions(
    companyId: string,
    projectId: string | undefined,
    items: BankTransactionRecord[]
  ): Promise<void> {
    assertOperationalAction("write", "services/commercialWorkspaceService.ts");
    const key = getStorageKey("bank_transactions", companyId, projectId);
    previewStorage.setItem(key, JSON.stringify(items));
    this.notifyUpdate(companyId, projectId);
  }

  static async saveBankTransaction(
    companyId: string,
    projectId: string | undefined,
    item: BankTransactionRecord,
    user: string = "User"
  ): Promise<BankTransactionRecord[]> {
    assertOperationalAction("write", "services/commercialWorkspaceService.ts");
    const existing = await this.getBankTransactions(companyId, projectId);
    const index = existing.findIndex((c) => c.id === item.id);
    let updated: BankTransactionRecord[];
    if (index >= 0) {
      updated = [...existing];
      updated[index] = { ...existing[index], ...item };
      this.addAuditEntry(companyId, projectId, {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: "UPDATE",
        changedBy: user,
        fieldName: "Bank Transaction",
        newValue: item.amount ?? (item.inflow || item.outflow),
        notes: `Updated bank transaction ${item.reference || item.transactionRef}`
      });
    } else {
      updated = [item, ...existing];
      this.addAuditEntry(companyId, projectId, {
        id: `audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        action: "CREATE",
        changedBy: user,
        fieldName: "Bank Transaction",
        newValue: item.amount ?? (item.inflow || item.outflow),
        notes: `Recorded bank movement ${item.reference || item.transactionRef}`
      });
    }
    await this.saveBankTransactions(companyId, projectId, updated);
    return updated;
  }

  static async deleteBankTransaction(
    companyId: string,
    projectId: string | undefined,
    id: string,
    user: string = "User"
  ): Promise<BankTransactionRecord[]> {
    assertOperationalAction("delete", "services/commercialWorkspaceService.ts");
    const existing = await this.getBankTransactions(companyId, projectId);
    const item = existing.find((c) => c.id === id || c.reference === id || c.transactionRef === id);
    const updated = existing.filter((c) => c.id !== id && c.reference !== id && c.transactionRef !== id);
    await this.saveBankTransactions(companyId, projectId, updated);
    this.addAuditEntry(companyId, projectId, {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: "DELETE",
      changedBy: user,
      fieldName: "Bank Transaction",
      notes: `Deleted bank transaction ${item?.reference || item?.transactionRef || id}`
    });
    return updated;
  }

  /**
   * Universal Attachment CRUD operations across registers
   * GUARANTEE: Deleting an attachment deletes ONLY the attachment and preserves the commercial record.
   */
  static async addAttachmentToRecord(
    companyId: string,
    projectId: string | undefined,
    recordType: CommercialRecordType,
    recordId: string,
    doc: CommercialSupportingDocument,
    user: string = "User"
  ): Promise<CommercialSupportingDocument[]> {
    assertOperationalAction("create", "services/commercialWorkspaceService.ts");
    let docs: CommercialSupportingDocument[] = [];
    if (recordType === "BUDGET") {
      const items = await this.getBudgetLines(companyId, projectId);
      const item = items.find((i) => i.id === recordId);
      if (item) {
        docs = [...(item.documents || []), doc];
        item.documents = docs;
        await this.saveBudgetLines(companyId, projectId, items);
      }
    } else if (recordType === "COMMITMENT") {
      const items = await this.getCommitments(companyId, projectId);
      const item = items.find((i) => i.id === recordId);
      if (item) {
        docs = [...(item.documents || []), doc];
        item.documents = docs;
        await this.saveCommitments(companyId, projectId, items);
      }
    } else if (recordType === "ACTUAL_COST") {
      const items = await this.getActualCosts(companyId, projectId);
      const item = items.find((i) => i.id === recordId);
      if (item) {
        docs = [...(item.documents || []), doc];
        item.documents = docs;
        await this.saveActualCosts(companyId, projectId, items);
      }
    } else if (recordType === "CLIENT_CERTIFICATE") {
      const items = await this.getClientCertificates(companyId, projectId);
      const item = items.find((i) => i.id === recordId);
      if (item) {
        docs = [...(item.documents || []), doc];
        item.documents = docs;
        await this.saveClientCertificates(companyId, projectId, items);
      }
    } else if (recordType === "SUPPLIER_INVOICE") {
      const items = await this.getSupplierInvoices(companyId, projectId);
      const item = items.find((i) => i.id === recordId);
      if (item) {
        docs = [...(item.documents || []), doc];
        item.documents = docs;
        await this.saveSupplierInvoices(companyId, projectId, items);
      }
    } else if (recordType === "BANK_TRANSACTION") {
      const items = await this.getBankTransactions(companyId, projectId);
      const item = items.find((i) => i.id === recordId);
      if (item) {
        docs = [...(item.documents || []), doc];
        item.documents = docs;
        await this.saveBankTransactions(companyId, projectId, items);
      }
    }

    this.addAuditEntry(companyId, projectId, {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: "UPDATE",
      changedBy: user,
      fieldName: "Attachments",
      notes: `Attached document ${doc.name} (${doc.type})`
    });

    return docs;
  }

  static async deleteAttachmentFromRecord(
    companyId: string,
    projectId: string | undefined,
    recordType: CommercialRecordType,
    recordId: string,
    documentId: string,
    user: string = "User"
  ): Promise<CommercialSupportingDocument[]> {
    assertOperationalAction("delete", "services/commercialWorkspaceService.ts");
    let remainingDocs: CommercialSupportingDocument[] = [];
    let deletedDocName = "Document";

    if (recordType === "BUDGET") {
      const items = await this.getBudgetLines(companyId, projectId);
      const item = items.find((i) => i.id === recordId);
      if (item && item.documents) {
        deletedDocName = item.documents.find((d) => d.id === documentId)?.name || "Document";
        remainingDocs = item.documents.filter((d) => d.id !== documentId);
        item.documents = remainingDocs;
        await this.saveBudgetLines(companyId, projectId, items);
      }
    } else if (recordType === "COMMITMENT") {
      const items = await this.getCommitments(companyId, projectId);
      const item = items.find((i) => i.id === recordId);
      if (item && item.documents) {
        deletedDocName = item.documents.find((d) => d.id === documentId)?.name || "Document";
        remainingDocs = item.documents.filter((d) => d.id !== documentId);
        item.documents = remainingDocs;
        await this.saveCommitments(companyId, projectId, items);
      }
    } else if (recordType === "ACTUAL_COST") {
      const items = await this.getActualCosts(companyId, projectId);
      const item = items.find((i) => i.id === recordId);
      if (item && item.documents) {
        deletedDocName = item.documents.find((d) => d.id === documentId)?.name || "Document";
        remainingDocs = item.documents.filter((d) => d.id !== documentId);
        item.documents = remainingDocs;
        await this.saveActualCosts(companyId, projectId, items);
      }
    } else if (recordType === "CLIENT_CERTIFICATE") {
      const items = await this.getClientCertificates(companyId, projectId);
      const item = items.find((i) => i.id === recordId);
      if (item && item.documents) {
        deletedDocName = item.documents.find((d) => d.id === documentId)?.name || "Document";
        remainingDocs = item.documents.filter((d) => d.id !== documentId);
        item.documents = remainingDocs;
        await this.saveClientCertificates(companyId, projectId, items);
      }
    } else if (recordType === "SUPPLIER_INVOICE") {
      const items = await this.getSupplierInvoices(companyId, projectId);
      const item = items.find((i) => i.id === recordId);
      if (item && item.documents) {
        deletedDocName = item.documents.find((d) => d.id === documentId)?.name || "Document";
        remainingDocs = item.documents.filter((d) => d.id !== documentId);
        item.documents = remainingDocs;
        await this.saveSupplierInvoices(companyId, projectId, items);
      }
    } else if (recordType === "BANK_TRANSACTION") {
      const items = await this.getBankTransactions(companyId, projectId);
      const item = items.find((i) => i.id === recordId);
      if (item && item.documents) {
        deletedDocName = item.documents.find((d) => d.id === documentId)?.name || "Document";
        remainingDocs = item.documents.filter((d) => d.id !== documentId);
        item.documents = remainingDocs;
        await this.saveBankTransactions(companyId, projectId, items);
      }
    }

    this.addAuditEntry(companyId, projectId, {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: "UPDATE",
      changedBy: user,
      fieldName: "Attachments",
      notes: `Deleted attachment ${deletedDocName}`
    });

    return remainingDocs;
  }

  static async replaceAttachmentInRecord(
    companyId: string,
    projectId: string | undefined,
    recordType: CommercialRecordType,
    recordId: string,
    documentId: string,
    newDoc: CommercialSupportingDocument,
    user: string = "User"
  ): Promise<CommercialSupportingDocument[]> {
    let updatedDocs: CommercialSupportingDocument[] = [];

    const replaceInArray = (docs: CommercialSupportingDocument[] = []) => {
      return docs.map((d) => {
        if (d.id === documentId) {
          return {
            ...d,
            name: newDoc.name,
            fileData: newDoc.fileData || d.fileData,
            fileType: newDoc.fileType || d.fileType,
            size: newDoc.size || d.size,
            uploadedOn: new Date().toISOString(),
            uploadedBy: user,
            version: (d.version || 1) + 1,
            notes: newDoc.notes || d.notes
          };
        }
        return d;
      });
    };

    if (recordType === "BUDGET") {
      const items = await this.getBudgetLines(companyId, projectId);
      const item = items.find((i) => i.id === recordId);
      if (item) {
        updatedDocs = replaceInArray(item.documents);
        item.documents = updatedDocs;
        await this.saveBudgetLines(companyId, projectId, items);
      }
    } else if (recordType === "COMMITMENT") {
      const items = await this.getCommitments(companyId, projectId);
      const item = items.find((i) => i.id === recordId);
      if (item) {
        updatedDocs = replaceInArray(item.documents);
        item.documents = updatedDocs;
        await this.saveCommitments(companyId, projectId, items);
      }
    } else if (recordType === "ACTUAL_COST") {
      const items = await this.getActualCosts(companyId, projectId);
      const item = items.find((i) => i.id === recordId);
      if (item) {
        updatedDocs = replaceInArray(item.documents);
        item.documents = updatedDocs;
        await this.saveActualCosts(companyId, projectId, items);
      }
    } else if (recordType === "CLIENT_CERTIFICATE") {
      const items = await this.getClientCertificates(companyId, projectId);
      const item = items.find((i) => i.id === recordId);
      if (item) {
        updatedDocs = replaceInArray(item.documents);
        item.documents = updatedDocs;
        await this.saveClientCertificates(companyId, projectId, items);
      }
    } else if (recordType === "SUPPLIER_INVOICE") {
      const items = await this.getSupplierInvoices(companyId, projectId);
      const item = items.find((i) => i.id === recordId);
      if (item) {
        updatedDocs = replaceInArray(item.documents);
        item.documents = updatedDocs;
        await this.saveSupplierInvoices(companyId, projectId, items);
      }
    } else if (recordType === "BANK_TRANSACTION") {
      const items = await this.getBankTransactions(companyId, projectId);
      const item = items.find((i) => i.id === recordId);
      if (item) {
        updatedDocs = replaceInArray(item.documents);
        item.documents = updatedDocs;
        await this.saveBankTransactions(companyId, projectId, items);
      }
    }

    this.addAuditEntry(companyId, projectId, {
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString(),
      action: "UPDATE",
      changedBy: user,
      fieldName: "Attachments",
      notes: `Replaced document with ${newDoc.name}`
    });

    return updatedDocs;
  }

  /**
   * Audit Trail
   */
  static async getAuditTrail(companyId: string, projectId?: string): Promise<CommercialAuditEntry[]> {
    const key = getStorageKey("audit_trail", companyId, projectId);
    try {
      const local = previewStorage.getItem(key);
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.error("Error loading audit trail:", err);
    }
    return [];
  }

  static addAuditEntry(
    companyId: string,
    projectId: string | undefined,
    entry: CommercialAuditEntry
  ): void {
    assertOperationalAction("create", "services/commercialWorkspaceService.ts");
    const key = getStorageKey("audit_trail", companyId, projectId);
    try {
      const existing = previewStorage.getItem(key);
      const parsed = existing ? JSON.parse(existing) : [];
      parsed.unshift(entry);
      previewStorage.setItem(key, JSON.stringify(parsed.slice(0, 500))); // keep latest 500
    } catch (err) {
      console.error("Error saving audit entry:", err);
    }
  }

  /**
   * Duplicate Detection
   */
  static async detectDuplicates(
    companyId: string,
    projectId: string | undefined,
    category: CommercialCategory,
    candidates: any[]
  ): Promise<{ isDuplicate: boolean; matchedRecord?: any; reason?: string }[]> {
    const results: { isDuplicate: boolean; matchedRecord?: any; reason?: string }[] = [];

    if (category === "BUDGET") {
      const existing = await this.getBudgetLines(companyId, projectId);
      for (const cand of candidates) {
        const match = existing.find(e => e.costCode.toLowerCase().trim() === (cand.costCode || "").toLowerCase().trim());
        if (match) {
          results.push({ isDuplicate: true, matchedRecord: match, reason: `Cost code "${match.costCode}" already exists in active budget baseline.` });
        } else {
          results.push({ isDuplicate: false });
        }
      }
    } else if (category === "SUPPLIER_INVOICE") {
      const existing = await this.getSupplierInvoices(companyId, projectId);
      for (const cand of candidates) {
        const match = existing.find(e => e.invoiceNumber.toLowerCase().trim() === (cand.invoiceNumber || "").toLowerCase().trim());
        if (match) {
          results.push({ isDuplicate: true, matchedRecord: match, reason: `Supplier invoice "${match.invoiceNumber}" already exists.` });
        } else {
          results.push({ isDuplicate: false });
        }
      }
    } else if (category === "PAYMENT_CERTIFICATE") {
      const existing = await this.getClientCertificates(companyId, projectId);
      for (const cand of candidates) {
        const match = existing.find(e => e.certificateNumber.toLowerCase().trim() === (cand.certificateNumber || "").toLowerCase().trim());
        if (match) {
          results.push({ isDuplicate: true, matchedRecord: match, reason: `Payment certificate "${match.certificateNumber}" already exists.` });
        } else {
          results.push({ isDuplicate: false });
        }
      }
    } else if (category === "COMMITMENT" || category === "PURCHASE_ORDER" || category === "SUBCONTRACT") {
      const existing = await this.getCommitments(companyId, projectId);
      for (const cand of candidates) {
        const match = existing.find(e => e.ref.toLowerCase().trim() === (cand.ref || "").toLowerCase().trim());
        if (match) {
          results.push({ isDuplicate: true, matchedRecord: match, reason: `Commitment reference "${match.ref}" already exists.` });
        } else {
          results.push({ isDuplicate: false });
        }
      }
    } else {
      for (let i = 0; i < candidates.length; i++) {
        results.push({ isDuplicate: false });
      }
    }

    return results;
  }
}
