/**
 * Builds all lookup maps needed by the waterfall matcher.
 * Called once per batch run and reused across all meetings.
 */

import type { Database } from 'sql.js';
import type { MatchContext } from './types.js';
import { TEAM_MEMBERS, VENDO_TEAM_DOMAINS } from './team.js';

/** Normalise a name for comparison: lowercase, strip common suffixes, punctuation */
export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(ltd|limited|llp|plc|inc|uk|t\/a)\b/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function addNameVariants(lookup: Map<string, string>, name: string, canonical: string): void {
  const norm = normaliseName(name);
  if (norm) lookup.set(norm, canonical);

  const words = norm.split(' ').filter(w => w.length > 2);
  if (words.length >= 2) {
    lookup.set(words.slice(0, 2).join(' '), canonical);
    if (words.length >= 3) {
      lookup.set(words.slice(0, 3).join(' '), canonical);
    }
  }
}

export function buildMatchContext(db: Database): MatchContext {
  const emailDomainLookup = buildEmailDomainLookup(db);
  const clientNameLookup = buildClientNameLookup(db);
  const contactNameLookup = buildContactNameLookup(db);
  const teamNames = buildTeamNames();
  const allClientNames = buildAllClientNames(db);

  return {
    emailDomainLookup,
    clientNameLookup,
    contactNameLookup,
    teamEmails: VENDO_TEAM_DOMAINS,
    teamNames,
    allClientNames,
  };
}

function buildEmailDomainLookup(db: Database): Map<string, string> {
  const lookup = new Map<string, string>();

  // From contact_email_domains table (seeded + learned)
  const ced = db.exec('SELECT domain, client_name FROM contact_email_domains');
  if (ced.length) {
    for (const row of ced[0].values) {
      lookup.set(row[0] as string, row[1] as string);
    }
  }

  // From xero_contacts (live enrichment)
  const xero = db.exec(`
    SELECT xc.email, c.name
    FROM xero_contacts xc
    JOIN clients c ON c.xero_contact_id = xc.id
    WHERE xc.email IS NOT NULL AND xc.email != ''
  `);
  if (xero.length) {
    for (const row of xero[0].values) {
      const email = row[0] as string;
      const domain = email.split('@')[1]?.toLowerCase();
      if (domain && !VENDO_TEAM_DOMAINS.has(domain)) {
        lookup.set(domain, row[1] as string);
      }
    }
  }

  // From GHL opportunities
  const ghl = db.exec(`
    SELECT contact_email, COALESCE(contact_company, contact_name) as company
    FROM ghl_opportunities
    WHERE contact_email IS NOT NULL AND contact_email != ''
      AND COALESCE(contact_company, contact_name) IS NOT NULL
  `);
  if (ghl.length) {
    for (const row of ghl[0].values) {
      const email = row[0] as string;
      const domain = email.split('@')[1]?.toLowerCase();
      if (domain && !VENDO_TEAM_DOMAINS.has(domain)) {
        // Only set if not already mapped (Xero takes priority)
        if (!lookup.has(domain)) {
          lookup.set(domain, row[1] as string);
        }
      }
    }
  }

  return lookup;
}

function buildClientNameLookup(db: Database): Map<string, string> {
  const lookup = new Map<string, string>();

  // Xero-sourced clients
  const result = db.exec("SELECT name, aliases FROM clients WHERE source = 'xero'");
  if (result.length) {
    for (const row of result[0].values) {
      const name = row[0] as string;
      const aliases = row[1] as string | null;

      addNameVariants(lookup, name, name);

      if (aliases) {
        try {
          const aliasList = JSON.parse(aliases) as string[];
          for (const alias of aliasList) {
            addNameVariants(lookup, alias, name);
          }
        } catch {
          addNameVariants(lookup, aliases, name);
        }
      }
    }
  }

  // GHL companies as fallback (for prospects not yet in Xero)
  const ghl = db.exec(`
    SELECT DISTINCT contact_company FROM ghl_opportunities
    WHERE contact_company IS NOT NULL AND contact_company != ''
  `);
  if (ghl.length) {
    for (const row of ghl[0].values) {
      const company = row[0] as string;
      const norm = normaliseName(company);
      if (norm && !lookup.has(norm)) {
        lookup.set(norm, company);
      }
    }
  }

  return lookup;
}

function buildContactNameLookup(db: Database): Map<string, string> {
  const lookup = new Map<string, string>();

  // Xero contacts → client name
  const xero = db.exec(`
    SELECT xc.name, c.name as client_name
    FROM xero_contacts xc
    JOIN clients c ON c.xero_contact_id = xc.id
    WHERE xc.name IS NOT NULL
  `);
  if (xero.length) {
    for (const row of xero[0].values) {
      const contactName = normaliseName(row[0] as string);
      if (contactName) lookup.set(contactName, row[1] as string);
    }
  }

  // GHL contacts → company
  const ghl = db.exec(`
    SELECT contact_name, COALESCE(contact_company, contact_name) as company
    FROM ghl_opportunities
    WHERE contact_name IS NOT NULL AND contact_name != ''
  `);
  if (ghl.length) {
    for (const row of ghl[0].values) {
      const contactName = normaliseName(row[0] as string);
      if (contactName && !lookup.has(contactName)) {
        lookup.set(contactName, row[1] as string);
      }
    }
  }

  return lookup;
}

function buildTeamNames(): Set<string> {
  const names = new Set<string>();
  for (const [canonical, aliases] of Object.entries(TEAM_MEMBERS)) {
    names.add(canonical.toLowerCase());
    for (const alias of aliases) {
      names.add(alias.toLowerCase());
    }
  }
  return names;
}

function buildAllClientNames(db: Database): string[] {
  const names: string[] = [];
  const result = db.exec(`
    SELECT name FROM clients
    WHERE source = 'xero'
    ORDER BY meeting_count DESC
    LIMIT 100
  `);
  if (result.length) {
    for (const row of result[0].values) {
      names.push(row[0] as string);
    }
  }
  return names;
}
