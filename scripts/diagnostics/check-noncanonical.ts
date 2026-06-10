/** Find canonical candidates for non-canonical meeting client_names. */
import { rows } from '../../web/lib/queries/base.js';

async function main() {
  const names = ['Akhil Patel', 'Charlotte Hyde', 'Dental Art Implant Clinics', 'Dentartistry', 'Niraj Halai', 'Steve', 'Thornbury Dental Wellness'];
  for (const n of names) {
    const token = n.split(/\s+/)[0];
    const candidates = await rows<{ id: number; name: string; status: string | null }>(
      `SELECT id, name, status FROM clients WHERE name LIKE '%' || ? || '%' LIMIT 5`,
      [token],
    );
    const meetings = await rows<{ id: string; title: string; date: string; match_method: string }>(
      `SELECT id, title, date, match_method FROM meetings WHERE client_name = ? ORDER BY date DESC LIMIT 6`,
      [n],
    );
    console.log(`\n"${n}" → candidates: ${candidates.map(c => `${c.name} [${c.status}]`).join(' | ') || '(none)'}`);
    for (const m of meetings) console.log(`   ${m.date.slice(0, 10)} [${m.match_method}] ${m.title}`);
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
