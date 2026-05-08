import { config } from 'dotenv';
config({ path: '.env.local' });

const ACCOUNT_ID = '915ca91e-31fe-4f6a-bfb6-29e661cf1297';
const COMMENT_ID = '46eb6e09-6bb2-41f3-a9af-96d5778e2837';
const PROJECT_ID = '3ac3654b-3e52-4a9e-a55a-5575f227895b';
const WORKSPACE_ID = 'da06e9cf-79a8-4ff7-93c8-d8c66a41c870';

async function main() {
  // Dynamic import AFTER dotenv has populated process.env
  const { getValidAccessToken, getConnectionStatus } = await import('../web/lib/frameio/auth.js');
  const { getComment, getProject, getWorkspace, getMe } = await import('../web/lib/frameio/client.js');

  console.log('=== Status ===');
  console.log(await getConnectionStatus());

  console.log('\n=== /v4/me ===');
  try { console.log(await getMe()); } catch (e) { console.error('  ERR:', (e as Error).message); }

  console.log('\n=== getComment ===');
  try { console.log(await getComment(ACCOUNT_ID, COMMENT_ID)); } catch (e) { console.error('  ERR:', (e as Error).message); }

  console.log('\n=== getProject ===');
  try { console.log(await getProject(ACCOUNT_ID, PROJECT_ID)); } catch (e) { console.error('  ERR:', (e as Error).message); }

  console.log('\n=== getWorkspace ===');
  try { console.log(await getWorkspace(ACCOUNT_ID, WORKSPACE_ID)); } catch (e) { console.error('  ERR:', (e as Error).message); }
}
main().catch(e => { console.error(e); process.exit(1); });
