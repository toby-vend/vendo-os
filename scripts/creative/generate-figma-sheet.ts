/**
 * generate-figma-sheet.ts
 *
 * Deterministic core of the Client -> Figma Variables pipeline.
 * Clones the master template and writes ONLY the Value column, preserving the
 * sheet name, headers, Name/Type columns and formatting so the result re-imports
 * into Figma cleanly.
 *
 * Usage:
 *   node --import tsx scripts/creative/generate-figma-sheet.ts \
 *     --client "St Clears Dental Studio" \
 *     --values /path/to/values.json \
 *     [--out outputs/creatives/.../file.xlsx] \
 *     [--date 2026-06-05]
 *
 * values.json shape: { "Collection/Variable Name": "value", ... }
 * Any field absent (or empty) from values.json is left blank in the sheet.
 */
import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../..");
const TEMPLATE = join(HERE, "master-template.xlsx");
const SHEET = "Variables";

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      out[key] = val;
    }
  }
  return out;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const client = args.client;
  if (!client) throw new Error("--client is required");
  if (!args.values) throw new Error("--values <path to json> is required");

  const date = args.date && args.date !== "true" ? args.date : today();
  const values: Record<string, string> = JSON.parse(readFileSync(args.values, "utf8"));

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(TEMPLATE);
  const ws = wb.getWorksheet(SHEET);
  if (!ws) throw new Error(`Sheet "${SHEET}" not found in template`);

  // Build the set of valid field names from the template (typo guard).
  const templateNames = new Set<string>();
  ws.eachRow((row, rowNo) => {
    if (rowNo === 1) return; // header
    const name = row.getCell(1).value;
    if (name != null && String(name).trim() !== "") templateNames.add(String(name).trim());
  });

  const unknownKeys = Object.keys(values).filter((k) => !templateNames.has(k));
  if (unknownKeys.length) {
    console.warn(`⚠️  ${unknownKeys.length} value(s) not in template (ignored):`);
    unknownKeys.forEach((k) => console.warn(`     - ${k}`));
  }

  // Write the Value column (col 3).
  let filled = 0;
  const blankByCollection: Record<string, number> = {};
  ws.eachRow((row, rowNo) => {
    if (rowNo === 1) return;
    const nameCell = row.getCell(1).value;
    const name = nameCell == null ? "" : String(nameCell).trim();
    if (!name) return;
    const v = values[name];
    if (v != null && String(v).trim() !== "") {
      row.getCell(3).value = String(v);
      filled++;
    } else {
      row.getCell(3).value = null; // ensure blank
      const coll = name.split("/")[0];
      blankByCollection[coll] = (blankByCollection[coll] ?? 0) + 1;
    }
  });

  const slug = slugify(client);
  const outPath = args.out && args.out !== "true"
    ? resolve(REPO_ROOT, args.out)
    : join(REPO_ROOT, "outputs", "creatives", slug, `${slug}-figma-variables-${date}.xlsx`);
  await mkdir(dirname(outPath), { recursive: true });
  await wb.xlsx.writeFile(outPath);

  const total = templateNames.size;
  console.log(`\n✅ ${client}`);
  console.log(`   ${filled}/${total} fields filled, ${total - filled} blank`);
  if (Object.keys(blankByCollection).length) {
    console.log(`   Blank (left for QC / not offered), by category:`);
    Object.entries(blankByCollection)
      .sort((a, b) => b[1] - a[1])
      .forEach(([c, n]) => console.log(`     · ${c}: ${n}`));
  }
  console.log(`   → ${outPath}`);
}

main().catch((e) => {
  console.error("Error:", e.message);
  process.exit(1);
});
