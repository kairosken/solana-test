import crypto from "node:crypto";

// Backend-managed wallet custody (per the brief's locked decision): customer and mint-authority
// secret keys are stored encrypted at rest, never in plaintext. AES-256-GCM with a server-only
// key from the environment — never derived from anything checked into git.

function key(): Buffer {
  const secret = process.env.KS_WALLET_ENCRYPTION_KEY?.trim();
  if (!secret) throw new Error("KS_WALLET_ENCRYPTION_KEY must be set — see .env.example.");
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSecret(numbers: number[]): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const plaintext = Buffer.from(JSON.stringify(numbers));
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptSecret(payload: string): number[] {
  const raw = Buffer.from(payload, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString());
}
