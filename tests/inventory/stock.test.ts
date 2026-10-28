import { describe, it, expect, vi } from "vitest";
import Decimal from "decimal.js";

// "Changed - Working Logic" branch, 29 Oct 2026: lightweight stock
// monitoring (lib/inventory/stock.ts), explicitly superseding Decision #7's
// "no stock ledger". Pins down the running-total update and the
// crossing-only low-stock notification, independent of the route around it.

type FakeMaterial = {
  id: string;
  name: string;
  defaultUnit: string;
  stockOnHand: Decimal;
  reorderThreshold: Decimal | null;
};

function makeFakePrisma(material: FakeMaterial) {
  const notifications: unknown[] = [];
  const users = [{ id: "admin-1" }];
  const current = { ...material };

  const db = {
    rawMaterial: {
      findUnique: async () => ({ ...current }),
      update: async ({ data }: { data: { stockOnHand: Decimal } }) => {
        current.stockOnHand = data.stockOnHand;
        return { ...current };
      },
    },
    stockMovement: {
      create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "m1", ...data }),
    },
    user: {
      findMany: async () => users,
    },
    notification: {
      createMany: async ({ data }: { data: unknown[] }) => {
        notifications.push(...data);
        return { count: data.length };
      },
    },
  };

  return { db, notifications };
}

describe("recordStockMovement", () => {
  it("adds a positive delta to stockOnHand", async () => {
    vi.resetModules();
    const { db } = makeFakePrisma({
      id: "m1",
      name: "Vanilla extract",
      defaultUnit: "kg",
      stockOnHand: new Decimal(5),
      reorderThreshold: new Decimal(10),
    });
    vi.doMock("@/lib/prisma", () => ({ prisma: db }));
    const { recordStockMovement } = await import("@/lib/inventory/stock");
    const result = await recordStockMovement(
      { rawMaterialId: "m1", quantityDelta: "20", recordedById: "u1" },
      db as never
    );
    expect(result.rawMaterial.stockOnHand.toString()).toBe("25");
  });

  it("rejects a movement that would take stock negative", async () => {
    vi.resetModules();
    const { db } = makeFakePrisma({
      id: "m1",
      name: "Vanilla extract",
      defaultUnit: "kg",
      stockOnHand: new Decimal(5),
      reorderThreshold: null,
    });
    vi.doMock("@/lib/prisma", () => ({ prisma: db }));
    const { recordStockMovement } = await import("@/lib/inventory/stock");
    const { ValidationError } = await import("@/lib/api/respond");
    await expect(
      recordStockMovement({ rawMaterialId: "m1", quantityDelta: "-10", recordedById: "u1" }, db as never)
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("notifies once stock crosses at-or-below the reorder threshold", async () => {
    vi.resetModules();
    const { db, notifications } = makeFakePrisma({
      id: "m1",
      name: "Vanilla extract",
      defaultUnit: "kg",
      stockOnHand: new Decimal(15),
      reorderThreshold: new Decimal(10),
    });
    vi.doMock("@/lib/prisma", () => ({ prisma: db }));
    const { recordStockMovement } = await import("@/lib/inventory/stock");
    await recordStockMovement({ rawMaterialId: "m1", quantityDelta: "-8", recordedById: "u1" }, db as never);
    expect(notifications.length).toBe(1);
  });

  it("does not notify again on a further movement while already below threshold", async () => {
    vi.resetModules();
    const { db, notifications } = makeFakePrisma({
      id: "m1",
      name: "Vanilla extract",
      defaultUnit: "kg",
      stockOnHand: new Decimal(8), // already at/below threshold
      reorderThreshold: new Decimal(10),
    });
    vi.doMock("@/lib/prisma", () => ({ prisma: db }));
    const { recordStockMovement } = await import("@/lib/inventory/stock");
    await recordStockMovement({ rawMaterialId: "m1", quantityDelta: "-1", recordedById: "u1" }, db as never);
    expect(notifications.length).toBe(0);
  });
});
