/**
 * Install (or remove) the AI edit worker as a login item on this Mac.
 *
 *   npm run video:worker:install -- --email you@vendodigital.co.uk
 *   npm run video:worker:install -- --uninstall
 *
 * Writes ~/.vendo-video-worker.json (who this Mac belongs to) and a launchd agent that starts
 * `npm run video:worker` at login and restarts it if it stops. Logs go to ~/video-edits/worker.log.
 */
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { homedir, userInfo } from 'os';
import { join, resolve } from 'path';

const LABEL = 'uk.co.vendodigital.video-worker';
const plistPath = join(homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
const domain = `gui/${userInfo().uid}`;

function loaded(): boolean {
  try { execFileSync('launchctl', ['print', `${domain}/${LABEL}`], { stdio: 'ignore' }); return true; } catch { return false; }
}

/** Remove the running agent and wait for macOS to finish (bootout returns before the service is gone). */
function unload() {
  try { execFileSync('launchctl', ['bootout', `${domain}/${LABEL}`], { stdio: 'ignore' }); } catch { /* not loaded */ }
  for (let i = 0; i < 20 && loaded(); i += 1) execFileSync('sleep', ['0.5']);
}

function main() {
  if (process.argv.includes('--uninstall')) {
    unload();
    if (existsSync(plistPath)) rmSync(plistPath);
    console.log('AI edit worker removed from this Mac.');
    return;
  }

  const i = process.argv.indexOf('--email');
  const email = i > -1 ? process.argv[i + 1]?.trim().toLowerCase() : undefined;
  if (!email || !/^[^@\s]+@vendodigital\.co\.uk$/.test(email)) {
    throw new Error('Give your Vendo email: npm run video:worker:install -- --email you@vendodigital.co.uk');
  }

  const repo = resolve('.');
  const logs = join(homedir(), 'video-edits');
  mkdirSync(logs, { recursive: true });
  mkdirSync(join(homedir(), 'Library', 'LaunchAgents'), { recursive: true });
  writeFileSync(join(homedir(), '.vendo-video-worker.json'), JSON.stringify({ email }, null, 2));

  // A login item doesn't load the Terminal's shell config, so the claude CLI (~/.local/bin) and Homebrew tools
  // wouldn't be found: give the agent the PATH this install was run with, plus the usual install locations.
  const path = [...new Set([...(process.env.PATH ?? '').split(':'), join(homedir(), '.local', 'bin'), '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'])]
    .filter(Boolean).join(':');
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string><string>-lc</string>
    <string>cd ${esc(JSON.stringify(repo))} &amp;&amp; exec npm run --silent video:worker</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>${esc(path)}</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>60</integer>
  <key>StandardOutPath</key><string>${esc(join(logs, 'worker.log'))}</string>
  <key>StandardErrorPath</key><string>${esc(join(logs, 'worker.log'))}</string>
</dict>
</plist>
`;
  writeFileSync(plistPath, plist);
  unload();
  for (let attempt = 1; ; attempt += 1) {
    try { execFileSync('launchctl', ['bootstrap', domain, plistPath], { stdio: 'pipe' }); break; } catch (err) {
      if (attempt >= 5) throw err;
      execFileSync('sleep', ['1']);
    }
  }
  console.log(`AI edit worker installed for ${email}. It starts at login; log: ${join(logs, 'worker.log')}`);
}

try { main(); } catch (err) { console.error((err as Error).message); process.exit(1); }
