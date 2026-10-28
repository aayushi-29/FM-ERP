import { describe, it, expect } from "vitest";
import { canUploadType, canManageVisibility } from "@/lib/documents/scope";

// Pins down the upload-type-by-role matrix (lib/documents/scope.ts's own
// documented interpretation flag) so a future edit can't silently widen or
// narrow what a role may upload without a test noticing.

describe("canUploadType", () => {
  it("lets ADMIN and PROJECT_LEAD upload every document type", () => {
    const allTypes = ["CONTRACT", "TECHNICAL_SPEC", "FORMULATION_SUMMARY", "TRIAL_RECORD", "COMMERCIAL", "OTHER"] as const;
    for (const type of allTypes) {
      expect(canUploadType("ADMIN" as any, type as any)).toBe(true);
      expect(canUploadType("PROJECT_LEAD" as any, type as any)).toBe(true);
    }
  });

  it("limits NPD_EXECUTIVE to technical document types only", () => {
    expect(canUploadType("NPD_EXECUTIVE" as any, "TECHNICAL_SPEC" as any)).toBe(true);
    expect(canUploadType("NPD_EXECUTIVE" as any, "TRIAL_RECORD" as any)).toBe(true);
    expect(canUploadType("NPD_EXECUTIVE" as any, "CONTRACT" as any)).toBe(false);
    expect(canUploadType("NPD_EXECUTIVE" as any, "COMMERCIAL" as any)).toBe(false);
    expect(canUploadType("NPD_EXECUTIVE" as any, "FORMULATION_SUMMARY" as any)).toBe(false);
  });

  it("limits CLIENT to OTHER only — never an internal-looking type", () => {
    expect(canUploadType("CLIENT" as any, "OTHER" as any)).toBe(true);
    expect(canUploadType("CLIENT" as any, "CONTRACT" as any)).toBe(false);
    expect(canUploadType("CLIENT" as any, "COMMERCIAL" as any)).toBe(false);
    expect(canUploadType("CLIENT" as any, "TECHNICAL_SPEC" as any)).toBe(false);
    expect(canUploadType("CLIENT" as any, "FORMULATION_SUMMARY" as any)).toBe(false);
    expect(canUploadType("CLIENT" as any, "TRIAL_RECORD" as any)).toBe(false);
  });
});

describe("canManageVisibility", () => {
  it("lets only ADMIN and PROJECT_LEAD change a document's visibility", () => {
    expect(canManageVisibility("ADMIN" as any)).toBe(true);
    expect(canManageVisibility("PROJECT_LEAD" as any)).toBe(true);
    expect(canManageVisibility("NPD_EXECUTIVE" as any)).toBe(false);
    expect(canManageVisibility("CLIENT" as any)).toBe(false);
  });
});
