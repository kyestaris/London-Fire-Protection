const { google }  = require('googleapis');
const Anthropic    = require('@anthropic-ai/sdk');
const Stripe       = require('stripe');
const { requireAuth } = require('./_auth');

const SHEET_ID     = process.env.GOOGLE_SHEETS_CRM_ID;
const CLIENTS_TAB  = 'Clients';
const CALENDAR_ID  = 'primary'; // uses the authenticated account's primary calendar
const LFP_EMAIL    = 'info@londonfireprotection.ca';
const LFP_PHONE    = '226-926-6367';
const TIMEZONE     = 'America/Toronto';

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------
function getOAuth2Client() {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return auth;
}

// ---------------------------------------------------------------------------
// 1. Look up client email from Stripe
// ---------------------------------------------------------------------------
async function getClientEmail(stripeCustomerId) {
  const stripe   = new Stripe(process.env.STRIPE_SECRET_KEY);
  const customer = await stripe.customers.retrieve(stripeCustomerId);
  if (customer.deleted) throw new Error(`Stripe customer ${stripeCustomerId} is deleted`);
  if (!customer.email)  throw new Error(`Stripe customer ${stripeCustomerId} has no email on file`);
  return customer.email;
}

// ---------------------------------------------------------------------------
// 2. Create Google Calendar event
// ---------------------------------------------------------------------------
async function createCalendarEvent({ auth, clientName, propertyAddress, serviceType, scheduledDate, scheduledTime, technicianName, clientEmail }) {
  const calendar = google.calendar({ version: 'v3', auth });

  // Build start datetime string in Toronto time (ISO 8601 with timezone)
  const startDateTime = `${scheduledDate}T${scheduledTime}:00`;

  // Calculate end = start + 1 hour
  const startMs  = new Date(`${scheduledDate}T${scheduledTime}:00`).getTime();
  const endDate  = new Date(startMs + 60 * 60 * 1000);
  const endHH    = String(endDate.getHours()).padStart(2, '0');
  const endMM    = String(endDate.getMinutes()).padStart(2, '0');
  const endDateTime = `${scheduledDate}T${endHH}:${endMM}:00`;

  const serviceLabel = formatServiceLabel(serviceType);

  const event = {
    summary: `LFP Fire Inspection — ${propertyAddress}`,
    description: [
      `Service: ${serviceLabel}`,
      `Technician: ${technicianName}`,
      `Client: ${clientName}`,
      ``,
      `London Fire Protection Inc.`,
      `📞 ${LFP_PHONE}`,
      `📧 ${LFP_EMAIL}`,
    ].join('\n'),
    start: { dateTime: startDateTime, timeZone: TIMEZONE },
    end:   { dateTime: endDateTime,   timeZone: TIMEZONE },
    attendees: [
      { email: clientEmail },
      { email: LFP_EMAIL },
    ],
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 }, // 1-day email reminder
        { method: 'popup', minutes: 60 },
      ],
    },
    guestsCanModify: false,
    guestsCanSeeOtherGuests: false,
    sendUpdates: 'all', // sends invite to attendees automatically
  };

  const result = await calendar.events.insert({
    calendarId:  CALENDAR_ID,
    requestBody: event,
  });

  return result.data.id;
}

// ---------------------------------------------------------------------------
// 3. Draft + send confirmation email via Gmail (Claude writes the body)
// ---------------------------------------------------------------------------
async function sendConfirmationEmail({ auth, clientEmail, clientName, propertyAddress, serviceType, scheduledDate, scheduledTime, technicianName }) {
  const anthropic    = new Anthropic();
  const serviceLabel = formatServiceLabel(serviceType);

  // Format date for display
  const dateObj = new Date(`${scheduledDate}T${scheduledTime}:00`);
  const dateLong = dateObj.toLocaleDateString('en-CA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: TIMEZONE,
  });
  const timeLong = dateObj.toLocaleTimeString('en-CA', {
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: TIMEZONE,
  });

  const system = `You are writing emails on behalf of London Fire Protection Inc., a local fire protection company in London, Ontario.
Tone: professional, friendly, and direct — like a trusted local tradesperson, not a corporation.
Never use filler phrases like "I hope this email finds you well" or "Please don't hesitate to reach out."
Always reference the specific property address and service type.
Always end emails with this exact signature:
London Fire Protection Inc.
📞 ${LFP_PHONE}
📧 ${LFP_EMAIL}
Return ONLY valid JSON with "subject" and "body" fields. No markdown. No preamble.`;

  const prompt = `Write an appointment confirmation email.
Client: ${clientName}
Property: ${propertyAddress}
Service: ${serviceLabel}
Date: ${dateLong}
Time: ${timeLong}
Technician: ${technicianName}
Confirm the appointment details clearly. Let them know a calendar invite has been sent. Mention we'll be in touch if anything changes.`;

  const msg = await anthropic.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 1024,
    system,
    messages:   [{ role: 'user', content: prompt }],
  });

  const raw   = msg.content[0].text.trim();
  const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const { subject, body } = JSON.parse(clean);

  // Send via Gmail
  const gmail = google.gmail({ version: 'v1', auth });
  const rawMsg = buildRawEmail({ to: clientEmail, subject, body });

  await gmail.users.messages.send({
    userId:      'me',
    requestBody: { raw: rawMsg },
  });
}

