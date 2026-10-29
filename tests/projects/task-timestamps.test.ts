import { describe, it, expect } from "vitest";
import { computeAssignedAt, computeCompletedAt } from "@/lib/projects/task-timestamps";

// "Changed - Working Logic" branch, 29 Oct 2026 (second pass), item #4:
// Task.assignedAt/.completedAt. Pins down the pure decision logic,
// independent of the PATCH route around it.

describe("computeAssignedAt", () => {
  it("returns undefined when assigneeId isn't part of the update", () => {
    expect(computeAssignedAt({ nextAssigneeId: undefined, currentAssigneeId: "u1" })).toBeUndefined();
  });

  it("returns undefined when the assignee is unchanged", () => {
    expect(computeAssignedAt({ nextAssigneeId: "u1", currentAssigneeId: "u1" })).toBeUndefined();
  });

  it("returns a new Date on first assignment", () => {
    const result = computeAssignedAt({ nextAssigneeId: "u1", currentAssigneeId: null });
    expect(result).toBeInstanceOf(Date);
  });

  it("returns a new Date on reassignment", () => {
    const result = computeAssignedAt({ nextAssigneeId: "u2", currentAssigneeId: "u1" });
    expect(result).toBeInstanceOf(Date);
  });
});

describe("computeCompletedAt", () => {
  it("sets a Date when transitioning into DONE", () => {
    const result = computeCompletedAt({ nextStatus: "DONE", currentStatus: "IN_PROGRESS" });
    expect(result).toBeInstanceOf(Date);
  });

  it("clears it when moving back out of DONE", () => {
    expect(computeCompletedAt({ nextStatus: "TODO", currentStatus: "DONE" })).toBeNull();
  });

  it("leaves it untouched for a non-DONE-involving status change", () => {
    expect(computeCompletedAt({ nextStatus: "IN_PROGRESS", currentStatus: "TODO" })).toBeUndefined();
  });

  it("leaves it untouched when status isn't part of the update", () => {
    expect(computeCompletedAt({ nextStatus: undefined, currentStatus: "TODO" })).toBeUndefined();
  });
});
