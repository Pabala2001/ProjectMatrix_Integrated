/**
 * Comprehensive Contract Standards Reference Library
 * Covering standard contract forms:
 * - FIDIC 2017 Red Book (2nd Edition) & FIDIC 1999 Red Book (1st Edition)
 * - NEC4 Engineering and Construction Contract (June 2017) & NEC3 ECS Subcontract
 * - SAICE General Conditions of Contract (GCC 2015 3rd Edition) & Guide
 * - JBCC Principal Building Agreement (Edition 6.2 May 2018 & Edition 4.1 Series 2000)
 */

export interface ContractClauseReference {
  clauseNumber: string;
  title: string;
  topic: 
    | "general" 
    | "notices" 
    | "supervision" 
    | "programme_time" 
    | "delays_eot" 
    | "quality_defects" 
    | "variations_pricing" 
    | "payment_certificates" 
    | "securities_guarantees" 
    | "risk_insurance" 
    | "suspension_termination" 
    | "claims_procedure" 
    | "dispute_resolution";
  summary: string;
  timeBarDays?: number;
  timeBarType?: "calendar_days" | "working_days" | "weeks";
  contractorRightOrDuty: string;
  employerRightOrDuty: string;
  engineerRole: string;
  practicalGuidance: string;
  relevantForms?: string[];
}

export interface ContractStandardSuite {
  id: string;
  code: "FIDIC_2017_RED" | "FIDIC_1999_RED" | "NEC4_ECC" | "NEC3_ECS" | "GCC_2015" | "JBCC_6_2" | "JBCC_4_1";
  name: string;
  shortName: string;
  edition: string;
  publisher: string;
  governingBody: string;
  applicableLawContext: string;
  corePhilosophy: string;
  keyActors: {
    employer: string;
    contractor: string;
    administrator: string; // Engineer / Project Manager / Employer's Agent / Principal Agent
    supervisor?: string;
    adjudicatorBoard: string; // DAAB / DAB / Adjudicator
  };
  keyTimelines: {
    claimNoticeWindow: string;
    claimSubstantiationWindow: string;
    rulingWindow: string;
    paymentCertificationPeriod: string;
    paymentPeriod: string;
    latePaymentInterestFormula: string;
    defectsLiabilityPeriod: string;
    latentDefectsPeriod: string;
  };
  clauses: ContractClauseReference[];
}

