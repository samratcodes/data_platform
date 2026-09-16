import "server-only";

import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

const scryptOptions = { cost: 32_768, blockSize: 8, parallelization: 1, maxmem: 64 * 1024 * 1024 };

const derive = (password: string, salt: string, options?: ScryptOptions) => new Promise<Buffer>((resolve, reject) => {
  const done = (error: Error | null, key: Buffer) => error ? reject(error) : resolve(key);
  if (options) scrypt(password, salt, 64, options, done);
  else scrypt(password, salt, 64, done);
});

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = await derive(password, salt, scryptOptions);
  return `scrypt$${scryptOptions.cost}$${scryptOptions.blockSize}$${scryptOptions.parallelization}$${salt}$${hash.toString("hex")}`;
}

/** Verifies both the current `scrypt$…` format and legacy `salt:hash` hashes. */
export async function verifyPassword(password: string, stored: string) {
  const modern = stored.split("$");
  const legacy = stored.split(":");
  const isModern = modern.length === 6 && modern[0] === "scrypt";
  const salt = isModern ? modern[4] : legacy[0];
  const expected = isModern ? modern[5] : legacy[1];
  if (!salt || !expected || !/^[a-f0-9]+$/i.test(expected)) return false;
  const options = isModern ? { cost: Number(modern[1]), blockSize: Number(modern[2]), parallelization: Number(modern[3]), maxmem: 64 * 1024 * 1024 } : undefined;
  const hash = await derive(password, salt, options);
  const buffer = Buffer.from(expected, "hex");
  return buffer.length === hash.length && timingSafeEqual(buffer, hash);
}
