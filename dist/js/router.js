// Hash routes: #/<view> or #/<view>/<threadId>. Gives every screen a URL and makes the back button work.
import { VIEWS } from './store.js';

export function current() {
  const [v, id] = location.hash.replace(/^#\/?/, '').split('/');
  return { view: v in VIEWS ? v : 'overview', id: id ? decodeURIComponent(id) : null };
}

export const href = (view, id) => `#/${view}${id ? '/' + encodeURIComponent(id) : ''}`;

export function go(view, id, { replace = false } = {}) {
  const h = href(view, id);
  if (location.hash === h) { window.dispatchEvent(new HashChangeEvent('hashchange')); return; }
  if (replace) { history.replaceState(null, '', h); window.dispatchEvent(new HashChangeEvent('hashchange')); }
  else location.hash = h;
}
