import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = 'ContentFlow <hello@contentflow.app>'

// ─── Welcome ─────────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(email: string, name: string) {
  if (!process.env.RESEND_API_KEY) return
  const first = name.split(' ')[0]
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Your ContentFlow account is ready',
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAFAF8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF8;padding:48px 0">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #E6E4DF;border-radius:16px;overflow:hidden;max-width:560px;width:100%">

      <!-- Header -->
      <tr><td style="background:#1A1916;padding:28px 40px">
        <span style="font-family:Georgia,serif;font-size:20px;color:#fff;font-weight:400">Content<em>flow</em></span>
      </td></tr>

      <!-- Body -->
      <tr><td style="padding:40px 40px 32px">
        <h1 style="font-family:Georgia,serif;font-weight:400;font-size:32px;color:#1A1916;margin:0 0 16px;line-height:1.15">
          Welcome, ${first}.
        </h1>
        <p style="font-size:15px;color:#5C5A56;line-height:1.6;margin:0 0 24px">
          You've got <strong style="color:#1A1916">60 free credits</strong> waiting — enough to generate your first UGC ad in under 3 minutes.
        </p>

        <table cellpadding="0" cellspacing="0" style="margin:0 0 28px">
          <tr>
            <td style="background:#F4F2EE;border-radius:10px;padding:20px 24px">
              <p style="margin:0 0 12px;font-size:13px;font-weight:700;color:#1A1916;letter-spacing:.06em;text-transform:uppercase;font-family:monospace">What you can do now</p>
              <p style="margin:0 0 8px;font-size:14px;color:#5C5A56">🎬 &nbsp;Generate a UGC talking-head ad (5s, 10s, or 15s)</p>
              <p style="margin:0 0 8px;font-size:14px;color:#5C5A56">🎤 &nbsp;Create an AI voiceover from any script</p>
              <p style="margin:0;font-size:14px;color:#5C5A56">🖼️ &nbsp;Generate product images with AI</p>
            </td>
          </tr>
        </table>

        <table cellpadding="0" cellspacing="0">
          <tr><td style="background:#1A1916;border-radius:10px">
            <a href="https://contentflow.app/generate/ugc" style="display:block;padding:14px 32px;font-size:15px;font-weight:600;color:#fff;text-decoration:none;text-align:center">
              Make your first ad →
            </a>
          </td></tr>
        </table>
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:20px 40px 32px;border-top:1px solid #F0EDE8">
        <p style="font-size:12px;color:#9E9B96;margin:0;line-height:1.6">
          You're receiving this because you signed up at contentflow.app.<br>
          Questions? Reply to this email — we read every message.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`,
  }).catch(err => console.error('[email] welcome failed', err))
}

// ─── Subscription activated ───────────────────────────────────────────────────

export async function sendSubscriptionEmail(email: string, name: string, plan: string, credits: number) {
  if (!process.env.RESEND_API_KEY) return
  const first = name?.split(' ')[0] || 'there'
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1)
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `You're on the ${planLabel} plan 🎉`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAFAF8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF8;padding:48px 0">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #E6E4DF;border-radius:16px;overflow:hidden;max-width:560px;width:100%">

      <tr><td style="background:#1A1916;padding:28px 40px">
        <span style="font-family:Georgia,serif;font-size:20px;color:#fff;font-weight:400">Content<em>flow</em></span>
      </td></tr>

      <tr><td style="padding:40px 40px 32px">
        <h1 style="font-family:Georgia,serif;font-weight:400;font-size:32px;color:#1A1916;margin:0 0 16px;line-height:1.15">
          ${planLabel} plan activated.
        </h1>
        <p style="font-size:15px;color:#5C5A56;line-height:1.6;margin:0 0 24px">
          Hey ${first}, your <strong style="color:#1A1916">${planLabel}</strong> subscription is live.
          You now have <strong style="color:#1A1916">${credits.toLocaleString()} credits</strong> to use this month.
        </p>

        <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;width:100%">
          <tr>
            <td style="background:#F4F2EE;border-radius:10px;padding:20px 24px">
              <p style="margin:0 0 4px;font-size:13px;color:#9E9B96;font-family:monospace;letter-spacing:.06em;text-transform:uppercase">Credits this month</p>
              <p style="margin:0;font-size:28px;font-weight:700;color:#1A1916">${credits.toLocaleString()}</p>
            </td>
          </tr>
        </table>

        <table cellpadding="0" cellspacing="0">
          <tr><td style="background:#1A1916;border-radius:10px">
            <a href="https://contentflow.app/dashboard" style="display:block;padding:14px 32px;font-size:15px;font-weight:600;color:#fff;text-decoration:none;text-align:center">
              Go to dashboard →
            </a>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:20px 40px 32px;border-top:1px solid #F0EDE8">
        <p style="font-size:12px;color:#9E9B96;margin:0;line-height:1.6">
          Manage your subscription at contentflow.app/settings/billing.<br>
          Questions? Reply to this email.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`,
  }).catch(err => console.error('[email] subscription failed', err))
}

// ─── Credit pack purchased ────────────────────────────────────────────────────

export async function sendCreditPackEmail(email: string, name: string, credits: number) {
  if (!process.env.RESEND_API_KEY) return
  const first = name?.split(' ')[0] || 'there'
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `${credits.toLocaleString()} credits added to your account`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAFAF8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF8;padding:48px 0">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #E6E4DF;border-radius:16px;overflow:hidden;max-width:560px;width:100%">

      <tr><td style="background:#1A1916;padding:28px 40px">
        <span style="font-family:Georgia,serif;font-size:20px;color:#fff;font-weight:400">Content<em>flow</em></span>
      </td></tr>

      <tr><td style="padding:40px 40px 32px">
        <h1 style="font-family:Georgia,serif;font-weight:400;font-size:32px;color:#1A1916;margin:0 0 16px;line-height:1.15">
          Credits added.
        </h1>
        <p style="font-size:15px;color:#5C5A56;line-height:1.6;margin:0 0 24px">
          Hey ${first}, <strong style="color:#1A1916">${credits.toLocaleString()} credits</strong> have been added to your account. They never expire.
        </p>

        <table cellpadding="0" cellspacing="0">
          <tr><td style="background:#1A1916;border-radius:10px">
            <a href="https://contentflow.app/generate/ugc" style="display:block;padding:14px 32px;font-size:15px;font-weight:600;color:#fff;text-decoration:none;text-align:center">
              Start creating →
            </a>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:20px 40px 32px;border-top:1px solid #F0EDE8">
        <p style="font-size:12px;color:#9E9B96;margin:0;line-height:1.6">
          View your balance at contentflow.app/settings/billing.<br>
          Questions? Reply to this email.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`,
  }).catch(err => console.error('[email] credit pack failed', err))
}

