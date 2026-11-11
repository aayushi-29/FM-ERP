import { describe, it, expect, vi } from "vitest";
import Decimal from "decimal.js";

// "Changed - Working Logic" branch, 11 Nov 2026: category-aware stock
// batches (lib/inventory/batches.ts) — confirmed with the user. Pins down
// the three real cases: (a) a standard material just needs
// received/used/remaining; (b) a perishable material's leftover can be
// logged as wasted; (c) stockOnHand (the existing running total) never
// drifts out of sync with the batch, because receiveBatch/logBatchUsage
// call the existing recordStockMovement under the hood — same fake-Prisma
// style as tests/inventory/stock.test.ts, extended with rawMaterial.update
// tracking stockOnHand, stockBatch create/findUnique/update, and
// stockBatchMovement create.

type FakeMaterial = {
  id: string;
  name: string;
  defaultUnit: string;
  stockOnHand: Decimal;
  reorderThreshold: Decimal | null;
  shelfLifeDays: number | null;
};

type FakeBatch = {
  id: string;
  rawMaterialId: string;
  receivedQty: Decimal;
  remainingQty: Decimal;
  expiresAt: Date | null;
};

function makeFakePrisma(material: FakeMaterial) {
  const currentMaterial = { ...material };
  const batches = new Map<string, FakeBatch>();
  let batchCount = 0;
  let movementCount = 0;
  const notifications: unknown[] = [];

  const db = {
    rawMaterial: {
      findUnique: async () => ({ ...currentMaterial }),
      update: async ({ data }: { data: { stockOnHand: Decimal } }) => {
        currentMaterial.stockOnHand = data.stockOnHand;
        return { ...currentMaterial };
      },
    },
    stockMovement: {
      create: async ({ data }: { data: Record<string, unknown> }) => ({ id: `sm${++movementCount}`, ...data }),
    },
    stockBatch: {
      create: async ({ data }: { data: { rawMaterialId: string; receivedQty: Decimal; remainingQty: Decimal; expiresAt?: Date } }) => {
        batchCount += 1;
        const batch: FakeBatch = {
          id: `b${batchCount}`,
          rawMaterialId: data.rawMaterialId,
          receivedQty: data.receivedQty,
          remainingQty: data.remainingQty,
          expiresAt: data.expiresAt ?? null,
        };
        batches.set(batch.id, batch);
        return { ...batch };
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const b = batches.get(where.id);
        return b ? { ...b } : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: { remainingQty: Decimal } }) => {
        const b = batches.get(where.id)!;
        b.remainingQty = data.remainingQty;
        return { ...b };
      },
    },
    stockBatchMovement: {
      create: async ({ data }: { data: Record<string, unknown> }) => ({ id: `bm${++movementCount}`, ...data }),
    },
    user: { findMany: async () => [{ id: "admin-1" }] },
    notification: {
      createMany: async ({ data }: { data: unknown[] }) => {
        notifications.push(...data);
        return { count: data.length };
      },
    },
  };

  return { db, batches, currentMaterialRef: () => currentMaterial };
}

