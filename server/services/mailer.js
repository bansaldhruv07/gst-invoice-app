// Sends email through Resend (https://resend.com). Password reset is offered
// only when this is set up.
const mailConfigured = () =>
  Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM && process.env.CLIENT_URL);

async function sendMail({ to, subject, text }) {
  const res = await fetch(process.env.MAIL_API_URL || "https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Email service replied ${res.status}`);
}

module.exports = { mailConfigured, sendMail };
