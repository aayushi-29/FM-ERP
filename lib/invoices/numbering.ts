import { prisma } from "@/lib/prisma";

// Decision #6: "Configurable invoice numbering" — the exact scheme (series
// per client? per financial year? a prefix required for GST filing?) is
// NOT confirmed; Food Monk's accountant needs to sign off before this is
// final (docs/decisions.md). What's generated here is a placeholder that
// satisfies the one rule every real scheme will also need — unique,
// assigned once, never reused — so invoices can be created and tested
// now without inventing a numbering policy that turns out to conflict
// with the confirmed one. Swapping this function's body for the real
// scheme is a one-file change; nothing that calls it needs to know how
// the number is built.
//
// Current placeholder: FM-<year>-<zero-padded sequence>, sequence reset
// per calendar year, counted across all projects (not per-client or
// per-project — also unconfirmed).
export async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `FM-${year}-`;

  const countThisYear = await prisma.invoice.count({
    where: { invoiceNumber: { startsWith: prefix } },
  });

  const next = countThisYear + 1;
  const candidate = `${prefix}${String(next).padStart(4, "0")}`;

  // Extremely unlikely race (two invoices created in the same instant),
  // but invoiceNumber is a unique column, so a collision would otherwise
  // surface as an opaque 500 from Prisma — this gives a clear, if rare,
  // retry path instead.
  const exists = await prisma.invoice.findUnique({ where: { invoiceNumber: candidate } });
  if (exists) {
    return `${prefix}${String(next + 1).padStart(4, "0")}`;
  }
  return candidate;
}