// ---------------------------------------------------------------------------
// 4. Update CRM Clients tab — columns J (9), K (10), L (11)
// ---------------------------------------------------------------------------
async function updateCRMAppointment({ auth, stripeCustomerId, serviceType, scheduledDate, scheduledTime, calendarEventId }) {
  const sheets = google.sheets({ version: 'v4', auth });

  // Read all rows to find the matching one
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range:         `'${CLIENTS_TAB}'!A:L`,
  });

  const rows = res.data.values || [];
  // Row 0 is the header, rows 1+ are data
  const rowIndex = rows.slice(1).findIndex(r =>
    String(r[0] || '').trim() === String(stripeCustomerId).trim() &&
    String(r[3] || '').trim() === String(serviceType).trim()
  );

  if (rowIndex === -1) {
    throw new Error(`CRM row not found for ${stripeCustomerId} / ${serviceType}`);
  }

  // +2 because slice(1) offset + Google Sheets 1-based rows + header row
  const sheetRow = rowIndex + 2;

  await sheets.spreadsheets.values.update({
    spreadsheetId:    SHEET_ID,
    range:            `'${CLIENTS_TAB}'!J${sheetRow}:L${sheetRow}`,
    valueInputOption: 'RAW',
    requestBody:      { values: [[scheduledDate, scheduledTime, calendarEventId]] },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatServiceLabel(serviceType) {
  const map = {
    fe_monthly: 'Fire Extinguisher Inspection — Monthly',
    el_monthly: 'Emergency Lighting Inspection — Monthly',
    fe_annual:  'Fire Extinguisher Inspection — Annual',
    el_annual:  'Emergency Lighting Inspection — Annual',
  };
  return map[serviceType] || serviceType;
}

function buildRawEmail({ to, subject, body }) {
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`;
  const lines = [
    `From: London Fire Protection Inc. <${LFP_EMAIL}>`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset="UTF-8"`,
    '',
    body,
  ];
  const raw = lines.join('\r\n');
  return Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ---------------------------------------------------------------------------
// Vercel handler
// ---------------------------------------------------------------------------
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!requireAuth(req, res)) return;

  const {
    stripeCustomerId,
    clientName,
    propertyAddress,
    serviceType,
    scheduledDate,
    scheduledTime,
    technicianName,
  } = req.body || {};

  // Validate required fields
  const missing = ['stripeCustomerId', 'clientName', 'propertyAddress', 'serviceType', 'scheduledDate', 'scheduledTime', 'technicianName']
    .filter(f => !req.body?.[f] || String(req.body[f]).trim() === '');

  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }

  const validServices = ['fe_monthly', 'el_monthly', 'fe_annual', 'el_annual'];
  if (!validServices.includes(serviceType)) {
    return res.status(400).json({ error: `Invalid serviceType: ${serviceType}` });
  }

  try {
    // Step 1: Get client email from Stripe
    const clientEmail = await getClientEmail(stripeCustomerId);

    const auth = getOAuth2Client();

    // Steps 2 + 3 + 4 run in sequence (calendar first so we have the eventId for the CRM)
    const calendarEventId = await createCalendarEvent({
      auth, clientName, propertyAddress, serviceType,
      scheduledDate, scheduledTime, technicianName, clientEmail,
    });

    // Step 3: Send confirmation email (non-blocking failure — log and continue)
    try {
      await sendConfirmationEmail({
        auth, clientEmail, clientName, propertyAddress, serviceType,
        scheduledDate, scheduledTime, technicianName,
      });
    } catch (emailErr) {
      console.error('Confirmation email failed (non-fatal):', emailErr.message);
    }

    // Step 4: Update CRM
    await updateCRMAppointment({
      auth, stripeCustomerId, serviceType,
      scheduledDate, scheduledTime, calendarEventId,
    });

    return res.status(200).json({ success: true, eventId: calendarEventId, clientEmail });

  } catch (err) {
    console.error('book-appointment error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
