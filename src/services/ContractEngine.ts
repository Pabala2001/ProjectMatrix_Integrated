import { assertOperationalAction } from "../integration/operationalAccess";
import { 
  ContractRuleItem, 
  ProjectContractProfile, 
  NoticeRequirementEvaluation,
  WorkflowCategory
} from "../types/contractRules";
import { 
  ContractDocumentItem, 
  ContractDocumentVersion, 
  EffectiveContractSynthesis, 
  EffectiveContractClause,
  ClauseOverrideItem
} from "../types/contractDocuments";
import { MASTER_CONTRACT_RULES, DEFAULT_PROJECT_CONTRACT_PROFILES } from "../data/contractRulesDatabase";
import { INITIAL_PROJECT_CONTRACT_DOCUMENTS, STANDARD_ORDER_OF_PRECEDENCE } from "../data/contractDocumentsData";

/**
 * CONTRACT ENGINE
 * Centralized runtime service for contract administration, document version control,
 * procedural synthesis (Base Standard + Project Amendments = Effective Contract),
 * time-bar evaluation, and AI-grounded legal reasoning.
 */
export class ContractEngine {
  private static localProfiles: Record<string, ProjectContractProfile> = {
    ...DEFAULT_PROJECT_CONTRACT_PROFILES
  };

  private static localDocuments: Record<string, ContractDocumentItem[]> = {
    ...INITIAL_PROJECT_CONTRACT_DOCUMENTS
  };

  /**
   * Retrieve project contract profile or fallback to default
   */
  public static getContractProfile(projectId: string): ProjectContractProfile {
    if (this.localProfiles[projectId]) {
      return this.localProfiles[projectId];
    }
    // Default fallback
    return {
      id: `contract-profile-${projectId}`,
      projectId: projectId,
      projectName: "Active Infrastructure Project",
      family: "FIDIC",
      formName: "Red Book (Construction)",
      edition: "2017 / 2022 reprint",
      suiteCode: "FIDIC_2017_RED",
      amendments: "Standard 2022 Reprint",
      governingLaw: "Tanzania",
      contractLanguage: "English",
      disputeForum: "DAAB",
      employer: {
        name: "National Roads Agency",
        representative: "Chief Executive Officer",
        organisation: "Ministry of Infrastructure",
      },
      engineerOrPM: {
        roleTitle: "Engineer",
        name: "Lead Consulting Engineer",
        organisation: "Engineering Consultants Ltd",
        registrationNumber: "PrEng 20140889"
      },
      contractor: {
        name: "Project Matrix Construction JV",
        representative: "Contracts Director",
        organisation: "Matrix Holdings Ltd"
      },
      commercial: {
        contractCurrency: "USD",
        contractValue: 50000000,
        contractValueFormatted: "$50.0 Million",
        advancePaymentPercent: 15,
        advancePaymentAmount: 7500000,
        advancePaymentAmortisationRate: 25,
        retentionPercent: 10,
        retentionLimitPercent: 5,
        performanceSecurityPercent: 10,
        delayDamagesPerDay: 25000,
        delayDamagesCapPercent: 10,
        interestRateOnLatePayment: "Central Bank Discount Rate + 3.0%"
      },
      timelines: {
        commencementDate: "2024-01-15",
        timeForCompletionDays: 730,
        completionTargetDate: "2026-01-14",
        defectsNotificationPeriodDays: 365,
        latentDefectsYears: 5
      },
      proceduralRules: {
        claimNoticePeriodDays: 28,
        detailedClaimSubmissionPeriodDays: 84,
        engineerDeterminationPeriodDays: 42,
        interimPaymentCertificationPeriodDays: 28,
        paymentDuePeriodDays: 56,
        rfiResponseTurnaroundDays: 7,
        submittalReviewPeriodDays: 21
      },
      particularConditions: {
        hasCustomZClauses: false
      },
      status: "Active & Administered",
      lastConfiguredAt: "2026-08-19"
    };
  }

  /**
   * Save or update project contract configuration
   */
  public static saveContractProfile(profile: ProjectContractProfile): void {
    assertOperationalAction("write", "services/ContractEngine.ts");
    this.localProfiles[profile.projectId] = profile;
  }

  /**
   * Retrieve all constituent contract documents with full revision history
   */
  public static getContractDocuments(projectId: string): ContractDocumentItem[] {
    if (this.localDocuments[projectId]) {
      return this.localDocuments[projectId];
    }
    // Fallback to proj-02 documents if not found
    return this.localDocuments["proj-02"] || [];
  }

