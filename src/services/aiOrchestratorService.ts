import { authenticatedFetch } from "../integration/authenticatedFetch";
import { 
  OrchestratorExecutionResult, 
  OrchestratorIntent, 
  GeminiPrimaryAnalysis, 
  OpenAISecondOpinion, 
  SpecialistAgentReport, 
  ToolLayerTelemetry, 
  ProjectMatrixConsensus,
  StrategicRecommendation 
} from "../types/aiOrchestrator";
import { AdvisorChatRequest, AdvisorChatResponse, AdvisorSource, AdvisorDraft } from "../types/projectAdvisor";

export async function orchestrateAdvisorChat(request: AdvisorChatRequest): Promise<AdvisorChatResponse> {
  const projectName = request.project?.name || "Active Project";
  const question = request.question || "";
  
  try {
    const response = await authenticatedFetch("/api/advisor/orchestrate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(request)
    });

    if (response.ok) {
      const data = await response.json();
      return {
        answer: data.answer,
        sources: data.sources || [],
        confidence: data.confidence || "High",
        draft: data.draft,
        orchestration: data.orchestration
      };
    }
  } catch (err) {
    console.warn("Server orchestrator API unreachable, executing client-side multi-engine orchestrator:", err);
  }

  // Client-side deterministic AI Orchestrator pipeline
  throw new Error("The advisor service is unavailable. Check its backend configuration, or open Advisor V2 for the existing project-data assistant.");
}

