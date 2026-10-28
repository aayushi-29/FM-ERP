import { describe, it, expect, vi } from "vitest";

// "Changed - Working Logic" branch, 29 Oct 2026: the Proposal workflow gate
// on lead conversion (lib/crm/proposals.ts). Pins down the gate logic
// itself, independent of the route around it — same convention as
// tests/projects/execution-gate.test.ts.

type FakeProposal = { id: string; leadId: string; status: string };

function fakePrisma(proposals: FakeProposal[]) {
  return {
    proposal: {
      findFirst: async ({ where }: { where: { leadId: string; status: string | { in: string[] } } }) => {
        const match = proposals.find((p) => {
          if (p.leadId !== where.leadId) return false;
          if (typeof where.status === "string") return p.status === where.status;
          return where.status.in.includes(p.status);
        });
        return match ? { ...match } : null;
      },
    },
  };
}

describe("assertLeadHasAcceptedProposal", () => {
  it("throws when the lead has no proposal at all", async () => {
    vi.resetModules();
    vi.doMock("@/lib/prisma", () => ({ prisma: fakePrisma([]) }));
    const { assertLeadHasAcceptedProposal } = await import("@/lib/crm/proposals");
    const { ValidationError } = await import("@/lib/api/respond");
    await expect(assertLeadHasAcceptedProposal("lead-1")).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws when the lead's proposal is sent but not yet accepted", async () => {
    vi.resetModules();
    vi.doMock("@/lib/prisma", () => ({ prisma: fakePrisma([{ id: "p1", leadId: "lead-1", status: "SENT" }]) }));
    const { assertLeadHasAcceptedProposal } = await import("@/lib/crm/proposals");
    const { ValidationError } = await import("@/lib/api/respond");
    await expect(assertLeadHasAcceptedProposal("lead-1")).rejects.toBeInstanceOf(ValidationError);
  });

  it("does not throw once an ACCEPTED proposal exists for the lead", async () => {
    vi.resetModules();
    vi.doMock("@/lib/prisma", () => ({ prisma: fakePrisma([{ id: "p1", leadId: "lead-1", status: "ACCEPTED" }]) }));
    const { assertLeadHasAcceptedProposal } = await import("@/lib/crm/proposals");
    await expect(assertLeadHasAcceptedProposal("lead-1")).resolves.toBeUndefined();
  });
});

describe("assertNoOpenProposal", () => {
  it("throws when a DRAFT/INTERNAL_REVIEW/SENT proposal already exists", async () => {
    vi.resetModules();
    vi.doMock("@/lib/prisma", () => ({ prisma: fakePrisma([{ id: "p1", leadId: "lead-1", status: "DRAFT" }]) }));
    const { assertNoOpenProposal } = await import("@/lib/crm/proposals");
    const { ValidationError } = await import("@/lib/api/respond");
    await expect(assertNoOpenProposal("lead-1")).rejects.toBeInstanceOf(ValidationError);
  });

  it("does not throw when the lead's only proposal is ACCEPTED or REVISION_REQUESTED", async () => {
    vi.resetModules();
    vi.doMock("@/lib/prisma", () => ({ prisma: fakePrisma([{ id: "p1", leadId: "lead-1", status: "ACCEPTED" }]) }));
    const { assertNoOpenProposal } = await import("@/lib/crm/proposals");
    await expect(assertNoOpenProposal("lead-1")).resolves.toBeUndefined();
  });

  it("does not throw when the lead has no proposals yet", async () => {
    vi.resetModules();
    vi.doMock("@/lib/prisma", () => ({ prisma: fakePrisma([]) }));
    const { assertNoOpenProposal } = await import("@/lib/crm/proposals");
    await expect(assertNoOpenProposal("lead-1")).resolves.toBeUndefined();
  });
});
