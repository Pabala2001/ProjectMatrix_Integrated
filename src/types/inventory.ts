/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type InventorySource = 'procurement' | 'company_stock';

export type InventoryCategory =
  | 'OHS'
  | 'Site Establishment'
  | 'Operational Costs'
  | 'Environmental';

export interface ProjectInventoryItem {
  id: string;
  company_id: string;
  project_id: string;
  procurement_item_id: string | null;
  source: InventorySource;
  category: InventoryCategory | null;
  subcategory: string | null;
  item_name: string;
  quantity: number | null;
  description: string | null;
  logged_by: string | null;
  logged_at: string;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
  deleted_at: string | null;
  deleted_by: string | null;

  // Resolved display name field
  logged_by_name?: string | null;
}

export interface CreateCompanyStockInput {
  category: InventoryCategory;
  subcategory?: string | null;
  item_name: string;
  quantity: number;
  description: string;
}

export interface UpdateInventoryItemInput {
  category?: InventoryCategory;
  subcategory?: string | null;
  item_name?: string;
  quantity?: number;
  description?: string | null;
}