describe("receiveBatch", () => {
  it("creates a batch and adds the quantity to stockOnHand", async () => {
    vi.resetModules();
    const { db } = makeFakePrisma({
      id: "m1",
      name: "Flour",
      defaultUnit: "kg",
      stockOnHand: new Decimal(10),
      reorderThreshold: null,
      shelfLifeDays: null,
    });
    vi.doMock("@/lib/prisma", () => ({ prisma: db }));
    const { receiveBatch } = await import("@/lib/inventory/batches");
    const result = await receiveBatch({ rawMaterialId: "m1", quantity: "5", recordedById: "u1" }, db as never);
    expect(result.batch.receivedQty.toString()).toBe("5");
    expect(result.batch.remainingQty.toString()).toBe("5");
    expect(result.rawMaterial.stockOnHand.toString()).toBe("15");
    expect(result.batch.expiresAt).toBeNull();
  });

  it("auto-fills expiresAt from the material's shelfLifeDays when not given", async () => {
    vi.resetModules();
    const { db } = makeFakePrisma({
      id: "m2",
      name: "Fresh coriander",
      defaultUnit: "kg",
      stockOnHand: new Decimal(0),
      reorderThreshold: null,
      shelfLifeDays: 1,
    });
    vi.doMock("@/lib/prisma", () => ({ prisma: db }));
    const { receiveBatch } = await import("@/lib/inventory/batches");
    const before = Date.now();
    const result = await receiveBatch({ rawMaterialId: "m2", quantity: "3", recordedById: "u1" }, db as never);
    expect(result.batch.expiresAt).not.toBeNull();
    const diffDays = (result.batch.expiresAt!.getTime() - before) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeGreaterThan(0.9);
    expect(diffDays).toBeLessThan(1.1);
  });

  it("rejects a zero or negative received quantity", async () => {
    vi.resetModules();
    const { db } = makeFakePrisma({
      id: "m1",
      name: "Flour",
      defaultUnit: "kg",
      stockOnHand: new Decimal(10),
      reorderThreshold: null,
      shelfLifeDays: null,
    });
    vi.doMock("@/lib/prisma", () => ({ prisma: db }));
    const { receiveBatch } = await import("@/lib/inventory/batches");
    const { ValidationError } = await import("@/lib/api/respond");
    await expect(
      receiveBatch({ rawMaterialId: "m1", quantity: "0", recordedById: "u1" }, db as never)
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("logBatchUsage", () => {
  async function setupWithBatch(material: FakeMaterial, batchQty: string) {
    const fake = makeFakePrisma(material);
    vi.doMock("@/lib/prisma", () => ({ prisma: fake.db }));
    const { receiveBatch } = await import("@/lib/inventory/batches");
    const { batch } = await receiveBatch(
      { rawMaterialId: material.id, quantity: batchQty, recordedById: "u1" },
      fake.db as never
    );
    return { ...fake, batchId: batch.id };
  }

  it("logging USED reduces the batch's remaining qty and stockOnHand together", async () => {
    vi.resetModules();
    const { db, batchId } = await setupWithBatch(
      { id: "m1", name: "Flour", defaultUnit: "kg", stockOnHand: new Decimal(0), reorderThreshold: null, shelfLifeDays: null },
      "10"
    );
    const { logBatchUsage } = await import("@/lib/inventory/batches");
    const result = await logBatchUsage({ stockBatchId: batchId, type: "USED", quantity: "4", recordedById: "u1" }, db as never);
    expect(result.batch.remainingQty.toString()).toBe("6");
    expect(result.rawMaterial.stockOnHand.toString()).toBe("6");
    expect(result.movement.type).toBe("USED");
  });

  it("logging WASTED reduces remaining qty the same way, tagged as waste", async () => {
    vi.resetModules();
    const { db, batchId } = await setupWithBatch(
      { id: "m2", name: "Coriander", defaultUnit: "kg", stockOnHand: new Decimal(0), reorderThreshold: null, shelfLifeDays: 1 },
      "3"
    );
    const { logBatchUsage } = await import("@/lib/inventory/batches");
    const result = await logBatchUsage(
      { stockBatchId: batchId, type: "WASTED", quantity: "1", note: "leftover at close", recordedById: "u1" },
      db as never
    );
    expect(result.batch.remainingQty.toString()).toBe("2");
    expect(result.rawMaterial.stockOnHand.toString()).toBe("2");
    expect(result.movement.type).toBe("WASTED");
  });

  it("rejects logging more than what remains in the batch", async () => {
    vi.resetModules();
    const { db, batchId } = await setupWithBatch(
      { id: "m1", name: "Flour", defaultUnit: "kg", stockOnHand: new Decimal(0), reorderThreshold: null, shelfLifeDays: null },
      "5"
    );
    const { logBatchUsage } = await import("@/lib/inventory/batches");
    const { ValidationError } = await import("@/lib/api/respond");
    await expect(
      logBatchUsage({ stockBatchId: batchId, type: "USED", quantity: "6", recordedById: "u1" }, db as never)
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a zero or negative logged quantity", async () => {
    vi.resetModules();
    const { db, batchId } = await setupWithBatch(
      { id: "m1", name: "Flour", defaultUnit: "kg", stockOnHand: new Decimal(0), reorderThreshold: null, shelfLifeDays: null },
      "5"
    );
    const { logBatchUsage } = await import("@/lib/inventory/batches");
    const { ValidationError } = await import("@/lib/api/respond");
    await expect(
      logBatchUsage({ stockBatchId: batchId, type: "USED", quantity: "0", recordedById: "u1" }, db as never)
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("errors on a batch id that doesn't exist", async () => {
    vi.resetModules();
    const { db } = makeFakePrisma({
      id: "m1",
      name: "Flour",
      defaultUnit: "kg",
      stockOnHand: new Decimal(0),
      reorderThreshold: null,
      shelfLifeDays: null,
    });
    vi.doMock("@/lib/prisma", () => ({ prisma: db }));
    const { logBatchUsage } = await import("@/lib/inventory/batches");
    const { ValidationError } = await import("@/lib/api/respond");
    await expect(
      logBatchUsage({ stockBatchId: "does-not-exist", type: "USED", quantity: "1", recordedById: "u1" }, db as never)
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
