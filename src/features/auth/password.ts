import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

let dummyHash: Promise<string> | null = null;

/**
 * Compares against a throwaway hash so a login attempt for a non-existent user
 * costs about the same time as a real one (mitigates user enumeration by timing).
 */
export async function burnPasswordCheck(plain: string): Promise<false> {
  dummyHash ??= bcrypt.hash(crypto.randomUUID(), BCRYPT_ROUNDS);
  await bcrypt.compare(plain, await dummyHash);
  return false;
}