  /**
   * Add a new version revision to a contract document
   */
  public static saveDocumentVersion(
    projectId: string, 
    documentId: string, 
    newVersion: ContractDocumentVersion
  ): void {
    assertOperationalAction("write", "services/ContractEngine.ts");
    const docs = this.getContractDocuments(projectId);
    const docIdx = docs.findIndex(d => d.id === documentId);
    if (docIdx === -1) return;

    const targetDoc = { ...docs[docIdx] };
    
    // Archive current active version to history
    const oldCurrent = { ...targetDoc.currentVersion, status: "Superseded" as const };
    targetDoc.versionHistory = [oldCurrent, ...targetDoc.versionHistory];
    targetDoc.currentVersion = { ...newVersion, status: "Active (Effective)" };
    targetDoc.lastModified = new Date().toISOString().split("T")[0];

    docs[docIdx] = targetDoc;
    this.localDocuments[projectId] = [...docs];
  }

  /**
   * Revert a contract document to a prior revision
   */
  public static revertDocumentVersion(
    projectId: string, 
    documentId: string, 
    targetVersionId: string
  ): void {
    const docs = this.getContractDocuments(projectId);
    const docIdx = docs.findIndex(d => d.id === documentId);
    if (docIdx === -1) return;

    const targetDoc = { ...docs[docIdx] };
    const historyIdx = targetDoc.versionHistory.findIndex(v => v.id === targetVersionId);
    if (historyIdx === -1) return;

    const targetVer = targetDoc.versionHistory[historyIdx];
    const previousCurrent = { ...targetDoc.currentVersion, status: "Superseded" as const };

    // Remove from history and set as current
    const updatedHistory = targetDoc.versionHistory.filter(v => v.id !== targetVersionId);
    updatedHistory.unshift(previousCurrent);

    targetDoc.currentVersion = { ...targetVer, status: "Active (Effective)" };
    targetDoc.versionHistory = updatedHistory;
    targetDoc.lastModified = new Date().toISOString().split("T")[0];

    docs[docIdx] = targetDoc;
    this.localDocuments[projectId] = [...docs];
  }

  /**
   * Add a new contract document to project matrix
   */
  public static addContractDocument(projectId: string, newDoc: ContractDocumentItem): void {
    assertOperationalAction("create", "services/ContractEngine.ts");
    const docs = this.getContractDocuments(projectId);
    this.localDocuments[projectId] = [...docs, newDoc];
  }

