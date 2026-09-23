import { ContractRuleItem, ProjectContractProfile } from "../types/contractRules";

/**
 * MASTER CONTRACT RULES DATABASE
 * Normalized procedural rules across all standard contract forms:
 * Contract -> Clause -> Requirement -> Trigger -> Deadline -> Required Action -> Role -> Consequence
 * 
 * Note: Stores procedural metadata, triggers, and deadlines without distributing copyrighted verbatim contract texts.
 */

export const MASTER_CONTRACT_RULES: ContractRuleItem[] = [
  // ==========================================================================
  // FIDIC 2017 RED BOOK (Second Edition)
  // ==========================================================================
  {
    id: "fidic-2017-rule-20.2.1",
    contractSuiteCode: "FIDIC_2017_RED",
    clauseIdentifier: "20.2.1",
    clauseTitle: "Notice of Claim (Contractor or Employer)",
    workflowCategory: "claims",
    requirementSummary: "Formal notification of intention to claim Extension of Time (EOT) and/or additional payment / cost.",
    legalBasisSummary: "Mandatory condition precedent requiring the claiming party to notify the Engineer of any event or circumstance giving rise to a claim.",
    triggerCondition: "Claiming party becomes aware, or should have become aware, of the event or circumstance giving rise to the claim.",
    triggerEventKey: "contractor_awareness",
    deadline: {
      durationValue: 28,
      durationUnit: "calendar_days",
      computedFrom: "awareness_date",
      extendable: false,
      extensionMechanism: "No extension permitted under standard FIDIC 2017; only DAAB waiver under Sub-Clause 20.2.5 on specific prejudice grounds."
    },
    requiredAction: "Submit formal Notice of Claim specifying the event/circumstance and citing contractual clause legal basis.",
    noticeTemplateId: "fidic-notice-claim",
    requiredDeliverables: [
      "Reference to event and date of first awareness",
      "Clause basis under General / Particular Conditions",
      "Brief preliminary description of expected time and financial consequences"
    ],
    responsibleRole: "Contractor",
    recipientRole: "Engineer",
    strictness: "STRICT_TIME_BAR",
    consequenceOfFailure: "Absolute Time-Bar: The claiming Party shall not be entitled to any EOT or additional payment, and the other Party is fully discharged from all liability in connection with the event.",
    reciprocalConsequence: "If Engineer fails to issue notice of time-bar within 14 days of receiving Notice of Claim, the notice is deemed valid under Sub-Clause 20.2.2.",
    governanceCategory: "Time",
    standardFormsAvailable: ["FIDIC 2017 Red Sub-Clause 20.2.1 Form", "Notice of Claim Register Item"]
  },
  {
    id: "fidic-2017-rule-20.2.4",
    contractSuiteCode: "FIDIC_2017_RED",
    clauseIdentifier: "20.2.4",
    clauseTitle: "Fully Detailed Claim Particulars",
    workflowCategory: "claims",
    requirementSummary: "Submission of comprehensive statement of legal and factual grounds, detailed contemporaneous records, delay analysis, and cost quantum.",
    legalBasisSummary: "Second-tier procedural requirement substantiating the claim after the initial 28-day notice.",
    triggerCondition: "Submission of initial Notice of Claim or conclusion of continuing delay event.",
    triggerEventKey: "notice_of_claim_submitted",
    deadline: {
      durationValue: 84,
      durationUnit: "calendar_days",
      computedFrom: "awareness_date",
      extendable: true,
      extensionMechanism: "May be extended if another period is proposed by Contractor and agreed by the Engineer."
    },
    requiredAction: "Submit fully detailed claim with critical path time-impact delay analysis, daily diary records, and certified direct cost ledger.",
    noticeTemplateId: "fidic-detailed-claim",
    requiredDeliverables: [
      "Detailed chronological narrative of facts",
      "Critical Path Method (CPM) Time Impact Analysis (TIA)",
      "Breakdown of direct costs with invoices, timesheets, and plant hire vouchers",
      "Full citation of contract clauses and legal precedents"
    ],
    responsibleRole: "Contractor",
    recipientRole: "Engineer",
    strictness: "STRICT_TIME_BAR",
    consequenceOfFailure: "If fully detailed particulars are not submitted within 84 days, the Notice of Claim is deemed to have lapsed and no longer treated as a valid notice.",
    governanceCategory: "Time",
    standardFormsAvailable: ["Detailed Claim Dossier Template", "Delay Matrix CPM"]
  },
  {
    id: "fidic-2017-rule-3.7.3",
    contractSuiteCode: "FIDIC_2017_RED",
    clauseIdentifier: "3.7.3",
    clauseTitle: "Engineer's Agreement or Determination on Claim",
    workflowCategory: "claims",
    requirementSummary: "The Engineer must act neutrally to seek agreement between Parties or issue a fair, reasoned determination.",
    legalBasisSummary: "Contractual obligation on the Engineer to resolve claims within strict statutory timeline rather than keeping claims unresolved indefinitely.",
    triggerCondition: "Receipt of fully detailed claim particulars under Sub-Clause 20.2.4.",
    triggerEventKey: "detailed_claim_received",
    deadline: {
      durationValue: 42,
      durationUnit: "calendar_days",
      computedFrom: "submission_date",
      extendable: true,
      extensionMechanism: "May be extended with mutual agreement of both Parties."
    },
    requiredAction: "Engineer consults both Parties to seek agreement; if no agreement within 42 days, issues formal binding Determination.",
    requiredDeliverables: ["Signed Engineer Determination Notice with itemized assessment of EOT days and allowed certified cost amounts."],
    responsibleRole: "Engineer",
    recipientRole: "Contractor",
    strictness: "DEEMED_ACCEPTANCE",
    consequenceOfFailure: "Deemed Rejection / Dispute Trigger: If Engineer fails to make determination within 42 days, the claim is deemed rejected, entitling either Party to refer the matter to the DAAB under Clause 21.",
    governanceCategory: "Legal",
    standardFormsAvailable: ["Engineer Determination Format", "DAAB Referral Form"]
  },
  {
    id: "fidic-2017-rule-14.3",
    contractSuiteCode: "FIDIC_2017_RED",
    clauseIdentifier: "14.3",
    clauseTitle: "Application for Interim Payment Certificate (IPC)",
    workflowCategory: "payment",
    requirementSummary: "Submission of monthly interim payment application detailing value of works executed, material on site, and contract adjustments.",
    legalBasisSummary: "Establishes contractor's monthly billing entitlement and starts the statutory certification cycle.",
    triggerCondition: "End of designated monthly billing cycle or milestone completion.",
    triggerEventKey: "monthly_billing_cycle",
    deadline: {
      durationValue: 30,
      durationUnit: "calendar_days",
      computedFrom: "trigger_date",
      extendable: false
    },
    requiredAction: "Submit IPC Statement to Engineer with measured quantities, signed inspection requests (IRs), and material delivery notes.",
    requiredDeliverables: [
      "Detailed BoQ progress breakdown",
      "Measurement sheets signed with Resident Engineer",
      "Materials on site invoices (80% advance allowance)",
      "Current retention deduction schedule"
    ],
    responsibleRole: "Contractor",
    recipientRole: "Engineer",
    strictness: "GUIDELINE_ONLY",
    consequenceOfFailure: "Delay in IPC submission defers payment certification to subsequent monthly valuation cycle.",
    governanceCategory: "Cost",
    standardFormsAvailable: ["FIDIC IPC Statement Form", "BoQ Valuation Certificate"]
  },
  {
    id: "fidic-2017-rule-14.6",
    contractSuiteCode: "FIDIC_2017_RED",
    clauseIdentifier: "14.6",
    clauseTitle: "Issue of Interim Payment Certificate (IPC)",
    workflowCategory: "payment",
    requirementSummary: "Engineer must review Contractor's statement and issue IPC stating the certified net amount.",
    legalBasisSummary: "Mandatory certification timeline preventing administrative withholding of contractor cash flow.",
    triggerCondition: "Receipt of Contractor's IPC Statement and supporting documents under Sub-Clause 14.3.",
    triggerEventKey: "ipc_statement_received",
    deadline: {
      durationValue: 28,
      durationUnit: "calendar_days",
      computedFrom: "submission_date",
      extendable: false
    },
    requiredAction: "Engineer issues Interim Payment Certificate to Employer with copy to Contractor, or details reasons for withholding any amount.",
    requiredDeliverables: ["Signed Interim Payment Certificate with deduction itemization."],
    responsibleRole: "Engineer",
    recipientRole: "Employer",
    strictness: "STATUTORY_INTEREST",
    consequenceOfFailure: "Contractor is entitled to financing charges (interest) and, after giving 21 days notice under Sub-Clause 16.1, the right to suspend or reduce the rate of work.",
    governanceCategory: "Cost",
    standardFormsAvailable: ["Engineer Certified Payment Certificate"]
  },
  {
    id: "fidic-2017-rule-14.7",
    contractSuiteCode: "FIDIC_2017_RED",
    clauseIdentifier: "14.7",
    clauseTitle: "Payment by Employer to Contractor",
    workflowCategory: "payment",
    requirementSummary: "Employer must pay certified amount into Contractor's designated bank account.",
    legalBasisSummary: "Statutory payment obligation with express commercial financing remedies.",
    triggerCondition: "Receipt of Contractor's IPC Statement (56 days) or Advance Payment Guarantee (21 days).",
    triggerEventKey: "payment_due_cycle",
    deadline: {
      durationValue: 56,
      durationUnit: "calendar_days",
      computedFrom: "submission_date",
      extendable: false
    },
    requiredAction: "Employer disburses certified payment to Contractor's nominated account.",
    requiredDeliverables: ["Bank transfer SWIFT / Proof of payment receipt."],
    responsibleRole: "Employer",
    recipientRole: "Contractor",
    strictness: "STATUTORY_INTEREST",
    consequenceOfFailure: "Compounded financing charges at Central Bank discount rate + 3%, right to suspend works under Sub-Clause 16.1, and right to terminate after 42 days notice under Sub-Clause 16.2.",
    governanceCategory: "Cost",
    standardFormsAvailable: ["Financing Charges Claim Calculation"]
  },
  {
    id: "fidic-2017-rule-8.4",
    contractSuiteCode: "FIDIC_2017_RED",
    clauseIdentifier: "8.4",
    clauseTitle: "Advance Warning of Delays / Potential Variation",
    workflowCategory: "early_warning",
    requirementSummary: "Contractor and Engineer each have a mutual duty to advise the other of any probable future event that may adversely affect works.",
    legalBasisSummary: "Dispute avoidance and collaborative risk management mechanism in FIDIC 2017.",
    triggerCondition: "Any event that may adversely affect the work of other contractors, increase Contract Price, or delay completion.",
    triggerEventKey: "probable_future_delay",
    deadline: {
      durationValue: 7,
      durationUnit: "calendar_days",
      computedFrom: "awareness_date",
      extendable: false
    },
    requiredAction: "Submit formal Advance Warning Notice detailing nature of risk and proposal for mitigation.",
    requiredDeliverables: ["Advance Warning Form with risk rating and mitigation proposal."],
    responsibleRole: "Contractor",
    recipientRole: "Engineer",
    strictness: "GUIDELINE_ONLY",
    consequenceOfFailure: "Failure to give advance warning may be taken into account by Engineer when evaluating subsequent EOT or Cost claims.",
    governanceCategory: "Operational",
    standardFormsAvailable: ["FIDIC Advance Warning Register Item"]
  },

  // ==========================================================================
  // NEC4 ECC (Engineering and Construction Contract)
  // ==========================================================================
  {
    id: "nec4-rule-15.1",
    contractSuiteCode: "NEC4_ECC",
    clauseIdentifier: "15.1",
    clauseTitle: "Early Warning Notice (Mutual Obligation)",
    workflowCategory: "early_warning",
    requirementSummary: "Contractor and Project Manager give an early warning by notifying the other as soon as either becomes aware of any matter which could increase Price, delay Completion, or impair Performance.",
    legalBasisSummary: "Fundamental core principle of NEC proactive risk management and collaboration.",
    triggerCondition: "Contractor or Project Manager becomes aware of any event that could affect cost, time, or quality.",
    triggerEventKey: "early_warning_trigger",
    deadline: {
      durationValue: 7,
      durationUnit: "calendar_days",
      computedFrom: "awareness_date",
      extendable: false
    },
    requiredAction: "Issue Early Warning Notice and enter risk into the Early Warning Register; request Early Warning Meeting if necessary.",
    requiredDeliverables: ["Early Warning Notice (EWN)", "Early Warning Register update entry."],
    responsibleRole: "Contractor",
    recipientRole: "Project Manager",
    strictness: "CONDITIONAL_BAR",
    consequenceOfFailure: "If Contractor failed to give early warning which an experienced contractor could have given, Compensation Event is assessed as if the early warning had been given (Clause 63.7 deduction).",
    governanceCategory: "Operational",
    standardFormsAvailable: ["NEC4 Early Warning Form", "Early Warning Register"]
  },
  {
    id: "nec4-rule-61.3",
    contractSuiteCode: "NEC4_ECC",
    clauseIdentifier: "61.3",
    clauseTitle: "Notification of Compensation Event by Contractor",
    workflowCategory: "claims",
    requirementSummary: "Contractor notifies the Project Manager of an event which has happened or which is expected to happen as a compensation event.",
    legalBasisSummary: "Strict 8-week time-bar condition precedent in NEC4 ECC.",
    triggerCondition: "Contractor becomes aware that the event has happened.",
    triggerEventKey: "contractor_awareness_ce",
    deadline: {
      durationValue: 56, // 8 weeks = 56 calendar days
      durationUnit: "calendar_days",
      computedFrom: "awareness_date",
      extendable: false
    },
    requiredAction: "Notify the Project Manager of the Compensation Event, unless the Project Manager has already notified the event.",
    requiredDeliverables: [
      "Compensation Event Notice citing relevant sub-clause of Clause 60.1",
      "Brief statement of effect on Defined Cost and Completion Date"
    ],
    responsibleRole: "Contractor",
    recipientRole: "Project Manager",
    strictness: "STRICT_TIME_BAR",
    consequenceOfFailure: "Absolute Time-Bar: If the Contractor does not notify a compensation event within eight weeks of becoming aware of the event, the Prices, the Completion Date or a Key Date are not changed.",
    governanceCategory: "Time",
    standardFormsAvailable: ["NEC4 Compensation Event Notification Form (CEN)"]
  },
  {
    id: "nec4-rule-62.3",
    contractSuiteCode: "NEC4_ECC",
    clauseIdentifier: "62.3",
    clauseTitle: "Submission of Quotation for Compensation Event",
    workflowCategory: "claims",
    requirementSummary: "Contractor submits quotation for Compensation Event showing proposed changes to Prices and Completion Date.",
    legalBasisSummary: "Prospective pricing of compensation events based on forecast Defined Cost.",
    triggerCondition: "Instruction from Project Manager to submit quotations for Compensation Event.",
    triggerEventKey: "pm_ce_instruction",
    deadline: {
      durationValue: 21, // 3 weeks = 21 calendar days
      durationUnit: "calendar_days",
      computedFrom: "instruction_date",
      extendable: true,
      extensionMechanism: "Project Manager and Contractor may agree to extend the period for quotation submission before the deadline expires."
    },
    requiredAction: "Submit detailed quotation using Schedule of Cost Components and updated CPM programme.",
    requiredDeliverables: [
      "Cost quotation breakdown (people, equipment, plant, materials, subcontract)",
      "Altered programme demonstrating delay to Completion Date"
    ],
    responsibleRole: "Contractor",
    recipientRole: "Project Manager",
    strictness: "DEEMED_ACCEPTANCE",
    consequenceOfFailure: "Project Manager makes own assessment of the Compensation Event if Contractor fails to submit quotation within the 3 weeks.",
    governanceCategory: "Cost",
    standardFormsAvailable: ["NEC4 CE Quotation Breakdown Form"]
  },
  {
    id: "nec4-rule-62.6",
    contractSuiteCode: "NEC4_ECC",
    clauseIdentifier: "62.6",
    clauseTitle: "Project Manager's Deemed Acceptance of Quotation",
    workflowCategory: "claims",
    requirementSummary: "Project Manager must reply to Contractor's quotation within 2 weeks of submission.",
    legalBasisSummary: "NEC4 silence-means-approval mechanism protecting Contractor cash flow and certainty.",
    triggerCondition: "Submission of Compensation Event quotation by Contractor.",
    triggerEventKey: "quotation_submitted",
    deadline: {
      durationValue: 14, // 2 weeks
      durationUnit: "calendar_days",
      computedFrom: "submission_date",
      extendable: false
    },
    requiredAction: "Project Manager replies accepting quotation, instructing resubmission, or stating PM will assess.",
    requiredDeliverables: ["Signed Project Manager CE Acceptance / Decision Notice."],
    responsibleRole: "Project Manager",
    recipientRole: "Contractor",
    strictness: "DEEMED_ACCEPTANCE",
    consequenceOfFailure: "If PM fails to reply within 2 weeks, Contractor issues 2-week reminder. If PM fails to reply within 2 weeks of reminder, quotation is treated as accepted (Deemed Acceptance).",
    governanceCategory: "Cost",
    standardFormsAvailable: ["NEC4 Reminder Notice of Failure to Respond"]
  },

  // ==========================================================================
  // SAICE GCC 2015 (General Conditions of Contract for Construction Works)
  // ==========================================================================
  {
    id: "gcc-2015-rule-10.1.1",
    contractSuiteCode: "GCC_2015",
    clauseIdentifier: "10.1.1.1",
    clauseTitle: "Contractor's Notice of Claim (EOT & Additional Payment)",
    workflowCategory: "claims",
    requirementSummary: "Written notice of intention to claim extension of time or additional payment to the Employer's Agent.",
    legalBasisSummary: "Mandatory 28-day notice clause under South African civil engineering standard contract.",
    triggerCondition: "Contractor becomes aware, or should reasonably have become aware, of the circumstances giving rise to the claim.",
    triggerEventKey: "gcc_contractor_awareness",
    deadline: {
      durationValue: 28,
      durationUnit: "calendar_days",
      computedFrom: "awareness_date",
      extendable: false
    },
    requiredAction: "Deliver written Notice of Claim stating the facts and citing Clause 10.1.1.1 to the Employer's Agent.",
    requiredDeliverables: ["Written Notice of Claim with date of initial awareness."],
    responsibleRole: "Contractor",
    recipientRole: "Engineer",
    strictness: "STRICT_TIME_BAR",
    consequenceOfFailure: "Absolute Time-Bar: If Contractor fails to give notice within 28 days, Contractor has no claim for extension of time or additional payment, and Employer is discharged from all liability.",
    governanceCategory: "Time",
    standardFormsAvailable: ["GCC 2015 Clause 10.1.1 Notice Form"]
  },
  {
    id: "gcc-2015-rule-10.1.1.2",
    contractSuiteCode: "GCC_2015",
    clauseIdentifier: "10.1.1.2",
    clauseTitle: "Monthly Interim Claim Particulars & Final Claim",
    workflowCategory: "claims",
    requirementSummary: "Submission of monthly interim particulars while delay continues, and final claim within 28 days of event ending.",
    legalBasisSummary: "Ongoing claim documentation requirement under GCC 2015.",
    triggerCondition: "Claim of continuing effect or conclusion of delay event.",
    triggerEventKey: "gcc_continuing_claim",
    deadline: {
      durationValue: 28,
      durationUnit: "calendar_days",
      computedFrom: "trigger_date",
      extendable: false
    },
    requiredAction: "Submit full particulars of claim with CPM delay analysis and substantiated cost records.",
    requiredDeliverables: ["Monthly claim status report or final claim dossier with supporting proof."],
    responsibleRole: "Contractor",
    recipientRole: "Engineer",
    strictness: "STRICT_TIME_BAR",
    consequenceOfFailure: "Failure to submit particulars within 28 days of event conclusion forfeits rights to the claim.",
    governanceCategory: "Time",
    standardFormsAvailable: ["GCC Monthly Claim Statement"]
  },
  {
    id: "gcc-2015-rule-6.10.1",
    contractSuiteCode: "GCC_2015",
    clauseIdentifier: "6.10.1",
    clauseTitle: "Monthly Payment Valuation & Interim Payment Certificate",
    workflowCategory: "payment",
    requirementSummary: "Employer's Agent certifies monthly payment within 7 days of receiving Contractor's statement.",
    legalBasisSummary: "South African prompt certification framework.",
    triggerCondition: "Submission of monthly statement by Contractor on 25th day of month.",
    triggerEventKey: "monthly_statement_submitted",
    deadline: {
      durationValue: 7,
      durationUnit: "calendar_days",
      computedFrom: "submission_date",
      extendable: false
    },
    requiredAction: "Employer's Agent issues Payment Certificate to Employer and Contractor.",
    requiredDeliverables: ["Signed Payment Certificate."],
    responsibleRole: "Engineer",
    recipientRole: "Employer",
    strictness: "STATUTORY_INTEREST",
    consequenceOfFailure: "Employer must pay within 28 days of Contractor's statement date; late payment accrues interest compounded monthly at prime rate + 2%.",
    governanceCategory: "Cost",
    standardFormsAvailable: ["GCC Payment Certificate Template"]
  },

  // ==========================================================================
  // JBCC PRINCIPAL BUILDING AGREEMENT (Edition 6.2 / 4.1)
  // ==========================================================================
  {
    id: "jbcc-6.2-rule-23.4.2",
    contractSuiteCode: "JBCC_6_2",
    clauseIdentifier: "23.4.2",
    clauseTitle: "Contractor's Notice of Delay to Practical Completion",
    workflowCategory: "claims",
    requirementSummary: "Contractor must give notice of intention to claim revision to Practical Completion within 20 working days.",
    legalBasisSummary: "JBCC 2-stage notice procedure for building contracts.",
    triggerCondition: "Contractor becomes aware, or ought reasonably to have become aware, of circumstances causing delay.",
    triggerEventKey: "jbcc_delay_awareness",
    deadline: {
      durationValue: 20,
      durationUnit: "working_days",
      computedFrom: "awareness_date",
      extendable: false
    },
    requiredAction: "Deliver written notice to Principal Agent stating the cause of delay and citing relevant clause under Clause 23.",
    requiredDeliverables: ["JBCC Delay Notice citing Clause 23.1, 23.2 or 23.3."],
    responsibleRole: "Contractor",
    recipientRole: "Principal Agent",
    strictness: "STRICT_TIME_BAR",
    consequenceOfFailure: "Absolute Time-Bar: If Contractor fails to give notice within 20 working days, Contractor is barred from claiming revision to the date for practical completion.",
    governanceCategory: "Time",
    standardFormsAvailable: ["JBCC Clause 23.4.2 Delay Notice"]
  },
  {
    id: "jbcc-6.2-rule-23.5",
    contractSuiteCode: "JBCC_6_2",
    clauseIdentifier: "23.5",
    clauseTitle: "Contractor's Claim Quantum & Particulars",
    workflowCategory: "claims",
    requirementSummary: "Contractor must submit claim for revision of date for practical completion within 40 working days of delay ending.",
    legalBasisSummary: "Second stage of JBCC claim procedure.",
    triggerCondition: "Delaying circumstances have ceased.",
    triggerEventKey: "jbcc_delay_ceased",
    deadline: {
      durationValue: 40,
      durationUnit: "working_days",
      computedFrom: "trigger_date",
      extendable: false
    },
    requiredAction: "Submit full particulars stating the number of working days claimed and calculation details.",
    requiredDeliverables: ["Working days delay calculation", "CPM schedule fragnet", "Direct loss and expense claim (if applicable)."],
    responsibleRole: "Contractor",
    recipientRole: "Principal Agent",
    strictness: "STRICT_TIME_BAR",
    consequenceOfFailure: "Claim is barred if full claim particulars are not submitted within 40 working days of the delay ceasing.",
    governanceCategory: "Time",
    standardFormsAvailable: ["JBCC Full Claim Submission Form"]
  },
  {
    id: "jbcc-6.2-rule-23.7",
    contractSuiteCode: "JBCC_6_2",
    clauseIdentifier: "23.7",
    clauseTitle: "Principal Agent's Determination on Delay Claim",
    workflowCategory: "claims",
    requirementSummary: "Principal Agent must assess and determine the claim within 20 working days of receipt.",
    legalBasisSummary: "Statutory decision timeline under JBCC.",
    triggerCondition: "Receipt of Contractor's full claim under Clause 23.5.",
    triggerEventKey: "jbcc_full_claim_received",
    deadline: {
      durationValue: 20,
      durationUnit: "working_days",
      computedFrom: "submission_date",
      extendable: false
    },
    requiredAction: "Principal Agent grants, reduces, or refuses the working days claimed with written reasons.",
    requiredDeliverables: ["Principal Agent Revision of Practical Completion Date Certificate."],
    responsibleRole: "Principal Agent",
    recipientRole: "Contractor",
    strictness: "DEEMED_ACCEPTANCE",
    consequenceOfFailure: "If Principal Agent fails to act within 20 working days, the claim is deemed to be refused, opening the way for immediate dispute referral under Clause 30.",
    governanceCategory: "Time",
    standardFormsAvailable: ["JBCC Revision Certificate"]
  }
];

