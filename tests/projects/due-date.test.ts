import { describe, it, expect, vi } from "vitest";
import { createFakePrisma } from "../setup/fakePrisma";

// Covers the bug the user flagged directly (a task/milestone due date
// exceeding its project's target date) and the reverse direction (shrinking
// a project's target date below an already-scheduled task/milestone) — see
// README.md's "Projects, Tasks & Milestones, as built" section for the
// full fix across both directions.

const projectWithTarget = { id: "proj-1", clientOrgId: "org-1", targetDate: new Date("2026-06-30") };
const projectNoTarget = { id: "proj-2", clientOrgId: "org-1", targetDate: null };

const fakePrisma = createFakePrisma({
  projects: [projectWithTarget, projectNoTarget],
  tasks: [{ id: "task-1", projectId: "proj-1", dueDate: new Date("2026-06-15") }],
  milestones: [{ id: "ms-1", projectId: "proj-1", dueDate: new Date("2026-06-20") }],
});

vi.mock("@/lib/prisma", () => ({ get prisma() { return fakePrisma; } }));

const { assertDueDateWithinProject, assertNoLaterDueDatesThan } = await import("@/lib/projects/due-date");
const { ValidationError } = await import("@/lib/api/respond");

describe("assertDueDateWithinProject", () => {
  it("allows a due date on or before the project's target date", async () => {
    await expect(assertDueDateWithinProject(new Date("2026-06-30"), "proj-1")).resolves.toBeUndefined();
    await expect(assertDueDateWithinProject(new Date("2026-05-01"), "proj-1")).resolves.toBeUndefined();
  });

  it("rejects a due date after the project's target date", async () => {
    await expect(assertDueDateWithinProject(new Date("2026-07-01"), "proj-1")).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it("allows any due date when the project has no target date set", async () => {
    await expect(assertDueDateWithinProject(new Date("2099-01-01"), "proj-2")).resolves.toBeUndefined();
  });

  it("allows a null/undefined due date unconditionally", async () => {
    await expect(assertDueDateWithinProject(null, "proj-1")).resolves.toBeUndefined();
    await expect(assertDueDateWithinProject(undefined, "proj-1")).resolves.toBeUndefined();
  });
});

describe("assertNoLaterDueDatesThan (shrinking a project's own target date)", () => {
  it("allows a new target date on or after every existing task/milestone due date", async () => {
    await expect(assertNoLaterDueDatesThan(new Date("2026-06-20"), "proj-1")).resolves.toBeUndefined();
  });

  it("rejects a new target date earlier than an already-scheduled task", async () => {
    await expect(assertNoLaterDueDatesThan(new Date("2026-06-10"), "proj-1")).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it("rejects a new target date earlier than an already-scheduled milestone", async () => {
    await expect(assertNoLaterDueDatesThan(new Date("2026-06-18"), "proj-1")).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it("allows any new target date for a project with no scheduled tasks/milestones", async () => {
    await expect(assertNoLaterDueDatesThan(new Date("2020-01-01"), "proj-2")).resolves.toBeUndefined();
  });
});
