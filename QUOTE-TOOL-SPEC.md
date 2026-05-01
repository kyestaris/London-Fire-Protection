# LFP Quote Tool — Build Specification
**London Fire Protection Inc. — Internal Quoting Tool**
*Hand this file to Claude Code when ready to build. All decisions are final unless noted.*

---

## What This Is

A mobile-first internal quoting tool for Kyle and Daniel. Accessible at `londonfireprotection.ca/quote` (bookmarked on their phones). Clients never see or interact with it. Kyle uses it during follow-up calls and on-site walkthroughs to build and send a Stripe Quote to the client.

This is NOT a new project — it is built on top of the existing Vercel deployment in this folder (`Testing site/`). It reuses existing Stripe and Google credentials already configured in `.env.vercel`.

---

## Files to Create

| File | Purpose |
|---|---|
| `quote.html` | The quote tool — 4-screen wizard |
| `api/search-client.js` | Searches Google Sheets CRM by name or email |
| `api/create-quote.js` | Creates Stripe Quote + updates CRM row status |

Do NOT touch: `index.html`, `api/contact.js`, `serve.mjs`, `generate-pdf.mjs`, `generate-card-pdf.mjs`

---

## Tech Stack

- Plain HTML/CSS/JS — no framework, no build step (matches existing `index.html` pattern)
- Vercel serverless functions in `/api/` (CommonJS, same pattern as `api/contact.js`)
- Google Sheets API v4 (reuse existing OAuth2 credentials)
- Stripe Quotes API (reuse existing `STRIPE_SECRET_KEY`)
- Mobile-first — designed for thumb use on phone, large tap targets, no horizontal scroll

---

## Environment Variables (already in `.env.vercel`)

