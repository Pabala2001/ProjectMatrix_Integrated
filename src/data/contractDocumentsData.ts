import { ContractDocumentItem, EffectiveContractSynthesis } from "../types/contractDocuments";

/**
 * Standard Order of Precedence in International Construction Contracts (e.g. FIDIC 2017 Sub-Clause 1.5, NEC4 Clause 12.4)
 */
export const STANDARD_ORDER_OF_PRECEDENCE = [
  { rank: 1, category: "FORM_OF_AGREEMENT" as const, title: "Contract Agreement", clauseRef: "Sub-Clause 1.5(a)" },
  { rank: 2, category: "LETTER_OF_ACCEPTANCE" as const, title: "Letter of Acceptance / Award", clauseRef: "Sub-Clause 1.5(b)" },
  { rank: 3, category: "TENDER_OFFER" as const, title: "Letter of Tender & Appendices", clauseRef: "Sub-Clause 1.5(c)" },
  { rank: 4, category: "PARTICULAR_CONDITIONS" as const, title: "Particular Conditions (Part A & B)", clauseRef: "Sub-Clause 1.5(d)" },
  { rank: 5, category: "GENERAL_CONDITIONS" as const, title: "General Conditions (Base Standard)", clauseRef: "Sub-Clause 1.5(e)" },
  { rank: 6, category: "EMPLOYER_REQUIREMENTS" as const, title: "Employer's Requirements / Scope", clauseRef: "Sub-Clause 1.5(f)" },
  { rank: 7, category: "SPECIFICATIONS" as const, title: "Technical Specifications", clauseRef: "Sub-Clause 1.5(g)" },
  { rank: 8, category: "DRAWINGS" as const, title: "Drawings & BIM Models", clauseRef: "Sub-Clause 1.5(h)" },
  { rank: 9, category: "BOQ" as const, title: "Priced Bill of Quantities / Schedules", clauseRef: "Sub-Clause 1.5(i)" },
  { rank: 10, category: "ADDENDA" as const, title: "Tender Addenda & Supplementary Agreements", clauseRef: "Sub-Clause 1.5(j)" },
];

/**
 * Sample multi-tier Contract Documents with complete version control history
 */
