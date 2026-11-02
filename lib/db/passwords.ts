import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * Password hashing with scrypt (built into Node, so no extra package).
 *
 * Stored as:  scrypt$N=32768,r=8,p=3$<salt base64>$<hash base64>
 * The settings are saved inside each hash, so they can be raised later
 * without breaking passwords that were hashed with the old ones.
 * (N=2^15, r=8, p=3 is an OWASP-recommended setting: 32 MiB, ~0.15 s.)
 */
const N = 2 ** 15;
const R = 8;
const P = 3;
const KEY_LENGTH = 64;
const MAX_MEMORY = 128 * 1024 * 1024;

function derive(password: string, salt: Buffer, keylen: number, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    // NFKC: the same password typed on different keyboards hashes the same.
    scrypt(password.normalize("NFKC"), salt, keylen, { N: n, r, p, maxmem: MAX_MEMORY }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, KEY_LENGTH, N, R, P);
  return `scrypt$N=${N},r=${R},p=${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

/** True if `password` matches `stored`. False (never throws) if `stored` is malformed. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const m = /^scrypt\$N=(\d+),r=(\d+),p=(\d+)\$([A-Za-z0-9+/=]+)\$([A-Za-z0-9+/=]+)$/.exec(stored);
  if (!m) return false;
  const [n, r, p] = [Number(m[1]), Number(m[2]), Number(m[3])];
  // Refuse absurd settings rather than let a corrupted row eat all memory.
  if (n < 2 || n > 2 ** 20 || (n & (n - 1)) !== 0 || r < 1 || r > 32 || p < 1 || p > 16) return false;
  const expected = Buffer.from(m[5], "base64");
  if (expected.length === 0) return false;
  const actual = await derive(password, Buffer.from(m[4], "base64"), expected.length, n, r, p);
  return timingSafeEqual(actual, expected); // constant-time compare
}