  /**
   * CORE SYNTHESIS ENGINE METHOD:
   * Base Standard + Project Amendments = Effective Contract
   * Computes the synthesized effective rules factoring in order of precedence,
   * active document versions, and clause overrides.
   */
  public static synthesizeEffectiveContract(projectId: string): EffectiveContractSynthesis {
    const profile = this.getContractProfile(projectId);
    const documents = this.getContractDocuments(projectId);

    // 1. Get Base Standard Rules
    const baseRules = MASTER_CONTRACT_RULES.filter(
      r => r.contractSuiteCode === profile.suiteCode
    );
    const rulesToUse = baseRules.length > 0 
      ? baseRules 
      : MASTER_CONTRACT_RULES.filter(r => r.contractSuiteCode === "FIDIC_2017_RED");

    // 2. Sort documents by Order of Precedence (Rank 1 to 10)
    const sortedDocs = [...documents].sort((a, b) => a.precedenceRank - b.precedenceRank);

    // 3. Map all active overrides from active document versions
    const activeOverridesMap: Map<string, { override: ClauseOverrideItem; sourceDoc: ContractDocumentItem }> = new Map();

    // Scan docs in reverse precedence order (so higher precedence overwrites lower precedence)
    const reverseSorted = [...sortedDocs].reverse();
    for (const doc of reverseSorted) {
      if (doc.currentVersion && doc.currentVersion.status === "Active (Effective)") {
        for (const cov of doc.currentVersion.clauseOverrides) {
          activeOverridesMap.set(cov.targetClauseNumber, {
            override: cov,
            sourceDoc: doc
          });
        }
      }
    }

    // 4. Synthesize Effective Clauses
    let amendedCount = 0;
    let shortenedTimeBarsCount = 0;
    let strictnessElevatedCount = 0;
    let customZClausesCount = 0;

    const effectiveClauses: EffectiveContractClause[] = rulesToUse.map(baseRule => {
      const activeCov = activeOverridesMap.get(baseRule.clauseIdentifier);
      
      if (!activeCov) {
        // Unmodified Base Standard Rule
        return {
          clauseIdentifier: baseRule.clauseIdentifier,
          clauseTitle: baseRule.clauseTitle,
          workflowCategory: baseRule.workflowCategory,
          status: "BASE_STANDARD_UNMODIFIED" as const,
          baseStandardRule: baseRule,
          effectiveRule: baseRule,
          sourceDocumentHierarchy: [
            {
              documentTitle: `${profile.family} ${profile.formName} (${profile.edition})`,
              documentCategory: "GENERAL_CONDITIONS",
              referenceCode: "BASE-STD",
              versionTag: profile.edition,
              precedenceRank: 5,
              isOverriding: false
            }
          ],
          operationalDeltaSummary: "Standard unamended general condition requirement applies.",
          precedenceReasoning: "No project amendment or Particular Condition override registered.",
          governingLawImpact: `Interpreted under the general laws of ${profile.governingLaw}.`
        };
      }

      // Amended by Project Particular Conditions or Addenda
      amendedCount++;
      const { override, sourceDoc } = activeCov;

      const clonedRule: ContractRuleItem = { ...baseRule };
      
      if (override.parameterOverrides?.deadlineDays) {
        clonedRule.deadline = {
          ...clonedRule.deadline,
          durationValue: override.parameterOverrides.deadlineDays,
          durationUnit: override.parameterOverrides.deadlineUnit || clonedRule.deadline.durationUnit
        };
        if (override.parameterOverrides.deadlineDays < baseRule.deadline.durationValue) {
          shortenedTimeBarsCount++;
        }
      }

      if (override.timeBarStrictness) {
        clonedRule.strictness = override.timeBarStrictness;
        if (override.timeBarStrictness === "STRICT_TIME_BAR") {
          strictnessElevatedCount++;
        }
      }

      clonedRule.requirementSummary = `${override.amendedTextSummary}`;
      clonedRule.legalBasisSummary = `Amended by ${sourceDoc.title} (${sourceDoc.currentVersion.versionTag}), Sub-Clause ${override.targetClauseNumber}`;

      return {
        clauseIdentifier: baseRule.clauseIdentifier,
        clauseTitle: override.clauseTitle || baseRule.clauseTitle,
        workflowCategory: baseRule.workflowCategory,
        status: sourceDoc.category === "PARTICULAR_CONDITIONS" 
          ? "AMENDED_BY_PARTICULAR_CONDITIONS" as const 
          : "OVERRIDDEN_BY_CONTRACT_DATA" as const,
        baseStandardRule: baseRule,
        effectiveRule: clonedRule,
        sourceDocumentHierarchy: [
          {
            documentTitle: sourceDoc.title,
            documentCategory: sourceDoc.category,
            referenceCode: sourceDoc.referenceCode,
            versionTag: sourceDoc.currentVersion.versionTag,
            precedenceRank: sourceDoc.precedenceRank,
            isOverriding: true,
            modificationSummary: override.amendedTextSummary
          },
          {
            documentTitle: `${profile.family} ${profile.formName} (${profile.edition})`,
            documentCategory: "GENERAL_CONDITIONS",
            referenceCode: "BASE-STD",
            versionTag: profile.edition,
            precedenceRank: 5,
            isOverriding: false
          }
        ],
        amendmentReference: `${sourceDoc.title} [${sourceDoc.currentVersion.versionTag}] - Sub-Clause ${override.targetClauseNumber}`,
        operationalDeltaSummary: override.operationalImpact,
        precedenceReasoning: `Pursuant to Order of Precedence Clause (Rank #${sourceDoc.precedenceRank}), ${sourceDoc.title} takes legal precedence over General Conditions (Rank #5).`,
        governingLawImpact: `Strictly enforceable under the laws of ${profile.governingLaw}.`
      };
    });

    const orderOfPrecedenceList = STANDARD_ORDER_OF_PRECEDENCE.map(std => {
      const match = sortedDocs.find(d => d.category === std.category);
      return {
        rank: std.rank,
        category: std.category,
        title: std.title,
        clauseRef: std.clauseRef,
        activeDocumentRef: match ? match.referenceCode : "None Registered",
        activeVersion: match ? match.currentVersion.versionTag : "N/A"
      };
    });

    return {
      projectId,
      projectName: profile.projectName,
      baseStandard: {
        family: profile.family,
        form: profile.formName,
        edition: profile.edition,
        suiteCode: profile.suiteCode,
        unmodifiedClausesCount: rulesToUse.length - amendedCount
      },
      documentsHierarchy: sortedDocs,
      orderOfPrecedenceList,
      effectiveClauses,
      synthesisMetrics: {
        totalEffectiveClauses: rulesToUse.length,
        unmodifiedClausesCount: rulesToUse.length - amendedCount,
        amendedClausesCount: amendedCount,
        shortenedTimeBarsCount,
        strictnessElevatedCount,
        customZClausesCount
      },
      versionFingerprint: `EC-${projectId}-V${sortedDocs.reduce((acc, d) => acc + d.currentVersion.revisionNumber, 0)}-${Date.now().toString(36).slice(0, 5)}`,
      lastSynthesizedAt: new Date().toISOString()
    };
  }

