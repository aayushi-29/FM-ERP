// Creates the first Admin account so someone can sign in at all — there is
// no public registration (Admin creates every other user, per baseline §4).
// Run with: npm run prisma:seed
//
// Reads from env rather than hard-coding a password, and is safe to re-run:
// it does nothing if an Admin with that email already exists.
import { PrismaClient } from "@prisma/client";
import { hashPassword, isPasswordStrongEnough } from "../lib/auth/password";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME ?? "Admin";

  if (!email || !password) {
    throw new Error(
      "Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (in .env) before seeding."
    );
  }
  if (!isPasswordStrongEnough(password)) {
    throw new Error("SEED_ADMIN_PASSWORD is too short (minimum 10 characters).");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin ${email} already exists — nothing to do.`);
    return;
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.create({
    data: { email, passwordHash, name, role: "ADMIN" },
  });

  console.log(`Created Admin ${email}. Sign in, then remove the seed
credentials from your .env — they're only needed for this first run.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