export const INITIAL_PROJECT_CONTRACT_DOCUMENTS: Record<string, ContractDocumentItem[]> = {
  "proj-02": [
    {
      id: "doc-agr-001",
      projectId: "proj-02",
      category: "FORM_OF_AGREEMENT",
      title: "Contract Form of Agreement",
      referenceCode: "TR-HWAY-AGR-01",
      description: "Formal legally binding Contract Agreement executed between TANROADS and Project Matrix JV.",
      precedenceRank: 1,
      isMandatory: true,
      governingLawRef: "Laws of Tanzania (Law of Contract Act Cap 333)",
      tags: ["Agreement", "Execution", "Priority-1", "Executed"],
      lastModified: "2024-01-20",
      currentVersion: {
        id: "ver-agr-10",
        documentId: "doc-agr-001",
        versionTag: "Rev 1.0 (Executed Baseline)",
        revisionNumber: 1,
        effectiveDate: "2024-01-20",
        uploadedAt: "2024-01-21T09:30:00Z",
        uploadedBy: "Eng. M. Kishimbo (TANROADS Legal)",
        status: "Active (Effective)",
        changeSummary: "Executed original baseline contract agreement incorporating all negotiated covenants.",
        signatoryEmployerRepresentative: "Eng. Rogatus Mativila (CEO, TANROADS)",
        signatoryContractorRepresentative: "Dr. A. Mwamba (Managing Director, JV)",
        fileMetadata: {
          fileName: "TANROADS_Highway_Form_of_Agreement_Signed.pdf",
          fileSize: "4.8 MB",
          fileType: "PDF",
          hashChecksum: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          pagesCount: 14,
        },
        clauseOverrides: []
      },
      versionHistory: [
        {
          id: "ver-agr-01",
          documentId: "doc-agr-001",
          versionTag: "Rev 0.1 (Tender Draft)",
          revisionNumber: 0,
          effectiveDate: "2023-11-10",
          uploadedAt: "2023-11-10T14:15:00Z",
          uploadedBy: "Procurement Committee",
          status: "Superseded",
          changeSummary: "Initial unexecuted draft agreement issued in tender dossier.",
          fileMetadata: {
            fileName: "Draft_Form_of_Agreement_Tender.docx",
            fileSize: "1.2 MB",
            fileType: "DOCX",
            hashChecksum: "7d793037a0760186574b0282f2f435e70d7168e07295a94b1ee6046e516149b1",
            pagesCount: 12
          },
          clauseOverrides: []
        }
      ]
    },

    {
      id: "doc-loa-001",
      projectId: "proj-02",
      category: "LETTER_OF_ACCEPTANCE",
      title: "Letter of Acceptance & Award Notification",
      referenceCode: "LOA-TANROADS-2024-008",
      description: "Formal Letter of Acceptance confirming contract award sum of TZS 124.5 Billion.",
      precedenceRank: 2,
      isMandatory: true,
      tags: ["LOA", "Award", "Commercial-Baseline"],
      lastModified: "2024-01-10",
      currentVersion: {
        id: "ver-loa-10",
        documentId: "doc-loa-001",
        versionTag: "Rev 1.0 (Official Award)",
        revisionNumber: 1,
        effectiveDate: "2024-01-10",
        uploadedAt: "2024-01-10T11:00:00Z",
        uploadedBy: "Procurement Director (TANROADS)",
        status: "Active (Effective)",
        changeSummary: "Formal award notification setting out accepted contract amount and 28-day performance bond deadline.",
        signatoryEmployerRepresentative: "Eng. R. Mativila",
        signatoryContractorRepresentative: "Dr. A. Mwamba",
        fileMetadata: {
          fileName: "TANROADS_Official_Letter_of_Acceptance.pdf",
          fileSize: "2.1 MB",
          fileType: "PDF",
          hashChecksum: "ca978112ca1bbdcafac231b39a23dc4da78608144160671a2a35cb9b7a5ed797",
          pagesCount: 6
        },
        clauseOverrides: []
      },
      versionHistory: []
    },

    {
      id: "doc-pc-001",
      projectId: "proj-02",
      category: "PARTICULAR_CONDITIONS",
      title: "Particular Conditions of Contract (Part A & B)",
      referenceCode: "PC-TANROADS-2024-SPEC",
      description: "Project Particular Conditions: Part A (Contract Data) & Part B (Special Provisions & Statutory Z Clauses).",
      precedenceRank: 4,
      isMandatory: true,
      governingLawRef: "Tanzania Public Procurement Act 2023 & Regulations",
      tags: ["ParticularConditions", "SpecialProvisions", "TimeBars", "Precedence-4"],
      lastModified: "2025-06-15",
      currentVersion: {
        id: "ver-pc-20",
        documentId: "doc-pc-001",
        versionTag: "Rev 2.0 (Amended via Addendum #3)",
        revisionNumber: 2,
        effectiveDate: "2024-06-15",
        uploadedAt: "2024-06-16T16:20:00Z",
        uploadedBy: "Eng. P. Ndejembi (Resident Engineer)",
        status: "Active (Effective)",
        supersedesVersionId: "ver-pc-10",
        changeSummary: "Amended Sub-Clause 20.2.1 shortening claim notice window to 14 days; revised Sub-Clause 14.7 payment timeline to 60 days; updated Sub-Clause 4.12 unforeseen physical conditions threshold.",
        signatoryEmployerRepresentative: "Eng. R. Mativila",
        signatoryContractorRepresentative: "Dr. A. Mwamba",
        fileMetadata: {
          fileName: "Particular_Conditions_Part_A_and_B_Rev2.0.pdf",
          fileSize: "8.4 MB",
          fileType: "PDF",
          hashChecksum: "185f8db32271fe25f561a6fc938b2e264306ec304eda518007d1764826381969",
          pagesCount: 68
        },
        clauseOverrides: [
          {
            id: "cov-01",
            targetClauseNumber: "20.2.1",
            clauseTitle: "Notice of Claim - Time Bar",
            modificationType: "MODIFIED",
            originalBaseSummary: "Contractor must submit Notice of Claim within 28 days of becoming aware of the event.",
            amendedTextSummary: "Particular Condition Sub-Clause 20.2.1: The Contractor SHALL give Notice of Claim within FOURTEEN (14) calendar days of becoming aware of the event, with an immediate simultaneous copy sent to the Employer's Regional Office. Failure to submit within 14 days constitutes an absolute bar.",
            operationalImpact: "Claims window is HALVED from 28 to 14 days. ProjectMatrix automated alerting must trigger at Day 7.",
            timeBarStrictness: "STRICT_TIME_BAR",
            parameterOverrides: {
              deadlineDays: 14,
              deadlineUnit: "calendar_days"
            }
          },
          {
            id: "cov-02",
            targetClauseNumber: "14.7",
            clauseTitle: "Payment Periods & Financing Charges",
            modificationType: "MODIFIED",
            originalBaseSummary: "Employer shall pay the amount certified within 56 days after receiving the Statement and supporting documents.",
            amendedTextSummary: "Particular Condition Sub-Clause 14.7: Payment of Interim Payment Certificates shall be made within 60 calendar days of Engineer's certification. Financing charges for late payment are calculated at Bank of Tanzania Discount Rate + 2.5% per annum.",
            operationalImpact: "Cashflow forecast adjusted to 60-day payment cycle rather than default 56 days.",
            parameterOverrides: {
              paymentDueDays: 60
            }
          },
          {
            id: "cov-03",
            targetClauseNumber: "4.12",
            clauseTitle: "Unforeseeable Physical Conditions",
            modificationType: "MODIFIED",
            originalBaseSummary: "Contractor entitled to Extension of Time and Cost incurred due to unforeseeable physical conditions.",
            amendedTextSummary: "Particular Condition Sub-Clause 4.12: Contractor is entitled to Extension of Time (EOT). However, direct cost recovery is subject to a 5% deductible threshold on unforeseen subsurface rock excavation not disclosed in the Geotechnical Baseline Report (GBR).",
            operationalImpact: "Cost claim requires proving geotechnical conditions deviated from the contract GBR beyond 5% variance.",
            timeBarStrictness: "CONDITIONAL_BAR"
          },
          {
            id: "cov-04",
            targetClauseNumber: "3.7.3",
            clauseTitle: "Engineer's Agreement or Determination Time Limit",
            modificationType: "MODIFIED",
            originalBaseSummary: "Engineer must give notice of agreement or determination within 42 days.",
            amendedTextSummary: "Particular Condition Sub-Clause 3.7.3: Engineer shall issue determination within 30 calendar days of receiving full particulars. If Engineer fails to respond within 30 days, claim is deemed referred directly to DAAB.",
            operationalImpact: "Determination turnaround expedited from 42 to 30 days for faster dispute prevention.",
            parameterOverrides: {
              engineerDeterminationDays: 30
            }
          }
        ]
      },
      versionHistory: [
        {
          id: "ver-pc-10",
          documentId: "doc-pc-001",
          versionTag: "Rev 1.0 (Contract Execution Issue)",
          revisionNumber: 1,
          effectiveDate: "2024-01-20",
          uploadedAt: "2024-01-21T09:45:00Z",
          uploadedBy: "Legal Directorate",
          status: "Superseded",
          changeSummary: "Original Particular Conditions as executed at contract signing (28-day notice rule prior to Addendum #3 amendment).",
          fileMetadata: {
            fileName: "Particular_Conditions_Part_A_and_B_Rev1.0.pdf",
            fileSize: "7.9 MB",
            fileType: "PDF",
            hashChecksum: "3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855b",
            pagesCount: 64
          },
          clauseOverrides: [
            {
              id: "cov-prev-01",
              targetClauseNumber: "14.7",
              clauseTitle: "Payment Periods",
              modificationType: "MODIFIED",
              originalBaseSummary: "56 days payment",
              amendedTextSummary: "56 days payment from IPC receipt",
              operationalImpact: "Standard 56 days"
            }
          ]
        }
      ]
    },

    {
      id: "doc-gc-001",
      projectId: "proj-02",
      category: "GENERAL_CONDITIONS",
      title: "FIDIC Conditions of Contract for Construction (Red Book)",
      referenceCode: "FIDIC-RED-2017-REP2022",
      description: "Base Standard: International Federation of Consulting Engineers (FIDIC) Red Book 2017 Edition (with 2022 Reprint Amendments).",
      precedenceRank: 5,
      isMandatory: true,
      tags: ["BaseStandard", "FIDIC", "GeneralConditions", "Precedence-5"],
      lastModified: "2022-11-01",
      currentVersion: {
        id: "ver-gc-10",
        documentId: "doc-gc-001",
        versionTag: "2017 Edition (2022 Reprint)",
        revisionNumber: 1,
        effectiveDate: "2022-11-01",
        uploadedAt: "2024-01-05T08:00:00Z",
        uploadedBy: "System Administrator",
        status: "Active (Effective)",
        changeSummary: "Official FIDIC 2017 Red Book base standard text with 2022 formal errata/reprint corrections.",
        fileMetadata: {
          fileName: "FIDIC_Red_Book_2017_Reprint_2022_Metadata.pdf",
          fileSize: "12.6 MB",
          fileType: "PDF",
          hashChecksum: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
          pagesCount: 220
        },
        clauseOverrides: []
      },
      versionHistory: []
    },

    {
      id: "doc-spec-001",
      projectId: "proj-02",
      category: "SPECIFICATIONS",
      title: "Standard & Project Technical Specifications (Vols I–IV)",
      referenceCode: "SPEC-TANROADS-HWAY-2024",
      description: "Standard Specifications for Highway Construction (MoW 2000) & Particular Technical Specifications for Arterial Dualling.",
      precedenceRank: 7,
      isMandatory: true,
      tags: ["TechnicalSpecs", "Quality", "Materials", "Precedence-7"],
      lastModified: "2024-04-12",
      currentVersion: {
        id: "ver-spec-21",
        documentId: "doc-spec-001",
        versionTag: "Rev 2.1 (Modified Concrete C35/40 Mix Spec)",
        revisionNumber: 2,
        effectiveDate: "2024-04-12",
        uploadedAt: "2024-04-13T10:15:00Z",
        uploadedBy: "Materials Engineer (Consultant)",
        status: "Active (Effective)",
        changeSummary: "Updated Section 4200: Concrete Mix design criteria to include pozzolanic blended cement for high sulfate soil zones.",
        fileMetadata: {
          fileName: "Technical_Specifications_Highway_Dualling_Rev2.1.pdf",
          fileSize: "18.2 MB",
          fileType: "PDF",
          hashChecksum: "2c624232cdd221771294dfbb310aca000a0df6ec9b5feb9ebb95ab431114e059",
          pagesCount: 340
        },
        clauseOverrides: []
      },
      versionHistory: [
        {
          id: "ver-spec-10",
          documentId: "doc-spec-001",
          versionTag: "Rev 1.0 (Tender Issue)",
          revisionNumber: 1,
          effectiveDate: "2023-10-01",
          uploadedAt: "2023-10-02T11:00:00Z",
          uploadedBy: "Design Team",
          status: "Superseded",
          changeSummary: "Original tender technical specifications.",
          fileMetadata: {
            fileName: "Technical_Specifications_Highway_Dualling_Rev1.0.pdf",
            fileSize: "17.9 MB",
            fileType: "PDF",
            hashChecksum: "8a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef",
            pagesCount: 328
          },
          clauseOverrides: []
        }
      ]
    },

    {
      id: "doc-dwg-001",
      projectId: "proj-02",
      category: "DRAWINGS",
      title: "Issued for Construction (IFC) Drawings Register",
      referenceCode: "DWG-PKG02-IFC-VOL1-8",
      description: "Complete Issued for Construction (IFC) structural, geometric, drainage, and pavement engineering drawings.",
      precedenceRank: 8,
      isMandatory: true,
      tags: ["Drawings", "IFC", "Geometric", "Structural", "Precedence-8"],
      lastModified: "2024-08-01",
      currentVersion: {
        id: "ver-dwg-30",
        documentId: "doc-dwg-001",
        versionTag: "Rev 3.0 (Bridge Abutment Realignment IFC)",
        revisionNumber: 3,
        effectiveDate: "2024-08-01",
        uploadedAt: "2024-08-02T14:40:00Z",
        uploadedBy: "Chief Bridge Engineer",
        status: "Active (Effective)",
        changeSummary: "Realignment of Bridge #2 East Abutment piles following geotechnical boreholes BH-12 and BH-14 karst cavity discovery.",
        fileMetadata: {
          fileName: "IFC_Drawings_Highway_Package_02_Rev3.0.pdf",
          fileSize: "94.5 MB",
          fileType: "PDF",
          hashChecksum: "3f79bb7b435b0532145166de21f50a3244e693b4f62bfd04581977b3b72ea98c",
          pagesCount: 185
        },
        clauseOverrides: []
      },
      versionHistory: []
    },

    {
      id: "doc-boq-001",
      projectId: "proj-02",
      category: "BOQ",
      title: "Priced Bill of Quantities (BOQ Sections 1–8)",
      referenceCode: "BOQ-TANROADS-DUALLING-2024",
      description: "Contract Bill of Quantities with item rates, provisional sums, and daywork schedules.",
      precedenceRank: 9,
      isMandatory: true,
      tags: ["BOQ", "Commercial", "Rates", "Precedence-9"],
      lastModified: "2024-02-15",
      currentVersion: {
        id: "ver-boq-12",
        documentId: "doc-boq-001",
        versionTag: "Rev 1.2 (Post-Tender Arithmetical Correction)",
        revisionNumber: 1,
        effectiveDate: "2024-02-15",
        uploadedAt: "2024-02-16T12:00:00Z",
        uploadedBy: "Chief Quantity Surveyor",
        status: "Active (Effective)",
        changeSummary: "Corrected Section 3 (Earthworks) arithmetical summation agreed in Memorandum of Negotiations.",
        signatoryEmployerRepresentative: "Eng. R. Mativila",
        signatoryContractorRepresentative: "Dr. A. Mwamba",
        fileMetadata: {
          fileName: "Priced_BOQ_Final_Contract_Baseline_Rev1.2.xlsx",
          fileSize: "14.2 MB",
          fileType: "XLSX",
          hashChecksum: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918",
          pagesCount: 142
        },
        clauseOverrides: []
      },
      versionHistory: []
    },

    {
      id: "doc-add-001",
      projectId: "proj-02",
      category: "ADDENDA",
      title: "Tender Addenda No. 1, 2, 3 & Supplementary Agreement No. 1",
      referenceCode: "ADD-SUPP-AGR-01",
      description: "Formal contract addenda and Supplementary Agreement No. 1 executed during post-award mobilization.",
      precedenceRank: 10,
      isMandatory: false,
      tags: ["Addenda", "SupplementaryAgreement", "Precedence-10"],
      lastModified: "2024-06-20",
      currentVersion: {
        id: "ver-add-10",
        documentId: "doc-add-001",
        versionTag: "Rev 1.0 (Executed Supplementary Agreement)",
        revisionNumber: 1,
        effectiveDate: "2024-06-20",
        uploadedAt: "2024-06-21T15:00:00Z",
        uploadedBy: "Legal Directorate (TANROADS)",
        status: "Active (Effective)",
        changeSummary: "Executed Supplementary Agreement No. 1 formally incorporating Particular Conditions Rev 2.0 and advance payment disbursement milestone.",
        signatoryEmployerRepresentative: "Eng. R. Mativila",
        signatoryContractorRepresentative: "Dr. A. Mwamba",
        fileMetadata: {
          fileName: "Supplementary_Agreement_No_01_Signed.pdf",
          fileSize: "3.4 MB",
          fileType: "PDF",
          hashChecksum: "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a",
          pagesCount: 8
        },
        clauseOverrides: []
      },
      versionHistory: []
    }
  ]
};
