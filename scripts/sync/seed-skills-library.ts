/**
 * Seed the skills_library table from .claude/commands/skills/*.md files.
 * Run locally to push skill content into the database (local + Turso).
 *
 * Usage:
 *   npx tsx scripts/sync/seed-skills-library.ts
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createClient } from '@libsql/client';
import { readdir, readFile } from 'fs/promises';
import { resolve } from 'path';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL || `file:${resolve('data/vendo.db')}`,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const SKILLS_DIR = resolve('.claude/commands/skills');

interface SkillData {
  slug: string;
  title: string;
  description: string;
  inputs: string;
  content: string;
}

function parseSkill(file: string, raw: string): SkillData {
  const slug = file.replace(/\.md$/, '');

  const titleMatch = raw.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : slug;

  const lines = raw.split('\n');
  let description = '';
  let foundHeading = false;
  for (const line of lines) {
    if (!foundHeading && line.startsWith('# ')) { foundHeading = true; continue; }
    if (foundHeading && line.trim() === '') continue;
    if (foundHeading && line.trim() && !line.startsWith('#') && !line.startsWith('-') && !line.startsWith('*')) {
      description = line.trim();
      break;
    }
    if (foundHeading && (line.startsWith('#') || line.startsWith('-'))) break;
  }

  const inputs: string[] = [];
  const inputSection = raw.match(/## Inputs[^\n]*\n([\s\S]*?)(?=\n##|\n$)/i);
  if (inputSection) {
    for (const il of inputSection[1].split('\n')) {
      const m = il.match(/^-\s+\*\*(.+?)\*\*/);
      if (m) inputs.push(m[1]);
    }
  }

  return { slug, title, description, inputs: JSON.stringify(inputs), content: raw };
}

async function main() {
  // Create table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS skills_library (
      slug TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      inputs TEXT NOT NULL DEFAULT '[]',
      content TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const files = (await readdir(SKILLS_DIR)).filter(f => f.endsWith('.md')).sort();
  console.log(`Found ${files.length} skill files`);

  for (const file of files) {
    const raw = await readFile(resolve(SKILLS_DIR, file), 'utf-8');
    const skill = parseSkill(file, raw);

    await client.execute({
      sql: `INSERT OR REPLACE INTO skills_library (slug, title, description, inputs, content, updated_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      args: [skill.slug, skill.title, skill.description, skill.inputs, skill.content],
    });

    console.log(`  Seeded: ${skill.title} (${skill.slug})`);
  }

  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
