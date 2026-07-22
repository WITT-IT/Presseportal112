import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD) {
    throw new Error(
      'SMTP ist nicht vollständig konfiguriert (SMTP_HOST/PORT/USER/PASSWORD fehlen).'
    );
  }

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465, // 465 = implizites TLS, 587 = STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });

  return transporter;
}

export async function sendContactEmail({
  to,
  replyTo,
  senderName,
  subject,
  message,
  organizationName,
}: {
  to: string;
  replyTo: string;
  senderName: string;
  subject: string;
  message: string;
  organizationName?: string;
}) {
  const transport = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;

  await transport.sendMail({
    from,
    to,
    replyTo,
    subject: `[Presseportal112] ${subject}`,
    text: [
      `Neue Anfrage über Presseportal112${
        organizationName ? ` für ${organizationName}` : ''
      }.`,
      '',
      `Von: ${senderName} <${replyTo}>`,
      '',
      message,
    ].join('\n'),
  });
}
