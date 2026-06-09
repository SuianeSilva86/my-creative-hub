import { promisify } from "node:util";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return {
    hash: derivedKey.toString("hex"),
    salt,
  };
}

export async function verifyPassword(password: string, storedHash: string, salt: string) {
  const storedKey = Buffer.from(storedHash, "hex");
  if (storedKey.length !== KEY_LENGTH) return false;

  const derivedKey = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;
  return timingSafeEqual(storedKey, derivedKey);
}