/**
 * DEFAULT ACTIVE PROJECT CONTRACT CONFIGURATIONS
 * Pre-populated for active projects so ContractEngine has live data from day one.
 */
export const DEFAULT_PROJECT_CONTRACT_PROFILES: Record<string, ProjectContractProfile> = {
  "proj-001": {
    id: "contract-profile-001",
    projectId: "proj-001",
    projectName: "Dar es Salaam Port Access Highway",
    family: "FIDIC",
    formName: "Red Book (Construction)",
    edition: "2017 / 2022 reprint",
    suiteCode: "FIDIC_2017_RED",
    amendments: "2022 Reprint Amendments & Particular Conditions Section III",
    governingLaw: "Tanzania",
    contractLanguage: "English",
    disputeForum: "DAAB",
    employer: {
      name: "Tanzania National Roads Agency (TANROADS)",
      representative: "Eng. Mohamed M. Mativila (Chief Executive)",
      organisation: "Ministry of Works and Transport, Tanzania",
      address: "P.O. Box 11364, Dar es Salaam, Tanzania",
      email: "tanroads@works.go.tz"
    },
    engineerOrPM: {
      roleTitle: "Engineer",
      name: "Dr. Angela Mwamba, PrEng CEng MICE",
      organisation: "SMEC International Pty Ltd",
      registrationNumber: "ERB PrEng 20140889 / CEng 649201",
      address: "Ali Hassan Mwinyi Road, Dar es Salaam",
      email: "angela.mwamba@smec.com"
    },
    contractor: {
      name: "Project Matrix - SinoHydro JV",
      representative: "Mr. Thabo Nkosi (Contractor's Representative)",
      organisation: "Matrix Infrastructure Holdings & SinoHydro JV",
      registrationNumber: "CRB Class 1 Foreign Civil Contractor",
      email: "contracts@matrix-infrastructure.com"
    },
    commercial: {
      contractCurrency: "TZS",
      contractValue: 142500000000,
      contractValueFormatted: "TZS 142.5 Billion (~$55.2M)",
      advancePaymentPercent: 15,
      advancePaymentAmount: 21375000000,
      advancePaymentAmortisationRate: 25,
      retentionPercent: 10,
      retentionLimitPercent: 5,
      performanceSecurityPercent: 10,
      performanceSecurityExpiryDate: "2026-08-31",
      delayDamagesPerDay: 75000000,
      delayDamagesCapPercent: 10,
      interestRateOnLatePayment: "Bank of Tanzania Discount Rate + 3.0%"
    },
    timelines: {
      commencementDate: "2024-02-01",
      timeForCompletionDays: 730,
      completionTargetDate: "2026-01-31",
      revisedCompletionDate: "2026-02-18",
      defectsNotificationPeriodDays: 365,
      latentDefectsYears: 10
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
      hasCustomZClauses: true,
      zClausesSummary: "Particular Conditions of Contract: Sub-Clause 14.1 (Currency TZS & USD split 70/30), Sub-Clause 20.2 (Standing 3-person DAAB under TIArb rules).",
      uploadedDocumentName: "TANROADS_Contract_Agreement_Particular_Conditions_2024.pdf",
      uploadedDocumentSize: "4.8 MB",
      uploadedDate: "15 Jan 2024",
      licensedDocumentUrl: "/docs/contracts/TANROADS_Particular_Conditions_2024.pdf"
    },
    status: "Active & Administered",
    lastConfiguredAt: "2026-08-19"
  },
  "proj-002": {
    id: "contract-profile-002",
    projectId: "proj-002",
    projectName: "Gauteng High-Speed Rail Corridor Expansion",
    family: "SOUTH_AFRICA",
    formName: "General Conditions of Contract (GCC)",
    edition: "3rd Edition 2015",
    suiteCode: "GCC_2015",
    amendments: "Special Conditions of Contract (SANRAL / PRASA Alignment)",
    governingLaw: "South Africa",
    contractLanguage: "English",
    disputeForum: "Adjudication",
    employer: {
      name: "Gautrain Management Agency / PRASA",
      representative: "Mr. William Dachs (CEO)",
      organisation: "Gauteng Provincial Government",
      address: "Midrand, Johannesburg, South Africa",
      email: "contracts@gma.org.za"
    },
    engineerOrPM: {
      roleTitle: "Engineer",
      name: "Bongani Cele, PrEng FSAICE",
      organisation: "WSP Group Africa",
      registrationNumber: "ECSA PrEng 20080194",
      address: "Knightsbridge Manor, Bryanston",
      email: "bongani.cele@wsp.com"
    },
    contractor: {
      name: "Matrix Rail Infrastructure Consortium",
      representative: "Johan van der Merwe",
      organisation: "Matrix Rail Africa",
      registrationNumber: "CIDB Grade 9CE",
      email: "rail-contracts@matrix.co.za"
    },
    commercial: {
      contractCurrency: "ZAR",
      contractValue: 850000000,
      contractValueFormatted: "ZAR 850.0 Million",
      advancePaymentPercent: 10,
      advancePaymentAmount: 85000000,
      advancePaymentAmortisationRate: 20,
      retentionPercent: 10,
      retentionLimitPercent: 5,
      performanceSecurityPercent: 10,
      performanceSecurityExpiryDate: "2027-03-31",
      delayDamagesPerDay: 450000,
      delayDamagesCapPercent: 10,
      interestRateOnLatePayment: "South African Reserve Bank Repo Rate + 2.0%"
    },
    timelines: {
      commencementDate: "2024-06-01",
      timeForCompletionDays: 912,
      completionTargetDate: "2026-11-30",
      defectsNotificationPeriodDays: 365,
      latentDefectsYears: 5
    },
    proceduralRules: {
      claimNoticePeriodDays: 28,
      detailedClaimSubmissionPeriodDays: 28,
      engineerDeterminationPeriodDays: 28,
      interimPaymentCertificationPeriodDays: 7,
      paymentDuePeriodDays: 28,
      rfiResponseTurnaroundDays: 7,
      submittalReviewPeriodDays: 14
    },
    particularConditions: {
      hasCustomZClauses: true,
      zClausesSummary: "GCC 2015 Special Conditions: Local content compliance 70%, B-BBEE level 1 subcontracting quota 30%.",
      uploadedDocumentName: "GMA_Rail_Special_Conditions_GCC2015.pdf",
      uploadedDocumentSize: "3.2 MB",
      uploadedDate: "01 Jun 2024"
    },
    status: "Active & Administered",
    lastConfiguredAt: "2026-08-19"
  }
};
