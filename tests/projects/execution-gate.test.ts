import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakePrisma } from "../setup/fakePrisma";

// "Changed - Working Logic" branch: the 60% advance payment gates task/
// trial creation (lib/projects/execution-gate.ts). These pin down the gate
// itself — not the payment-verify route that flips it, which is a thin
// wrapper around Prisma writes better covered by an integration test once
// this sandbox can reach a real Postgres (see tests/setup/fakePrisma.ts's
// header comment).

const lockedProject = { id: "locked", clientOrgId: "org-1", targetDate: null, advancePaymentVerifiedAt: null };
const unlockedProject = {
  id: "unlocked",
  clientOrgId: "org-1",
  targetDate: null,
  advancePaymentVerifiedAt: new Date("2026-01-01"),
};

const fakePrisma = createFakePrisma({ projects: [lockedProject, unlockedProject] });

vi.mock("@/lib/prisma", () => ({ get prisma() { return fakePrisma; } }));

const { assertExecutionUnlocked, isExecutionUnlocked } = await import("@/lib/projects/execution-gate");
const { ValidationError } = await import("@/lib/api/respond");

describe("execution gate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reports a project with no verified advance as locked", async () => {
    expect(await isExecutionUnlocked("locked")).toBe(false);
  });

  it("reports a project with a verified advance as unlocked", async () => {
    expect(await isExecutionUnlocked("unlocked")).toBe(true);
  });

  it("reports a project that doesn't exist as locked (fails closed)", async () => {
    expect(await isExecutionUnlocked("no-such-project")).toBe(false);
  });

  it("throws ValidationError for a locked project", async () => {
    await expect(assertExecutionUnlocked("locked")).rejects.toBeInstanceOf(ValidationError);
  });

  it("does not throw for an unlocked project", async () => {
    await expect(assertExecutionUnlocked("unlocked")).resolves.toBeUndefined();
  });

  it("throws ValidationError (not a 500) for a project that doesn't exist", async () => {
    await expect(assertExecutionUnlocked("no-such-project")).rejects.toBeInstanceOf(ValidationError);
  });
});
