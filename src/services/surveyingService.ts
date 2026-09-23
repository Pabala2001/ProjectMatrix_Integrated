import { assertOperationalAction } from "../integration/operationalAccess";
import { supabase } from "../lib/supabase";
import { ControlPoint, Instrument, Campaign } from "../types/surveying";

/**
 * Maps a database row from `public.survey_control_points` to the UI `ControlPoint` model.
 */
export function mapControlPointRow(row: any): ControlPoint {
  return {
    id: row.id,
    pointId: row.point_id || "",
    projectId: row.project_id || "",
    companyId: row.company_id || "",
    name: row.name || "",
    type: row.point_type || row.type || "Benchmark",
    easting: Number(row.easting) || 0,
    northing: Number(row.northing) || 0,
    elevation: Number(row.elevation) || 0,
    status: row.status || "Active",
    notes: row.notes || "",
    is_archived: !!row.is_archived,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString()
  };
}

/**
 * Maps a database row from `public.survey_instruments` to the UI `Instrument` model.
 */
export function mapInstrumentRow(row: any): Instrument {
  return {
    id: row.id,
    instrumentId: row.instrument_id || "",
    projectId: row.project_id || "",
    companyId: row.company_id || "",
    name: row.name || "",
    type: row.instrument_type || row.type || "Total Station",
    manufacturer: row.manufacturer || "",
    serialNumber: row.serial_number || "",
    calibrationDate: row.last_calibration_date || row.calibration_date || "",
    calibrationExpiryDate: row.calibration_due_date || row.calibration_expiry_date || "",
    status: row.status || "In Service",
    notes: row.notes || "",
    is_archived: !!row.is_archived,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString()
  };
}

/**
 * Maps a database row from `public.survey_campaigns` to the UI `Campaign` model.
 * Parses embedded `survey_campaign_points` to populate `linkedPointIds`.
 */
export function mapCampaignRow(row: any): Campaign {
  const linkedPointIds: string[] = Array.isArray(row.survey_campaign_points)
    ? row.survey_campaign_points.map((cp: any) => cp.control_point_id).filter(Boolean)
    : [];

  return {
    id: row.id,
    campaignCode: row.campaign_code || row.campaign_name || "CMP",
    projectId: row.project_id || "",
    companyId: row.company_id || "",
    name: row.campaign_name || row.name || "",
    discipline: row.discipline || "Civil",
    type: row.campaign_type || row.type || "Initial Survey",
    chainage: row.chainage || "",
    date: row.campaign_date || row.date || "",
    linkedPointIds,
    status: row.status || "In Progress",
    leadSurveyor: row.lead_surveyor || "",
    notes: row.notes || "",
    is_archived: !!row.is_archived,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString()
  };
}

/**
 * Fetch control points scoped strictly by company_id and project_id.
 */
export async function getControlPoints(
  companyId: string,
  projectId: string,
  includeArchived = false
): Promise<ControlPoint[]> {
  if (!companyId || !projectId) return [];

  let query = supabase
    .from("survey_control_points")
    .select("*")
    .eq("company_id", companyId)
    .eq("project_id", projectId);

  if (!includeArchived) {
    query = query.eq("is_archived", false);
  } else {
    query = query.eq("is_archived", true);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching survey control points:", error);
    throw new Error(error.message || "Failed to load survey control points from database.");
  }

  return (data || []).map(mapControlPointRow);
}

/**
 * Fetch instruments scoped strictly by company_id and project_id.
 */
export async function getInstruments(
  companyId: string,
  projectId: string,
  includeArchived = false
): Promise<Instrument[]> {
  if (!companyId || !projectId) return [];

  let query = supabase
    .from("survey_instruments")
    .select("*")
    .eq("company_id", companyId)
    .eq("project_id", projectId);

  if (!includeArchived) {
    query = query.eq("is_archived", false);
  } else {
    query = query.eq("is_archived", true);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching survey instruments:", error);
    throw new Error(error.message || "Failed to load survey instruments from database.");
  }

  return (data || []).map(mapInstrumentRow);
}

/**
 * Fetch campaigns scoped strictly by company_id and project_id.
 * Embedded query fetches `survey_campaign_points` via foreign key relationship.
 */
export async function getCampaigns(
  companyId: string,
  projectId: string,
  includeArchived = false
): Promise<Campaign[]> {
  if (!companyId || !projectId) return [];

  let query = supabase
    .from("survey_campaigns")
    .select(`
      *,
      survey_campaign_points (
        id,
        control_point_id,
        sequence_order
      )
    `)
    .eq("company_id", companyId)
    .eq("project_id", projectId);

  if (!includeArchived) {
    query = query.eq("is_archived", false);
  } else {
    query = query.eq("is_archived", true);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching survey campaigns:", error);
    throw new Error(error.message || "Failed to load survey campaigns from database.");
  }

  return (data || []).map(mapCampaignRow);
}

