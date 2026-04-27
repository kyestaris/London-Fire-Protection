const Stripe       = require('stripe');
const { google }   = require('googleapis');

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

// Find existing Stripe customer by email
async function findStripeCustomer(stripe, email) {
  if (!email) return null;
  try {
    const list = await stripe.customers.list({ email, limit: 1 });
    return list.data[0] || null;
  } catch {
    return null;
  }
}

// Update existing Website Leads row status to "quote-sent"
async function updateLeadStatus(sheets, rowIndex) {
  if (!rowIndex) return;
  await sheets.spreadsheets.values.update({
    spreadsheetId:    SHEET_ID,
    range:            `${SHEET_NAME}!G${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody:      { values: [['quote-sent']] },
  });
}

// Append new row for leads that came in outside the website form
async function appendNewLead(sheets, client) {
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
        client.serviceNote || '—',
        '—',
        'quote-sent',
      ]],
    },
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { client, lineItems, metadata } = req.body || {};

  if (!client?.name || !lineItems?.length) {
    return res.status(400).json({ error: 'Missing client info or line items' });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // 1. Find Stripe customer by email (if exists)
    const customer = client.email ? await findStripeCustomer(stripe, client.email) : null;

    // 2. Build Stripe Quote
    const stripeLineItems = lineItems
      .filter(item => item.amount > 0)
      .map(item => ({
        price_data: {
          currency:     'cad',
          product_data: { name: item.name },
          unit_amount:  Math.round(item.amount * 100), // dollars → cents
        },
        quantity: 1,
      }));

    if (stripeLineItems.length === 0) {
      return res.status(400).json({ error: 'No priced line items — cannot create quote' });
    }

    const quoteParams = {
      line_items: stripeLineItems,
      metadata: {
        job_type:         metadata?.jobType         || 'service',
        service_category: metadata?.serviceCategory || '',
        property_address: client.address            || '',
        customer_name:    client.name,
        customer_email:   client.email              || '',
      },
      expires_at: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
      header:     `Quote for ${client.name}`,
      description: client.address ? `Property: ${client.address}` : undefined,
    };

    if (customer) {
      quoteParams.customer = customer.id;
    }

    // Apply HST tax rate if configured in env
    if (process.env.STRIPE_TAX_RATE_HST_ID) {
      quoteParams.default_tax_rates = [process.env.STRIPE_TAX_RATE_HST_ID];
    }

    const quote     = await stripe.quotes.create(quoteParams);
    const finalized = await stripe.quotes.finalizeQuote(quote.id);
    const quoteUrl  = finalized.hosted_quote_url || finalized.url;

    // 3. Update or append CRM row
    const auth   = getOAuth2Client();
    const sheets = google.sheets({ version: 'v4', auth });

    if (client.rowIndex) {
      await updateLeadStatus(sheets, client.rowIndex);
    } else {
      await appendNewLead(sheets, { ...client, serviceNote: metadata?.serviceNote });
    }

    return res.status(200).json({ quoteUrl, quoteId: finalized.id });

  } catch (err) {
    console.error('create-quote error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
