/**
 * Seed the first admin user + channels + default permissions.
 *
 * Usage:
 *   npx tsx scripts/utils/seed-admin.ts --email admin@vendo.digital --name "Toby Raeburn" --password changeme123
 *
 * This runs against Turso if TURSO_DATABASE_URL is set, otherwise local SQLite.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import {
  initAuthSchema,
  createUser,
  getChannels,
  setUserChannels,
  setAllPermissions,
  getUserByEmail,
  db as client,
} from '../../web/lib/queries.js';
import { hashPassword, generateId } from '../../web/lib/auth.js';

const CHANNELS = [
  { slug: 'paid-social-creative', name: 'Paid Social & Creative' },
  { slug: 'paid-search', name: 'Paid Search' },
  { slug: 'seo-pr-web', name: 'SEO/PR & Web' },
  { slug: 'web-design-dev', name: 'Web Design & Development' },
];

const ALL_ROUTES = ['dashboard', 'meetings', 'action-items', 'clients', 'pipeline', 'ads', 'briefs', 'drive', 'sync-status'];

function parseArgs(): { email: string; name: string; password: string } {
  const args = process.argv.slice(2);
  const get = (flag: string): string => {
    const idx = args.indexOf(flag);
    if (idx === -1 || idx + 1 >= args.length) {
      console.error(`Missing required flag: ${flag}`);
      console.error('Usage: npx tsx scripts/utils/seed-admin.ts --email <email> --name <name> --password <password>');
      process.exit(1);
    }
    return args[idx + 1];
  };
  return { email: get('--email'), name: get('--name'), password: get('--password') };
}

async function main() {
  const { email, name, password } = parseArgs();

  console.log('Initialising auth schema...');
  await initAuthSchema();

  // Seed channels
  console.log('Seeding channels...');
  for (const ch of CHANNELS) {
    const id = generateId();
    try {
      await client.execute({
        sql: 'INSERT INTO channels (id, slug, name) VALUES (?, ?, ?)',
        args: [id, ch.slug, ch.name],
      });
      console.log(`  Created channel: ${ch.name}`);
    } catch {
      console.log(`  Channel already exists: ${ch.name}`);
    }
  }

  // Seed default permissions (all channels get all routes)
  console.log('Seeding default permissions...');
  const channels = await getChannels();
  const permissions: { channelId: string; routeSlug: string }[] = [];
  for (const ch of channels) {
    for (const route of ALL_ROUTES) {
      permissions.push({ channelId: ch.id, routeSlug: route });
    }
  }
  await setAllPermissions(permissions);
  console.log(`  Set ${permissions.length} permission entries`);

  // Create admin user
  const existing = await getUserByEmail(email);
  if (existing) {
    console.log(`Admin user already exists: ${email}`);
  } else {
    const userId = generateId();
    await createUser({
      id: userId,
      email,
      name,
      passwordHash: hashPassword(password),
      role: 'admin',
    });
    // Admins don't need channel assignments (they bypass permissions)
    // but assign all channels anyway for completeness
    await setUserChannels(userId, channels.map(c => c.id));
    console.log(`Created admin user: ${name} <${email}>`);
  }

  console.log('Done.');
}

main().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
