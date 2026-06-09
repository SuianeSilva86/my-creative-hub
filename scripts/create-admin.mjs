import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { promisify } from "node:util";

import { createClient } from "@libsql/client/web";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

const url = process.env.TURSO_DATABASE_URL;
if (!url) throw new Error("Missing TURSO_DATABASE_URL.");

const db = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

async function readPassword(prompt) {
  if (!process.stdin.isTTY) {
    throw new Error("Run this command in an interactive terminal.");
  }

  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  return new Promise((resolve, reject) => {
    let password = "";

    function cleanup() {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("data", onData);
      process.stdout.write("\n");
    }

    function onData(char) {
      if (char === "\u0003") {
        cleanup();
        reject(new Error("Cancelled."));
        return;
      }
      if (char === "\r" || char === "\n") {
        cleanup();
        resolve(password);
        return;
      }
      if (char === "\u007f" || char === "\b") {
        password = password.slice(0, -1);
        return;
      }
      password += char;
    }

    process.stdin.on("data", onData);
  });
}

try {
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  const email = (await readline.question("Admin email: ")).trim().toLowerCase();
  readline.close();

  if (!email || !email.includes("@")) throw new Error("Enter a valid email.");

  const password = await readPassword("Admin password (minimum 8 characters): ");
  if (password.length < 8) throw new Error("Password must contain at least 8 characters.");

  const salt = randomBytes(16).toString("hex");
  const passwordHash = Buffer.from(await scrypt(password, salt, KEY_LENGTH)).toString("hex");

  const [adminResult, profileResult] = await Promise.all([
    db.execute(`SELECT id, profile_id FROM admin_users ORDER BY created_at LIMIT 1`),
    db.execute(`SELECT id FROM profiles ORDER BY is_primary DESC, updated_at DESC LIMIT 1`),
  ]);

  const existingAdmin = adminResult.rows[0];
  let profileId =
    typeof existingAdmin?.profile_id === "string"
      ? existingAdmin.profile_id
      : profileResult.rows[0]?.id;

  if (typeof profileId !== "string") {
    profileId = crypto.randomUUID();
    await db.execute({
      sql: `INSERT INTO profiles (id, display_name, is_primary) VALUES (?, ?, 1)`,
      args: [profileId, email.split("@")[0] || "Seu Nome"],
    });
  }

  if (typeof existingAdmin?.id === "string") {
    await db.execute({
      sql: `UPDATE admin_users
        SET email = ?, password_hash = ?, password_salt = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`,
      args: [email, passwordHash, salt, existingAdmin.id],
    });
    console.log("Admin credentials updated.");
  } else {
    await db.execute({
      sql: `INSERT INTO admin_users (id, profile_id, email, password_hash, password_salt)
        VALUES (?, ?, ?, ?, ?)`,
      args: [crypto.randomUUID(), profileId, email, passwordHash, salt],
    });
    console.log("Admin user created.");
  }
} finally {
  db.close();
}
