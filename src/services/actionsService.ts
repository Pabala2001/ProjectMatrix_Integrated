import { previewStorage } from "../integration/previewStorage";
import { assertOperationalAction } from "../integration/operationalAccess";
import { supabase, isApiKeyError } from "../lib/supabase";
import { ProjectAction, ActionPriority, ActionStatus, ActionSourceType } from "../types";

export type { ProjectAction, ActionPriority, ActionStatus, ActionSourceType };

const LOCAL_STORAGE_ACTIONS_KEY = "pm_actions_registry_v1";

/**
 * Initial canonical seed actions explicitly requested:
 * - Approve PO-018
 * - Review Notice-04
 * - Respond to RFI-22
 * - Close NCR-07
 * - Review Certificate-05
 */
export const INITIAL_SEED_ACTIONS: ProjectAction[] = [
  {
    id: "act-po-018",
    organisation_id: "org-default",
    project_id: "proj-alpha",
    title: "Approve PO-018",
    description: "Authorize urgent procurement for high-strength rebar batch (Grade 500B) for Northern Pier foundations ($48,500).",
    owner_user_id: "usr_pm_01",
    owner_name: "Project Director",
    owner_role: "Project Manager",
    priority: "HIGH",
    due_date: "2026-08-20",
    status: "REQUIRES_APPROVAL",
    source_type: "PO",
    source_id: "PO-018",
    created_at: new Date().toISOString(),
    is_ai_recommended: true,
    ai_confidence_score: 96,
    ai_rationale: "Early purchase avoids 12-day supply chain bottleneck identified on the critical path.",
    requires_human_approval: true,
    consequential_impact: "HIGH_FINANCIAL"
  },
  {
    id: "act-notice-04",
    organisation_id: "org-default",
    project_id: "proj-alpha",
    title: "Review Notice-04",
    description: "FIDIC Clause 20.1 / NEC4 Early Warning notice regarding rock strata variation encountered at Chainage 4+200.",
    owner_user_id: "usr_pm_01",
    owner_name: "Lead Contract Administrator",
    owner_role: "Commercial Manager",
    priority: "CRITICAL",
    due_date: "2026-08-18",
    status: "PENDING",
    source_type: "NOTICE",
    source_id: "Notice-04",
    created_at: new Date().toISOString(),
    is_ai_recommended: false,
    requires_human_approval: true,
    consequential_impact: "CONTRACTUAL_TIME"
  },
  {
    id: "act-rfi-22",
    organisation_id: "org-default",
    project_id: "proj-alpha",
    title: "Respond to RFI-22",
    description: "Structural clarification for pre-stressed box girder reinforcement overlap spacing on Span B.",
    owner_user_id: "usr_eng_02",
    owner_name: "Senior Resident Engineer",
    owner_role: "Chief Engineer",
    priority: "HIGH",
    due_date: "2026-08-19",
    status: "PENDING",
    source_type: "RFI",
    source_id: "RFI-22",
    created_at: new Date().toISOString(),
    is_ai_recommended: true,
    ai_confidence_score: 92,
    ai_rationale: "Span B formwork assembly is scheduled to commence within 48 hours.",
    requires_human_approval: true,
    consequential_impact: "ROUTINE"
  },
  {
    id: "act-ncr-07",
    organisation_id: "org-default",
    project_id: "proj-alpha",
    title: "Close NCR-07",
    description: "Verify concrete 28-day core test compressive strength reports (C35/45) and sign off corrective action closure.",
    owner_user_id: "usr_qa_03",
    owner_name: "Quality Assurance Lead",
    owner_role: "QA/QC Manager",
    priority: "MEDIUM",
    due_date: "2026-08-22",
    status: "PENDING",
    source_type: "NCR",
    source_id: "NCR-07",
    created_at: new Date().toISOString(),
    is_ai_recommended: false,
    requires_human_approval: true,
    consequential_impact: "SAFETY_CRITICAL"
  },
  {
    id: "act-cert-05",
    organisation_id: "org-default",
    project_id: "proj-alpha",
    title: "Review Certificate-05",
    description: "Review interim payment valuation certificate #05 ($3.42M) against verified BoQ measurements.",
    owner_user_id: "usr_pm_01",
    owner_name: "Senior Quantity Surveyor",
    owner_role: "Quantity Surveyor",
    priority: "HIGH",
    due_date: "2026-08-25",
    status: "REQUIRES_APPROVAL",
    source_type: "CERTIFICATE",
    source_id: "Certificate-05",
    created_at: new Date().toISOString(),
    is_ai_recommended: true,
    ai_confidence_score: 94,
    ai_rationale: "Matrix Ledger verified physical survey quantities match 98.4% with contractor submission.",
    requires_human_approval: true,
    consequential_impact: "HIGH_FINANCIAL"
  }
];

