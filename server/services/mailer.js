// Sends email through Resend (https://resend.com) or Brevo (https://brevo.com),
// whichever has its key set. Password reset by email needs one of them.
const brevo = () => !process.env.RESEND_API_KEY && Boolean(process.env.BREVO_API_KEY);

const mailConfigured = () =>
  Boolean((process.env.RESEND_API_KEY || process.env.BREVO_API_KEY) && process.env.MAIL_FROM && process.env.CLIENT_URL);

// "Shop Name <hello@example.com>" or just the address
function sender(value) {
  const match = String(value).match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (!match) return { email: String(value).trim() };
  return { email: match[2].trim(), ...(match[1] && { name: match[1].replace(/^"|"$/g, "") }) };
}

const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

async function sendMail({ to, subject, text }) {
  const viaBrevo = brevo();
  const url = process.env.MAIL_API_URL ||
    (viaBrevo ? "https://api.brevo.com/v3/smtp/email" : "https://api.resend.com/emails");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(viaBrevo
        ? { "api-key": process.env.BREVO_API_KEY }
        : { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }),
    },
    body: JSON.stringify(
      viaBrevo
        ? {
            sender: sender(process.env.MAIL_FROM), to: [{ email: to }], subject, textContent: text,
            htmlContent: `<p style="white-space:pre-wrap;font-family:sans-serif">${escapeHtml(text)}</p>`,
          }
        : { from: process.env.MAIL_FROM, to: [to], subject, text },
    ),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Email service replied ${res.status}`);
}

module.exports = { mailConfigured, sendMail, sender };
