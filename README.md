# Triageo

Your inbox, prioritized — every reply approved by you. Triageo finds the emails that need a reply, drafts each one with AI from your own AI account, and saves only the replies you approve to Gmail Drafts. Nothing is ever sent for you.

**Live:** https://inbox-assistant-ten.vercel.app

## What works today

- Manual conversation import, with explicit "promotional" and "doesn't need a reply" exclusions
- Priority ranking: deadlines within 48 hours and urgent wording first, then important contacts, then requests waiting over 48 hours
- Overview dashboard, review queue, Urgent / Needs reply / Follow-ups filters, Approved drafts, and a Skipped view to restore set-aside threads
- Rule-based "Why this needs you" panel (labelled as not AI)
- Editable drafts and notes, a generic reply template, per-draft approval that any edit revokes, and plain-text export of the approved wording only
- Reminders computed from saved conversations, a fictional demo, search (`/` to focus), and editable display name
- Everything is stored in `localStorage` in the visitor's browser (key `inbox-studio-v1`, kept from before the rebrand so existing workspaces still load). Clear the workspace in Settings on shared devices.

## Gmail assistant (server)

When the server is configured, Triageo works like an inbox assistant:

1. **Connect Gmail** with Google sign-in (scopes: `gmail.readonly`, `gmail.compose`).
2. **Find what needs a reply.** Each check reads up to 25 inbox threads from the last 14 days (Promotions, Social, Updates and Forums skipped). Rules set aside newsletters, login codes, alerts and threads you answered last; the AI judges the rest.
3. **Draft each one.** Each user connects their own AI account through OpenRouter (sign in, add credits, pick Claude Opus/Sonnet/Haiku or GPT-5 mini) and pays for their own drafts. The model writes a reply in your name, with `[placeholders]` for anything it doesn't know, plus what the sender needs and any deadline. All AI output is labelled and must be reviewed. You can regenerate with a tone and your own instructions.
4. **You approve.** Nothing is sent. Approving saves your exact wording to **Gmail Drafts** in the original thread; editing removes approval, and re-approving updates the same draft.
5. **On a schedule.** Vercel Cron checks weekdays at 12:00 UTC (8–9 AM Eastern, 7–8 AM in winter); the Hobby plan allows one run a day. Turn it off in Settings.

Without the server (or with missing settings) the app runs in manual mode exactly as before.

### Data and security

- Google refresh tokens are encrypted (AES-256-GCM) in Postgres; sessions are signed HttpOnly cookies; state-changing requests require a same-origin header.
- Only addresses in `ALLOWED_EMAILS` can connect Gmail. Each user pays for their own AI drafts.
- Thread copies and AI drafts are kept for 14 days. **Disconnect** revokes Google access and deletes the account's server data.
- Thread text is sent through OpenRouter to the user's chosen model, billed to that user's credits. Each user's OpenRouter key is obtained by OAuth PKCE and stored encrypted. Email content is treated as untrusted data in the prompt.

### Setup

Environment variables (Vercel → Settings → Environment Variables):

| Variable | Source |
|---|---|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Cloud OAuth client (Web application) |
| `DATABASE_URL` | added by the Neon integration |
| `SESSION_SECRET`, `TOKEN_KEY`, `CRON_SECRET` | random, `openssl rand -base64 32` |
| `ALLOWED_EMAILS` | comma-separated Gmail addresses allowed to connect |

Google Cloud: enable the Gmail API; on the OAuth consent screen add the scopes `gmail.readonly` and `gmail.compose`; create a **Web application** client with redirect URI `https://inbox-assistant-ten.vercel.app/api/auth/google/callback`. In **Testing** status Google expires refresh tokens after 7 days (you'd reconnect weekly); for personal use you can set the app to **In production** without verification and click through the unverified-app warning.

## Not built yet

Outlook (Microsoft Graph) is next. A custom check time needs the Vercel Pro plan (hourly cron).

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
    api.js            calls to Triageo's own /api
    app.js            wiring and workflows
  brand/              Triageo logos, mark and app icons (SVG + PNG)
  favicon.ico favicon.svg manifest.webmanifest
api/                  Vercel Functions: auth, ai (OpenRouter connect), me, inbox, sync, draft, gmail-draft, disconnect, cron
lib/                  server code: config, crypto, db, google, parse, ai, pipeline
tests/                safety rules, views, merge, and server tests (no network)
```

## Run and test

```
npm start      # http://localhost:8080
npm test       # Node 20+
vercel dev     # UI + API locally (needs the env vars above)
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
