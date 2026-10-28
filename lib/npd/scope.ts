import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/auth/rbac";

// Baseline §4 permission matrix, "Formulations" / "Trials" rows:
//   Admin          — manage; final approval if authorized / authorized access
//   Project Lead   — review/approve / read assigned projects
//   NPD Executive  — create drafts, revise, submit / create+update assigned trials
//   Client         — approved summary only / no access by default
//
// Products and Formulations aren't their own row in the matrix — they're
// grouped under "Formulations" conceptually (baseline §6.3: "create a
// product/formulation draft under an authorized project"). Creation
// authority here follows the Formulations row: Admin + NPD Executive only;
// Project Lead's verb is "review/approve", not "create", so Project Lead
// gets read access but can't create a Product, Formulation, or version.
//
// Project-level access (is this user even allowed on the project at all)
// is still checked separately via lib/auth/rbac.ts's assertProjectAccess —
// these helpers walk Product/Formulation/FormulationVersion down to a
// projectId so that check can run.

export async function getProjectIdForProduct(productId: string): Promise<string | null> {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { projectId: true } });
  return product?.projectId ?? null;
}

export async function getProjectIdForFormulation(formulationId: string): Promise<string | null> {
  const formulation = await prisma.formulation.findUnique({
    where: { id: formulationId },
    select: { product: { select: { projectId: true } } },
  });
  return formulation?.product.projectId ?? null;
}

export async function getProjectIdForFormulationVersion(versionId: string): Promise<string | null> {
  const version = await prisma.formulationVersion.findUnique({
    where: { id: versionId },
    select: { formulation: { select: { product: { select: { projectId: true } } } } },
  });
  return version?.formulation.product.projectId ?? null;
}

export async function getProjectIdForTrial(trialId: string): Promise<string | null> {
  const trial = await prisma.trial.findUnique({
    where: { id: trialId },
    select: { formulationVersion: { select: { formulation: { select: { product: { select: { projectId: true } } } } } } },
  });
  return trial?.formulationVersion.formulation.product.projectId ?? null;
}

export function assertFound<T>(value: T | null, message = "Not found"): T {
  if (value === null) throw new ForbiddenError(message);
  return value;
}

// Fields a CLIENT may see on a FormulationVersion — "approved summary
// only" (baseline §4). No ingredient lines, no processNotes, no trials,
// no author: that's the full recipe, which is explicitly a different,
// internal-only document (baseline §9: "a client-approved formulation
// summary is distinct from the full recipe"). A Client also only ever
// sees this for a version whose status is APPROVED — see the role branch
// in app/api/formulation-versions/[id]/route.ts.
export const CLIENT_SAFE_VERSION_SELECT = {
  id: true,
  versionNumber: true,
  status: true,
  decidedAt: true,
  formulation: { select: { id: true, name: true, product: { select: { id: true, name: true } } } },
} as const;