- `STRIPE_SECRET_KEY` — Stripe Quotes API
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` — Google Sheets/Gmail OAuth2
- `SHEET_ID` — Google Sheets CRM ID (the "Website Leads" sheet lives here)

---

## CRM Sheet Structure

**Sheet name:** `Website Leads`
**Columns (A–G):**

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| Date | Name | Phone | Email | Service requested | Message | Status |

- Rows are appended by `api/contact.js` when a website lead comes in (status = `"new"`)
- The quote tool searches this sheet by name (col B) or email (col D)
- On quote submission, update the matched row's status (col G) to `"quote-sent"`

---

## Screen 1 — Client Info (CRM Lookup)

**Purpose:** Identify the client and pull their info from the CRM if they're already in it.

**Layout:**
1. Search bar at top — "Search by name or email"
2. As user types (debounced ~300ms), calls `api/search-client.js`
3. Results appear as selectable cards below the search bar
4. Clicking a result pre-fills: Name, Phone, Email
5. Remaining fields to fill in manually: Property Address, Client Type

**Fields:**
- Name (text)
- Email (text)
- Phone (text)
- Property address (text)
- Client type: **Residential / Commercial** toggle — drives OFC rule engine on Screen 4

**"New client" fallback:** If no CRM match, all fields filled manually. New row added to CRM on quote submission.

**`api/search-client.js` behaviour:**
- Accepts `?q=` query param (name or email string)
- Reads all rows from `Website Leads` sheet
- Returns rows where col B (name) or col D (email) contains the query string (case-insensitive)
- Returns: `[{ name, phone, email, service, rowIndex }]`
- `rowIndex` is used later to update the status column on submission

---

## Screen 2 — Property Details

**Purpose:** Capture property info that drives the OFC rule engine.

**Fields:**
- **Occupancy type** (dropdown):
  - Office
  - Restaurant / Food Service
  - Retail
  - Industrial / Warehouse
  - Assembly (church, gym, theater, event space)
  - Care / Detention (daycare, long-term care, group home) ⚠️ — show warning: "Vulnerable Occupancy — confirm with Kyle before proceeding"
  - Apartment — 4+ storeys
  - Apartment — under 4 storeys
  - Residential (single family / duplex)
- **Number of floors** — stepper (+ / − buttons, large tap targets)
- **Existing FSP on file?** — Yes / No toggle
- **Currently under monthly inspection contract?** — Yes / No toggle
- **Fuel-burning appliance or attached garage?** — Yes / No toggle. Only show if Client Type = Residential OR Occupancy = Residential

---

## Screen 3 — Services Requested

**Purpose:** Select what the client asked for and enter unit counts.

**Behaviour:**
- If a service was captured from the contact form (CRM col E), pre-check the matching checkbox
- Each checkbox reveals an inline unit count stepper when checked
- Unit count fields have two modes:
  - **Number input** — Kyle enters an estimated count
  - **"Confirm on-site" toggle** — if count is unknown; this line item shows as *"Priced on-site"* on the Stripe quote rather than a calculated price

**Services list:**

| Service | Unit Input | Notes |
|---|---|---|
| FE Inspection — monthly | # of FE units | |
| FE Inspection — annual | # of FE units | |
| FE Supply & Install | # of units + type selector (5lb ABC / 10lb ABC / 20lb ABC / 5lb CO2) | |
| CO Alarm Installation | # of units | |
| Smoke/CO Combo Installation | # of units + type selector (Battery 21031518 / Interconnected 21033116) | |
| EL Inspection — monthly | # of EL units | |
| EL Inspection — annual duration test | # of EL units | |
| Fire Safety Plan (new) | No unit count — pulls property details from Screen 2 | |
| Fire Safety Plan (annual revision) | No unit count | Only show if "Existing FSP on file = Yes" from Screen 2 |
| Pre-Fire Inspection | No unit count — Kyle enters custom price manually | |
| Fire Safety Training | # of attendees | |

---

## Screen 4 — Quote Summary

**Purpose:** Review the full quote, toggle OFC-required items and upsells, send to Stripe.

**Three sections (all visible to Kyle, all toggleable):**

### Section A — What They Requested
Line items from Screen 3 with calculated prices. Always included.

### Section B — Also Required by Ontario Fire Code
Auto-generated by the OFC rule engine (see below). Each item shows the OFC reference. Kyle can toggle each one on or off. These are talking points for the call — Kyle advises, client decides.

### Section C — Recommended Add-Ons
Smart upsell suggestions based on what's selected. Kyle can toggle each on or off.

**Upsell logic:**
- FE monthly + EL monthly both selected → suggest Bundle #1 (auto-applies discount if both toggled on)
- FSP (new) selected → suggest Fire Safety Training ("OFC requires occupants be trained on the FSP")
- FE inspection selected, no EL selected → suggest EL inspection ("If you have emergency lighting, we can bundle the visit")
- Monthly inspection not selected → suggest monthly contract

**Bottom totals:**
- Subtotal (ex-HST)
- HST (13%)
- Total

**Actions:**
- [Send Quote to Stripe] — creates Stripe Quote, returns hosted quote URL, updates CRM row to "quote-sent"
- [Print / Save PDF] — triggers browser print (use `@media print` CSS)
- [Start Over] — clears all fields and returns to Screen 1

**ONE Stripe quote is sent** — not two. Kyle builds the quote by toggling sections B and C. What's toggled on goes into the quote. What's toggled off stays as Kyle's talking notes only.

---

## OFC Rule Engine (Section B auto-flags)

Run this logic after Screen 2 is completed. Each flag appears as a toggleable line item in Section B.

```
IF occupancy = any commercial type (not Residential):
  → Flag: FE monthly inspection required (OFC s.6.2 / NFPA 10)
  → Flag: FE annual maintenance required (OFC s.6.2 / NFPA 10)

IF occupancy = any commercial AND EL units likely present:
  → Flag: EL monthly functional test required (OFC s.6.7)
  → Flag: EL annual duration test required (OFC s.6.7)

IF occupancy = Assembly OR Care/Detention OR Apartment 4+ storeys:
  → Flag: Fire Safety Plan required (OFC Div. B s.2.8)

IF occupancy = Apartment under 4 storeys AND floors imply 10+ occupants:
  → Flag: Fire Safety Plan may be required (OFC s.2.8.1.1) — "confirm occupant count"

IF residential AND fuel-burning appliance OR attached garage = Yes:
  → Flag: CO alarm required on every storey + adjacent to each sleeping area (O. Reg. 87/25)

IF existing FSP on file = Yes:
  → Flag: Annual FSP revision required (OFC s.2.8)
