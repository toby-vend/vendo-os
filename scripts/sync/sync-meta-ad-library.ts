import { config } from 'dotenv';
config({ path: '.env.local' });

import { getDb, initSchema, saveDb, closeDb, log, logError } from '../utils/db.js';
import { MetaClient, type MetaAdLibraryResult } from '../utils/meta-client.js';

// Usage:
//   npx tsx scripts/sync/sync-meta-ad-library.ts --search "paid media agency"
//   npx tsx scripts/sync/sync-meta-ad-library.ts --page 123456789
//   npx tsx scripts/sync/sync-meta-ad-library.ts --search "fitness supplements" --countries US,AU
//   npx tsx scripts/sync/sync-meta-ad-library.ts --search "vendo" --status ALL --limit 200

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed: {
    searchTerms?: string;
    pageIds?: string[];
    countries: string[];
    activeStatus: 'ACTIVE' | 'INACTIVE' | 'ALL';
    limit: number;
  } = {
    countries: ['GB'],
    activeStatus: 'ACTIVE',
    limit: 500,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--search':
        parsed.searchTerms = args[++i];
        break;
      case '--page':
        parsed.pageIds = args[++i].split(',');
        break;
      case '--countries':
        parsed.countries = args[++i].split(',').map(c => c.trim().toUpperCase());
        break;
      case '--status':
        parsed.activeStatus = args[++i] as 'ACTIVE' | 'INACTIVE' | 'ALL';
        break;
      case '--limit':
        parsed.limit = parseInt(args[++i], 10);
        break;
    }
  }

  if (!parsed.searchTerms && !parsed.pageIds?.length) {
    console.error('Usage: sync-meta-ad-library.ts --search "keyword" [--page id1,id2] [--countries GB,US] [--status ACTIVE] [--limit 500]');
    process.exit(1);
  }

  return parsed;
}

function upsertAds(db: any, ads: MetaAdLibraryResult[], searchTerm: string | undefined) {
  const stmt = db.prepare(
    `INSERT INTO meta_ad_library (id, page_id, page_name, body, link_title, link_description, link_caption, ad_delivery_start, ad_delivery_stop, snapshot_url, languages, platforms, audience_lower, audience_upper, search_term, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       page_name=excluded.page_name, body=excluded.body, link_title=excluded.link_title,
       link_description=excluded.link_description, link_caption=excluded.link_caption,
       ad_delivery_start=excluded.ad_delivery_start, ad_delivery_stop=excluded.ad_delivery_stop,
       snapshot_url=excluded.snapshot_url, languages=excluded.languages, platforms=excluded.platforms,
       audience_lower=excluded.audience_lower, audience_upper=excluded.audience_upper,
       synced_at=excluded.synced_at`
  );

  const now = new Date().toISOString();

  for (const ad of ads) {
    stmt.run([
      ad.id,
      ad.page_id,
      ad.page_name,
      ad.ad_creative_bodies?.join('\n---\n') || null,
      ad.ad_creative_link_titles?.join(' | ') || null,
      ad.ad_creative_link_descriptions?.join(' | ') || null,
      ad.ad_creative_link_captions?.join(' | ') || null,
      ad.ad_delivery_start_time || null,
      ad.ad_delivery_stop_time || null,
      ad.ad_snapshot_url || null,
      ad.languages ? JSON.stringify(ad.languages) : null,
      ad.publisher_platforms ? JSON.stringify(ad.publisher_platforms) : null,
      ad.estimated_audience_size?.lower_bound ?? null,
      ad.estimated_audience_size?.upper_bound ?? null,
      searchTerm || null,
      now,
    ]);
  }

  stmt.free();
}

async function syncAdLibrary() {
  const accessToken = process.env.META_ACCESS_TOKEN;
  if (!accessToken) {
    logError('AD_LIBRARY', 'META_ACCESS_TOKEN not set in .env.local');
    process.exit(1);
  }

  const opts = parseArgs();
  await initSchema();
  const db = await getDb();
  const client = new MetaClient(accessToken);

  const label = opts.searchTerms
    ? `"${opts.searchTerms}"`
    : `page IDs: ${opts.pageIds!.join(', ')}`;

  try {
    log('AD_LIBRARY', `Searching ${label} in ${opts.countries.join(', ')} (${opts.activeStatus}, limit ${opts.limit})`);

    const ads = await client.searchAdLibrary({
      searchTerms: opts.searchTerms,
      searchPageIds: opts.pageIds,
      countries: opts.countries,
      activeStatus: opts.activeStatus,
      limit: opts.limit,
    });

    if (ads.length === 0) {
      log('AD_LIBRARY', 'No ads found');
      closeDb();
      return;
    }

    // Show a summary of top advertisers
    const pageCounts = new Map<string, number>();
    for (const ad of ads) {
      pageCounts.set(ad.page_name, (pageCounts.get(ad.page_name) || 0) + 1);
    }
    const topPages = [...pageCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    log('AD_LIBRARY', `Found ${ads.length} ads from ${pageCounts.size} pages`);
    for (const [name, count] of topPages) {
      log('AD_LIBRARY', `  ${name}: ${count} ads`);
    }

    upsertAds(db, ads, opts.searchTerms);
    saveDb();

    log('AD_LIBRARY', `Stored ${ads.length} ads in meta_ad_library`);
  } catch (err) {
    logError('AD_LIBRARY', 'Search failed', err);
    process.exit(1);
  } finally {
    closeDb();
  }
}

syncAdLibrary();
