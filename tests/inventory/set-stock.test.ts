import { describe, it, expect, vi } from "vitest";
import Decimal from "decimal.js";

// "Changed - Working Logic" branch, 29 Oct 2026 (second pass), item #1:
// setStockOnHand — the "set current stock" convenience built on top of
// recordStockMovement (see docs/decisions.md for why no new field/ledger
// was added). Same fake-Prisma style as tests/inventory/stock.test.ts.

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
  let movementCount = 0;

  const db = {
    rawMaterial: {
      findUnique: async () => ({ ...current }),
      update: async ({ data }: { data: { stockOnHand: Decimal } }) => {
        current.stockOnHand = data.stockOnHand;
        return { ...current };
      },
    },
    stockMovement: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        movementCount += 1;
        return { id: `m${movementCount}`, ...data };
      },
    },
    user: { findMany: async () => users },
    notification: {
      createMany: async ({ data }: { data: unknown[] }) => {
        notifications.push(...data);
        return { count: data.length };
      },
    },
  };

  return { db, notifications, movementCountRef: () => movementCount };
}

describe("setStockOnHand", () => {
  it("records a positive-delta movement when the counted stock is higher", async () => {
    vi.resetModules();
    const { db, movementCountRef } = makeFakePrisma({
      id: "m1",
      name: "Vanilla extract",
      defaultUnit: "kg",
      stockOnHand: new Decimal(5),
      reorderThreshold: new Decimal(10),
    });
    vi.doMock("@/lib/prisma", () => ({ prisma: db }));
    const { setStockOnHand } = await import("@/lib/inventory/stock");
    const result = await setStockOnHand({ rawMaterialId: "m1", targetStock: "12", recordedById: "u1" }, db as never);
    expect(result.rawMaterial.stockOnHand.toString()).toBe("12");
    expect(movementCountRef()).toBe(1);
  });

  it("records a negative-delta movement when the counted stock is lower", async () => {
    vi.resetModules();
    const { db } = makeFakePrisma({
      id: "m1",
      name: "Vanilla extract",
      defaultUnit: "kg",
      stockOnHand: new Decimal(20),
      reorderThreshold: null,
    });
    vi.doMock("@/lib/prisma", () => ({ prisma: db }));
    const { setStockOnHand } = await import("@/lib/inventory/stock");
    const result = await setStockOnHand({ rawMaterialId: "m1", targetStock: "6", recordedById: "u1" }, db as never);
    expect(result.rawMaterial.stockOnHand.toString()).toBe("6");
  });

  it("does nothing (no movement row) when the counted stock matches what's on record", async () => {
    vi.resetModules();
    const { db, movementCountRef } = makeFakePrisma({
      id: "m1",
      name: "Vanilla extract",
      defaultUnit: "kg",
      stockOnHand: new Decimal(8),
      reorderThreshold: null,
    });
    vi.doMock("@/lib/prisma", () => ({ prisma: db }));
    const { setStockOnHand } = await import("@/lib/inventory/stock");
    const result = await setStockOnHand({ rawMaterialId: "m1", targetStock: "8", recordedById: "u1" }, db as never);
    expect(result.movement).toBeNull();
    expect(movementCountRef()).toBe(0);
  });

  it("rejects a negative target", async () => {
    vi.resetModules();
    const { db } = makeFakePrisma({
      id: "m1",
      name: "Vanilla extract",
      defaultUnit: "kg",
      stockOnHand: new Decimal(8),
      reorderThreshold: null,
    });
    vi.doMock("@/lib/prisma", () => ({ prisma: db }));
    const { setStockOnHand } = await import("@/lib/inventory/stock");
    const { ValidationError } = await import("@/lib/api/respond");
    await expect(
      setStockOnHand({ rawMaterialId: "m1", targetStock: "-1", recordedById: "u1" }, db as never)
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("fires the crossing-only low-stock notification when the new count drops at/below threshold", async () => {
    vi.resetModules();
    const { db, notifications } = makeFakePrisma({
      id: "m1",
      name: "Vanilla extract",
      defaultUnit: "kg",
      stockOnHand: new Decimal(15),
      reorderThreshold: new Decimal(10),
    });
    vi.doMock("@/lib/prisma", () => ({ prisma: db }));
    const { setStockOnHand } = await import("@/lib/inventory/stock");
    await setStockOnHand({ rawMaterialId: "m1", targetStock: "7", recordedById: "u1" }, db as never);
    expect(notifications.length).toBe(1);
  });
});
