#!/usr/bin/env node
/**
 * One-off migration: add .js / /index.js extensions to relative imports in
 * the agent runtime + slack inbound files. Vercel deploys these as
 * Node ESM functions, which rejects extensionless imports at runtime.
 *
 * Usage:
 *   node scripts/migrations/add-js-extensions.mjs
 *
 * Idempotent — already-suffixed imports are left alone.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOTS = [
  'api/agent',
  'api/slack',
  'web/lib/agents',
];

const SKIP_SUFFIXES = ['.js', '.cjs', '.mjs', '.json', '.ts', '.tsx'];

async function walk(dir, out = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, out);
    else if (e.isFile() && (full.endsWith('.ts') || full.endsWith('.tsx'))) out.push(full);
  }
  return out;
}

async function exists(p) {
  try { await fs.stat(p); return true; } catch { return false; }
}

async function isDir(p) {
  try { const s = await fs.stat(p); return s.isDirectory(); } catch { return false; }
}

async function resolveExtension(fileDir, importPath) {
  // Already has a known suffix → leave alone.
  if (SKIP_SUFFIXES.some(s => importPath.endsWith(s))) return null;
  const target = path.resolve(fileDir, importPath);
  // Direct file: <target>.ts / .tsx
  if (await exists(target + '.ts')) return importPath + '.js';
  if (await exists(target + '.tsx')) return importPath + '.js';
  // Directory with index: <target>/index.ts
  if (await isDir(target)) {
    if (await exists(path.join(target, 'index.ts'))) return importPath + '/index.js';
  }
  return null; // couldn't resolve — leave alone, log
}

const IMPORT_RE = /(\bfrom\s+|\bimport\s*\(\s*)(['"])(\.\.?\/[^'"]+)(['"])/g;

async function rewriteFile(file) {
  const src = await fs.readFile(file, 'utf8');
  const fileDir = path.dirname(file);
  let changed = false;
  const seenUnresolved = [];

  // collect rewrites first (resolveExtension is async)
  const matches = [];
  for (const m of src.matchAll(IMPORT_RE)) {
    matches.push({ index: m.index, full: m[0], pre: m[1], q1: m[2], spec: m[3], q2: m[4] });
  }
  let next = '';
  let cursor = 0;
  for (const m of matches) {
    next += src.slice(cursor, m.index);
    const replacement = await resolveExtension(fileDir, m.spec);
    if (replacement) {
      next += `${m.pre}${m.q1}${replacement}${m.q2}`;
      changed = true;
    } else {
      next += m.full;
      if (!SKIP_SUFFIXES.some(s => m.spec.endsWith(s))) {
        seenUnresolved.push(m.spec);
      }
    }
    cursor = m.index + m.full.length;
  }
  next += src.slice(cursor);

  if (changed) {
    await fs.writeFile(file, next);
    console.log(`  ✓ ${file}`);
  }
  if (seenUnresolved.length) {
    console.log(`  ⚠ ${file} — unresolved: ${seenUnresolved.join(', ')}`);
  }
  return changed;
}

async function main() {
  let total = 0;
  let touched = 0;
  for (const root of ROOTS) {
    if (!(await exists(root))) continue;
    const files = await walk(root);
    total += files.length;
    for (const f of files) {
      if (await rewriteFile(f)) touched++;
    }
  }
  console.log(`\nTotal scanned: ${total}, touched: ${touched}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
