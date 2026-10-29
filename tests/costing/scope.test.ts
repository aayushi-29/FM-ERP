import { describe, it, expect } from "vitest";
import {
  canReadCosting,
  canManageCosting,
  canReadInvoices,
  canManageInvoices,
  isInvoiceVisibleToClient,
} from "@/lib/costing/scope";

// Pins down the baseline §4 permission matrix for Costing and
// Invoices/Payments exactly as lib/costing/scope.ts documents it: NPD
// Executive has no access to either, Client gets invoice visibility but
// never cost-sheet visibility, and only Admin can manage/write either.

describe("costing authorization matrix", () => {
  it("lets only ADMIN and PROJECT_LEAD read cost sheets", () => {
    expect(canReadCosting("ADMIN")).toBe(true);
    expect(canReadCosting("PROJECT_LEAD")).toBe(true);
    expect(canReadCosting("NPD_EXECUTIVE")).toBe(false);
    expect(canReadCosting("CLIENT")).toBe(false);
  });

  it("lets only ADMIN manage (create/edit) cost sheets", () => {
    expect(canManageCosting("ADMIN")).toBe(true);
    expect(canManageCosting("PROJECT_LEAD")).toBe(false);
    expect(canManageCosting("NPD_EXECUTIVE")).toBe(false);
    expect(canManageCosting("CLIENT")).toBe(false);
  });

  it("lets ADMIN, PROJECT_LEAD and CLIENT read invoices, but not NPD_EXECUTIVE", () => {
    expect(canReadInvoices("ADMIN")).toBe(true);
    expect(canReadInvoices("PROJECT_LEAD")).toBe(true);
    expect(canReadInvoices("CLIENT")).toBe(true);
    expect(canReadInvoices("NPD_EXECUTIVE")).toBe(false);
  });

  it("lets only ADMIN manage (create/send/record payments on) invoices", () => {
    expect(canManageInvoices("ADMIN")).toBe(true);
    expect(canManageInvoices("PROJECT_LEAD")).toBe(false);
    expect(canManageInvoices("CLIENT")).toBe(false);
  });

  it("hides DRAFT invoices from a Client but shows everything from SENT onward", () => {
    expect(isInvoiceVisibleToClient("DRAFT")).toBe(false);
    expect(isInvoiceVisibleToClient("SENT")).toBe(true);
    expect(isInvoiceVisibleToClient("PARTIALLY_PAID")).toBe(true);
    expect(isInvoiceVisibleToClient("PAID")).toBe(true);
    expect(isInvoiceVisibleToClient("CANCELLED")).toBe(true);
  });

  // "Changed - Working Logic" branch, 29 Oct 2026 (second pass), item #3:
  // MRP visibility was explicitly required NOT to touch canReadCosting —
  // the client-facing MRP number is read through a separate query
  // (app/projects/[id]/page.tsx), never through this gate. Re-asserts the
  // same CLIENT/NPD_EXECUTIVE denial as the first test above, specifically
  // as a regression guard for that item.
  it("still denies CLIENT and NPD_EXECUTIVE any CostSheet access after the MRP-visibility item", () => {
    expect(canReadCosting("CLIENT")).toBe(false);
    expect(canReadCosting("NPD_EXECUTIVE")).toBe(false);
  });
});
