import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/lib/api/respond";

// "The work should start when Advance is Paid" — a project's execution
// (tasks, trials) is gated on its 60% advance payment having been verified
// by an Admin. There's no payment gateway, so "paid" always means a human
// (Admin) confirmed an offline/email acknowledgement and set
// Project.advancePaymentVerifiedAt — see app/api/payments/[id]/verify
// /route.ts. Before that timestamp is set, task/trial creation is blocked
// so the project record can't silently run ahead of what's actually been
// paid for.
//
// Deliberately narrow: this only blocks *creating new* tasks/trials. It
// does not block reading, updating, or completing work already on the
// books, and it does not touch any other route — leads, clients, documents,
// formulations, invoices, etc. are all unaffected, per "do not break the
// existing functionality."
export async function assertExecutionUnlocked(projectId: string): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { advancePaymentVerifiedAt: true },
  });

  if (!project) {
    throw new ValidationError("Project not found");
  }

  if (!project.advancePaymentVerifiedAt) {
    throw new ValidationError(
      "This project is locked until the 60% advance payment is verified by an Admin."
    );
  }
}

// Same check, but returns a boolean instead of throwing — for UI code that
// wants to render a banner/disable a form rather than handle an exception.
export async function isExecutionUnlocked(projectId: string): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { advancePaymentVerifiedAt: true },
  });
  return Boolean(project?.advancePaymentVerifiedAt);
}
