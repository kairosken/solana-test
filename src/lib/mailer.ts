import nodemailer from "nodemailer";

// Reuses the same Office 365 sender already working for kfleet's OTP emails — same domain,
// same tenant, no new mailbox/app-password to set up for a demo.

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

export async function sendOtpEmail(toEmail: string, code: string, businessName: string): Promise<void> {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: toEmail,
    subject: `${businessName} Admin Console sign-in code`,
    text: `Your one-time code is ${code}. It expires in 10 minutes.`,
    html: `<p>Your one-time code for the <strong>${businessName}</strong> loyalty admin console is:</p>
           <p style="font-size:28px;font-weight:700;letter-spacing:2px">${code}</p>
           <p style="color:#6b6258;font-size:13px">Expires in 10 minutes.</p>`,
  });
}