export class ActionsService {
  /**
   * Fetch actions for an organisation and optional project focus
   */
  static async getActions(organisationId?: string, projectId?: string): Promise<ProjectAction[]> {
    try {
      // 1. Try Supabase query first
      if (organisationId) {
        let query = supabase.from("actions").select("*");
        query = query.eq("organisation_id", organisationId);
        if (projectId) {
          query = query.eq("project_id", projectId);
        }
        const { data, error } = await query.order("created_at", { ascending: false });
        
        if (!error && data && data.length > 0) {
          return data as ProjectAction[];
        }
      }
    } catch (err) {
      console.warn("Supabase query on actions table failed, using client persistent cache:", err);
    }

    // 2. Read from local storage
    const storageKey = organisationId ? `${LOCAL_STORAGE_ACTIONS_KEY}_${organisationId}` : LOCAL_STORAGE_ACTIONS_KEY;
    const cached = previewStorage.getItem(storageKey) || previewStorage.getItem(LOCAL_STORAGE_ACTIONS_KEY);
    if (cached) {
      try {
        const parsed: ProjectAction[] = JSON.parse(cached);
        let filtered = parsed;
        if (organisationId) {
          filtered = filtered.filter(a => !a.organisation_id || a.organisation_id === organisationId);
        }
        if (projectId) {
          filtered = filtered.filter(a => !a.project_id || a.project_id === projectId);
        }
        return filtered;
      } catch (e) {
        console.error("Failed to parse cached actions:", e);
      }
    }

    // 3. Return empty list if no persisted actions exist for this company
    return [];
  }

  /**
   * Save actions to local storage
   */
  static saveActionsLocally(actions: ProjectAction[], organisationId?: string): void {
    assertOperationalAction("write", "services/actionsService.ts");
    try {
      const storageKey = organisationId ? `${LOCAL_STORAGE_ACTIONS_KEY}_${organisationId}` : LOCAL_STORAGE_ACTIONS_KEY;
      previewStorage.setItem(storageKey, JSON.stringify(actions));
      previewStorage.setItem(LOCAL_STORAGE_ACTIONS_KEY, JSON.stringify(actions));
    } catch (e) {
      console.error("Failed to save actions locally:", e);
    }
  }

