import { assertOperationalAction } from "../../integration/operationalAccess";
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  RotateCw,
  Plus,
  SlidersHorizontal,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  X,
  Package,
  Building2,
  FileText,
  Search,
  Tag
} from "lucide-react";
import {
  ProjectInventoryItem,
  InventoryCategory,
  CreateCompanyStockInput,
  UpdateInventoryItemInput
} from "../../types/inventory";
import {
  getProjectInventoryItems,
  createCompanyStockItem,
  updateInventoryItem,
  softDeleteInventoryItem,
  isInventoryCategory
} from "../../services/inventoryService";
import { ProcurementItem } from "../../pages/Procurement/ProcurementPage";

interface InventoryStatusViewProps {
  companyId: string | undefined | null;
  projectId: string | undefined | null;
  procurementItems?: ProcurementItem[];
}

const CATEGORIES: InventoryCategory[] = [
  "OHS",
  "Site Establishment",
  "Operational Costs",
  "Environmental"
];

export default function InventoryStatusView({
  companyId,
  projectId,
  procurementItems = []
}: InventoryStatusViewProps) {
  const [items, setItems] = useState<ProjectInventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Filters & Search
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<ProjectInventoryItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<ProjectInventoryItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form states for Add Company Stock
  const [addCategory, setAddCategory] = useState<InventoryCategory>("OHS");
  const [addSubcategory, setAddSubcategory] = useState<string>("");
  const [addItemName, setAddItemName] = useState<string>("");
  const [addQuantity, setAddQuantity] = useState<string>("1");
  const [addDescription, setAddDescription] = useState<string>("");

  // Form states for Edit
  const [editCategory, setEditCategory] = useState<InventoryCategory>("OHS");
  const [editSubcategory, setEditSubcategory] = useState<string>("");
  const [editItemName, setEditItemName] = useState<string>("");
  const [editQuantity, setEditQuantity] = useState<string>("");
  const [editDescription, setEditDescription] = useState<string>("");

  // Request race condition guard token
  const requestTokenRef = useRef<number>(0);

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Load Inventory Data
  const loadInventory = useCallback(async () => {
    if (!companyId || !projectId) {
      setItems([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const currentToken = ++requestTokenRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const data = await getProjectInventoryItems(companyId, projectId);
      // Prevent stale async response overwrite
      if (currentToken === requestTokenRef.current) {
        setItems(data);
        setIsLoading(false);
      }
    } catch (err: any) {
      if (currentToken === requestTokenRef.current) {
        console.error("Error loading inventory:", err);
        setError(err.message || "Failed to load project inventory.");
        setIsLoading(false);
      }
    }
  }, [companyId, projectId]);

  useEffect(() => {
    // Clear items immediately when scope changes
    setItems([]);
    loadInventory();
  }, [loadInventory]);

  // Helper to resolve Procurement Status
  const getProcurementStatus = (item: ProjectInventoryItem): string => {
    if (item.source === "company_stock") {
      return "Company Stock";
    }
    if (item.procurement_item_id && procurementItems.length > 0) {
      const match = procurementItems.find((p) => p.id === item.procurement_item_id);
      if (match) {
        return match.status;
      }
    }
    return "Not available";
  };

  // Open Add Modal
  const handleOpenAddModal = () => {
    setAddCategory("OHS");
    setAddSubcategory("");
    setAddItemName("");
    setAddQuantity("1");
    setAddDescription("");
    setModalError(null);
    setIsAddModalOpen(true);
  };

  // Submit Add Company Stock
  const handleSaveAdd = async (e: React.FormEvent) => {
    assertOperationalAction("write", "components/inventory/InventoryStatusView.tsx");
    e.preventDefault();
    if (!companyId || !projectId) {
      setModalError("Company and Project context required.");
      return;
    }

    const parsedQty = parseFloat(addQuantity);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setModalError("Quantity must be a number greater than zero.");
      return;
    }

    if (!addItemName.trim()) {
      setModalError("Item name is required.");
      return;
    }

    if (!addDescription.trim()) {
      setModalError("Description is required for company stock.");
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      const input: CreateCompanyStockInput = {
        category: addCategory,
        subcategory: addSubcategory.trim() || null,
        item_name: addItemName.trim(),
        quantity: parsedQty,
        description: addDescription.trim()
      };

      await createCompanyStockItem(companyId, projectId, input);
      setIsAddModalOpen(false);
      setToastMessage("Company stock item added successfully.");
      await loadInventory();
    } catch (err: any) {
      console.error("Error creating company stock:", err);
      setModalError(err.message || "Failed to add company stock item.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (item: ProjectInventoryItem) => {
    setEditingItem(item);
    setEditCategory(item.category || "OHS");
    setEditSubcategory(item.subcategory || "");
    setEditItemName(item.item_name || "");
    setEditQuantity(item.quantity !== null ? String(item.quantity) : "");
    setEditDescription(item.description || "");
    setModalError(null);
  };

  // Submit Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    assertOperationalAction("write", "components/inventory/InventoryStatusView.tsx");
    e.preventDefault();
    if (!companyId || !projectId || !editingItem) {
      setModalError("Context missing.");
      return;
    }

    const parsedQty = parseFloat(editQuantity);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      setModalError("Quantity must be a number greater than zero.");
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      const input: UpdateInventoryItemInput = {};

      if (editingItem.source === "procurement") {
        input.quantity = parsedQty;
        input.description = editDescription.trim() ? editDescription.trim() : null;
      } else {
        // company_stock
        if (!editItemName.trim()) {
          setModalError("Item name is required for company stock.");
          setIsSubmitting(false);
          return;
        }
        if (!editDescription.trim()) {
          setModalError("Description is required for company stock.");
          setIsSubmitting(false);
          return;
        }
        input.category = editCategory;
        input.subcategory = editSubcategory.trim() ? editSubcategory.trim() : null;
        input.item_name = editItemName.trim();
        input.quantity = parsedQty;
        input.description = editDescription.trim();
      }

      await updateInventoryItem(companyId, projectId, editingItem.id, input);
      setEditingItem(null);
      setToastMessage("Inventory item updated successfully.");
      await loadInventory();
    } catch (err: any) {
      console.error("Error updating inventory item:", err);
      setModalError(err.message || "Failed to update inventory item.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete
  const handleConfirmDelete = async () => {
    if (!companyId || !projectId || !deletingItem) return;

    setIsSubmitting(true);
    setModalError(null);

    try {
      await softDeleteInventoryItem(companyId, projectId, deletingItem.id);
      setDeletingItem(null);
      setToastMessage("Inventory item removed.");
      await loadInventory();
    } catch (err: any) {
      console.error("Error soft-deleting item:", err);
      setModalError(err.message || "Failed to delete item.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered List
  const filteredItems = items.filter((item) => {
    // Category filter
    if (selectedCategory !== "All" && item.category !== selectedCategory) {
      return false;
    }
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = item.item_name.toLowerCase().includes(q);
      const subMatch = (item.subcategory || "").toLowerCase().includes(q);
      const descMatch = (item.description || "").toLowerCase().includes(q);
      const userMatch = (item.logged_by_name || "").toLowerCase().includes(q);
      return nameMatch || subMatch || descMatch || userMatch;
    }
    return true;
  });

  // Check missing scope
  if (!companyId || !projectId) {
    return (
      <div className="bg-white p-12 text-center rounded-3xl border border-[#E2E8F0] shadow-xs">
        <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
          Select Company & Project Scope
        </h3>
        <p className="text-xs text-slate-400 font-medium max-w-md mx-auto mt-2 leading-relaxed">
          Please select an active company and project from the top bar to view inventory.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-[#07182E] text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs font-semibold animate-slide-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="bg-white p-6 rounded-3xl border border-[#E2E8F0] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-[#FF9F1C]" />
            <h2 className="text-base font-extrabold text-[#07182E] tracking-tight">
              Inventory and Status
            </h2>
          </div>
          <p className="text-xs text-slate-400 font-medium mt-1">
            Eligible procurement items appear automatically upon payment or delivery. Company-owned stock can be added manually.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={loadInventory}
            disabled={isLoading}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 bg-[#07182E] hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4 text-[#FF9F1C]" />
            Add Company-Owned Item
          </button>
        </div>
      </div>

      {/* FILTER AND SEARCH BAR */}
      <div className="bg-white p-4 rounded-2xl border border-[#E2E8F0] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedCategory("All")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              selectedCategory === "All"
                ? "bg-[#07182E] text-white shadow-xs"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            All Categories ({items.length})
          </button>
          {CATEGORIES.map((cat) => {
            const count = items.filter((i) => i.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-[#07182E] text-white shadow-xs"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search inventory..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 focus:outline-none focus:border-[#FF9F1C] focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* ERROR STATE */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadInventory}
            className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-800 text-xs font-bold rounded-lg transition-all"
          >
            Retry
          </button>
        </div>
      )}

      {/* TABLE / CONTENT AREA */}
      {isLoading ? (
        <div className="bg-white p-12 rounded-3xl border border-[#E2E8F0] text-center">
          <RotateCw className="w-8 h-8 text-[#FF9F1C] animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-600">Loading project inventory...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-3xl border border-[#E2E8F0] shadow-xs">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">
            {items.length === 0
              ? "No Inventory Items Found"
              : `No Items in "${selectedCategory}"`}
          </h3>
          <p className="text-xs text-slate-400 font-medium max-w-md mx-auto mt-2 leading-relaxed">
            {items.length === 0
              ? "Eligible procurement items appear automatically once procured, delivered, or paid, or you can add company-owned stock manually."
              : "There are no inventory items matching the selected category filter."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#07182E] text-white text-[11px] font-extrabold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Item Name</th>
                  <th className="py-3.5 px-4">Category / Subcategory</th>
                  <th className="py-3.5 px-4">Source</th>
                  <th className="py-3.5 px-4">Procurement Status</th>
                  <th className="py-3.5 px-4 text-right">Quantity</th>
                  <th className="py-3.5 px-4">Description</th>
                  <th className="py-3.5 px-4">Logged By & Date</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredItems.map((item) => {
                  const statusLabel = getProcurementStatus(item);

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* Item Name */}
                      <td className="py-3.5 px-4 font-bold text-[#07182E]">
                        {item.item_name}
                      </td>

                      {/* Category & Subcategory */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-700">
                          {item.category || "-"}
                        </div>
                        {item.subcategory && (
                          <div className="text-[11px] text-slate-400 font-medium">
                            {item.subcategory}
                          </div>
                        )}
                      </td>

                      {/* Source */}
                      <td className="py-3.5 px-4">
                        {item.source === "procurement" ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Procurement
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            Company Stock
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            statusLabel === "Delivered"
                              ? "bg-emerald-100 text-emerald-800"
                              : statusLabel === "Paid"
                              ? "bg-green-100 text-green-800"
                              : statusLabel === "Procured"
                              ? "bg-blue-100 text-blue-800"
                              : statusLabel === "Company Stock"
                              ? "bg-slate-100 text-slate-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {statusLabel}
                        </span>
                      </td>

                      {/* Quantity */}
                      <td className="py-3.5 px-4 text-right font-bold text-slate-800">
                        {item.quantity !== null ? item.quantity : "-"}
                      </td>

                      {/* Description */}
                      <td className="py-3.5 px-4 text-slate-600 font-medium max-w-xs truncate">
                        {item.description || "-"}
                      </td>

                      {/* Logged User & Date */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-700">
                          {item.logged_by_name || "System / Unknown"}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          {item.logged_at
                            ? new Date(item.logged_at).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric"
                              })
                            : "-"}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            title="Edit Item"
                            className="p-1.5 text-slate-400 hover:text-[#07182E] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingItem(item)}
                            title="Delete Item"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADD COMPANY STOCK MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-[#07182E]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl w-full max-w-md overflow-hidden animate-scale-up flex flex-col max-h-[90vh]">
            <div className="bg-[#07182E] text-white p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#FF9F1C]" />
                <h3 className="font-extrabold text-sm tracking-tight">
                  Add Company-Owned Stock
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAdd} className="p-6 space-y-4 overflow-y-auto flex-1 max-h-[calc(90vh-70px)]">
              {modalError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Category */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Category *
                </label>
                <select
                  value={addCategory}
                  onChange={(e) => setAddCategory(e.target.value as InventoryCategory)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#FF9F1C]"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subcategory */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Subcategory (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Personal Protective Equipment"
                  value={addSubcategory}
                  onChange={(e) => setAddSubcategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#FF9F1C]"
                />
              </div>

              {/* Item Name */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Safety Helmets (Class E)"
                  value={addItemName}
                  onChange={(e) => setAddItemName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#FF9F1C]"
                />
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Quantity *
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={addQuantity}
                  onChange={(e) => setAddQuantity(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#FF9F1C]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Description *
                </label>
                <textarea
                  rows={3}
                  placeholder="Detailed description of company stock..."
                  value={addDescription}
                  onChange={(e) => setAddDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#FF9F1C]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#07182E] hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingItem && (
        <div className="fixed inset-0 bg-[#07182E]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl w-full max-w-md overflow-hidden animate-scale-up flex flex-col max-h-[90vh]">
            <div className="bg-[#07182E] text-white p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-[#FF9F1C]" />
                <h3 className="font-extrabold text-sm tracking-tight">
                  Edit {editingItem.source === "procurement" ? "Procurement" : "Company Stock"} Item
                </h3>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 overflow-y-auto flex-1 max-h-[calc(90vh-70px)]">
              {modalError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-xl text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Procurement Derived Read-Only Summary */}
              {editingItem.source === "procurement" ? (
                <>
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-xs text-amber-800 space-y-1">
                    <div className="font-bold">{editingItem.item_name}</div>
                    <div className="text-[11px] text-amber-700">
                      Category: {editingItem.category || "N/A"} | Source: Procurement
                    </div>
                  </div>

                  {/* Editable Quantity */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Quantity *
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={editQuantity}
                      onChange={(e) => setEditQuantity(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#FF9F1C]"
                    />
                  </div>

                  {/* Editable Description */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Description (Optional)
                    </label>
                    <textarea
                      rows={3}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#FF9F1C]"
                    />
                  </div>
                </>
              ) : (
                /* Company Stock Editable Fields */
                <>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Category *
                    </label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value as InventoryCategory)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#FF9F1C]"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Subcategory
                    </label>
                    <input
                      type="text"
                      value={editSubcategory}
                      onChange={(e) => setEditSubcategory(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#FF9F1C]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Item Name *
                    </label>
                    <input
                      type="text"
                      value={editItemName}
                      onChange={(e) => setEditItemName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#FF9F1C]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Quantity *
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={editQuantity}
                      onChange={(e) => setEditQuantity(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#FF9F1C]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Description *
                    </label>
                    <textarea
                      rows={3}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#FF9F1C]"
                    />
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#07182E] hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingItem && (
        <div className="fixed inset-0 bg-[#07182E]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-2xl w-full max-w-sm overflow-hidden animate-scale-up p-6 text-center">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-sm font-extrabold text-[#07182E]">
              Delete Inventory Item?
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Are you sure you want to soft-delete <span className="font-bold text-slate-700">"{deletingItem.item_name}"</span>? It will be removed from active inventory.
            </p>

            {modalError && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-xl text-xs font-medium mt-3 text-left flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                disabled={isSubmitting}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isSubmitting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