export const CONTRACT_STANDARDS_DATABASE: Record<string, ContractStandardSuite> = {
  "FIDIC_2017_RED": {
    id: "fidic-2017-red",
    code: "FIDIC_2017_RED",
    name: "FIDIC Conditions of Contract for Construction (Second Edition 2017 - Red Book)",
    shortName: "FIDIC Red Book 2017",
    edition: "Second Edition 2017 (ISBN 978-2-88432-084-9)",
    publisher: "Fédération Internationale des Ingénieurs-Conseils (FIDIC)",
    governingBody: "FIDIC Contracts Committee (Geneva, Switzerland)",
    applicableLawContext: "International & Cross-Border Civil/Infrastructure Projects (Common & Civil Law Compatible)",
    corePhilosophy: "Balanced risk sharing with enhanced dispute avoidance (standing DAAB), strict reciprocal 28-day claim time-bars for both Employer and Contractor, and clear Engineer determination neutrality.",
    keyActors: {
      employer: "The Employer (Sub-Clause 1.1.31)",
      contractor: "The Contractor (Sub-Clause 1.1.14)",
      administrator: "The Engineer (Sub-Clause 1.1.35 & Clause 3 - must act neutrally under Sub-Clause 3.7)",
      supervisor: "Engineer's Representative (Sub-Clause 3.3) & Delegated Assistants (Sub-Clause 3.4)",
      adjudicatorBoard: "Dispute Avoidance/Adjudication Board (DAAB - Clause 21, standing 1 or 3 members)"
    },
    keyTimelines: {
      claimNoticeWindow: "28 calendar days from awareness (Sub-Clause 20.2.1) - STRICT TIME BAR",
      claimSubstantiationWindow: "84 calendar days from awareness to submit Fully Detailed Claim (Sub-Clause 20.2.4)",
      rulingWindow: "42 calendar days for Engineer Consultation & 42 calendar days for Determination (Sub-Clause 3.7.3)",
      paymentCertificationPeriod: "28 calendar days from receiving Statement (Sub-Clause 14.6)",
      paymentPeriod: "56 calendar days from receiving Statement / 21 days for Advance Payment (Sub-Clause 14.7)",
      latePaymentInterestFormula: "3% per annum above central bank prime lending discount rate, compounded monthly (Sub-Clause 14.8)",
      defectsLiabilityPeriod: "Defects Notification Period (DNP) - typically 365 days / 1 year (Sub-Clause 1.1.27 / 11.1)",
      latentDefectsPeriod: "Per governing law of contract (Sub-Clause 1.4 / 11.10)"
    },
    clauses: [
      {
        clauseNumber: "Sub-Clause 1.3",
        title: "Notices and Other Communications",
        topic: "notices",
        summary: "All notices must be in writing, specifically identified as a 'Notice', referencing the relevant contract clause, and delivered by hand, courier, or agreed electronic transmission. Electronic transmission deemed received the day after transmission.",
        contractorRightOrDuty: "Must explicitly head communications as 'Notice' when asserting contractual rights.",
        employerRightOrDuty: "Bound by notice requirements equally with the Contractor.",
        engineerRole: "Receives copies of all notices; electronic receipts archived.",
        practicalGuidance: "Never rely on routine meeting minutes or informal emails as formal notice. Always state 'Notice under Sub-Clause X.X'."
      },
      {
        clauseNumber: "Sub-Clause 1.9",
        title: "Delayed Drawings or Instructions",
        topic: "delays_eot",
        summary: "If the Contractor suffers delay and/or incurs Cost due to the Engineer's failure to issue requested drawings or instructions within a reasonable specified time, the Contractor is entitled to EOT and Cost Plus Profit under Sub-Clause 20.2.",
        contractorRightOrDuty: "Must issue early notice detailing necessary drawing, why and when needed, and nature of delay.",
        employerRightOrDuty: "Liable for EOT and Cost Plus Profit (Cost + 5% default profit).",
        engineerRole: "Must issue instructions timeously; failure triggers compensation.",
        practicalGuidance: "Cross-reference technical RFIs with formal Sub-Clause 1.9 notice if response exceeds 14 days."
      },
      {
        clauseNumber: "Sub-Clause 3.7",
        title: "Agreement or Determination",
        topic: "supervision",
        summary: "When carrying out duties under Sub-Clause 3.7, the Engineer SHALL ACT NEUTRALLY between the Parties and shall not be deemed to act for the Employer. Stage 1: Consultation to reach agreement within 42 days (3.7.1). Stage 2: Fair determination within 42 days (3.7.2). Dissatisfaction Notice (NOD) must be given within 28 days (3.7.5).",
        timeBarDays: 28,
        timeBarType: "calendar_days",
        contractorRightOrDuty: "Entitled to fair, neutral hearing. Must issue NOD within 28 days if dissatisfied, else determination is final and binding.",
        employerRightOrDuty: "Cannot constrain Engineer's neutrality under 3.7; must issue NOD within 28 days if dissatisfied.",
        engineerRole: "Acts as neutral certifier/determiner, recording consultations and issuing reasoned determinations.",
        practicalGuidance: "If Engineer fails to issue determination within 42 days, claim is deemed rejected, triggering immediate 28-day window to issue NOD and proceed to DAAB (21.4)."
      },
      {
        clauseNumber: "Sub-Clause 4.12",
        title: "Unforeseeable Physical Conditions",
        topic: "delays_eot",
        summary: "Covers natural physical conditions, man-made obstructions, and pollutants encountered on Site that were not reasonably foreseeable by an experienced contractor at the Base Date (28 days before tender submission). Excludes climatic conditions at Site.",
        contractorRightOrDuty: "Must give prompt notice to Engineer before conditions are disturbed, describing adverse effects on progress/cost.",
        employerRightOrDuty: "Carries financial risk of unforeseen ground conditions; entitled to review favorable conditions.",
        engineerRole: "Must inspect conditions within 7 days and issue instructions under Sub-Clause 13.3.1.",
        practicalGuidance: "Entitles contractor to EOT and Cost (without profit). Keep rigorous geotechnical borehole logs and photographic evidence."
      },
      {
        clauseNumber: "Sub-Clause 8.3",
        title: "Programme",
        topic: "programme_time",
        summary: "Contractor must submit initial critical-path programme within 28 days of Commencement Date (8.1). Programme must show logically linked activities, critical path, float, and method statement. Engineer has 21 days for initial review (14 days for revised) to give Notice of No-objection or reasons.",
        timeBarDays: 28,
        timeBarType: "calendar_days",
        contractorRightOrDuty: "Must submit monthly revised programme when actual progress ceases to reflect baseline.",
        employerRightOrDuty: "Personnel entitled to rely on Programme when planning their activities.",
        engineerRole: "Reviews programme; absence of notice within 21/14 days constitutes deemed No-objection.",
        practicalGuidance: "A programme with Notice of No-objection becomes the contractual reference for assessing EOT claims."
      },
      {
        clauseNumber: "Sub-Clause 8.4",
        title: "Advance Warning",
        topic: "general",
        summary: "Each Party and the Engineer shall advise each other in advance of any known or probable future events or circumstances which may adversely affect work, performance, increase Contract Price, or delay execution.",
        contractorRightOrDuty: "Proactive duty to notify potential delay and cost events early.",
        employerRightOrDuty: "Duty to disclose known client-side risks and budget/access changes.",
        engineerRole: "May request Contractor proposal under Sub-Clause 13.3.2 to avoid or minimize effects.",
        practicalGuidance: "Issuing Sub-Clause 8.4 advance warnings protects against allegations of failure to mitigate delay."
      },
      {
        clauseNumber: "Sub-Clause 8.5",
        title: "Extension of Time for Completion",
        topic: "delays_eot",
        summary: "Contractor entitled to EOT for Variations, exceptionally adverse climatic conditions, unforeseeable shortages from epidemics/government actions, or Employer impediments/prevention, or BOQ quantity increases exceeding 10%.",
        contractorRightOrDuty: "Must substantiate critical path delay in accordance with Sub-Clause 20.2.",
        employerRightOrDuty: "Cannot impose Delay Damages for periods where Contractor is entitled to EOT.",
        engineerRole: "Determines EOT under Sub-Clause 3.7; cannot decrease total previously determined EOT.",
        practicalGuidance: "Weather claims must be proven against 10-year historical return data from the national meteorological authority."
      },
      {
        clauseNumber: "Sub-Clause 8.8",
        title: "Delay Damages",
        topic: "delays_eot",
        summary: "Liquidated damages payable by Contractor for failure to complete by Time for Completion. Calculated daily up to the maximum cap stated in Contract Data (typically 10% of Accepted Contract Amount).",
        contractorRightOrDuty: "Liability capped at maximum Delay Damages in Contract Data (except for fraud/gross negligence).",
        employerRightOrDuty: "Sole financial remedy for delay prior to termination.",
        engineerRole: "Deducts Delay Damages in IPCs upon instruction from Employer.",
        practicalGuidance: "Proportionately reduced under Sub-Clause 10.2 if Employer takes over part or section of works early."
      },
      {
        clauseNumber: "Sub-Clause 13.3.1",
        title: "Variation by Instruction",
        topic: "variations_pricing",
        summary: "Engineer may instruct Variations. Contractor must submit detailed particulars within 28 days including resource description, programme modifications, and proposal for adjustment to Contract Price valued under Clause 12.",
        timeBarDays: 28,
        timeBarType: "calendar_days",
        contractorRightOrDuty: "Entitled to EOT and Contract Price adjustment without needing to follow Clause 20 claim procedure.",
        employerRightOrDuty: "Employer bound by Engineer's variation instructions.",
        engineerRole: "Proceeds under Sub-Clause 3.7 to agree or determine valuation and EOT.",
        practicalGuidance: "Variations under Clause 13 bypass the 28-day strict time-bar of Sub-Clause 20.2.1."
      },
      {
        clauseNumber: "Sub-Clause 14.8",
        title: "Delayed Payment",
        topic: "payment_certificates",
        summary: "If Contractor does not receive payment in accordance with Sub-Clause 14.7, Contractor is entitled to financing charges compounded monthly at 3% above central bank discount rate, payable on request without formal notice or certification.",
        contractorRightOrDuty: "Statutory right to financing charges without complying with Sub-Clause 20.2 claim procedures.",
        employerRightOrDuty: "Strict obligation to pay financing charges on overdue payments.",
        engineerRole: "Must include financing charges in ensuing payment certificate upon Contractor request.",
        practicalGuidance: "Contractor may also issue 21-day notice of suspension under Sub-Clause 16.1 if payment remains unpaid."
      },
      {
        clauseNumber: "Sub-Clause 16.1",
        title: "Suspension by Contractor",
        topic: "suspension_termination",
        summary: "Contractor may, not less than 21 days after giving Notice to Employer, suspend work (or reduce rate of work) if Engineer fails to certify IPC under 14.6, Employer fails to provide financial evidence under 2.4, or Employer fails to pay under 14.7.",
        timeBarDays: 21,
        timeBarType: "calendar_days",
        contractorRightOrDuty: "Entitled to EOT and Cost Plus Profit for suspension and remobilization upon resumption (16.1/8.13).",
        employerRightOrDuty: "Can cure default within 21-day notice period to prevent suspension.",
        engineerRole: "Must certify EOT and Cost Plus Profit resulting from suspension.",
        practicalGuidance: "Powerful remedy to unblock persistent certification backlogs or withheld milestone payments."
      },
      {
        clauseNumber: "Sub-Clause 20.2.1",
        title: "Notice of Claim (Strict 28-Day Time-Bar)",
        topic: "claims_procedure",
        summary: "The claiming Party SHALL give a Notice to the Engineer describing the event or circumstance no later than 28 DAYS after the claiming Party became aware, or should have become aware. IF FAILS, THE CLAIMING PARTY SHALL NOT BE ENTITLED TO ANY ADDITIONAL PAYMENT OR EOT, AND THE OTHER PARTY IS DISCHARGED FROM ALL LIABILITY.",
        timeBarDays: 28,
        timeBarType: "calendar_days",
        contractorRightOrDuty: "Must submit formal notice within 28 days of event occurrence. Strict fatal time bar.",
        employerRightOrDuty: "Equally bound by 28-day notice rule for Employer's claims (e.g. defects, delay damages).",
        engineerRole: "Must issue initial response within 14 days under 20.2.2 if notice is considered late, else deemed valid.",
        practicalGuidance: "The single most critical procedural clause in FIDIC 2017. Always log formal notice within 28 calendar days."
      },
      {
        clauseNumber: "Sub-Clause 20.2.4",
        title: "Fully Detailed Claim (84-Day Window)",
        topic: "claims_procedure",
        summary: "Within 84 days after becoming aware of event, claiming Party must submit Fully Detailed Claim with contractual/legal basis, contemporary records, and quantum/time calculations. If fails, Notice of Claim deemed to have lapsed.",
        timeBarDays: 84,
        timeBarType: "calendar_days",
        contractorRightOrDuty: "Must compile full substantiated submission with contemporaneous site records and delay fragnet.",
        employerRightOrDuty: "Entitled to notice of claim lapsing if Contractor fails to submit within 84 days.",
        engineerRole: "Reviews claim and gives response on contractual basis within time limit under 3.7.3.",
        practicalGuidance: "For continuing events (20.2.6), submit interim claims monthly and final claim within 28 days of cessation."
      },
      {
        clauseNumber: "Sub-Clause 21.4",
        title: "Obtaining DAAB's Decision",
        topic: "dispute_resolution",
        summary: "Either Party may refer a Dispute to the standing DAAB within 42 days of giving/receiving a Notice of Dissatisfaction (NOD) under 3.7.5. DAAB must give reasoned decision within 84 days. Decision is binding on both Parties immediately.",
        timeBarDays: 84,
        timeBarType: "calendar_days",
        contractorRightOrDuty: "Entitled to immediate payment/compliance awarded by DAAB without awaiting arbitration.",
        employerRightOrDuty: "Must implement DAAB decision immediately; failure enables direct arbitration under 21.7.",
        engineerRole: "Bound to comply with and implement DAAB decisions in certificates.",
        practicalGuidance: "If dissatisfied with DAAB decision, Party must give NOD under 21.4.4 within 28 days, then attempt amicable settlement (21.5) before ICC arbitration (21.6)."
      }
    ]
  },

  "FIDIC_1999_RED": {
    id: "fidic-1999-red",
    code: "FIDIC_1999_RED",
    name: "FIDIC Conditions of Contract for Construction (First Edition 1999 - Red Book)",
    shortName: "FIDIC Red Book 1999",
    edition: "First Edition 1999 (ISBN 2-88432-022-9)",
    publisher: "FIDIC (Geneva, Switzerland)",
    governingBody: "FIDIC",
    applicableLawContext: "International Civil & Infrastructure Works",
    corePhilosophy: "Employer-designed civil works with Employer's claims governed under Clause 2.5 and Contractor's claims under Clause 20.1. Engineer determinations under Clause 3.5.",
    keyActors: {
      employer: "The Employer (Sub-Clause 1.1.2.2)",
      contractor: "The Contractor (Sub-Clause 1.1.2.3)",
      administrator: "The Engineer (Sub-Clause 1.1.2.4 & Clause 3 - determinations under Clause 3.5)",
      supervisor: "Engineer's Representative (Sub-Clause 3.2)",
      adjudicatorBoard: "Dispute Adjudication Board (DAB - Clause 20.2)"
    },
    keyTimelines: {
      claimNoticeWindow: "28 calendar days from event awareness (Clause 20.1)",
      claimSubstantiationWindow: "42 calendar days from awareness to submit detailed claim (Clause 20.1)",
      rulingWindow: "42 calendar days for Engineer response / determination (Clause 20.1 / 3.5)",
      paymentCertificationPeriod: "28 calendar days from monthly statement (Clause 14.6)",
      paymentPeriod: "56 calendar days from monthly statement (Clause 14.7)",
      latePaymentInterestFormula: "3% per annum above central bank discount rate (Clause 14.8)",
      defectsLiabilityPeriod: "Defects Notification Period stated in Appendix to Tender (Clause 11.1)",
      latentDefectsPeriod: "Governed by applicable law"
    },
    clauses: [
      {
        clauseNumber: "Clause 2.5",
        title: "Employer's Claims",
        topic: "claims_procedure",
        summary: "Employer must give notice and particulars to the Contractor as soon as practicable after becoming aware of event entitling payment or extension of DNP. Amount determined by Engineer under Clause 3.5.",
        contractorRightOrDuty: "Entitled to notice and substantiation before any set-off or deduction is made.",
        employerRightOrDuty: "Cannot set off or deduct amounts from payment certificates without complying with Clause 2.5.",
        engineerRole: "Determines Employer's entitlement under Clause 3.5.",
        practicalGuidance: "Differentiates from 2017 Red Book where Employer and Contractor claims share unified 20.2 procedure."
      },
      {
        clauseNumber: "Clause 20.1",
        title: "Contractor's Claims (28-Day Notice & 42-Day Particulars)",
        topic: "claims_procedure",
        summary: "Contractor must give notice of claim within 28 days of event awareness. Failure to give notice discharges Employer from liability. Detailed claim with contemporary records must be submitted within 42 days.",
        timeBarDays: 28,
        timeBarType: "calendar_days",
        contractorRightOrDuty: "Must maintain contemporary records on site and submit 42-day detailed particulars.",
        employerRightOrDuty: "Discharged from all liability if 28-day notice is missed.",
        engineerRole: "Must respond with approval or disapproval and detailed comments within 42 days.",
        practicalGuidance: "Strict condition precedent to entitlement in common law jurisdictions."
      }
    ]
  },

  "NEC4_ECC": {
    id: "nec4-ecc",
    code: "NEC4_ECC",
    name: "NEC4 Engineering and Construction Contract (June 2017)",
    shortName: "NEC4 ECC",
    edition: "Fourth Edition June 2017 (ISBN 978-0-7277-6209-2)",
    publisher: "Thomas Telford Ltd / Institution of Civil Engineers (ICE)",
    governingBody: "NEC Contract Board (London, UK)",
    applicableLawContext: "Modern Collaborative Infrastructure Projects (UK, South Africa, Hong Kong, Australia)",
    corePhilosophy: "Pro-active management in a spirit of mutual trust and co-operation (Clause 10.2). Early Warning Register system (Clause 15), progressive dynamic programme acceptance (Clause 31/32), and unified Compensation Events (Clause 60-66) evaluated on Defined Cost plus Fee.",
    keyActors: {
      employer: "The Client (Clause 11.2(13))",
      contractor: "The Contractor (Clause 11.2(13))",
      administrator: "The Project Manager (PM - Clause 14)",
      supervisor: "The Supervisor (Clause 14 - responsible for testing, defect notification and Defects Certificate)",
      adjudicatorBoard: "Senior Representatives (W1/W2) -> Adjudicator / Dispute Avoidance Board (Option W3)"
    },
    keyTimelines: {
      claimNoticeWindow: "8 weeks from becoming aware for Compensation Events (Clause 61.3) - STRICT TIME BAR",
      claimSubstantiationWindow: "3 weeks from instruction to submit Quotation (Clause 62.3)",
      rulingWindow: "2 weeks for Project Manager reply to quotation (Clause 62.3) / 1 week for CE notification reply (61.4)",
      paymentCertificationPeriod: "1 week after assessment date (Clause 51.1)",
      paymentPeriod: "3 weeks from assessment date (Clause 51.2)",
      latePaymentInterestFormula: "Daily interest at interest rate in Contract Data compounded annually (Clause 51.4)",
      defectsLiabilityPeriod: "Defects correction period stated in Contract Data from Completion (Clause 44.2 / 11.2(7))",
      latentDefectsPeriod: "Per Option X18 (Limitation of liability date) or applicable law"
    },
    clauses: [
      {
        clauseNumber: "Clause 10.2",
        title: "Mutual Trust and Co-operation",
        topic: "general",
        summary: "The Parties, the Project Manager and the Supervisor shall act as stated in this contract and in a spirit of mutual trust and co-operation.",
        contractorRightOrDuty: "Contractual obligation to engage constructively, share risk telemetry, and collaborate.",
        employerRightOrDuty: "Client and PM must act fairly, impartially, and transparently without obstruction.",
        engineerRole: "Project Manager must manage risks collaboratively rather than defensively.",
        practicalGuidance: "Legally enforceable contractual duty across UK, Commonwealth, and South African jurisdictions."
      },
      {
        clauseNumber: "Clause 15.1 - 15.4",
        title: "Early Warning & Early Warning Register",
        topic: "general",
        summary: "Contractor and PM must give early warning as soon as either becomes aware of any matter which could increase Prices, delay Completion, delay Key Date, or impair performance. PM enters matters into Early Warning Register. First meeting held within 2 weeks of starting date; revised Register issued within 1 week of each meeting.",
        contractorRightOrDuty: "Duty to notify immediately. Failure allows PM to assess subsequent Compensation Event as if early warning had been given (Clause 61.5 / 63.7).",
        employerRightOrDuty: "PM must convene early warning meetings and co-operate to find risk-reduction solutions.",
        engineerRole: "Maintains and issues updated Early Warning Register within 1 week of meeting.",
        practicalGuidance: "Early warnings are not claims; they are proactive risk mitigation sessions."
      },
      {
        clauseNumber: "Clause 31.2 & 32.1",
        title: "Accepted Programme & Programme Revision",
        topic: "programme_time",
        summary: "Contractor submits programme showing start date, access dates, planned completion, operation sequences, provisions for float and time risk allowances (TRA). Revised programme submitted at intervals in Contract Data showing actual progress, delay effects, and corrective measures.",
        contractorRightOrDuty: "Owns time risk allowances and planned completion float; entitled to use float without forfeiting EOT.",
        employerRightOrDuty: "PM must accept or reject within 2 weeks with valid reasons (31.3). Deemed acceptance if default continues 1 week after notice (31.3).",
        engineerRole: "Project Manager reviews realism, practicability, and scope compliance.",
        practicalGuidance: "Delay under NEC4 is measured against 'planned Completion' on the latest Accepted Programme, not Completion Date."
      },
      {
        clauseNumber: "Clause 36.1",
        title: "Acceleration",
        topic: "programme_time",
        summary: "Contractor and PM may agree acceleration to achieve earlier Completion Date. PM instructs quotation; Contractor submits within 3 weeks with revised programme and price adjustments. PM replies within 3 weeks.",
        timeBarDays: 21,
        timeBarType: "calendar_days",
        contractorRightOrDuty: "Voluntary acceleration; contractor not obliged to accelerate unless quotation accepted.",
        employerRightOrDuty: "Client can buy earlier completion through agreed commercial quotation.",
        engineerRole: "Project Manager accepts quotation and amends Completion Date and Prices accordingly (36.3).",
        practicalGuidance: "Distinct from unilateral acceleration instructions; requires bilateral agreement."
      },
      {
        clauseNumber: "Clause 60.1(1) to (21)",
        title: "Compensation Events Triggers",
        topic: "variations_pricing",
        summary: "Exhaustive list of 21 core Compensation Events: 60.1(1) Scope change; 60.1(2) Access delay; 60.1(3) Client materials delay; 60.1(4) Stop work; 60.1(5) Others delay; 60.1(6) Communication delay; 60.1(12) Physical conditions; 60.1(13) Adverse weather (< 1 in 10 yr frequency); 60.1(14) Client liability; 60.1(18) Client breach; 60.1(19) Prevention event.",
        contractorRightOrDuty: "Entitled to assessment of changes to the Prices, Completion Date, and Key Dates based on Defined Cost + Fee.",
        employerRightOrDuty: "Client bears financial and time consequences of all listed events.",
        engineerRole: "PM notifies Contractor of CE at time of instruction/event (61.1) and instructs quotations (61.2).",
        practicalGuidance: "All variations, delay claims, and disruption are handled under the unified CE mechanism."
      },
      {
        clauseNumber: "Clause 61.3",
        title: "Compensation Event 8-Week Time-Bar",
        topic: "claims_procedure",
        summary: "If the Contractor does not notify a compensation event within EIGHT WEEKS of becoming aware of the event, the Prices, the Completion Date or a Key Date are NOT CHANGED (unless PM should have notified it under 61.1).",
        timeBarDays: 56,
        timeBarType: "calendar_days",
        contractorRightOrDuty: "Absolute fatal time-bar for Contractor-notified compensation events.",
        employerRightOrDuty: "Client fully protected against late claims beyond 8 weeks.",
        engineerRole: "PM replies within 1 week of Contractor notification (61.4).",
        practicalGuidance: "Crucial rule: always notify any potential compensation event within 8 weeks."
      },
      {
        clauseNumber: "Clause 63.1",
        title: "Assessment of Compensation Events (Defined Cost + Fee)",
        topic: "variations_pricing",
        summary: "Change to Prices assessed as actual Defined Cost of work done by dividing date + forecast Defined Cost of work not done by dividing date + resulting Fee percentage. Delay assessed as movement in planned Completion on Accepted Programme (63.5).",
        contractorRightOrDuty: "Entitled to prospective forecast pricing and agreed risk allowances for cost and time (63.8).",
        employerRightOrDuty: "Assessed prospective risk allocation; assessment is NOT revised if forecast later proves different (65.2).",
        engineerRole: "PM assesses if Contractor quotation is late or incorrect (Clause 64.1).",
        practicalGuidance: "Once implemented under Clause 65/66, the CE is final and cannot be reopened or audited retrospectively."
      },
      {
        clauseNumber: "Option C / D Clause 54",
        title: "Target Contract & Contractor's Share (Pain/Gain)",
        topic: "variations_pricing",
        summary: "In Target Contracts (Options C and D), the difference between final Price for Work Done to Date (actual Defined Cost + Fee) and Total of Prices (Target) is shared between Client and Contractor based on the share ranges in Contract Data.",
        contractorRightOrDuty: "Shares in savings (gain share) or cost overruns (pain share); motivates target efficiency.",
        employerRightOrDuty: "Client pays Defined Cost monthly and reconciles final share at Completion (54.3/54.4).",
        engineerRole: "Project Manager audits Defined Cost, verifies Disallowed Cost (11.2(26)), and calculates Contractor's share.",
        practicalGuidance: "Rigorous record-keeping of accounts, payroll, and subcontractor payments is essential to avoid Disallowed Cost."
      }
    ]
  },

  "GCC_2015": {
    id: "gcc-2015",
    code: "GCC_2015",
    name: "General Conditions of Contract for Construction Works (Third Edition 2015 - SAICE GCC 2015)",
    shortName: "SAICE GCC 2015",
    edition: "Third Edition 2015 (Approved by SAICE & Gazetted by CIDB)",
    publisher: "South African Institution of Civil Engineering (SAICE)",
    governingBody: "SAICE Project Management and Construction Division (PMCD)",
    applicableLawContext: "South African Roman-Dutch Law & CIDB Standard for Uniformity in Construction Procurement",
    corePhilosophy: "Equitable risk sharing based on Roman-Dutch principles, replacing traditional Engineer with 'Employer's Agent' (Clause 3) who has a quasi-arbitral duty to act impartially (Clause 3.2.2). Detailed delay time calculations excluding non-working days (Clause 5.1), Contractor claims under Clause 10.1 (28-day notice time-bar), dissatisfaction claims under Clause 10.2, and Contract Price Adjustment Factor (CPAF) formula (Clause 6.8.2).",
    keyActors: {
      employer: "The Employer (Clause 1.1.1.15)",
      contractor: "The Contractor (Clause 1.1.1.9) / Construction Manager (Clause 4.12.2)",
      administrator: "Employer's Agent (Clause 1.1.1.16 & Clause 3 - must consult & act impartially under 3.2.2)",
      supervisor: "Employer's Agent's Representative (Clause 3.3)",
      adjudicatorBoard: "Adjudication Board (Standing Clause 10.5.1 / Ad-hoc Clause 10.5.2 - SAICE Panel of Adjudicators)"
    },
    keyTimelines: {
      claimNoticeWindow: "28 calendar days from circumstance giving rise to claim (Clause 10.1.1.1) - STRICT TIME BAR",
      claimSubstantiationWindow: "Monthly updated particulars (10.1.1.3); Final claim within 28 days of cessation of events",
      rulingWindow: "28 calendar days for Employer's Agent ruling on claim (Clause 10.1.5)",
      paymentCertificationPeriod: "7 calendar days from receiving monthly statement (Clause 6.10.4)",
      paymentPeriod: "28 calendar days from receipt of signed payment certificate (Clause 6.10.4)",
      latePaymentInterestFormula: "Prime overdraft rate charged by Contractor's Bank, compounded monthly (Clause 6.10.6.2)",
      defectsLiabilityPeriod: "Defects Liability Period stated in Contract Data, commencing on Completion (Clause 1.1.1.13 / 7.8.1)",
      latentDefectsPeriod: "10 years for civil engineering works / 5 years for building works (Clause 5.16.3 / Contract Data)"
    },
    clauses: [
      {
        clauseNumber: "Clause 3.2.2",
        title: "Employer's Agent Duty to Consult & Act Impartially",
        topic: "supervision",
        summary: "Whenever the Employer's Agent intends to exercise any discretion, ruling, contract interpretation, or price determination, he/she SHALL FIRST CONSULT with Contractor and Employer to reach agreement. Failing agreement, Employer's Agent shall act impartially and make a decision in accordance with the Contract.",
        contractorRightOrDuty: "Entitled to impartial ruling free from Employer interference (supported by Hoffman v Meyer case law).",
        employerRightOrDuty: "Employer cannot instruct Agent how to rule on contractual interpretations or claims.",
        engineerRole: "Quasi-arbitrator status; bound to exercise independent professional judgment.",
        practicalGuidance: "If Agent fails to act impartially, Contractor can submit Dissatisfaction Claim under Clause 10.2."
      },
      {
        clauseNumber: "Clause 5.1.1",
        title: "Time Calculations & Non-Working Days",
        topic: "programme_time",
        summary: "Calculation of time periods excludes special non-working days stated in Contract Data (Sundays, statutory public holidays, year-end construction break typically 15 Dec to 05 Jan). Time spans commence at midnight (00:00) on the day following the triggering event.",
        contractorRightOrDuty: "Protected from calendar days penalty erosion during statutory industry holidays.",
        employerRightOrDuty: "Special non-working days risk is borne by Employer.",
        engineerRole: "Calculates Due Completion Date incorporating verified non-working day additions.",
        practicalGuidance: "Crucial for calculating exact Due Completion Date in South African contracts."
      },
      {
        clauseNumber: "Clause 5.6.2.4",
        title: "Programme Time Risk Allowances (TRA)",
        topic: "programme_time",
        summary: "The Contractor's programme must explicitly show events that influence the carrying out of the Works, including FLOAT and CONTRACTOR'S TIME RISK ALLOWANCES for each activity.",
        contractorRightOrDuty: "Contractor is entitled to include realistic time risk allowances for weather and operational friction.",
        employerRightOrDuty: "Employer's Agent must not artificially compress or reject valid TRAs.",
        engineerRole: "Approves programme within 7 days (Clause 5.6.3) or gives reasons for amendment.",
        practicalGuidance: "TRA ensures realistic critical path forecasting against inclement weather."
      },
      {
        clauseNumber: "Clause 5.11.1",
        title: "Suspension of Works by Contractor for Non-Payment",
        topic: "suspension_termination",
        summary: "Contractor may, after giving fourteen (14) days written notice to Employer (with copy to Employer's Agent referencing Clause 5.11.1), suspend progress of Works if Employer/Agent fails to deliver payment certificate (6.10.4) or make full payment (6.10.4).",
        timeBarDays: 14,
        timeBarType: "calendar_days",
        contractorRightOrDuty: "Entitled to suspend and claim delay and proven additional cost under Clause 10.1 (Clause 5.11.4).",
        employerRightOrDuty: "Can avoid suspension by settling certified amount within 14 days notice window.",
        engineerRole: "Must certify consequential delay and demobilization/remobilization costs.",
        practicalGuidance: "If non-payment continues for 84 days after suspension notice, Contractor may terminate under Clause 9.3."
      },
      {
        clauseNumber: "Clause 5.12",
        title: "Extension of Time for Practical Completion",
        topic: "delays_eot",
        summary: "Contractor entitled to claim EOT for additional work (5.12.2.1), abnormal climatic conditions (5.12.2.2), any provision in Conditions, or any disruption entirely beyond Contractor's control (5.12.2.4). Claim must be submitted in terms of Clause 10.1.",
        contractorRightOrDuty: "Entitled to payment of time-related General Items (preliminaries) for granted extension days (Clause 5.12.3).",
        employerRightOrDuty: "May request acceleration instead of granting EOT in terms of Clause 5.12.4 and Clause 5.7.3.",
        engineerRole: "Determines EOT and adjusts Due Completion Date.",
        practicalGuidance: "Under Clause 5.12.3, Contractor receives P&G payment at the tendered daily rate for each working day of EOT."
      },
      {
        clauseNumber: "Clause 6.8.2",
        title: "Contract Price Adjustment Factor (CPAF Formula)",
        topic: "variations_pricing",
        summary: "Contract price adjustment for inflation calculated using formula: Pn = (1 - x) * [a*(Lt/Lo) + b*(Pt/Po) + c*(Mt/Mo) + d*(Ft/Fo) - 1], where x is fixed non-adjustable proportion (default 0.10), and a, b, c, d are coefficients for Labour, Plant, Materials, and Fuel.",
        contractorRightOrDuty: "Protected from cost inflation on long-term contracts; submits monthly CPAF calculation.",
        employerRightOrDuty: "Pays monthly escalation adjustments; if completion delayed past Due Date, CPAF factor is halved (Clause 6.8.2).",
        engineerRole: "Verifies Statistical Release P0141 (CPI) and P0151 (CPAP) indices published by Statistics South Africa / SAFCEC.",
        practicalGuidance: "Standard SAFCEC/SEIFSA indices applied to civil and electrical/mechanical work components."
      },
      {
        clauseNumber: "Clause 8.3",
        title: "Excepted Risks (Electricity Disconnection & Strikes)",
        topic: "risk_insurance",
        summary: "Employer's excepted risks include war, riot, and specific modern risks such as disconnection of electricity supply not covered by agreement (8.3.1.6) and design defects (8.3.1.12). Contractor entitled to claim delay and proven cost under Clause 10.1 (Clause 8.3.2).",
        contractorRightOrDuty: "Can claim full cost and EOT when municipal grid load shedding / power cuts halt critical operations.",
        employerRightOrDuty: "Employer carries the financial risk for power authority interruptions.",
        engineerRole: "Issues variation instruction for repair or determines compensation under 10.1.",
        practicalGuidance: "Key South African protection for load-shedding and municipal utility failures."
      },
      {
        clauseNumber: "Clause 10.1.1.1",
        title: "Contractor's Claim Notice (Strict 28-Day Time-Bar)",
        topic: "claims_procedure",
        summary: "Contractor SHALL, within 28 DAYS after the circumstance, event, act or omission giving rise to claim, deliver to Employer's Agent a written claim referring to Clause 10.1. IF CONTRACTOR FAILS, THE DUE DATE SHALL NOT BE EXTENDED, NO ADDITIONAL PAYMENT MADE, AND EMPLOYER DISCHARGED FROM ALL LIABILITY (10.1.4).",
        timeBarDays: 28,
        timeBarType: "calendar_days",
        contractorRightOrDuty: "Mandatory 28-day notice rule enforced strictly by South African courts (Barkhuizen v Napier principle).",
        employerRightOrDuty: "Fully discharged from liability if 28-day notice is not served.",
        engineerRole: "Must deliver reasoned ruling within 28 days of receiving detailed claim (Clause 10.1.5).",
        practicalGuidance: "If event is ongoing, submit intention notice within 28 days, monthly updates (10.1.1.3), and final claim within 28 days of end."
      },
      {
        clauseNumber: "Clause 10.2",
        title: "Dissatisfaction Claim",
        topic: "claims_procedure",
        summary: "For any matter arising out of the Contract not required to be dealt with under Clause 10.1 (e.g. dispute over variation valuation 6.4, payment certificate deduction 6.10, or disagreement with Agent's ruling), Party must deliver written dissatisfaction claim within 28 days (Clause 10.2.2).",
        timeBarDays: 28,
        timeBarType: "calendar_days",
        contractorRightOrDuty: "Enables challenge to Employer's Agent instructions and certificates within 28 days.",
        employerRightOrDuty: "Employer can also lodge dissatisfaction claim against Agent's rulings.",
        engineerRole: "Must consult with Parties and deliver reasoned ruling within 28 days (10.2.3).",
        practicalGuidance: "Pre-requisite step before issuing formal Dispute Notice under Clause 10.3."
      },
      {
        clauseNumber: "Clause 10.5",
        title: "Adjudication (Standing / Ad-hoc)",
        topic: "dispute_resolution",
        summary: "Disputes referred to Adjudication Board. Standing Board appointed within 56 days of Commencement Date (10.5.1). Adjudication Board conducts inquisitorial procedure and must deliver decision within 28 days (Rule 7.1). Decision is immediately binding upon both Parties (10.5.4).",
        timeBarDays: 28,
        timeBarType: "calendar_days",
        contractorRightOrDuty: "Entitled to enforce Adjudication decision immediately (including payment in next certificate).",
        employerRightOrDuty: "Must implement decision without delay; can give notice of disagreement within 28-56 days (10.6.1.2).",
        engineerRole: "Must certify amounts awarded by Adjudicator in ensuing payment certificate.",
        practicalGuidance: "Adjudication rules prevent costly litigation while preserving project cash flow."
      }
    ]
  },

  "JBCC_6_2": {
    id: "jbcc-6-2",
    code: "JBCC_6_2",
    name: "JBCC Principal Building Agreement (Edition 6.2 – May 2018)",
    shortName: "JBCC PBA 6.2",
    edition: "Edition 6.2 (May 2018)",
    publisher: "Joint Building Contracts Committee NPC (JBCC)",
    governingBody: "JBCC Board (Johannesburg, South Africa)",
    applicableLawContext: "Building & Commercial Construction in Southern Africa (RSA, Namibia, Botswana)",
    corePhilosophy: "Structured execution sequence with clear working-day (WD) and calendar-day (CD) notice periods. Principal Agent administers agreement (Clause 6.0). Strict 20 working days notice time-bar for Practical Completion revision (Clause 23.4.2) and Expense/Loss (Clause 26.5). Default interest at 6% above bank rate (Clause 25.7.4) and Compensatory interest (25.7.5).",
    keyActors: {
      employer: "The Employer (Clause 1.1)",
      contractor: "The Contractor (Clause 1.1)",
      administrator: "Principal Agent (PA - Clause 1.1 & Clause 6.0, full authority to bind Employer)",
      supervisor: "Appointed Agents (Architect, Quantity Surveyor, Structural Engineer - Clause 6.2)",
      adjudicatorBoard: "Adjudicator (nominated by Association of Arbitrators / JBCC body - Clause 30.6)"
    },
    keyTimelines: {
      claimNoticeWindow: "20 working days of becoming aware of delay (Clause 23.4.2) / expense (26.5) - STRICT FORFEITURE",
      claimSubstantiationWindow: "40 working days to submit quantified claim (Clause 23.5 / 26.6)",
      rulingWindow: "20 working days for Principal Agent assessment (Clause 23.7 / 26.7) - deemed refusal if missed (23.8)",
      paymentCertificationPeriod: "Issued regularly by agreed date [CD] (Clause 25.2)",
      paymentPeriod: "14 calendar days from date of payment certificate issue (Clause 25.10)",
      latePaymentInterestFormula: "Default Interest at 6 percentage points above ruling bank rate compounded monthly (Clause 25.7.4)",
      defectsLiabilityPeriod: "90 calendar days from Practical Completion (Clause 21.1)",
      latentDefectsPeriod: "5 years from certified date of Final Completion (Clause 22.1)"
    },
    clauses: [
      {
        clauseNumber: "Clause 2.4",
        title: "Deemed Receipt of Notices",
        topic: "notices",
        summary: "Notices deemed received: Delivered by hand = on day of delivery (2.4.1); Sent by electronic mail (excluding social media) = within one (1) working day (2.4.2); Registered post = within seven (7) calendar days (2.4.3).",
        contractorRightOrDuty: "Must use formal email or physical delivery; social media expressly excluded.",
        employerRightOrDuty: "Bound by electronic 1-working-day deemed receipt rule.",
        engineerRole: "Principal Agent communications logged with exact receipt timestamps.",
        practicalGuidance: "Working days exclude Saturdays, Sundays, public holidays, and recorded builder's break."
      },
      {
        clauseNumber: "Clause 6.6",
        title: "Principal Agent Independence & Non-Interference",
        topic: "supervision",
        summary: "The Employer shall not interfere with or prevent the Principal Agent and/or agents from exercising fair and reasonable judgement when performing their obligations in terms of this agreement.",
        contractorRightOrDuty: "If PA fails to act independently, Contractor gives 5 working days notice to rectify default before suspension (Clause 6.4 / 28.0).",
        employerRightOrDuty: "Prohibited from dictating PA certification or claim assessment outcomes.",
        engineerRole: "PA must exercise professional impartiality in assessing extension of time and expense claims.",
        practicalGuidance: "Protects against client instructions to under-certify valuations or reject valid delay claims."
      },
      {
        clauseNumber: "Clause 11.1 & 11.5",
        title: "Guarantees for Construction & Payment",
        topic: "securities_guarantees",
        summary: "Contractor provides Guarantee for Construction within 15 working days: Variable (10% reducing to final payment 11.1.1) or Fixed (5% + 5% payment reduction 11.1.2). Employer provides Guarantee for Payment within 15 working days (11.5.1).",
        timeBarDays: 15,
        timeBarType: "working_days",
        contractorRightOrDuty: "If Employer fails to provide Payment Guarantee, Contractor may give 10 working days notice to suspend works (Clause 11.6 / 28.1.1).",
        employerRightOrDuty: "If Contractor fails to provide security, Employer may withhold 10% in IPCs (11.4.1) or terminate (11.4.2).",
        engineerRole: "PA monitors validity and returns security forms within 10 working days of expiry (11.8).",
        practicalGuidance: "JBCC is unique in providing bilateral security where Employer must also guarantee payment."
      },
      {
        clauseNumber: "Clause 17.1 & 17.3",
        title: "Contract Instructions",
        topic: "variations_pricing",
        summary: "Principal Agent may issue written Contract Instructions (17.1.1-17.1.20). Oral instructions have NO force or effect (17.5). If Contractor fails to proceed with due diligence within 5 working days after notice (17.3), Employer may engage others.",
        timeBarDays: 5,
        timeBarType: "working_days",
        contractorRightOrDuty: "Not obliged to execute contract instructions for additional work issued after Practical Completion (17.4).",
        employerRightOrDuty: "Can recover costs if Contractor fails to obey instruction after 5-day warning.",
        engineerRole: "Principal Agent issues all instructions; values adjustments under Clause 26.0.",
        practicalGuidance: "Never execute verbal site directions; insist on written Contract Instruction (CI)."
      },
      {
        clauseNumber: "Clause 19.0",
        title: "Practical Completion & Deemed Completion",
        topic: "programme_time",
        summary: "Contractor gives 5 working days notice of inspection for Practical Completion (19.2.2). PA inspects and issues List for Practical Completion (19.3.1) or Certificate of Practical Completion (19.3.3). If PA fails to issue list within 5 WD after inspection, Contractor gives notice; if PA fails within further 5 WD, practical completion is DEEMED ACHIEVED (19.4).",
        timeBarDays: 10,
        timeBarType: "working_days",
        contractorRightOrDuty: "Deemed practical completion operates automatically after 5+5 working days PA default.",
        employerRightOrDuty: "Employer takes possession on Practical Completion; risk passes to Employer (Clause 8.1).",
        engineerRole: "Principal Agent must inspect promptly and issue comprehensive conclusive list.",
        practicalGuidance: "Stops indefinite withholding of Practical Completion certificates."
      },
      {
        clauseNumber: "Clause 23.4.2",
        title: "Revision of Practical Completion Notice (Strict 20 WD Time-Bar)",
        topic: "claims_procedure",
        summary: "Within TWENTY (20) WORKING DAYS of becoming aware, or ought reasonably to have become aware of delay, Contractor SHALL GIVE NOTICE to Principal Agent of intention to claim, FAILING WHICH THE CONTRACTOR SHALL FORFEIT SUCH CLAIM.",
        timeBarDays: 20,
        timeBarType: "working_days",
        contractorRightOrDuty: "Strict 20 working-day forfeiture rule. Claim must follow within 40 working days of quantification (23.5).",
        employerRightOrDuty: "Protected from late delay claims.",
        engineerRole: "PA must grant, reduce or refuse claim within 20 working days (23.7); deemed refused if PA fails to act (23.8).",
        practicalGuidance: "Distinguish between Clause 23.1 (no contract value adjustment) and Clause 23.2 (with contract value adjustment)."
      },
      {
        clauseNumber: "Clause 25.10 & 25.7.4",
        title: "Payment & Default Interest",
        topic: "payment_certificates",
        summary: "Employer shall pay Contractor certified amount within fourteen (14) calendar days of payment certificate issue. If unpaid, Default Interest accrues at 6% points above ruling bank rate compounded monthly from due date (25.7.4). Compensatory interest due after 31 calendar days of PC (25.7.5).",
        timeBarDays: 14,
        timeBarType: "calendar_days",
        contractorRightOrDuty: "If partial/no payment after 5 working days notice, Contractor may suspend works (25.14.1), exercise lien (25.14.2), or call payment guarantee (25.14.3).",
        employerRightOrDuty: "Strict 14 calendar days payment window.",
        engineerRole: "PA calculates Default and Compensatory interest in monthly Recovery Statement (25.7).",
        practicalGuidance: "High penalty interest (Bank rate + 6%) protects contractor cashflow against late public/private disbursements."
      },
      {
        clauseNumber: "Clause 26.5",
        title: "Claim for Adjustment of Contract Value (Expense and Loss)",
        topic: "claims_procedure",
        summary: "Contractor shall give notice to Principal Agent within TWENTY (20) WORKING DAYS of becoming aware of expense and/or loss for which provision was not required in contract sum, FAILING WHICH SUCH CLAIM SHALL BE FORFEITED. Detailed claim submitted within 40 WD (26.6).",
        timeBarDays: 20,
        timeBarType: "working_days",
        contractorRightOrDuty: "Must submit notice within 20 working days to preserve right to reimbursement for disruption/direct contractors.",
        employerRightOrDuty: "Protected from historical retrospective expense claims.",
        engineerRole: "PA makes fair assessment within 20 working days of receipt (26.7).",
        practicalGuidance: "Applies to direct contractor delays (16.1.3), late information (12.1.12), or employer defaults."
      },
      {
        clauseNumber: "Clause 30.0",
        title: "Dispute Resolution (Disagreement -> Adjudication -> Arbitration)",
        topic: "dispute_resolution",
        summary: "Notice of disagreement (30.1). If unresolved in 10 working days, deemed a dispute (30.2). Referred to Adjudication within 10 working days (30.3). Adjudicator nominated by nominating body [CD]; determination is immediately binding (30.6.3). Dissatisfaction notice within 10 working days (30.6.4) leads to Arbitration (30.7).",
        timeBarDays: 10,
        timeBarType: "working_days",
        contractorRightOrDuty: "Fast-track 10-working-day steps for swift dispute adjudication.",
        employerRightOrDuty: "Must give effect to Adjudicator's determination immediately.",
        engineerRole: "Arbitrator has power to open up, review and revise any certificate, opinion or instruction (30.7.6).",
        practicalGuidance: "Parties may agree at any time to refer dispute to mediation under Clause 30.8."
      }
    ]
  }
};

