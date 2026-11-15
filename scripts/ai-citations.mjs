// Daily AI answer tracker. Asks each answer engine the buyer questions in
// automation/ai-citations/prompts.json, with web search on, and records the answer, every
// cited URL, and whether Makko AI or Make AI Games is named or cited.
//
// Engines run only when their key is set: ANTHROPIC_API_KEY, OPENAI_API_KEY,
// PERPLEXITY_API_KEY, GEMINI_API_KEY. Models can be overridden with CLAUDE_MODEL,
// OPENAI_MODEL, PERPLEXITY_MODEL, GEMINI_MODEL.
//
// Usage: node scripts/ai-citations.mjs <out-dir>
// Writes <out-dir>/runs/YYYY-MM-DD.json, appends <out-dir>/history.csv, rewrites <out-dir>/README.md.
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';

const OUT = process.argv[2] ?? 'ai-citations-data';
const PROMPTS = JSON.parse(readFileSync('automation/ai-citations/prompts.json', 'utf8'));
const today = new Date().toISOString().slice(0, 10);
const env = process.env;

const BRANDS = {
  makko: { name: /\bmakko\b/i, domains: ['makko.ai'] },
  makeaigames: { name: /make ?ai ?games|makeaigames/i, domains: ['makeaigames.com'] },
};

const host = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};
const uniq = (a) => [...new Set(a.filter(Boolean))];

// ---- Engines. Each returns { model, text, cited: [url], seen: [url] }.

async function claude(prompt) {
  const client = new Anthropic();
  const model = env.CLAUDE_MODEL ?? 'claude-opus-5-5';
  const messages = [{ role: 'user', content: prompt }];
  let text = '';
  const cited = [];
  const seen = [];
  // Server-side web search can pause a long turn; continue it a few times.
  for (let i = 0; i < 4; i++) {
    const res = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: env.CLAUDE_EFFORT ?? 'low' },
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }],
      messages,
    });
    for (const b of res.content) {
      if (b.type === 'text') {
        text += b.text;
        for (const c of b.citations ?? []) if (c.url) cited.push(c.url);
      }
      if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
        for (const r of b.content) if (r.url) seen.push(r.url);
      }
    }
    if (res.stop_reason === 'refusal') throw new Error(`refusal (${res.stop_details?.category ?? 'no category'})`);
    if (res.stop_reason !== 'pause_turn') return { model: res.model ?? model, text, cited: uniq(cited), seen: uniq(seen) };
    messages.push({ role: 'assistant', content: res.content });
  }
  return { model, text, cited: uniq(cited), seen: uniq(seen) };
}

async function openai(prompt) {
  const model = env.OPENAI_MODEL ?? 'gpt-5';
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: prompt, tools: [{ type: 'web_search' }] }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  let text = '';
  const cited = [];
  for (const item of j.output ?? []) {
    if (item.type !== 'message') continue;
    for (const c of item.content ?? []) {
      if (c.type !== 'output_text') continue;
      text += c.text;
      for (const a of c.annotations ?? []) if (a.type === 'url_citation' && a.url) cited.push(a.url);
    }
  }
  return { model: j.model ?? model, text, cited: uniq(cited), seen: [] };
}

async function perplexity(prompt) {
  const model = env.PERPLEXITY_MODEL ?? 'sonar';
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.PERPLEXITY_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Perplexity ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  const cited = j.citations ?? (j.search_results ?? []).map((r) => r.url);
  return { model: j.model ?? model, text: j.choices?.[0]?.message?.content ?? '', cited: uniq(cited), seen: [] };
}

async function gemini(prompt) {
  const model = env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], tools: [{ google_search: {} }] }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  const cand = j.candidates?.[0] ?? {};
  const text = (cand.content?.parts ?? []).map((p) => p.text ?? '').join('');
  // Grounding links are Google redirect URLs; the chunk title carries the real domain.
  const cited = (cand.groundingMetadata?.groundingChunks ?? []).map((c) => (c.web?.title ? `https://${c.web.title}/` : c.web?.uri));
  return { model, text, cited: uniq(cited), seen: [] };
}

const ENGINES = [
  { id: 'claude', key: 'ANTHROPIC_API_KEY', run: claude },
  { id: 'chatgpt', key: 'OPENAI_API_KEY', run: openai },
  { id: 'perplexity', key: 'PERPLEXITY_API_KEY', run: perplexity },
  { id: 'gemini', key: 'GEMINI_API_KEY', run: gemini },
].filter((e) => env[e.key]);

// ---- Run

