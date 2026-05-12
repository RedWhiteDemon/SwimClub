const nodemailer = require("nodemailer");

function createTransport() {
  const smtpUrl = process.env.SMTP_URL && String(process.env.SMTP_URL).trim();
  if (smtpUrl) {
    return nodemailer.createTransport(smtpUrl);
  }
  const host = process.env.SMTP_HOST && String(process.env.SMTP_HOST).trim();
  if (!host) {
    return null;
  }
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure =
    process.env.SMTP_SECURE === "true" ||
    process.env.SMTP_SECURE === "1" ||
    port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass: pass != null ? String(pass) : "" } : undefined
  });
}

/** @type {import("nodemailer").Transporter | null | undefined} */
let cachedTransport;

function getTransport() {
  if (cachedTransport === undefined) {
    cachedTransport = createTransport();
  }
  return cachedTransport;
}

function isSmtpConfigured() {
  const t = getTransport();
  const from = (process.env.SMTP_FROM || process.env.SMTP_USER || "").trim();
  return Boolean(t && from);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * @param {string} to
 * @param {string} resetUrl — полная HTTPS/HTTP ссылка с #token=…
 * @param {{ ttlHours?: number, siteName?: string }} [opts]
 * @returns {Promise<{ sent: boolean }>}
 */
async function sendPasswordResetEmail(to, resetUrl, opts = {}) {
  const transport = getTransport();
  const from = (process.env.SMTP_FROM || process.env.SMTP_USER || "").trim();
  if (!transport || !from) {
    return { sent: false };
  }

  const ttlHours = Math.max(1, Math.min(168, Number(opts.ttlHours) || 1));
  const siteName = (opts.siteName && String(opts.siteName).trim()) || "SwimClub";
  const safeUrlForText = resetUrl;
  const safeHref = String(resetUrl).replace(/&/g, "&amp;").replace(/"/g, "&quot;");

  const textBody = [
    `Здравствуйте!`,
    ``,
    `Вы (или кто-то другой) запросили смену пароля в ${siteName}.`,
    `Чтобы задать новый пароль, откройте в браузере ссылку (целиком, одной строкой):`,
    safeUrlForText,
    ``,
    `Ссылка действует около ${ttlHours} ч. После смены пароля она станет недействительной.`,
    `Если вы не запрашивали восстановление, просто удалите это письмо — пароль не изменится.`,
    ``,
    `С уважением,`,
    `${siteName}`
  ].join("\n");

  const htmlBody = `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#1a2b3c;background:#f4f7fb;padding:24px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 4px 20px rgba(9,42,71,.08);overflow:hidden;">
    <tr><td style="padding:28px 24px 8px;">
      <p style="margin:0 0 12px;font-size:16px;">Здравствуйте!</p>
      <p style="margin:0 0 16px;font-size:15px;color:#3d5266;">Вы запросили <strong>смену пароля</strong> в ${escapeHtml(siteName)}. Нажмите кнопку ниже — откроется страница, где можно задать новый пароль.</p>
      <p style="margin:0 0 20px;text-align:center;">
        <a href="${safeHref}" style="display:inline-block;padding:12px 24px;background:#0d7bdc;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">Задать новый пароль</a>
      </p>
      <p style="margin:0 0 8px;font-size:13px;color:#5c7282;">Если кнопка не нажимается, скопируйте ссылку в адресную строку браузера:</p>
      <p style="margin:0 0 16px;font-size:12px;word-break:break-all;color:#0d7bdc;">${escapeHtml(resetUrl)}</p>
      <p style="margin:0;font-size:13px;color:#5c7282;">Ссылка действует около <strong>${ttlHours}</strong> ч. Если вы не запрашивали письмо — удалите его: пароль не изменится.</p>
    </td></tr>
  </table>
</body>
</html>`;

  const mailOpts = {
    from,
    to,
    subject: `${siteName} — ссылка для нового пароля`,
    text: textBody,
    html: htmlBody
  };
  const replyTo = (process.env.SMTP_REPLY_TO || "").trim();
  if (replyTo) {
    mailOpts.replyTo = replyTo;
  }

  await transport.sendMail(mailOpts);
  return { sent: true };
}

module.exports = {
  getTransport,
  isSmtpConfigured,
  sendPasswordResetEmail
};
