/**
 * Shared team constants and normalisation — single source of truth for
 * identifying Vendo Digital team members across matching strategies.
 */

export const TEAM_MEMBERS: Record<string, string[]> = {
  'Max Rivens': ['Max Rivens', 'Max'],
  'Toby Raeburn': ['Toby Raeburn', 'Toby R'],
  'Alfie Wakelin': ['Alfie Wakelin', 'Alfie'],
  'Sam Franks': ['Sam Franks', 'Sam'],
  'Ben Dyer': ['Ben Dyer', 'Ben D'],
  'Jake Dennis': ['Jake Dennis', 'Jake'],
  'Helen Walker': ['Helen Walker', 'Helen'],
  'Chris Tomkins': ['Chris Tomkins', 'Chris'],
  'Shaun Silverside': ['Shaun Silverside', 'Shaun'],
  'Amya Casallas': ['Amya Casallas', 'Amya', 'Amya Casillas'],
  'Benjamin Momo': ['Benjamin Momo', 'Benjamin', 'Momo', 'Ben Momo', 'Ben M'],
  'Faith Larkum': ['Faith Larkum', 'Faith'],
  'Rhiannon Larkman': ['Rhiannon Larkman', 'Rhiannon', 'Rhi'],
  'Matthew Potter': ['Matthew Potter', 'Matthew', 'Matt P'],
  'Holly Turner': ['Holly Turner', 'Holly'],
  'Dilith N': ['Dilith Nanayakkara', 'Dilith', 'Diliff'],
  'Charuka Shiran': ['Charuka Shiran', 'Charuka', 'Shuruka'],
  'Selvin Mendes': ['Selvin Mendes', 'Selvin'],
  'Naveen': ['Naveen'],
  'Sarah': ['Sarah'],
  'Caira': ['Caira'],
  'Sahan': ['Sahan'],
};

// Build reverse lookup: lowercase alias → canonical name
const ALIAS_TO_NAME: Record<string, string> = {};
for (const [canonical, aliases] of Object.entries(TEAM_MEMBERS)) {
  for (const alias of aliases) {
    ALIAS_TO_NAME[alias.toLowerCase()] = canonical;
  }
}

export function normaliseAssignee(name: string): string | null {
  if (!name) return null;
  const lower = name.toLowerCase().trim();
  if (ALIAS_TO_NAME[lower]) return ALIAS_TO_NAME[lower];

  // Try partial match (first name only)
  for (const [alias, canonical] of Object.entries(ALIAS_TO_NAME)) {
    if (lower === alias.split(' ')[0]) return canonical;
  }
  return name.trim(); // Return original if no match — could be a client contact
}

export function isTeamMember(name: string): boolean {
  const lower = name.toLowerCase().trim();
  if (ALIAS_TO_NAME[lower]) return true;
  // Check first-name-only match against full names (not single-name aliases to avoid false positives)
  for (const canonical of Object.keys(TEAM_MEMBERS)) {
    if (canonical.toLowerCase().split(' ')[0] === lower && canonical.includes(' ')) return true;
  }
  return false;
}

export const VENDO_TEAM_DOMAINS = new Set([
  'vendodigital.co.uk',
  'vendodigital.com',
  'vendo.digital',
]);

export const GENERIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'hotmail.co.uk',
  'outlook.com',
  'outlook.co.uk',
  'yahoo.com',
  'yahoo.co.uk',
  'icloud.com',
  'me.com',
  'live.com',
  'live.co.uk',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'btinternet.com',
  'sky.com',
  'virginmedia.com',
  'talktalk.net',
  'mail.com',
  'zoho.com',
]);
