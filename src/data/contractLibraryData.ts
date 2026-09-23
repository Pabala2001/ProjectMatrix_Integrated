import { ContractLibraryItem, ContractTreeNode } from "../types/contractLibrary";

/**
 * CONTRACT LIBRARY TREE HIERARCHY
 * Canonical tree structure matching standard international forms:
 * - FIDIC (Red Book 1999 & 2017/2022, Yellow, Silver, Green, Gold, Emerald, White)
 * - NEC (NEC3, NEC4: ECC, ECS, PSC, PSS, TSC, TSS, FMC, Framework, Supply)
 * - SOUTH AFRICA (GCC: Editions 2015, 2010, 2004; JBCC: PBA, Minor Works, Small & Simple, Subcontracts)
 * - UK / INTERNATIONAL (JCT: Standard Building Contract, Design & Build, Minor Works, Intermediate, Management forms)
 * - CUSTOM (Employer bespoke, Uploaded contract)
 */
export const CONTRACT_LIBRARY_TREE: ContractTreeNode[] = [
  {
    id: "cat-fidic",
    title: "FIDIC",
    type: "category",
    children: [
      {
        id: "fidic-red-group",
        title: "Red Book (Construction)",
        type: "group",
        children: [
          {
            id: "fidic-red-1999",
            title: "1999 (1st Edition)",
            type: "edition",
            contractId: "fidic-red-1999"
          },
          {
            id: "fidic-red-2017",
            title: "2017 / 2022 reprint",
            type: "edition",
            contractId: "fidic-red-2017"
          }
        ]
      },
      {
        id: "fidic-yellow",
        title: "Yellow Book (Plant & Design-Build)",
        type: "contract",
        contractId: "fidic-yellow"
      },
      {
        id: "fidic-silver",
        title: "Silver Book (EPC / Turnkey)",
        type: "contract",
        contractId: "fidic-silver"
      },
      {
        id: "fidic-green",
        title: "Green Book (Short Form of Contract)",
        type: "contract",
        contractId: "fidic-green"
      },
      {
        id: "fidic-gold",
        title: "Gold Book (Design, Build & Operate)",
        type: "contract",
        contractId: "fidic-gold"
      },
      {
        id: "fidic-emerald",
        title: "Emerald Book (Underground / Tunnelling)",
        type: "contract",
        contractId: "fidic-emerald"
      },
      {
        id: "fidic-white",
        title: "White Book (Client / Consultant Services)",
        type: "contract",
        contractId: "fidic-white"
      }
    ]
  },
  {
    id: "cat-nec",
    title: "NEC",
    type: "category",
    children: [
      {
        id: "nec-nec3",
        title: "NEC3 Suite",
        type: "contract",
        contractId: "nec-nec3"
      },
      {
        id: "nec-nec4-group",
        title: "NEC4 Suite",
        type: "group",
        children: [
          {
            id: "nec4-ecc",
            title: "ECC (Engineering & Construction Contract)",
            type: "edition",
            contractId: "nec4-ecc"
          },
          {
            id: "nec4-ecs",
            title: "ECS (Engineering & Construction Subcontract)",
            type: "edition",
            contractId: "nec4-ecs"
          },
          {
            id: "nec4-psc",
            title: "PSC (Professional Services Contract)",
            type: "edition",
            contractId: "nec4-psc"
          },
          {
            id: "nec4-pss",
            title: "PSS (Professional Services Subcontract)",
            type: "edition",
            contractId: "nec4-pss"
          },
          {
            id: "nec4-tsc",
            title: "TSC (Term Service Contract)",
            type: "edition",
            contractId: "nec4-tsc"
          },
          {
            id: "nec4-tss",
            title: "TSS (Term Service Subcontract)",
            type: "edition",
            contractId: "nec4-tss"
          },
          {
            id: "nec4-fmc",
            title: "FMC (Facilities Management Contract)",
            type: "edition",
            contractId: "nec4-fmc"
          },
          {
            id: "nec4-fc",
            title: "Framework Contract",
            type: "edition",
            contractId: "nec4-fc"
          },
          {
            id: "nec4-sc",
            title: "Supply Contract",
            type: "edition",
            contractId: "nec4-sc"
          }
        ]
      }
    ]
  },
  {
    id: "cat-south-africa",
    title: "SOUTH AFRICA",
    type: "category",
    children: [
      {
        id: "sa-gcc-group",
        title: "GCC (General Conditions of Contract)",
        type: "group",
        children: [
          {
            id: "sa-gcc-2015",
            title: "GCC 2015 (3rd Edition - SAICE)",
            type: "edition",
            contractId: "sa-gcc-2015"
          },
          {
            id: "sa-gcc-2010",
            title: "GCC 2010 (2nd Edition)",
            type: "edition",
            contractId: "sa-gcc-2010"
          },
          {
            id: "sa-gcc-2004",
            title: "GCC 2004 (1st Edition)",
            type: "edition",
            contractId: "sa-gcc-2004"
          }
        ]
      },
      {
        id: "sa-jbcc-group",
        title: "JBCC (Joint Building Contracts Committee)",
        type: "group",
        children: [
          {
            id: "jbcc-pba",
            title: "Principal Building Agreement (PBA)",
            type: "edition",
            contractId: "jbcc-pba"
          },
          {
            id: "jbcc-mwa",
            title: "Minor Works Agreement (MWA)",
            type: "edition",
            contractId: "jbcc-mwa"
          },
          {
            id: "jbcc-ssw",
            title: "Small & Simple Works",
            type: "edition",
            contractId: "jbcc-ssw"
          },
          {
            id: "jbcc-subcontracts",
            title: "Subcontract Agreements (NSSA / Direct)",
            type: "edition",
            contractId: "jbcc-subcontracts"
          }
        ]
      }
    ]
  },
  {
    id: "cat-uk-international",
    title: "UK / INTERNATIONAL",
    type: "category",
    children: [
      {
        id: "jct-group",
        title: "JCT (Joint Contracts Tribunal)",
        type: "group",
        children: [
          {
            id: "jct-sbc",
            title: "Standard Building Contract (SBC)",
            type: "edition",
            contractId: "jct-sbc"
          },
          {
            id: "jct-db",
            title: "Design & Build (DB)",
            type: "edition",
            contractId: "jct-db"
          },
          {
            id: "jct-mw",
            title: "Minor Works (MW / MWD)",
            type: "edition",
            contractId: "jct-mw"
          },
          {
            id: "jct-ic",
            title: "Intermediate Building Contract (IC / ICD)",
            type: "edition",
            contractId: "jct-ic"
          },
          {
            id: "jct-mc",
            title: "Management forms (MC / CM)",
            type: "edition",
            contractId: "jct-mc"
          }
        ]
      }
    ]
  },
  {
    id: "cat-custom",
    title: "CUSTOM",
    type: "category",
    children: [
      {
        id: "custom-bespoke",
        title: "Employer bespoke contract",
        type: "contract",
        contractId: "custom-bespoke"
      },
      {
        id: "custom-uploaded",
        title: "Uploaded contract (AI Parsed & Mapped)",
        type: "contract",
        contractId: "custom-uploaded"
      }
    ]
  }
];

/**
 * CONTRACT LIBRARY DATABASE
 * Comprehensive detailed records for all contract items
 */
