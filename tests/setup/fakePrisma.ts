// A tiny in-memory stand-in for the handful of Prisma calls the
// authorization helpers under test actually make. This exists because the
// sandbox this app was built in can't run `prisma generate` against a real
// database (see the "Note on this sandbox" comment in lib/costing/compute.ts),
// so a real Postgres-backed integration suite can't be exercised here.
// These tests instead pin down the *authorization logic itself* — the
// thing baseline §13 is actually worried about — against a scripted data
// set, independent of whether the real Prisma client can be generated.
//
// Running this against a real database is still the stronger test; see
// README.md's "Testing" section for how to switch DATABASE_URL and remove
// this fake once `prisma generate` can reach the network it needs.

export type FakeProject = { id: string; clientOrgId: string; targetDate: Date | null };
export type FakeAssignment = { userId: string; projectId: string };
export type FakeTask = { id: string; projectId: string; dueDate: Date | null };
export type FakeMilestone = { id: string; projectId: string; dueDate: Date | null };

export function createFakePrisma(seed: {
  projects?: FakeProject[];
  assignments?: FakeAssignment[];
  tasks?: FakeTask[];
  milestones?: FakeMilestone[];
}) {
  const projects = seed.projects ?? [];
  const assignments = seed.assignments ?? [];
  const tasks = seed.tasks ?? [];
  const milestones = seed.milestones ?? [];

  return {
    project: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const project = projects.find((p) => p.id === where.id);
        return project ? { ...project } : null;
      },
    },
    projectAssignment: {
      findUnique: async ({ where }: { where: { userId_projectId: { userId: string; projectId: string } } }) => {
        const { userId, projectId } = where.userId_projectId;
        const match = assignments.find((a) => a.userId === userId && a.projectId === projectId);
        return match ? { ...match } : null;
      },
    },
    task: {
      findFirst: async ({ where }: { where: { projectId: string; dueDate: { gt: Date } } }) => {
        const match = tasks.find(
          (t) => t.projectId === where.projectId && t.dueDate && t.dueDate.getTime() > where.dueDate.gt.getTime()
        );
        return match ? { ...match } : null;
      },
    },
    milestone: {
      findFirst: async ({ where }: { where: { projectId: string; dueDate: { gt: Date } } }) => {
        const match = milestones.find(
          (m) => m.projectId === where.projectId && m.dueDate && m.dueDate.getTime() > where.dueDate.gt.getTime()
        );
        return match ? { ...match } : null;
      },
    },
  };
}
