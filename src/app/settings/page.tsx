import { redirect } from "next/navigation";
import { requireSessionEmail } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { SettingsClient } from "@/components/SettingsClient";

export default async function SettingsPage() {
  const email = await requireSessionEmail();
  if (!email) redirect("/login");

  const row = getDb().prepare(`SELECT allowed_emails_json FROM business_config WHERE id = 1`).get() as { allowed_emails_json: string };
  const allowedEmails = JSON.parse(row.allowed_emails_json) as string[];

  return <SettingsClient allowedEmails={allowedEmails} />;
}
