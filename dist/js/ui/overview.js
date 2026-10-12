import { icon } from '../icons.js';
import { esc, ago, preview, fmtShort } from '../format.js';
import { href } from '../router.js';
import { state, listFor, counts } from '../store.js';
import { classify, isActive, draftState } from '../logic.js';
import { avatar, badge, dueChip, nextAction, button } from './components.js';
import { overviewCardHTML, primaryButton, status } from './connection.js';

function row(t, now, { meta } = {}) {
  const a = nextAction(t);
  return `<a class="ov-row" href="${href('queue', t.id)}">
    ${avatar(t.sender, 32)}
    <span class="ov-main"><span class="ov-top"><strong>${esc(t.sender)}</strong>${badge(t)}</span>
      <span class="ov-subject">${esc(t.subject)}</span>
      ${meta ? `<span class="ov-meta">${meta}</span>` : ''}</span>
    <span class="next-action">${icon(a.icon, 14)}<span>${a.label}</span></span>
  </a>`;
}

function card(title, ic, body, { link, count } = {}) {
  return `<section class="card ov-card">
    <header class="card-head"><h2>${icon(ic, 16)}${title}${count != null ? `<span class="card-count">${count}</span>` : ''}</h2>${link ? `<a class="link" href="${link}">View all ${icon('arrow-right', 14)}</a>` : ''}</header>
    <div class="card-body">${body}</div></section>`;
}

const none = text => `<p class="card-empty">${icon('circle-check', 16)}${text}</p>`;

function welcome() {
  const steps = [['upload', 'Import', 'Connect Gmail or paste an email you need to answer. Copies are saved only in this browser.'], ['list-checks', 'Review', 'Triageo ranks it by deadline, contact and wait time, and explains why.'], ['shield-check', 'Approve & export', 'Write your reply, approve that exact wording, then export it. Nothing is ever sent.']];
  return `<section class="card welcome">
    <div class="welcome-intro"><img src="brand/triageo-mark.svg" alt="" width="40" height="40"><div><h2>Welcome to Triageo</h2><p>A calm place to decide what needs you, and to write replies you’ve approved yourself.</p></div></div>
    <ol class="steps">${steps.map(([ic, h, p], i) => `<li><span class="step-icon">${icon(ic, 18)}</span><div><strong>${i + 1}. ${h}</strong><p>${p}</p></div></li>`).join('')}</ol>
    <div class="welcome-actions">${status() === 'disconnected' ? primaryButton() + button('Import manually', { action: 'open-import', ic: 'plus' }) : button('Import an email', { action: 'open-import', variant: 'primary', ic: 'plus' })}${button('Try the demo', { action: 'load-demo', ic: 'flask-conical' })}</div>
  </section>`;
}

export function renderOverview(el, now = Date.now()) {
  const c = counts(now);
  const pending = listFor('queue', now);
  const head = `<div class="page-head"><div><h1>Overview</h1><p>${state.items.length
    ? (c.queue ? `${c.queue} conversation${c.queue === 1 ? '' : 's'} need${c.queue === 1 ? 's' : ''} you${c.urgent ? ` · ${c.urgent} urgent` : ''}` : 'You’re all caught up.')
    : 'Get set up in a minute.'}</p></div>
    <div class="page-actions">${state.items.length ? '' : button('Try the demo', { action: 'load-demo', ic: 'flask-conical' })}${status() === 'connected' || status() === 'expired' ? primaryButton() : ''}${button('Import email', { action: 'open-import', variant: 'primary', ic: 'plus' })}</div></div>`;

  if (!state.items.length) { el.innerHTML = `<div class="page">${head}${welcome()}${overviewCardHTML()}</div>`; return; }

  const kpi = (label, value, sub, view, tone = '', ic) => `<a class="kpi ${tone}" href="${href(view)}"><span class="kpi-label">${icon(ic, 16)}${label}</span><strong>${value}</strong><small>${sub}</small></a>`;
  const drafts = state.items.filter(t => isActive(t, now) && draftState(t) === 'draft');
  const follow = pending.filter(t => classify(t, now) === 'Follow-Up');
  const recent = [...state.items].filter(t => classify(t, now) || draftState(t) === 'approved').sort((a, b) => Date.parse(b.received) - Date.parse(a.received)).slice(0, 5);

  el.innerHTML = `<div class="page">${head}
    <div class="kpis">
      ${kpi('Needs attention', c.queue, 'Waiting for your reply', 'queue', '', 'inbox')}
      ${kpi('Urgent', c.urgent, 'Due within 48h or marked urgent', 'urgent', c.urgent ? 'kpi-urgent' : '', 'alarm-clock')}
      ${kpi('Awaiting approval', c.drafts, 'Drafts you haven’t approved', 'queue', '', 'pen-line')}
      ${kpi('Ready to export', c.approved, 'Approved, never sent', 'approved', '', 'check-check')}
    </div>
    <div class="ov-grid">
      <div class="ov-col">
        ${card('Priority inbox', 'list-checks', pending.length ? pending.slice(0, 5).map(t => row(t, now, { meta: [dueChip(t, now), `<span>${esc(preview(t.request || t.snippet || t.body, 80))}</span>`].join('') })).join('') : none('Nothing needs a reply right now.'), { link: href('queue'), count: pending.length })}
        ${card('Recent conversations', 'clock', recent.length ? recent.map(t => row(t, now, { meta: `<span>${esc(fmtShort(t.received, now))} · ${esc(ago(t.received, now))}</span>` })).join('') : none('No conversations yet.'))}
      </div>
      <div class="ov-col">
        ${card('Drafts awaiting approval', 'shield-check', drafts.length ? drafts.map(t => row(t, now, { meta: `<span>${esc(preview(t.draft, 70))}</span>` })).join('') : none('No unapproved drafts.'), { count: drafts.length })}
        ${card('Follow-up reminders', 'repeat', follow.length ? follow.map(t => row(t, now, { meta: `<span>Waiting ${esc(ago(t.received, now).replace(' ago', ''))}</span>` })).join('') : none('No requests waiting over 48 hours.'), { link: follow.length ? href('follow') : null, count: follow.length })}
        ${overviewCardHTML({ compact: true })}
      </div>
    </div></div>`;
}

