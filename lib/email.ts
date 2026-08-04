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

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
}

// Kleines HTML-Escaping für Werte, die in die Mail eingesetzt werden (Namen
// etc.) -- verhindert, dass z.B. ein "<" im Namen das Layout zerschießt.
function escHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Gemeinsames Layout für alle "schönen" Mails -- Tabellen-basiert und mit
// Inline-Styles, bewusst so simpel gehalten, weil viele Mail-Clients
// (allen voran Outlook Desktop) modernes CSS wie Flexbox/Grid nicht
// darstellen. Jede Mail bekommt Kopfzeile mit Wortmarke, einen Titel,
// beliebigen Inhalt, optional einen roten CTA-Button, und einen Footer mit
// Datenschutz-/Impressum-Links.
function renderEmailLayout({
  heading,
  bodyHtml,
  ctaLabel,
  ctaUrl,
}: {
  heading: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const url = siteUrl();

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Presseportal112</title>
</head>
<body style="margin:0; padding:0; background-color:#F5F6F5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F6F5; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#ffffff; border-radius:10px; overflow:hidden; border:1px solid #E1E3E1;">

          <tr>
            <td style="background-color:#14161A; padding:26px 32px;">
              <span style="font-family:Arial,Helvetica,sans-serif; font-size:19px; font-weight:bold; color:#ffffff; letter-spacing:0.5px;">
                PRESSEPORTAL<span style="color:#E4483C;">112</span>
              </span>
            </td>
          </tr>

          <tr>
            <td style="padding:36px 32px 8px;">
              <h1 style="margin:0 0 18px; font-family:Arial,Helvetica,sans-serif; font-size:21px; line-height:1.3; color:#14161A;">
                ${heading}
              </h1>
              <div style="font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:1.65; color:#585D64;">
                ${bodyHtml}
              </div>
              ${
                ctaLabel && ctaUrl
                  ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 8px;">
                <tr>
                  <td style="border-radius:6px; background-color:#C81E2C;">
                    <a href="${ctaUrl}" style="display:inline-block; padding:13px 26px; font-family:Arial,Helvetica,sans-serif; font-size:13px; font-weight:bold; color:#ffffff; text-decoration:none;">${ctaLabel} &rarr;</a>
                  </td>
                </tr>
              </table>`
                  : ''
              }
            </td>
          </tr>

          <tr>
            <td style="height:28px; font-size:0; line-height:0;">&nbsp;</td>
          </tr>

          <tr>
            <td style="padding:22px 32px; background-color:#ECEDEB; border-top:1px solid #E1E3E1;">
              <p style="margin:0 0 8px; font-family:Arial,Helvetica,sans-serif; font-size:11px; line-height:1.6; color:#93969B;">
                Presseportal112 &mdash; Plattform für Pressemitteilungen und Bildmaterial der Blaulichtfamilie.
              </p>
              <p style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:11px;">
                <a href="${url}/datenschutz" style="color:#585D64; text-decoration:underline;">Datenschutzerklärung</a>
                <span style="color:#93969B;">&nbsp;&middot;&nbsp;</span>
                <a href="${url}/impressum" style="color:#585D64; text-decoration:underline;">Impressum</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Kontaktformular-Mail -- geht direkt an die hinterlegte contact_email der
// Organisation (oder den Fallback). Kein replyTo mehr, da der Absender
// keine E-Mail-Adresse angibt -- nur Vorname, Betreff und Nachricht.
export async function sendContactEmail({
  to,
  senderName,
  subject,
  message,
  organizationName,
}: {
  to: string;
  senderName: string;
  subject: string;
  message: string;
  organizationName?: string;
}) {
  const transport = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const safeSenderName = escHtml(senderName);
  const safeSubject = escHtml(subject);
  const safeMessage = escHtml(message).replace(/\n/g, '<br>');
  const safeOrgName = organizationName ? escHtml(organizationName) : null;

  const bodyHtml = `
    <p style="margin:0 0 20px;">
      Eine neue Presseanfrage ist über das Kontaktformular eingegangen${
        safeOrgName ? ` für <strong>${safeOrgName}</strong>` : ''
      }.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px; width:100%; border-collapse:collapse;">
      <tr>
        <td style="padding:3px 0; font-size:11px; color:#93969B; width:70px; vertical-align:top;">Von</td>
        <td style="padding:3px 0; font-size:14px; color:#14161A;">${safeSenderName}</td>
      </tr>
      <tr>
        <td style="padding:3px 0; font-size:11px; color:#93969B; vertical-align:top;">Betreff</td>
        <td style="padding:3px 0; font-size:14px; color:#14161A;">${safeSubject}</td>
      </tr>
    </table>
    <div style="margin:0; padding:16px; background-color:#ECEDEB; border-radius:8px; font-size:14px; line-height:1.6; color:#14161A;">
      ${safeMessage}
    </div>
  `;

  await transport.sendMail({
    from,
    to,
    subject: `[Presseportal112] ${subject}`,
    text: [
      `Neue Anfrage über Presseportal112${
        organizationName ? ` für ${organizationName}` : ''
      }.`,
      '',
      `Von: ${senderName}`,
      '',
      message,
    ].join('\n'),
    html: renderEmailLayout({
      heading: 'Neue Presseanfrage',
      bodyHtml,
    }),
  });
}

export async function sendSubscriptionConfirmEmail(to: string, token: string) {
  const transport = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const confirmUrl = `${siteUrl()}/api/subscribe/confirm?token=${token}`;

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
  const unsubscribeUrl = `${siteUrl()}/api/subscribe/unsubscribe?token=${unsubscribeToken}`;

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

// Geht an die registrierende Person direkt nach dem Absenden des
// Registrierungsformulars -- bevor irgendjemand geprüft hat, rein als
// Eingangsbestätigung.
export async function sendRegistrationReceivedEmail({
  to,
  name,
}: {
  to: string;
  name: string;
}) {
  const transport = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const url = siteUrl();
  const safeName = escHtml(name || '');

  const bodyHtml = `
    <p style="margin:0 0 16px;">Hallo${safeName ? ` ${safeName}` : ''},</p>
    <p style="margin:0 0 16px;">
      vielen Dank für deine Registrierung bei <strong>Presseportal112</strong>.
      Deine Anfrage ist bei uns eingegangen und wird schnellstmöglich von
      unserem Team geprüft.
    </p>
    <p style="margin:0 0 16px;">
      Sobald dein Konto freigeschaltet ist, erhältst du eine weitere E-Mail
      und kannst dich direkt einloggen und Beiträge hochladen.
    </p>
    <p style="margin:0;">
      Wir freuen uns auf die Zusammenarbeit!
    </p>
  `;

  await transport.sendMail({
    from,
    to,
    subject: 'Presseportal112 -- Deine Registrierung ist eingegangen',
    text: [
      `Hallo ${name}`.trim() + ',',
      '',
      'vielen Dank für deine Registrierung bei Presseportal112.',
      'Deine Anfrage wird schnellstmöglich geprüft.',
      '',
      `Datenschutzerklärung: ${url}/datenschutz`,
      `Impressum: ${url}/impressum`,
    ].join('\n'),
    html: renderEmailLayout({
      heading: 'Registrierung eingegangen',
      bodyHtml,
    }),
  });
}

export async function sendRegistrationApprovedEmail({
  to,
  name,
  organizationName,
}: {
  to: string;
  name: string;
  organizationName: string;
}) {
  const transport = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const url = siteUrl();
  const safeName = escHtml(name || '');
  const safeOrgName = escHtml(organizationName);

  const bodyHtml = `
    <p style="margin:0 0 16px;">Hallo${safeName ? ` ${safeName}` : ''},</p>
    <p style="margin:0 0 16px;">
      dein Konto für <strong>${safeOrgName}</strong> wurde freigeschaltet.
    </p>
    <p style="margin:0;">
      Du kannst dich ab sofort einloggen und eure Pressefotos direkt
      hochladen und verwalten.
    </p>
  `;

  await transport.sendMail({
    from,
    to,
    subject: 'Presseportal112 -- Dein Konto wurde freigeschaltet',
    text: [
      `Hallo ${name}`.trim() + ',',
      '',
      `dein Konto für ${organizationName} wurde freigeschaltet. Du kannst dich ab sofort einloggen und Beiträge hochladen:`,
      '',
      `${url}/login`,
      '',
      'Wir freuen uns auf die Zusammenarbeit.',
      '',
      `Datenschutzerklärung: ${url}/datenschutz`,
      `Impressum: ${url}/impressum`,
    ].join('\n'),
    html: renderEmailLayout({
      heading: 'Dein Konto wurde freigeschaltet',
      bodyHtml,
      ctaLabel: 'Jetzt einloggen',
      ctaUrl: `${url}/login`,
    }),
  });
}

// Geht an eine Person, die "Passwort vergessen" ausgelöst hat.
export async function sendPasswordResetEmail({
  to,
  name,
  token,
}: {
  to: string;
  name: string;
  token: string;
}) {
  const transport = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const url = siteUrl();
  const safeName = escHtml(name || '');
  const resetUrl = `${url}/passwort-zuruecksetzen?token=${encodeURIComponent(token)}`;

  const bodyHtml = `
    <p style="margin:0 0 16px;">Hallo${safeName ? ` ${safeName}` : ''},</p>
    <p style="margin:0 0 16px;">
      für dein Konto bei <strong>Presseportal112</strong> wurde ein neues
      Passwort angefordert. Falls du das warst, klicke auf den Button unten,
      um ein neues Passwort zu vergeben.
    </p>
    <p style="margin:0;">
      Der Link ist aus Sicherheitsgründen nur <strong>30 Minuten</strong>
      gültig. Falls du das nicht angefordert hast, kannst du diese E-Mail
      einfach ignorieren &mdash; dein Passwort bleibt unverändert.
    </p>
  `;

  await transport.sendMail({
    from,
    to,
    subject: 'Presseportal112 -- Passwort zurücksetzen',
    text: [
      `Hallo ${name}`.trim() + ',',
      '',
      'für dein Konto bei Presseportal112 wurde ein neues Passwort angefordert.',
      '',
      `Link zum Zurücksetzen (30 Minuten gültig): ${resetUrl}`,
      '',
      'Falls du das nicht angefordert hast, ignoriere diese E-Mail einfach.',
    ].join('\n'),
    html: renderEmailLayout({
      heading: 'Passwort zurücksetzen',
      bodyHtml,
      ctaLabel: 'Neues Passwort vergeben',
      ctaUrl: resetUrl,
    }),
  });
}

// Geht direkt an den hinterlegten Medienvertreter, ausgelöst über den
// "Direkt senden"-Button auf der Freigabe-Seite.
export async function sendMediaShareEmail({
  to,
  recipientName,
  shareName,
  organizationName,
  expiresAt,
  shareUrl,
}: {
  to: string;
  recipientName: string | null;
  shareName: string;
  organizationName: string | null;
  expiresAt: string;
  shareUrl: string;
}) {
  const transport = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const safeRecipientName = recipientName ? escHtml(recipientName) : '';
  const safeShareName = escHtml(shareName);
  const safeOrgName = organizationName ? escHtml(organizationName) : 'Presseportal112';
  const expiryLabel = new Date(expiresAt).toLocaleDateString('de-DE');

  const bodyHtml = `
    <p style="margin:0 0 16px;">Guten Tag${safeRecipientName ? ` ${safeRecipientName}` : ''},</p>
    <p style="margin:0 0 16px;">
      anbei erhalten Sie den Link zu den Bildern von <strong>${safeOrgName}</strong>,
      die Sie angefragt haben: <strong>${safeShareName}</strong>.
    </p>
    <p style="margin:0;">
      Der Link ist bis zum <strong>${expiryLabel}</strong> gültig.
    </p>
  `;

  await transport.sendMail({
    from,
    to,
    subject: `Presseportal112 -- Bildfreigabe: ${shareName}`,
    text: [
      `Guten Tag${recipientName ? ` ${recipientName}` : ''},`,
      '',
      `anbei erhalten Sie den Link zu den Bildern von ${
        organizationName ?? 'Presseportal112'
      }, die Sie angefragt haben: ${shareName}.`,
      '',
      shareUrl,
      '',
      `Der Link ist bis zum ${expiryLabel} gültig.`,
    ].join('\n'),
    html: renderEmailLayout({
      heading: 'Ihre Bildfreigabe',
      bodyHtml,
      ctaLabel: 'Zu den Bildern',
      ctaUrl: shareUrl,
    }),
  });
}

// Geht an die Portalverwaltung, sobald sich jemand neu registriert hat.
export async function sendNewRegistrationAdminNotification({
  to,
  registrantName,
  registrantEmail,
  requestedOrganizationName,
  requestedGewerk,
}: {
  to: string;
  registrantName: string;
  registrantEmail: string;
  requestedOrganizationName: string | null;
  requestedGewerk: string;
}) {
  const transport = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const siteUrlValue = siteUrl();

  await transport.sendMail({
    from,
    to,
    subject: 'Presseportal112 -- Neue Registrierung wartet auf Freigabe',
    text: [
      'Eine neue Organisation möchte sich registrieren:',
      '',
      `Name: ${registrantName}`,
      `E-Mail: ${registrantEmail}`,
      `Gewünschte Organisation: ${requestedOrganizationName || '(nicht angegeben)'}`,
      `Gewerk: ${requestedGewerk}`,
      '',
      `Freigeben unter: ${siteUrlValue}/intern/admin/registrierungen`,
    ].join('\n'),
  });
}

// Geht an die Empfänger-Organisation, sobald eine andere Organisation eine
// neue Unterhaltung im internen Nachrichtensystem startet.
export async function sendNewConversationEmail({
  to,
  fromOrganizationName,
  subject,
  messagePreview,
}: {
  to: string;
  fromOrganizationName: string;
  subject: string;
  messagePreview: string;
}) {
  const transport = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const url = siteUrl();
  const safeOrgName = escHtml(fromOrganizationName);
  const safeSubject = escHtml(subject);
  const safePreview = escHtml(messagePreview).replace(/\n/g, '<br>');

  const bodyHtml = `
    <p style="margin:0 0 16px;">
      <strong>${safeOrgName}</strong> hat eine neue Unterhaltung mit dir
      gestartet: <strong>${safeSubject}</strong>.
    </p>
    <div style="margin:0; padding:16px; background-color:#ECEDEB; border-radius:8px; font-size:14px; line-height:1.6; color:#14161A;">
      ${safePreview}
    </div>
  `;

  await transport.sendMail({
    from,
    to,
    subject: `Presseportal112 -- Neue Nachricht von ${fromOrganizationName}`,
    text: [
      `${fromOrganizationName} hat eine neue Unterhaltung mit dir gestartet: ${subject}`,
      '',
      messagePreview,
      '',
      `Antworten: ${url}/intern/nachrichten`,
    ].join('\n'),
    html: renderEmailLayout({
      heading: 'Neue Nachricht',
      bodyHtml,
      ctaLabel: 'Zur Unterhaltung',
      ctaUrl: `${url}/intern/nachrichten`,
    }),
  });
}

// Geht an die eingeladene Person, sobald ein bestehendes Organisationsmitglied
// eine Einladung mit hinterlegter E-Mail-Adresse erstellt.
export async function sendInviteEmail({
  to,
  organizationName,
  invitedByName,
  joinUrl,
}: {
  to: string;
  organizationName: string;
  invitedByName: string;
  joinUrl: string;
}) {
  const transport = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const safeOrgName = escHtml(organizationName);
  const safeInvitedBy = escHtml(invitedByName);

  const bodyHtml = `
    <p style="margin:0 0 16px;">Hallo,</p>
    <p style="margin:0 0 16px;">
      <strong>${safeInvitedBy}</strong> hat dich eingeladen, dem Konto von
      <strong>${safeOrgName}</strong> bei Presseportal112 beizutreten.
    </p>
    <p style="margin:0;">
      Der Link ist 14 Tage gültig. Nach dem Beitreten kannst du direkt
      loslegen, ganz ohne weitere Wartezeit oder Prüfung.
    </p>
  `;

  await transport.sendMail({
    from,
    to,
    subject: `Presseportal112 -- Einladung zu ${organizationName}`,
    text: [
      `${invitedByName} hat dich eingeladen, dem Konto von ${organizationName} bei Presseportal112 beizutreten.`,
      '',
      `Link (14 Tage gültig): ${joinUrl}`,
    ].join('\n'),
    html: renderEmailLayout({
      heading: 'Du wurdest eingeladen',
      bodyHtml,
      ctaLabel: 'Jetzt beitreten',
      ctaUrl: joinUrl,
    }),
  });
}
