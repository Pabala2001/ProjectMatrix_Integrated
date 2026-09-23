export interface ContractFrameworkDetail {
  id: string;
  name: string;
  shortName: string;
  governingBody: string;
  recommendedRegions: string[];
  claimNoticeDays: number;
  paymentCertificationDays: number;
  retentionPercentDefault: number;
  advancePaymentLimitPercent: number;
  disputeResolutionMechanisms: string[];
  standardClauses: {
    extensionOfTime: string;
    unforeseenGroundConditions: string;
    forceMajeure: string;
    variationsAndAdjustments: string;
    interimPaymentCertificates: string;
    performanceSecurity: string;
  };
}

export const CONTRACT_FRAMEWORKS = [
  "FIDIC Red Book (1999 1st Edition)",
  "FIDIC Red Book (2017 / 2022 Reprint 2nd Edition)",
  "FIDIC Yellow Book (Plant & Design-Build)",
  "FIDIC Silver Book (EPC / Turnkey)",
  "FIDIC Green Book (Short Form)",
  "FIDIC Gold Book (Design, Build & Operate)",
  "FIDIC Emerald Book (Underground Works & Tunnelling)",
  "FIDIC White Book (Client / Consultant Services)",
  "NEC3 Engineering and Construction Contract",
  "NEC4 ECC (Engineering and Construction Contract)",
  "NEC4 ECS (Engineering and Construction Subcontract)",
  "NEC4 PSC (Professional Services Contract)",
  "NEC4 PSS (Professional Services Subcontract)",
  "NEC4 TSC (Term Service Contract)",
  "NEC4 TSS (Term Service Subcontract)",
  "NEC4 FMC (Facilities Management Contract)",
  "NEC4 Framework Contract",
  "NEC4 Supply Contract",
  "GCC 2015 (General Conditions of Contract 3rd Edition - SAICE)",
  "GCC 2010 (General Conditions of Contract 2nd Edition)",
  "GCC 2004 (General Conditions of Contract 1st Edition)",
  "JBCC Principal Building Agreement (Edition 6.2 / 4.1)",
  "JBCC Minor Works Agreement (Edition 5.2)",
  "JBCC Small & Simple Works Agreement",
  "JBCC Subcontract Agreements (NSSA & Direct)",
  "JCT Standard Building Contract (SBC 2016 / 2024)",
  "JCT Design and Build (DB 2016 / 2024)",
  "JCT Minor Works (MW / MWD)",
  "JCT Intermediate Building Contract (IC / ICD)",
  "JCT Management forms (MC / CM)",
  "Employer Bespoke Contract",
  "Uploaded Contract Document"
] as const;

export type ContractFramework = typeof CONTRACT_FRAMEWORKS[number] | string;

export const DEFAULT_CONTRACT_FRAMEWORK: ContractFramework = "FIDIC Red Book (2017 / 2022 Reprint 2nd Edition)";

