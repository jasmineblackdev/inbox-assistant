import * as google from './google.js';
import { draftReply } from './ai.js';
import { store } from './db.js';
import { decrypt } from './crypto.js';
export const deps = { google, ai: { draftReply }, store, ReconnectError: google.ReconnectError, aiKey: u => (u.ai_key ? decrypt(u.ai_key) : null) };
