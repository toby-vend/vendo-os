/**
 * Frame.io folder audit (Phase 0 of plans/2026-10-03-frameio-ai-video-edits.md).
 *
 * Usage:
 *   npm run audit:frameio                        # every project
 *   npm run audit:frameio -- --project "Thornbury"   # projects whose name contains this
 *   npm run audit:frameio -- --cached            # re-check the last saved tree (no API calls)
 *
 * Read-only live walk of Frame.io (workspaces → projects → folders, including
 * version stacks), checked against the Video Editor Asset Naming, Filing &
 * Version Control SOP. Nothing in Frame.io is renamed, moved or deleted.
 * Writes outputs/frameio-audit/<date>.md and .json.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const ACCOUNT_ID = '915ca91e-31fe-4f6a-bfb6-29e661cf1297';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retry on Frame.io 429s with a growing pause (20s, 40s, 60s…). */
async function withBackoff<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  for (let i = 1; ; i += 1) {
    try {
      return await fn();
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status !== 429 || i >= attempts) throw err;
      console.log(`[audit] rate limited, waiting ${20 * i}s…`);
      await sleep(20_000 * i);
    }
  }
}

async function main() {
  const { listWorkspaces, listProjectsInWorkspace, listFolderChildren } = await import('../web/lib/frameio/client.js');
  const { auditProject } = await import('../web/lib/frameio/folder-audit.js');
  type AuditNode = import('../web/lib/frameio/folder-audit.js').AuditNode;

  const argIdx = process.argv.indexOf('--project');
  const filter = argIdx > -1 ? process.argv[argIdx + 1]?.toLowerCase() : null;

  const outDir = resolve('outputs/frameio-audit');
  mkdirSync(outDir, { recursive: true });
  const treeFile = resolve(outDir, 'tree-latest.json');
  type ProjectTree = { project: string; workspace: string; url: string; nodes: AuditNode[] };

  let trees: ProjectTree[] = [];
  if (process.argv.includes('--cached')) {
    trees = JSON.parse(readFileSync(treeFile, 'utf8')) as ProjectTree[];
    console.log(`[audit] using cached tree (${trees.length} projects)`);
  } else {
  const workspaces = await withBackoff(() => listWorkspaces(ACCOUNT_ID));
  for (const ws of workspaces) {
    const projects = await withBackoff(() => listProjectsInWorkspace(ACCOUNT_ID, ws.id));
    for (const p of projects) {
      if (filter && !p.name.toLowerCase().includes(filter)) continue;
      const nodes: AuditNode[] = [
        { id: p.id, parent_id: null, type: 'project', name: p.name, view_url: p.view_url },
        { id: p.root_folder_id, parent_id: null, type: 'folder', name: 'root', view_url: p.view_url },
      ];
      const queue: Array<{ id: string; depth: number }> = [{ id: p.root_folder_id, depth: 0 }];
      while (queue.length) {
        const { id, depth } = queue.shift()!;
        if (depth > 10) continue;
        const children = await withBackoff(() => listFolderChildren(ACCOUNT_ID, id));
        await sleep(350); // gentle on the rate limit
        for (const c of children) {
          nodes.push({ id: c.id, parent_id: c.parent_id ?? id, type: c.type, name: c.name, view_url: c.view_url ?? null });
          if (c.type === 'folder') queue.push({ id: c.id, depth: depth + 1 });
        }
      }
      trees.push({ project: p.name, workspace: ws.name, url: p.view_url, nodes });
      console.log(`[audit] read ${ws.name} / ${p.name}: ${nodes.length - 2} items`);
    }
  }
  if (!filter) writeFileSync(treeFile, JSON.stringify(trees));
  }

  const results = trees
    .filter((t) => !filter || t.project.toLowerCase().includes(filter))
    .map((t) => ({ project: t.project, workspace: t.workspace, url: t.url, items: t.nodes.length - 2, issues: auditProject(t.nodes) }));
  for (const r of results) {
    const e = r.issues.filter((i) => i.severity === 'error').length;
    console.log(`[audit] ${r.project}: ${e} errors, ${r.issues.length - e} warnings`);
  }

  const date = new Date().toISOString().slice(0, 10);
  writeFileSync(resolve(outDir, `${date}.json`), JSON.stringify(results, null, 2));

  const esc = (s: string) => s.replace(/\|/g, '\\|');
  const lines: string[] = [
    `# Frame.io folder audit — ${date}`,
    '',
    'Checked against *SOP: Video Editor Asset Naming, Filing & Version Control* v1.2. Report only: nothing in Frame.io was changed.',
    '',
    '| Project | Workspace | Items | Errors | Warnings |',
    '|---|---|---|---|---|',
    ...results
      .sort((a, b) => b.issues.length - a.issues.length)
      .map((r) => {
        const e = r.issues.filter((i) => i.severity === 'error').length;
        return `| [${esc(r.project)}](${r.url}) | ${esc(r.workspace)} | ${r.items} | ${e} | ${r.issues.length - e} |`;
      }),
    '',
  ];
  for (const r of results) {
    if (!r.issues.length) continue;
    lines.push(`## ${r.project}`, '');
    for (const i of r.issues) {
      const link = i.viewUrl ? ` ([open](${i.viewUrl}))` : '';
      lines.push(`- **${i.severity === 'error' ? 'Error' : 'Warning'} · ${i.rule}** — \`${i.path || i.name}\`${link}`);
      lines.push(`  - ${i.message}`);
      if (i.suggestion) lines.push(`  - Suggested: \`${i.suggestion}\``);
    }
    lines.push('');
  }
  writeFileSync(resolve(outDir, `${date}.md`), lines.join('\n'));
  console.log(`[audit] wrote outputs/frameio-audit/${date}.md`);
}

main().catch((err) => {
  console.error('[audit] failed:', err);
  process.exit(1);
});