/**
 * Comparative Clause Mapping across Standard Frameworks
 */
export interface CrossFrameworkClauseMapping {
  topic: string;
  topicTitle: string;
  fidic2017: { clause: string; timeBar: string; ruleSummary: string };
  fidic1999: { clause: string; timeBar: string; ruleSummary: string };
  nec4: { clause: string; timeBar: string; ruleSummary: string };
  gcc2015: { clause: string; timeBar: string; ruleSummary: string };
  jbcc62: { clause: string; timeBar: string; ruleSummary: string };
}

export const CROSS_FRAMEWORK_COMPARATIVE_MATRIX: CrossFrameworkClauseMapping[] = [
  {
    topic: "notice_of_claim",
    topicTitle: "Contractor Notice of Delay / Claim Time-Bar",
    fidic2017: {
      clause: "Sub-Clause 20.2.1",
      timeBar: "28 Calendar Days",
      ruleSummary: "Strict time-bar: failure to notify within 28 days of awareness discharges Employer from all liability. Detailed claim within 84 days (20.2.4)."
    },
    fidic1999: {
      clause: "Sub-Clause 20.1",
      timeBar: "28 Calendar Days",
      ruleSummary: "Notice within 28 days of awareness; detailed particulars within 42 days; 42-day Engineer response."
    },
    nec4: {
      clause: "Clause 61.3",
      timeBar: "8 Weeks (56 Calendar Days)",
      ruleSummary: "Strict 8-week notification window for Contractor-notified Compensation Events. Quotation within 3 weeks (Clause 62)."
    },
    gcc2015: {
      clause: "Clause 10.1.1.1",
      timeBar: "28 Calendar Days",
      ruleSummary: "Strict 28-day notice rule; monthly updating particulars (10.1.1.3); final claim within 28 days of cessation; Employer's Agent rules in 28 days (10.1.5)."
    },
    jbcc62: {
      clause: "Clause 23.4.2 & 26.5",
      timeBar: "20 Working Days",
      ruleSummary: "Strict forfeiture if notice of intention not given in 20 working days. Quantified claim within 40 working days (23.5/26.6)."
    }
  },
  {
    topic: "early_warning",
    topicTitle: "Early Warning & Risk Register",
    fidic2017: {
      clause: "Sub-Clause 8.4",
      timeBar: "As soon as practicable",
      ruleSummary: "Advance Warning to advise of events increasing price or delaying execution; Engineer may request proposal under 13.3.2."
    },
    fidic1999: {
      clause: "Sub-Clause 8.3 / Particular Conditions",
      timeBar: "As required",
      ruleSummary: "General notice of probable future events in monthly reports (Sub-Clause 4.21)."
    },
    nec4: {
      clause: "Clause 15.1 - 15.4",
      timeBar: "Immediately upon awareness",
      ruleSummary: "Mandatory Early Warning Register. First meeting within 2 weeks of starting date; updated register within 1 week. Penalty in CE assessment for failure (61.5)."
    },
    gcc2015: {
      clause: "Clause 5.6.2.4",
      timeBar: "In Programme submission",
      ruleSummary: "Contractor includes float and Time Risk Allowances (TRA) in programme of works."
    },
    jbcc62: {
      clause: "Clause 12.2.11 & 23.4.1",
      timeBar: "Regularly in progress report",
      ruleSummary: "Regular schedule of outstanding construction information and reasonable mitigation steps."
    }
  },
  {
    topic: "payment_certification",
    topicTitle: "Payment Certification & Payment Window",
    fidic2017: {
      clause: "Sub-Clauses 14.6 & 14.7",
      timeBar: "28d IPC / 56d Payment",
      ruleSummary: "Engineer issues IPC within 28 days of Statement; Employer pays within 56 days of Statement receipt. Advance payment in 21 days."
    },
    fidic1999: {
      clause: "Sub-Clauses 14.6 & 14.7",
      timeBar: "28d IPC / 56d Payment",
      ruleSummary: "Engineer issues IPC within 28 days; Employer pays within 56 days of statement."
    },
    nec4: {
      clause: "Clauses 50.1, 51.1, 51.2",
      timeBar: "1 week cert / 3 weeks pay",
      ruleSummary: "PM assesses at assessment date, certifies within 1 week; Client pays within 3 weeks of assessment date."
    },
    gcc2015: {
      clause: "Clause 6.10.4",
      timeBar: "7d cert / 28d pay",
      ruleSummary: "Employer's Agent certifies within 7 days of statement; Employer pays within 28 days of receiving certificate."
    },
    jbcc62: {
      clause: "Clauses 25.2 & 25.10",
      timeBar: "Monthly cert / 14 CD pay",
      ruleSummary: "PA issues payment certificate by agreed monthly date; Employer pays within 14 calendar days of certificate issue."
    }
  },
  {
    topic: "delayed_payment_interest",
    topicTitle: "Late Payment Financing Charges / Interest",
    fidic2017: {
      clause: "Sub-Clause 14.8",
      timeBar: "Automatic on request",
      ruleSummary: "3% per annum above central bank discount rate, compounded monthly. Payable on request without formal notice."
    },
    fidic1999: {
      clause: "Sub-Clause 14.8",
      timeBar: "Automatic on request",
      ruleSummary: "3% per annum above central bank discount rate, compounded monthly."
    },
    nec4: {
      clause: "Clause 51.4",
      timeBar: "From due date",
      ruleSummary: "Calculated on a daily basis at the interest rate in Contract Data, compounded annually."
    },
    gcc2015: {
      clause: "Clause 6.10.6.2",
      timeBar: "Compounded monthly",
      ruleSummary: "Prime overdraft rate charged by Contractor's Bank, compounded monthly from due date."
    },
    jbcc62: {
      clause: "Clause 25.7.4 & 25.7.5",
      timeBar: "Compounded monthly",
      ruleSummary: "Default Interest at 6 percentage points above ruling bank rate compounded monthly. Compensatory interest after 31 days of PC."
    }
  },
  {
    topic: "unforeseen_physical_conditions",
    topicTitle: "Unforeseen Physical & Ground Conditions",
    fidic2017: {
      clause: "Sub-Clause 4.12",
      timeBar: "Notice in good time / 7d inspection",
      ruleSummary: "Unforeseeable physical conditions on site entitle Contractor to EOT and Cost (excluding profit). Engineer inspects within 7 days."
    },
    fidic1999: {
      clause: "Sub-Clause 4.12",
      timeBar: "Notice as soon as practicable",
      ruleSummary: "EOT and Cost if physical conditions could not reasonably have been foreseen by experienced contractor at Base Date."
    },
    nec4: {
      clause: "Clause 60.1(12)",
      timeBar: "8 weeks (Clause 61.3)",
      ruleSummary: "Compensation Event for physical conditions within Site that experienced contractor would have judged to have small chance of occurring."
    },
    gcc2015: {
      clause: "Clause 2.2 & 10.1",
      timeBar: "28 days (Clause 10.1.1.1)",
      ruleSummary: "Adverse physical conditions or artificial obstructions not reasonably foreseeable entitle Contractor to EOT and proven cost."
    },
    jbcc62: {
      clause: "Clause 23.2.12 & 13.2.4",
      timeBar: "20 working days (23.4.2)",
      ruleSummary: "Suspension for undocumented relics/services (13.2.4); revision of Practical Completion date and adjustment of contract value (23.2)."
    }
  },
  {
    topic: "contractor_suspension",
    topicTitle: "Contractor Right to Suspend Works",
    fidic2017: {
      clause: "Sub-Clause 16.1",
      timeBar: "21 Calendar Days Notice",
      ruleSummary: "Suspend on 21 days notice for failure to certify IPC (14.6), no financial evidence (2.4), non-payment (14.7), or DAAB failure. Entitled to EOT + Cost Plus Profit."
    },
    fidic1999: {
      clause: "Sub-Clause 16.1",
      timeBar: "21 Calendar Days Notice",
      ruleSummary: "Suspend on 21 days notice for failure to certify, no financial arrangements (2.4), or non-payment. EOT + Cost plus reasonable profit."
    },
    nec4: {
      clause: "Secondary Option Y(UK)2.5 / 91.4",
      timeBar: "7 days under Housing Grants Act",
      ruleSummary: "Right to suspend under Housing Grants Act for non-payment; or terminate under R16 if unpaid after 13 weeks."
    },
    gcc2015: {
      clause: "Clause 5.11.1",
      timeBar: "14 Calendar Days Notice",
      ruleSummary: "Suspend on 14 days written notice for non-issue of payment certificate or non-payment. Claim delay and proven cost under 10.1."
    },
    jbcc62: {
      clause: "Clause 28.1 & 25.14.1",
      timeBar: "10 Working Days / 5 WD notice",
      ruleSummary: "Suspend on 10 working days notice for no payment guarantee (28.1.1), late certificate (28.1.2), non-payment (28.1.3), or 5 WD notice under 25.14.1."
    }
  },
  {
    topic: "dispute_resolution_hierarchy",
    topicTitle: "Dispute Resolution Hierarchy",
    fidic2017: {
      clause: "Clauses 3.7 -> 21.4 -> 21.5 -> 21.6",
      timeBar: "42d DAAB -> 84d Decision -> 28d NOD -> 28d Amicable -> ICC",
      ruleSummary: "Engineer 3.7 Determination -> Standing DAAB (84d decision) -> 28d NOD -> 28d Amicable Settlement -> ICC International Arbitration."
    },
    fidic1999: {
      clause: "Clauses 3.5 -> 20.2 -> 20.5 -> 20.6",
      timeBar: "DAB 84d -> 28d NOD -> 56d Amicable -> ICC",
      ruleSummary: "Engineer 3.5 Determination -> DAB (84d decision) -> 28d Notice of Dissatisfaction -> 56d Amicable Settlement -> ICC Arbitration."
    },
    nec4: {
      clause: "Option W1 / W2 / W3",
      timeBar: "Senior Reps (3 wks) -> Adjudicator (4 wks) -> Tribunal (4 wks)",
      ruleSummary: "Senior Representatives negotiation -> Adjudicator (4 weeks decision) -> Tribunal (Arbitration/Litigation within 4 weeks of decision)."
    },
    gcc2015: {
      clause: "Clauses 10.1.5 -> 10.2 -> 10.3 -> 10.4 -> 10.5 -> 10.7",
      timeBar: "28d EA Ruling -> 28d Dissatisfaction -> 14d Amicable -> 28d Adjudication",
      ruleSummary: "Employer's Agent Ruling (28d) -> Dissatisfaction Claim (28d) -> Dispute Notice (28d) -> Amicable Settlement -> Adjudication (28d) -> Arbitration."
    },
    jbcc62: {
      clause: "Clause 30.1 -> 30.2 -> 30.3 -> 30.6 -> 30.7",
      timeBar: "10 WD Disagreement -> 10 WD Dispute -> 10 WD Adjudication",
      ruleSummary: "Disagreement (10 WD) -> Deemed Dispute (10 WD) -> Adjudication Notice (10 WD) -> Adjudicator Determination -> 10 WD Dissatisfaction -> Arbitration."
    }
  }
];