export const CONTRACT_LIBRARY_DATABASE: Record<string, ContractLibraryItem> = {
  // ==========================================
  // FIDIC FAMILY
  // ==========================================
  "fidic-red-1999": {
    id: "fidic-red-1999",
    family: "FIDIC",
    categoryName: "FIDIC",
    groupName: "Red Book",
    subEdition: "1999 (1st Edition)",
    code: "FIDIC_1999_RED",
    name: "FIDIC Conditions of Contract for Construction (First Edition 1999)",
    shortName: "FIDIC Red Book 1999",
    edition: "First Edition 1999 (ISBN 2-88432-022-9)",
    publisher: "Fédération Internationale des Ingénieurs-Conseils (Geneva)",
    governingBody: "FIDIC Contracts Committee",
    designResponsibility: "Employer Design",
    recommendedRegions: ["East Africa", "Southern Africa", "Middle East", "Southeast Asia", "Multilateral Dev Banks (World Bank, AfDB)"],
    corePhilosophy: "Traditional employer-designed civil engineering works measured by Bill of Quantities with Engineer acting as impartial certifier and adjudicator in first instance.",
    riskProfile: "Balanced",
    keyActors: {
      employer: "The Employer (Sub-Clause 1.1.2.2)",
      contractor: "The Contractor (Sub-Clause 1.1.2.3)",
      administrator: "The Engineer (Sub-Clause 1.1.2.4 & Clause 3 - Impartial Determinations under 3.5)",
      supervisor: "Engineer's Representative (Sub-Clause 3.2)",
      adjudicatorBoard: "Dispute Adjudication Board (DAB - Clause 20, Ad-hoc or Standing)"
    },
    keyTimelines: {
      claimNoticeWindow: "28 calendar days from awareness (Sub-Clause 20.1) - STRICT TIME BAR",
      claimSubstantiationWindow: "42 calendar days to submit fully detailed claim with contemporary records (Sub-Clause 20.1)",
      rulingWindow: "42 calendar days for Engineer Determination under Sub-Clause 3.5",
      paymentCertificationPeriod: "28 calendar days from receiving Contractor Statement (Sub-Clause 14.6)",
      paymentPeriod: "56 calendar days from receiving Statement (Sub-Clause 14.7)",
      latePaymentInterestFormula: "3% per annum above central bank discount rate, compounded monthly (Sub-Clause 14.8)",
      defectsLiabilityPeriod: "Defects Notification Period (DNP) - 365 calendar days default (Sub-Clause 1.1.3.7)",
      latentDefectsPeriod: "Governed by statutory limitation law of applicable jurisdiction (Sub-Clause 1.4)"
    },
    keyClauses: [
      {
        clauseNumber: "Sub-Clause 1.9",
        title: "Delayed Drawings or Instructions",
        topic: "delays_eot",
        summary: "Contractor must give notice when drawings or instructions are needed. If Engineer delays, Contractor is entitled to EOT and Cost + Reasonable Profit.",
        timeBarDays: 14,
        timeBarType: "calendar_days",
        contractorRightOrDuty: "Submit notice with drawing description, urgency date, and delay impact.",
        employerRightOrDuty: "Pay Cost and reasonable profit if Engineer causes delay.",
        administratorRole: "Engineer must issue instructions within reasonable time.",
        practicalGuidance: "Cross-reference technical RFIs with formal Sub-Clause 1.9 notice when 14 days lapse."
      },
      {
        clauseNumber: "Sub-Clause 4.12",
        title: "Unforeseeable Physical Conditions",
        topic: "claims_procedure",
        summary: "If Contractor encounters adverse physical conditions not foreseeable by an experienced contractor at tender date, entitled to EOT and Cost.",
        timeBarDays: 28,
        timeBarType: "calendar_days",
        contractorRightOrDuty: "Issue notice to Engineer as soon as practicable. Continue execution with proper records.",
        employerRightOrDuty: "Compensate proven additional Cost incurred.",
        administratorRole: "Engineer inspects site immediately and determines EOT and Cost under Sub-Clause 3.5.",
        practicalGuidance: "Log geotechnical borehole data, photographic evidence, and weather conditions concurrently."
      },
      {
        clauseNumber: "Sub-Clause 8.4",
        title: "Extension of Time for Completion",
        topic: "delays_eot",
        summary: "Contractor entitled to EOT for Variations, exceptionally adverse climatic conditions, unforeseeable shortages of personnel/goods, or Employer delays.",
        timeBarDays: 28,
        timeBarType: "calendar_days",
        contractorRightOrDuty: "Submit notice under Sub-Clause 20.1 within 28 days of event occurrence.",
        employerRightOrDuty: "Grant extension of time via Engineer determination.",
        administratorRole: "Engineer evaluates critical path impact and extends Completion Date.",
        practicalGuidance: "Maintain updated Primavera P6 / MS Project time-impact analysis showing critical path shifts."
      },
      {
        clauseNumber: "Sub-Clause 20.1",
        title: "Contractor's Claims",
        topic: "claims_procedure",
        summary: "Notice must be given within 28 calendar days. Failure to give notice within 28 days discharges Employer from all liability.",
        timeBarDays: 28,
        timeBarType: "calendar_days",
        contractorRightOrDuty: "Strict 28-day notice rule. Submit detailed claim within 42 days.",
        employerRightOrDuty: "Discharged from liability if Contractor misses 28-day notice time bar.",
        administratorRole: "Engineer reviews notice and responds with approval/disapproval within 42 days.",
        practicalGuidance: "CRITICAL: Never delay initial notice while waiting for financial calculations to finish."
      }
    ],
    noticeTemplates: [
      {
        id: "fidic-99-not-01",
        noticeType: "eot_claim",
        title: "Notice of Claim for Extension of Time (Sub-Clause 20.1 & 8.4)",
        clauseReference: "Sub-Clause 20.1 read with Sub-Clause 8.4",
        defaultTimeBarDays: 28,
        description: "Initial mandatory 28-day formal claim notice for delay events affecting completion.",
        sampleBody: "Pursuant to Sub-Clause 20.1 [Contractor's Claims] of the Conditions of Contract, we hereby give formal notice of our intention to claim an Extension of Time for Completion under Sub-Clause 8.4 [Extension of Time for Completion] arising from [describe event e.g. severe unseasonal flooding / delayed site access]. Contemporary records are being maintained on site and a fully detailed claim with supporting particulars will be submitted within 42 days.",
        keyRequirements: ["Specific clause citation", "Date event first became known", "Confirmation of contemporary record logging", "Notice within 28 days"]
      }
    ]
  },

  "fidic-red-2017": {
    id: "fidic-red-2017",
    family: "FIDIC",
    categoryName: "FIDIC",
    groupName: "Red Book",
    subEdition: "2017 / 2022 reprint",
    code: "FIDIC_2017_RED",
    name: "FIDIC Conditions of Contract for Construction (Second Edition 2017 / 2022 Reprint)",
    shortName: "FIDIC Red Book 2017/2022",
    edition: "Second Edition 2017 with 2022 Amendments (ISBN 978-2-88432-084-9)",
    publisher: "Fédération Internationale des Ingénieurs-Conseils (FIDIC)",
    governingBody: "FIDIC Contracts Committee (Geneva)",
    designResponsibility: "Employer Design",
    recommendedRegions: ["Global Infrastructure", "East Africa (Tanzania, Kenya, Uganda)", "Middle East (Saudi Arabia, UAE)", "Europe"],
    corePhilosophy: "Enhanced dispute avoidance with standing DAAB from project inception, reciprocal 28-day time bars for Employer & Contractor, and neutral Engineer role in Clause 3.7 determinations.",
    riskProfile: "Balanced",
    keyActors: {
      employer: "The Employer (Sub-Clause 1.1.31)",
      contractor: "The Contractor (Sub-Clause 1.1.14)",
      administrator: "The Engineer (Sub-Clause 1.1.35 & Clause 3.7 - Strictly Neutral)",
      supervisor: "Engineer's Representative (Sub-Clause 3.3)",
      adjudicatorBoard: "Dispute Avoidance/Adjudication Board (DAAB - Clause 21, Standing 1 or 3 members)"
    },
    keyTimelines: {
      claimNoticeWindow: "28 calendar days from awareness (Sub-Clause 20.2.1) - RECIPROCAL STRICT TIME BAR",
      claimSubstantiationWindow: "84 calendar days to submit Fully Detailed Claim with contractual basis (Sub-Clause 20.2.4)",
      rulingWindow: "42 calendar days for Consultation + 42 calendar days for Determination (Sub-Clause 3.7)",
      paymentCertificationPeriod: "28 calendar days from receiving Statement (Sub-Clause 14.6)",
      paymentPeriod: "56 calendar days from receiving Statement (Sub-Clause 14.7)",
      latePaymentInterestFormula: "3% per annum above central bank prime discount rate, compounded monthly (Sub-Clause 14.8)",
      defectsLiabilityPeriod: "Defects Notification Period (DNP) - 365 calendar days default (Sub-Clause 1.1.27)",
      latentDefectsPeriod: "Per statutory limitation law of governing contract law (Sub-Clause 1.4)"
    },
    keyClauses: [
      {
        clauseNumber: "Sub-Clause 1.3",
        title: "Notices and Other Communications",
        topic: "notices",
        summary: "All communications must be in writing, specifically identified as a 'Notice', citing the relevant clause, and transmitted through agreed electronic systems.",
        timeBarDays: 1,
        timeBarType: "calendar_days",
        contractorRightOrDuty: "Must explicitly head notice as 'Notice under Sub-Clause X.X'.",
        employerRightOrDuty: "Equally bound by formal notice identification rules.",
        administratorRole: "Engineer archives electronic records.",
        practicalGuidance: "Routine meeting minutes or email threads do not constitute valid legal notice."
      },
      {
        clauseNumber: "Sub-Clause 3.7",
        title: "Agreement or Determination",
        topic: "supervision",
        summary: "Engineer MUST ACT NEUTRALLY between Parties. 42 days for consultation, 42 days for determination. Notice of Dissatisfaction (NOD) within 28 days.",
        timeBarDays: 28,
        timeBarType: "calendar_days",
        contractorRightOrDuty: "May issue NOD within 28 days if dissatisfied, preserving right to DAAB referral.",
        employerRightOrDuty: "Bound by determination unless NOD issued within 28 days.",
        administratorRole: "Engineer acts as neutral professional, not agent of Employer.",
        practicalGuidance: "If no NOD is issued within 28 days, the determination becomes final and binding."
      },
      {
        clauseNumber: "Sub-Clause 20.2",
        title: "Claims For Payment and/or EOT",
        topic: "claims_procedure",
        summary: "Comprehensive reciprocal procedure. Notice within 28 days. Detailed claim within 84 days. Engineer gives initial notice if time-barred within 14 days.",
        timeBarDays: 28,
        timeBarType: "calendar_days",
        contractorRightOrDuty: "Issue Notice of Claim within 28 days. Submit Fully Detailed Claim within 84 days.",
        employerRightOrDuty: "Subject to identical 28-day notice rule for Employer claims against Contractor.",
        administratorRole: "Engineer evaluates under Sub-Clause 3.7 within 42 + 42 days.",
        practicalGuidance: "Both employer and contractor claims now expire if notice is not given in 28 days."
      }
    ],
    noticeTemplates: [
      {
        id: "fidic-17-not-01",
        noticeType: "eot_claim",
        title: "Notice of Claim (Sub-Clause 20.2.1)",
        clauseReference: "Sub-Clause 20.2.1 [Notice of Claim]",
        defaultTimeBarDays: 28,
        description: "Formal notice under 2017 Red Book triggering the 84-day substantiation window.",
        sampleBody: "NOTICE UNDER SUB-CLAUSE 20.2.1\n\nTo: The Engineer\nCopy: The Employer\n\nPursuant to Sub-Clause 20.2.1 of the Conditions of Contract, the Contractor hereby gives NOTICE OF CLAIM for an Extension of Time and/or additional Payment arising from [event description]. The event first became known on [date]. Contemporary records are being compiled under Sub-Clause 20.2.3 and a Fully Detailed Claim will be delivered within 84 days pursuant to Sub-Clause 20.2.4.",
        keyRequirements: ["Must include exact heading 'Notice of Claim'", "Cite Sub-Clause 20.2.1", "State date of awareness"]
      }
    ]
  },

  "fidic-yellow": {
    id: "fidic-yellow",
    family: "FIDIC",
    categoryName: "FIDIC",
    groupName: "Yellow Book",
    subEdition: "Plant & Design-Build",
    code: "FIDIC_YELLOW",
    name: "FIDIC Conditions of Contract for Plant and Design-Build (Yellow Book)",
    shortName: "FIDIC Yellow Book",
    edition: "Second Edition 2017 / 1999 Edition",
    publisher: "Fédération Internationale des Ingénieurs-Conseils (FIDIC)",
    governingBody: "FIDIC Contracts Committee",
    designResponsibility: "Contractor Design / EPC",
    recommendedRegions: ["Power Plants", "Water Treatment Works", "Renewable Energy", "Complex Industrial"],
    corePhilosophy: "Contractor designs and executes the works according to Employer's Requirements with Engineer administering tests on completion and functional guarantees.",
    riskProfile: "Contractor Heavy",
    keyActors: {
      employer: "The Employer",
      contractor: "The Contractor (Responsible for Design & Build)",
      administrator: "The Engineer",
      supervisor: "Engineer's Technical Specialist",
      adjudicatorBoard: "DAAB (Standing or Ad-hoc)"
    },
    keyTimelines: {
      claimNoticeWindow: "28 calendar days (Sub-Clause 20.2.1)",
      claimSubstantiationWindow: "84 calendar days (Sub-Clause 20.2.4)",
      rulingWindow: "42 + 42 calendar days under Sub-Clause 3.7",
      paymentCertificationPeriod: "28 calendar days (Sub-Clause 14.6)",
      paymentPeriod: "56 calendar days (Sub-Clause 14.7)",
      latePaymentInterestFormula: "3% above central bank discount rate",
      defectsLiabilityPeriod: "365 days + Performance Tests on Completion",
      latentDefectsPeriod: "Per statutory limitation"
    },
    keyClauses: [
      {
        clauseNumber: "Clause 5.1",
        title: "General Design Obligations",
        topic: "quality_defects",
        summary: "Contractor shall design the Works and is responsible for the design, ensuring fitness for purpose as specified in Employer's Requirements.",
        contractorRightOrDuty: "Submit design documents to Engineer for review within agreed timeframes.",
        employerRightOrDuty: "Engineer has 21 days to review; absence of comment does not relieve Contractor.",
        administratorRole: "Reviews design for compliance with Employer's Requirements.",
        practicalGuidance: "Strict fitness-for-purpose liability applies unless explicitly excluded in Particular Conditions."
      }
    ],
    noticeTemplates: []
  },

  "fidic-silver": {
    id: "fidic-silver",
    family: "FIDIC",
    categoryName: "FIDIC",
    groupName: "Silver Book",
    subEdition: "EPC / Turnkey",
    code: "FIDIC_SILVER",
    name: "FIDIC Conditions of Contract for EPC / Turnkey Projects (Silver Book)",
    shortName: "FIDIC Silver Book",
    edition: "Second Edition 2017 / 1999 Edition",
    publisher: "FIDIC",
    governingBody: "FIDIC Contracts Committee",
    designResponsibility: "Contractor Design / EPC",
    recommendedRegions: ["Private Financed Projects (PFI / PPP)", "Energy & Oil & Gas", "Mining Infrastructure", "BOT Concessions"],
    corePhilosophy: "Total certainty of final price and completion time. Contractor assumes full site condition risk, design risk, and execution risk with minimal Employer interference (no Engineer, Employer's Representative only).",
    riskProfile: "Contractor Heavy",
    keyActors: {
      employer: "The Employer",
      contractor: "The EPC Contractor (Full Turnkey Risk)",
      administrator: "Employer's Representative (Acts on behalf of Employer)",
      adjudicatorBoard: "DAAB"
    },
    keyTimelines: {
      claimNoticeWindow: "28 calendar days",
      claimSubstantiationWindow: "84 calendar days",
      rulingWindow: "42 days for Employer determination",
      paymentCertificationPeriod: "Lump sum milestone payment schedule",
      paymentPeriod: "56 calendar days",
      latePaymentInterestFormula: "3% above central bank discount rate",
      defectsLiabilityPeriod: "365 - 730 days including Performance Guarantees",
      latentDefectsPeriod: "Per governing law"
    },
    keyClauses: [
      {
        clauseNumber: "Sub-Clause 4.12",
        title: "Unforeseeable Difficulties",
        topic: "claims_procedure",
        summary: "Contractor is deemed to have obtained all necessary information and accepts total responsibility for foreseeable and unforeseeable site conditions. No EOT or Cost for subsurface conditions.",
        contractorRightOrDuty: "Bears full financial and time risk for subsurface ground conditions and physical obstacles.",
        employerRightOrDuty: "No liability for unanticipated ground conditions.",
        administratorRole: "Employer's Representative enforces turnkey contract price.",
        practicalGuidance: "Silver Book transfers ground risk entirely to Contractor; ensure geotechnical contingency in tender pricing."
      }
    ],
    noticeTemplates: []
  },

  "fidic-green": {
    id: "fidic-green",
    family: "FIDIC",
    categoryName: "FIDIC",
    groupName: "Green Book",
    subEdition: "Short Form of Contract",
    code: "FIDIC_GREEN",
    name: "FIDIC Short Form of Contract (Green Book)",
    shortName: "FIDIC Green Book",
    edition: "2nd Edition 2021 / 1st Edition 1999",
    publisher: "FIDIC",
    governingBody: "FIDIC Contracts Committee",
    designResponsibility: "Employer Design",
    recommendedRegions: ["Small & Simple Civil Works (<$10M)", "Repetitive Maintenance", "Short Duration Projects"],
    corePhilosophy: "Streamlined 15-clause contract with fast-track dispute resolution and simplified valuation for low-complexity engineering works.",
    riskProfile: "Balanced",
    keyActors: {
      employer: "The Employer",
      contractor: "The Contractor",
      administrator: "Employer's Representative",
      adjudicatorBoard: "Single Adjudicator"
    },
    keyTimelines: {
      claimNoticeWindow: "28 calendar days",
      claimSubstantiationWindow: "28 calendar days",
      rulingWindow: "28 calendar days",
      paymentCertificationPeriod: "14 calendar days",
      paymentPeriod: "28 calendar days",
      latePaymentInterestFormula: "2% above central bank rate",
      defectsLiabilityPeriod: "180 - 365 calendar days",
      latentDefectsPeriod: "Per law"
    },
    keyClauses: [],
    noticeTemplates: []
  },

  "fidic-gold": {
    id: "fidic-gold",
    family: "FIDIC",
    categoryName: "FIDIC",
    groupName: "Gold Book",
    subEdition: "Design, Build & Operate (DBO)",
    code: "FIDIC_GOLD",
    name: "FIDIC Conditions of Contract for Design, Build and Operate Projects (Gold Book)",
    shortName: "FIDIC Gold Book",
    edition: "First Edition 2008",
    publisher: "FIDIC",
    governingBody: "FIDIC Contracts Committee",
    designResponsibility: "Contractor Design / EPC",
    recommendedRegions: ["Wastewater Treatment", "Desalination Plants", "Toll Road Operations", "Waste-to-Energy"],
    corePhilosophy: "Combines 20-year long-term operation & maintenance commitments with capital EPC construction under single-point responsibility.",
    riskProfile: "Contractor Heavy",
    keyActors: {
      employer: "The Employer",
      contractor: "The DBO Contractor",
      administrator: "The Employer's Representative",
      adjudicatorBoard: "Dispute Board"
    },
    keyTimelines: {
      claimNoticeWindow: "28 days",
      claimSubstantiationWindow: "42 days",
      rulingWindow: "42 days",
      paymentCertificationPeriod: "28 days (Capital) / Monthly (O&M)",
      paymentPeriod: "56 days",
      latePaymentInterestFormula: "3% above discount rate",
      defectsLiabilityPeriod: "Operates throughout 20-year license",
      latentDefectsPeriod: "Per governing law"
    },
    keyClauses: [],
    noticeTemplates: []
  },

  "fidic-emerald": {
    id: "fidic-emerald",
    family: "FIDIC",
    categoryName: "FIDIC",
    groupName: "Emerald Book",
    subEdition: "Underground Works & Tunnelling",
    code: "FIDIC_EMERALD",
    name: "FIDIC Conditions of Contract for Underground Works (Emerald Book)",
    shortName: "FIDIC Emerald Book",
    edition: "First Edition 2019 (FIDIC & ITA-AITES Joint)",
    publisher: "FIDIC & International Tunnelling and Underground Space Association (ITA-AITES)",
    governingBody: "FIDIC / ITA-AITES Task Group",
    designResponsibility: "Design & Build (Shared)",
    recommendedRegions: ["Metro Tunnels", "Hydroelectric Underground Caverns", "Deep Sewer Interceptors", "Mining Shafts"],
    corePhilosophy: "Geotechnical Baseline Report (GBR) acts as contractually binding ground reference. Risk is allocated based on whether observed ground falls inside or outside the GBR baseline parameters.",
    riskProfile: "Balanced",
    keyActors: {
      employer: "The Employer",
      contractor: "The Tunnelling Contractor",
      administrator: "The Engineer",
      adjudicatorBoard: "Standing DAAB with underground engineering specialists"
    },
    keyTimelines: {
      claimNoticeWindow: "28 days",
      claimSubstantiationWindow: "84 days",
      rulingWindow: "42 days",
      paymentCertificationPeriod: "28 days",
      paymentPeriod: "56 days",
      latePaymentInterestFormula: "3% above prime rate",
      defectsLiabilityPeriod: "365 - 730 days",
      latentDefectsPeriod: "Per law"
    },
    keyClauses: [],
    noticeTemplates: []
  },

  "fidic-white": {
    id: "fidic-white",
    family: "FIDIC",
    categoryName: "FIDIC",
    groupName: "White Book",
    subEdition: "Client / Consultant Agreement",
    code: "FIDIC_WHITE",
    name: "FIDIC Client/Consultant Model Services Agreement (White Book)",
    shortName: "FIDIC White Book",
    edition: "Fifth Edition 2017",
    publisher: "FIDIC",
    governingBody: "FIDIC Contracts Committee",
    designResponsibility: "Professional Services / Consultancy",
    recommendedRegions: ["Feasibility Studies", "Engineering Design Services", "Construction Supervision", "Project Management"],
    corePhilosophy: "Professional duty of reasonable skill and care. Direct cap on consultant liability with clear scope boundaries and intellectual property protections.",
    riskProfile: "Balanced",
    keyActors: {
      employer: "The Client",
      contractor: "The Consultant (Engineer / Architect / PM)",
      administrator: "Client's Representative",
      adjudicatorBoard: "Adjudicator / ICC Arbitration"
    },
    keyTimelines: {
      claimNoticeWindow: "28 calendar days",
      claimSubstantiationWindow: "28 calendar days",
      rulingWindow: "28 calendar days",
      paymentCertificationPeriod: "14 calendar days",
      paymentPeriod: "28 calendar days",
      latePaymentInterestFormula: "Agreed banking prime rate",
      defectsLiabilityPeriod: "Period of professional indemnity liability",
      latentDefectsPeriod: "Per statutory limitation"
    },
    keyClauses: [],
    noticeTemplates: []
  },

  // ==========================================
  // NEC FAMILY (NEC3 & NEC4 SUITE)
  // ==========================================
  "nec-nec3": {
    id: "nec-nec3",
    family: "NEC",
    categoryName: "NEC",
    groupName: "NEC3",
    subEdition: "NEC3 Suite (2005 / April 2013 Edition)",
    code: "NEC3_SUITE",
    name: "NEC3 Engineering and Construction Contract & Family",
    shortName: "NEC3 ECC & Subcontracts",
    edition: "April 2013 Reprint",
    publisher: "Institution of Civil Engineers (ICE / Thomas Telford, UK)",
    governingBody: "NEC Drafting Committee",
    designResponsibility: "Design & Build (Shared)",
    recommendedRegions: ["South Africa (Eskom, Transnet, SANRAL)", "United Kingdom", "Hong Kong", "New Zealand"],
    corePhilosophy: "Mutual trust and co-operation (Clause 10.1). Proactive early warning risk management, dynamic Accepted Programme, and unified Compensation Events.",
    riskProfile: "Target Cost / Collaborative",
    keyActors: {
      employer: "The Employer",
      contractor: "The Contractor",
      administrator: "The Project Manager (Administers time, money, and instructions)",
      supervisor: "The Supervisor (Inspects quality and tests works)",
      adjudicatorBoard: "The Adjudicator (Appointed under Option W1 or W2)"
    },
    keyTimelines: {
      claimNoticeWindow: "8 weeks from event awareness (Clause 61.3) - STRICT TIME BAR",
      claimSubstantiationWindow: "3 weeks for Contractor quotation after PM instruction (Clause 62.3)",
      rulingWindow: "2 weeks for Project Manager quotation reply (Clause 62.3)",
      paymentCertificationPeriod: "14 calendar days from assessment date (Clause 51.1)",
      paymentPeriod: "21 calendar days / 3 weeks from assessment (Clause 51.2)",
      latePaymentInterestFormula: "0.5% per week above base rate compounded",
      defectsLiabilityPeriod: "Defects Date - typically 52 weeks after Completion",
      latentDefectsPeriod: "Per governing law limitation"
    },
    keyClauses: [
      {
        clauseNumber: "Clause 16.1",
        title: "Early Warning",
        topic: "notices",
        summary: "Contractor and Project Manager MUST give early warning notice as soon as either becomes aware of any matter which could increase prices, delay Completion, or impair performance.",
        timeBarDays: 7,
        timeBarType: "calendar_days",
        contractorRightOrDuty: "Submit early warning; failure to warn impairs subsequent compensation assessment.",
        employerRightOrDuty: "Project Manager registers item on Risk Register and calls Risk Reduction Meeting.",
        administratorRole: "PM chairs Risk Reduction Meeting to find collaborative solutions.",
        practicalGuidance: "Early warnings do not equal claims; they are non-adversarial notifications to preserve project momentum."
      },
      {
        clauseNumber: "Clause 60.1",
        title: "Compensation Events",
        topic: "claims_procedure",
        summary: "19 specific defined compensation events covering instructions, physical conditions, weather, Employer defaults, and prevention events.",
        timeBarDays: 56,
        timeBarType: "calendar_days",
        contractorRightOrDuty: "Notify within 8 weeks under Clause 61.3 or lose entitlement completely.",
        employerRightOrDuty: "Compensate Defined Cost + Fee and revise Completion Date.",
        administratorRole: "Project Manager instructs quotation within 1 week of notification.",
        practicalGuidance: "Strict 8-week time bar under Clause 61.3 bars compensation forever if missed."
      }
    ],
    noticeTemplates: []
  },

  "nec4-ecc": {
    id: "nec4-ecc",
    family: "NEC",
    categoryName: "NEC",
    groupName: "NEC4",
    subEdition: "ECC (Engineering & Construction Contract)",
    code: "NEC4_ECC",
    name: "NEC4 Engineering and Construction Contract (ECC)",
    shortName: "NEC4 ECC",
    edition: "June 2017 with October 2020 / 2023 Amendments",
    publisher: "Institution of Civil Engineers (ICE / Thomas Telford)",
    governingBody: "NEC Drafting Committee",
    designResponsibility: "Design & Build (Shared)",
    recommendedRegions: ["United Kingdom", "South Africa", "Hong Kong Infrastructure", "Australia", "Singapore"],
    corePhilosophy: "Spirit of mutual trust and co-operation (Clause 10.2). Early Warnings into Early Warning Register, deemed acceptance sanctions for PM inaction, and strict 8-week time bars.",
    riskProfile: "Target Cost / Collaborative",
    keyActors: {
      employer: "The Client (Replaces 'Employer' in NEC4)",
      contractor: "The Contractor",
      administrator: "The Project Manager",
      supervisor: "The Supervisor",
      adjudicatorBoard: "The Adjudicator / Dispute Reference Table (Option W1/W2/W3)"
    },
    keyTimelines: {
      claimNoticeWindow: "8 weeks from awareness (Clause 61.3) - TIME BARRED",
      claimSubstantiationWindow: "3 weeks for Contractor to submit quotation (Clause 62.3)",
      rulingWindow: "2 weeks for PM reply; 2 weeks reminder notice creates DEEMED ACCEPTANCE (Clause 62.6)",
      paymentCertificationPeriod: "14 calendar days from assessment date (Clause 51.1)",
      paymentPeriod: "3 weeks from assessment date (Clause 51.2)",
      latePaymentInterestFormula: "Late payment interest calculated daily at 2% above base rate",
      defectsLiabilityPeriod: "52 weeks after Completion (Defects Certificate)",
      latentDefectsPeriod: "Per governing law"
    },
    keyClauses: [
      {
        clauseNumber: "Clause 15.1",
        title: "Early Warning & Early Warning Register",
        topic: "notices",
        summary: "Parties must notify matters increasing Prices, delaying Completion, or impairing performance. PM enters into Early Warning Register and holds Early Warning Meeting within 2 weeks.",
        timeBarDays: 7,
        timeBarType: "calendar_days",
        contractorRightOrDuty: "Submit early warning immediately upon awareness.",
        employerRightOrDuty: "Client and PM attend Early Warning meetings.",
        administratorRole: "PM maintains live Early Warning Register and issues updated copy within 1 week of meeting.",
        practicalGuidance: "NEC4 replaces 'Risk Register' with 'Early Warning Register' to avoid confusion with project risk management."
      },
      {
        clauseNumber: "Clause 31.2",
        title: "The Accepted Programme",
        topic: "programme_time",
        summary: "The Contractor submits regular programmes showing critical path, float, time risk allowances, equipment, and method statements. Failure to submit allows PM to retain 25% of assessment.",
        timeBarDays: 28,
        timeBarType: "calendar_days",
        contractorRightOrDuty: "Submit revised programme every 4 weeks or as specified in Contract Data.",
        employerRightOrDuty: "PM has 2 weeks to accept or notify reasons for non-acceptance.",
        administratorRole: "Enforces 25% payment withholding if revised programme is overdue.",
        practicalGuidance: "The Accepted Programme is the vital tool for assessing all Compensation Events."
      }
    ],
    noticeTemplates: [
      {
        id: "nec4-ecc-not-01",
        noticeType: "early_warning",
        title: "Early Warning Notice (Clause 15.1)",
        clauseReference: "Clause 15.1 [Early Warning]",
        defaultTimeBarDays: 7,
        description: "Standard NEC4 proactive notice alerting Client and Project Manager to impending project risks.",
        sampleBody: "EARLY WARNING NOTICE (NEC4 Clause 15.1)\n\nTo: Project Manager\n\nPursuant to Clause 15.1 of the NEC4 ECC, the Contractor gives Early Warning of the following matter which could:\n[X] Increase the total of the Prices\n[X] Delay Completion\n[ ] Delay meeting a Key Date\n[ ] Impair the performance of the works in use\n\nDescription of matter: [Detailed explanation of issue e.g. utility clash at chainage 4+200].\nProposed proposal / mitigation: [Request joint coordination meeting with municipal water engineer].\nWe request this matter be entered into the Early Warning Register and an Early Warning Meeting convened.",
        keyRequirements: ["Check appropriate impact box", "Describe issue without formal claim posturing", "Suggest mitigation"]
      }
    ]
  },

  "nec4-ecs": {
    id: "nec4-ecs",
    family: "NEC",
    categoryName: "NEC",
    groupName: "NEC4",
    subEdition: "ECS (Engineering & Construction Subcontract)",
    code: "NEC4_ECS",
    name: "NEC4 Engineering and Construction Subcontract (ECS)",
    shortName: "NEC4 ECS",
    edition: "June 2017 / 2023",
    publisher: "ICE / Thomas Telford",
    governingBody: "NEC Drafting Committee",
    designResponsibility: "Subcontracting / Supply",
    recommendedRegions: ["Major Infrastructure Subcontracts", "M&E Subcontracts", "Earthworks Packages"],
    corePhilosophy: "Back-to-back subcontract structure reflecting the ECC, empowering Contractor and Subcontractor to collaborate with parallel compensation event timelines.",
    riskProfile: "Balanced",
    keyActors: {
      employer: "The Contractor",
      contractor: "The Subcontractor",
      administrator: "Contractor's Subcontract Manager",
      supervisor: "Subcontract Supervisor",
      adjudicatorBoard: "The Adjudicator"
    },
    keyTimelines: {
      claimNoticeWindow: "7 weeks (Clause 61.3 - 1 week shorter than ECC to allow upstream notice)",
      claimSubstantiationWindow: "3 weeks for quotation",
      rulingWindow: "2 weeks for Contractor reply",
      paymentCertificationPeriod: "14 days",
      paymentPeriod: "4 weeks",
      latePaymentInterestFormula: "2% above base rate",
      defectsLiabilityPeriod: "52 weeks",
      latentDefectsPeriod: "Per law"
    },
    keyClauses: [],
    noticeTemplates: []
  },

  "nec4-psc": {
    id: "nec4-psc",
    family: "NEC",
    categoryName: "NEC",
    groupName: "NEC4",
    subEdition: "PSC (Professional Services Contract)",
    code: "NEC4_PSC",
    name: "NEC4 Professional Services Contract (PSC)",
    shortName: "NEC4 PSC",
    edition: "June 2017 / 2023",
    publisher: "ICE / Thomas Telford",
    governingBody: "NEC Drafting Committee",
    designResponsibility: "Professional Services / Consultancy",
    recommendedRegions: ["Design Consultants", "Project Managers", "Quantity Surveyors", "Environmental Specialists"],
    corePhilosophy: "Appointment of consultants using standard NEC collaborative mechanisms: early warnings, time-risk allowances in programmes, and compensation events for brief changes.",
    riskProfile: "Balanced",
    keyActors: {
      employer: "The Client",
      contractor: "The Consultant",
      administrator: "Client's Service Manager",
      adjudicatorBoard: "Adjudicator"
    },
    keyTimelines: {
      claimNoticeWindow: "8 weeks (Clause 61.3)",
      claimSubstantiationWindow: "3 weeks",
      rulingWindow: "2 weeks",
      paymentCertificationPeriod: "14 days",
      paymentPeriod: "3 weeks",
      latePaymentInterestFormula: "2% above base rate",
      defectsLiabilityPeriod: "Professional indemnity coverage duration",
      latentDefectsPeriod: "Statutory"
    },
    keyClauses: [],
    noticeTemplates: []
  },

  "nec4-pss": {
    id: "nec4-pss",
    family: "NEC",
    categoryName: "NEC",
    groupName: "NEC4",
    subEdition: "PSS (Professional Services Subcontract)",
    code: "NEC4_PSS",
    name: "NEC4 Professional Services Subcontract (PSS)",
    shortName: "NEC4 PSS",
    edition: "June 2017 / 2023",
    publisher: "ICE / Thomas Telford",
    governingBody: "NEC Drafting Committee",
    designResponsibility: "Professional Services / Consultancy",
    recommendedRegions: ["Specialist Sub-consultancies (Geotech, Façade, Acoustic, Fire)"],
    corePhilosophy: "Back-to-back subconsultancy agreement for specialist designers appointed by lead design consultants under NEC4 PSC.",
    riskProfile: "Balanced",
    keyActors: {
      employer: "The Consultant (Lead)",
      contractor: "The Subconsultant",
      administrator: "Consultant's Representative",
      adjudicatorBoard: "Adjudicator"
    },
    keyTimelines: {
      claimNoticeWindow: "7 weeks",
      claimSubstantiationWindow: "3 weeks",
      rulingWindow: "2 weeks",
      paymentCertificationPeriod: "14 days",
      paymentPeriod: "4 weeks",
      latePaymentInterestFormula: "2% above base rate",
      defectsLiabilityPeriod: "Professional indemnity period",
      latentDefectsPeriod: "Statutory"
    },
    keyClauses: [],
    noticeTemplates: []
  },

  "nec4-tsc": {
    id: "nec4-tsc",
    family: "NEC",
    categoryName: "NEC",
    groupName: "NEC4",
    subEdition: "TSC (Term Service Contract)",
    code: "NEC4_TSC",
    name: "NEC4 Term Service Contract (TSC)",
    shortName: "NEC4 TSC",
    edition: "June 2017 / 2023",
    publisher: "ICE / Thomas Telford",
    governingBody: "NEC Drafting Committee",
    designResponsibility: "Term & Facility Maintenance",
    recommendedRegions: ["Highway Maintenance Term Contracts", "Railway Asset Maintenance", "Municipal Infrastructure Term Works"],
    corePhilosophy: "Management and execution of routine and reactive maintenance services over a multi-year term with Task Orders and performance service level metrics.",
    riskProfile: "Balanced",
    keyActors: {
      employer: "The Client",
      contractor: "The Service Provider",
      administrator: "The Service Manager",
      adjudicatorBoard: "Adjudicator"
    },
    keyTimelines: {
      claimNoticeWindow: "8 weeks",
      claimSubstantiationWindow: "3 weeks",
      rulingWindow: "2 weeks",
      paymentCertificationPeriod: "14 days",
      paymentPeriod: "3 weeks",
      latePaymentInterestFormula: "2% above base rate",
      defectsLiabilityPeriod: "Term duration + 52 weeks on individual task orders",
      latentDefectsPeriod: "Statutory"
    },
    keyClauses: [],
    noticeTemplates: []
  },

  "nec4-tss": {
    id: "nec4-tss",
    family: "NEC",
    categoryName: "NEC",
    groupName: "NEC4",
    subEdition: "TSS (Term Service Subcontract)",
    code: "NEC4_TSS",
    name: "NEC4 Term Service Subcontract (TSS)",
    shortName: "NEC4 TSS",
    edition: "June 2017 / 2023",
    publisher: "ICE / Thomas Telford",
    governingBody: "NEC Drafting Committee",
    designResponsibility: "Term & Facility Maintenance",
    recommendedRegions: ["Specialist Road Resurfacing Subcontractors", "HVAC Term Maintenance Subcontracts"],
    corePhilosophy: "Subcontracting specific specialist operational packages under a head term maintenance contract.",
    riskProfile: "Balanced",
    keyActors: {
      employer: "The Contractor",
      contractor: "The Subcontractor",
      administrator: "Contractor's Service Manager",
      adjudicatorBoard: "Adjudicator"
    },
    keyTimelines: {
      claimNoticeWindow: "7 weeks",
      claimSubstantiationWindow: "3 weeks",
      rulingWindow: "2 weeks",
      paymentCertificationPeriod: "14 days",
      paymentPeriod: "4 weeks",
      latePaymentInterestFormula: "2% above base rate",
      defectsLiabilityPeriod: "52 weeks",
      latentDefectsPeriod: "Statutory"
    },
    keyClauses: [],
    noticeTemplates: []
  },

  "nec4-fmc": {
    id: "nec4-fmc",
    family: "NEC",
    categoryName: "NEC",
    groupName: "NEC4",
    subEdition: "FMC (Facilities Management Contract)",
    code: "NEC4_FMC",
    name: "NEC4 Facilities Management Contract (FMC)",
    shortName: "NEC4 FMC",
    edition: "January 2021",
    publisher: "ICE / Thomas Telford & IWFM",
    governingBody: "NEC / Institute of Workplace and Facilities Management",
    designResponsibility: "Term & Facility Maintenance",
    recommendedRegions: ["Commercial Real Estate FM", "Hospital Estates Management", "University Campus Facilities"],
    corePhilosophy: "Specifically drafted for the FM sector (hard & soft services) incorporating Service Orders, Scope definitions, and performance benchmarking.",
    riskProfile: "Balanced",
    keyActors: {
      employer: "The Client",
      contractor: "The FM Service Provider",
      administrator: "The Service Manager",
      adjudicatorBoard: "Adjudicator"
    },
    keyTimelines: {
      claimNoticeWindow: "8 weeks",
      claimSubstantiationWindow: "3 weeks",
      rulingWindow: "2 weeks",
      paymentCertificationPeriod: "14 days",
      paymentPeriod: "3 weeks",
      latePaymentInterestFormula: "2% above base rate",
      defectsLiabilityPeriod: "Service period",
      latentDefectsPeriod: "Statutory"
    },
    keyClauses: [],
    noticeTemplates: []
  },

  "nec4-fc": {
    id: "nec4-fc",
    family: "NEC",
    categoryName: "NEC",
    groupName: "NEC4",
    subEdition: "Framework Contract",
    code: "NEC4_FC",
    name: "NEC4 Framework Contract",
    shortName: "NEC4 Framework Contract",
    edition: "June 2017 / 2023",
    publisher: "ICE / Thomas Telford",
    governingBody: "NEC Drafting Committee",
    designResponsibility: "Bespoke / Multi-Disciplinary",
    recommendedRegions: ["Public Sector Multi-Supplier Frameworks", "Infrastructure Capital Programmes"],
    corePhilosophy: "Enables clients to procure multiple contractors on a standing panel; individual projects are called off using NEC4 ECC, PSC, or TSC packages.",
    riskProfile: "Balanced",
    keyActors: {
      employer: "The Client / Framework Authority",
      contractor: "The Framework Supplier",
      administrator: "Framework Manager",
      adjudicatorBoard: "Adjudicator"
    },
    keyTimelines: {
      claimNoticeWindow: "Per call-off package contract",
      claimSubstantiationWindow: "Per call-off package",
      rulingWindow: "Per call-off package",
      paymentCertificationPeriod: "Per call-off package",
      paymentPeriod: "Per call-off package",
      latePaymentInterestFormula: "2% above base rate",
      defectsLiabilityPeriod: "Per call-off package",
      latentDefectsPeriod: "Statutory"
    },
    keyClauses: [],
    noticeTemplates: []
  },

  "nec4-sc": {
    id: "nec4-sc",
    family: "NEC",
    categoryName: "NEC",
    groupName: "NEC4",
    subEdition: "Supply Contract",
    code: "NEC4_SC",
    name: "NEC4 Supply Contract (SC)",
    shortName: "NEC4 Supply Contract",
    edition: "June 2017 / 2023",
    publisher: "ICE / Thomas Telford",
    governingBody: "NEC Drafting Committee",
    designResponsibility: "Subcontracting / Supply",
    recommendedRegions: ["Heavy Equipment Procurement", "Transformers / Switchgear Supply", "Precast Structural Elements"],
    corePhilosophy: "Procurement of high-value manufactured items, plant, and goods specifically designed or manufactured for the project.",
    riskProfile: "Balanced",
    keyActors: {
      employer: "The Purchaser",
      contractor: "The Supplier",
      administrator: "Supply Manager",
      adjudicatorBoard: "Adjudicator"
    },
    keyTimelines: {
      claimNoticeWindow: "8 weeks",
      claimSubstantiationWindow: "3 weeks",
      rulingWindow: "2 weeks",
      paymentCertificationPeriod: "14 days",
      paymentPeriod: "3 weeks",
      latePaymentInterestFormula: "2% above base rate",
      defectsLiabilityPeriod: "Delivery + Warranty Period (e.g. 24 months)",
      latentDefectsPeriod: "Statutory"
    },
    keyClauses: [],
    noticeTemplates: []
  },

  // ==========================================
  // SOUTH AFRICA: GCC & JBCC
  // ==========================================
  "sa-gcc-2015": {
    id: "sa-gcc-2015",
    family: "SOUTH_AFRICA",
    categoryName: "SOUTH AFRICA",
    groupName: "GCC",
    subEdition: "GCC 2015 (3rd Edition - SAICE)",
    code: "GCC_2015",
    name: "General Conditions of Contract for Construction Works (GCC 2015 Third Edition)",
    shortName: "GCC 2015 (SAICE)",
    edition: "Third Edition 2015 (ISBN 978-0-620-64263-7)",
    publisher: "South African Institution of Civil Engineering (SAICE)",
    governingBody: "SAICE GCC Drafting Committee",
    designResponsibility: "Employer Design",
    recommendedRegions: ["South Africa (Municipalities, SANRAL, Transnet, Water Boards)", "Namibia", "Botswana", "Lesotho", "Eswatini"],
    corePhilosophy: "South African standard for civil engineering works. Clause 5.12 extension of time and Clause 10.1 claims procedure with Employer's Agent determinations.",
    riskProfile: "Balanced",
    keyActors: {
      employer: "The Employer (Clause 1.1.1.15)",
      contractor: "The Contractor (Clause 1.1.1.9)",
      administrator: "The Employer's Agent (Clause 1.1.1.16 - Engineer / Technologist)",
      supervisor: "Employer's Agent's Representative (Clause 3.2)",
      adjudicatorBoard: "Adjudication Board (Clause 10.5 - SAICE / CIDB Panel)"
    },
    keyTimelines: {
      claimNoticeWindow: "28 calendar days from awareness (Clause 10.1.1.1) - STRICT TIME BAR",
      claimSubstantiationWindow: "28 calendar days after notice to submit monthly updated particulars (Clause 10.1.1.2)",
      rulingWindow: "28 calendar days for Employer's Agent ruling after full particulars (Clause 10.1.5)",
      paymentCertificationPeriod: "7 calendar days from receiving monthly statement (Clause 6.10.1)",
      paymentPeriod: "28 calendar days from date of Employer's Agent's certificate (Clause 6.10.4)",
      latePaymentInterestFormula: "Prime overdraft rate charged by Contractor's commercial bank, compounded monthly (Clause 6.10.6)",
      defectsLiabilityPeriod: "Defects Liability Period - 365 calendar days from Practical Completion Certificate (Clause 7.8.1)",
      latentDefectsPeriod: "5 years from date of Certificate of Completion for civil works / 10 years for structural (Clause 7.9)"
    },
    keyClauses: [
      {
        clauseNumber: "Clause 5.12",
        title: "Extension of Time for Practical Completion",
        topic: "delays_eot",
        summary: "Contractor entitled to claim EOT for abnormal climatic conditions, disruption by Employer/Agent, or other circumstances beyond reasonable control.",
        timeBarDays: 28,
        timeBarType: "calendar_days",
        contractorRightOrDuty: "Submit notice within 28 days under Clause 10.1. Prove effect on Practical Completion Date.",
        employerRightOrDuty: "Grant revised date of Practical Completion through Employer's Agent.",
        administratorRole: "Employer's Agent assesses critical path disruption using approved programme.",
        practicalGuidance: "Calculate abnormal weather using the South African Weather Bureau 10-year statistical formula."
      },
      {
        clauseNumber: "Clause 10.1",
        title: "Contractor's Claim",
        topic: "claims_procedure",
        summary: "Notice within 28 days of event. If event is ongoing, submit monthly particulars. Employer's Agent must rule within 28 days. Dissatisfaction notice within 28 days.",
        timeBarDays: 28,
        timeBarType: "calendar_days",
        contractorRightOrDuty: "Strict 28-day notice rule. Failure to submit extinguishes claim completely.",
        employerRightOrDuty: "Protected from stale claims by explicit time bar.",
        administratorRole: "Employer's Agent delivers reasoned written ruling within 28 days.",
        practicalGuidance: "Do not wait for final cost figures; issue Clause 10.1.1.1 notice within 28 days immediately."
      }
    ],
    noticeTemplates: [
      {
        id: "sa-gcc-not-01",
        noticeType: "eot_claim",
        title: "Notice of Claim (GCC Clause 10.1.1.1 read with Clause 5.12)",
        clauseReference: "Clause 10.1.1.1 & Clause 5.12",
        defaultTimeBarDays: 28,
        description: "Formal initial notice of claim under SAICE GCC 2015.",
        sampleBody: "NOTICE OF CONTRACTOR'S CLAIM (GCC 2015 Clause 10.1.1.1)\n\nTo: The Employer's Agent\nProject: [Project Name]\nContract No: [Contract Ref]\n\nPursuant to Clause 10.1.1.1 of the General Conditions of Contract for Construction Works (GCC 2015 3rd Edition), we hereby give formal notice of our intention to claim an Extension of Time for Practical Completion under Clause 5.12 and/or additional Cost under Clause 6.4/10.1.\n\nCircumstances: [Description of delay or variation event e.g. severe abnormal rainfall exceeding 10-year monthly mean].\nDate event occurred: [Date].\nIn accordance with Clause 10.1.1.2, detailed supporting particulars, daily site diaries, and revised programme analysis will be submitted within 28 days.",
        keyRequirements: ["Cite Clause 10.1.1.1", "Specify Clause 5.12 or Cost clause", "Deliver within 28 calendar days"]
      }
    ]
  },

  "sa-gcc-2010": {
    id: "sa-gcc-2010",
    family: "SOUTH_AFRICA",
    categoryName: "SOUTH AFRICA",
    groupName: "GCC",
    subEdition: "GCC 2010 (2nd Edition)",
    code: "GCC_2010",
    name: "General Conditions of Contract for Construction Works (GCC 2010 Second Edition)",
    shortName: "GCC 2010",
    edition: "Second Edition 2010",
    publisher: "SAICE",
    governingBody: "SAICE GCC Committee",
    designResponsibility: "Employer Design",
    recommendedRegions: ["South Africa Legacy Infrastructure Projects"],
    corePhilosophy: "Predecessor to GCC 2015; established the Employer's Agent role and standard South African 28-day claim mechanisms.",
    riskProfile: "Balanced",
    keyActors: {
      employer: "The Employer",
      contractor: "The Contractor",
      administrator: "The Engineer",
      adjudicatorBoard: "Adjudicator"
    },
    keyTimelines: {
      claimNoticeWindow: "28 days",
      claimSubstantiationWindow: "28 days",
      rulingWindow: "28 days",
      paymentCertificationPeriod: "7 days",
      paymentPeriod: "28 days",
      latePaymentInterestFormula: "Bank prime rate",
      defectsLiabilityPeriod: "365 days",
      latentDefectsPeriod: "5 years"
    },
    keyClauses: [],
    noticeTemplates: []
  },

  "sa-gcc-2004": {
    id: "sa-gcc-2004",
    family: "SOUTH_AFRICA",
    categoryName: "SOUTH AFRICA",
    groupName: "GCC",
    subEdition: "GCC 2004 (1st Edition)",
    code: "GCC_2004",
    name: "General Conditions of Contract for Construction Works (GCC 2004 First Edition)",
    shortName: "GCC 2004",
    edition: "First Edition 2004 (Replacing GCC 1990)",
    publisher: "SAICE",
    governingBody: "SAICE",
    designResponsibility: "Employer Design",
    recommendedRegions: ["Historical South African Civil Contracts"],
    corePhilosophy: "Initial harmonized South African civil engineering standard replacing old COLTO and SAICE 1990 forms.",
    riskProfile: "Balanced",
    keyActors: {
      employer: "The Employer",
      contractor: "The Contractor",
      administrator: "The Engineer",
      adjudicatorBoard: "Mediator / Arbitrator"
    },
    keyTimelines: {
      claimNoticeWindow: "28 days",
      claimSubstantiationWindow: "28 days",
      rulingWindow: "28 days",
      paymentCertificationPeriod: "7 days",
      paymentPeriod: "28 days",
      latePaymentInterestFormula: "Prime overdraft rate",
      defectsLiabilityPeriod: "365 days",
      latentDefectsPeriod: "5 years"
    },
    keyClauses: [],
    noticeTemplates: []
  },

  "jbcc-pba": {
    id: "jbcc-pba",
    family: "SOUTH_AFRICA",
    categoryName: "SOUTH AFRICA",
    groupName: "JBCC",
    subEdition: "Principal Building Agreement",
    code: "JBCC_PBA",
    name: "JBCC Principal Building Agreement (Edition 6.2 / Edition 4.1 Series 2000)",
    shortName: "JBCC PBA",
    edition: "Edition 6.2 May 2018 (and Edition 4.1 Series 2000)",
    publisher: "Joint Building Contracts Committee (JBCC - South Africa)",
    governingBody: "JBCC Board of Directors (ASAQS, Master Builders SA, SAIA, CESA, SAPOA)",
    designResponsibility: "Employer Design",
    recommendedRegions: ["South Africa Building Sector", "Namibia", "Botswana Commercial", "Lesotho", "Eswatini"],
    corePhilosophy: "South African standard building contract. Practical completion focus, section completions, defined revision of date for practical completion (Clause 23), and strict 20 working day notices.",
    riskProfile: "Balanced",
    keyActors: {
      employer: "The Employer",
      contractor: "The Contractor",
      administrator: "The Principal Agent (Architect / Quantity Surveyor / Project Manager - Clause 5.0)",
      supervisor: "Agents (Architect, QS, Structural/Civil/Mechanical Engineer - Clause 5.3)",
      adjudicatorBoard: "Adjudicator (AFSA / Association of Arbitrators Southern Africa)"
    },
    keyTimelines: {
      claimNoticeWindow: "20 working days from awareness (Clause 23.4.2) - STRICT TIME BAR",
      claimSubstantiationWindow: "20 working days from cessation of delay to submit quantum and particulars (Clause 23.5)",
      rulingWindow: "20 working days for Principal Agent determination (Clause 23.7)",
      paymentCertificationPeriod: "Monthly interim payment certificate (Clause 25.1)",
      paymentPeriod: "14 calendar days from issue of payment certificate (Clause 25.10)",
      latePaymentInterestFormula: "Default interest rate charged at 160% of bank prime lending rate (Clause 25.11)",
      defectsLiabilityPeriod: "Patents defects: 90 calendar days from Practical Completion Certificate (Clause 21.0)",
      latentDefectsPeriod: "5 years from date of Final Completion Certificate (Clause 22.0)"
    },
    keyClauses: [
      {
        clauseNumber: "Clause 23.0",
        title: "Revision of Date for Practical Completion",
        topic: "delays_eot",
        summary: "Clause 23.1 (events without adjustment of contract value e.g. weather) and Clause 23.2 (events with adjustment of contract value e.g. contract instructions, late information).",
        timeBarDays: 20,
        timeBarType: "working_days",
        contractorRightOrDuty: "Submit notice within 20 working days. Submit detailed claim within 20 working days of cessation.",
        employerRightOrDuty: "Principal Agent must determine within 20 working days; failure deemed refusal under 23.7.",
        administratorRole: "Principal Agent acts independently when assessing Clause 23 revision.",
        practicalGuidance: "Note JBCC uses WORKING DAYS, not calendar days. Ensure 20-working-day window is strictly monitored."
      },
      {
        clauseNumber: "Clause 17.0",
        title: "Contract Instructions",
        topic: "variations_pricing",
        summary: "Principal Agent issues written instructions. Contractor must execute within reasonable time. Oral instructions must be confirmed in writing within 5 working days.",
        timeBarDays: 5,
        timeBarType: "working_days",
        contractorRightOrDuty: "Confirm oral instructions in writing within 5 working days.",
        employerRightOrDuty: "Bound by Principal Agent's instructions and cost adjustments.",
        administratorRole: "Principal Agent values instructions under Clause 24.0.",
        practicalGuidance: "If Principal Agent does not dissent within 5 working days of written confirmation, instruction is deemed confirmed."
      }
    ],
    noticeTemplates: [
      {
        id: "jbcc-pba-not-01",
        noticeType: "eot_claim",
        title: "Notice of Delay Event (JBCC Clause 23.4.2)",
        clauseReference: "Clause 23.4.2 [Revision of Date for Practical Completion]",
        defaultTimeBarDays: 20,
        description: "Formal notice to Principal Agent within 20 working days under JBCC Edition 6.2.",
        sampleBody: "NOTICE OF DELAY UNDER CLAUSE 23.4.2 (JBCC Edition 6.2)\n\nTo: The Principal Agent\nProject: [Project Name]\n\nPursuant to Clause 23.4.2 of the JBCC Principal Building Agreement, we hereby give notice of a circumstance which has caused or is likely to cause a delay to the Date for Practical Completion.\n\nCircumstance / Event: [Description e.g. Contract Instruction No. 12 issued under Clause 17.1]\nDate circumstance arose: [Date]\nRelevant Clause: [Clause 23.1 (without cost) or Clause 23.2 (with cost adjustment)]\n\nFull details of the required revision to the Date for Practical Completion and calculation of expense/loss under Clause 23.5 will be submitted within 20 working days after the cessation of the delay.",
        keyRequirements: ["Cite Clause 23.4.2", "Deliver within 20 working days", "Distinguish Clause 23.1 vs 23.2"]
      }
    ]
  },

  "jbcc-mwa": {
    id: "jbcc-mwa",
    family: "SOUTH_AFRICA",
    categoryName: "SOUTH AFRICA",
    groupName: "JBCC",
    subEdition: "Minor Works Agreement",
    code: "JBCC_MWA",
    name: "JBCC Minor Works Agreement (Edition 5.2)",
    shortName: "JBCC MWA",
    edition: "Edition 5.2 May 2018",
    publisher: "Joint Building Contracts Committee (JBCC)",
    governingBody: "JBCC Board",
    designResponsibility: "Employer Design",
    recommendedRegions: ["Simple Building Projects", "Alterations & Additions", "Commercial Fit-outs"],
    corePhilosophy: "Simplified version of JBCC PBA designed for projects without complex subcontracting or multi-sectional handovers.",
    riskProfile: "Balanced",
    keyActors: {
      employer: "The Employer",
      contractor: "The Contractor",
      administrator: "The Principal Agent",
      adjudicatorBoard: "Adjudicator"
    },
    keyTimelines: {
      claimNoticeWindow: "20 working days",
      claimSubstantiationWindow: "10 working days",
      rulingWindow: "15 working days",
      paymentCertificationPeriod: "Monthly",
      paymentPeriod: "14 calendar days",
      latePaymentInterestFormula: "160% of bank prime rate",
      defectsLiabilityPeriod: "90 calendar days",
      latentDefectsPeriod: "5 years"
    },
    keyClauses: [],
    noticeTemplates: []
  },

  "jbcc-ssw": {
    id: "jbcc-ssw",
    family: "SOUTH_AFRICA",
    categoryName: "SOUTH AFRICA",
    groupName: "JBCC",
    subEdition: "Small & Simple Works",
    code: "JBCC_SSW",
    name: "JBCC Small & Simple Works Agreement",
    shortName: "JBCC Small & Simple Works",
    edition: "Edition 1.0 (2020)",
    publisher: "JBCC",
    governingBody: "JBCC Board",
    designResponsibility: "Employer Design",
    recommendedRegions: ["Residential Renovations", "Small Commercial Works (<R5M)"],
    corePhilosophy: "Direct agreement between owner and builder with concise plain-language terms and optional direct administration.",
    riskProfile: "Balanced",
    keyActors: {
      employer: "The Employer / Building Owner",
      contractor: "The Contractor",
      administrator: "The Employer or Appointed Representative",
      adjudicatorBoard: "Single Adjudicator"
    },
    keyTimelines: {
      claimNoticeWindow: "10 working days",
      claimSubstantiationWindow: "10 working days",
      rulingWindow: "10 working days",
      paymentCertificationPeriod: "Monthly / Milestone",
      paymentPeriod: "7 calendar days",
      latePaymentInterestFormula: "Prime lending rate",
      defectsLiabilityPeriod: "90 days",
      latentDefectsPeriod: "5 years"
    },
    keyClauses: [],
    noticeTemplates: []
  },

  "jbcc-subcontracts": {
    id: "jbcc-subcontracts",
    family: "SOUTH_AFRICA",
    categoryName: "SOUTH AFRICA",
    groupName: "JBCC",
    subEdition: "Subcontract Agreements",
    code: "JBCC_SUBCONTRACTS",
    name: "JBCC Nominated / Selected Subcontract Agreement (NSSA Edition 6.2 & Direct Subcontract)",
    shortName: "JBCC Subcontract Agreements",
    edition: "Edition 6.2 May 2018 (NSSA & DSA)",
    publisher: "Joint Building Contracts Committee (JBCC)",
    governingBody: "JBCC Board",
    designResponsibility: "Subcontracting / Supply",
    recommendedRegions: ["Electrical Subcontracts", "HVAC Subcontracts", "Lift/Elevator Packages", "Structural Steel"],
    corePhilosophy: "Back-to-back subcontract agreement aligned with JBCC PBA ensuring pass-through of claims, delay revisions, and interim payments.",
    riskProfile: "Balanced",
    keyActors: {
      employer: "The Contractor",
      contractor: "The Subcontractor (Nominated or Selected)",
      administrator: "The Principal Agent (Oversees appointment and payment)",
      adjudicatorBoard: "Adjudicator"
    },
    keyTimelines: {
      claimNoticeWindow: "15 working days (5 days shorter than PBA to enable upstream notification)",
      claimSubstantiationWindow: "15 working days",
      rulingWindow: "15 working days",
      paymentCertificationPeriod: "Monthly (Contractor pays within 7 days of receiving PBA payment)",
      paymentPeriod: "21 calendar days from valuation",
      latePaymentInterestFormula: "160% of bank prime rate",
      defectsLiabilityPeriod: "90 calendar days from Main Practical Completion",
      latentDefectsPeriod: "5 years"
    },
    keyClauses: [],
    noticeTemplates: []
  },

  // ==========================================
  // UK / INTERNATIONAL: JCT
  // ==========================================
  "jct-sbc": {
    id: "jct-sbc",
    family: "UK_INTERNATIONAL",
    categoryName: "UK / INTERNATIONAL",
    groupName: "JCT",
    subEdition: "Standard Building Contract",
    code: "JCT_SBC",
    name: "JCT Standard Building Contract (SBC 2016 / 2024 - With / Without Quantities)",
    shortName: "JCT Standard Building Contract",
    edition: "JCT 2024 Edition / 2016 Edition (SBC/Q, SBC/X, SBC/AQ)",
    publisher: "The Joint Contracts Tribunal (JCT / Sweet & Maxwell, UK)",
    governingBody: "JCT Council (RIBA, RICS, Build UK)",
    designResponsibility: "Employer Design",
    recommendedRegions: ["United Kingdom", "Ireland", "International Common Law Jurisdictions", "Commonwealth"],
    corePhilosophy: "Traditional UK standard building contract. Architect/Contract Administrator issues Relevant Events (EOT under Clause 2.28) and Relevant Matters (Loss & Expense under Clause 4.23).",
    riskProfile: "Balanced",
    keyActors: {
      employer: "The Employer",
      contractor: "The Contractor",
      administrator: "The Architect / Contract Administrator (Clause 1.1)",
      supervisor: "Quantity Surveyor (Values variations and loss/expense)",
      adjudicatorBoard: "Adjudicator (Appointed under Scheme for Construction Contracts / RICS)"
    },
    keyTimelines: {
      claimNoticeWindow: "Notice forthwith upon event becoming apparent (Clause 2.27.1 / Clause 4.23)",
      claimSubstantiationWindow: "Promptly submit initial assessment and monthly updates (Clause 2.27.2 / Clause 4.24)",
      rulingWindow: "12 weeks from receipt of required particulars (Clause 2.28.2)",
      paymentCertificationPeriod: "5 calendar days from Due Date (Interim Certificate - Clause 4.9)",
      paymentPeriod: "Final Date for Payment: 14 calendar days from Due Date (Clause 4.11)",
      latePaymentInterestFormula: "5% per annum above Bank of England official bank rate (Clause 4.11.6)",
      defectsLiabilityPeriod: "Rectification Period - 6 to 12 months from Practical Completion Certificate (Clause 2.38)",
      latentDefectsPeriod: "6 years (Under Hand) or 12 years (Executed as a Deed) under UK Limitation Act 1980"
    },
    keyClauses: [
      {
        clauseNumber: "Clause 2.27",
        title: "Notice of Delay (Relevant Events)",
        topic: "delays_eot",
        summary: "Contractor must give notice in writing forthwith whenever it becomes reasonably apparent that the progress of the Works is being or is likely to be delayed, identifying the Relevant Event.",
        timeBarDays: 14,
        timeBarType: "calendar_days",
        contractorRightOrDuty: "Give notice forthwith specifying Relevant Event, estimated delay, and critical path effect.",
        employerRightOrDuty: "Architect/CA determines extension of time under Clause 2.28 within 12 weeks.",
        administratorRole: "Architect/CA issues formal extension of time fixing revised Completion Date.",
        practicalGuidance: "Always classify whether the event is purely a Relevant Event (time only) or also a Relevant Matter (loss & expense)."
      },
      {
        clauseNumber: "Clause 4.23",
        title: "Loss and Expense (Relevant Matters)",
        topic: "claims_procedure",
        summary: "Contractor entitled to reimbursement of direct loss and/or expense incurred due to deferment of possession or execution of the Works being materially affected by Relevant Matters.",
        timeBarDays: 28,
        timeBarType: "calendar_days",
        contractorRightOrDuty: "Notify CA as soon as loss/expense becomes apparent. Submit monthly details under Clause 4.24.",
        employerRightOrDuty: "Pay ascertained direct loss and expense in interim certificates.",
        administratorRole: "Quantity Surveyor ascertains direct loss and expense.",
        practicalGuidance: "Maintain separate cost center accounting for delay overheads and plant standing time."
      }
    ],
    noticeTemplates: [
      {
        id: "jct-sbc-not-01",
        noticeType: "eot_claim",
        title: "Notice of Delay under Clause 2.27 (Relevant Event)",
        clauseReference: "Clause 2.27 [Notice of Delay]",
        defaultTimeBarDays: 14,
        description: "Formal statutory JCT delay notification specifying Relevant Events.",
        sampleBody: "NOTICE OF DELAY UNDER CLAUSE 2.27 (JCT SBC 2016/2024)\n\nTo: The Architect / Contract Administrator\nProject: [Project Title]\nContract Ref: [Contract Ref]\n\nIn accordance with Clause 2.27.1 of the JCT Standard Building Contract, we hereby give NOTICE FORTHWITH that progress of the Works is being or is likely to be delayed beyond the Completion Date.\n\nRelevant Event: [Specify clause e.g. Clause 2.29.1 Architect's instructions / Clause 2.29.2 Deferment of possession / Clause 2.29.8 Exceptionally adverse weather]\nDescription of Delay: [Detailed factual narrative].\nEstimated Delay: [X Calendar Days / Weeks].\n\nPursuant to Clause 2.27.2, we will provide details of the expected effects on the programme and an estimate of the expected extension of time required.",
        keyRequirements: ["State 'Notice forthwith under Clause 2.27'", "Identify specific Relevant Event under Clause 2.29", "Provide estimated delay in weeks"]
      }
    ]
  },

  "jct-db": {
    id: "jct-db",
    family: "UK_INTERNATIONAL",
    categoryName: "UK / INTERNATIONAL",
    groupName: "JCT",
    subEdition: "Design & Build",
    code: "JCT_DB",
    name: "JCT Design and Build Contract (DB 2016 / 2024 Edition)",
    shortName: "JCT Design & Build",
    edition: "JCT 2024 Edition / 2016 Edition",
    publisher: "The Joint Contracts Tribunal (JCT)",
    governingBody: "JCT Council",
    designResponsibility: "Contractor Design / EPC",
    recommendedRegions: ["United Kingdom Commercial & Residential", "Industrial Logistics Facilities"],
    corePhilosophy: "Single-point design and construction responsibility. Contractor produces Contractor's Proposals to meet Employer's Requirements with Employer's Agent overseeing administration.",
    riskProfile: "Contractor Heavy",
    keyActors: {
      employer: "The Employer",
      contractor: "The Design & Build Contractor",
      administrator: "The Employer's Agent (Clause 1.1)",
      adjudicatorBoard: "Adjudicator"
    },
    keyTimelines: {
      claimNoticeWindow: "Forthwith (Clause 2.24)",
      claimSubstantiationWindow: "Promptly with monthly updates",
      rulingWindow: "12 weeks (Clause 2.25)",
      paymentCertificationPeriod: "5 calendar days from Due Date (Payment Notice)",
      paymentPeriod: "14 calendar days from Due Date",
      latePaymentInterestFormula: "5% above Bank of England rate",
      defectsLiabilityPeriod: "12 months (Rectification Period)",
      latentDefectsPeriod: "6 or 12 years"
    },
    keyClauses: [],
    noticeTemplates: []
  },

  "jct-mw": {
    id: "jct-mw",
    family: "UK_INTERNATIONAL",
    categoryName: "UK / INTERNATIONAL",
    groupName: "JCT",
    subEdition: "Minor Works",
    code: "JCT_MW",
    name: "JCT Minor Works Building Contract (MW & MWD with Contractor's Design)",
    shortName: "JCT Minor Works",
    edition: "JCT 2024 Edition / 2016 Edition",
    publisher: "The Joint Contracts Tribunal (JCT)",
    governingBody: "JCT Council",
    designResponsibility: "Employer Design",
    recommendedRegions: ["Small Building Works (<£500k)", "Refurbishments & Fit-outs"],
    corePhilosophy: "Concise standard contract for simple buildings where work is measured on drawings and specification without bills of quantities.",
    riskProfile: "Balanced",
    keyActors: {
      employer: "The Employer",
      contractor: "The Contractor",
      administrator: "The Architect / Contract Administrator",
      adjudicatorBoard: "Adjudicator"
    },
    keyTimelines: {
      claimNoticeWindow: "Forthwith upon delay",
      claimSubstantiationWindow: "Promptly",
      rulingWindow: "Reasonable time",
      paymentCertificationPeriod: "Interim certificate within 14 days",
      paymentPeriod: "14 days from certificate",
      latePaymentInterestFormula: "5% above base rate",
      defectsLiabilityPeriod: "3 to 6 months",
      latentDefectsPeriod: "6 or 12 years"
    },
    keyClauses: [],
    noticeTemplates: []
  },

  "jct-ic": {
    id: "jct-ic",
    family: "UK_INTERNATIONAL",
    categoryName: "UK / INTERNATIONAL",
    groupName: "JCT",
    subEdition: "Intermediate",
    code: "JCT_IC",
    name: "JCT Intermediate Building Contract (IC / ICD with Contractor's Design)",
    shortName: "JCT Intermediate",
    edition: "JCT 2024 Edition / 2016 Edition",
    publisher: "The Joint Contracts Tribunal (JCT)",
    governingBody: "JCT Council",
    designResponsibility: "Employer Design",
    recommendedRegions: ["Medium Scale Building Works (£500k - £5M)", "Educational & Healthcare Facilities"],
    corePhilosophy: "Fills the gap between Minor Works and Standard Building Contract; includes provisions for named sub-contractors and partial contractor design.",
    riskProfile: "Balanced",
    keyActors: {
      employer: "The Employer",
      contractor: "The Contractor",
      administrator: "The Architect / Contract Administrator",
      supervisor: "Quantity Surveyor",
      adjudicatorBoard: "Adjudicator"
    },
    keyTimelines: {
      claimNoticeWindow: "Forthwith",
      claimSubstantiationWindow: "Promptly",
      rulingWindow: "12 weeks",
      paymentCertificationPeriod: "5 days from Due Date",
      paymentPeriod: "14 days from Due Date",
      latePaymentInterestFormula: "5% above base rate",
      defectsLiabilityPeriod: "6 to 12 months",
      latentDefectsPeriod: "6 or 12 years"
    },
    keyClauses: [],
    noticeTemplates: []
  },

  "jct-mc": {
    id: "jct-mc",
    family: "UK_INTERNATIONAL",
    categoryName: "UK / INTERNATIONAL",
    groupName: "JCT",
    subEdition: "Management forms",
    code: "JCT_MC",
    name: "JCT Management Building Contract (MC) & Construction Management (CM)",
    shortName: "JCT Management Forms",
    edition: "JCT 2024 Edition / 2016 Edition",
    publisher: "The Joint Contracts Tribunal (JCT)",
    governingBody: "JCT Council",
    designResponsibility: "Bespoke / Multi-Disciplinary",
    recommendedRegions: ["Fast-Track Commercial Towers", "Complex Staged Developments", "High-Value Urban Redevelopment"],
    corePhilosophy: "Management contractor manages multiple Works Contractors appointed in packages; fast-track phased construction overlaps design and site work.",
    riskProfile: "Balanced",
    keyActors: {
      employer: "The Employer",
      contractor: "The Management Contractor",
      administrator: "The Architect / CA & Quantity Surveyor",
      supervisor: "Works Package Contractors",
      adjudicatorBoard: "Adjudicator"
    },
    keyTimelines: {
      claimNoticeWindow: "Forthwith",
      claimSubstantiationWindow: "Promptly",
      rulingWindow: "12 weeks",
      paymentCertificationPeriod: "Monthly",
      paymentPeriod: "14 days",
      latePaymentInterestFormula: "5% above base rate",
      defectsLiabilityPeriod: "12 months",
      latentDefectsPeriod: "6 or 12 years"
    },
    keyClauses: [],
    noticeTemplates: []
  },

  // ==========================================
  // CUSTOM & BESPOKE CONTRACTS
  // ==========================================
  "custom-bespoke": {
    id: "custom-bespoke",
    family: "CUSTOM",
    categoryName: "CUSTOM",
    groupName: "Employer bespoke contract",
    subEdition: "Customized Hybrid / Particular Conditions (CoPA)",
    code: "CUSTOM_BESPOKE",
    name: "Employer Bespoke Construction Contract (Custom Hybrid & Particular Conditions)",
    shortName: "Employer Bespoke Contract",
    edition: "Project-Specific Custom Edition",
    publisher: "Client Legal Counsel / In-house Contracts Department",
    governingBody: "Client Legal & Commercial Directorate",
    designResponsibility: "Bespoke / Multi-Disciplinary",
    recommendedRegions: ["Government Concessions", "Mining Concessions", "Major EPC Joint Ventures", "Unique Public Entities"],
    corePhilosophy: "Tailored commercial terms with custom claim time-bars, modified dispute resolution ladders, bespoke liquidated damages caps, and specific local statutory alignments.",
    riskProfile: "Employer Heavy",
    keyActors: {
      employer: "The Employer / Client Authority",
      contractor: "The Head Contractor / Consortium",
      administrator: "Employer's Appointed Representative / Supervising Consultant",
      supervisor: "Quality & Assurance Inspectorate",
      adjudicatorBoard: "Bespoke Multi-Tier Dispute Board (Negotiation → DAB → Arbitration)"
    },
    keyTimelines: {
      claimNoticeWindow: "Configurable (e.g. 14, 21, or 28 days)",
      claimSubstantiationWindow: "Configurable (e.g. 30, 42, or 60 days)",
      rulingWindow: "Configurable (e.g. 30 or 42 days)",
      paymentCertificationPeriod: "Configurable (e.g. 14 to 30 days)",
      paymentPeriod: "Configurable (e.g. 30 to 60 days)",
      latePaymentInterestFormula: "Agreed contractual rate",
      defectsLiabilityPeriod: "Configurable (e.g. 12 to 24 months)",
      latentDefectsPeriod: "Governed by statutory prescription laws"
    },
    keyClauses: [
      {
        clauseNumber: "Custom Clause 1.0",
        title: "Order of Precedence of Contract Documents",
        topic: "general",
        summary: "Defines the binding hierarchy between Particular Conditions, General Conditions, Technical Specifications, Drawings, and Priced Bills of Quantities in case of discrepancies.",
        contractorRightOrDuty: "Must seek clarification immediately upon discovering ambiguity.",
        employerRightOrDuty: "Employer's interpretation rules in accordance with defined hierarchy.",
        administratorRole: "Issues written ruling resolving document conflicts.",
        practicalGuidance: "Particular Conditions of Contract always take precedence over General Conditions."
      },
      {
        clauseNumber: "Custom Clause 8.0",
        title: "Time-Barred Notice of Circumstance",
        topic: "claims_procedure",
        summary: "Mandatory condition precedent notice requirement: failure to issue written notice within the stipulated window forever bars any claims for time extension or cost compensation.",
        timeBarDays: 21,
        timeBarType: "calendar_days",
        contractorRightOrDuty: "Strict compliance with notice window is an absolute condition precedent.",
        employerRightOrDuty: "Discharged from all claims not submitted within window.",
        administratorRole: "Enforces strict time bars.",
        practicalGuidance: "Configure alert thresholds in Project Matrix to issue automated notice alerts 5 days prior to expiry."
      }
    ],
    noticeTemplates: [
      {
        id: "bespoke-not-01",
        noticeType: "eot_claim",
        title: "Bespoke Formal Claim Notice",
        clauseReference: "Particular Conditions Clause 8.0",
        defaultTimeBarDays: 21,
        description: "Template for project-specific bespoke claim notification.",
        sampleBody: "FORMAL NOTICE UNDER PARTICULAR CONDITIONS CLAUSE 8.0\n\nTo: Employer's Representative\nProject: [Project Name]\n\nPursuant to Clause 8.0 of the Particular Conditions of Contract, the Contractor gives formal notice of a delay event and/or cost impact arising from [brief summary of occurrence].\n\nDate event commenced: [Date]\nContractual entitlement: [Specify clauses]\nParticulars, photographic logs, and contemporary cost records are being maintained and will be delivered in accordance with the contract timetable.",
        keyRequirements: ["Match bespoke clause numbering", "Deliver within bespoke window"]
      }
    ],
    isCustom: true
  },

  "custom-uploaded": {
    id: "custom-uploaded",
    family: "CUSTOM",
    categoryName: "CUSTOM",
    groupName: "Uploaded contract",
    subEdition: "AI-Parsed & Extracted Contract Document",
    code: "CUSTOM_UPLOADED",
    name: "Uploaded Contract Document (Automated Clause Parsing & Risk Mapping)",
    shortName: "Uploaded Contract",
    edition: "Uploaded Project PDF / Word Contract Document",
    publisher: "User Uploaded & AI Extracted",
    governingBody: "Extracted from Uploaded File",
    designResponsibility: "Bespoke / Multi-Disciplinary",
    recommendedRegions: ["Any Regional Jurisdiction", "Bespoke Joint Venture Agreements", "Concession Agreements"],
    corePhilosophy: "Allows contractors and employers to upload proprietary contract documents, extracting key notice time-bars, dispute clauses, and payment conditions into Project Matrix's automated governance engine.",
    riskProfile: "Balanced",
    keyActors: {
      employer: "Extracted Employer Entity",
      contractor: "Extracted Contractor Entity",
      administrator: "Extracted Engineer / Project Manager / Architect",
      adjudicatorBoard: "Extracted Dispute Mechanism"
    },
    keyTimelines: {
      claimNoticeWindow: "Extracted from Document (Default: 28 days)",
      claimSubstantiationWindow: "Extracted from Document (Default: 42 days)",
      rulingWindow: "Extracted from Document (Default: 28 days)",
      paymentCertificationPeriod: "Extracted from Document (Default: 14 days)",
      paymentPeriod: "Extracted from Document (Default: 30 days)",
      latePaymentInterestFormula: "Extracted from Document",
      defectsLiabilityPeriod: "Extracted from Document (Default: 365 days)",
      latentDefectsPeriod: "Extracted from Document"
    },
    keyClauses: [
      {
        clauseNumber: "Uploaded Clause Extractor",
        title: "Automated Clause & Time-Bar Detection",
        topic: "claims_procedure",
        summary: "Project Matrix automatically parses uploaded contract PDFs/DOCX files, identifying all notice triggers, days allowed, time bars, liquidated damage caps, and dispute escalation stages.",
        contractorRightOrDuty: "Review and verify extracted clause mappings.",
        employerRightOrDuty: "Enforce verified contractual deadlines.",
        administratorRole: "Monitors compliance against parsed timelines.",
        practicalGuidance: "Upload your signed contract agreement and particular conditions to automatically populate project notice workflows."
      }
    ],
    noticeTemplates: [],
    isCustom: true,
    isUploaded: true,
    fileAttachment: {
      name: "Signed_Contract_Agreement_Particular_Conditions.pdf",
      size: "4.8 MB",
      uploadedAt: "19 Aug 2026",
      parsedClausesCount: 48
    }
  }
};

