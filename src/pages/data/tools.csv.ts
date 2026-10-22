import type { APIRoute } from 'astro';
import { datasetRows } from '../../lib/stats';

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const GET: APIRoute = async ({ site }) => {
  const rows = await datasetRows(site!.toString().replace(/\/$/, ''));
  const cols = Object.keys(rows[0]);
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c as keyof typeof r])).join(','))].join('\n') + '\n';
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8' } });
};
