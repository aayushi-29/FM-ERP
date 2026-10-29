// 29 Oct 2026 (second pass), item #4: pure logic for Task.assignedAt/
// .completedAt, factored out of app/api/tasks/[id]/route.ts's two PATCH
// branches so it's testable without a fake Prisma client. `undefined` in
// the result means "don't touch this field" (Prisma skips it); `null`
// means "clear it."
export function computeAssignedAt(input: {
  nextAssigneeId: string | null | undefined;
  currentAssigneeId: string | null;
}): Date | undefined {
  if (input.nextAssigneeId === undefined) return undefined; // not being changed
  if (input.nextAssigneeId === input.currentAssigneeId) return undefined; // unchanged
  return new Date();
}

export function computeCompletedAt(input: {
  nextStatus: string | undefined;
  currentStatus: string;
}): Date | null | undefined {
  if (input.nextStatus === "DONE") return new Date();
  if (input.nextStatus && input.currentStatus === "DONE") return null; // moved back out of DONE
  return undefined; // no status change, or status changed between two non-DONE values
}
