/**
 * One-off: bulk-apply Google Ads → client mappings decided in this session.
 *
 * Usage: npx tsx --env-file=.env.local scripts/utils/apply-gads-mapping.ts
 *
 * Re-runnable: upserts via PK (gads_customer_id), so safe to re-run.
 */
import { db, rows } from '../../web/lib/queries/base.js';

// Each entry: [gads_customer_id, client_id, note]
// Notes are written into gads_account_client_map.notes for audit.
const mappings: Array<[string, number, string]> = [
  // --- HIGH 100% confidence (47) — names match cleanly ---
  // (Some pairings include a clarifying note when client name differs slightly)
  ['9012345', 0, 'placeholder'],  // sentinel — replaced below
];
// Clear the placeholder.
mappings.length = 0;

// --- HIGH 100% / 67% (47 from auto-match, user approved bulk) ---
const highConfidence: Array<[string, number, string]> = [
  ['9471081094', 135, 'ARC Dental Surgery'],
  ['8361757750', 131, 'Access Platform Sales'],
  ['4198725064', 138, 'Avenue Dental Practice'],
  ['1148492397', 139, 'Blue Box Hire'],
  ['6742330615', 143, 'Bright Orthodontics'],
  ['8916460899', 145, 'CDM Labels'],
  ['7817761595', 149, 'Colbrans Home Solutions'],
  ['6375231139', 152, 'Diamond Smile'],
  ['7548931682', 153, 'Dorking Dental Centre'],
  ['6232597470', 154, 'Dr Mali Dental Clinic → Dr Mali'],
  ['2419217568', 157, 'FM Marble'],
  ['4219260196', 158, 'GF Fire Solutions'],
  ['1410807898', 160, 'Gillett Flooring'],
  ['8451950586', 162, 'Green Dental & Implant Clinic'],
  ['2733650364', 169, 'Hire A Loo'],
  ['2686757454', 171, 'Iconic Dent (preferred over duplicate 279)'],
  ['3837088586', 179, 'John Rose Eye Care'],
  ['2314203844', 180, 'Just Smile Dental'],
  ['9862817013', 182, 'Kane Construction Services'],
  ['2372364239', 36,  'Lakewood Dental'],
  ['9329065862', 190, 'Lateral Dental Clinic'],
  ['6078230442', 195, 'London Property Preservation Ltd'],
  ['1742047960', 210, 'Pamper Paws'],
  ['2629380523', 28,  'Purley Dental Care'],
  ['8620838291', 220, 'REVO Dent'],
  ['6997564597', 224, 'Rothley Lodge'],
  ['6301385496', 228, 'Schryver Restoration'],
  ['9663726990', 233, 'Simmons Taylor Hall'],
  ['1708037794', 236, 'Smile For Life'],
  ['5244746182', 18,  'St Clears Dental Studio'],
  ['6525904384', 116, 'Stamford Dental Care'],
  ['3614079237', 244, 'Studio Glide Pilates'],
  ['7177615319', 245, 'Sun Pest Control'],
  ['7612047047', 26,  'Swinnow Dental'],
  ['9832219641', 252, 'The Dental Practice UK'],
  ['3010323821', 254, 'The Event Beverage Co'],
  ['2310522325', 251, 'The Sword Stall'],
  ['5968984095', 256, 'The Walton Practice'],
  ['6425749721', 25,  'Thornbury Dental Wellness'],
  ['7018172658', 30,  'Thornley Park Dental'],
  ['6418938445', 110, 'Urban Dental'],
  ['7643037294', 92,  'Zen House Dental'],
  // HIGH 67%
  ['3379131488', 206, 'Dentist@29 → Oral Implants Limited - Dentist @29'],
  ['8865709674', 199, 'MR Mouldings Skirting → MR Mouldings'],
  ['2718807264', 241, 'Signature Smiles Radstone → Signature Smiles'],
  ['4028364145', 267, 'Vulcan Cladding Systems → Vulcan Cladding'],
  ['2958566962', 269, 'Wallington Cars & Couriers → Wallington Cars'],
];