```

---

## Pricing Logic

### FE Inspection (monthly or annual)
- Base fee: $65.00
- Per unit: 1–10 = $8.00 | 11–50 = $6.00 | 51+ = $5.00
- Minimum total: $90.00

### EL Inspection — monthly
- Base fee: $65.00
- Per unit: 1–10 = $8.00 | 11–50 = $6.00 | 51+ = $5.00

### EL Inspection — annual duration test
- Base fee: $65.00
- Per unit: $25.00 flat (all quantities)

### Bundle #1 — FE + EL same visit
- Applies automatically when BOTH FE monthly AND EL monthly are toggled on
- Base fee: $65.00 (one fee, not two)
- Per unit: $6.00 flat for ALL units combined (FE + EL)

### FE Supply & Install
- Base fee: $65.00
- Per unit:
  - 5lb ABC (D-ABC5W): $75.00
  - 10lb ABC (D-ABC10): $115.00
  - 20lb ABC (D-ABC20): $250.00
  - 5lb CO2 (5CO2): $350.00

### CO Alarm Installation (C3010)
- No base fee
- Per unit: $50.00 product + $40.00 install = $90.00

### Smoke/CO Combo Installation
- No base fee
- Battery (21031518): $80.00 product + $40.00 install = $120.00
- Interconnected (21033116): $88.50 product + $40.00 install = $128.50

### Fire Safety Plan (new)
- Base: $300.00
- Add-ons (Kyle selects from a checklist that appears when FSP is checked):
  - Additional floor (beyond 1st): +$75–$150/floor
  - 3,000–10,000 sq ft: +$100–$300
  - 10,000+ sq ft: +$300–$600
  - High-risk occupancy: +$150–$400
  - High occupant load (>50): +$50–$150
  - Fire alarm documentation: +$75–$150
  - Sprinkler documentation: +$75–$150
  - EL documentation: +$25–$75
  - Create evacuation plans: +$200–$500
  - Full drawings from scratch: +$400–$800
  - Submission to fire department: included ($182 filing fee baked in)
  - Rush (3–5 days): +25%
  - Emergency (1–2 days): +50%
- FSPB-1 box: $165.00 + HST — billed as a separate line item

### Fire Safety Plan — Annual Revision
- Kyle selects from range: $150 / $200 / $250 / $300 / $400 or enters custom

### Pre-Fire Inspection
- Custom — Kyle enters price manually

### Fire Safety Training
- ≤15 people: Kyle selects $150 / $200 / $250 / $300
- 16+ people: Kyle enters per-person rate ($15–$20) and attendee count

### HST
- 13% on all line items — shown as a separate line at the bottom

---

## `api/create-quote.js` Behaviour

1. Receives the full quote object from `quote.html`
2. Creates a Stripe Quote using Stripe Quotes API with all toggled-on line items
3. If a unit count was "confirm on-site", adds it as a $0 line item with description *"Priced on-site — confirm unit count at visit"*
4. Finalizes and returns the Stripe-hosted quote URL
5. Updates the client's CRM row (col G) to `"quote-sent"` using the `rowIndex` from the search
6. If client is new (no CRM match), appends a new row to "Website Leads" with status `"quote-sent"`

---

## PIN Protection

A 4-digit PIN screen is the first thing shown when anyone opens `/quote`. Kyle and Daniel know the PIN — anyone else who guesses the URL hits a lock screen.

**Implementation:**
- PIN is hardcoded in `quote.html` (no server call needed — this is obscurity, not auth)
- On correct PIN: show Screen 1, store a sessionStorage flag so the PIN screen doesn't re-appear on refresh
- On incorrect PIN: shake animation, clear the input, let them try again (no lockout needed)
- PIN is set at build time — to change it, edit the constant in `quote.html`

---

## Brand / Styling Reference

Match the existing `index.html` brand:
- Primary colour: `#E55A2B` (orange)
- Dark background: `#1A1A1A`
- Font: Inter (Google Fonts) for body, Oswald for headings
- Large tap targets (minimum 44px height on interactive elements)
- No horizontal scroll on mobile
- Progress indicator at top showing which screen the user is on (1 of 4)

---

## Integration Note

Before building, review all other tools currently deployed or in progress in this project (check for `schedule.html`, `invoice.html`, and any related API endpoints). The quote tool should integrate naturally with whatever scheduling and invoicing workflows exist at build time — shared navigation, consistent UI patterns, and any handoff points between quoting → scheduling → invoicing should be connected. Do not build in isolation — read the current state of those files first and align the quote tool to match.
