// 29 Oct 2026 (second pass): fixed unit list for Raw Materials, confirmed
// with the user to replace the free-text "Unit" field — this page is used
// by non-technical staff, and a dropdown stops typos like "Kg"/"kgs"/"Kgs"
// from quietly fragmenting stock-on-hand totals across the same material.
// Not enforced in the schema (RawMaterial.defaultUnit stays a plain
// String) — only in this UI/API validation — so a future unit can be added
// here without a migration.
export const RAW_MATERIAL_UNITS = ["kg", "g", "l", "ml", "pcs", "box"] as const;
export type RawMaterialUnit = (typeof RAW_MATERIAL_UNITS)[number];

export function isValidRawMaterialUnit(value: string): value is RawMaterialUnit {
  return (RAW_MATERIAL_UNITS as readonly string[]).includes(value);
}
