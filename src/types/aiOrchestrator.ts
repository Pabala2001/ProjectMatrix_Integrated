export type SpecialistAgentType = 
  | 'planning' 
  | 'cost' 
  | 'contract' 
  | 'qaqc' 
  | 'procurement' 
  | 'risk';

export interface SpecialistAgentReport {
  agentId: SpecialistAgentType;
  agentName: string;
  role: string;
  iconName: string;
  badgeColor: string;
  keyInsight: string;
  riskScore: number; // 0 - 100
  metricSummary: string;
  findings: string[];
  recommendedActions: string[];
}

export interface OrchestratorIntent {
  queryType: 'delay_analysis' | 'cost_eac' | 'subcontractor_risk' | 'procurement' | 'contract_claim' | 'quality_technical' | 'executive_summary' | 'general';
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  domains: Array<'programme' | 'commercial' | 'contracts' | 'quality' | 'procurement' | 'risk'>;
  activeSpecialists: SpecialistAgentType[];
  toolLayersUsed: Array<'database' | 'documents_rag' | 'boq' | 'programme' | 'site_diaries' | 'weather_gis' | 'external_api'>;
  intentSummary: string;
}

export interface GeminiPrimaryAnalysis {
  engineName: string;
  role: string;
  badge: string;
  factualFindings: string[];
  siteRecordsExamined: string[];
  photographsOrFieldLogs: string[];
  rootCausesIdentified: string[];
  googleGroundingSnippets?: string[];
  fullAnalysisMarkdown: string;
}

export interface OpenAISecondOpinion {
  engineName: string;
  role: string;
  badge: string;
  programmeLogicAnalysis: string;
  contractualImplications: string;
  counterArgumentsAndChallenges: string[];
  missingEvidenceIdentified: string[];
  formulatedManagementOptions: string[];
  fullAnalysisMarkdown: string;
}

export interface ToolLayerTelemetry {
  layer: 'database' | 'documents_rag' | 'boq' | 'programme' | 'site_diaries' | 'weather_gis' | 'external_api';
  name: string;
  recordCount?: number;
  status: 'Accessed' | 'Verified' | 'Grounded' | 'Queried';
  details: string;
}

export interface StrategicRecommendation {
  category: string;
  action: string;
  urgency: 'Immediate' | 'Within 48h' | 'This Week' | 'Next Cycle';
  owner: string;
  clauses?: string;
  impact: string;
}

export interface ProjectMatrixConsensus {
  executiveAnswer: string;
  reconciledKeyTakeaways: string[];
  consensusAgreementRate: number; // 0 - 100 percentage
  conflictResolution: string;
  strategicRecommendations: StrategicRecommendation[];
}

export interface OrchestratorExecutionResult {
  id: string;
  timestamp: string;
  intent: OrchestratorIntent;
  geminiAnalysis: GeminiPrimaryAnalysis;
  openAISecondOpinion: OpenAISecondOpinion;
  specialistAgents: SpecialistAgentReport[];
  toolsUsed: ToolLayerTelemetry[];
  consensus: ProjectMatrixConsensus;
  latencyMs: {
    router: number;
    gemini: number;
    openai: number;
    specialists: number;
    reconciliation: number;
    total: number;
  };
}
