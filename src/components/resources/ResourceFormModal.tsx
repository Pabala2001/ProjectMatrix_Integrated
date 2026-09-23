import { assertOperationalAction } from "../../integration/operationalAccess";
import React, { useState, useEffect } from "react";
import { X, Plus, Save, User, Truck, Boxes, Navigation, Award, Clock, Wrench, ShieldCheck, CheckCircle2 } from "lucide-react";
import { ResourceRecordType } from "../../types/resources";

interface ResourceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  initialData?: any;
  type: ResourceRecordType;
  projectId: string;
}

export const ResourceFormModal: React.FC<ResourceFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  type,
  projectId
}) => {
  const isEditing = Boolean(initialData?.id);
  const [formData, setFormData] = useState<any>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({ ...initialData });
      } else {
        // Defaults based on type
        const defaults: Record<string, any> = { projectId };
        switch (type) {
          case "workforce_staff":
            defaults.category = "Staff";
            defaults.status = "Active";
            defaults.cert = "Safety Inducted";
            defaults.location = "Main Site";
            break;
          case "workforce_labourer":
            defaults.role = "General Civil Hand";
            defaults.squad = "Squad A - Earthworks";
            defaults.trade = "Civil & Earthworks";
            defaults.shift = "07:00 - 16:30";
            defaults.dailyRate = "35,000 TZS";
            defaults.status = "Active";
            break;
          case "workforce_competency":
            defaults.status = "Valid / Current";
            defaults.issuingBody = "National Occupational Safety Board";
            defaults.validUntil = new Date(Date.now() + 365*24*60*60*1000).toISOString().split("T")[0];
            break;
          case "workforce_timesheet":
            defaults.category = "Staff";
            defaults.status = "Approved";
            defaults.weekEnding = new Date().toISOString().split("T")[0];
            defaults.regularHours = 40;
            defaults.overtimeHours = 0;
            defaults.verifiedBy = "Resident Engineer";
            break;
          case "plant_asset":
            defaults.category = "Excavation";
            defaults.status = "In Use";
            defaults.condition = "Operational";
            defaults.hoursToday = "8.0h";
            defaults.fuelPct = "85%";
            defaults.nextService = "In 150h";
            break;
          case "plant_allocation":
            defaults.status = "Active";
            defaults.startDate = new Date().toISOString().split("T")[0];
            defaults.endDate = new Date(Date.now() + 30*24*60*60*1000).toISOString().split("T")[0];
            break;
          case "plant_hours":
            defaults.date = new Date().toISOString().split("T")[0];
            defaults.shift = "Day Shift (07:00 - 17:00)";
            defaults.startHours = 0;
            defaults.endHours = 8;
            defaults.totalHours = 8;
            defaults.fuelConsumedLiters = 45;
            break;
          case "plant_maintenance":
            defaults.serviceType = "Routine 250h Service";
            defaults.serviceDate = new Date().toISOString().split("T")[0];
            defaults.status = "Completed";
            defaults.nextDueDate = new Date(Date.now() + 60*24*60*60*1000).toISOString().split("T")[0];
            break;
          case "material_inventory":
            defaults.category = "Aggregate & Sand";
            defaults.unit = "m³";
            defaults.status = "Optimal";
            defaults.stockOnHand = 500;
            defaults.reorderLevel = 100;
            defaults.dailyConsumption = 25;
            defaults.batchCert = "MILL-CERT-APPROVED";
            break;
          case "material_delivery":
            defaults.deliveryDate = new Date().toISOString().split("T")[0];
            defaults.unit = "Tonnes";
            defaults.status = "Accepted & Inspected";
            defaults.deliveryRef = `GRN-${Math.floor(1000 + Math.random() * 9000)}`;
            break;
          case "material_consumption":
            defaults.issueDate = new Date().toISOString().split("T")[0];
            defaults.unit = "m³";
            defaults.status = "Consumed";
            defaults.issueRef = `ISSUE-${Math.floor(1000 + Math.random() * 9000)}`;
            break;
          case "logistics_transport":
            defaults.status = "In Transit";
            defaults.consignment = `WAYBILL-${Math.floor(1000 + Math.random() * 9000)}`;
            defaults.departure = "08:00 AM";
            defaults.eta = "03:30 PM";
            defaults.loadWeight = "30 Tons";
            break;
          case "logistics_dispatch":
            defaults.status = "Dispatched";
            defaults.departureDate = new Date().toISOString().split("T")[0];
            defaults.dispatchRef = `DSP-${Math.floor(1000 + Math.random() * 9000)}`;
            break;
          case "logistics_movement":
            defaults.status = "En Route";
            defaults.timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            defaults.trackingRef = `TRK-${Math.floor(1000 + Math.random() * 9000)}`;
            break;
        }
        setFormData(defaults);
      }
      setErrors({});
    }
  }, [isOpen, initialData, type, projectId]);

  if (!isOpen) return null;

  const handleChange = (field: string, value: any) => {
    setFormData((prev: any) => {
      const updated = { ...prev, [field]: value };
      // Auto compute timesheet total if regular or overtime changes
      if (type === "workforce_timesheet" && (field === "regularHours" || field === "overtimeHours")) {
        const reg = Number(field === "regularHours" ? value : prev.regularHours) || 0;
        const ot = Number(field === "overtimeHours" ? value : prev.overtimeHours) || 0;
        updated.total = reg + ot;
      }
      // Auto compute plant total hours if start or end changes
      if (type === "plant_hours" && (field === "startHours" || field === "endHours")) {
        const start = Number(field === "startHours" ? value : prev.startHours) || 0;
        const end = Number(field === "endHours" ? value : prev.endHours) || 0;
        if (end >= start) updated.totalHours = end - start;
      }
      return updated;
    });

    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (type === "workforce_staff" && !formData.name?.trim()) errs.name = "Staff name is required";
    if (type === "workforce_labourer" && !formData.name?.trim()) errs.name = "Labourer name is required";
    if (type === "workforce_competency") {
      if (!formData.person?.trim()) errs.person = "Personnel name is required";
      if (!formData.accreditation?.trim()) errs.accreditation = "Accreditation title is required";
    }
    if (type === "workforce_timesheet" && !formData.worker?.trim()) errs.worker = "Worker name is required";
    if (type === "plant_asset") {
      if (!formData.tag?.trim()) errs.tag = "Asset code / tag is required";
      if (!formData.name?.trim()) errs.name = "Plant model / description is required";
    }
    if (type === "plant_allocation") {
      if (!formData.tag?.trim()) errs.tag = "Plant tag is required";
      if (!formData.workface?.trim()) errs.workface = "Workface is required";
    }
    if (type === "plant_hours") {
      if (!formData.tag?.trim()) errs.tag = "Plant tag is required";
    }
    if (type === "plant_maintenance") {
      if (!formData.tag?.trim()) errs.tag = "Plant tag is required";
    }
    if (type === "material_inventory") {
      if (!formData.code?.trim()) errs.code = "Material SKU code is required";
      if (!formData.name?.trim()) errs.name = "Material name is required";
    }
    if (type === "material_delivery") {
      if (!formData.deliveryRef?.trim()) errs.deliveryRef = "Delivery reference is required";
      if (!formData.materialName?.trim() && !formData.materialCode?.trim()) errs.materialName = "Material name or code is required";
    }
    if (type === "material_consumption") {
      if (!formData.issueRef?.trim()) errs.issueRef = "Issue reference is required";
      if (!formData.materialName?.trim() && !formData.materialCode?.trim()) errs.materialName = "Material name or code is required";
    }
    if (type === "logistics_transport") {
      if (!formData.consignment?.trim()) errs.consignment = "Consignment reference is required";
      if (!formData.destination?.trim()) errs.destination = "Destination is required";
    }
    if (type === "logistics_dispatch") {
      if (!formData.dispatchRef?.trim()) errs.dispatchRef = "Dispatch reference is required";
    }
    if (type === "logistics_movement") {
      if (!formData.trackingRef?.trim()) errs.trackingRef = "Tracking reference is required";
      if (!formData.checkpoint?.trim()) errs.checkpoint = "Checkpoint is required";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    assertOperationalAction("write", "components/resources/ResourceFormModal.tsx");
    e.preventDefault();
    if (!validate()) return;
    onSave(formData);
    onClose();
  };

  const getFormTitle = () => {
    const action = isEditing ? "Edit" : "Add";
    switch (type) {
      case "workforce_staff": return `${action} Staff / Personnel Member`;
      case "workforce_labourer": return `${action} Site Labourer`;
      case "workforce_competency": return `${action} Competency & Accreditation Record`;
      case "workforce_timesheet": return `${action} Verified Timesheet Record`;
      case "plant_asset": return `${action} Plant & Machinery Asset`;
      case "plant_allocation": return `${action} Plant Allocation & Staging`;
      case "plant_hours": return `${action} Plant Operating Hours Log`;
      case "plant_maintenance": return `${action} Plant Maintenance & Service Record`;
      case "material_inventory": return `${action} Raw Material Inventory Item`;
      case "material_delivery": return `${action} Material Delivery / Received Batch`;
      case "material_consumption": return `${action} Material Consumption / Issue Voucher`;
      case "logistics_transport": return `${action} Freight Transport & Trip`;
      case "logistics_dispatch": return `${action} Consignment Dispatch`;
      case "logistics_movement": return `${action} Movement & Checkpoint Log`;
      default: return `${action} Resource Record`;
    }
  };

  const getIcon = () => {
    if (type.startsWith("workforce")) return User;
    if (type.startsWith("plant")) return Truck;
    if (type.startsWith("material")) return Boxes;
    return Navigation;
  };

  const Icon = getIcon();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden animate-scaleUp flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {getFormTitle()}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                {isEditing ? "Update existing record in the project repository" : "Register a new resource record linked to the active project"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          
          {/* 1. WORKFORCE STAFF */}
          {type === "workforce_staff" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Personnel Name *
                </label>
                <input
                  type="text"
                  value={formData.name || ""}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="e.g., Juma Rashidi"
                  className={`w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white ${errors.name ? "border-rose-500" : "border-slate-200 dark:border-slate-700"}`}
                />
                {errors.name && <span className="text-[10px] text-rose-500">{errors.name}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Staff Category
                </label>
                <select
                  value={formData.category || "Staff"}
                  onChange={(e) => handleChange("category", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                >
                  <option value="Staff">Staff</option>
                  <option value="Foremen">Foremen</option>
                  <option value="Artisans">Artisans</option>
                  <option value="Drivers">Drivers / Operators</option>
                  <option value="Labour">Labour / Labourers</option>
                  <option value="Management">Management</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Designated Role
                </label>
                <input
                  type="text"
                  value={formData.role || ""}
                  onChange={(e) => handleChange("role", e.target.value)}
                  placeholder="e.g., Senior Earthworks Foreman"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Trade / Craft
                </label>
                <input
                  type="text"
                  value={formData.trade || ""}
                  onChange={(e) => handleChange("trade", e.target.value)}
                  placeholder="e.g., Earthmoving / Heavy Machinery"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Credentials / Certification
                </label>
                <input
                  type="text"
                  value={formData.cert || ""}
                  onChange={(e) => handleChange("cert", e.target.value)}
                  placeholder="e.g., OSHA Class A / Cert #8821"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Site Location / Section
                </label>
                <input
                  type="text"
                  value={formData.location || ""}
                  onChange={(e) => handleChange("location", e.target.value)}
                  placeholder="e.g., KM 14+200 North Cut"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Contact Phone
                </label>
                <input
                  type="text"
                  value={formData.contact || ""}
                  onChange={(e) => handleChange("contact", e.target.value)}
                  placeholder="e.g., +255 754 112 334"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Status
                </label>
                <select
                  value={formData.status || "Active"}
                  onChange={(e) => handleChange("status", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                >
                  <option value="Active">Active</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Standby">Standby</option>
                  <option value="Demobilized">Demobilized</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="e.g., juma@project.com"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* 2. WORKFORCE LABOURER */}
          {type === "workforce_labourer" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Labourer Name *
                </label>
                <input
                  type="text"
                  value={formData.name || ""}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="e.g., Emmanuel Mwangi"
                  className={`w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white ${errors.name ? "border-rose-500" : "border-slate-200 dark:border-slate-700"}`}
                />
                {errors.name && <span className="text-[10px] text-rose-500">{errors.name}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Designated Duty / Role
                </label>
                <input
                  type="text"
                  value={formData.role || ""}
                  onChange={(e) => handleChange("role", e.target.value)}
                  placeholder="e.g., Concrete Placement Hand"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Assigned Squad / Gang
                </label>
                <input
                  type="text"
                  value={formData.squad || ""}
                  onChange={(e) => handleChange("squad", e.target.value)}
                  placeholder="e.g., Squad 4 - Culvert Gang"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Trade Specialty
                </label>
                <input
                  type="text"
                  value={formData.trade || ""}
                  onChange={(e) => handleChange("trade", e.target.value)}
                  placeholder="e.g., Steel Fixing / Shuttering"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Supervising Lead
                </label>
                <input
                  type="text"
                  value={formData.lead || ""}
                  onChange={(e) => handleChange("lead", e.target.value)}
                  placeholder="e.g., J. Makupa (Foreman)"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Shift Hours
                </label>
                <input
                  type="text"
                  value={formData.shift || ""}
                  onChange={(e) => handleChange("shift", e.target.value)}
                  placeholder="e.g., 07:00 - 16:30"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Daily Rate
                </label>
                <input
                  type="text"
                  value={formData.dailyRate || ""}
                  onChange={(e) => handleChange("dailyRate", e.target.value)}
                  placeholder="e.g., 35,000 TZS"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Site Location
                </label>
                <input
                  type="text"
                  value={formData.location || ""}
                  onChange={(e) => handleChange("location", e.target.value)}
                  placeholder="e.g., Bridge Pier 3"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Status
                </label>
                <select
                  value={formData.status || "Active"}
                  onChange={(e) => handleChange("status", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                >
                  <option value="Active">Active</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Standby">Standby</option>
                  <option value="Demobilized">Demobilized</option>
                </select>
              </div>
            </div>
          )}

          {/* 3. WORKFORCE COMPETENCY */}
          {type === "workforce_competency" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Personnel / Squad *
                </label>
                <input
                  type="text"
                  value={formData.person || ""}
                  onChange={(e) => handleChange("person", e.target.value)}
                  placeholder="e.g., Daniel Ochieng"
                  className={`w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white ${errors.person ? "border-rose-500" : "border-slate-200 dark:border-slate-700"}`}
                />
                {errors.person && <span className="text-[10px] text-rose-500">{errors.person}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Designated Role
                </label>
                <input
                  type="text"
                  value={formData.role || ""}
                  onChange={(e) => handleChange("role", e.target.value)}
                  placeholder="e.g., Crane Operator"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Accreditation / Qualification Title *
                </label>
                <input
                  type="text"
                  value={formData.accreditation || ""}
                  onChange={(e) => handleChange("accreditation", e.target.value)}
                  placeholder="e.g., Heavy Mobile Crane Operator Class A"
                  className={`w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white ${errors.accreditation ? "border-rose-500" : "border-slate-200 dark:border-slate-700"}`}
                />
                {errors.accreditation && <span className="text-[10px] text-rose-500">{errors.accreditation}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Certificate / License Number
                </label>
                <input
                  type="text"
                  value={formData.certNumber || ""}
                  onChange={(e) => handleChange("certNumber", e.target.value)}
                  placeholder="e.g., LIC-CR-99201"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Issuing Authority
                </label>
                <input
                  type="text"
                  value={formData.issuingBody || ""}
                  onChange={(e) => handleChange("issuingBody", e.target.value)}
                  placeholder="e.g., National Construction Council"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Valid Until / Expiry Date
                </label>
                <input
                  type="date"
                  value={formData.validUntil || ""}
                  onChange={(e) => handleChange("validUntil", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Compliance State
                </label>
                <select
                  value={formData.status || "Valid / Current"}
                  onChange={(e) => handleChange("status", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                >
                  <option value="Valid / Current">Valid / Current</option>
                  <option value="100% Compliant">100% Compliant</option>
                  <option value="Refreshed">Refreshed</option>
                  <option value="Expiring Soon">Expiring Soon</option>
                  <option value="Expired / Action Req">Expired / Action Req</option>
                </select>
              </div>
            </div>
          )}

          {/* 4. WORKFORCE TIMESHEET */}
          {type === "workforce_timesheet" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Staff Member / Worker *
                </label>
                <input
                  type="text"
                  value={formData.worker || ""}
                  onChange={(e) => handleChange("worker", e.target.value)}
                  placeholder="e.g., Bakari Simba"
                  className={`w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white ${errors.worker ? "border-rose-500" : "border-slate-200 dark:border-slate-700"}`}
                />
                {errors.worker && <span className="text-[10px] text-rose-500">{errors.worker}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={formData.category || "Staff"}
                  onChange={(e) => handleChange("category", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                >
                  <option value="Staff">Staff</option>
                  <option value="Foremen">Foremen</option>
                  <option value="Artisans">Artisans</option>
                  <option value="Drivers">Drivers / Operators</option>
                  <option value="Labour">Labour / Labourers</option>
                  <option value="Management">Management</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Designated Role
                </label>
                <input
                  type="text"
                  value={formData.role || ""}
                  onChange={(e) => handleChange("role", e.target.value)}
                  placeholder="e.g., Heavy Excavator Operator"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Week Ending Date
                </label>
                <input
                  type="date"
                  value={formData.weekEnding || ""}
                  onChange={(e) => handleChange("weekEnding", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Regular Hours (hrs)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={formData.regularHours ?? 40}
                  onChange={(e) => handleChange("regularHours", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Overtime Hours (hrs)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={formData.overtimeHours ?? 0}
                  onChange={(e) => handleChange("overtimeHours", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Total Logged Hours
                </label>
                <input
                  type="number"
                  readOnly
                  value={formData.total ?? 40}
                  className="w-full px-3 py-2 text-xs bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Verified By / Auditor
                </label>
                <input
                  type="text"
                  value={formData.verifiedBy || ""}
                  onChange={(e) => handleChange("verifiedBy", e.target.value)}
                  placeholder="e.g., Resident Engineer & Site Agent"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Approval Status
                </label>
                <select
                  value={formData.status || "Approved"}
                  onChange={(e) => handleChange("status", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                >
                  <option value="Approved">Approved</option>
                  <option value="Pending">Pending Audit</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            </div>
          )}

          {/* 5. PLANT ASSET */}
          {type === "plant_asset" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Asset Code / Tag *
                </label>
                <input
                  type="text"
                  value={formData.tag || ""}
                  onChange={(e) => handleChange("tag", e.target.value)}
                  placeholder="e.g., EXC-04"
                  className={`w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white ${errors.tag ? "border-rose-500" : "border-slate-200 dark:border-slate-700"}`}
                />
                {errors.tag && <span className="text-[10px] text-rose-500">{errors.tag}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Plant Model & Specs *
                </label>
                <input
                  type="text"
                  value={formData.name || ""}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="e.g., CAT 336D2 L Hydraulic Excavator"
                  className={`w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white ${errors.name ? "border-rose-500" : "border-slate-200 dark:border-slate-700"}`}
                />
                {errors.name && <span className="text-[10px] text-rose-500">{errors.name}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={formData.category || "Excavation"}
                  onChange={(e) => handleChange("category", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                >
                  <option value="Excavation">Excavation</option>
                  <option value="Hauling & Earthmoving">Hauling & Earthmoving</option>
                  <option value="Lifting & Cranes">Lifting & Cranes</option>
                  <option value="Concrete & Batching">Concrete & Batching</option>
                  <option value="Compaction & Rollers">Compaction & Rollers</option>
                  <option value="Power & Generators">Power & Generators</option>
                  <option value="Paving & Roadwork">Paving & Roadwork</option>
                  <option value="Commercial Vehicles">Commercial Vehicles</option>
                  <option value="Other">Other Equipment</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Active Workface / Allocation
                </label>
                <input
                  type="text"
                  value={formData.allocation || ""}
                  onChange={(e) => handleChange("allocation", e.target.value)}
                  placeholder="e.g., Cutting Section KM 12+500"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Assigned Operator
                </label>
                <input
                  type="text"
                  value={formData.operator || ""}
                  onChange={(e) => handleChange("operator", e.target.value)}
                  placeholder="e.g., Bakari Simba"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Daily Shift Hours
                </label>
                <input
                  type="text"
                  value={formData.hoursToday || ""}
                  onChange={(e) => handleChange("hoursToday", e.target.value)}
                  placeholder="e.g., 8.5h"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Fuel Level (%)
                </label>
                <input
                  type="text"
                  value={formData.fuelPct || ""}
                  onChange={(e) => handleChange("fuelPct", e.target.value)}
                  placeholder="e.g., 85%"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Next Service Due In
                </label>
                <input
                  type="text"
                  value={formData.nextService || ""}
                  onChange={(e) => handleChange("nextService", e.target.value)}
                  placeholder="e.g., In 120h (or date)"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Mechanical Condition
                </label>
                <select
                  value={formData.condition || "Operational"}
                  onChange={(e) => handleChange("condition", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                >
                  <option value="Operational">Operational</option>
                  <option value="Standby">Standby</option>
                  <option value="Maintenance Due">Maintenance Due</option>
                  <option value="Under Repair">Under Repair</option>
                  <option value="Decommissioned">Decommissioned</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Deployment Status
                </label>
                <select
                  value={formData.status || "In Use"}
                  onChange={(e) => handleChange("status", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                >
                  <option value="In Use">In Use</option>
                  <option value="Available">Available / Parked</option>
                  <option value="Maintenance">Under Maintenance</option>
                  <option value="Out of Service">Out of Service</option>
                </select>
              </div>
            </div>
          )}

          {/* 5b. PLANT ALLOCATION */}
          {type === "plant_allocation" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Plant Tag / Asset Code *
                </label>
                <input
                  type="text"
                  value={formData.tag || ""}
                  onChange={(e) => handleChange("tag", e.target.value)}
                  placeholder="e.g., EXC-04"
                  className={`w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white ${errors.tag ? "border-rose-500" : "border-slate-200 dark:border-slate-700"}`}
                />
                {errors.tag && <span className="text-[10px] text-rose-500">{errors.tag}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Plant Model / Description
                </label>
                <input
                  type="text"
                  value={formData.plantName || ""}
                  onChange={(e) => handleChange("plantName", e.target.value)}
                  placeholder="e.g., CAT 336D2 L Excavator"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Workface / Staging Location *
                </label>
                <input
                  type="text"
                  value={formData.workface || ""}
                  onChange={(e) => handleChange("workface", e.target.value)}
                  placeholder="e.g., Chainage KM 14+200 Deep Cut"
                  className={`w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white ${errors.workface ? "border-rose-500" : "border-slate-200 dark:border-slate-700"}`}
                />
                {errors.workface && <span className="text-[10px] text-rose-500">{errors.workface}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Assigned Operator
                </label>
                <input
                  type="text"
                  value={formData.operator || ""}
                  onChange={(e) => handleChange("operator", e.target.value)}
                  placeholder="e.g., Bakari Simba"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Allocation Status
                </label>
                <select
                  value={formData.status || "Active"}
                  onChange={(e) => handleChange("status", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                >
                  <option value="Active">Active</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.startDate || ""}
                  onChange={(e) => handleChange("startDate", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.endDate || ""}
                  onChange={(e) => handleChange("endDate", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* 5c. PLANT HOURS */}
          {type === "plant_hours" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Plant Tag / Asset Code *
                </label>
                <input
                  type="text"
                  value={formData.tag || ""}
                  onChange={(e) => handleChange("tag", e.target.value)}
                  placeholder="e.g., EXC-04"
                  className={`w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white ${errors.tag ? "border-rose-500" : "border-slate-200 dark:border-slate-700"}`}
                />
                {errors.tag && <span className="text-[10px] text-rose-500">{errors.tag}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Date Logged
                </label>
                <input
                  type="date"
                  value={formData.date || ""}
                  onChange={(e) => handleChange("date", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Shift Type
                </label>
                <select
                  value={formData.shift || "Day Shift (07:00 - 17:00)"}
                  onChange={(e) => handleChange("shift", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                >
                  <option value="Day Shift (07:00 - 17:00)">Day Shift (07:00 - 17:00)</option>
                  <option value="Night Shift (19:00 - 05:00)">Night Shift (19:00 - 05:00)</option>
                  <option value="Weekend Shift">Weekend Shift</option>
                  <option value="Double Shift">Double Shift</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Total Operating Hours (hrs)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.totalHours ?? 8}
                  onChange={(e) => handleChange("totalHours", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Fuel Consumed (Litres)
                </label>
                <input
                  type="number"
                  step="1"
                  value={formData.fuelConsumedLiters ?? 45}
                  onChange={(e) => handleChange("fuelConsumedLiters", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Operator
                </label>
                <input
                  type="text"
                  value={formData.operator || ""}
                  onChange={(e) => handleChange("operator", e.target.value)}
                  placeholder="e.g., Bakari Simba"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Supervisor Sign-off
                </label>
                <input
                  type="text"
                  value={formData.supervisor || ""}
                  onChange={(e) => handleChange("supervisor", e.target.value)}
                  placeholder="e.g., Plant Superintendent"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* 5d. PLANT MAINTENANCE */}
          {type === "plant_maintenance" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Plant Tag / Asset Code *
                </label>
                <input
                  type="text"
                  value={formData.tag || ""}
                  onChange={(e) => handleChange("tag", e.target.value)}
                  placeholder="e.g., EXC-04"
                  className={`w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white ${errors.tag ? "border-rose-500" : "border-slate-200 dark:border-slate-700"}`}
                />
                {errors.tag && <span className="text-[10px] text-rose-500">{errors.tag}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Service Type
                </label>
                <select
                  value={formData.serviceType || "Routine 250h Service"}
                  onChange={(e) => handleChange("serviceType", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                >
                  <option value="Routine 250h Service">Routine 250h Service</option>
                  <option value="500h Major Service">500h Major Service</option>
                  <option value="1000h Overhaul">1000h Overhaul</option>
                  <option value="Breakdown Repair">Breakdown Repair</option>
                  <option value="Daily Inspection">Daily Inspection</option>
                  <option value="Pre-Start Check">Pre-Start Check</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Service Date
                </label>
                <input
                  type="date"
                  value={formData.serviceDate || ""}
                  onChange={(e) => handleChange("serviceDate", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Next Service Due Date
                </label>
                <input
                  type="date"
                  value={formData.nextDueDate || ""}
                  onChange={(e) => handleChange("nextDueDate", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Technician / Workshop
                </label>
                <input
                  type="text"
                  value={formData.technician || ""}
                  onChange={(e) => handleChange("technician", e.target.value)}
                  placeholder="e.g., Authorized CAT Dealer"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Status
                </label>
                <select
                  value={formData.status || "Completed"}
                  onChange={(e) => handleChange("status", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                >
                  <option value="Completed">Completed</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Overdue">Overdue</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Parts Replaced
                </label>
                <input
                  type="text"
                  value={formData.partsReplaced || ""}
                  onChange={(e) => handleChange("partsReplaced", e.target.value)}
                  placeholder="e.g., Oil filters, hydraulic seal kit"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Maintenance Cost
                </label>
                <input
                  type="text"
                  value={formData.cost || ""}
                  onChange={(e) => handleChange("cost", e.target.value)}
                  placeholder="e.g., 450,000 TZS"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* 6. MATERIAL INVENTORY */}
          {type === "material_inventory" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Material SKU Code *
                </label>
                <input
                  type="text"
                  value={formData.code || ""}
                  onChange={(e) => handleChange("code", e.target.value)}
                  placeholder="e.g., MAT-CEM-01"
                  className={`w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white ${errors.code ? "border-rose-500" : "border-slate-200 dark:border-slate-700"}`}
                />
                {errors.code && <span className="text-[10px] text-rose-500">{errors.code}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Material Description *
                </label>
                <input
                  type="text"
                  value={formData.name || ""}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="e.g., Portland Cement 42.5N"
                  className={`w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white ${errors.name ? "border-rose-500" : "border-slate-200 dark:border-slate-700"}`}
                />
                {errors.name && <span className="text-[10px] text-rose-500">{errors.name}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={formData.category || "Cement & Binders"}
                  onChange={(e) => handleChange("category", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                >
                  <option value="Cement & Binders">Cement & Binders</option>
                  <option value="Aggregate & Sand">Aggregate & Sand</option>
                  <option value="Steel & Rebar">Steel & Rebar</option>
                  <option value="Bitumen & Asphalt">Bitumen & Asphalt</option>
                  <option value="Pipes & Drainage">Pipes & Drainage</option>
                  <option value="Geotextiles">Geotextiles & Geomembranes</option>
                  <option value="Fuel & Lubricants">Fuel & Lubricants</option>
                  <option value="Timber & Formwork">Timber & Formwork</option>
                  <option value="Other">Other Materials</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Unit of Measure
                </label>
                <select
                  value={formData.unit || "Bags"}
                  onChange={(e) => handleChange("unit", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                >
                  <option value="Bags">Bags (50kg)</option>
                  <option value="Tonnes">Tonnes</option>
                  <option value="m³">m³ (Cubic Metres)</option>
                  <option value="Litres">Litres</option>
                  <option value="Kg">Kg</option>
                  <option value="Lin.m">Lin.m (Linear Metres)</option>
                  <option value="Units">Units / Pcs</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Stock on Hand
                </label>
                <input
                  type="number"
                  step="any"
                  value={formData.stockOnHand ?? 0}
                  onChange={(e) => handleChange("stockOnHand", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Daily Burn Rate (Consumption)
                </label>
                <input
                  type="text"
                  value={formData.dailyConsumption || ""}
                  onChange={(e) => handleChange("dailyConsumption", e.target.value)}
                  placeholder="e.g., 50 Bags/day"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reorder Level Threshold
                </label>
                <input
                  type="number"
                  step="any"
                  value={formData.reorderLevel ?? 100}
                  onChange={(e) => handleChange("reorderLevel", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  QA Batch / Mill Certificate
                </label>
                <input
                  type="text"
                  value={formData.batchCert || ""}
                  onChange={(e) => handleChange("batchCert", e.target.value)}
                  placeholder="e.g., MILL-QA-2026-88"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Approved Supplier
                </label>
                <input
                  type="text"
                  value={formData.supplier || ""}
                  onChange={(e) => handleChange("supplier", e.target.value)}
                  placeholder="e.g., Twiga Cement Ltd"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Stock Status
                </label>
                <select
                  value={formData.status || "Optimal"}
                  onChange={(e) => handleChange("status", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                >
                  <option value="Optimal">Optimal</option>
                  <option value="Adequate">Adequate</option>
                  <option value="Low Stock">Low Stock</option>
                  <option value="Critical">Critical</option>
                  <option value="Out of Stock">Out of Stock</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Yard / Storage Location
                </label>
                <input
                  type="text"
                  value={formData.location || ""}
                  onChange={(e) => handleChange("location", e.target.value)}
                  placeholder="e.g., Central Batching Yard Shed 2"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* 6b. MATERIAL DELIVERY */}
          {type === "material_delivery" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Delivery / GRN Reference *
                </label>
                <input
                  type="text"
                  value={formData.deliveryRef || ""}
                  onChange={(e) => handleChange("deliveryRef", e.target.value)}
                  placeholder="e.g., GRN-2026-441"
                  className={`w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white ${errors.deliveryRef ? "border-rose-500" : "border-slate-200 dark:border-slate-700"}`}
                />
                {errors.deliveryRef && <span className="text-[10px] text-rose-500">{errors.deliveryRef}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Material Description / Code *
                </label>
                <input
                  type="text"
                  value={formData.materialName || ""}
                  onChange={(e) => handleChange("materialName", e.target.value)}
                  placeholder="e.g., Ready-Mix Concrete C30/37"
                  className={`w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white ${errors.materialName ? "border-rose-500" : "border-slate-200 dark:border-slate-700"}`}
                />
                {errors.materialName && <span className="text-[10px] text-rose-500">{errors.materialName}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Quantity Received
                </label>
                <input
                  type="number"
                  step="any"
                  value={formData.quantityReceived ?? 0}
                  onChange={(e) => handleChange("quantityReceived", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Unit
                </label>
                <select
                  value={formData.unit || "Tonnes"}
                  onChange={(e) => handleChange("unit", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                >
                  <option value="Tonnes">Tonnes</option>
                  <option value="m³">m³</option>
                  <option value="Bags">Bags</option>
                  <option value="Litres">Litres</option>
                  <option value="Kg">Kg</option>
                  <option value="Units">Units</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Supplier
                </label>
                <input
                  type="text"
                  value={formData.supplier || ""}
                  onChange={(e) => handleChange("supplier", e.target.value)}
                  placeholder="e.g., AfriMix Concrete Batching"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Delivery Date
                </label>
                <input
                  type="date"
                  value={formData.deliveryDate || ""}
                  onChange={(e) => handleChange("deliveryDate", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  QA Batch / Mill Certificate
                </label>
                <input
                  type="text"
                  value={formData.batchCert || ""}
                  onChange={(e) => handleChange("batchCert", e.target.value)}
                  placeholder="e.g., CERT-BATCH-991"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Received & Inspected By
                </label>
                <input
                  type="text"
                  value={formData.receivedBy || ""}
                  onChange={(e) => handleChange("receivedBy", e.target.value)}
                  placeholder="e.g., Chief Storekeeper & QA Inspector"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Haul Vehicle Reg
                </label>
                <input
                  type="text"
                  value={formData.vehicleReg || ""}
                  onChange={(e) => handleChange("vehicleReg", e.target.value)}
                  placeholder="e.g., T 482 DXC (Mercedes Tipper)"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Status
                </label>
                <select
                  value={formData.status || "Accepted & Inspected"}
                  onChange={(e) => handleChange("status", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                >
                  <option value="Accepted & Inspected">Accepted & Inspected</option>
                  <option value="Pending QA Test">Pending QA Test</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Partial">Partial Delivery</option>
                </select>
              </div>
            </div>
          )}

          {/* 6c. MATERIAL CONSUMPTION */}
          {type === "material_consumption" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Issue / Voucher Reference *
                </label>
                <input
                  type="text"
                  value={formData.issueRef || ""}
                  onChange={(e) => handleChange("issueRef", e.target.value)}
                  placeholder="e.g., ISSUE-2026-108"
                  className={`w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white ${errors.issueRef ? "border-rose-500" : "border-slate-200 dark:border-slate-700"}`}
                />
                {errors.issueRef && <span className="text-[10px] text-rose-500">{errors.issueRef}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Material Description / Code *
                </label>
                <input
                  type="text"
                  value={formData.materialName || ""}
                  onChange={(e) => handleChange("materialName", e.target.value)}
                  placeholder="e.g., G4 Sub-base Aggregate"
                  className={`w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white ${errors.materialName ? "border-rose-500" : "border-slate-200 dark:border-slate-700"}`}
                />
                {errors.materialName && <span className="text-[10px] text-rose-500">{errors.materialName}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Quantity Issued / Consumed
                </label>
                <input
                  type="number"
                  step="any"
                  value={formData.quantityIssued ?? 0}
                  onChange={(e) => handleChange("quantityIssued", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Unit
                </label>
                <select
                  value={formData.unit || "m³"}
                  onChange={(e) => handleChange("unit", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                >
                  <option value="m³">m³</option>
                  <option value="Tonnes">Tonnes</option>
                  <option value="Bags">Bags</option>
                  <option value="Litres">Litres</option>
                  <option value="Kg">Kg</option>
                  <option value="Lin.m">Lin.m</option>
                  <option value="Units">Units</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Target Workface / Section
                </label>
                <input
                  type="text"
                  value={formData.workface || ""}
                  onChange={(e) => handleChange("workface", e.target.value)}
                  placeholder="e.g., Roadway Layer KM 14+000 to 14+500"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Date Issued
                </label>
                <input
                  type="date"
                  value={formData.issueDate || ""}
                  onChange={(e) => handleChange("issueDate", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Issued To (Foreman / Gang)
                </label>
                <input
                  type="text"
                  value={formData.issuedTo || ""}
                  onChange={(e) => handleChange("issuedTo", e.target.value)}
                  placeholder="e.g., Earthworks Gang (Foreman Juma)"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Approved By (Engineer)
                </label>
                <input
                  type="text"
                  value={formData.approvedBy || ""}
                  onChange={(e) => handleChange("approvedBy", e.target.value)}
                  placeholder="e.g., Senior Pavement Engineer"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* 7. LOGISTICS TRANSPORT */}
          {type === "logistics_transport" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Consignment Ref / Waybill *
                </label>
                <input
                  type="text"
                  value={formData.consignment || ""}
                  onChange={(e) => handleChange("consignment", e.target.value)}
                  placeholder="e.g., WB-TZ-2026-880"
                  className={`w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white ${errors.consignment ? "border-rose-500" : "border-slate-200 dark:border-slate-700"}`}
                />
                {errors.consignment && <span className="text-[10px] text-rose-500">{errors.consignment}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Origin Point
                </label>
                <input
                  type="text"
                  value={formData.origin || ""}
                  onChange={(e) => handleChange("origin", e.target.value)}
                  placeholder="e.g., Dar es Salaam Central Port"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Site Delivery Point / Destination *
                </label>
                <input
                  type="text"
                  value={formData.destination || ""}
                  onChange={(e) => handleChange("destination", e.target.value)}
                  placeholder="e.g., Corridor Gate 3 (Batching Plant)"
                  className={`w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white ${errors.destination ? "border-rose-500" : "border-slate-200 dark:border-slate-700"}`}
                />
                {errors.destination && <span className="text-[10px] text-rose-500">{errors.destination}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Driver Name
                </label>
                <input
                  type="text"
                  value={formData.driver || ""}
                  onChange={(e) => handleChange("driver", e.target.value)}
                  placeholder="e.g., Peter K. Muro"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Vehicle Reg & Type
                </label>
                <input
                  type="text"
                  value={formData.vehicle || ""}
                  onChange={(e) => handleChange("vehicle", e.target.value)}
                  placeholder="e.g., T 892 CCK (Scania R500 Semi)"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Load Description & Weight / Quantities
                </label>
                <input
                  type="text"
                  value={formData.loadWeight || ""}
                  onChange={(e) => handleChange("loadWeight", e.target.value)}
                  placeholder="e.g., 32 Tonnes High-Yield Rebar"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Departure Time
                </label>
                <input
                  type="text"
                  value={formData.departure || ""}
                  onChange={(e) => handleChange("departure", e.target.value)}
                  placeholder="e.g., 08:30 AM"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Estimated Arrival (ETA)
                </label>
                <input
                  type="text"
                  value={formData.eta || ""}
                  onChange={(e) => handleChange("eta", e.target.value)}
                  placeholder="e.g., 03:00 PM"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Transit Status
                </label>
                <select
                  value={formData.status || "In Transit"}
                  onChange={(e) => handleChange("status", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                >
                  <option value="In Transit">In Transit</option>
                  <option value="Delivered">Delivered & Offloaded</option>
                  <option value="Dispatched">Dispatched</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Delayed">Delayed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Haulier / Fleet Company
                </label>
                <input
                  type="text"
                  value={formData.haulierCompany || ""}
                  onChange={(e) => handleChange("haulierCompany", e.target.value)}
                  placeholder="e.g., Trans-East Logistics Ltd"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* 7b. LOGISTICS DISPATCH */}
          {type === "logistics_dispatch" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Dispatch Reference *
                </label>
                <input
                  type="text"
                  value={formData.dispatchRef || ""}
                  onChange={(e) => handleChange("dispatchRef", e.target.value)}
                  placeholder="e.g., DSP-2026-904"
                  className={`w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white ${errors.dispatchRef ? "border-rose-500" : "border-slate-200 dark:border-slate-700"}`}
                />
                {errors.dispatchRef && <span className="text-[10px] text-rose-500">{errors.dispatchRef}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Transporter
                </label>
                <input
                  type="text"
                  value={formData.transporter || ""}
                  onChange={(e) => handleChange("transporter", e.target.value)}
                  placeholder="e.g., Freight Express Ltd"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Origin
                </label>
                <input
                  type="text"
                  value={formData.origin || ""}
                  onChange={(e) => handleChange("origin", e.target.value)}
                  placeholder="e.g., Central Quarry 1"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Destination
                </label>
                <input
                  type="text"
                  value={formData.destination || ""}
                  onChange={(e) => handleChange("destination", e.target.value)}
                  placeholder="e.g., Site Stockpile B"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Load Description & Weight
                </label>
                <input
                  type="text"
                  value={formData.loadWeight || ""}
                  onChange={(e) => handleChange("loadWeight", e.target.value)}
                  placeholder="e.g., 28 Tons Aggregate"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Driver Name
                </label>
                <input
                  type="text"
                  value={formData.driver || ""}
                  onChange={(e) => handleChange("driver", e.target.value)}
                  placeholder="e.g., J. Mwakasege"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Departure Date
                </label>
                <input
                  type="date"
                  value={formData.departureDate || ""}
                  onChange={(e) => handleChange("departureDate", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Dispatch Status
                </label>
                <select
                  value={formData.status || "Dispatched"}
                  onChange={(e) => handleChange("status", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                >
                  <option value="Dispatched">Dispatched</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="In Transit">In Transit</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          )}

          {/* 7c. LOGISTICS MOVEMENT */}
          {type === "logistics_movement" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tracking / Movement Ref *
                </label>
                <input
                  type="text"
                  value={formData.trackingRef || ""}
                  onChange={(e) => handleChange("trackingRef", e.target.value)}
                  placeholder="e.g., TRK-2026-551"
                  className={`w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white ${errors.trackingRef ? "border-rose-500" : "border-slate-200 dark:border-slate-700"}`}
                />
                {errors.trackingRef && <span className="text-[10px] text-rose-500">{errors.trackingRef}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Waybill / Consignment Ref
                </label>
                <input
                  type="text"
                  value={formData.waybillRef || ""}
                  onChange={(e) => handleChange("waybillRef", e.target.value)}
                  placeholder="e.g., WB-TZ-2026-880"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Current Checkpoint / Location *
                </label>
                <input
                  type="text"
                  value={formData.checkpoint || ""}
                  onChange={(e) => handleChange("checkpoint", e.target.value)}
                  placeholder="e.g., Weighbridge Station KM 22"
                  className={`w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white ${errors.checkpoint ? "border-rose-500" : "border-slate-200 dark:border-slate-700"}`}
                />
                {errors.checkpoint && <span className="text-[10px] text-rose-500">{errors.checkpoint}</span>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Time Logged
                </label>
                <input
                  type="text"
                  value={formData.timestamp || ""}
                  onChange={(e) => handleChange("timestamp", e.target.value)}
                  placeholder="e.g., 10:45 AM"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Driver Name
                </label>
                <input
                  type="text"
                  value={formData.driver || ""}
                  onChange={(e) => handleChange("driver", e.target.value)}
                  placeholder="e.g., Peter K. Muro"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Vehicle Reg
                </label>
                <input
                  type="text"
                  value={formData.vehicleReg || ""}
                  onChange={(e) => handleChange("vehicleReg", e.target.value)}
                  placeholder="e.g., T 892 CCK"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Status
                </label>
                <select
                  value={formData.status || "En Route"}
                  onChange={(e) => handleChange("status", e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:border-amber-500 dark:text-white"
                >
                  <option value="At Origin">At Origin</option>
                  <option value="En Route">En Route</option>
                  <option value="At Weighbridge">At Weighbridge</option>
                  <option value="At Site Gate">At Site Gate</option>
                  <option value="Offloaded & Cleared">Offloaded & Cleared</option>
                  <option value="Delayed">Delayed</option>
                </select>
              </div>
            </div>
          )}

          {/* Modal Footer Buttons */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              {isEditing ? "Update Record" : "Save & Register"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
