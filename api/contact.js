const { google } = require('googleapis');
const Anthropic = require('@anthropic-ai/sdk');

const SHEET_ID = process.env.SHEET_ID;
const SHEET_NAME = process.env.SHEET_NAME || 'Website Leads';

function getGoogleAuth() {
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'http://localhost:3001'
  );
  oAuth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
  return oAuth2Client;
}

async function logToSheet(auth, lead) {
  const sheets = google.sheets({ version: 'v4', auth });
  const date = new Date().toLocaleDateString('en-CA');

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:G`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        date,
        lead.name,
        lead.phone || '—',
        lead.email,
        lead.service || '—',
        lead.message || '—',
        'new',
      ]],
    },
  });
}

async function draftFollowUpEmail(lead) {
  const client = new Anthropic();

  const message = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are an assistant for London Fire Protection, a fire safety services company based in London, Ontario, Canada.

This email serves as both a confirmation of their form submission AND a personalized follow-up. It must:
- Confirm that we have received their request
- Let them know we will contact them within 2 hours during business hours (Mon-Fri 8AM-6PM)
- Ask the relevant service-specific questions to prepare for that call

Business context:
- Services offered: Fire Extinguisher Servicing (ABC Dry Chemical, Wet Chemical K-Class, CO2, Water — sold, serviced, and certified on-site), Fire Safety Plans (for commercial, industrial, rental properties, churches, schools, daycares, warehouses), Emergency Lighting Servicing (exit signs and battery backup units), Pre-Fire Inspection Checks (full walkthrough covering extinguishers, exit signs, emergency lighting, smoke and CO detectors, escape routes), Residential Smoke Alarm Installation (smoke and CO alarm supply and installation)
- Service area: London, St. Thomas, Dorchester, Aylmer, Komoka, Strathroy, Woodstock, Tillsonburg, and surrounding areas in Ontario
- All services are NFPA certified and Ontario Fire Code compliant
- A detailed compliance report is provided with every service
- Phone: 226-926-6367

Brand voice rules:
- Confident, direct, plain English
- Use "we", "us", and "our" naturally where appropriate
- Short sentences, one idea per sentence
- Action-first CTAs
- Words to use: Certified, Trusted, Fast, Compliant, Safe, Inspected, Professional, Reliable
- Never use: Passionate, Leverage, Synergy, World-class, Seamless, Solutions

Customer details:
- Name: ${lead.name}
- Service requested: ${lead.service || 'fire safety services'}
- Message: ${lead.message || 'No message provided'}

Service-specific questions to ask (only ask questions the customer has NOT already answered in their message):

If service is Fire Extinguisher Servicing:
- First ask: Are these for new units or servicing existing ones?
  - If existing: How many units need to be serviced?
  - If new: Roughly how many units are you looking for?
- What type of property is this for? (commercial, industrial, or residential)
- Is there a preferred date or timeline?

If service is Fire Safety Plans:
- What type of property is this for? (commercial, industrial, rental, church, school, daycare, warehouse, other)
- How many floors does the property have?
- How many occupants or staff are typically on site?
- Do you have existing floor plans available?
- Is there a fire inspection coming up that this plan needs to be ready for?

If service is Emergency Lighting Servicing:
- First ask: Are these for new units or inspecting existing ones?
  - If existing: How many units need to be inspected?
  - If new: Roughly how many units are you looking for?
- What type of property is this for? (commercial, industrial, or residential)
- Is there a preferred date or timeline?

If service is Pre-Fire Inspection Checks:
- Do you have a fire inspection scheduled, and if so when?
- What type of property is this for?
- How many floors does the property have?
- Is there a specific area of concern you'd like us to focus on?

If service is Residential Smoke Alarm Installation:
- Are you looking for new installation or replacement of existing alarms?
- How many units do you need?
- Is the property owner-occupied or a rental?
- Is there a preferred date or timeline?

Write only the email body (no subject line). Follow these rules:
- Start with "Hi ${lead.name},"
- In the first line, reference "our ${lead.service || 'fire safety services'}"
- Reference relevant service details from the business context where appropriate
- Ask only the service-specific questions above that the customer has NOT already answered in their message
- Somewhere in the email, ask if there are any other fire safety services they may need from our list
- End with a clear next step CTA — let them know they can call us at 226-926-6367 or simply reply to this email
- Sign off as "London Fire Protection | 226-926-6367 | info@londonfireprotection.ca"
- Do NOT include lines like "Our team is reliable, professional, and fast — we'll get your quote back to you quickly."
- Do NOT mention sprinkler systems or kitchen hood suppression systems`,
      },
    ],
  });

  return message.content[0].text;
}