// ─── Monthly credits renewed ──────────────────────────────────────────────────

export async function sendCreditsRenewedEmail(email: string, name: string, credits: number, plan: string) {
  if (!process.env.RESEND_API_KEY) return
  const first = name?.split(' ')[0] || 'there'
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1)
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Your ${credits.toLocaleString()} credits just renewed`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAFAF8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF8;padding:48px 0">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #E6E4DF;border-radius:16px;overflow:hidden;max-width:560px;width:100%">

      <tr><td style="background:#1A1916;padding:28px 40px">
        <span style="font-family:Georgia,serif;font-size:20px;color:#fff;font-weight:400">Content<em>flow</em></span>
      </td></tr>

      <tr><td style="padding:40px 40px 32px">
        <h1 style="font-family:Georgia,serif;font-weight:400;font-size:32px;color:#1A1916;margin:0 0 16px;line-height:1.15">
          Fresh start, ${first}.
        </h1>
        <p style="font-size:15px;color:#5C5A56;line-height:1.6;margin:0 0 24px">
          Your <strong style="color:#1A1916">${planLabel}</strong> plan just renewed.
          <strong style="color:#1A1916">${credits.toLocaleString()} credits</strong> are ready to use.
        </p>

        <table cellpadding="0" cellspacing="0">
          <tr><td style="background:#1A1916;border-radius:10px">
            <a href="https://contentflow.app/generate/ugc" style="display:block;padding:14px 32px;font-size:15px;font-weight:600;color:#fff;text-decoration:none;text-align:center">
              Create something →
            </a>
          </td></tr>
        </table>
      </td></tr>

      <tr><td style="padding:20px 40px 32px;border-top:1px solid #F0EDE8">
        <p style="font-size:12px;color:#9E9B96;margin:0;line-height:1.6">
          Manage your subscription at contentflow.app/settings/billing.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`,
  }).catch(err => console.error('[email] renewal failed', err))
}
