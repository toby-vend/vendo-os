import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const webpush = require('web-push');

const keys = webpush.generateVAPIDKeys();

console.log('');
console.log('VAPID keys generated. Add these to your Vercel environment variables:');
console.log('');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('');
console.log('Instructions:');
console.log('  1. Copy the two lines above.');
console.log('  2. In Vercel → Project Settings → Environment Variables, add each as a new variable.');
console.log('  3. Set them on Production, Preview, and Development environments.');
console.log('  4. Redeploy for changes to take effect.');
console.log('');
