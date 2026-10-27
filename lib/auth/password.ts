import bcrypt from "bcryptjs";

// Cost factor 12: deliberately above bcryptjs's default (10) for an app that
// holds client financial and formulation data. Revisit only with a measured
// reason (e.g. login latency under real load), not by default.
const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Minimum bar enforced server-side at signup/password-change time — never
// trust a client-side check alone. Food Monk should confirm this is enough
// or whether a stricter policy (length + complexity + breach-list check) is
// wanted before go-live.
export function isPasswordStrongEnough(plain: string): boolean {
  return plain.length >= 10;
}
