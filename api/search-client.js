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

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const q = (req.query.q || '').trim().toLowerCase();
  if (q.length < 2) return res.status(200).json({ results: [] });

  try {
    const auth   = getOAuth2Client();
    const sheets = google.sheets({ version: 'v4', auth });

    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range:         `${SHEET_NAME}!A:G`,
    });

    const rows    = (result.data.values || []).slice(1); // skip header
    const matches = [];

    rows.forEach((row, i) => {
      const name  = String(row[1] || '').toLowerCase();
      const email = String(row[3] || '').toLowerCase();
      if (name.includes(q) || email.includes(q)) {
        matches.push({
          name:     String(row[1] || ''),
          phone:    String(row[2] || ''),
          email:    String(row[3] || ''),
          service:  String(row[4] || ''),
          rowIndex: i + 2, // 1-based + header offset
        });
      }
    });

    return res.status(200).json({ results: matches.slice(0, 5) });

  } catch (err) {
    console.error('search-client error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
