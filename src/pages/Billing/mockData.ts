/**
 * ==============================================================================
 * ProjectMatrix Billing — Demonstration Mock Data Fixtures
 * ==============================================================================
 * NOTE: This file provides typed local mock data for Phase 1 frontend interface
 * verification. Illustrative amounts, currencies (ZAR), and subscription codes
 * do NOT reflect live payment records or database backend state.
 * ==============================================================================
 */

import { SubscriptionItem } from "./types";

export function getDemoSubscriptions(companyName: string = "Matrix Construction (Pty) Ltd"): SubscriptionItem[] {
  return [
    {
      id: "sub-demo-001",
      subscriptionCode: "SUB-2026-9842-ENT",
      planName: "ProjectMatrix Enterprise ERP Suite",
      associatedEntity: companyName,
      status: "active",
      billingInterval: "annual",
      amount: 48500.0,
      currency: "ZAR",
      formattedAmount: "R 48,500.00 / year",
      nextRenewalDate: "15 Jan 2027",
      autoRenewal: "enabled",
      autoRenewalAvailable: true,
      noticeMessage: "Next annual renewal is scheduled for 15 Jan 2027. Primary payment method will be charged automatically."
    },
    {
      id: "sub-demo-002",
      subscriptionCode: "SUB-2026-1149-ADV",
      planName: "Project Advisor AI Copilot",
      associatedEntity: `${companyName} (Engineering Hub)`,
      status: "active",
      billingInterval: "monthly",
      amount: 4800.0,
      currency: "ZAR",
      formattedAmount: "R 4,800.00 / month",
      nextRenewalDate: "01 Sep 2026",
      autoRenewal: "enabled",
      autoRenewalAvailable: true
    },
    {
      id: "sub-demo-003",
      subscriptionCode: "SUB-2026-3391-BIM",
      planName: "BIM & CAD Sync Suite",
      associatedEntity: "Infrastructure Division",
      status: "trial",
      billingInterval: "monthly",
      amount: 6200.0,
      currency: "ZAR",
      formattedAmount: "R 6,200.00 / month",
      nextRenewalDate: "19 Aug 2026",
      autoRenewal: "disabled",
      autoRenewalAvailable: true,
      noticeMessage: "Complimentary trial period expires in 5 days."
    },
    {
      id: "sub-demo-004",
      subscriptionCode: "SUB-2026-7721-STR",
      planName: "Site Diary Cloud Archive",
      associatedEntity: "Central Storage Pool",
      status: "payment_pending",
      billingInterval: "monthly",
      amount: 1950.0,
      currency: "ZAR",
      formattedAmount: "R 1,950.00 / month",
      nextRenewalDate: "12 Sep 2026",
      autoRenewal: "enabled",
      autoRenewalAvailable: true,
      noticeMessage: "Scheduled payment is currently processing."
    },
    {
      id: "sub-demo-005",
      subscriptionCode: "SUB-2026-5510-PAY",
      planName: "Labour Payroll Engine",
      associatedEntity: "Workforce Management Dept",
      status: "past_due",
      billingInterval: "monthly",
      amount: 3450.0,
      currency: "ZAR",
      formattedAmount: "R 3,450.00 / month",
      nextRenewalDate: "28 Aug 2026",
      autoRenewal: "disabled",
      autoRenewalAvailable: true,
      noticeMessage: "Payment attempt was unsuccessful. Grace period is currently active."
    },
    {
      id: "sub-demo-006",
      subscriptionCode: "SUB-2026-0824-DRN",
      planName: "Drone Surveying Add-on",
      associatedEntity: "Earthworks Division",
      status: "expired",
      billingInterval: "quarterly",
      amount: 9800.0,
      currency: "ZAR",
      formattedAmount: "R 9,800.00 / quarter",
      nextRenewalDate: "Expired (30 Jun 2026)",
      autoRenewal: "disabled",
      autoRenewalAvailable: false,
      autoRenewalIneligibleReason: "Renew this subscription before enabling auto-renewal.",
      noticeMessage: "Subscription expired on 30 Jun 2026."
    },
    {
      id: "sub-demo-007",
      subscriptionCode: "SUB-2025-4190-FLT",
      planName: "Fleet Telematics Integration",
      associatedEntity: "Plant & Equipment Depot",
      status: "cancelled",
      billingInterval: "monthly",
      amount: 2200.0,
      currency: "ZAR",
      formattedAmount: "R 2,200.00 / month",
      nextRenewalDate: "Terminated (31 May 2026)",
      autoRenewal: "not_applicable",
      autoRenewalAvailable: false,
      autoRenewalIneligibleReason: "Auto-renewal is not available for cancelled subscriptions.",
      noticeMessage: "Subscription was cancelled."
    }
  ];
}
