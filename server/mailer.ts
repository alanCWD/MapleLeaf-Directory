import sgMail from '@sendgrid/mail';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@legacyleaf.ca';
const FROM_NAME = 'Legacy Leaf';

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

export async function sendWaitlistConfirmation(toEmail: string): Promise<void> {
  if (!SENDGRID_API_KEY) {
    console.warn('[Mailer] SENDGRID_API_KEY not set — skipping confirmation email');
    return;
  }

  const msg = {
    to: toEmail,
    from: { email: FROM_EMAIL, name: FROM_NAME },
    subject: "You're on the list 🌿",
    text: [
      `Hey there,`,
      ``,
      `You're officially on the Legacy Leaf waitlist. We'll be in touch the moment the next sovereign shop drop lands.`,
      ``,
      `Keep your eyes on your inbox — it's worth the wait.`,
      ``,
      `— The Legacy Leaf team`,
      ``,
      `You received this email because you signed up at legacyleaf.ca.`,
    ].join('\n'),
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#0a1a10;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1a10;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#0f2318;border-radius:16px;overflow:hidden;border:1px solid #1a4a2a;">
          <tr>
            <td style="background:linear-gradient(135deg,#064e2a 0%,#0a2e1f 60%,#1a0a2e 100%);padding:40px 40px 32px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:4px;color:#4ade80;text-transform:uppercase;">Legacy Leaf</p>
              <h1 style="margin:0;font-size:28px;font-weight:900;color:#ffffff;line-height:1.2;">You're on the list 🌿</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 20px;font-size:16px;color:#a7f3c0;line-height:1.6;">
                We've saved your spot. When the next sovereign shop drop lands, you'll be the first to know.
              </p>
              <p style="margin:0 0 32px;font-size:15px;color:#6ee7a0;line-height:1.6;">
                Keep an eye on your inbox — exclusive boutique harvests and new shops joining the directory will come straight to you.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
                <tr>
                  <td style="background:#16a34a;border-radius:10px;padding:14px 32px;">
                    <a href="https://legacyleaf.ca" style="color:#ffffff;text-decoration:none;font-weight:800;font-size:15px;letter-spacing:0.5px;">Browse the Directory</a>
                  </td>
                </tr>
              </table>
              <hr style="border:none;border-top:1px solid #1a4a2a;margin:0 0 24px;" />
              <p style="margin:0;font-size:12px;color:#4a7a5a;text-align:center;line-height:1.6;">
                You received this because you joined the waitlist at legacyleaf.ca.<br />
                © ${new Date().getFullYear()} Legacy Leaf. Canada's sovereign cannabis directory.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  };

  await sgMail.send(msg);
  console.log(`[Mailer] Confirmation email sent to ${toEmail}`);
}

export async function sendDrop(drop: {
  title: string;
  body: string;
  type: string;
  autoLink: string;
  customLink: string | null;
}, store: {
  name: string;
  address?: string;
}, recipients: string[]): Promise<{ sent: number; failed: number }> {
  if (!SENDGRID_API_KEY) {
    console.warn('[Mailer] SENDGRID_API_KEY not set — skipping drop email');
    return { sent: 0, failed: 0 };
  }
  if (recipients.length === 0) {
    console.warn('[Mailer] No recipients for drop — skipping');
    return { sent: 0, failed: 0 };
  }

  const ctaUrl = drop.customLink || drop.autoLink;
  const typeLabel = drop.type === 'event' ? 'Event' : drop.type === 'announcement' ? 'Announcement' : 'Product Drop';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#0a1a10;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1a10;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#0f2318;border-radius:16px;overflow:hidden;border:1px solid #1a4a2a;">
          <tr>
            <td style="background:linear-gradient(135deg,#064e2a 0%,#0a2e1f 60%,#1a0a2e 100%);padding:40px 40px 32px;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:4px;color:#4ade80;text-transform:uppercase;">Legacy Leaf · ${typeLabel}</p>
              <h1 style="margin:0;font-size:26px;font-weight:900;color:#ffffff;line-height:1.25;">${escapeHtml(drop.title)}</h1>
              <p style="margin:8px 0 0;font-size:14px;color:#6ee7a0;font-weight:600;">${escapeHtml(store.name)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 28px;font-size:16px;color:#a7f3c0;line-height:1.7;white-space:pre-wrap;">${escapeHtml(drop.body)}</p>
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
                <tr>
                  <td style="background:#16a34a;border-radius:10px;padding:14px 36px;">
                    <a href="${ctaUrl}" style="color:#ffffff;text-decoration:none;font-weight:800;font-size:15px;letter-spacing:0.5px;">Visit ${escapeHtml(store.name)} →</a>
                  </td>
                </tr>
              </table>
              <hr style="border:none;border-top:1px solid #1a4a2a;margin:0 0 24px;" />
              <p style="margin:0;font-size:12px;color:#4a7a5a;text-align:center;line-height:1.6;">
                You received this because you joined the Legacy Leaf waitlist.<br />
                © ${new Date().getFullYear()} Legacy Leaf. Canada's sovereign cannabis directory.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `${typeLabel.toUpperCase()} — ${drop.title}`,
    `From: ${store.name}`,
    ``,
    drop.body,
    ``,
    `Visit: ${ctaUrl}`,
    ``,
    `You received this because you joined the Legacy Leaf waitlist.`,
  ].join('\n');

  const BATCH_SIZE = 1000;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    try {
      await sgMail.sendMultiple({
        to: batch,
        from: { email: FROM_EMAIL, name: FROM_NAME },
        subject: `${typeLabel}: ${drop.title} — ${store.name}`,
        text,
        html,
      });
      sent += batch.length;
      console.log(`[Mailer] Drop batch ${Math.floor(i / BATCH_SIZE) + 1}: sent to ${batch.length} recipients`);
    } catch (err: any) {
      console.error(`[Mailer] Drop batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, err?.message || err);
      failed += batch.length;
    }
  }

  return { sent, failed };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
