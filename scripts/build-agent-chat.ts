/**
 * Bundle the React /chat island.
 *
 * Source: web/client/agent-chat/main.tsx
 * Output: public/assets/agent-chat.js
 *
 * Usage:
 *   npm run build:chat
 *   npm run build:chat -- --watch     (rebuilds on save during dev)
 *
 * Wired into the npm `build` script so Vercel deployments produce a fresh
 * bundle on every push. The bundle is IIFE-wrapped so it can be loaded
 * with a plain <script src=...> on the Eta page; no module loading or
 * external runtime needed at the page level.
 */
import * as esbuild from 'esbuild';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

const isWatch = process.argv.includes('--watch');
const isDev = process.env.NODE_ENV !== 'production';

const config: esbuild.BuildOptions = {
  entryPoints: [
    resolve(PROJECT_ROOT, 'web/client/agent-chat/main.tsx'),
  ],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2022'],
  outfile: resolve(PROJECT_ROOT, 'public/assets/agent-chat.js'),
  minify: !isDev,
  sourcemap: isDev ? 'inline' : false,
  loader: {
    '.ts': 'ts',
    '.tsx': 'tsx',
  },
  jsx: 'automatic',
  jsxImportSource: 'react',
  define: {
    'process.env.NODE_ENV': JSON.stringify(isDev ? 'development' : 'production'),
  },
  tsconfig: resolve(PROJECT_ROOT, 'tsconfig.json'),
  logLevel: 'info',
};

async function main(): Promise<void> {
  if (isWatch) {
    const ctx = await esbuild.context(config);
    await ctx.watch();
    console.log('[build-agent-chat] watching for changes...');
  } else {
    const result = await esbuild.build(config);
    if (result.errors.length > 0) {
      console.error('[build-agent-chat] errors:', result.errors);
      process.exit(1);
    }
    console.log('[build-agent-chat] bundled →', config.outfile);
  }
}

main().catch(err => {
  console.error('[build-agent-chat] failed:', err);
  process.exit(1);
});
