import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/api/respond";

// A task or milestone due date that falls after the project's own target
// date is a data-entry mistake every time — nothing in the baseline asks
// for it, and it silently breaks any "are we on track" view that reads
// project.targetDate as the outer bound. Checked here, server-side, at
// every create/edit that can set a due date, rather than left to a form
// hint the API itself doesn't enforce (the same "server is the actual
// boundary, not the UI" rule the rest of this app follows).
//
// A project with no targetDate set has nothing to check against — dates
// are unconstrained until the project gets one.
export async function assertDueDateWithinProject(dueDate: Date | null | undefined, projectId: string) {
  if (!dueDate) return;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { targetDate: true },
  });
  if (!project?.targetDate) return;

  if (dueDate.getTime() > project.targetDate.getTime()) {
    throw new ValidationError(
      `Due date can't be after the project's target date (${project.targetDate.toISOString().slice(0, 10)})`
    );
  }
}
