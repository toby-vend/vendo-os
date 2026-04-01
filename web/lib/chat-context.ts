import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const contextDir = resolve(__dirname, '../../context');

let cachedPrompt: string | null = null;

export function getSystemPrompt(): string {
  if (cachedPrompt) return cachedPrompt;

  const sections: string[] = [];

  const files = readdirSync(contextDir).filter(f => f.endsWith('.md')).sort();
  for (const file of files) {
    const content = readFileSync(resolve(contextDir, file), 'utf-8').trim();
    if (content) {
      const label = file.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      sections.push(`## ${label}\n\n${content}`);
    }
  }

  cachedPrompt = `You are the VendoOS AI assistant — an internal tool for the Vendo Digital team. You have deep knowledge of the business, team, clients, strategy, and operations described below. Answer questions helpfully and concisely, drawing on this context. Use UK English.

=== BUSINESS CONTEXT ===

${sections.join('\n\n---\n\n')}`;

  return cachedPrompt;
}