// --- MED confidence — clearly the same business, minor name variations ---
const medConfidence: Array<[string, number, string]> = [
  ['2926775573', 226, 'Billericay Dental Care → Billericay Dental'],
  ['8409562405', 141, 'Boho Bell Tent → Boho Bell Tents'],
  ['2515542366', 215, 'Dentartistry → D H Keen (Dentartistry)'],
  ['1118327809', 155, 'Edge Dental Studio → Edge Dental'],
  ['3399235897', 202, 'Mobile Denture Repair Company → Mobile Denture Repairs'],
  // KHG sub-clinics — each rolls up to its individual client
  ['6768505509', 156, 'KHG - Edward Byrne'],
  ['1928256450', 198, 'KHG - MK Smiles'],
  ['7227798301', 273, 'KHG - Wilson House Dental'],
  ['9992006164', 275, 'KHG - Woburn Sands Dental'],
];

// --- LOW confidence — same business, lower token overlap due to qualifiers ---
const lowConfidence: Array<[string, number, string]> = [
  ['3319608878', 80,  'DK Dental Practice and Lab → DK Dental Clinic'],
  ['8982807890', 207, 'KHG - Oxford House Dental Practice (New) → Oxford House - KHG'],
  ['3400225323', 191, 'Lee Dental and Implant Practice → Lee Dental Practice'],
  ['6583693305', 211, 'Peak Dental & Cosmetic Centre → Peak Dental Clinic'],
  ['4972064513', 144, 'Pearl Dental Practice → Bryt Oral Care (Pearl)'],
];

// --- RDG sub-clinics → all to client 218 (Ravensdale Dental Group / Dentistry.ie) ---
const rdgGroup: Array<[string, number, string]> = [
  ['1727299200', 218, 'RDG - Artane Dental & Implant Clinic'],
  ['1674980621', 218, 'RDG - Balbriggan Dental'],
  ['9745355115', 218, 'RDG - Dentistry.ie - Sundrive Dental'],
  ['6358474417', 218, 'RDG - Friary Court Dental'],
  ['4950354082', 218, 'RDG - Kildare Dental Centre'],
  ['4840267633', 218, 'RDG - McEvoy Dental'],
  ['2182687793', 218, 'RDG - Pearls Dental Castleknock'],
  ['1850379984', 218, 'RDG - Pearls Dental Maynooth'],
];

mappings.push(...highConfidence, ...medConfidence, ...lowConfidence, ...rdgGroup);

// --- Apply ---
let inserted = 0;
let updated = 0;
let unchanged = 0;
for (const [gadsId, clientId, note] of mappings) {
  const existing = await rows<{ client_id: number }>(
    `SELECT client_id FROM gads_account_client_map WHERE gads_customer_id = ?`,
    [gadsId],
  );
  if (existing.length) {
    if (existing[0].client_id === clientId) {
      unchanged++;
    } else {
      await db.execute({
        sql: `UPDATE gads_account_client_map
                 SET client_id = ?, notes = ?, updated_at = datetime('now')
               WHERE gads_customer_id = ?`,
        args: [clientId, note, gadsId],
      });
      updated++;
    }
  } else {
    await db.execute({
      sql: `INSERT INTO gads_account_client_map (gads_customer_id, client_id, notes)
            VALUES (?, ?, ?)`,
      args: [gadsId, clientId, note],
    });
    inserted++;
  }
}

console.log('--- Google Ads account mapping ---');
console.log(`Inserted: ${inserted}`);
console.log(`Updated:  ${updated}`);
console.log(`Already correct: ${unchanged}`);
console.log(`Total processed: ${mappings.length}`);
console.log('');
console.log('Intentionally left unmapped:');
console.log('  - ALG sub-brands (Caloo, Image Playgrounds, Nova Sport, PlayTop, Abacus Playgrounds) — not active clients');
console.log('  - Vendo internal accounts (Example, Vendo Digital)');
console.log('  - Champion Timber, Hartfield Road Dental, R-Dental Ltd — no matching client');
console.log('');
console.log('Review/edit at: /admin/gads-account-map');
