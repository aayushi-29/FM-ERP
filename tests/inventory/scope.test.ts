import { describe, it, expect } from "vitest";
import { canManageInventory, canReadInventory, canApproveMaterials } from "@/lib/inventory/scope";

// Pins down lib/inventory/scope.ts's access rules for the new
// Supplier/RawMaterial UI: NPD Executive manages day-to-day, Project Lead
// can read but not write, Client has no access at all.

describe("inventory authorization", () => {
  it("lets ADMIN and NPD_EXECUTIVE manage suppliers/raw materials", () => {
    expect(canManageInventory("ADMIN")).toBe(true);
    expect(canManageInventory("NPD_EXECUTIVE")).toBe(true);
    expect(canManageInventory("PROJECT_LEAD")).toBe(false);
    expect(canManageInventory("CLIENT")).toBe(false);
  });

  it("lets PROJECT_LEAD read but not manage", () => {
    expect(canReadInventory("PROJECT_LEAD")).toBe(true);
    expect(canManageInventory("PROJECT_LEAD")).toBe(false);
  });

  it("excludes CLIENT from read access entirely", () => {
    expect(canReadInventory("CLIENT")).toBe(false);
  });

  // 29 Oct 2026 (fourth pass): materials-approval workflow, confirmed with
  // the user — Project Lead gets a narrow new power (approve/reject a
  // material NPD Executive submitted) without gaining canManageInventory's
  // broader create/edit access.
  it("lets ADMIN and PROJECT_LEAD approve materials, but not NPD_EXECUTIVE or CLIENT", () => {
    expect(canApproveMaterials("ADMIN")).toBe(true);
    expect(canApproveMaterials("PROJECT_LEAD")).toBe(true);
    expect(canApproveMaterials("NPD_EXECUTIVE")).toBe(false);
    expect(canApproveMaterials("CLIENT")).toBe(false);
  });

  it("doesn't widen PROJECT_LEAD's canManageInventory just because it can approve", () => {
    expect(canApproveMaterials("PROJECT_LEAD")).toBe(true);
    expect(canManageInventory("PROJECT_LEAD")).toBe(false);
  });
});
