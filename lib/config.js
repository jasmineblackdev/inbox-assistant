// Server configuration, read from Vercel environment variables.
// AI drafting uses each user's own OpenRouter connection, so no shared AI key is required.
const REQUIRED = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'DATABASE_URL', 'SESSION_SECRET', 'TOKEN_KEY', 'ALLOWED_EMAILS'];

export const env = name => process.env[name] || '';
export const missingConfig = () => REQUIRED.filter(k => !process.env[k]);
export const isConfigured = () => missingConfig().length === 0;

/** Models offered for drafting (OpenRouter IDs). Cost is a rough per-draft estimate for a typical email. */
export const AI_MODELS = [
  { id: 'anthropic/claude-opus-5.5', label: 'Claude Opus 5.5', note: 'Best writing · about 3¢ per draft' },
  { id: 'anthropic/claude-sonnet-5.5', label: 'Claude Sonnet 5.5', note: 'Balanced · about 1.5¢ per draft' },
  { id: 'anthropic/claude-haiku-5.5', label: 'Claude Haiku 5.5', note: 'Fastest · under 0.1¢ per draft' },
  { id: 'openai/gpt-5-mini', label: 'GPT-5 mini', note: 'Low cost · about 0.3¢ per draft' },
];
export const DEFAULT_MODEL = AI_MODELS[0].id;
export const allowedEmails = () => env('ALLOWED_EMAILS').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

export const SCOPES = [
  'openid', 'email', 'profile',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
];

/** Weekday morning check. Hobby plan: one cron per day, so the time is fixed in vercel.json. */
export const SCHEDULE_LABEL = 'Weekdays, 8–9 AM Eastern (7–8 AM in winter)';
export const RETENTION_DAYS = 14;
export const MAX_THREADS = 25;
export const MAX_DRAFTS_PER_RUN = 12;
