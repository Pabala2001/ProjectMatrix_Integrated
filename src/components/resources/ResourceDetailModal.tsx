import React from "react";
import { X, Calendar, MapPin, Phone, Mail, Award, Clock, Tag, ShieldCheck, Truck, Boxes, Navigation, User, Edit } from "lucide-react";
import { ResourceRecordType } from "../../types/resources";

interface ResourceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: any;
  type: ResourceRecordType;
  onEdit?: () => void;
  canEdit?: boolean;
}

export const ResourceDetailModal: React.FC<ResourceDetailModalProps> = ({
  isOpen,
  onClose,
  record,
  type,
  onEdit,
  canEdit = true
}) => {
  if (!isOpen || !record) return null;

  const getModalMeta = () => {
    switch (type) {
      case "workforce_staff":
        return {
          title: record.name,
          subtitle: `${record.role} · ${record.category}`,
          icon: User,
          badge: record.status || "Active"
        };
      case "workforce_labourer":
        return {
          title: record.name,
          subtitle: `${record.role} · Squad: ${record.squad}`,
          icon: User,
          badge: record.status || "Active"
        };
      case "workforce_competency":
        return {
          title: record.accreditation,
          subtitle: `${record.person} (${record.role})`,
          icon: Award,
          badge: record.status || "Valid"
        };
      case "workforce_timesheet":
        return {
          title: `Timesheet: ${record.worker}`,
          subtitle: `Week Ending: ${record.weekEnding} · Total: ${record.total}h`,
          icon: Clock,
          badge: record.status || "Approved"
        };
      case "plant_asset":
        return {
          title: `${record.tag} - ${record.name}`,
          subtitle: `${record.category} · Workface: ${record.allocation}`,
          icon: Truck,
          badge: record.condition || record.status || "Operational"
        };
      case "plant_allocation":
        return {
          title: `Plant Allocation: ${record.tag}`,
          subtitle: `${record.plantName || record.tag} -> ${record.workface}`,
          icon: Truck,
          badge: record.status || "Active"
        };
      case "plant_hours":
        return {
          title: `Operating Hours: ${record.tag}`,
          subtitle: `${record.date} · ${record.totalHours} hrs logged`,
          icon: Clock,
          badge: record.shift || "Day Shift"
        };
      case "plant_maintenance":
        return {
          title: `Maintenance: ${record.tag}`,
          subtitle: `${record.serviceType} · Date: ${record.serviceDate}`,
          icon: ShieldCheck,
          badge: record.status || "Completed"
        };
      case "material_inventory":
        return {
          title: `${record.code}: ${record.name}`,
          subtitle: `Stock on Hand: ${record.stockOnHand} ${record.unit}`,
          icon: Boxes,
          badge: record.status || "Adequate"
        };
      case "material_delivery":
        return {
          title: `Delivery ${record.deliveryRef}`,
          subtitle: `${record.quantityReceived} ${record.unit} · ${record.materialName}`,
          icon: Boxes,
          badge: record.status || "Accepted"
        };
      case "material_consumption":
        return {
          title: `Material Issue ${record.issueRef}`,
          subtitle: `${record.quantityIssued} ${record.unit} -> ${record.workface}`,
          icon: Boxes,
          badge: record.status || "Consumed"
        };
      case "logistics_transport":
        return {
          title: `Transport ${record.consignment}`,
          subtitle: `${record.origin} -> ${record.destination}`,
          icon: Navigation,
          badge: record.status || "In Transit"
        };
      case "logistics_dispatch":
        return {
          title: `Dispatch ${record.dispatchRef}`,
          subtitle: `${record.origin} -> ${record.destination}`,
          icon: Navigation,
          badge: record.status || "Dispatched"
        };
      case "logistics_movement":
        return {
          title: `Tracking ${record.trackingRef}`,
          subtitle: `Checkpoint: ${record.checkpoint}`,
          icon: Navigation,
          badge: record.status || "En Route"
        };
      default:
        return {
          title: "Resource Record Details",
          subtitle: "System Record",
          icon: Tag,
          badge: "Active"
        };
    }
  };

  const meta = getModalMeta();
  const Icon = meta.icon;

  // Filter out internal fields
  const displayFields = Object.entries(record).filter(
    ([key]) => !["id", "projectId", "createdAt", "updatedAt"].includes(key)
  );

  const formatKey = (key: string) => {
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .replace(/_/g, " ");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden animate-scaleUp flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900 dark:text-white truncate">
                  {meta.title}
                </h3>
                {meta.badge && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                    {meta.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                {meta.subtitle}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {displayFields.map(([key, val]) => (
              <div key={key} className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-100 dark:border-slate-800/80">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                  {formatKey(key)}
                </div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white break-words">
                  {val !== null && val !== undefined && val !== "" ? String(val) : "—"}
                </div>
              </div>
            ))}
          </div>

          {/* Audit Timestamp metadata */}
          <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
            <span>Record ID: <span className="font-mono">{record.id}</span></span>
            {record.updatedAt && (
              <span>Last updated: {new Date(record.updatedAt).toLocaleString()}</span>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Close
          </button>

          {canEdit && onEdit && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit();
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Edit className="w-3.5 h-3.5" />
              Edit Record
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
