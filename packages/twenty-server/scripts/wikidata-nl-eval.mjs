/**
 * One-off eval: NL company queries → LLM structured filters → Wikidata SPARQL.
 * Run from twenty-server with: node --import tsx/esm /tmp/wikidata-nl-eval.mjs
 */
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText } from 'ai';
import { readFileSync } from 'node:fs';
import { z } from 'zod';

const ENV_PATH =
  '/Users/arnavsaxena/MEGA/arx/arxena/packages/twenty-server/.env';
const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';
const UA =
  'ArxenaWikidataNlEval/1.0 (https://arxena.com; company-search-eval)';

const loadEnv = (path) => {
  const env = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const NL_QUERIES = [
  'give me all textile machinery companies in india',
  'public SaaS companies headquartered in germany founded after 2010',
  'fintech startups in singapore',
  'electric vehicle manufacturers in china',
  'pharmaceutical companies in switzerland',
  'semiconductor companies in taiwan',
  'renewable energy companies in denmark',
  'banking companies headquartered in mumbai',
  'steel manufacturing companies in japan',
  'ecommerce companies in brazil',
  'biotech companies in boston area united states',
  'oil and gas companies in saudi arabia',
  'fashion apparel brands in italy',
];

const intentSchema = z.object({
  country: z
    .string()
    .nullable()
    .describe('Country name if mentioned, else null'),
  cityOrRegion: z
    .string()
    .nullable()
    .describe('City or region if mentioned, else null'),
  industry: z
    .string()
    .nullable()
    .describe('Industry / sector phrase for Wikidata P452'),
  publiclyTradedOnly: z.boolean().default(false),
  foundedAfterYear: z.number().int().nullable(),
  keywords: z
    .array(z.string())
    .default([])
    .describe('Extra label keywords to FILTER on companyLabel'),
  limit: z.number().int().min(5).max(25).default(10),
  notes: z.string().default(''),
});

const fetchJson = async (url) => {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  return response.json();
};

const wbSearchEntity = async (search) => {
  const params = new URLSearchParams({
    action: 'wbsearchentities',
    search,
    language: 'en',
    uselang: 'en',
    type: 'item',
    limit: '10',
    format: 'json',
    origin: '*',
  });
  const data = await fetchJson(`${WIKIDATA_API}?${params}`);
  return (data.search ?? []).map((hit) => ({
    id: hit.id,
    label: hit.label,
    description: hit.description ?? '',
  }));
};

const isGeographicOverviewHit = (hit) => {
  const text = `${hit.label} ${hit.description}`.toLowerCase();
  return (
    /\bindustry in (the )?[a-z]/.test(text) ||
    text.includes('overview of the') ||
    text.includes('in the united kingdom') ||
    text.includes('in canada') ||
    text.includes('in india') ||
    text.includes('in china') ||
    text.includes('in taiwan') ||
    text.includes('in pakistan') ||
    text.includes('in russia') ||
    text.includes('soviet union') ||
    text.includes('book chapter') ||
    text.includes('supply chain:')
  );
};

const pickBestEntity = (hits, preferDescriptionIncludes = []) => {
  if (hits.length === 0) return null;
  const scored = hits.map((hit, rank) => {
    const label = hit.label.toLowerCase();
    const description = hit.description.toLowerCase();
    let score = 100 - rank;
    if (isGeographicOverviewHit(hit)) score -= 80;
    if (
      preferDescriptionIncludes.some((needle) =>
        description.includes(needle.toLowerCase()),
      )
    ) {
      score += 15;
    }
    if (label === preferDescriptionIncludes[0]?.toLowerCase()) score += 20;
    return { hit, score };
  });
  scored.sort((left, right) => right.score - left.score);
  return scored[0]?.hit ?? null;
};

const INDUSTRY_ALIASES = {
  'financial technology': 'fintech',
  fintech: 'fintech',
  'electronic commerce': 'e-commerce',
  ecommerce: 'e-commerce',
  'e-commerce industry': 'e-commerce',
  'renewable energy industry': 'renewable energy',
};

const looksLikeCompanyHit = (hit) => {
  const description = hit.description.toLowerCase();
  return (
    description.includes('company') ||
    description.includes('organization') ||
    description.includes('enterprise') ||
    description.includes('startup') ||
    description.includes('bank') ||
    description.includes('provider') ||
    description.includes('association')
  );
};

const pickIndustryEntity = (hits, industryPhrase) => {
  if (hits.length === 0) return null;
  const needle = (industryPhrase ?? '').toLowerCase().trim();
  const scored = hits.map((hit, rank) => {
    const label = hit.label.toLowerCase();
    const description = hit.description.toLowerCase();
    let score = 50 - rank;
    if (isGeographicOverviewHit(hit)) score -= 100;
    if (looksLikeCompanyHit(hit) && label !== needle) score -= 60;
    if (label === needle) score += 40;
    if (label.includes(needle) || needle.includes(label)) score += 20;
    if (
      description.includes('economic sector') ||
      description.includes('branch of') ||
      description.includes('produces') ||
      description.includes('manufactur') ||
      description.includes('develops') ||
      description.includes('technologies and systems') ||
      description.includes('type of business industry') ||
      description.includes('industry usually')
    ) {
      score += 25;
    }
    if (description.includes('industry') && !isGeographicOverviewHit(hit)) {
      score += 10;
    }
    return { hit, score };
  });
  scored.sort((left, right) => right.score - left.score);
  return scored[0]?.hit ?? null;
};

const KEYWORD_STOPWORDS = new Set([
  'startup',
  'startups',
  'company',
  'companies',
  'brand',
  'brands',
  'firm',
  'firms',
  'public',
  'listed',
]);

const buildSparql = ({
  countryId,
  industryId,
  cityOrRegionId,
  publiclyTradedOnly,
  foundedAfterYear,
  keywords,
  limit,
}) => {
  const filters = [];
  const usefulKeywords = (Array.isArray(keywords) ? keywords : [])
    .map((keyword) => keyword.replace(/"/g, '').trim())
    .filter(
      (keyword) =>
        keyword.length >= 3 && !KEYWORD_STOPWORDS.has(keyword.toLowerCase()),
    );

  // Soft label hint only when no industry id (otherwise P452 is enough)
  if (!industryId && usefulKeywords.length > 0) {
    const joined = usefulKeywords
      .map(
        (keyword) =>
          `CONTAINS(LCASE(?companyLabel), "${keyword.toLowerCase()}")`,
      )
      .join(' || ');
    filters.push(`FILTER(${joined})`);
  }
  if (foundedAfterYear) {
    filters.push(`FILTER(YEAR(?founded) >= ${Number(foundedAfterYear)})`);
  }

  const countryClause = countryId
    ? `{ ?company wdt:P17 wd:${countryId} . } UNION {
         ?company wdt:P159 ?hq .
         ?hq wdt:P17 wd:${countryId} .
       }`
    : '';

  // City/region alone is sparse on Wikidata; drop country AND when place is set
  const placeClause = cityOrRegionId
    ? `?company wdt:P159 ?hqPlace .
       ?hqPlace wdt:P131* wd:${cityOrRegionId} .`
    : countryClause;

  return `
SELECT DISTINCT ?company ?companyLabel ?website ?founded ?employees ?industryLabel ?countryLabel WHERE {
  ?company wdt:P31/wdt:P279* wd:Q4830453 .
  ${publiclyTradedOnly ? '?company wdt:P31/wdt:P279* wd:Q891723 .' : ''}
  ${industryId ? `?company wdt:P452/wdt:P279* wd:${industryId} .` : ''}
  ${placeClause}
  OPTIONAL { ?company wdt:P856 ?website . }
  OPTIONAL { ?company wdt:P571 ?founded . }
  OPTIONAL { ?company wdt:P1128 ?employees . }
  OPTIONAL { ?company wdt:P452 ?industry . }
  OPTIONAL { ?company wdt:P17 ?country . }
  ${filters.join('\n  ')}
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT ${limit}
`.trim();
};

const runSparql = async (query) => {
  const url =
    `${SPARQL_ENDPOINT}?` +
    new URLSearchParams({ format: 'json', query }).toString();
  const response = await fetch(url, {
    headers: {
      Accept: 'application/sparql-results+json',
      'User-Agent': UA,
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SPARQL ${response.status}: ${text.slice(0, 200)}`);
  }
  const data = await response.json();
  return (data.results?.bindings ?? []).map((binding) => {
    const row = {};
    for (const [key, value] of Object.entries(binding)) {
      row[key] = value.value;
    }
    return row;
  });
};

const main = async () => {
  const env = loadEnv(ENV_PATH);
  const apiKey = env.NOUS_API_KEY || env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('NOUS_API_KEY or OPENROUTER_API_KEY missing in .env');
  }

  const useNous = Boolean(env.NOUS_API_KEY);
  const provider = createOpenAICompatible({
    name: useNous ? 'nous' : 'openrouter',
    apiKey,
    baseURL: useNous
      ? 'https://inference-api.nousresearch.com/v1'
      : 'https://openrouter.ai/api/v1',
  });
  const modelId = useNous ? 'tencent/hy3:free' : 'openai/gpt-4o-mini';
  const model = provider(modelId);

  console.log(`Model: ${useNous ? 'nous' : 'openrouter'}/${modelId}`);
  console.log(`Queries: ${NL_QUERIES.length}\n`);

  const report = [];

  for (let index = 0; index < NL_QUERIES.length; index += 1) {
    const nl = NL_QUERIES[index];
    console.log(`\n[${index + 1}/${NL_QUERIES.length}] ${nl}`);

    let intent;
    try {
      // Free Nous model lacks structuredOutputs — use text JSON + zod parse
      const { text } = await generateText({
        model,
        system: `You convert natural-language company discovery requests into structured Wikidata search filters.
Use concise canonical industry phrases Wikidata uses as P452 values, e.g.:
"pharmaceutical industry", "semiconductor industry", "automotive industry",
"banking", "steel industry", "fashion", "petroleum industry", "software industry",
"biotechnology", "renewable energy", "textile industry", "financial technology".
Prefer the broad industry noun, not country-specific phrases like "pharmaceutical industry in India".
Set publiclyTradedOnly only when the user asks for public/listed companies.
Put niche product words (e.g. "electric vehicle", "textile machinery", "SaaS") into keywords — not words like startup/brand/company.
Return limit 10 unless the user asks for more.

Respond with ONLY a JSON object (no markdown) matching:
{
  "country": string|null,
  "cityOrRegion": string|null,
  "industry": string|null,
  "publiclyTradedOnly": boolean,
  "foundedAfterYear": number|null,
  "keywords": string[],
  "limit": number,
  "notes": string
}`,
        prompt: nl,
      });
      const cleaned = text
        .trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim();
      intent = intentSchema.parse(JSON.parse(cleaned));
      console.log('  intent:', JSON.stringify(intent));
    } catch (error) {
      console.log(
        `  LLM intent failed: ${error instanceof Error ? error.message : error}`,
      );
      report.push({ nl, ok: false, stage: 'llm', error: String(error) });
      await sleep(1500);
      continue;
    }

    let countryId = null;
    let industryId = null;
    let cityOrRegionId = null;

    try {
      if (intent.country) {
        const hits = await wbSearchEntity(intent.country);
        const best = pickBestEntity(hits, [
          'country',
          'sovereign state',
          'nation',
        ]);
        countryId = best?.id ?? null;
        console.log(
          `  country resolve: ${intent.country} → ${countryId} (${best?.label})`,
        );
        await sleep(250);
      }
      if (intent.industry) {
        const alias =
          INDUSTRY_ALIASES[intent.industry.toLowerCase()] ?? intent.industry;
        const hits = await wbSearchEntity(alias);
        const best = pickIndustryEntity(hits, alias);
        industryId = best?.id ?? null;
        console.log(
          `  industry resolve: ${intent.industry} → ${industryId} (${best?.label})`,
        );
        await sleep(250);
      }
      if (intent.cityOrRegion) {
        const hits = await wbSearchEntity(intent.cityOrRegion);
        const best = pickBestEntity(hits, [
          'city',
          'capital',
          'metropolis',
          'region',
          'state',
        ]);
        cityOrRegionId = best?.id ?? null;
        console.log(
          `  place resolve: ${intent.cityOrRegion} → ${cityOrRegionId} (${best?.label})`,
        );
        await sleep(250);
      }
    } catch (error) {
      console.log(
        `  entity resolve failed: ${error instanceof Error ? error.message : error}`,
      );
      report.push({
        nl,
        ok: false,
        stage: 'resolve',
        intent,
        error: String(error),
      });
      await sleep(1500);
      continue;
    }

    if (!countryId && !industryId && !cityOrRegionId && intent.keywords.length === 0) {
      console.log('  skip: no resolvable country/industry/place/keywords');
      report.push({ nl, ok: false, stage: 'empty_filters', intent });
      continue;
    }

    const sparql = buildSparql({
      countryId,
      industryId,
      cityOrRegionId,
      publiclyTradedOnly: intent.publiclyTradedOnly,
      foundedAfterYear: intent.foundedAfterYear,
      keywords: intent.keywords,
      limit: intent.limit,
    });

    try {
      // WDQS is rate-limited; wait between queries
      await sleep(3500);
      const rows = await runSparql(sparql);
      const preview = rows.slice(0, 5).map((row) => ({
        name: row.companyLabel,
        website: row.website,
        industry: row.industryLabel,
        country: row.countryLabel,
        qid: row.company?.split('/').pop(),
      }));
      console.log(`  results: ${rows.length}`);
      for (const item of preview) {
        console.log(
          `    - ${item.name} (${item.qid}) ${item.industry ?? ''} ${item.website ?? ''}`,
        );
      }
      report.push({
        nl,
        ok: true,
        intent,
        resolved: { countryId, industryId, cityOrRegionId },
        resultCount: rows.length,
        preview,
      });
    } catch (error) {
      console.log(
        `  SPARQL failed: ${error instanceof Error ? error.message : error}`,
      );
      report.push({
        nl,
        ok: false,
        stage: 'sparql',
        intent,
        resolved: { countryId, industryId, cityOrRegionId },
        error: String(error),
        sparql,
      });
      await sleep(5000);
    }
  }

  const ok = report.filter((item) => item.ok).length;
  console.log(`\n==== SUMMARY ${ok}/${report.length} succeeded ====`);
  for (const item of report) {
    if (item.ok) {
      console.log(`✓ (${item.resultCount}) ${item.nl}`);
    } else {
      console.log(`✗ [${item.stage}] ${item.nl}`);
    }
  }

  // Write machine-readable report without secrets
  const outPath = '/tmp/wikidata-nl-eval-report.json';
  await import('node:fs/promises').then((fs) =>
    fs.writeFile(outPath, JSON.stringify(report, null, 2)),
  );
  console.log(`\nWrote ${outPath}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
