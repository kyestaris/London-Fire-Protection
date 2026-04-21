# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

London Fire Protection Inc. — a live business website at `https://www.londonfireprotection.ca`. Single-page static site with Vercel serverless API functions for the contact form.

## Local Development

```bash
node serve.mjs        # Start local server at http://localhost:3000
node generate-qr.mjs  # Regenerate QR code in brand_assets/qr-code.png
node screenshot.mjs http://localhost:3000  # Capture screenshots via Puppeteer
```

**Important:** The contact form (`/api/contact`) only works when deployed to Vercel. Locally it will 404 — this is expected.

## Tech Stack

- **Frontend:** Single `index.html` with all CSS inline. No framework, no build step.
- **Backend:** Vercel Serverless Functions in `/api` (Node.js, CommonJS format)
- **Deployment:** Vercel — auto-deploys on push to `master` branch of GitHub repo
- **Live domain:** `https://www.londonfireprotection.ca` (DNS via Namecheap → Vercel)

## Architecture

All page content, styles, and layout live in `index.html`. JavaScript for the contact form is in `js/contact.js` (client-side) which POSTs to `/api/contact` (server-side).

**Contact form flow (`api/contact.js`):**
1. Validates `name` + `email` fields
2. Logs lead to Google Sheets (Sheet ID in env)
3. Uses Claude API (`claude-opus-4-6`) to draft a personalized follow-up email
4. Sends follow-up email to customer via Gmail API
5. Sends internal notification email to `info@londonfireprotection.ca`
6. Google/Claude errors are non-fatal — form returns 200 OK regardless

**Adding a new API endpoint:** Create `/api/your-endpoint.js` exporting `async function handler(req, res)` — Vercel picks it up automatically. Follow the pattern in `api/contact.js`.

## Environment Variables

Required in Vercel dashboard (and mirrored in `.env.vercel` locally):

| Variable | Purpose |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth2 client ID for Sheets + Gmail |
| `GOOGLE_CLIENT_SECRET` | OAuth2 client secret |
| `GOOGLE_REFRESH_TOKEN` | OAuth2 refresh token (set in Vercel dashboard) |
| `SHEET_ID` | Google Sheet ID for lead logging |
| `ANTHROPIC_API_KEY` | Claude API key for follow-up email drafting |
| `CONTACT_EMAIL` | Internal notification recipient (`info@londonfireprotection.ca`) |
| `RESEND_API_KEY` | Resend email key (installed but not currently used) |

## Brand

- **Primary colour:** `#E55A2B` (orange)
- **Accent colour:** `#B8860B` (gold) — used for section headings
- **Background:** `#1A1A1A`
- **Font:** Heading font is `var(--font-heading)`, body is system sans-serif
- **Logo:** `brand_assets/LOGO London Fire Protection Inc.  (1).png`