/**
 * Helper to get the Contract Framework profile for a given project contract type string
 */
export function getContractStandardByFrameworkName(frameworkName: string): ContractStandardSuite {
  const fLower = (frameworkName || "").toLowerCase();
  if (fLower.includes("nec4") || fLower.includes("nec 4")) {
    return CONTRACT_STANDARDS_DATABASE["NEC4_ECC"];
  }
  if (fLower.includes("nec3") || fLower.includes("nec 3") || fLower.includes("subcontract")) {
    return CONTRACT_STANDARDS_DATABASE["NEC4_ECC"]; // Core concepts aligned
  }
  if (fLower.includes("gcc") || fLower.includes("saice") || fLower.includes("general conditions of contract 2015")) {
    return CONTRACT_STANDARDS_DATABASE["GCC_2015"];
  }
  if (fLower.includes("jbcc") || fLower.includes("principal building agreement") || fLower.includes("building")) {
    return CONTRACT_STANDARDS_DATABASE["JBCC_6_2"];
  }
  if (fLower.includes("1999")) {
    return CONTRACT_STANDARDS_DATABASE["FIDIC_1999_RED"];
  }
  // Default to FIDIC 2017 Red Book
  return CONTRACT_STANDARDS_DATABASE["FIDIC_2017_RED"];
}
