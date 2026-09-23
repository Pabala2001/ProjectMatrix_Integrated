import { previewStorage } from "../integration/previewStorage";
import { assertOperationalAction } from "../integration/operationalAccess";
import { supabase } from "../lib/supabase";
import { ProjectContractRecord, ContractAttachment, ContractKPIs } from "../types/contractManagement";

const STORAGE_KEY_PREFIX = "project_matrix_contracts_v1_";

export class ContractsService {
  /**
   * Helper to get previewStorage key for a specific project
   */
  private static getStorageKey(projectId: string): string {
    return `${STORAGE_KEY_PREFIX}${projectId || "default"}`;
  }

  /**
   * Read all contracts for a specific project from persistent local storage
   */
  private static readLocalContracts(projectId: string): ProjectContractRecord[] {
    try {
      const raw = previewStorage.getItem(this.getStorageKey(projectId));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn("Error reading local contracts for project", projectId, e);
      return [];
    }
  }

  /**
   * Write all contracts for a specific project to persistent local storage
   */
  private static writeLocalContracts(projectId: string, contracts: ProjectContractRecord[]): void {
    try {
      previewStorage.setItem(this.getStorageKey(projectId), JSON.stringify(contracts));
    } catch (e) {
      console.error("Error saving local contracts for project", projectId, e);
    }
  }

