import { previewStorage } from "../integration/previewStorage";
import { assertOperationalAction } from "../integration/operationalAccess";
import {
  StaffRecord,
  LabourerRecord,
  CompetencyRecord,
  TimesheetRecord,
  PlantAssetRecord,
  PlantAllocationRecord,
  PlantHoursRecord,
  PlantMaintenanceRecord,
  MaterialInventoryRecord,
  MaterialDeliveryRecord,
  MaterialConsumptionRecord,
  LogisticsTransportRecord,
  LogisticsDispatchRecord,
  LogisticsMovementRecord
} from "../types/resources";

const getStorageKey = (prefix: string, projectId: string) => `pm_resources_${prefix}_${projectId}`;

function getRecords<T>(key: string): T[] {
  try {
    const raw = previewStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error(`Error reading ${key} from storage:`, err);
    return [];
  }
}

function saveRecords<T>(key: string, records: T[]): void {
    assertOperationalAction("write", "services/resourceService.ts");
  try {
    previewStorage.setItem(key, JSON.stringify(records));
  } catch (err) {
    console.error(`Error saving ${key} to storage:`, err);
  }
}

export const resourceService = {
  // 1. WORKFORCE: STAFF
  getStaff(projectId: string): StaffRecord[] {
    if (!projectId) return [];
    return getRecords<StaffRecord>(getStorageKey("staff", projectId));
  },
  saveStaff(projectId: string, records: StaffRecord[]): void {
    assertOperationalAction("write", "services/resourceService.ts");
    if (!projectId) return;
    saveRecords(getStorageKey("staff", projectId), records);
  },
  addStaff(projectId: string, data: Partial<StaffRecord>): StaffRecord {
    assertOperationalAction("create", "services/resourceService.ts");
    const records = this.getStaff(projectId);
    const newRecord: StaffRecord = {
      id: data.id || `stf_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      projectId,
      name: data.name || "",
      category: data.category || "Staff",
      role: data.role || "",
      trade: data.trade || "",
      cert: data.cert || "Standard Induction",
      location: data.location || "Main Site",
      contact: data.contact || "",
      status: data.status || "Active",
      email: data.email || "",
      nationalId: data.nationalId || "",
      dateJoined: data.dateJoined || new Date().toISOString().split("T")[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    records.unshift(newRecord);
    this.saveStaff(projectId, records);
    return newRecord;
  },
  updateStaff(projectId: string, updated: StaffRecord): void {
    assertOperationalAction("edit", "services/resourceService.ts");
    const records = this.getStaff(projectId);
    const idx = records.findIndex(r => r.id === updated.id);
    if (idx !== -1) {
      records[idx] = { ...updated, updatedAt: new Date().toISOString() };
      this.saveStaff(projectId, records);
    }
  },
  deleteStaff(projectId: string, id: string): void {
    assertOperationalAction("delete", "services/resourceService.ts");
    const records = this.getStaff(projectId).filter(r => r.id !== id);
    this.saveStaff(projectId, records);
  },

  // 2. WORKFORCE: LABOURERS
  getLabourers(projectId: string): LabourerRecord[] {
    if (!projectId) return [];
    return getRecords<LabourerRecord>(getStorageKey("labourers", projectId));
  },
  saveLabourers(projectId: string, records: LabourerRecord[]): void {
    assertOperationalAction("write", "services/resourceService.ts");
    if (!projectId) return;
    saveRecords(getStorageKey("labourers", projectId), records);
  },
  addLabourer(projectId: string, data: Partial<LabourerRecord>): LabourerRecord {
    assertOperationalAction("create", "services/resourceService.ts");
    const records = this.getLabourers(projectId);
    const newRecord: LabourerRecord = {
      id: data.id || `lab_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      projectId,
      name: data.name || "",
      role: data.role || "General Labourer",
      squad: data.squad || "Squad 1",
      trade: data.trade || "Civil & Earthworks",
      lead: data.lead || "Supervisor",
      shift: data.shift || "07:00 - 16:30",
      dailyRate: data.dailyRate || "35,000 TZS",
      location: data.location || "Section 1",
      status: data.status || "Active",
      emergencyContact: data.emergencyContact || "",
      dateAssigned: data.dateAssigned || new Date().toISOString().split("T")[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    records.unshift(newRecord);
    this.saveLabourers(projectId, records);
    return newRecord;
  },
  updateLabourer(projectId: string, updated: LabourerRecord): void {
    assertOperationalAction("edit", "services/resourceService.ts");
    const records = this.getLabourers(projectId);
    const idx = records.findIndex(r => r.id === updated.id);
    if (idx !== -1) {
      records[idx] = { ...updated, updatedAt: new Date().toISOString() };
      this.saveLabourers(projectId, records);
    }
  },
  deleteLabourer(projectId: string, id: string): void {
    assertOperationalAction("delete", "services/resourceService.ts");
    const records = this.getLabourers(projectId).filter(r => r.id !== id);
    this.saveLabourers(projectId, records);
  },

  // 3. WORKFORCE: COMPETENCY
  getCompetencies(projectId: string): CompetencyRecord[] {
    if (!projectId) return [];
    return getRecords<CompetencyRecord>(getStorageKey("competency", projectId));
  },
  saveCompetencies(projectId: string, records: CompetencyRecord[]): void {
    assertOperationalAction("write", "services/resourceService.ts");
    if (!projectId) return;
    saveRecords(getStorageKey("competency", projectId), records);
  },
  addCompetency(projectId: string, data: Partial<CompetencyRecord>): CompetencyRecord {
    assertOperationalAction("create", "services/resourceService.ts");
    const records = this.getCompetencies(projectId);
    const newRecord: CompetencyRecord = {
      id: data.id || `cmp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      projectId,
      person: data.person || "",
      role: data.role || "",
      accreditation: data.accreditation || "",
      certNumber: data.certNumber || `CERT-${Math.floor(10000 + Math.random() * 90000)}`,
      issuingBody: data.issuingBody || "National Safety Board",
      validUntil: data.validUntil || new Date(Date.now() + 365*24*60*60*1000).toISOString().split("T")[0],
      status: data.status || "Valid / Current",
      documentUrl: data.documentUrl || "",
      notes: data.notes || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    records.unshift(newRecord);
    this.saveCompetencies(projectId, records);
    return newRecord;
  },
  updateCompetency(projectId: string, updated: CompetencyRecord): void {
    assertOperationalAction("edit", "services/resourceService.ts");
    const records = this.getCompetencies(projectId);
    const idx = records.findIndex(r => r.id === updated.id);
    if (idx !== -1) {
      records[idx] = { ...updated, updatedAt: new Date().toISOString() };
      this.saveCompetencies(projectId, records);
    }
  },
  deleteCompetency(projectId: string, id: string): void {
    assertOperationalAction("delete", "services/resourceService.ts");
    const records = this.getCompetencies(projectId).filter(r => r.id !== id);
    this.saveCompetencies(projectId, records);
  },

  // 4. WORKFORCE: TIMESHEETS
  getTimesheets(projectId: string): TimesheetRecord[] {
    if (!projectId) return [];
    return getRecords<TimesheetRecord>(getStorageKey("timesheets", projectId));
  },
  saveTimesheets(projectId: string, records: TimesheetRecord[]): void {
    assertOperationalAction("write", "services/resourceService.ts");
    if (!projectId) return;
    saveRecords(getStorageKey("timesheets", projectId), records);
  },
  addTimesheet(projectId: string, data: Partial<TimesheetRecord>): TimesheetRecord {
    assertOperationalAction("create", "services/resourceService.ts");
    const records = this.getTimesheets(projectId);
    const regular = Number(data.regularHours) || 0;
    const overtime = Number(data.overtimeHours) || 0;
    const total = regular + overtime;
    const newRecord: TimesheetRecord = {
      id: data.id || `ts_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      projectId,
      worker: data.worker || "",
      category: data.category || "Staff",
      role: data.role || "",
      weekEnding: data.weekEnding || new Date().toISOString().split("T")[0],
      regularHours: regular,
      overtimeHours: overtime,
      total: total,
      verifiedBy: data.verifiedBy || "Resident Engineer",
      status: data.status || "Approved",
      notes: data.notes || "",
      workface: data.workface || "Section 1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    records.unshift(newRecord);
    this.saveTimesheets(projectId, records);
    return newRecord;
  },
  updateTimesheet(projectId: string, updated: TimesheetRecord): void {
    assertOperationalAction("edit", "services/resourceService.ts");
    const records = this.getTimesheets(projectId);
    const idx = records.findIndex(r => r.id === updated.id);
    if (idx !== -1) {
      const regular = Number(updated.regularHours) || 0;
      const overtime = Number(updated.overtimeHours) || 0;
      records[idx] = { 
        ...updated, 
        regularHours: regular,
        overtimeHours: overtime,
        total: regular + overtime,
        updatedAt: new Date().toISOString() 
      };
      this.saveTimesheets(projectId, records);
    }
  },
  deleteTimesheet(projectId: string, id: string): void {
    assertOperationalAction("delete", "services/resourceService.ts");
    const records = this.getTimesheets(projectId).filter(r => r.id !== id);
    this.saveTimesheets(projectId, records);
  },

  // 5. PLANT: ASSETS
  getPlantAssets(projectId: string): PlantAssetRecord[] {
    if (!projectId) return [];
    return getRecords<PlantAssetRecord>(getStorageKey("plant", projectId));
  },
  savePlantAssets(projectId: string, records: PlantAssetRecord[]): void {
    assertOperationalAction("write", "services/resourceService.ts");
    if (!projectId) return;
    saveRecords(getStorageKey("plant", projectId), records);
  },
  addPlantAsset(projectId: string, data: Partial<PlantAssetRecord>): PlantAssetRecord {
    assertOperationalAction("create", "services/resourceService.ts");
    const records = this.getPlantAssets(projectId);
    const newRecord: PlantAssetRecord = {
      id: data.id || `plt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      projectId,
      tag: data.tag || `PLT-${Math.floor(100 + Math.random() * 900)}`,
      name: data.name || "",
      category: data.category || "Excavation",
      allocation: data.allocation || "Main Site",
      operator: data.operator || "Unassigned",
      hoursToday: data.hoursToday || "8.0h",
      fuelPct: data.fuelPct ? (data.fuelPct.toString().includes("%") ? data.fuelPct.toString() : `${data.fuelPct}%`) : "85%",
      nextService: data.nextService || "In 150h",
      condition: data.condition || "Operational",
      status: data.status || "In Use",
      serialNumber: data.serialNumber || "",
      telematicsId: data.telematicsId || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    records.unshift(newRecord);
    this.savePlantAssets(projectId, records);
    return newRecord;
  },
  updatePlantAsset(projectId: string, updated: PlantAssetRecord): void {
    assertOperationalAction("edit", "services/resourceService.ts");
    const records = this.getPlantAssets(projectId);
    const idx = records.findIndex(r => r.id === updated.id);
    if (idx !== -1) {
      records[idx] = { ...updated, updatedAt: new Date().toISOString() };
      this.savePlantAssets(projectId, records);
    }
  },
  deletePlantAsset(projectId: string, id: string): void {
    assertOperationalAction("delete", "services/resourceService.ts");
    const records = this.getPlantAssets(projectId).filter(r => r.id !== id);
    this.savePlantAssets(projectId, records);
  },

  // 5b. PLANT: ALLOCATIONS
  getPlantAllocations(projectId: string): PlantAllocationRecord[] {
    if (!projectId) return [];
    return getRecords<PlantAllocationRecord>(getStorageKey("plant_allocations", projectId));
  },
  savePlantAllocations(projectId: string, records: PlantAllocationRecord[]): void {
    assertOperationalAction("write", "services/resourceService.ts");
    if (!projectId) return;
    saveRecords(getStorageKey("plant_allocations", projectId), records);
  },
  addPlantAllocation(projectId: string, data: Partial<PlantAllocationRecord>): PlantAllocationRecord {
    assertOperationalAction("create", "services/resourceService.ts");
    const records = this.getPlantAllocations(projectId);
    const newRecord: PlantAllocationRecord = {
      id: data.id || `alc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      projectId,
      tag: data.tag || "",
      plantName: data.plantName || "",
      workface: data.workface || "",
      operator: data.operator || "",
      startDate: data.startDate || new Date().toISOString().split("T")[0],
      endDate: data.endDate || new Date(Date.now() + 30*24*60*60*1000).toISOString().split("T")[0],
      status: data.status || "Active",
      notes: data.notes || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    records.unshift(newRecord);
    this.savePlantAllocations(projectId, records);
    return newRecord;
  },
  updatePlantAllocation(projectId: string, updated: PlantAllocationRecord): void {
    assertOperationalAction("edit", "services/resourceService.ts");
    const records = this.getPlantAllocations(projectId);
    const idx = records.findIndex(r => r.id === updated.id);
    if (idx !== -1) {
      records[idx] = { ...updated, updatedAt: new Date().toISOString() };
      this.savePlantAllocations(projectId, records);
    }
  },
  deletePlantAllocation(projectId: string, id: string): void {
    assertOperationalAction("delete", "services/resourceService.ts");
    const records = this.getPlantAllocations(projectId).filter(r => r.id !== id);
    this.savePlantAllocations(projectId, records);
  },

  // 5c. PLANT: OPERATING HOURS
  getPlantHours(projectId: string): PlantHoursRecord[] {
    if (!projectId) return [];
    return getRecords<PlantHoursRecord>(getStorageKey("plant_hours", projectId));
  },
  savePlantHours(projectId: string, records: PlantHoursRecord[]): void {
    assertOperationalAction("write", "services/resourceService.ts");
    if (!projectId) return;
    saveRecords(getStorageKey("plant_hours", projectId), records);
  },
  addPlantHours(projectId: string, data: Partial<PlantHoursRecord>): PlantHoursRecord {
    assertOperationalAction("create", "services/resourceService.ts");
    const records = this.getPlantHours(projectId);
    const start = Number(data.startHours) || 0;
    const end = Number(data.endHours) || 0;
    const total = data.totalHours !== undefined && data.totalHours !== "" ? Number(data.totalHours) : (end >= start ? end - start : 8);
    const newRecord: PlantHoursRecord = {
      id: data.id || `hr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      projectId,
      tag: data.tag || "",
      plantName: data.plantName || "",
      date: data.date || new Date().toISOString().split("T")[0],
      shift: data.shift || "Day Shift (07:00 - 17:00)",
      startHours: start,
      endHours: end,
      totalHours: total,
      fuelConsumedLiters: data.fuelConsumedLiters || 45,
      operator: data.operator || "",
      supervisor: data.supervisor || "Site Agent",
      notes: data.notes || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    records.unshift(newRecord);
    this.savePlantHours(projectId, records);
    return newRecord;
  },
  updatePlantHours(projectId: string, updated: PlantHoursRecord): void {
    assertOperationalAction("edit", "services/resourceService.ts");
    const records = this.getPlantHours(projectId);
    const idx = records.findIndex(r => r.id === updated.id);
    if (idx !== -1) {
      records[idx] = { ...updated, updatedAt: new Date().toISOString() };
      this.savePlantHours(projectId, records);
    }
  },
  deletePlantHours(projectId: string, id: string): void {
    assertOperationalAction("delete", "services/resourceService.ts");
    const records = this.getPlantHours(projectId).filter(r => r.id !== id);
    this.savePlantHours(projectId, records);
  },

  // 5d. PLANT: MAINTENANCE
  getPlantMaintenance(projectId: string): PlantMaintenanceRecord[] {
    if (!projectId) return [];
    return getRecords<PlantMaintenanceRecord>(getStorageKey("plant_maintenance", projectId));
  },
  savePlantMaintenance(projectId: string, records: PlantMaintenanceRecord[]): void {
    assertOperationalAction("write", "services/resourceService.ts");
    if (!projectId) return;
    saveRecords(getStorageKey("plant_maintenance", projectId), records);
  },
  addPlantMaintenance(projectId: string, data: Partial<PlantMaintenanceRecord>): PlantMaintenanceRecord {
    assertOperationalAction("create", "services/resourceService.ts");
    const records = this.getPlantMaintenance(projectId);
    const newRecord: PlantMaintenanceRecord = {
      id: data.id || `mnt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      projectId,
      tag: data.tag || "",
      plantName: data.plantName || "",
      serviceType: data.serviceType || "Routine 250h Service",
      serviceDate: data.serviceDate || new Date().toISOString().split("T")[0],
      technician: data.technician || "Authorized Workshop",
      nextDueDate: data.nextDueDate || new Date(Date.now() + 60*24*60*60*1000).toISOString().split("T")[0],
      partsReplaced: data.partsReplaced || "Filters & Engine Oil",
      cost: data.cost || "450,000 TZS",
      status: data.status || "Completed",
      notes: data.notes || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    records.unshift(newRecord);
    this.savePlantMaintenance(projectId, records);
    return newRecord;
  },
  updatePlantMaintenance(projectId: string, updated: PlantMaintenanceRecord): void {
    assertOperationalAction("edit", "services/resourceService.ts");
    const records = this.getPlantMaintenance(projectId);
    const idx = records.findIndex(r => r.id === updated.id);
    if (idx !== -1) {
      records[idx] = { ...updated, updatedAt: new Date().toISOString() };
      this.savePlantMaintenance(projectId, records);
    }
  },
  deletePlantMaintenance(projectId: string, id: string): void {
    assertOperationalAction("delete", "services/resourceService.ts");
    const records = this.getPlantMaintenance(projectId).filter(r => r.id !== id);
    this.savePlantMaintenance(projectId, records);
  },

  // 6. MATERIALS: INVENTORY
  getMaterials(projectId: string): MaterialInventoryRecord[] {
    if (!projectId) return [];
    return getRecords<MaterialInventoryRecord>(getStorageKey("materials", projectId));
  },
  getMaterialInventory(projectId: string): MaterialInventoryRecord[] {
    return this.getMaterials(projectId);
  },
  saveMaterials(projectId: string, records: MaterialInventoryRecord[]): void {
    assertOperationalAction("write", "services/resourceService.ts");
    if (!projectId) return;
    saveRecords(getStorageKey("materials", projectId), records);
  },
  saveMaterialInventory(projectId: string, records: MaterialInventoryRecord[]): void {
    assertOperationalAction("write", "services/resourceService.ts");
    this.saveMaterials(projectId, records);
  },
  addMaterial(projectId: string, data: Partial<MaterialInventoryRecord>): MaterialInventoryRecord {
    assertOperationalAction("create", "services/resourceService.ts");
    const records = this.getMaterials(projectId);
    const stock = Number(data.stockOnHand) || 0;
    const reorder = Number(data.reorderLevel) || 0;
    let status = data.status;
    if (!status) {
      if (stock === 0) status = "Out of Stock";
      else if (stock < reorder) status = "Low Stock";
      else status = "Adequate";
    }

    const newRecord: MaterialInventoryRecord = {
      id: data.id || `mat_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      projectId,
      code: data.code || `MAT-${Math.floor(100 + Math.random() * 900)}`,
      name: data.name || "",
      category: data.category || "Aggregate & Sand",
      stockOnHand: data.stockOnHand !== undefined ? data.stockOnHand : "0",
      unit: data.unit || "m³",
      dailyConsumption: data.dailyConsumption !== undefined ? data.dailyConsumption : "0",
      reorderLevel: data.reorderLevel !== undefined ? data.reorderLevel : "100",
      batchCert: data.batchCert || "CERT-QA-PENDING",
      supplier: data.supplier || "",
      location: data.location || "Central Batching Yard",
      receivedQty: data.receivedQty || 0,
      consumedQty: data.consumedQty || 0,
      status: status,
      unitCost: data.unitCost || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    records.unshift(newRecord);
    this.saveMaterials(projectId, records);
    return newRecord;
  },
  addMaterialInventory(projectId: string, data: Partial<MaterialInventoryRecord>): MaterialInventoryRecord {
    assertOperationalAction("create", "services/resourceService.ts");
    return this.addMaterial(projectId, data);
  },
  updateMaterial(projectId: string, updated: MaterialInventoryRecord): void {
    assertOperationalAction("edit", "services/resourceService.ts");
    const records = this.getMaterials(projectId);
    const idx = records.findIndex(r => r.id === updated.id);
    if (idx !== -1) {
      records[idx] = { ...updated, updatedAt: new Date().toISOString() };
      this.saveMaterials(projectId, records);
    }
  },
  updateMaterialInventory(projectId: string, updated: MaterialInventoryRecord): void {
    assertOperationalAction("edit", "services/resourceService.ts");
    this.updateMaterial(projectId, updated);
  },
  deleteMaterial(projectId: string, id: string): void {
    assertOperationalAction("delete", "services/resourceService.ts");
    const records = this.getMaterials(projectId).filter(r => r.id !== id);
    this.saveMaterials(projectId, records);
  },
  deleteMaterialInventory(projectId: string, id: string): void {
    assertOperationalAction("delete", "services/resourceService.ts");
    this.deleteMaterial(projectId, id);
  },

  // 6b. MATERIALS: DELIVERIES / RECEIVED
  getMaterialDeliveries(projectId: string): MaterialDeliveryRecord[] {
    if (!projectId) return [];
    return getRecords<MaterialDeliveryRecord>(getStorageKey("materials_deliveries", projectId));
  },
  saveMaterialDeliveries(projectId: string, records: MaterialDeliveryRecord[]): void {
    assertOperationalAction("write", "services/resourceService.ts");
    if (!projectId) return;
    saveRecords(getStorageKey("materials_deliveries", projectId), records);
  },
  addMaterialDelivery(projectId: string, data: Partial<MaterialDeliveryRecord>): MaterialDeliveryRecord {
    assertOperationalAction("create", "services/resourceService.ts");
    const records = this.getMaterialDeliveries(projectId);
    const newRecord: MaterialDeliveryRecord = {
      id: data.id || `dlv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      projectId,
      deliveryRef: data.deliveryRef || `GRN-${Math.floor(1000 + Math.random() * 9000)}`,
      materialCode: data.materialCode || "",
      materialName: data.materialName || "",
      quantityReceived: data.quantityReceived || "0",
      unit: data.unit || "Tonnes",
      supplier: data.supplier || "",
      deliveryDate: data.deliveryDate || new Date().toISOString().split("T")[0],
      batchCert: data.batchCert || `MILL-${Math.floor(1000 + Math.random() * 9000)}`,
      receivedBy: data.receivedBy || "Storekeeper",
      vehicleReg: data.vehicleReg || "",
      status: data.status || "Accepted & Inspected",
      notes: data.notes || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    records.unshift(newRecord);
    this.saveMaterialDeliveries(projectId, records);
    return newRecord;
  },
  updateMaterialDelivery(projectId: string, updated: MaterialDeliveryRecord): void {
    assertOperationalAction("edit", "services/resourceService.ts");
    const records = this.getMaterialDeliveries(projectId);
    const idx = records.findIndex(r => r.id === updated.id);
    if (idx !== -1) {
      records[idx] = { ...updated, updatedAt: new Date().toISOString() };
      this.saveMaterialDeliveries(projectId, records);
    }
  },
  deleteMaterialDelivery(projectId: string, id: string): void {
    assertOperationalAction("delete", "services/resourceService.ts");
    const records = this.getMaterialDeliveries(projectId).filter(r => r.id !== id);
    this.saveMaterialDeliveries(projectId, records);
  },

  // 6c. MATERIALS: CONSUMPTION / ISSUED
  getMaterialConsumptions(projectId: string): MaterialConsumptionRecord[] {
    if (!projectId) return [];
    return getRecords<MaterialConsumptionRecord>(getStorageKey("materials_consumption", projectId));
  },
  getMaterialConsumption(projectId: string): MaterialConsumptionRecord[] {
    return this.getMaterialConsumptions(projectId);
  },
  saveMaterialConsumptions(projectId: string, records: MaterialConsumptionRecord[]): void {
    assertOperationalAction("write", "services/resourceService.ts");
    if (!projectId) return;
    saveRecords(getStorageKey("materials_consumption", projectId), records);
  },
  addMaterialConsumption(projectId: string, data: Partial<MaterialConsumptionRecord>): MaterialConsumptionRecord {
    assertOperationalAction("create", "services/resourceService.ts");
    const records = this.getMaterialConsumptions(projectId);
    const newRecord: MaterialConsumptionRecord = {
      id: data.id || `cns_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      projectId,
      issueRef: data.issueRef || `ISSUE-${Math.floor(1000 + Math.random() * 9000)}`,
      materialCode: data.materialCode || "",
      materialName: data.materialName || "",
      quantityIssued: data.quantityIssued || "0",
      unit: data.unit || "m³",
      workface: data.workface || "Section 1",
      issueDate: data.issueDate || new Date().toISOString().split("T")[0],
      issuedTo: data.issuedTo || "Site Foreman",
      approvedBy: data.approvedBy || "Section Engineer",
      purpose: data.purpose || "Concrete Pour / Sub-base",
      status: data.status || "Consumed",
      notes: data.notes || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    records.unshift(newRecord);
    this.saveMaterialConsumptions(projectId, records);
    return newRecord;
  },
  updateMaterialConsumption(projectId: string, updated: MaterialConsumptionRecord): void {
    assertOperationalAction("edit", "services/resourceService.ts");
    const records = this.getMaterialConsumptions(projectId);
    const idx = records.findIndex(r => r.id === updated.id);
    if (idx !== -1) {
      records[idx] = { ...updated, updatedAt: new Date().toISOString() };
      this.saveMaterialConsumptions(projectId, records);
    }
  },
  deleteMaterialConsumption(projectId: string, id: string): void {
    assertOperationalAction("delete", "services/resourceService.ts");
    const records = this.getMaterialConsumptions(projectId).filter(r => r.id !== id);
    this.saveMaterialConsumptions(projectId, records);
  },

  // 7. LOGISTICS: TRANSPORT
  getLogisticsTransports(projectId: string): LogisticsTransportRecord[] {
    if (!projectId) return [];
    return getRecords<LogisticsTransportRecord>(getStorageKey("logistics", projectId));
  },
  saveLogisticsTransports(projectId: string, records: LogisticsTransportRecord[]): void {
    assertOperationalAction("write", "services/resourceService.ts");
    if (!projectId) return;
    saveRecords(getStorageKey("logistics", projectId), records);
  },
  addLogisticsTransport(projectId: string, data: Partial<LogisticsTransportRecord>): LogisticsTransportRecord {
    assertOperationalAction("create", "services/resourceService.ts");
    const records = this.getLogisticsTransports(projectId);
    const newRecord: LogisticsTransportRecord = {
      id: data.id || `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      projectId,
      consignment: data.consignment || `WAYBILL-${Math.floor(1000 + Math.random() * 9000)}`,
      origin: data.origin || "",
      destination: data.destination || "Main Site Gate",
      driver: data.driver || "",
      vehicle: data.vehicle || "",
      loadWeight: data.loadWeight || "30 Tons",
      departure: data.departure || "08:00 AM",
      eta: data.eta || "02:00 PM",
      status: data.status || "In Transit",
      haulierCompany: data.haulierCompany || "",
      waybillRef: data.waybillRef || "",
      cargoDescription: data.cargoDescription || "",
      notes: data.notes || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    records.unshift(newRecord);
    this.saveLogisticsTransports(projectId, records);
    return newRecord;
  },
  updateLogisticsTransport(projectId: string, updated: LogisticsTransportRecord): void {
    assertOperationalAction("edit", "services/resourceService.ts");
    const records = this.getLogisticsTransports(projectId);
    const idx = records.findIndex(r => r.id === updated.id);
    if (idx !== -1) {
      records[idx] = { ...updated, updatedAt: new Date().toISOString() };
      this.saveLogisticsTransports(projectId, records);
    }
  },
  deleteLogisticsTransport(projectId: string, id: string): void {
    assertOperationalAction("delete", "services/resourceService.ts");
    const records = this.getLogisticsTransports(projectId).filter(r => r.id !== id);
    this.saveLogisticsTransports(projectId, records);
  },

  // 7b. LOGISTICS: DISPATCH
  getLogisticsDispatches(projectId: string): LogisticsDispatchRecord[] {
    if (!projectId) return [];
    return getRecords<LogisticsDispatchRecord>(getStorageKey("logistics_dispatches", projectId));
  },
  saveLogisticsDispatches(projectId: string, records: LogisticsDispatchRecord[]): void {
    assertOperationalAction("write", "services/resourceService.ts");
    if (!projectId) return;
    saveRecords(getStorageKey("logistics_dispatches", projectId), records);
  },
  addLogisticsDispatch(projectId: string, data: Partial<LogisticsDispatchRecord>): LogisticsDispatchRecord {
    assertOperationalAction("create", "services/resourceService.ts");
    const records = this.getLogisticsDispatches(projectId);
    const newRecord: LogisticsDispatchRecord = {
      id: data.id || `dsp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      projectId,
      dispatchRef: data.dispatchRef || `DSP-${Math.floor(1000 + Math.random() * 9000)}`,
      transporter: data.transporter || "",
      origin: data.origin || "",
      destination: data.destination || "",
      loadDescription: data.loadDescription || "",
      loadWeight: data.loadWeight || "25 Tons",
      driver: data.driver || "",
      departureDate: data.departureDate || new Date().toISOString().split("T")[0],
      status: data.status || "Dispatched",
      notes: data.notes || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    records.unshift(newRecord);
    this.saveLogisticsDispatches(projectId, records);
    return newRecord;
  },
  updateLogisticsDispatch(projectId: string, updated: LogisticsDispatchRecord): void {
    assertOperationalAction("edit", "services/resourceService.ts");
    const records = this.getLogisticsDispatches(projectId);
    const idx = records.findIndex(r => r.id === updated.id);
    if (idx !== -1) {
      records[idx] = { ...updated, updatedAt: new Date().toISOString() };
      this.saveLogisticsDispatches(projectId, records);
    }
  },
  deleteLogisticsDispatch(projectId: string, id: string): void {
    assertOperationalAction("delete", "services/resourceService.ts");
    const records = this.getLogisticsDispatches(projectId).filter(r => r.id !== id);
    this.saveLogisticsDispatches(projectId, records);
  },

  // 7c. LOGISTICS: MOVEMENT
  getLogisticsMovements(projectId: string): LogisticsMovementRecord[] {
    if (!projectId) return [];
    return getRecords<LogisticsMovementRecord>(getStorageKey("logistics_movements", projectId));
  },
  saveLogisticsMovements(projectId: string, records: LogisticsMovementRecord[]): void {
    assertOperationalAction("write", "services/resourceService.ts");
    if (!projectId) return;
    saveRecords(getStorageKey("logistics_movements", projectId), records);
  },
  addLogisticsMovement(projectId: string, data: Partial<LogisticsMovementRecord>): LogisticsMovementRecord {
    assertOperationalAction("create", "services/resourceService.ts");
    const records = this.getLogisticsMovements(projectId);
    const newRecord: LogisticsMovementRecord = {
      id: data.id || `mvm_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      projectId,
      trackingRef: data.trackingRef || `TRK-${Math.floor(1000 + Math.random() * 9000)}`,
      waybillRef: data.waybillRef || "",
      currentLocation: data.currentLocation || "Site Perimeter Gate",
      checkpoint: data.checkpoint || "Security Checkpoint A",
      timestamp: data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      driver: data.driver || "",
      vehicleReg: data.vehicleReg || "",
      status: data.status || "En Route",
      notes: data.notes || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    records.unshift(newRecord);
    this.saveLogisticsMovements(projectId, records);
    return newRecord;
  },
  updateLogisticsMovement(projectId: string, updated: LogisticsMovementRecord): void {
    assertOperationalAction("edit", "services/resourceService.ts");
    const records = this.getLogisticsMovements(projectId);
    const idx = records.findIndex(r => r.id === updated.id);
    if (idx !== -1) {
      records[idx] = { ...updated, updatedAt: new Date().toISOString() };
      this.saveLogisticsMovements(projectId, records);
    }
  },
  deleteLogisticsMovement(projectId: string, id: string): void {
    assertOperationalAction("delete", "services/resourceService.ts");
    const records = this.getLogisticsMovements(projectId).filter(r => r.id !== id);
    this.saveLogisticsMovements(projectId, records);
  }
};
