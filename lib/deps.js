import * as google from './google.js';
import { draftReply } from './ai.js';
import { store } from './db.js';
export const deps = { google, ai: { draftReply }, store, ReconnectError: google.ReconnectError };