  /**
   * Fetch all contracts linked to the specified project.
   * If none exist in the database or local storage, returns an empty array (no mock data).
   */
  public static async getContractsByProject(projectId: string): Promise<ProjectContractRecord[]> {
    if (!projectId) return [];
    
    // First try local cache
    const local = this.readLocalContracts(projectId);
    
    // Attempt background sync with Supabase if table exists
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from("project_contracts")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          const mapped: ProjectContractRecord[] = data.map((d: any) => ({
            id: d.id,
            projectId: d.project_id || projectId,
            projectName: d.project_name,
            contractNumber: d.contract_number || d.reference_number || "CON-000",
            contractTitle: d.contract_title || d.title || "Untitled Contract",
            client: d.client || d.employer || "-",
            contractor: d.contractor || "-",
            contractType: d.contract_type || "FIDIC",
            contractValue: Number(d.contract_value || d.amount || 0),
            currency: d.currency || "USD",
            startDate: d.start_date || d.commencement_date || "",
            completionDate: d.completion_date || "",
            status: d.status || "Draft",
            description: d.description || "",
            scopeOfWorks: d.scope_of_works || "",
            governingLaw: d.governing_law,
            disputeResolutionMethod: d.dispute_resolution_method,
            engineerOrPM: d.engineer_or_pm,
            advancePaymentPercent: d.advance_payment_percent,
            retentionPercent: d.retention_percent,
            performanceSecurityPercent: d.performance_security_percent,
            delayDamagesPerDay: d.delay_damages_per_day,
            attachments: Array.isArray(d.attachments) ? d.attachments : [],
            createdAt: d.created_at || new Date().toISOString(),
            updatedAt: d.updated_at || new Date().toISOString(),
            createdBy: d.created_by
          }));
          this.writeLocalContracts(projectId, mapped);
          return mapped;
        }
      }
    } catch (err) {
      // Graceful fallback to local cache
    }

    return local;
  }

  /**
   * Synchronous accessor for instantaneous render
   */
  public static getContractsByProjectSync(projectId: string): ProjectContractRecord[] {
    if (!projectId) return [];
    return this.readLocalContracts(projectId);
  }

  /**
   * Get a single contract by ID within a project
   */
  public static async getContractById(projectId: string, contractId: string): Promise<ProjectContractRecord | null> {
    const list = await this.getContractsByProject(projectId);
    return list.find(c => c.id === contractId) || null;
  }

  /**
   * Create and store a new Contract record linked to the active project
   */
  public static async createContract(
    projectId: string,
    contractData: Omit<ProjectContractRecord, "id" | "projectId" | "createdAt" | "updatedAt">
  ): Promise<ProjectContractRecord> {
    assertOperationalAction("create", "services/contractsService.ts");
    if (!projectId) {
      throw new Error("Project ID is required to create a contract.");
    }

    const now = new Date().toISOString();
    const id = `con_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const newRecord: ProjectContractRecord = {
      id,
      projectId,
      ...contractData,
      attachments: contractData.attachments || [],
      createdAt: now,
      updatedAt: now
    };

    const existing = this.readLocalContracts(projectId);
    const updated = [newRecord, ...existing];
    this.writeLocalContracts(projectId, updated);

    // Try persisting to Supabase if table is configured
    try {
      if (supabase) {
        await supabase.from("project_contracts").insert({
          id: newRecord.id,
          project_id: projectId,
          contract_number: newRecord.contractNumber,
          contract_title: newRecord.contractTitle,
          client: newRecord.client,
          contractor: newRecord.contractor,
          contract_type: newRecord.contractType,
          contract_value: newRecord.contractValue,
          currency: newRecord.currency,
          start_date: newRecord.startDate,
          completion_date: newRecord.completionDate,
          status: newRecord.status,
          description: newRecord.description,
          scope_of_works: newRecord.scopeOfWorks,
          governing_law: newRecord.governingLaw,
          dispute_resolution_method: newRecord.disputeResolutionMethod,
          engineer_or_pm: newRecord.engineerOrPM,
          advance_payment_percent: newRecord.advancePaymentPercent,
          retention_percent: newRecord.retentionPercent,
          performance_security_percent: newRecord.performanceSecurityPercent,
          delay_damages_per_day: newRecord.delayDamagesPerDay,
          attachments: newRecord.attachments,
          created_at: newRecord.createdAt,
          updated_at: newRecord.updatedAt
        });
      }
    } catch {
      // Local persistence guaranteed
    }

    return newRecord;
  }

  /**
   * Update an existing contract record
   */
  public static async updateContract(
    projectId: string,
    contractId: string,
    updates: Partial<ProjectContractRecord>
  ): Promise<ProjectContractRecord> {
    assertOperationalAction("edit", "services/contractsService.ts");
    const list = this.readLocalContracts(projectId);
    const index = list.findIndex(c => c.id === contractId);
    if (index === -1) {
      throw new Error(`Contract not found: ${contractId}`);
    }

    const updatedRecord: ProjectContractRecord = {
      ...list[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    list[index] = updatedRecord;
    this.writeLocalContracts(projectId, list);

    // Try updating Supabase
    try {
      if (supabase) {
        await supabase
          .from("project_contracts")
          .update({
            contract_number: updatedRecord.contractNumber,
            contract_title: updatedRecord.contractTitle,
            client: updatedRecord.client,
            contractor: updatedRecord.contractor,
            contract_type: updatedRecord.contractType,
            contract_value: updatedRecord.contractValue,
            currency: updatedRecord.currency,
            start_date: updatedRecord.startDate,
            completion_date: updatedRecord.completionDate,
            status: updatedRecord.status,
            description: updatedRecord.description,
            scope_of_works: updatedRecord.scopeOfWorks,
            governing_law: updatedRecord.governingLaw,
            dispute_resolution_method: updatedRecord.disputeResolutionMethod,
            engineer_or_pm: updatedRecord.engineerOrPM,
            advance_payment_percent: updatedRecord.advancePaymentPercent,
            retention_percent: updatedRecord.retentionPercent,
            performance_security_percent: updatedRecord.performanceSecurityPercent,
            delay_damages_per_day: updatedRecord.delayDamagesPerDay,
            attachments: updatedRecord.attachments,
            updated_at: updatedRecord.updatedAt
          })
          .eq("id", contractId);
      }
    } catch {
      // Local persistence guaranteed
    }

    return updatedRecord;
  }

  /**
   * Delete a contract record
   */
  public static async deleteContract(projectId: string, contractId: string): Promise<boolean> {
    assertOperationalAction("delete", "services/contractsService.ts");
    const list = this.readLocalContracts(projectId);
    const filtered = list.filter(c => c.id !== contractId);
    this.writeLocalContracts(projectId, filtered);

    try {
      if (supabase) {
        await supabase.from("project_contracts").delete().eq("id", contractId);
      }
    } catch {
      // Local deletion complete
    }

    return true;
  }

  /**
   * Upload and attach a supporting document to a contract
   */
  public static async addAttachmentToContract(
    projectId: string,
    contractId: string,
    file: { name: string; size: number; type: string; dataUrl?: string; category?: string }
  ): Promise<ContractAttachment> {
    assertOperationalAction("create", "services/contractsService.ts");
    const attachment: ContractAttachment = {
      id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: file.name,
      size: file.size,
      type: file.type,
      dataUrl: file.dataUrl,
      uploadedAt: new Date().toISOString(),
      category: file.category || "Supporting Document"
    };

    const contract = await this.getContractById(projectId, contractId);
    if (!contract) {
      throw new Error(`Contract ${contractId} not found in project ${projectId}`);
    }

    const updatedAttachments = [...(contract.attachments || []), attachment];
    await this.updateContract(projectId, contractId, { attachments: updatedAttachments });

    return attachment;
  }

  /**
   * Remove an attachment from a contract
   */
  public static async removeAttachmentFromContract(
    projectId: string,
    contractId: string,
    attachmentId: string
  ): Promise<boolean> {
    assertOperationalAction("delete", "services/contractsService.ts");
    const contract = await this.getContractById(projectId, contractId);
    if (!contract) return false;

    const filtered = (contract.attachments || []).filter(a => a.id !== attachmentId);
    await this.updateContract(projectId, contractId, { attachments: filtered });
    return true;
  }

  /**
   * Calculate summary KPIs from real contracts
   */
  public static calculateKPIs(contracts: ProjectContractRecord[]): ContractKPIs {
    if (!contracts || contracts.length === 0) {
      return {
        totalContractsCount: 0,
        totalContractValue: 0,
        activeContractsCount: 0,
        completedContractsCount: 0,
        averageDurationDays: 0,
        primaryCurrency: "-"
      };
    }

    let totalVal = 0;
    let activeCount = 0;
    let completedCount = 0;
    let totalDays = 0;
    let durationRecordsCount = 0;
    const currencyCounts: Record<string, number> = {};

    contracts.forEach(c => {
      totalVal += c.contractValue || 0;
      if (c.status === "Active" || c.status === "Executing") {
        activeCount++;
      } else if (c.status === "Completed" || c.status === "Substantially Complete") {
        completedCount++;
      }

      if (c.currency) {
        currencyCounts[c.currency] = (currencyCounts[c.currency] || 0) + 1;
      }

      if (c.startDate && c.completionDate) {
        const start = new Date(c.startDate).getTime();
        const end = new Date(c.completionDate).getTime();
        if (!isNaN(start) && !isNaN(end) && end >= start) {
          const days = Math.round((end - start) / (1000 * 60 * 60 * 24));
          totalDays += days;
          durationRecordsCount++;
        }
      }
    });

    // Determine primary currency
    let primaryCurrency = "USD";
    let maxFreq = 0;
    Object.entries(currencyCounts).forEach(([curr, freq]) => {
      if (freq > maxFreq) {
        maxFreq = freq;
        primaryCurrency = curr;
      }
    });

    return {
      totalContractsCount: contracts.length,
      totalContractValue: totalVal,
      activeContractsCount: activeCount,
      completedContractsCount: completedCount,
      averageDurationDays: durationRecordsCount > 0 ? Math.round(totalDays / durationRecordsCount) : 0,
      primaryCurrency: contracts.length > 0 ? primaryCurrency : "-"
    };
  }
}
