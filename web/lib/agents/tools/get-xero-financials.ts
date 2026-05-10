import { z } from 'zod';
import { defineTool } from './_tool.js';
import { CAPABILITIES } from '../permissions.js';
import { rows } from '../../queries/base.js';
import type { ToolCtx } from '../types.js';

/**
 * getXeroFinancials — admin-only read access to the locally synced
 * Xero data in Turso (xero_invoices, xero_contacts, xero_pnl_monthly).
 *
 * Four views, picked via the `view` arg:
 *   - 'outstanding'      → top contacts by total outstanding receivable
 *   - 'overdue'          → top contacts by overdue receivable
 *   - 'pnl'              → recent monthly P&L rows (income / expense / net)
 *   - 'contact-invoices' → recent invoices for a named contact (requires `contact`)
 */

const inputSchema = z.object({
  view: z.enum(['outstanding', 'overdue', 'pnl', 'contact-invoices']),
  // Contact name fragment for 'contact-invoices' view. LIKE-matched
  // against xero_contacts.name; the closest hit is used.
  contact: z.string().optional(),
  // For 'pnl' view: how many months back from latest to return.
  monthsBack: z.number().int().min(1).max(24).default(6),
  // For list-style views ('outstanding' / 'overdue' / 'contact-invoices').
  limit: z.number().int().min(1).max(50).default(10),
});

const outstandingRow = z.object({
  contactId: z.string(),
  name: z.string(),
  outstandingReceivable: z.number().nullable(),
  overdueReceivable: z.number().nullable(),
});

const pnlRow = z.object({
  periodStart: z.string(),
  periodEnd: z.string(),
  totalIncome: z.number().nullable(),
  totalExpenses: z.number().nullable(),
  netProfit: z.number().nullable(),
});

const invoiceRow = z.object({
  id: z.string(),
  invoiceNumber: z.string().nullable(),
  contactName: z.string().nullable(),
  date: z.string().nullable(),
  dueDate: z.string().nullable(),
  status: z.string().nullable(),
  total: z.number().nullable(),
  amountDue: z.number().nullable(),
  currency: z.string().nullable(),
});

const outputSchema = z.object({
  view: z.enum(['outstanding', 'overdue', 'pnl', 'contact-invoices']),
  outstanding: z.array(outstandingRow).nullable(),
  pnl: z.array(pnlRow).nullable(),
  invoices: z.array(invoiceRow).nullable(),
  matchedContact: z.string().nullable(),
  asOf: z.string(),
  note: z.string().nullable(),
});

interface RawContact {
  id: string;
  name: string;
  outstanding_receivable: number | null;
  overdue_receivable: number | null;
}
interface RawPnl {
  period_start: string;
  period_end: string;
  total_income: number | null;
  total_expenses: number | null;
  net_profit: number | null;
}
interface RawInvoice {
  id: string;
  invoice_number: string | null;
  contact_name: string | null;
  date: string | null;
  due_date: string | null;
  status: string | null;
  total: number | null;
  amount_due: number | null;
  currency: string | null;
}

export const getXeroFinancials = (ctx: ToolCtx) =>
  defineTool(
    {
      name: 'getXeroFinancials',
      description:
        "Read Xero financials from the local sync. Pick a view: 'outstanding' (top contacts owing money), 'overdue' (top contacts past due), 'pnl' (recent monthly P&L), or 'contact-invoices' (recent invoices for a named contact — requires `contact`).",
      hasSideEffect: false,
      capability: CAPABILITIES.XERO_READ,
      input: inputSchema,
      output: outputSchema,
      run: async (args) => {
        const asOf = new Date().toISOString();
        if (args.view === 'outstanding') {
          const r = await rows<RawContact>(
            `SELECT id, name, outstanding_receivable, overdue_receivable
               FROM xero_contacts
              WHERE is_customer = 1 AND COALESCE(outstanding_receivable, 0) > 0
           ORDER BY outstanding_receivable DESC
              LIMIT ?`,
            [args.limit],
          );
          return {
            view: 'outstanding' as const,
            outstanding: r.map((c) => ({
              contactId: c.id,
              name: c.name,
              outstandingReceivable: c.outstanding_receivable ?? null,
              overdueReceivable: c.overdue_receivable ?? null,
            })),
            pnl: null,
            invoices: null,
            matchedContact: null,
            asOf,
            note: null,
          };
        }

        if (args.view === 'overdue') {
          const r = await rows<RawContact>(
            `SELECT id, name, outstanding_receivable, overdue_receivable
               FROM xero_contacts
              WHERE is_customer = 1 AND COALESCE(overdue_receivable, 0) > 0
           ORDER BY overdue_receivable DESC
              LIMIT ?`,
            [args.limit],
          );
          return {
            view: 'overdue' as const,
            outstanding: r.map((c) => ({
              contactId: c.id,
              name: c.name,
              outstandingReceivable: c.outstanding_receivable ?? null,
              overdueReceivable: c.overdue_receivable ?? null,
            })),
            pnl: null,
            invoices: null,
            matchedContact: null,
            asOf,
            note: null,
          };
        }

        if (args.view === 'pnl') {
          const r = await rows<RawPnl>(
            `SELECT period_start, period_end, total_income, total_expenses, net_profit
               FROM xero_pnl_monthly
           ORDER BY period_start DESC
              LIMIT ?`,
            [args.monthsBack],
          );
          return {
            view: 'pnl' as const,
            outstanding: null,
            pnl: r.map((p) => ({
              periodStart: p.period_start,
              periodEnd: p.period_end,
              totalIncome: p.total_income ?? null,
              totalExpenses: p.total_expenses ?? null,
              netProfit: p.net_profit ?? null,
            })),
            invoices: null,
            matchedContact: null,
            asOf,
            note: null,
          };
        }

        // contact-invoices
        if (!args.contact || !args.contact.trim()) {
          return {
            view: 'contact-invoices' as const,
            outstanding: null,
            pnl: null,
            invoices: null,
            matchedContact: null,
            asOf,
            note: 'contact_required',
          };
        }
        const pattern = `%${args.contact.trim()}%`;
        const contactRow = await rows<{ id: string; name: string }>(
          `SELECT id, name FROM xero_contacts WHERE name LIKE ? ORDER BY length(name) ASC LIMIT 1`,
          [pattern],
        );
        if (contactRow.length === 0) {
          return {
            view: 'contact-invoices' as const,
            outstanding: null,
            pnl: null,
            invoices: null,
            matchedContact: null,
            asOf,
            note: 'contact_not_found',
          };
        }
        const matched = contactRow[0];
        const inv = await rows<RawInvoice>(
          `SELECT id, invoice_number, contact_name, date, due_date, status, total, amount_due, currency
             FROM xero_invoices
            WHERE contact_id = ?
         ORDER BY date DESC
            LIMIT ?`,
          [matched.id, args.limit],
        );
        return {
          view: 'contact-invoices' as const,
          outstanding: null,
          pnl: null,
          invoices: inv.map((i) => ({
            id: i.id,
            invoiceNumber: i.invoice_number ?? null,
            contactName: i.contact_name ?? null,
            date: i.date ?? null,
            dueDate: i.due_date ?? null,
            status: i.status ?? null,
            total: i.total ?? null,
            amountDue: i.amount_due ?? null,
            currency: i.currency ?? null,
          })),
          matchedContact: matched.name,
          asOf,
          note: null,
        };
      },
    },
    ctx,
  );
