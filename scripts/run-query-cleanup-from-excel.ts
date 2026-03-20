/**
 * Standalone script: read queries from Queries-Booleans.xlsx (or leadership_requirements.txt),
 * run query cleanup (same logic as SearchGenerationService.cleanupQuery) for first 15,
 * write cleaned queries to a text file in the same directory as the Excel.
 *
 * Usage: OPENAI_API_KEY=xxx npx tsx scripts/run-query-cleanup-from-excel.ts
 * Or: OPENAI_API_KEY=xxx yarn tsx scripts/run-query-cleanup-from-excel.ts
 */

import * as fs from 'fs';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { z } from 'zod';

const QUERY_CLEANUP_SYSTEM = `You are an expert recruiter who understands how candidates write their LinkedIn profiles and resumes. Your task is to rewrite client search queries into realistic search queries that candidates would actually mention in their profiles.

A lot of client search queries are overtly demanding and often mention things that candidates do not explicitly mention in their resumes/ LinkedIn profiles. Some of the requirements they mention are quite implicit in the combination job title (function + seniority level) + company / industry. So unnecessarily over loading queries into parameters become counter productive.

Your task is to rewrite the client search query into a realistic search query that focuses on what candidates actually write in their profiles.`;

function getUserPrompt(rawQuery: string): string {
  return `Rewrite the following client search query into a realistic search query. Return only the realistic search query and no explanation necessary:

${rawQuery}`;
}

const queryCleanupSchema = z.object({
  cleanedQuery: z
    .string()
    .describe(
      'The cleaned up realistic search query that focuses on what candidates actually write in their profiles'
    ),
  reasoning: z
    .string()
    .nullable()
    .describe(
      'Brief explanation of what was simplified or removed (for debugging purposes, not shown to user)'
    ),
});

const EXCEL_PATH = '/Users/arnavsaxena/Downloads/Queries-Booleans.xlsx';
const LEADERSHIP_FALLBACK_PATH = path.join(
  __dirname,
  '..',
  'leadership_requirements.txt'
);
const OUTPUT_PATH = '/Users/arnavsaxena/Downloads/cleaned-queries.txt';
const LIMIT = 15;

function loadQueriesFromExcel(filePath: string): string[] {
  const buf = fs.readFileSync(filePath);
  const wb = XLSX.read(buf, { type: 'buffer' });
  const firstSheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[firstSheetName];
  const data = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    defval: '',
  }) as string[][];

  const queries: string[] = [];
  const headerRow = (data[0] ?? []) as string[];
  const queryColIndex = (() => {
    const i = headerRow.findIndex((h) => {
      const s = typeof h === 'string' ? h : String(h ?? '');
      const lower = s.toLowerCase();
      return (
        lower === 'query' ||
        lower === 'queries' ||
        lower === 'boolean query' ||
        s === 'Boolean Query'
      );
    }) as number;
    return i >= 0 ? i : 0;
  })();

  for (let i = 1; i < data.length && queries.length < LIMIT; i++) {
    const row = data[i] ?? [];
    const cell = row[queryColIndex];
    const q = typeof cell === 'string' ? cell.trim() : String(cell ?? '').trim();
    if (q) queries.push(q);
  }
  return queries;
}

function loadQueriesFromTxt(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  const queries: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (t && !/^\s*#/.test(t)) {
      queries.push(t);
      if (queries.length >= LIMIT) break;
    }
  }
  return queries;
}

async function cleanupQuery(
  openai: OpenAI,
  rawQuery: string
): Promise<{ cleanedQuery: string; reasoning: string | null }> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-5.1-chat-latest',
    messages: [
      { role: 'system', content: QUERY_CLEANUP_SYSTEM },
      { role: 'user', content: getUserPrompt(rawQuery) },
    ],
    temperature: 0.3,
    // max_tokens: 500,
    response_format: zodResponseFormat(queryCleanupSchema, 'queryCleanup'),
  });

  const content = completion.choices[0].message.content;
  if (!content) {
    return { cleanedQuery: rawQuery, reasoning: null };
  }
  const parsed = JSON.parse(content);
  const validated = queryCleanupSchema.parse(parsed);
  return {
    cleanedQuery: validated.cleanedQuery,
    reasoning: validated.reasoning ?? null,
  };
}

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('Set OPENAI_API_KEY in the environment.');
    process.exit(1);
  }

  let queries: string[];
  let source: string;

  if (fs.existsSync(EXCEL_PATH)) {
    queries = loadQueriesFromExcel(EXCEL_PATH);
    source = EXCEL_PATH;
  } else if (fs.existsSync(LEADERSHIP_FALLBACK_PATH)) {
    queries = loadQueriesFromTxt(LEADERSHIP_FALLBACK_PATH);
    source = LEADERSHIP_FALLBACK_PATH;
  } else {
    console.error(
      `Neither ${EXCEL_PATH} nor ${LEADERSHIP_FALLBACK_PATH} found.`
    );
    process.exit(1);
  }

  const toProcess = queries.slice(0, LIMIT);
  console.log(`Loaded ${toProcess.length} queries from ${source}. Running cleanup...`);

  const openai = new OpenAI({ apiKey });
  const results: { original: string; cleaned: string; reasoning: string | null }[] = [];

  for (let i = 0; i < toProcess.length; i++) {
    const q = toProcess[i];
    console.log(`[${i + 1}/${toProcess.length}] ${q.slice(0, 60)}...`);
    const { cleanedQuery, reasoning } = await cleanupQuery(openai, q);
    results.push({ original: q, cleaned: cleanedQuery, reasoning });
  }

  const outDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const lines: string[] = [
    '# Query cleanup results (first 15 queries)',
    `# Source: ${source}`,
    `# Generated: ${new Date().toISOString()}`,
    '',
  ];
  results.forEach((r, i) => {
    lines.push(`## ${i + 1}`);
    lines.push(`Original: ${r.original}`);
    lines.push(`Cleaned: ${r.cleaned}`);
    if (r.reasoning) lines.push(`Reasoning: ${r.reasoning}`);
    lines.push('');
  });

  fs.writeFileSync(OUTPUT_PATH, lines.join('\n'), 'utf-8');
  console.log(`Wrote ${results.length} cleaned queries to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
