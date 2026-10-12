# Triageo

Your inbox, prioritized — every reply approved by you. A calm, private workspace for deciding which emails need you and preparing replies you approve yourself.

**Live:** https://inbox-assistant-ten.vercel.app

## What works today

- Manual conversation import, with explicit "promotional" and "doesn't need a reply" exclusions
- Priority ranking: deadlines within 48 hours and urgent wording first, then important contacts, then requests waiting over 48 hours
- Overview dashboard, review queue, Urgent / Needs reply / Follow-ups filters, Approved drafts, and a Skipped view to restore set-aside threads
- Rule-based "Why this needs you" panel (labelled as not AI)
- Editable drafts and notes, a generic reply template, per-draft approval that any edit revokes, and plain-text export of the approved wording only
- Reminders computed from saved conversations, a fictional demo, search (`/` to focus), and editable display name
- Everything is stored in `localStorage` in the visitor's browser (key `inbox-studio-v1`, kept from before the rebrand so existing workspaces still load). Clear the workspace in Settings on shared devices.

## Not built yet

No live Gmail connection, AI draft generation, sending, or scheduled jobs. The weekday 8:00 AM America/New_York review is shown as **planned · not active**. A connected version needs a Gmail OAuth backend, a secure AI generation service and a scheduler. Sending would require explicit approval of each exact draft, an authenticated identity, duplicate protection and Gmail write consent.

## Project layout

```
dist/                 static site, served as-is (no build step)
  index.html
  css/                tokens.css · base.css · components.css · layout.css
  js/
    logic.js          review rules: classify / editDraft / approve / canExport
    store.js          browser storage, views, counts, reminders, demo data
    router.js         hash routes (#/queue/<id>) for deep links and the back button
    format.js icons.js
    ui/               sidebar · header · overview · threadList · threadView · dialogs · toast · components
    app.js            wiring and workflows
  brand/              Triageo logos, mark and app icons (SVG + PNG)
  favicon.ico favicon.svg manifest.webmanifest
tests/logic.test.js   safety-rule and view tests
```

## Run and test

```
npm start      # http://localhost:8080
npm test       # Node 20+, no dependencies
```

## Brand assets (`dist/brand/`)

| File | Use |
|---|---|
| `triageo-logo-light.svg/.png` · `triageo-logo-dark.svg/.png` | Horizontal logo for light / dark backgrounds |
| `triageo-lockup-light.svg/.png` · `triageo-lockup-dark.svg/.png` | Logo with "Your AI Inbox Assistant" tagline |
| `triageo-mark.svg` · `triageo-mark-512.png` | Envelope mark on its own, transparent |
| `app-icon.svg` · `icon-192.png` · `icon-512.png` | Rounded app icon |
| `app-icon-square.svg` · `icon-maskable-512.png` · `apple-touch-icon.png` | Full-bleed icon for iOS and Android masking |
| `../favicon.svg` · `../favicon.ico` | Browser tab icon (16/32/48) |

Colors: navy `#0f1530`, indigo `#4f46e5`, periwinkle `#a5b4fc`, white. Wordmark set in Poppins Bold (outlined, so no font is needed); UI text in Inter. Icons from Lucide (ISC).

## Deploy

Vercel serves `dist/` via `vercel.json`. Pushes to `main` deploy to production; `vercel` from this folder creates a preview.
