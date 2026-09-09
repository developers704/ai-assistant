import nodemailer from "nodemailer";

type SmtpMail = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string | null;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export async function sendHrSmtpMail(mail: SmtpMail): Promise<void> {
  const host = required("HR_SMTP_HOST");
  const user = required("HR_SMTP_USER");
  const pass = required("HR_SMTP_PASS");
  const from = process.env.HR_SMTP_FROM?.trim() || user;
  const port = Number(process.env.HR_SMTP_PORT || 587);
  if (!Number.isInteger(port) || port <= 0) throw new Error("HR_SMTP_PORT is invalid");

  const tls: { rejectUnauthorized: boolean; servername?: string } = {
    rejectUnauthorized: process.env.HR_SMTP_REJECT_UNAUTHORIZED !== "false",
  };
  const servername = process.env.HR_SMTP_TLS_SERVERNAME?.trim();
  if (servername) tls.servername = servername;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.HR_SMTP_SECURE === "true",
    auth: { user, pass },
    tls,
  });

  await transporter.sendMail({
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    ...(mail.html ? { html: mail.html } : {}),
    from,
  });
}
