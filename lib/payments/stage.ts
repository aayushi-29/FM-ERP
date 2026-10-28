import type { PaymentStage } from "@prisma/client";

// Decision #5, superseded on the "Changed - Working Logic" branch: payment
// milestones are now a fixed 60% advance / 25% after the first sample / 15%
// before final handover, rather than a free-form per-contract split. This
// is the single place the three stages' percentages and display labels
// live — nothing else should hardcode "60" or "ADVANCE_60" as a string.
//
// The percentage here is informational (what the stage represents, shown
// on the invoice/notification copy) — it does not auto-compute the
// invoice's line amounts against a project cost total. Whoever creates the
// invoice still enters the amount for that stage directly, same as any
// other invoice; this just tags which of the three fixed stages it is.
export const PAYMENT_STAGE_PERCENT: Record<PaymentStage, number> = {
  ADVANCE_60: 60,
  SECOND_25: 25,
  FINAL_15: 15,
};

export const PAYMENT_STAGE_LABEL: Record<PaymentStage, string> = {
  ADVANCE_60: "60% advance",
  SECOND_25: "25% after first sample",
  FINAL_15: "15% before final handover",
};

export const PAYMENT_STAGE_ORDER: PaymentStage[] = ["ADVANCE_60", "SECOND_25", "FINAL_15"];