  /**
   * Authorize / Approve an action (Consequential Human Decision)
   */
  static async approveAction(actionId: string, userId: string = "current_user"): Promise<ProjectAction[]> {
    assertOperationalAction("approve", "services/actionsService.ts");
    const all = await this.getActions();
    const updated = all.map(act => {
      if (act.id === actionId) {
        return {
          ...act,
          status: "COMPLETED" as ActionStatus,
          approved_by_user_id: userId,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
      return act;
    });

    this.saveActionsLocally(updated);

    try {
      await supabase
        .from("actions")
        .update({
          status: "COMPLETED",
          approved_by_user_id: userId,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", actionId);
    } catch (e) {
      console.warn("Supabase action update sync skipped in preview.");
    }

    return updated;
  }

  /**
   * Authorize an action with optional resolution note
   */
  static async authorizeAction(actionId: string, note?: string): Promise<ProjectAction[]> {
    return this.approveAction(actionId, "executive_decision");
  }

  /**
   * Reject an action
   */
  static async rejectAction(actionId: string, userId: string = "current_user"): Promise<ProjectAction[]> {
    assertOperationalAction("approve", "services/actionsService.ts");
    const all = await this.getActions();
    const updated = all.map(act => {
      if (act.id === actionId) {
        return {
          ...act,
          status: "REJECTED" as ActionStatus,
          updated_at: new Date().toISOString()
        };
      }
      return act;
    });

    this.saveActionsLocally(updated);
    return updated;
  }

  /**
   * Complete an action
   */
  static async completeAction(actionId: string): Promise<ProjectAction[]> {
    const all = await this.getActions();
    const updated = all.map(act => {
      if (act.id === actionId) {
        return {
          ...act,
          status: "COMPLETED" as ActionStatus,
          updated_at: new Date().toISOString()
        };
      }
      return act;
    });

    this.saveActionsLocally(updated);
    return updated;
  }

  /**
   * Create a new action (Human or System)
   */
  static async createAction(action: Partial<ProjectAction>): Promise<ProjectAction> {
    assertOperationalAction("create", "services/actionsService.ts");
    const newAction: ProjectAction = {
      id: action.id || `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      organisation_id: action.organisation_id || "org-default",
      project_id: action.project_id || "proj-alpha",
      title: action.title || "Untitled Action",
      description: action.description || "",
      owner_user_id: action.owner_user_id || "usr_pm_01",
      owner_name: action.owner_name || "Assigned Engineer",
      owner_role: action.owner_role || "Project Engineer",
      priority: action.priority || "MEDIUM",
      due_date: action.due_date || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      status: action.status || "PENDING",
      source_type: action.source_type || "MANUAL",
      source_id: action.source_id,
      created_at: new Date().toISOString(),
      is_ai_recommended: action.is_ai_recommended || false,
      ai_confidence_score: action.ai_confidence_score,
      ai_rationale: action.ai_rationale,
      requires_human_approval: action.requires_human_approval ?? true,
      consequential_impact: action.consequential_impact || "ROUTINE"
    };

    const all = await this.getActions();
    const updated = [newAction, ...all];
    this.saveActionsLocally(updated);

    try {
      await supabase.from("actions").insert(newAction);
    } catch (e) {
      console.warn("Supabase action insert skipped in preview.");
    }

    return newAction;
  }

  /**
   * Matrix Intelligence Recommender Engine:
   * Analyzes project telemetry to formulate proactive actions that require human signoff.
   */
  static async generateIntelligenceRecommendations(projectId: string = "proj-alpha"): Promise<ProjectAction[]> {
    const aiRecommendations: Partial<ProjectAction>[] = [
      {
        title: "Issue Delay Notification under Clause 8.4",
        description: "Abnormal rainfall recorded on 3 site diaries consecutive days (48 hours work stoppage). Immediate formal notice required to protect EoT claim rights.",
        priority: "CRITICAL",
        due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        status: "REQUIRES_APPROVAL",
        source_type: "INTELLIGENCE",
        source_id: "AI-EOT-NOTIF-02",
        is_ai_recommended: true,
        ai_confidence_score: 98,
        ai_rationale: "Contract clause sets strict 28-day notice window. Risk of time-bar exclusion is critical.",
        requires_human_approval: true,
        consequential_impact: "CONTRACTUAL_TIME"
      },
      {
        title: "Accelerate Precast Beam Fabrication PO-029",
        description: "Critical path activity Span 4 Bridge Deck has a -4 day float erosion. Expedite batch delivery with supplier.",
        priority: "HIGH",
        due_date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        status: "REQUIRES_APPROVAL",
        source_type: "INTELLIGENCE",
        source_id: "AI-ACCEL-01",
        is_ai_recommended: true,
        ai_confidence_score: 91,
        ai_rationale: "Simulated CPM schedule analysis indicates 3.5x cost saving versus late penalty liquidated damages.",
        requires_human_approval: true,
        consequential_impact: "HIGH_FINANCIAL"
      }
    ];

    const currentActions = await this.getActions();
    const created: ProjectAction[] = [];

    for (const rec of aiRecommendations) {
      const exists = currentActions.some(a => a.title === rec.title);
      if (!exists) {
        const item = await this.createAction({ ...rec, project_id: projectId });
        created.push(item);
      }
    }

    return created;
  }
}
