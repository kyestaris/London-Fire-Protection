# Claude.md — London Fire Protection

> This file defines brand, code, and design rules for all web development tasks.
> Always read this file before generating any HTML, CSS, components, or copy.
> All brand assets are located in the `/brand_assets/` folder.

---

## 1. Project Overview

**Business:** London Fire Protection
**Industry:** Fire Safety Services — Inspection, Compliance, Safety
**Location:** London, Ontario, CA
**Website type:** Landing page (mobile-first, responsive)
**Stack:** HTML / CSS / JS (or as instructed per task)

---

## 2. Brand Assets

All assets are in `/brand_assets/`. Always check this folder before using placeholders.

```
/brand_assets/
  logo.png              ← Primary logo (full colour)
  logo-transparent.png  ← Transparent bg version (preferred for web)
  flame-icon.svg        ← Standalone flame icon for favicon/social
  brand-guidelines.pdf  ← Full visual reference
```

**Logo rules:**
- Minimum width: 80px
- Clearspace: 16px on all sides
- Approved backgrounds: Carbon Black (#1A1A1A) or Ash Grey (#2E2E2E) only
- Never stretch, recolour, or place on brand-colour backgrounds
- Never place on light backgrounds without a dark container

---

## 3. Colour Palette

Always use CSS variables. Never hardcode colours.

```css
:root {
  --color-primary:    #E55A2B;  /* Ember Orange — CTAs, buttons, highlights */
  --color-accent:     #B8860B;  /* Dark Goldenrod — secondary buttons, badges */
  --color-bg:         #1A1A1A;  /* Carbon Black — page background */
  --color-surface:    #2E2E2E;  /* Ash Grey — cards, nav, sections */
  --color-text-light: #F5F5F5;  /* Smoke White — body text on dark bg */
  --color-text-muted: #888888;  /* Muted — secondary text, captions */
  --color-border:     #3a3a3a;  /* Subtle borders */
}
```

**Rules:**
- Page background is always `--color-bg` (#1A1A1A)
- Cards and surfaces use `--color-surface` (#2E2E2E)
- Primary CTAs use `--color-primary`
- Secondary CTAs use `--color-accent`
- Body text uses `--color-text-light`
- Never use pure white (#FFFFFF) or pure black (#000000)

---

## 4. Typography

Import both fonts in every HTML file:

```html
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&family=Inter:wght@400;500&display=swap" rel="stylesheet">
```

```css
:root {
  --font-heading: 'Oswald', sans-serif;
  --font-body:    'Inter', sans-serif;
}
```

### Type Scale

| Element | Font | Size (desktop) | Size (mobile) | Weight |
|---------|------|----------------|---------------|--------|
| H1 | Oswald | 48px | 40px | 700 |
| H2 | Oswald | 32px | 26px | 700 |
| H3 | Oswald | 22px | 18px | 500 |
| Body | Inter | 15px | 15px | 400 |
| Small / caption | Inter | 12px | 12px | 400 |
| Button / label | Oswald | 13px | 13px | 500 |

**Rules:**
- Headings always use Oswald with letter-spacing: 1–3px
- Body text always uses Inter with line-height: 1.7
- Never use font sizes below 11px
- Buttons use Oswald in uppercase with letter-spacing: 1px

---

## 5. Spacing & Layout

```css
:root {
  --space-xs:    4px;
  --space-sm:    8px;
  --space-md:    16px;
  --space-lg:    24px;
  --space-xl:    40px;
  --space-2xl:   64px;

  --max-width:   1140px;
  --radius-btn:  6px;
  --radius-card: 8px;
  --col-gap:     24px;
}
```

### Responsive Padding

| Breakpoint | Page padding | Section padding |
|------------|-------------|-----------------|
| Mobile (< 768px) | 0 16px | 40px 0 |
| Tablet (768–1024px) | 0 24px | 60px 0 |
| Desktop (> 1024px) | 0 40px | 80px 0 |

**Rules:**
- Always centre content with `max-width: var(--max-width); margin: 0 auto;`
- Mobile is single column. Tablet is 2 column. Desktop is 3–4 column.
- Always use CSS variables for spacing — never hardcode px values
- Always include responsive styles for mobile breakpoint

---

## 6. UI Components

### Buttons

```css
/* Primary */
.btn-primary {
  font-family: var(--font-heading);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 1px;
  text-transform: uppercase;
  padding: 10px 22px;
  background: var(--color-primary);
  color: #ffffff;
  border: none;
  border-radius: var(--radius-btn);
  cursor: pointer;
}

/* Secondary */
.btn-secondary {
  font-family: var(--font-heading);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 1px;
  text-transform: uppercase;
  padding: 10px 22px;
  background: var(--color-accent);
  color: #fff8e1;
  border: none;
  border-radius: var(--radius-btn);
  cursor: pointer;
}

/* Ghost */
.btn-ghost {
  background: transparent;
  color: var(--color-text-muted);
  border: 0.5px solid #555555;
  border-radius: var(--radius-btn);
}
```

### Cards

```css
.card {
  background: var(--color-surface);
  border: 0.5px solid var(--color-border);
  border-radius: var(--radius-card);
  padding: var(--space-md);
}
```

### Input Fields

```css
input, textarea, select {
  font-family: var(--font-body);
  font-size: 13px;
  padding: 10px 14px;
  background: var(--color-surface);
  color: var(--color-text-light);
  border: 0.5px solid #555555;
  border-radius: var(--radius-btn);
  outline: none;
  width: 100%;
}
```

### Badges

```css
.badge-primary { background: var(--color-primary); color: #ffffff; }
.badge-accent  { background: var(--color-accent);  color: #fff8e1; }
.badge-muted   { background: transparent; color: #aaaaaa; border: 0.5px solid #555555; }

/* Shared */
.badge {
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: var(--radius-btn);
  display: inline-block;
}
```

### Navigation

- Background: `--color-surface`
- Logo on left, nav links centre/right, CTA button far right
- Nav links: Inter 11px, `--color-text-muted`
- Active/hover: `--color-text-light`
- CTA button: `.btn-primary`
- On mobile: hamburger menu, stacked nav

---

## 7. Icons

**Style:** Duotone — semi-transparent fill + solid stroke
**Library:** Lucide Icons (preferred) or Heroicons

```css
.icon {
  fill: rgba(229, 90, 43, 0.2);   /* --color-primary at 20% opacity */
  stroke: #E55A2B;                 /* --color-primary */
  stroke-width: 1.5px;
}
```

**Sizes:**
- UI elements: 24px
- Service cards: 32px
- Feature / hero sections: 48px

---

## 8. Imagery

- **Style:** Equipment & product shots — clean, professional, technical
- **Background:** Dark preferred — high contrast
- **Avoid:** Stock photos of people, busy backgrounds, light/white imagery
- **Format:** Use `object-fit: cover` for all images in containers
- **Lazy load:** Always add `loading="lazy"` to images below the fold
- **Alt text:** Always include descriptive alt text for accessibility

---

## 9. Brand Voice & Copy

**Style:** Confident, direct, plain English. No pronouns (no we/our/you).

| Rule | Detail |
|------|--------|
| Sentence length | Short and punchy — one idea per sentence |
| Paragraph length | Max 2–3 sentences |
| Language | Plain English — no jargon or corporate speak |
| Headlines | Oswald uppercase, lead with the strongest point |
| CTAs | Action-first — "Get a Quote", "Book Inspection", "View Services" |

**Words to use:** Certified, Trusted, Fast, Compliant, Safe, Inspected, Professional, Reliable, Qualified, Responsive

**Words to avoid:** Passionate, Leverage, Synergy, Holistic, World-class, Innovative, Seamless, Solutions

**Copy examples:**
- ✓ "Trusted. Certified. Fast."
- ✓ "Fire safety solutions for every property."
- ✓ "Fully compliant with UK fire regulations."
- ✗ "We are passionate about keeping your business safe..."
- ✗ "Our team leverages industry-leading solutions..."

---

## 10. General Code Rules

- Always write semantic HTML5 (`<header>`, `<main>`, `<section>`, `<footer>`, `<nav>`)
- Always include `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
- Always mobile-first — base styles for mobile, `@media (min-width: 768px)` for tablet+
- Always use CSS variables — never hardcode colours, spacing, or fonts
- Always include hover states on interactive elements
- Always include focus states for accessibility
- Never use `!important`
- Never use inline styles except for dynamic values
- Images must always have `alt` attributes
- Buttons must always have descriptive text or `aria-label`
