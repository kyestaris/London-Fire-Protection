const { google } = require('googleapis');

const SHEET_ID   = process.env.SHEET_ID;
const SHEET_NAME = 'Website Leads';

function getOAuth2Client() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return auth;
}

async function updateLeadStatus(sheets, rowIndex) {
  if (!rowIndex) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId:    SHEET_ID,
    range:            `${SHEET_NAME}!G${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody:      { values: [['quote-sent']] },
  });
}

async function appendNewLead(sheets, client, metadata) {
  const date = new Date().toLocaleDateString('en-CA');
  await sheets.spreadsheets.values.append({
    spreadsheetId:    SHEET_ID,
    range:            `${SHEET_NAME}!A:G`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        date,
        client.name,
        client.phone || '—',
        client.email,
        metadata?.serviceNote || '—',
        '—',
        'quote-sent',
      ]],
    },
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { client, lineItems, metadata } = req.body || {};

  if (!client?.name || !client?.email || !lineItems?.length) {
    return res.status(400).json({ error: 'Missing client name, email, or line items' });
  }

  try {
    // 1. Send quote email via Render
    const renderRes = await fetch(`${process.env.RENDER_URL}/send-quote`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.INTERNAL_API_SECRET}`,
      },
      body: JSON.stringify({ client, lineItems, metadata }),
    });

    if (!renderRes.ok) {
      const err = await renderRes.json().catch(() => ({}));
      throw new Error(err.error || `Render responded ${renderRes.status}`);
    }

    // 2. Update or append CRM row
    const auth   = getOAuth2Client();
    const sheets = google.sheets({ version: 'v4', auth });

    if (client.rowIndex) {
      await updateLeadStatus(sheets, client.rowIndex);
    } else {
      await appendNewLead(sheets, client, metadata);
    }

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('create-quote error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
