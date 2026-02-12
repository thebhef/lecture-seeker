import nodemailer from "nodemailer";

interface SendInviteOptions {
  to: string;
  eventTitle: string;
  icsContent: string;
}

export async function sendInviteEmail({
  to,
  eventTitle,
  icsContent,
}: SendInviteOptions): Promise<void> {
  const host = process.env.SMTP_HOST;
  if (!host) {
    throw new Error("SMTP is not configured. Set SMTP_HOST environment variable.");
  }

  const transport = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASS
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
  });

  await transport.sendMail({
    from: process.env.SMTP_FROM || "noreply@lectureseeker.local",
    to,
    subject: `Event Invite: ${eventTitle}`,
    text: `You've been invited to: ${eventTitle}\n\nPlease find the calendar invite attached.`,
    icalEvent: {
      filename: "invite.ics",
      method: "REQUEST",
      content: icsContent,
    },
  });

  transport.close();
}