/**
 * Save (insert or update) a Control Point in `survey_control_points`.
 * Handles error code `23505` for duplicates.
 */
export async function saveControlPoint(point: ControlPoint): Promise<ControlPoint> {
    assertOperationalAction("write", "services/surveyingService.ts");
  const isTempId = !point.id || point.id.startsWith("cp-");
  const dbPayload: any = {
    company_id: point.companyId,
    project_id: point.projectId,
    point_id: point.pointId,
    name: point.name,
    point_type: point.type,
    easting: point.easting,
    northing: point.northing,
    elevation: point.elevation,
    status: point.status,
    notes: point.notes || null,
    is_archived: point.status === "Archived" || point.is_archived || false,
    updated_at: new Date().toISOString()
  };

  let result;
  if (isTempId) {
    result = await supabase.from("survey_control_points").insert([dbPayload]).select().single();
  } else {
    result = await supabase
      .from("survey_control_points")
      .update(dbPayload)
      .eq("id", point.id)
      .select()
      .single();
  }

  if (result.error) {
    console.error("Error saving control point:", result.error);
    if (
      result.error.code === "23505" ||
      result.error.message?.includes("23505") ||
      result.error.message?.includes("unique constraint")
    ) {
      throw new Error(`Control Point ID "${point.pointId}" already exists in this project register.`);
    }
    throw new Error(result.error.message || "Failed to save control point.");
  }

  return mapControlPointRow(result.data);
}

/**
 * Save (insert or update) an Instrument in `survey_instruments`.
 * Handles error code `23505` for duplicates.
 */
export async function saveInstrument(instrument: Instrument): Promise<Instrument> {
    assertOperationalAction("write", "services/surveyingService.ts");
  const isTempId = !instrument.id || instrument.id.startsWith("inst-");
  const dbPayload: any = {
    company_id: instrument.companyId,
    project_id: instrument.projectId,
    instrument_id: instrument.instrumentId,
    name: instrument.name,
    instrument_type: instrument.type,
    manufacturer: instrument.manufacturer,
    serial_number: instrument.serialNumber,
    last_calibration_date: instrument.calibrationDate || null,
    calibration_due_date: instrument.calibrationExpiryDate || null,
    status: instrument.status,
    notes: instrument.notes || null,
    is_archived: instrument.status === "Archived" || instrument.is_archived || false,
    updated_at: new Date().toISOString()
  };

  let result;
  if (isTempId) {
    result = await supabase.from("survey_instruments").insert([dbPayload]).select().single();
  } else {
    result = await supabase
      .from("survey_instruments")
      .update(dbPayload)
      .eq("id", instrument.id)
      .select()
      .single();
  }

  if (result.error) {
    console.error("Error saving instrument:", result.error);
    if (
      result.error.code === "23505" ||
      result.error.message?.includes("23505") ||
      result.error.message?.includes("unique constraint")
    ) {
      throw new Error(`Instrument ID "${instrument.instrumentId}" already exists in this project register.`);
    }
    throw new Error(result.error.message || "Failed to save survey instrument.");
  }

  return mapInstrumentRow(result.data);
}

/**
 * Save (insert or update) a Campaign in `survey_campaigns` and sync selected control points in `survey_campaign_points`.
 * Handles error code `23505` for duplicates.
 */
