/**
 * Discover GHL sub-accounts (locations) under the agency account.
 *
 * Usage:
 *   npm run ghl:discover
 *
 * Requires GHL_API_KEY and GHL_COMPANY_ID in .env.local.
 * GHL_COMPANY_ID is the agency-level company ID that owns all sub-accounts.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';

const BASE_URL = 'https://services.leadconnectorhq.com';
const API_KEY = process.env.GHL_API_KEY!;
const COMPANY_ID = process.env.GHL_COMPANY_ID!;

if (!API_KEY) {
  console.error('GHL_API_KEY must be set in .env.local');
  process.exit(1);
}

if (!COMPANY_ID) {
  console.error('GHL_COMPANY_ID must be set in .env.local (your agency/company ID)');
  process.exit(1);
}

const headers: Record<string, string> = {
  'Authorization': `Bearer ${API_KEY}`,
  'Version': '2021-07-28',
  'Content-Type': 'application/json',
};

interface GhlLocation {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
}

interface LocationSearchResponse {
  locations: GhlLocation[];
  count: number;
}

async function fetchAllLocations(): Promise<GhlLocation[]> {
  const all: GhlLocation[] = [];
  let skip = 0;
  const limit = 100;

  while (true) {
    const url = `${BASE_URL}/locations/search?companyId=${COMPANY_ID}&limit=${limit}&skip=${skip}`;
    const resp = await fetch(url, { headers });

    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      throw new Error(`GHL ${resp.status}: ${body.slice(0, 300)}`);
    }

    const data = (await resp.json()) as LocationSearchResponse;
    all.push(...data.locations);
    log('GHL', `Fetched ${all.length}/${data.count} locations`);

    if (all.length >= data.count || data.locations.length === 0) break;
    skip += limit;
  }

  return all;
}

function formatAddress(loc: GhlLocation): string {
  return [loc.address, loc.city, loc.state, loc.postalCode, loc.country]
    .filter(Boolean)
    .join(', ');
}

async function main() {
  await initSchema();
  const db = await getDb();
  const now = new Date().toISOString();

  try {
    log('GHL', 'Discovering locations under agency account...');
    const locations = await fetchAllLocations();

    if (locations.length === 0) {
      log('GHL', 'No locations found.');
      return;
    }

    // Create the ghl_locations table
    db.run(`
      CREATE TABLE IF NOT EXISTS ghl_locations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        address TEXT,
        synced_at TEXT NOT NULL
      )
    `);

    // Upsert each location
    for (const loc of locations) {
      db.run(
        'INSERT OR REPLACE INTO ghl_locations (id, name, email, phone, address, synced_at) VALUES (?, ?, ?, ?, ?, ?)',
        [loc.id, loc.name, loc.email || null, loc.phone || null, formatAddress(loc), now],
      );
    }

    saveDb();

    // Print table
    console.log('');
    console.log('='.repeat(120));
    console.log(
      'Location ID'.padEnd(30) +
      'Name'.padEnd(35) +
      'Email'.padEnd(30) +
      'Phone'.padEnd(20),
    );
    console.log('-'.repeat(120));

    for (const loc of locations) {
      console.log(
        loc.id.padEnd(30) +
        (loc.name || '').slice(0, 33).padEnd(35) +
        (loc.email || '—').slice(0, 28).padEnd(30) +
        (loc.phone || '—').padEnd(20),
      );
    }

    console.log('='.repeat(120));
    log('GHL', `Done. ${locations.length} locations saved to ghl_locations table.`);
  } catch (err) {
    logError('GHL', 'Location discovery failed', err);
    process.exit(1);
  } finally {
    closeDb();
  }
}

main();