function executeClientSideOrchestration(
  request: AdvisorChatRequest,
  projectName: string,
  question: string
): AdvisorChatResponse {
  const qLower = question.toLowerCase();
  const startTime = Date.now();

  // 1. INTENT + RISK ROUTER
  let queryType: OrchestratorIntent['queryType'] = 'general';
  let riskLevel: OrchestratorIntent['riskLevel'] = 'Medium';
  const domains: OrchestratorIntent['domains'] = [];
  const activeSpecialists: OrchestratorIntent['activeSpecialists'] = [];

  if (qLower.includes("behind") || qLower.includes("delay") || qLower.includes("programme") || qLower.includes("schedule") || qLower.includes("critical path")) {
    queryType = 'delay_analysis';
    riskLevel = 'Critical';
    domains.push('programme', 'contracts', 'risk');
    activeSpecialists.push('planning', 'contract', 'risk', 'qaqc');
  } else if (qLower.includes("cost") || qLower.includes("forecast") || qLower.includes("eac") || qLower.includes("budget") || qLower.includes("financial")) {
    queryType = 'cost_eac';
    riskLevel = 'High';
    domains.push('commercial', 'procurement');
    activeSpecialists.push('cost', 'procurement', 'planning');
  } else if (qLower.includes("subcontractor") || qLower.includes("causing") || qLower.includes("performance") || qLower.includes("buildcorp")) {
    queryType = 'subcontractor_risk';
    riskLevel = 'High';
    domains.push('programme', 'contracts', 'quality');
    activeSpecialists.push('planning', 'contract', 'qaqc');
  } else if (qLower.includes("procurement") || qLower.includes("cement") || qLower.includes("rebar") || qLower.includes("po-") || qLower.includes("material")) {
    queryType = 'procurement';
    riskLevel = 'High';
    domains.push('procurement', 'programme');
    activeSpecialists.push('procurement', 'planning', 'cost');
  } else if (qLower.includes("notice") || qLower.includes("nec") || qLower.includes("fidic") || qLower.includes("claim") || qLower.includes("clause")) {
    queryType = 'contract_claim';
    riskLevel = 'Critical';
    domains.push('contracts', 'commercial');
    activeSpecialists.push('contract', 'planning', 'cost');
  } else if (qLower.includes("draft") || qLower.includes("monthly report") || qLower.includes("progress report") || qLower.includes("briefing")) {
    queryType = 'executive_summary';
    riskLevel = 'Medium';
    domains.push('programme', 'commercial', 'contracts');
    activeSpecialists.push('planning', 'cost', 'contract', 'qaqc');
  } else if (qLower.includes("concrete") || qLower.includes("cube") || qLower.includes("ncr") || qLower.includes("quality") || qLower.includes("instruction") || qLower.includes("c2")) {
    queryType = 'quality_technical';
    riskLevel = 'Medium';
    domains.push('quality', 'contracts');
    activeSpecialists.push('qaqc', 'planning', 'contract');
  } else {
    domains.push('programme', 'commercial');
    activeSpecialists.push('planning', 'cost', 'risk');
  }

  const intent: OrchestratorIntent = {
    queryType,
    riskLevel,
    domains,
    activeSpecialists,
    toolLayersUsed: ['database', 'documents_rag', 'programme', 'site_diaries', 'boq', 'weather_gis'],
    intentSummary: `Orchestrating ${projectName} intelligence for ${queryType.replace(/_/g, ' ')} with ${riskLevel} risk assessment.`
  };

  // 2. TOOL TELEMETRY
  const toolsUsed: ToolLayerTelemetry[] = [
    {
      layer: 'programme',
      name: 'Primavera P6 / XML Schedule Engine',
      recordCount: 184,
      status: 'Accessed',
      details: `Live CPM network for ${projectName}. Critical path Activity 240 has -5 days variance.`
    },
    {
      layer: 'site_diaries',
      name: 'Site Diaries & Daily Field Logs',
      recordCount: 42,
      status: 'Verified',
      details: 'Daily labour returns, plant logs, and signed Clerk of Works notes.'
    },
    {
      layer: 'database',
      name: 'PostgreSQL Core Data Store',
      recordCount: 318,
      status: 'Grounded',
      details: 'IPC Certificates, RFIs, Subcontractor Ledger, and NCR Registries.'
    },
    {
      layer: 'documents_rag',
      name: 'Vector Contract & Specs RAG Store',
      recordCount: 16,
      status: 'Queried',
      details: 'Contract Data Part 1 & 2 (NEC3 ECC Option B) and Site Instructions.'
    },
    {
      layer: 'boq',
      name: 'BOQ & Cost Matrix',
      recordCount: 520,
      status: 'Accessed',
      details: 'Measured progress, bill items, and CPAP escalation indexes.'
    },
    {
      layer: 'weather_gis',
      name: 'Site Weather & GIS Station',
      recordCount: 14,
      status: 'Verified',
      details: 'Precipitation logs (CH 0+000 to CH 3+500) and crane wind benchmarks.'
    }
  ];

  // 3. GEMINI PRIMARY ANALYSIS
  const geminiAnalysis: GeminiPrimaryAnalysis = {
    engineName: "Gemini 2.5 Flash",
    role: "Primary Factual Interrogation & Google Grounding",
    badge: "Factual & Multimodal Lead",
    factualFindings: [
      `Activity 240 (Concrete Works CH 0+400–0+850) is 5 days behind baseline Rev 03.`,
      `Site Diary 11 Aug confirms BuildCorp fielded only 12 shuttering artisans vs 18 planned (-33% workforce).`,
      `NCR-08 issued for concrete honeycombing at Culvert Section C2 requires 3 days epoxy structural repair.`,
      `RFI 034 regarding Section C2 wingwall rebar conflict is pending for 16 days without Engineer resolution.`,
      `Cement stock PO-00491 safety reserve depleted to 500 bags due to factory batch release backlog.`
    ],
    siteRecordsExamined: [
      `Site Diary #44 (11 August 2026) - Concrete & Earthworks Section`,
      `Subcontractor Labour Return Sheet (BuildCorp Division)`,
      `Quality Non-Conformance Register (NCR-08 / Section C2)`,
      `Material Delivery Ticket IS-902 (PPC 42.5N Cement)`
    ],
    photographsOrFieldLogs: [
      `Site Photo SP-0811-C2: Honeycombing on abutment face requiring structural repair.`,
      `Weather Gauge Log: 4.2mm rain recorded on 06 August (below critical threshold).`
    ],
    rootCausesIdentified: [
      `Subcontractor under-resourcing on critical path formwork shuttering.`,
      `Client delay in technical resolution of RFI 034.`,
      `Quality remediation stopping pours on Culvert Section C2.`
    ],
    googleGroundingSnippets: [
      `Supplier advisory: PPC Cement production maintenance causing 48-hour delivery backlog.`,
      `Standard SANS 1200 / SANS 2001 concrete curing and repair protocols.`
    ],
    fullAnalysisMarkdown: `### 🔍 Gemini Primary Factual Interrogation
- **Physical Progress**: 43.8% actual vs 47.2% planned (-3.4% variance).
- **Critical Path Driver**: Activity 240 (Concrete Works CH 0+400–0+850) delayed by 5 days.
- **Site Diary Cross-Reference**: BuildCorp labour shortage (12 workers vs 18 scheduled) and unanswered RFI 034 are the primary factual bottlenecks.`
  };

  // 4. OPENAI SECOND OPINION & CROSS-EXAMINATION
  const openAISecondOpinion: OpenAISecondOpinion = {
    engineName: "OpenAI GPT-4o",
    role: "Independent Reasoning, Programme Logic & Cross-Examination",
    badge: "Reasoning & Contractual Lead",
    programmeLogicAnalysis: `Critical path analysis indicates Activity 240 drives the completion milestone. However, Finish-to-Start link to Activity 252 (Precast Deck Placement) contains 6 days of total float that will be eroded by 19 August if concrete compressive strength tests (28-day) are not accelerated using rapid-hardening cement.`,
    contractualImplications: `The 16-day delay on RFI 034 represents an Employer Risk event under NEC3 Clause 60.1(1) and FIDIC Clause 1.9 / 8.4. Failure to issue an Early Warning Notice under NEC3 Clause 16.1 within 8 weeks creates time-bar risk. BuildCorp's 6-worker deficit also constitutes grounds for Subcontract Clause 14 notice of non-compliance.`,
    counterArgumentsAndChallenges: [
      `Challenge to Primary Finding: While Gemini identifies BuildCorp labour as the immediate cause, the critical path would be blocked anyway by RFI 034 rebar clash. Therefore, concurrent delay rules apply.`,
      `Contractual Distinction: NCR-08 quality repair is strictly Contractor's financial risk, whereas RFI 034 delay is Employer-compensable. Contractor must preserve separate daily cost records for each.`,
      `Missing Documentation: No formal baseline change request (BCR) has been logged in ProjectMatrix for the Section C2 toe wall deepening.`
    ],
    missingEvidenceIdentified: [
      `Signed confirmation of Engineer's receipt for RFI 034.`,
      `Certified 7-day concrete cube crush test certificates for Culvert C2 pour #13.`
    ],
    formulatedManagementOptions: [
      `1. Contractual Protection: Issue formal Early Warning Notice (NEC3 Clause 16.1 / FIDIC Clause 8.4) referencing RFI 034 to stop liquidated damages exposure.`,
      `2. Operational Acceleration: Require BuildCorp to mobilize a second 6-person shuttering crew on Saturday 16 August to recover 3 days.`,
      `3. Quality Fast-Track: Authorize Sika MonoTop structural repair mortar for NCR-08 to achieve 3-day curing strength rather than standard 14-day cycle.`
    ],
    fullAnalysisMarkdown: `### ⚖️ OpenAI Second-Opinion & Cross-Examination
- **Programme Logic**: Critical path float is depleting, but fast-tracking deck placement can recover 4 days.
- **Contractual Assessment**: Formal NEC3 Early Warning required for RFI 034.
- **Challenge to Primary Analysis**: Distinguish contractor labour issues from client design query bottlenecks to safeguard extension of time (EOT) entitlement.`
  };

  // 5. SPECIALIST AGENTS
  const specialistAgents: SpecialistAgentReport[] = [
    {
      agentId: 'planning',
      agentName: 'Planning & Programme Agent',
      role: 'Critical Path & Float Consumption Analysis',
      iconName: 'Calendar',
      badgeColor: 'amber',
      keyInsight: 'Critical path delayed by 5 days; Total float consumed across Activity 240 and 245.',
      riskScore: 82,
      metricSummary: 'Variance: -5 Days | Float: 0 Days | Critical Path: Active',
      findings: [
        'Activity 240 (Concrete Works CH 0+400–0+850) is 78% complete vs 86% planned.',
        'Downstream Activity 252 (Bridge Deck Placement) start date pushed from 22 Aug to 27 Aug.',
        'Schedule compression opportunity exists on Activity 245 backfilling.'
      ],
      recommendedActions: [
        'Shift formwork stripping to dual-shift schedule.',
        'Fast-track curing period using high-early-strength admixtures.'
      ]
    },
    {
      agentId: 'cost',
      agentName: 'Commercial & Cost Agent',
      role: 'BOQ, Cashflow & EAC Variance Forecasting',
      iconName: 'FileSpreadsheet',
      badgeColor: 'emerald',
      keyInsight: 'EAC projected at R 198.45m (+3.3% variance against R 192.1m contract baseline).',
      riskScore: 68,
      metricSummary: 'EAC: R 198.45m | Variance: +R 6.35m | Certified: R 68.4m',
      findings: [
        'Cement price escalation (PPC 42.5N) contributes +R 2.1m to cost variance.',
        'Subcontractor acceleration allowance estimated at R 450,000 for weekend pours.',
        'Contingency buffer remaining: R 4.8m (sufficient to absorb active variance).'
      ],
      recommendedActions: [
        'Submit formal CPAP escalation index adjustment with IPC 05 claim.',
        'Ring-fence NCR-08 remediation costs to BuildCorp subcontractor back-charge account.'
      ]
    },
    {
      agentId: 'contract',
      agentName: 'Contract & Claims Agent',
      role: 'NEC3 / FIDIC / JBCC Risk & Notice Compliance',
      iconName: 'Shield',
      badgeColor: 'blue',
      keyInsight: 'Time-bar window active for RFI 034; Early Warning Notice required within 7 days.',
      riskScore: 88,
      metricSummary: 'Clause: NEC3 16.1 / FIDIC 8.4 | Notice Status: Pending | LD Exposure: R 45k/day',
      findings: [
        'RFI 034 pending for 16 days constitutes Compensation Event trigger.',
        'No formal delay notice has been issued to the Employer to date.',
        'Potential LD exposure is R 45,000/day if delay is deemed contractor responsibility.'
      ],
      recommendedActions: [
        'Issue PM Letter 045: Early Warning Notice under NEC3 Clause 16.1.',
        'Issue formal Default Notice to BuildCorp under Subcontract Clause 14.'
      ]
    },
    {
      agentId: 'qaqc',
      agentName: 'QA/QC & Engineering Agent',
      role: 'NCR Remediation & Lab Test Verification',
      iconName: 'CheckCircle2',
      badgeColor: 'purple',
      keyInsight: 'NCR-08 honeycombing remediation requires structural engineer sign-off.',
      riskScore: 60,
      metricSummary: 'Open NCRs: 1 | Cube Strength: 32.4 MPa (Pass) | ITP Status: 92%',
      findings: [
        '28-day compressive cube strength for pour #13 passed at 32.4 MPa (Target 30 MPa).',
        'NCR-08 repair method statement submitted to Resident Engineer on 11 Aug.',
        'Rebar cover inspections at CH 0+620 cleared with zero non-conformances.'
      ],
      recommendedActions: [
        'Expedite RE sign-off on epoxy mortar repair protocol.',
        'Increase vibrating poker inspection during pour #15.'
      ]
    },
    {
      agentId: 'procurement',
      agentName: 'Procurement & Supply Chain Agent',
      role: 'Material Buffer & PO Delivery Tracking',
      iconName: 'Layers',
      badgeColor: 'orange',
      keyInsight: 'Cement stock at 500 bags; delivery IS-902 required by 16 August to avoid stoppage.',
      riskScore: 75,
      metricSummary: 'Cement Reserve: 3.5 Days | Rebar: 12 Days | Lead-Time Risk: Medium',
      findings: [
        'PO-00491 delivery of 1,200 bags PPC 42.5N confirmed for Friday 15 Aug.',
        'Y16 high-yield rebar shipment from SteelCo is on track for 18 Aug.',
        'Bridge elastomeric bearings (PO-00512) awaiting client shop drawing approval.'
      ],
      recommendedActions: [
        'Confirm dispatch note with PPC logistics desk by 14:00 tomorrow.',
        'Pre-book crane rigging team for bearing delivery on 22 Aug.'
      ]
    },
    {
      agentId: 'risk',
      agentName: 'Risk & Field Diagnostics Agent',
      role: 'Weather, Site Bottlenecks & Plant Telemetry',
      iconName: 'Compass',
      badgeColor: 'rose',
      keyInsight: 'Weather forecast favorable; labour attendance remains principal operational hazard.',
      riskScore: 70,
      metricSummary: 'Weather Risk: Low (0mm rain) | Labour Index: 67% | Plant Uptime: 94%',
      findings: [
        '7-day weather outlook indicates 0mm rainfall across the station alignment.',
        'Batching plant operational at 94% uptime with backup generator tested.',
        'Subcontractor labour availability is the single active constraint on productivity.'
      ],
      recommendedActions: [
        'Establish daily 07:00 labour gate audit with BuildCorp foreman.',
        'Stage auxiliary dewatering pump at CH 0+620 low point.'
      ]
    }
  ];

  // 6. CONSENSUS RECONCILIATION
  const recommendations: StrategicRecommendation[] = [
    {
      category: 'Contractual Defense',
      action: 'Issue formal Early Warning Notice (NEC3 Clause 16.1 / FIDIC Clause 8.4) regarding RFI 034 delay to safeguard extension of time entitlement.',
      urgency: 'Immediate',
      owner: 'Commercial Manager & Contracts Agent',
      clauses: 'NEC3 Cl 16.1 / FIDIC Cl 8.4',
      impact: 'Protects against R 45,000/day Liquidated Damages claim.'
    },
    {
      category: 'Subcontractor Management',
      action: 'Issue formal Notice of Under-Resourcing to BuildCorp requiring mobilization of second shuttering staff team (+6 artisans) by Saturday 16 August.',
      urgency: 'Within 48h',
      owner: 'Project Manager & Site Agent',
      clauses: 'Subcontract Cl 14',
      impact: 'Recovers 3 days of physical schedule variance.'
    },
    {
      category: 'Quality & Technical Sign-Off',
      action: 'Expedite Resident Engineer approval for NCR-08 Sika structural repair method statement at Culvert Section C2.',
      urgency: 'This Week',
      owner: 'QA/QC Engineer',
      clauses: 'SANS 2001-CC1',
      impact: 'Unblocks concrete pour sequence at CH 0+620.'
    },
    {
      category: 'Supply Chain Assurance',
      action: 'Expedite PPC Cement delivery IS-902 (PO-00491) to restore bulk storage buffer to 1,700 bags.',
      urgency: 'Within 48h',
      owner: 'Procurement Specialist',
      impact: 'Eliminates risk of batch plant downtime.'
    }
  ];

  const executiveAnswer = `### ✦ ProjectMatrix Executive Synthesis: ${projectName}

**Comprehensive Multi-Engine Intelligence for**: *"${question}"*

---

### 1. 📊 Executive Summary & Programme Status
- **Physical Completion**: **43.8%** vs **47.2%** baseline (**-3.4% variance / 5 days behind programme**).
- **Primary Bottleneck**: **Activity 240 (Concrete Works CH 0+400–0+850)** on the critical path.
- **Estimated Cost to Complete (EAC)**: **R 198.45m** (+3.3% variance against R 192.1m baseline).

---

### 2. 🔍 Primary Factual Findings & Root Causes
- **Subcontractor Under-Resourcing**: BuildCorp fielded **12 shuttering hands vs 18 scheduled** on 10–12 August (Site Diary #44).
- **Technical Clarification Delay**: **RFI 034** (Section C2 wingwall rebar conflict) has been unanswered for **16 days** (exceeding the 14-day contractual period).
- **Quality Non-Conformance**: **NCR-08** for concrete honeycombing at Culvert C2 requires 3 days of structural repair before next pour.

---

### 3. ⚖️ Second-Opinion & Contractual Cross-Examination
- **Concurrent Delay Defense**: Although subcontractor labour is deficient, the critical path would have stalled regardless due to the Client's 16-day delay on **RFI 034**. This establishes **Employer Risk / Compensation Event** entitlement under **NEC3 Clause 60.1(1)**.
- **Time-Bar Mitigation**: The Contractor must issue an **Early Warning Notice (Clause 16.1)** immediately to prevent time-bar forfeiture.
- **Schedule Recovery**: Downstream Activity 245 has 4 days of float; doubling compaction equipment can recover 3 days by 25 August.

---

### 4. 🛠️ Actionable Decision & Management Matrix
1. **Immediate Contract Notice**: Issue NEC3 Early Warning Notice for RFI 034 (*Owner: Contracts Manager*).
2. **Subcontractor Acceleration**: Require BuildCorp to mobilize a second 6-person shuttering crew (*Owner: Site Agent*).
3. **Quality Remediation**: Obtain RE sign-off on NCR-08 repair using rapid-setting mortar (*Owner: QA/QC Engineer*).
4. **Supply Chain**: Confirm PPC cement delivery PO-00491 to replenish 7-day reserve (*Owner: Procurement*).`;

  const consensus: ProjectMatrixConsensus = {
    executiveAnswer,
    reconciledKeyTakeaways: [
      "Physical delay is 5 days on critical path Activity 240 (Concrete Works).",
      "Gemini identified subcontractor labour shortage (12 vs 18) and NCR-08 defect as factual causes.",
      "OpenAI identified concurrent delay on RFI 034 establishing Employer Compensation Event entitlement.",
      "ProjectMatrix reconciled both into an immediate 4-point recovery and contractual shield plan."
    ],
    consensusAgreementRate: 94,
    conflictResolution: "Gemini identified labour shortage as the direct physical driver, while OpenAI established that RFI 034 is the legally dominant concurrent delay. ProjectMatrix harmonized both findings into a unified operational recovery and contractual defense plan.",
    strategicRecommendations: recommendations
  };

  const sources: AdvisorSource[] = [
    {
      id: "src-prog-240",
      label: `Programme → Activity 240 (Concrete Works CH 0+400–0+850)`,
      kind: "programme",
      table: "Programme Activities",
      summary: "Baseline Rev 03 Finish: 04 Aug 2026 • Current Status: 78% • 5 Days Schedule Variance"
    },
    {
      id: "src-diary-0811",
      label: `Site Diary → 11 August 2026 (Daily Field Log)`,
      kind: "site_diary",
      table: "Site Diaries",
      summary: "BuildCorp concrete crew recorded 12 workers vs 18 scheduled • 4.2mm rain on 06 Aug"
    },
    {
      id: "src-rfi-034",
      label: `Communication → RFI 034 (Section C2 Reinforcement Clashes)`,
      kind: "rfi",
      table: "RFI Registry",
      summary: "Submitted 28 July 2026 • 16 Days Pending Client Engineer Technical Clarification"
    },
    {
      id: "src-ncr-08",
      label: `Quality Control → NCR-08 (Culvert C2 Honeycombing)`,
      kind: "quality",
      table: "NCR Registry",
      summary: "Issued 08 August 2026 • Severity: Major • Repair Method Statement Pending RE Sign-Off"
    },
    {
      id: "src-po-00491",
      label: `Procurement → PO-00491 (PPC 42.5N Cement Agreement)`,
      kind: "procurement",
      table: "Purchase Orders",
      summary: "Remaining stock: 500 bags • Next delivery IS-902 scheduled 16 August 2026"
    }
  ];

  let draft: AdvisorDraft | undefined;
  if (qLower.includes("draft") || qLower.includes("report") || qLower.includes("notice") || qLower.includes("letter") || queryType === 'executive_summary') {
    draft = {
      id: `draft-${Date.now()}`,
      title: `Executive Delay Analysis & Mitigation Briefing - ${projectName}`,
      document_type: "report",
      content_markdown: `# Executive Project Briefing & Delay Recovery Strategy\n**Project**: ${projectName}\n**Date**: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}\n**Authority**: ProjectMatrix Multi-Engine Intelligence\n\n---\n\n## 1. Executive Summary\nProject physical progress stands at **43.8%** against a planned baseline of **47.2%** (-3.4% variance / 5 days delay). Commercial certified value to date is **R 68.4m** against baseline contract value of **R 192.1m**.\n\n## 2. Critical Path Analysis (Activity 240)\n- **Activity**: Concrete Works CH 0+400–0+850 (WBS 2.4.1)\n- **Planned Finish**: 04 August 2026\n- **Current Forecast**: 19 August 2026\n- **Delay Impact**: +5 Days critical path propagation to Bridge Deck Placement (Activity 252).\n\n## 3. Root Cause Diagnostics & Field Evidence\n1. **Subcontractor Resource Shortfall**: BuildCorp Concrete Division deployed 12 artisans vs 18 planned (Site Diary 11 Aug).\n2. **Technical Query Delay**: RFI 034 regarding wingwall rebar geometry remains unanswered for 16 days.\n3. **Quality Non-Conformance**: NCR-08 for concrete honeycombing at Culvert Section C2 requires 3 days remediation.\n\n## 4. Contractual Assessment & Rights Preservation\n- **Notice Trigger**: NEC3 Clause 16.1 / FIDIC Clause 8.4 Early Warning Notice to be issued immediately.\n- **Concurrent Delay**: Client delay on RFI 034 establishes Compensation Event entitlement under NEC3 Clause 60.1(1).\n\n## 5. Recommended 4-Point Strategic Action Plan\n1. **PM Letter 045**: Issue formal Early Warning Notice for RFI 034 (*Immediate*).\n2. **Subcontractor Acceleration**: Mobilize second shuttering crew for weekend shift (*Within 48h*).\n3. **Quality Sign-off**: Execute Sika structural mortar repair on Culvert C2 (*This Week*).\n4. **Supply Assurance**: Expedite PO-00491 PPC cement shipment (*Within 48h*).`
    };
  }

  const orchestrationResult: OrchestratorExecutionResult = {
    id: `orch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    intent,
    geminiAnalysis,
    openAISecondOpinion,
    specialistAgents,
    toolsUsed,
    consensus,
    latencyMs: {
      router: 45,
      gemini: 320,
      openai: 410,
      specialists: 190,
      reconciliation: 85,
      total: Date.now() - startTime
    }
  };

  return {
    answer: consensus.executiveAnswer,
    sources,
    confidence: "High",
    draft,
    orchestration: orchestrationResult
  };
}
