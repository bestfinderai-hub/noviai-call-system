#!/usr/bin/env node
// Push repo to GitHub via REST API — bypasses broken git HTTPS transport.
// Usage: node scripts/push-to-github.js

'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const OWNER = 'bestfinderai-hub';
const REPO  = 'noviai-call-system';
const BRANCH = 'main';

const TOKEN = execSync('gh auth token', { encoding: 'utf-8' }).trim();
if (!TOKEN) { console.error('No gh token'); process.exit(1); }

const BASE = `https://api.github.com/repos/${OWNER}/${REPO}`;
const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'Content-Type': 'application/json',
  'User-Agent': 'noviai-push-script',
};

const IGNORE = new Set([
  'node_modules', '.git', 'recordings', 'test-output',
  '.env', '*.log', '*.mulaw', '*.wav', '.fly',
]);

function shouldIgnore(relPath) {
  const parts = relPath.split('/');
  for (const part of parts) {
    if (IGNORE.has(part)) return true;
    if (part.endsWith('.log') || part.endsWith('.mulaw') || part.endsWith('.wav')) return true;
  }
  return false;
}

function getAllFiles(dir, base = '') {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (shouldIgnore(rel)) continue;
    if (entry.isDirectory()) {
      files.push(...getAllFiles(path.join(dir, entry.name), rel));
    } else {
      files.push({ path: rel, full: path.join(dir, entry.name) });
    }
  }
  return files;
}

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

async function main() {
  const ROOT = path.join(__dirname, '..');
  const files = getAllFiles(ROOT);
  console.log(`Found ${files.length} files to push`);

  // 1. Get current HEAD commit (repo was just created, may be empty)
  let baseTree = null;
  let parentSha = null;

  try {
    const ref = await api('GET', `${BASE}/git/ref/heads/${BRANCH}`);
    parentSha = ref.object.sha;
    const commit = await api('GET', `${BASE}/git/commits/${parentSha}`);
    baseTree = commit.tree.sha;
    console.log(`Base commit: ${parentSha.slice(0, 8)}`);
  } catch {
    console.log('Empty repo — creating initial commit');
  }

  // 2. Initialize empty repo via Contents API (works when git data API returns 409)
  if (!parentSha) {
    const initRes = await fetch(`${BASE}/contents/README.md`, {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify({
        message: 'init',
        content: Buffer.from('# NoviAi Call System\n').toString('base64'),
        author: { name: 'BestFinder', email: 'bestfinderai@gmail.com' },
      }),
    });
    if (!initRes.ok) {
      const t = await initRes.text();
      throw new Error(`Init failed: ${t.slice(0, 200)}`);
    }
    // Now get the commit that was just created
    const ref = await api('GET', `${BASE}/git/ref/heads/${BRANCH}`);
    parentSha = ref.object.sha;
    const commit = await api('GET', `${BASE}/git/commits/${parentSha}`);
    baseTree = commit.tree.sha;
    console.log(`Initialized repo: ${parentSha.slice(0, 8)}`);
  }

  // 3. Create blobs for all files
  console.log('Creating blobs...');
  const treeItems = [];
  for (const file of files) {
    const content = fs.readFileSync(file.full);
    const isText = !file.full.match(/\.(png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot|bin|exe)$/i);
    const blob = await api('POST', `${BASE}/git/blobs`, {
      content: isText ? content.toString('utf-8') : content.toString('base64'),
      encoding: isText ? 'utf-8' : 'base64',
    });
    treeItems.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
    process.stdout.write('.');
  }
  console.log(`\nCreated ${treeItems.length} blobs`);

  // 3. Create tree
  const treeBody = { tree: treeItems };
  if (baseTree) treeBody.base_tree = baseTree;
  const tree = await api('POST', `${BASE}/git/trees`, treeBody);
  console.log(`Tree: ${tree.sha.slice(0, 8)}`);

  // 4. Create commit
  const commitBody = {
    message: 'feat: NoviAi Call System — full production codebase',
    tree: tree.sha,
    author: { name: 'BestFinder', email: 'bestfinderai@gmail.com', date: new Date().toISOString() },
  };
  if (parentSha) commitBody.parents = [parentSha];
  const commit = await api('POST', `${BASE}/git/commits`, commitBody);
  console.log(`Commit: ${commit.sha.slice(0, 8)}`);

  // 5. Update or create branch ref
  try {
    await api('PATCH', `${BASE}/git/refs/heads/${BRANCH}`, { sha: commit.sha, force: true });
  } catch {
    await api('POST', `${BASE}/git/refs`, { ref: `refs/heads/${BRANCH}`, sha: commit.sha });
  }

  console.log(`\n✅ Pushed to https://github.com/${OWNER}/${REPO}`);
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
