import { cookies } from "next/headers";
import { z } from "zod";
import { createOtp, createSession, isEmailAllowed, requireSessionEmail, SESSION_COOKIE, verifyOtp } from "@/lib/auth";
import { sendOtpEmail } from "@/lib/mailer";
import { getDb } from "@/lib/db";

function businessName(): string {
  const row = getDb().prepare(`SELECT name FROM business_config WHERE id = 1`).get() as { name: string } | undefined;
  return row?.name ?? "Loyalty Admin";
}

const BodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("request-otp"), email: z.string().email() }),
  z.object({ action: z.literal("verify-otp"), email: z.string().email(), code: z.string().min(4).max(8) }),
  z.object({ action: z.literal("logout") }),
]);

export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const body = parsed.data;

  if (body.action === "logout") {
    const jar = await cookies();
    jar.delete(SESSION_COOKIE);
    return Response.json({ ok: true });
  }

  if (body.action === "request-otp") {
    const email = body.email.trim().toLowerCase();
    if (!isEmailAllowed(email)) {
      return Response.json({ error: "This email isn't on the allowed list yet. Ask the admin to add it in Settings." }, { status: 403 });
    }
    const code = createOtp(email);
    try {
      await sendOtpEmail(email, code, businessName());
    } catch (e) {
      console.error("sendOtpEmail failed:", e);
      return Response.json({ error: "Could not send the code — check SMTP settings." }, { status: 500 });
    }
    return Response.json({ ok: true });
  }

  // verify-otp
  const email = body.email.trim().toLowerCase();
  if (!verifyOtp(email, body.code.trim())) {
    return Response.json({ error: "Invalid or expired code." }, { status: 400 });
  }
  const { token, expiresAt } = createSession(email);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    expires: expiresAt,
    path: "/",
  });
  return Response.json({ ok: true, email });
}

export async function GET() {
  const email = await requireSessionEmail();
  return Response.json({ email });
}
