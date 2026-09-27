import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getDb } from "./db";

// Email + OTP, no password — per the brief's locked decision. Access is restricted by an
// admin-configurable allowlist (one email or domain per line), not a fixed env var, so the
// business owner can manage it themselves from Settings without a redeploy.

const OTP_TTL_MS = 10 * 60_000;
const SESSION_TTL_MS = 12 * 60 * 60_000;
export const SESSION_COOKIE = "ks_session";

export function isEmailAllowed(email: string): boolean {
  const row = getDb().prepare(`SELECT allowed_emails_json FROM business_config WHERE id = 1`).get() as
    | { allowed_emails_json: string }
    | undefined;
  const rules: string[] = row ? JSON.parse(row.allowed_emails_json) : [];
  const lower = email.toLowerCase();
  const domain = lower.split("@")[1];
  return rules.some((r) => {
    const rule = r.trim().toLowerCase();
    if (!rule) return false;
    return rule.includes("@") ? rule === lower : rule === domain;
  });
}

export function generateCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export function createOtp(email: string): string {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();
  getDb()
    .prepare(`INSERT OR REPLACE INTO otp_codes (email, code, expires_at) VALUES (?, ?, ?)`)
    .run(email.toLowerCase(), code, expiresAt);
  return code;
}

export function verifyOtp(email: string, code: string): boolean {
  const row = getDb().prepare(`SELECT code, expires_at FROM otp_codes WHERE email = ?`).get(email.toLowerCase()) as
    | { code: string; expires_at: string }
    | undefined;
  if (!row || row.code !== code || new Date(row.expires_at).getTime() < Date.now()) return false;
  getDb().prepare(`DELETE FROM otp_codes WHERE email = ?`).run(email.toLowerCase());
  return true;
}

export function createSession(email: string): { token: string; expiresAt: Date } {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  getDb()
    .prepare(`INSERT INTO sessions (token, email, expires_at) VALUES (?, ?, ?)`)
    .run(token, email.toLowerCase(), expiresAt.toISOString());
  return { token, expiresAt };
}

export function getSessionEmail(token: string | undefined): string | null {
  if (!token) return null;
  const row = getDb().prepare(`SELECT email, expires_at FROM sessions WHERE token = ?`).get(token) as
    | { email: string; expires_at: string }
    | undefined;
  if (!row || new Date(row.expires_at).getTime() < Date.now()) return null;
  return row.email;
}

export async function requireSessionEmail(): Promise<string | null> {
  const jar = await cookies();
  return getSessionEmail(jar.get(SESSION_COOKIE)?.value);
}
