/**
 * Frame.io media I/O — manual test harness for the AI video-edit pipeline (Phase 1).
 *
 * Read-only:
 *   npm run frameio:io -- inspect  <asset url|id>
 *   npm run frameio:io -- download <asset url|id> <out path>
 *   npm run frameio:io -- comments <asset url|id>
 *
 * Writes to Frame.io (refuse to run without --yes):
 *   npm run frameio:io -- upload   <local file> <folder url|id> "<name>" [--stack-on <asset url|id>] --yes
 *   npm run frameio:io -- comment  <asset url|id> "<text>" [--at <seconds> --fps <fps>] --yes
 *   npm run frameio:io -- complete <comment id> --yes
 *   npm run frameio:io -- stack    <existing asset url|id> <new file url|id> --yes
 *   npm run frameio:io -- mkdir    <parent folder url|id> "<name>" --yes
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

async function main() {
  const io = await import('../web/lib/frameio/media-io.js');
  const [cmd, ...rest] = process.argv.slice(2);
  const flag = (name: string) => {
    const i = rest.indexOf(name);
    return i > -1 ? rest[i + 1] : undefined;
  };
  const positional = rest.filter((a, i) => !a.startsWith('--') && !(i > 0 && rest[i - 1].startsWith('--') && rest[i - 1] !== '--yes'));
  const writes = ['upload', 'comment', 'complete', 'mkdir', 'stack'];
  if (writes.includes(cmd) && !rest.includes('--yes')) {
    throw new Error(`"${cmd}" writes to Frame.io. Re-run with --yes once you're sure of the target.`);
  }

  switch (cmd) {
    case 'inspect': {
      const asset = await io.getAsset(io.idFrom(positional[0]));
      const fileId = io.playableFileId(asset);
      const comments = await io.listComments(fileId);
      console.log(JSON.stringify({
        id: asset.id, type: asset.type, name: asset.name, parent_id: asset.parent_id, project_id: asset.project_id,
        head_version: asset.head_version ? { id: asset.head_version.id, name: asset.head_version.name } : undefined,
        file_size: asset.file_size ?? asset.head_version?.file_size, status: asset.status ?? asset.head_version?.status,
        comments: comments.length, view_url: asset.view_url,
      }, null, 2));
      break;
    }
    case 'download': {
      const asset = await io.getAsset(io.idFrom(positional[0]));
      const r = await io.downloadOriginal(io.playableFileId(asset), positional[1]);
      console.log(`downloaded "${r.name}" → ${positional[1]} (${(r.bytes / 1e6).toFixed(1)} MB)`);
      break;
    }
    case 'comments': {
      const asset = await io.getAsset(io.idFrom(positional[0]));
      for (const c of await io.listComments(io.playableFileId(asset))) {
        console.log(`${c.completed_at ? '✓' : '·'} [${c.timestamp ?? '—'}] ${c.text.replace(/\s+/g, ' ')}  (${c.id})`);
      }
      break;
    }
    case 'upload': {
      const [local, folder, name] = positional;
      const file = await io.uploadLocalFile(local, io.idFrom(folder), name);
      console.log(`uploaded "${file.name}" (${file.id}) ${file.view_url}`);
      const stackOn = flag('--stack-on');
      if (stackOn) {
        const stack = await io.stackNewVersion(io.idFrom(stackOn), file.id);
        console.log(`stacked onto "${stack.name}" (${stack.id}) ${stack.view_url}`);
      }
      break;
    }
    case 'comment': {
      const asset = await io.getAsset(io.idFrom(positional[0]));
      const at = flag('--at');
      const fps = Number(flag('--fps') ?? 25);
      const c = await io.createComment(io.playableFileId(asset), positional[1], at ? Number(at) * fps : undefined);
      console.log(`commented (${c?.id})`);
      break;
    }
    case 'complete': {
      await io.setCommentCompleted(positional[0]);
      console.log('marked complete');
      break;
    }
    case 'stack': {
      const stack = await io.stackNewVersion(io.idFrom(positional[0]), io.idFrom(positional[1]));
      console.log(`stacked onto "${stack.name}" (${stack.id}) ${stack.view_url}`);
      break;
    }
    case 'mkdir': {
      const folder = await io.createFolder(io.idFrom(positional[0]), positional[1]);
      console.log(`created folder "${folder.name}" (${folder.id}) ${folder.view_url}`);
      break;
    }
    default:
      throw new Error('Usage: inspect | download | comments | upload | comment | complete | mkdir | stack (see the header of scripts/frameio-io.ts)');
  }
}

main().catch((err) => {
  console.error('[frameio-io]', (err as Error).message);
  process.exit(1);
});