export const CONTRACT_FRAMEWORK_DETAILS: Record<string, ContractFrameworkDetail> = {
  "fidic-red": {
    id: "fidic-red",
    name: "FIDIC Red Book (Conditions of Contract for Construction)",
    shortName: "FIDIC Red Book",
    governingBody: "FIDIC (Geneva, Switzerland)",
    recommendedRegions: ["East Africa (Tanzania, Kenya, Uganda)", "Middle East (Saudi Arabia, UAE, Qatar)", "International"],
    claimNoticeDays: 28, // Clause 20.1 / 20.2
    paymentCertificationDays: 28, // Clause 14.6
    retentionPercentDefault: 10, // Clause 14.3
    advancePaymentLimitPercent: 15,
    disputeResolutionMechanisms: ["DAAB (Dispute Avoidance/Adjudication Board)", "ICC International Arbitration"],
    standardClauses: {
      extensionOfTime: "Clause 8.4 [Extension of Time for Completion]",
      unforeseenGroundConditions: "Clause 4.12 [Unforeseeable Physical Conditions]",
      forceMajeure: "Clause 19 / Exceptional Events [Clause 18]",
      variationsAndAdjustments: "Clause 13 [Variations and Adjustments]",
      interimPaymentCertificates: "Clause 14.6 [Issue of IPC]",
      performanceSecurity: "Clause 4.2 [Performance Security]"
    }
  },
  "fidic-yellow": {
    id: "fidic-yellow",
    name: "FIDIC Yellow Book (Plant and Design-Build)",
    shortName: "FIDIC Yellow Book",
    governingBody: "FIDIC (Geneva, Switzerland)",
    recommendedRegions: ["East Africa", "Middle East", "Europe", "Asia"],
    claimNoticeDays: 28,
    paymentCertificationDays: 28,
    retentionPercentDefault: 5,
    advancePaymentLimitPercent: 15,
    disputeResolutionMechanisms: ["DAAB", "ICC International Arbitration"],
    standardClauses: {
      extensionOfTime: "Clause 8.4 [Extension of Time for Completion]",
      unforeseenGroundConditions: "Clause 4.12 [Unforeseeable Physical Conditions]",
      forceMajeure: "Clause 18 [Exceptional Events]",
      variationsAndAdjustments: "Clause 13 [Variations and Adjustments]",
      interimPaymentCertificates: "Clause 14.6 [Issue of IPC]",
      performanceSecurity: "Clause 4.2 [Performance Security]"
    }
  },
  "fidic-silver": {
    id: "fidic-silver",
    name: "FIDIC Silver Book (EPC / Turnkey Projects)",
    shortName: "FIDIC Silver Book",
    governingBody: "FIDIC (Geneva, Switzerland)",
    recommendedRegions: ["Middle East (KSA NEOM, UAE Energy)", "International Infrastructure Concessions"],
    claimNoticeDays: 28,
    paymentCertificationDays: 28,
    retentionPercentDefault: 5,
    advancePaymentLimitPercent: 10,
    disputeResolutionMechanisms: ["DAAB", "ICC International Arbitration"],
    standardClauses: {
      extensionOfTime: "Clause 8.4 [Extension of Time for Completion]",
      unforeseenGroundConditions: "Clause 5.1 [Contractor's Responsibility for Site Data]",
      forceMajeure: "Clause 18 [Exceptional Events]",
      variationsAndAdjustments: "Clause 13 [Variations and Adjustments]",
      interimPaymentCertificates: "Clause 14.6 [Issue of IPC]",
      performanceSecurity: "Clause 4.2 [Performance Security]"
    }
  },
  "nec4": {
    id: "nec4",
    name: "NEC4 Engineering and Construction Contract (ECC)",
    shortName: "NEC4 ECC",
    governingBody: "Institution of Civil Engineers (ICE, UK)",
    recommendedRegions: ["South Africa", "United Kingdom", "Hong Kong", "Australia"],
    claimNoticeDays: 56, // 8 weeks compensation event early warning
    paymentCertificationDays: 14,
    retentionPercentDefault: 5,
    advancePaymentLimitPercent: 10,
    disputeResolutionMechanisms: ["Adjudication", "Tribunal Arbitration"],
    standardClauses: {
      extensionOfTime: "Clause 60-65 [Compensation Events]",
      unforeseenGroundConditions: "Clause 60.1(12) [Physical Conditions]",
      forceMajeure: "Clause 60.1(19) [Prevention Event]",
      variationsAndAdjustments: "Clause 60.1(1) [Project Manager Instructions]",
      interimPaymentCertificates: "Clause 51 [Payment Assessment]",
      performanceSecurity: "Option X13 [Performance Bond]"
    }
  },
  "jbcc": {
    id: "jbcc",
    name: "JBCC Principal Building Agreement (Edition 6.2)",
    shortName: "JBCC PBA",
    governingBody: "Joint Building Contracts Committee (South Africa)",
    recommendedRegions: ["South Africa", "Namibia", "Botswana", "Lesotho", "Eswatini"],
    claimNoticeDays: 20,
    paymentCertificationDays: 14,
    retentionPercentDefault: 10,
    advancePaymentLimitPercent: 10,
    disputeResolutionMechanisms: ["Mediation", "Adjudication", "Arbitration (AFSA)"],
    standardClauses: {
      extensionOfTime: "Clause 23.0 [Revision of Date for Practical Completion]",
      unforeseenGroundConditions: "Clause 23.2 [Unforeseen Physical Conditions]",
      forceMajeure: "Clause 23.1 [Force Majeure / Vis Major]",
      variationsAndAdjustments: "Clause 17.0 [Contract Instructions]",
      interimPaymentCertificates: "Clause 25.0 [Payment]",
      performanceSecurity: "Clause 11.0 [Securities]"
    }
  },
  "gcc": {
    id: "gcc",
    name: "General Conditions of Contract for Construction Works (GCC 2015/2018)",
    shortName: "GCC 2015",
    governingBody: "SAICE (South Africa)",
    recommendedRegions: ["South Africa Municipal & Provincial Infrastructure"],
    claimNoticeDays: 28,
    paymentCertificationDays: 28,
    retentionPercentDefault: 10,
    advancePaymentLimitPercent: 10,
    disputeResolutionMechanisms: ["Amicable Settlement", "Adjudication", "Arbitration"],
    standardClauses: {
      extensionOfTime: "Clause 5.12 [Extension of Time for Practical Completion]",
      unforeseenGroundConditions: "Clause 4.7 [Adverse Physical Conditions]",
      forceMajeure: "Clause 8.3 [Special Risks]",
      variationsAndAdjustments: "Clause 6.4 [Variations]",
      interimPaymentCertificates: "Clause 6.10 [Payment Certificates]",
      performanceSecurity: "Clause 3.2 [Security]"
    }
  }
};
