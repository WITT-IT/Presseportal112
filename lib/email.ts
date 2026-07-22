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

export async function sendSubscriptionConfirmEmail(to: string, token: string) {
  const transport = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const confirmUrl = `${siteUrl}/api/subscribe/confirm?token=${token}`;

  await transport.sendMail({
    from,
    to,
    subject: 'Presseportal112 -- Bitte Anmeldung bestätigen',
    text: [
      'Fast geschafft!',
      '',
      'Bitte bestätige deine Anmeldung für den Presse-Alarm über diesen Link:',
      confirmUrl,
      '',
      'Falls du das nicht angefordert hast, kannst du diese E-Mail einfach ignorieren.',
    ].join('\n'),
  });
}

export async function sendNewImageAlert({
  to,
  unsubscribeToken,
  imageTitle,
  organizationName,
  articleUrl,
}: {
  to: string;
  unsubscribeToken: string;
  imageTitle: string;
  organizationName: string;
  articleUrl: string;
}) {
  const transport = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const unsubscribeUrl = `${siteUrl}/api/subscribe/unsubscribe?token=${unsubscribeToken}`;

  await transport.sendMail({
    from,
    to,
    subject: `Presseportal112 -- Neues Foto von ${organizationName}`,
    text: [
      `${organizationName} hat ein neues Pressefoto freigegeben:`,
      imageTitle,
      '',
      articleUrl,
      '',
      '----------------------------------------',
      `Presse-Alarm abbestellen: ${unsubscribeUrl}`,
    ].join('\n'),
  });
}
