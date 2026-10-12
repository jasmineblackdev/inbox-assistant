// Gmail thread → Triageo item. Pure functions, shared by the sync pipeline and tests.
export const QUERY = 'in:inbox newer_than:14d -category:promotions -category:social -category:forums -category:updates';

export const header = (m, name) => m.payload?.headers?.find(h => h.name.toLowerCase() === name)?.value || '';

export function parseAddress(v) {
  const m = String(v).match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  return m ? { name: m[1].trim() || m[2].trim(), email: m[2].trim() } : { name: String(v).trim(), email: String(v).trim() };
}

const decode = data => Buffer.from(data, 'base64url').toString('utf8');
function findPart(p, type) {
  if (!p) return null;
  if (p.mimeType === type && p.body?.data) return p;
  for (const c of p.parts || []) { const f = findPart(c, type); if (f) return f; }
  return null;
}
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ', apos: "'" };
export function htmlToText(html) {
  return html.replace(/<(style|script|head|title)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h\d)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#?\w+);/g, (m, e) => ENTITIES[e] ?? (e[0] === '#' ? String.fromCodePoint(Number(e.slice(1).replace(/^x/, '0x'))) : m));
}

export function messageText(m) {
  const plain = findPart(m.payload, 'text/plain');
  const html = plain ? null : findPart(m.payload, 'text/html');
  const text = plain ? decode(plain.body.data) : html ? htmlToText(decode(html.body.data)) : (m.snippet || '');
  const lines = text.replace(/\r/g, '').split('\n');
  const cut = lines.findIndex(l => /^On .+wrote:\s*$/.test(l.trim()) || /^-{2,}\s*Original Message/i.test(l.trim()));
  return (cut > 0 ? lines.slice(0, cut) : lines).filter(l => !/^>/.test(l.trim()))
    .join('\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Returns null when the thread has no message from someone else. */
export function toItem(thread, me) {
  const msgs = thread.messages || [];
  const mine = m => (m.labelIds || []).includes('SENT') || parseAddress(header(m, 'from')).email.toLowerCase() === me.toLowerCase();
  const inbound = [...msgs].reverse().find(m => !mine(m));
  if (!inbound) return null;
  const last = msgs[msgs.length - 1];
  const from = parseAddress(header(inbound, 'from'));
  const replyTo = header(inbound, 'reply-to') ? parseAddress(header(inbound, 'reply-to')).email : from.email;
  const when = m => new Date(Number(m.internalDate)).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
  const body = msgs.slice(-5).map(m => `— ${mine(m) ? 'You' : parseAddress(header(m, 'from')).name} · ${when(m)} ET\n${messageText(m)}`).join('\n\n');
  const automated = !!header(inbound, 'list-unsubscribe') || /^(bulk|list|junk)$/i.test(header(inbound, 'precedence'))
    || /(no-?reply|do-?not-?reply|notifications?)@/i.test(from.email);
  return {
    id: 'gmail:' + thread.id, source: 'gmail', gmailThreadId: thread.id,
    sender: from.name, email: from.email, replyTo,
    subject: header(msgs[0], 'subject') || '(no subject)',
    body: body.length > 8000 ? body.slice(0, 8000) + '\n\n[Shortened — open in Gmail for the full thread]' : body,
    snippet: messageText(inbound).slice(0, 240),
    received: new Date(Number(inbound.internalDate)).toISOString(),
    important: msgs.some(m => (m.labelIds || []).includes('STARRED')),
    needsReply: !mine(last), automated,
    // For threading the reply draft and for detecting new messages.
    lastMessageId: last.id, replyToMessageId: header(inbound, 'message-id'), references: header(inbound, 'references'),
  };
}

const encodeHeader = s => /^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;

/** RFC 2822 reply, base64url-encoded for the Gmail API. */
export function buildReply(item, text, fromEmail) {
  const subject = /^re:/i.test(item.subject) ? item.subject : `Re: ${item.subject}`;
  const lines = [
    `From: ${fromEmail}`, `To: ${item.replyTo || item.email}`, `Subject: ${encodeHeader(subject)}`,
    ...(item.replyToMessageId ? [`In-Reply-To: ${item.replyToMessageId}`, `References: ${[item.references, item.replyToMessageId].filter(Boolean).join(' ')}`] : []),
    'MIME-Version: 1.0', 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: base64', '',
    Buffer.from(text, 'utf8').toString('base64').replace(/.{76}/g, '$&\r\n'),
  ];
  return Buffer.from(lines.join('\r\n'), 'utf8').toString('base64url');
}
