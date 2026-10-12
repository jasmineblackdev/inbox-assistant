// Server configuration, read from Vercel environment variables.
const REQUIRED = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'OPENAI_API_KEY', 'DATABASE_URL', 'SESSION_SECRET', 'TOKEN_KEY', 'ALLOWED_EMAILS'];

export const env = name => process.env[name] || '';
export const missingConfig = () => REQUIRED.filter(k => !process.env[k]);
export const isConfigured = () => missingConfig().length === 0;

export const OPENAI_MODEL = () => env('OPENAI_MODEL') || 'gpt-5-mini';
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
