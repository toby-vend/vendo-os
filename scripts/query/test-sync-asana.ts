import { config } from 'dotenv';
config({ path: '.env.local' });
import { syncAsana } from '../../web/lib/jobs/sync-asana.js';

const result = await syncAsana();
console.log('Result:', result);