export async function saveCampaign(
  campaign: Campaign,
  allControlPoints: ControlPoint[]
): Promise<Campaign> {
    assertOperationalAction("write", "services/surveyingService.ts");
  const isTempId = !campaign.id || campaign.id.startsWith("cmp-");
  const dbPayload: any = {
    company_id: campaign.companyId,
    project_id: campaign.projectId,
    campaign_code: campaign.campaignCode,
    campaign_name: campaign.name,
    discipline: campaign.discipline,
    campaign_type: campaign.type,
    chainage: campaign.chainage || null,
    campaign_date: campaign.date || null,
    status: campaign.status,
    lead_surveyor: campaign.leadSurveyor || null,
    notes: campaign.notes || null,
    is_archived: campaign.status === "Archived" || campaign.is_archived || false,
    updated_at: new Date().toISOString()
  };

  let result;
  if (isTempId) {
    result = await supabase.from("survey_campaigns").insert([dbPayload]).select().single();
  } else {
    result = await supabase
      .from("survey_campaigns")
      .update(dbPayload)
      .eq("id", campaign.id)
      .select()
      .single();
  }

  if (result.error) {
    console.error("Error saving campaign:", result.error);
    if (
      result.error.code === "23505" ||
      result.error.message?.includes("23505") ||
      result.error.message?.includes("unique constraint")
    ) {
      throw new Error(`Campaign Code "${campaign.campaignCode}" already exists in this project register.`);
    }
    throw new Error(result.error.message || "Failed to save survey campaign.");
  }

  const savedCampaignId = result.data.id;

  // Sync survey_campaign_points
  // 1. Delete existing points for this campaign
  const { error: delPointsErr } = await supabase
    .from("survey_campaign_points")
    .delete()
    .eq("campaign_id", savedCampaignId);

  if (delPointsErr) {
    console.warn("Warning deleting existing survey_campaign_points:", delPointsErr);
  }

  // 2. Insert new points if selected
  if (campaign.linkedPointIds && campaign.linkedPointIds.length > 0) {
    const pointsToInsert = campaign.linkedPointIds.map((pid, idx) => {
      // Find matching control point to get foreign key UUID
      const matchedCp = allControlPoints.find(cp => cp.id === pid || cp.pointId === pid);
      const targetControlPointId = matchedCp ? matchedCp.id : pid;
      return {
        campaign_id: savedCampaignId,
        control_point_id: targetControlPointId,
        sequence_order: idx + 1
      };
    });

    const { error: insPointsErr } = await supabase
      .from("survey_campaign_points")
      .insert(pointsToInsert);

    if (insPointsErr) {
      console.warn("Warning inserting survey_campaign_points:", insPointsErr);
    }
  }

  // Fetch updated campaign with embedded survey_campaign_points
  const { data: refetched } = await supabase
    .from("survey_campaigns")
    .select(`
      *,
      survey_campaign_points (
        id,
        control_point_id,
        sequence_order
      )
    `)
    .eq("id", savedCampaignId)
    .single();

  return mapCampaignRow(refetched || result.data);
}

/**
 * Archive a control point.
 */
export async function archiveControlPoint(id: string): Promise<void> {
  const { error } = await supabase
    .from("survey_control_points")
    .update({ is_archived: true, status: "Archived", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw new Error(error.message || "Failed to archive control point.");
  }
}

/**
 * Restore an archived control point.
 */
export async function restoreControlPoint(id: string): Promise<void> {
  const { error } = await supabase
    .from("survey_control_points")
    .update({ is_archived: false, status: "Active", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw new Error(error.message || "Failed to restore control point.");
  }
}

/**
 * Delete a control point permanently.
 * Handles foreign key error code `23503` if linked to a campaign.
 */
export async function deleteControlPoint(id: string): Promise<void> {
    assertOperationalAction("delete", "services/surveyingService.ts");
  const { error } = await supabase
    .from("survey_control_points")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting control point:", error);
    if (
      error.code === "23503" ||
      error.message?.includes("23503") ||
      error.message?.includes("foreign key") ||
      error.message?.includes("survey_campaign_points")
    ) {
      throw new Error(
        "This control point cannot be deleted because it is linked to one or more survey campaigns. Please unlink it from the campaign(s) or archive it instead."
      );
    }
    throw new Error(error.message || "Failed to delete control point.");
  }
}

/**
 * Archive an instrument.
 */
export async function archiveInstrument(id: string): Promise<void> {
  const { error } = await supabase
    .from("survey_instruments")
    .update({ is_archived: true, status: "Archived", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw new Error(error.message || "Failed to archive instrument.");
  }
}

/**
 * Restore an archived instrument.
 */
export async function restoreInstrument(id: string): Promise<void> {
  const { error } = await supabase
    .from("survey_instruments")
    .update({ is_archived: false, status: "In Service", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw new Error(error.message || "Failed to restore instrument.");
  }
}

/**
 * Delete an instrument permanently.
 */
export async function deleteInstrument(id: string): Promise<void> {
    assertOperationalAction("delete", "services/surveyingService.ts");
  const { error } = await supabase
    .from("survey_instruments")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message || "Failed to delete survey instrument.");
  }
}

/**
 * Archive a campaign.
 */
export async function archiveCampaign(id: string): Promise<void> {
  const { error } = await supabase
    .from("survey_campaigns")
    .update({ is_archived: true, status: "Archived", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw new Error(error.message || "Failed to archive survey campaign.");
  }
}

/**
 * Restore an archived campaign.
 */
export async function restoreCampaign(id: string): Promise<void> {
  const { error } = await supabase
    .from("survey_campaigns")
    .update({ is_archived: false, status: "In Progress", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw new Error(error.message || "Failed to restore survey campaign.");
  }
}

/**
 * Delete a campaign permanently along with its linked points in `survey_campaign_points`.
 */
export async function deleteCampaign(id: string): Promise<void> {
    assertOperationalAction("delete", "services/surveyingService.ts");
  // Unlink points
  await supabase.from("survey_campaign_points").delete().eq("campaign_id", id);

  const { error } = await supabase
    .from("survey_campaigns")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message || "Failed to delete survey campaign.");
  }
}
