'use strict';

// Batch outbound caller — calls a list of numbers with configurable concurrency.
//
// Entry statuses: pending → calling → dialed → (answered|voicemail|failed)
// Job statuses:   running → done | cancelled
//
// POST /admin/batch-calls  → startBatch
// GET  /admin/batch-calls  → listBatches
// GET  /admin/batch-calls/:batchId  → getBatch (includes per-number results)
// DELETE /admin/batch-calls/:batchId → cancelBatch

const { randomUUID } = require('crypto');
const { initiateOutboundCall } = require('./outbound');

const MAX_CONCURRENT = 5;
const MIN_DELAY_MS   = 500;
const E164_RE        = /^\+[1-9]\d{6,14}$/;

const _batches = new Map();

/**
 * Start a batch job.
 * @param {object} opts
 * @param {Array<{to,firstMessage?,variables?}>} opts.numbers
 * @param {number} [opts.concurrency=3]
 * @param {number} [opts.delayMs=1000]
 * @param {string} [opts.name]
 */
async function startBatch({ numbers, concurrency = 3, delayMs = 1000, name = '' }) {
  if (!Array.isArray(numbers) || numbers.length === 0) throw new Error('numbers: non-empty array required');
  if (numbers.length > 500) throw new Error('numbers: max 500 per batch');

  for (const n of numbers) {
    if (!n.to || !E164_RE.test(n.to)) throw new Error(`Invalid E.164 number: "${n.to}"`);
  }

  const batchId  = randomUUID();
  const maxConc  = Math.min(Math.max(1, concurrency), MAX_CONCURRENT);
  const safeDelay = Math.max(delayMs, MIN_DELAY_MS);

  const job = {
    batchId,
    name:       String(name).slice(0, 100),
    status:     'running',
    concurrency: maxConc,
    delayMs:    safeDelay,
    total:      numbers.length,
    createdAt:  new Date().toISOString(),
    finishedAt: null,
    results:    numbers.map(n => ({
      to:            n.to,
      firstMessage:  n.firstMessage || null,
      variables:     n.variables    || {},
      status:        'pending',
      callControlId: null,
      error:         null,
      startedAt:     null,
      endedAt:       null,
    })),
  };

  _batches.set(batchId, job);
  console.log(`[Batch:${batchId.slice(-8)}] Started — ${numbers.length} numbers, concurrency=${maxConc}, delay=${safeDelay}ms`);

  _runBatch(job).catch(err =>
    console.error(`[Batch:${batchId.slice(-8)}] Unexpected error:`, err.message)
  );

  return { batchId };
}

async function _runBatch(job) {
  const queue    = [...job.results];
  const inFlight = new Set();

  async function callOne(entry) {
    entry.status    = 'calling';
    entry.startedAt = new Date().toISOString();
    try {
      const { callControlId } = await initiateOutboundCall({
        to:           entry.to,
        firstMessage: entry.firstMessage || undefined,
        variables:    entry.variables,
      });
      entry.callControlId = callControlId;
      entry.status        = 'dialed';
    } catch (err) {
      entry.status  = 'failed';
      entry.error   = err.message;
      entry.endedAt = new Date().toISOString();
      console.warn(`[Batch] ${entry.to} failed: ${err.message}`);
    }
  }

  while ((queue.length > 0 || inFlight.size > 0) && job.status === 'running') {
    while (queue.length > 0 && inFlight.size < job.concurrency && job.status === 'running') {
      const entry = queue.shift();
      const p = callOne(entry).finally(() => inFlight.delete(p));
      inFlight.add(p);
      if (queue.length > 0 && job.status === 'running') await _sleep(job.delayMs);
    }
    if (inFlight.size > 0) await Promise.race(inFlight);
  }

  // Cancel remaining pending entries if job was cancelled
  if (job.status === 'cancelled') {
    for (const r of job.results) {
      if (r.status === 'pending') { r.status = 'cancelled'; r.endedAt = new Date().toISOString(); }
    }
  }

  if (job.status === 'running') job.status = 'done';
  job.finishedAt = new Date().toISOString();

  const s = _stats(job);
  console.log(`[Batch:${job.batchId.slice(-8)}] ${job.status} — dialed=${s.dialed} failed=${s.failed}`);
}

function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function _stats(job) {
  const s = { pending: 0, calling: 0, dialed: 0, failed: 0, cancelled: 0 };
  for (const r of job.results) s[r.status] = (s[r.status] || 0) + 1;
  return s;
}

function getBatch(batchId) {
  return _batches.get(batchId) || null;
}

function listBatches() {
  return [..._batches.values()].map(j => ({
    batchId:    j.batchId,
    name:       j.name,
    status:     j.status,
    total:      j.total,
    createdAt:  j.createdAt,
    finishedAt: j.finishedAt,
    stats:      _stats(j),
  }));
}

function cancelBatch(batchId) {
  const job = _batches.get(batchId);
  if (!job || job.status !== 'running') return false;
  job.status = 'cancelled';
  return true;
}

// Called by call-report / webhooks when a batched call's session ends
function updateBatchCallStatus(callControlId, endStatus) {
  for (const job of _batches.values()) {
    const entry = job.results.find(r => r.callControlId === callControlId);
    if (entry) {
      entry.status  = endStatus;
      entry.endedAt = new Date().toISOString();
      return;
    }
  }
}

module.exports = { startBatch, getBatch, listBatches, cancelBatch, updateBatchCallStatus };
