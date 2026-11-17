'use strict';

// In-process SSE event bus — publishes call lifecycle + webhook events to dashboard subscribers.
// Keeps a ring buffer of the last 200 events for new subscribers to catch up.

const MAX_HISTORY = 200;
const _subscribers = new Set();
const _history = [];

function publish(type, data) {
  const evt = { type, data, ts: Date.now() };
  _history.push(evt);
  if (_history.length > MAX_HISTORY) _history.shift();

  const msg = `data: ${JSON.stringify(evt)}\n\n`;
  for (const res of _subscribers) {
    try { res.write(msg); } catch {}
  }
}

function subscribe(res) {
  _subscribers.add(res);
  // Send last 50 events as catch-up
  const catchup = _history.slice(-50);
  if (catchup.length) {
    const bulk = catchup.map(e => `data: ${JSON.stringify(e)}`).join('\n') + '\n\n';
    try { res.write(bulk); } catch {}
  }
  return () => _subscribers.delete(res);
}

function recentWebhooks() {
  return _history.filter(e => e.type === 'webhook').slice(-50);
}

module.exports = { publish, subscribe, recentWebhooks };