if (!ENGINES.length) {
  console.log('ai-citations: no engine keys set, nothing to do');
  process.exit(0);
}

const rows = [];
for (const engine of ENGINES) {
  for (const p of PROMPTS) {
    const row = { date: today, engine: engine.id, prompt_id: p.id, prompt: p.prompt };
    try {
      const r = await engine.run(p.prompt);
      Object.assign(row, r);
      for (const [k, b] of Object.entries(BRANDS)) {
        const m = r.text.match(b.name);
        row[`${k}_named`] = Boolean(m);
        row[`${k}_position`] = m ? r.text.slice(0, m.index).length : null; // characters before the first mention
        row[`${k}_cited`] = r.cited.some((u) => b.domains.some((d) => host(u).endsWith(d)));
      }
    } catch (e) {
      row.error = String(e.message ?? e);
    }
    rows.push(row);
    console.log(`${engine.id} ${p.id}: ${row.error ? `error ${row.error}` : `makko ${row.makko_named ? 'named' : '-'}, ${row.cited.length} citations`}`);
  }
}

mkdirSync(join(OUT, 'runs'), { recursive: true });
writeFileSync(join(OUT, 'runs', `${today}.json`), JSON.stringify(rows, null, 2) + '\n');

const csv = join(OUT, 'history.csv');
const COLS = ['date', 'engine', 'model', 'prompt_id', 'makko_named', 'makko_cited', 'makeaigames_named', 'makeaigames_cited', 'cited_domains', 'error'];
// A second run on the same day replaces that day's rows instead of doubling them.
const kept = existsSync(csv) ? readFileSync(csv, 'utf8').trim().split('\n').slice(1).filter((l) => !l.startsWith(`"${today}"`)) : [];
writeFileSync(csv, [COLS.join(','), ...kept].join('\n') + '\n');
const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
for (const r of rows) {
  const vals = { ...r, cited_domains: uniq((r.cited ?? []).map(host)).join(' ') };
  appendFileSync(csv, COLS.map((c) => q(vals[c])).join(',') + '\n');
}

// ---- Summary (README.md on the data branch): last 7 days

const parse = (line) => [...line.matchAll(/"((?:[^"]|"")*)"/g)].map((m) => m[1].replace(/""/g, '"'));
const hist = readFileSync(csv, 'utf8').trim().split('\n').slice(1).map(parse).map((v) => Object.fromEntries(COLS.map((c, i) => [c, v[i]])));
const since = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
const week = hist.filter((r) => r.date >= since && !r.error);
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '-');
const engines = uniq(week.map((r) => r.engine));
const domainCounts = {};
for (const r of week) for (const d of (r.cited_domains || '').split(' ').filter(Boolean)) domainCounts[d] = (domainCounts[d] ?? 0) + 1;
const topDomains = Object.entries(domainCounts).sort((a, b) => b[1] - a[1]).slice(0, 30);

const md = [
  '# AI answer tracker',
  '',
  `Last run ${today}. Window: ${since} to ${today}. Raw answers are in \`runs/\`, one file per day; every row is in \`history.csv\`.`,
  '',
  '## How often each engine names us',
  '',
  '| Engine | Answers | Makko named | Makko cited | Make AI Games named | Make AI Games cited |',
  '|---|---|---|---|---|---|',
  ...engines.map((e) => {
    const r = week.filter((x) => x.engine === e);
    const n = (k) => r.filter((x) => x[k] === 'true').length;
    return `| ${e} | ${r.length} | ${pct(n('makko_named'), r.length)} | ${pct(n('makko_cited'), r.length)} | ${pct(n('makeaigames_named'), r.length)} | ${pct(n('makeaigames_cited'), r.length)} |`;
  }),
  '',
  '## Most cited domains (all engines, last 7 days)',
  '',
  'These are the pages AI already trusts for our questions. Getting Makko named accurately on them is the priority.',
  '',
  '| Domain | Citations |',
  '|---|---|',
  ...topDomains.map(([d, n]) => `| ${d} | ${n} |`),
  '',
  '## Questions where Makko was named today',
  '',
  ...(rows.some((r) => r.makko_named) ? rows.filter((r) => r.makko_named).map((r) => `- ${r.engine}: ${r.prompt}`) : ['- none']),
  '',
  `Errors today: ${rows.filter((r) => r.error).length} of ${rows.length}.`,
  '',
];
writeFileSync(join(OUT, 'README.md'), md.join('\n'));
console.log(`ai-citations: ${rows.length} answers written to ${OUT}`);