function textToHtml(text) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .split(/\n\n+/)
    .map(para => `<p style="margin:0 0 16px 0;">${para.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function makeEmailRFC(to, subject, body, replyTo = null, isHtml = false) {
  const contentType = isHtml ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8';
  const lines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: ${contentType}`,
  ];
  if (replyTo) lines.push(`Reply-To: ${replyTo}`);
  lines.push('', body);
  return Buffer.from(lines.join('\n')).toString('base64url');
}

function wrapInHtmlEmail(bodyHtml) {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 0;">
    <tr><td align="center">
      <table width="100%" style="max-width:600px;background:#ffffff;border-radius:6px;overflow:hidden;">
        <tr>
          <td style="background:#E55A2B;padding:20px 28px;">
            <span style="color:#ffffff;font-size:18px;font-weight:bold;letter-spacing:0.5px;">London Fire Protection</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;color:#1a1a1a;font-size:16px;line-height:1.6;">
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="background:#f9f9f9;padding:16px 28px;border-top:1px solid #e5e5e5;font-size:13px;color:#666666;">
            226-926-6367 &nbsp;|&nbsp; info@londonfireprotection.ca
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendInternalNotification(auth, lead) {
  const gmail = google.gmail({ version: 'v1', auth });
  const date = new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto' });

  const body = [
    `New Quote Request - ${date}`,
    ``,
    `NAME:     ${lead.name}`,
    `PHONE:    ${lead.phone || 'Not provided'}`,
    `EMAIL:    ${lead.email}`,
    `SERVICE:  ${lead.service || 'Not specified'}`,
    `MESSAGE:  ${lead.message || 'None'}`,
    ``,
    `---`,
    `Reply to this email to respond directly to ${lead.name}.`,
  ].join('\n');

  const subject = `New Quote Request - ${lead.name} (${lead.service || 'General'})`;
  const encoded = makeEmailRFC('info@londonfireprotection.ca', subject, body, lead.email);

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded },
  });
}

async function sendFollowUpEmail(auth, lead) {
  const gmail = google.gmail({ version: 'v1', auth });
  const emailBody = await draftFollowUpEmail(lead);
  const subject = `We've received your request - London Fire Protection`;
  const htmlBody = wrapInHtmlEmail(textToHtml(emailBody));
  const encoded = makeEmailRFC(lead.email, subject, htmlBody, null, true);

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded },
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, phone, email, service, message } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  const lead = { name, phone, email, service, message };

  try {
    // Log to sheet + send both emails (non-blocking for Google/Claude)
    try {
      const auth = getGoogleAuth();
      await logToSheet(auth, lead);
      await Promise.all([
        sendFollowUpEmail(auth, lead),       // personalized email to customer
        sendInternalNotification(auth, lead), // internal notification to info@
      ]);
      console.log('All emails sent and sheet logged for:', lead.email);
    } catch (googleErr) {
      console.error('Google/Claude error (non-fatal):', googleErr.message);
      return res.status(200).json({ ok: true, debug: googleErr.message });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Contact handler error:', err.message);
    return res.status(500).json({ error: 'Failed to send email' });
  }
};
