const { google } = require('googleapis');

const SHEET_ID    = process.env.GOOGLE_SHEETS_CRM_ID;
const CLIENTS_TAB = 'Clients';

function getOAuth2Client() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return auth;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const auth   = getOAuth2Client();
    const sheets = google.sheets({ version: 'v4', auth });

    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range:         `'${CLIENTS_TAB}'!A:I`,
    });

    const rows = (result.data.values || []).slice(1); // skip header

    const clients = rows
      .filter(r => {
        const status = String(r[7] || '').trim().toLowerCase();
        const id     = String(r[0] || '').trim();
        return id && status === 'active';
      })
      .map(r => ({
        clientId:        String(r[0] || '').trim(),
        clientName:      String(r[1] || '').trim(),
        propertyAddress: String(r[2] || '').trim(),
        serviceType:     String(r[3] || '').trim(),
      }));

    return res.status(200).json({ clients });

  } catch (err) {
    console.error('get-clients error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