  /**
   * Retrieve all rules applicable to a contract suite, synthesized against Effective Contract
   */
  public static getAllRules(profile: ProjectContractProfile): ContractRuleItem[] {
    const synthesis = this.synthesizeEffectiveContract(profile.projectId);
    return synthesis.effectiveClauses.map(ec => ec.effectiveRule);
  }

  /**
   * Filter rules by workflow category (claims, payment, early_warning, etc.)
   */
  public static getRulesForWorkflow(
    profile: ProjectContractProfile, 
    category: WorkflowCategory
  ): ContractRuleItem[] {
    const allRules = this.getAllRules(profile);
    return allRules.filter(r => r.workflowCategory === category);
  }

  /**
   * Look up specific rule by clause identifier from the Effective Contract
   */
  public static getRuleByClause(
    profile: ProjectContractProfile, 
    clauseIdentifier: string
  ): ContractRuleItem | undefined {
    const allRules = this.getAllRules(profile);
    return allRules.find(r => r.clauseIdentifier === clauseIdentifier);
  }

  /**
   * CORE CONTRACT ENGINE METHOD:
   * Evaluate notice requirements, deadlines, time-bars, and consequences
   * dynamically grounded strictly in the Effective Contract!
   */
  public static getNoticeRequirement(
    profile: ProjectContractProfile,
    triggerEventKey: string,
    eventAwarenessDateStr?: string
  ): NoticeRequirementEvaluation {
    const synthesis = this.synthesizeEffectiveContract(profile.projectId);
    const allRules = synthesis.effectiveClauses.map(ec => ec.effectiveRule);
    
    // Find matching rule by trigger event key or default to first claim rule
    let matchedEffectiveClause = synthesis.effectiveClauses.find(ec => ec.effectiveRule.triggerEventKey === triggerEventKey);
    if (!matchedEffectiveClause) {
      matchedEffectiveClause = synthesis.effectiveClauses.find(ec => ec.workflowCategory === "claims") || synthesis.effectiveClauses[0];
    }

    const matchedRule = matchedEffectiveClause.effectiveRule;
    const awarenessDate = eventAwarenessDateStr 
      ? new Date(eventAwarenessDateStr) 
      : new Date();

    // Calculate deadline date
    const deadlineDays = matchedRule.deadline.durationValue;
    const deadlineDate = new Date(awarenessDate);
    
    if (matchedRule.deadline.durationUnit === "working_days") {
      let added = 0;
      while (added < deadlineDays) {
        deadlineDate.setDate(deadlineDate.getDate() + 1);
        const day = deadlineDate.getDay();
        if (day !== 0 && day !== 6) {
          added++;
        }
      }
    } else {
      deadlineDate.setDate(deadlineDate.getDate() + deadlineDays);
    }

    const today = new Date();
    const diffTime = deadlineDate.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let timeBarStatus: "COMPLIANT_WINDOW" | "URGENT_ACTION_REQUIRED" | "IMMINENT_TIME_BAR" | "TIME_BARRED";
    if (daysRemaining < 0) {
      timeBarStatus = "TIME_BARRED";
    } else if (daysRemaining <= 2) {
      timeBarStatus = "IMMINENT_TIME_BAR";
    } else if (daysRemaining <= 7) {
      timeBarStatus = "URGENT_ACTION_REQUIRED";
    } else {
      timeBarStatus = "COMPLIANT_WINDOW";
    }

    const formattedDeadline = deadlineDate.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });

    const isAmended = matchedEffectiveClause.status !== "BASE_STANDARD_UNMODIFIED";

    return {
      isNoticeRequired: true,
      rule: matchedRule,
      deadlineDate: formattedDeadline,
      daysRemaining,
      timeBarStatus,
      requiredActionSummary: matchedRule.requiredAction,
      responsibleRole: matchedRule.responsibleRole,
      recipientRole: matchedRule.recipientRole,
      legalConsequence: matchedRule.consequenceOfFailure,
      draftingChecklist: [
        ...matchedRule.requiredDeliverables,
        isAmended ? `Verify compliance with Particular Conditions override (${matchedEffectiveClause.amendmentReference})` : "Standard Base Form Deliverable"
      ],
      recommendedNoticeTemplate: `${profile.family} ${profile.formName} - Effective Clause ${matchedRule.clauseIdentifier} Notice Form`,
      governingLawNote: `Governed by the laws of ${profile.governingLaw}. Effective Contract priority: ${matchedEffectiveClause.precedenceReasoning}`
    };
  }

  /**
   * Calculate interim payment cycle schedule
   */
  public static calculatePaymentSchedule(
    profile: ProjectContractProfile,
    submissionDateStr: string,
    amountClaimed: number
  ) {
    const synthesis = this.synthesizeEffectiveContract(profile.projectId);
    const paymentRule = synthesis.effectiveClauses.find(ec => ec.clauseIdentifier === "14.7" || ec.clauseIdentifier === "51.2")?.effectiveRule;
    
    const submissionDate = new Date(submissionDateStr);
    
    // Certification deadline
    const certDays = profile.proceduralRules?.interimPaymentCertificationPeriodDays || 28;
    const certDate = new Date(submissionDate);
    certDate.setDate(certDate.getDate() + certDays);

    // Payment due date from effective rule
    const payDays = paymentRule?.deadline.durationValue || profile.proceduralRules?.paymentDuePeriodDays || 56;
    const payDate = new Date(submissionDate);
    payDate.setDate(payDate.getDate() + payDays);

    // Retention calculation
    const retentionRate = (profile.commercial.retentionPercent || 10) / 100;
    const retentionDeduction = amountClaimed * retentionRate;
    const netPayable = amountClaimed - retentionDeduction;

    return {
      submissionDate: submissionDateStr,
      certificationDeadline: certDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      paymentDueDate: payDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      amountClaimed,
      retentionDeduction,
      netPayable,
      latePaymentInterestFormula: profile.commercial.interestRateOnLatePayment
    };
  }

  /**
   * Generate complete formatted Effective Contract reasoning context for the AI Advisor (Ask Matrix)
   */
  public static getEffectiveContractContextForAI(projectId: string): string {
    const synthesis = this.synthesizeEffectiveContract(projectId);
    const profile = this.getContractProfile(projectId);

    const amendedClausesText = synthesis.effectiveClauses
      .filter(ec => ec.status !== "BASE_STANDARD_UNMODIFIED")
      .map(ec => `• CLAUSE ${ec.clauseIdentifier} [${ec.clauseTitle}]:
   - Base Standard: ${ec.baseStandardRule.requirementSummary} (${ec.baseStandardRule.deadline.durationValue} ${ec.baseStandardRule.deadline.durationUnit})
   - Project Amendment: ${ec.amendmentReference}
   - EFFECTIVE RULE: ${ec.effectiveRule.requirementSummary} (Deadline: ${ec.effectiveRule.deadline.durationValue} ${ec.effectiveRule.deadline.durationUnit}, Strictness: ${ec.effectiveRule.strictness})
   - Operational Impact: ${ec.operationalDeltaSummary}
   - Legal Precedence: ${ec.precedenceReasoning}`)
      .join("\n\n");

    const orderText = synthesis.orderOfPrecedenceList
      .map(o => `${o.rank}. ${o.title} (${o.clauseRef}) → Active Doc: ${o.activeDocumentRef} [${o.activeVersion}]`)
      .join("\n");

    return `=== PROJECTMATRIX EFFECTIVE CONTRACT REASONING BASELINE ===
PROJECT: ${profile.projectName} (${projectId})
BASE STANDARD: ${synthesis.baseStandard.family} ${synthesis.baseStandard.form} (${synthesis.baseStandard.edition})
GOVERNING LAW: Laws of ${profile.governingLaw}
EMPLOYER: ${profile.employer.name} | CONTRACTOR: ${profile.contractor.name} | ENGINEER: ${profile.engineerOrPM.name}

ORDER OF PRECEDENCE OF CONTRACT DOCUMENTS:
${orderText}

ACTIVE PROJECT AMENDMENTS & EFFECTIVE CLAUSES (${synthesis.synthesisMetrics.amendedClausesCount} Modifications Active):
${amendedClausesText}

CRITICAL DIRECTIVE FOR AI REASONING:
Always reason against the EFFECTIVE CONTRACT (Base Standard + Project Amendments). If a user asks about notice deadlines, time bars, or engineer determinations, quote the Effective Clause and explicitly mention the modifying Particular Condition/Addendum version if amended!
==========================================================`;
  }

  /**
   * Draft a formal compliant contractual notice
   */
  public static generateNoticeLetter(
    profile: ProjectContractProfile,
    ruleId: string,
    details: {
      subject: string;
      eventDate: string;
      eventDescription: string;
      preliminaryDelayDays?: number;
      preliminaryCostImpact?: number;
      referenceNumber?: string;
    }
  ): string {
    const synthesis = this.synthesizeEffectiveContract(profile.projectId);
    const effectiveClause = synthesis.effectiveClauses.find(ec => ec.effectiveRule.id === ruleId) || synthesis.effectiveClauses[0];
    const rule = effectiveClause.effectiveRule;
    const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const isAmended = effectiveClause.status !== "BASE_STANDARD_UNMODIFIED";

    return `FORMAL CONTRACTUAL NOTICE
Reference: ${details.referenceNumber || "NOT-" + rule.clauseIdentifier + "-" + Date.now().toString().slice(-4)}
Date: ${today}

To: ${profile.engineerOrPM.name} (${profile.engineerOrPM.roleTitle})
Organisation: ${profile.engineerOrPM.organisation}
Project: ${profile.projectName}
Employer: ${profile.employer.name}

From: ${profile.contractor.name}
Contractor's Representative: ${profile.contractor.representative}

SUBJECT: NOTICE UNDER CLAUSE ${rule.clauseIdentifier} (${rule.clauseTitle.toUpperCase()})
CONTRACT FORM: ${profile.family} ${profile.formName} (${profile.edition})
${isAmended ? `EFFECTIVE AMENDMENT: ${effectiveClause.amendmentReference}` : ""}
GOVERNING LAW: Laws of ${profile.governingLaw}

Dear Sir / Madam,

1. In accordance with Clause ${rule.clauseIdentifier} of the Conditions of Contract${isAmended ? ` as amended by the Particular Conditions (${effectiveClause.amendmentReference})` : ""}, we hereby give formal notice of the following event/circumstance which has arisen on site:

   Event Occurrence Date: ${details.eventDate}
   Description of Event: ${details.eventDescription}

2. Contractual & Legal Basis:
   This notice is submitted pursuant to Clause ${rule.clauseIdentifier} [${rule.clauseTitle}] and related provisions of the Effective Contract. The Contractor considers itself entitled to an Extension of the Time for Completion and/or Additional Payment (Cost plus reasonable profit).
   ${isAmended ? `Note: Complies strictly with the ${rule.deadline.durationValue}-${rule.deadline.durationUnit} period stipulated in the Particular Conditions.` : ""}

3. Preliminary Impact Assessment:
   - Anticipated Delay to Critical Path: ${details.preliminaryDelayDays ? details.preliminaryDelayDays + " Calendar Days" : "Under detailed evaluation"}
   - Preliminary Cost Exposure: ${details.preliminaryCostImpact ? profile.commercial.contractCurrency + " " + details.preliminaryCostImpact.toLocaleString() : "To be substantiated in full particulars"}

4. Contemporary Records:
   In compliance with the Contract, the Contractor is maintaining contemporary records on site including daily site diaries, equipment telemetry, labor allocations, and laser scan surveys.

5. Detailed Particulars:
   In accordance with the procedural timeline (within ${profile.proceduralRules.detailedClaimSubmissionPeriodDays || 84} days), the Contractor will submit full particulars with CPM Time Impact Analysis and cost vouchers.

Yours faithfully,

_____________________________
${profile.contractor.representative}
For and on behalf of ${profile.contractor.name}`;
  }
}

