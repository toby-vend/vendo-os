import { config } from 'dotenv';
config({ path: '.env.local' });

import { getUserByEmail, updateUserPassword } from '../web/lib/queries.js';
import { hashPassword } from '../web/lib/auth.js';

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  if (!email || !password) { console.error('Usage: npx tsx scripts/reset-password.ts <email> <password>'); process.exit(1); }

  const user = await getUserByEmail(email);
  if (!user) { console.error('User not found:', email); process.exit(1); }

  await updateUserPassword(user.id, hashPassword(password), true);
  console.log(`Password reset for ${user.name} (${email})`);
}

main();
