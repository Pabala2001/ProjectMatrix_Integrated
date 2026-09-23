import { OrchestratorExecutionResult } from './aiOrchestrator';

export type AdvisorScope = 'project' | 'company';

export interface AdvisorConversation {
  id: string;
  company_id: string;
  project_id?: string | null;
  created_by: string;
  title: string;
  scope: AdvisorScope;
  created_at: string;
  updated_at: string;
}

export interface AdvisorSource {
  id: string;
  label: string;
  table?: string;
  summary?: string;
  kind?: string;
  snippet?: string;
  metadata?: Record<string, any>;
}

export interface AdvisorDraft {
  id?: string;
  conversation_id?: string;
  company_id?: string;
  project_id?: string | null;
  created_by?: string;
  title: string;
  document_type: 'report' | 'progress_report' | 'letter' | 'memo' | 'contract_claim' | 'site_instruction' | 'rfi_summary' | 'progress_narrative';
  content_markdown: string;
  metadata_json?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface AdvisorMessage {
  id: string;
  conversation_id: string;
  sender: 'user' | 'assistant' | 'system';
  content: string;
  sources_json?: AdvisorSource[];
  draft?: AdvisorDraft;
  metadata_json?: Record<string, any>;
  created_at: string;
  context_warning?: string | null;
  orchestration?: OrchestratorExecutionResult;
}

export interface AdvisorChatRequest {
  question: string;
  scope: AdvisorScope;
  company: {
    id: string;
    name: string;
  };
  project?: {
    id: string;
    name: string;
  } | null;
  allProjects?: Array<{
    id: string;
    name: string;
    contract_code?: string;
  }>;
  conversation_id?: string;
  history?: Array<{
    role: 'user' | 'model';
    parts: Array<{ text: string }>;
  }>;
}

export interface AdvisorChatResponse {
  answer: string;
  sources: AdvisorSource[];
  confidence: string;
  draft?: AdvisorDraft;
  error?: string;
  context_warning?: string | null;
  trimmed_categories?: string[];
  omitted_categories?: string[];
  configured_cap?: number;
  final_serialized_character_count?: number;
  orchestration?: OrchestratorExecutionResult;
}
