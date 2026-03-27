const { Resend } = require('resend');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, phone, email, service, message } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const businessEmail = process.env.CONTACT_EMAIL;

  try {
    // 1. Confirmation email to client
    await resend.emails.send({
      from:    'London Fire Protection <info@londonfireprotection.ca>',
      to:      email,
      subject: "We've received your request — London Fire Protection",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;">
          <h2 style="color:#e55a2b;">London Fire Protection</h2>
          <p>Hi ${name},</p>
          <p>Thank you for reaching out. We've received your request and one of our team members will call you within <strong>2 hours</strong> during business hours.</p>
          <p>If you'd prefer not to call, simply reply to this email and we'll follow up that way instead.</p>
          <p style="margin-top:32px;">— The London Fire Protection Team</p>
        </div>
      `,
    });

    // 2. Internal notification to business
    await resend.emails.send({
      from:    'London Fire Protection <info@londonfireprotection.ca>',
      to:      businessEmail,
      subject: `New Contact Form Submission — ${name}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#333;">
          <h2 style="color:#e55a2b;">New Contact Form Submission</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;font-weight:bold;width:100px;">Name</td><td style="padding:8px 0;">${name}</td></tr>
            <tr><td style="padding:8px 0;font-weight:bold;">Phone</td><td style="padding:8px 0;">${phone || '—'}</td></tr>
            <tr><td style="padding:8px 0;font-weight:bold;">Email</td><td style="padding:8px 0;">${email}</td></tr>
            <tr><td style="padding:8px 0;font-weight:bold;">Service</td><td style="padding:8px 0;">${service || '—'}</td></tr>
            <tr><td style="padding:8px 0;font-weight:bold;vertical-align:top;">Message</td><td style="padding:8px 0;">${message || '—'}</td></tr>
          </table>
        </div>
      `,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Resend error:', err);
    return res.status(500).json({ error: 'Failed to send email' });
  }
};
