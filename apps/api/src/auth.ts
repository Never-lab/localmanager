import {
  createHmac,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from "node:crypto";

import type { Database } from "./db.js";

const IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1_000;
const ABSOLUTE_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1_000;

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const salt = randomBytes(16);
  const derivedKey = await scryptAsync(password, salt);
  return `scrypt$${salt.toString("base64")}$${derivedKey.toString("base64")}`;
}

export async function verifyPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  const [algorithm, saltBase64, hashBase64] = encodedHash.split("$");
  if (algorithm !== "scrypt" || !saltBase64 || !hashBase64) return false;

  const expected = Buffer.from(hashBase64, "base64");
  const actual = await scryptAsync(password, Buffer.from(saltBase64, "base64"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sessionTokenHash(token: string, secret: string): string {
  return createHmac("sha256", secret).update(token).digest("hex");
}

export function isSessionValid(
  createdAt: Date,
  lastSeenAt: Date,
  now = new Date(),
): boolean {
  return (
    now.getTime() - createdAt.getTime() < ABSOLUTE_TIMEOUT_MS &&
    now.getTime() - lastSeenAt.getTime() < IDLE_TIMEOUT_MS
  );
}

function normalizeEmail(email: unknown): string {
  if (typeof email !== "string") throw new Error("A valid email is required");
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+$/.test(normalized)) {
    throw new Error("A valid email is required");
  }
  return normalized;
}

async function createSession(
  pool: Database,
  userId: string,
  secret: string,
): Promise<string> {
  const token = createSessionToken();
  await pool.query(
    "INSERT INTO sessions (token_hash, user_id) VALUES ($1, $2)",
    [sessionTokenHash(token, secret), userId],
  );
  return token;
}

export async function register(
  pool: Database,
  secret: string,
  email: unknown,
  password: unknown,
): Promise<string> {
  if (typeof password !== "string") {
    throw new Error("Password must be at least 8 characters");
  }

  const result = await pool.query<{ id: string }>(
    "INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
    [randomUUID(), normalizeEmail(email), await hashPassword(password)],
  );
  return createSession(pool, result.rows[0].id, secret);
}

export async function login(
  pool: Database,
  secret: string,
  email: unknown,
  password: unknown,
): Promise<string | null> {
  if (typeof password !== "string") return null;
  const result = await pool.query<{ id: string; password_hash: string }>(
    "SELECT id, password_hash FROM users WHERE email = $1",
    [normalizeEmail(email)],
  );
  const user = result.rows[0];
  if (!user || !(await verifyPassword(password, user.password_hash))) return null;
  return createSession(pool, user.id, secret);
}

export async function authenticate(
  pool: Database,
  secret: string,
  authorization: string | undefined,
): Promise<string | null> {
  const match = authorization?.match(/^Bearer (.+)$/i);
  if (!match) return null;

  const tokenHash = sessionTokenHash(match[1], secret);
  const result = await pool.query<{
    user_id: string;
    created_at: Date;
    last_seen_at: Date;
  }>(
    "SELECT user_id, created_at, last_seen_at FROM sessions WHERE token_hash = $1",
    [tokenHash],
  );
  const session = result.rows[0];
  if (!session || !isSessionValid(session.created_at, session.last_seen_at)) {
    if (session) {
      await pool.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
    }
    return null;
  }

  await pool.query(
    "UPDATE sessions SET last_seen_at = NOW() WHERE token_hash = $1",
    [tokenHash],
  );
  return session.user_id;
}