/**
 * Helper to retrieve all contract items
 */
export function getAllContractLibraryItems(): ContractLibraryItem[] {
  return Object.values(CONTRACT_LIBRARY_DATABASE);
}

/**
 * Helper to retrieve items by family
 */
export function getContractsByFamily(family: string): ContractLibraryItem[] {
  return Object.values(CONTRACT_LIBRARY_DATABASE).filter(c => c.family === family);
}

/**
 * Helper to search the contract library
 */
export function searchContractLibrary(query: string): ContractLibraryItem[] {
  if (!query || !query.trim()) return getAllContractLibraryItems();
  const q = query.toLowerCase().trim();
  return Object.values(CONTRACT_LIBRARY_DATABASE).filter(item => {
    return (
      item.name.toLowerCase().includes(q) ||
      item.shortName.toLowerCase().includes(q) ||
      item.code.toLowerCase().includes(q) ||
      item.groupName.toLowerCase().includes(q) ||
      item.publisher.toLowerCase().includes(q) ||
      item.categoryName.toLowerCase().includes(q) ||
      item.designResponsibility.toLowerCase().includes(q) ||
      item.recommendedRegions.some(r => r.toLowerCase().includes(q)) ||
      item.keyClauses.some(c => 
        c.clauseNumber.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q)
      )
    );
  });
}
