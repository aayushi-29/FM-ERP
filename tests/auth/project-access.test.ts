import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFakePrisma } from "../setup/fakePrisma";

// assertProjectAccess (lib/auth/rbac.ts) is the single record-level gate
// baseline §4 relies on everywhere a Project is touched — these tests pin
// down exactly what it's supposed to prevent: a Client reaching into
// another organization's project, and a Project Lead / NPD Executive
// reaching into a project they were never assigned to. Admin always
// passes (org-wide by design) and is included as a control case.

const projectA = { id: "project-a", clientOrgId: "org-1", targetDate: null };
const projectB = { id: "project-b", clientOrgId: "org-2", targetDate: null };

const fakePrisma = createFakePrisma({
  projects: [projectA, projectB],
  assignments: [{ userId: "lead-1", projectId: "project-a" }],
});

vi.mock("@/lib/prisma", () => ({ get prisma() { return fakePrisma; } }));

const { assertProjectAccess, ForbiddenError } = await import("@/lib/auth/rbac");

function user(overrides: Partial<{ id: string; role: string; clientOrgId: string | null }>) {
  return {
    id: "u1",
    email: "u@example.com",
    name: "Test user",
    role: "CLIENT",
    clientOrgId: null,
    ...overrides,
  } as any;
}

describe("assertProjectAccess", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lets ADMIN into any project regardless of org or assignment", async () => {
    await expect(assertProjectAccess(user({ role: "ADMIN" }), "project-a")).resolves.toBeUndefined();
    await expect(assertProjectAccess(user({ role: "ADMIN" }), "project-b")).resolves.toBeUndefined();
  });

  it("lets a CLIENT into their own org's project", async () => {
    await expect(
      assertProjectAccess(user({ role: "CLIENT", clientOrgId: "org-1" }), "project-a")
    ).resolves.toBeUndefined();
  });

  it("blocks a CLIENT from a different organization's project (cross-client isolation)", async () => {
    await expect(
      assertProjectAccess(user({ role: "CLIENT", clientOrgId: "org-2" }), "project-a")
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("blocks a CLIENT with no org at all", async () => {
    await expect(
      assertProjectAccess(user({ role: "CLIENT", clientOrgId: null }), "project-a")
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lets a PROJECT_LEAD into a project they're explicitly assigned to", async () => {
    await expect(
      assertProjectAccess(user({ id: "lead-1", role: "PROJECT_LEAD" }), "project-a")
    ).resolves.toBeUndefined();
  });

  it("blocks a PROJECT_LEAD from a project they're not assigned to (assignment boundary)", async () => {
    await expect(
      assertProjectAccess(user({ id: "lead-1", role: "PROJECT_LEAD" }), "project-b")
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("blocks an NPD_EXECUTIVE from a project they're not assigned to", async () => {
    await expect(
      assertProjectAccess(user({ id: "npd-1", role: "NPD_EXECUTIVE" }), "project-a")
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("blocks access to a project that doesn't exist", async () => {
    await expect(
      assertProjectAccess(user({ role: "CLIENT", clientOrgId: "org-1" }), "no-such-project")
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
