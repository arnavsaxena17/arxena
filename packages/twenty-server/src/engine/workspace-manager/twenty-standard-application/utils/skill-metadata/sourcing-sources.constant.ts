// One entry per sourcing provider. The sourcing skill's provider maps, source
// order, source profiles, learn_tools lists and limits are rendered from here
// (render-sourcing-sources.util.ts), so a fact about a source is written once.
// Strings may use {{fact: source-key.name}} to quote another entry's fact.

export type SourcingEntity = 'people' | 'companies';

// How much a stated limit can be trusted: measured or set in code, experience,
// or only an example to calibrate on
export type SourcingFactStanding =
  | 'firm'
  | 'heuristic'
  | 'illustrative'
  | 'unknown';

export type SourcingSourceUse = {
  // Rendered in the Tool(s) column, markdown allowed
  tools: string;
  bestFor: string;
  requires: string;
  // Added to the learn_tools list of the entity's section
  learnTools: string[];
  // The provider flag strips `<prefix>-provider-row` and
  // `<prefix>-learn-tools-line` (search-tools-config.ts). None means always on.
  markerPrefix?: string;
  // Name in the Source order table, linked to the source's section
  orderLabel?: string;
  section?: string;
};

export type SourcingSourceProfile = {
  name: string;
  strongFor: string;
  blindSpots: string;
  limit: { standing: SourcingFactStanding; text: string };
};

export type SourcingSource = {
  key: string;
  label: string;
  // Position in the Source order table; none means not in the order
  rank?: number;
  facts?: Readonly<Record<string, string>>;
  // Rendered by {{sources: limits <key>}} as "Limits and exhaustion"
  limits?: string;
  people?: SourcingSourceUse;
  companies?: SourcingSourceUse;
  profile?: SourcingSourceProfile;
};

// Learned last by each entity, so a stripped line never leaves a trailing comma
export const SOURCING_ALWAYS_LEARNED_TOOLS: Readonly<
  Record<SourcingEntity, readonly string[]>
> = {
  people: ['get_outreach_tab'],
  companies: ['get_outreach_tab'],
};

export const SOURCING_SOURCES: readonly SourcingSource[] = [
  {
    key: 'bright-data',
    label: 'Bright Data',
    rank: 1,
    facts: {
      costPerRecord: '$0.002',
      queryCap: '$10',
      maxRows: '1,100',
    },
    limits:
      'One query returns at most {{fact: bright-data.maxRows}} rows (`limit` up to 100, `offset` up to 1,000). The planner splits a request into slices to get past that; the estimate shows `fetchableRecords` per slice, and a slice with none left is exhausted. Billing is {{fact: bright-data.costPerRecord}} per returned record and a primary query is capped at {{fact: bright-data.queryCap}}. Running the same query again returns only rows already in the list: more rows need different title words, cities or size bands.',
    people: {
      tools: '`search_bright_data_business` (`entity: "people"`)',
      bestFor:
        'People sets described by title, employer, industry, skills or location ("MD or CEO of QSR restaurants in India"), ludicrous, budgeted at {{fact: bright-data.costPerRecord}}/record. Not for one person by LinkedIn URL or name (use `fetch_profiles`)',
      requires: '`BRIGHT_DATA_API_KEY` set',
      learnTools: ['search_bright_data_business'],
      markerPrefix: 'search-bright-data-people',
      orderLabel: 'Bright Data people',
      section: 'src-bright-data-people',
    },
    companies: {
      tools: '`search_bright_data_business` (`entity: "company"`)',
      bestFor:
        'Company sets described by industry, location, size or funding (ludicrous, {{fact: bright-data.costPerRecord}}/record); **or** one company by website with `mode: "instant"` and a bare host (`stripe.com`). Not a company LinkedIn URL',
      requires: '`BRIGHT_DATA_API_KEY` set',
      learnTools: ['search_bright_data_business'],
      markerPrefix: 'search-bright-data-companies',
      orderLabel: 'Bright Data companies',
      section: 'src-bright-data-companies',
    },
    profile: {
      name: 'Bright Data people / companies',
      strongFor: 'Default for populations and company lists',
      blindSpots: 'Staleness differs by field; see below',
      limit: {
        standing: 'firm',
        text: '{{fact: bright-data.maxRows}} rows per query, {{fact: bright-data.costPerRecord}} per record, {{fact: bright-data.queryCap}} cap per primary query',
      },
    },
  },
  {
    key: 'serp',
    label: 'Google SERP',
    rank: 2,
    people: {
      tools: '`google_serp_search`',
      bestFor:
        'A company name plus designation ("plant head Clariant Chemicals"); names and snippets, often without a LinkedIn URL',
      requires: 'Google SERP enabled (server config)',
      learnTools: ['google_serp_search'],
      markerPrefix: 'search-serp-people',
      orderLabel: 'Google SERP people results',
      section: 'src-serp',
    },
    companies: {
      tools: '`google_serp_search`',
      bestFor:
        "A company's LinkedIn page, to find its LinkedIn URL; confirm the name matches",
      requires: 'Google SERP enabled (server config)',
      learnTools: ['google_serp_search'],
      markerPrefix: 'search-serp-companies',
      orderLabel: 'Google SERP',
      section: 'src-serp',
    },
    profile: {
      name: 'Google SERP',
      strongFor: 'Company plus designation handles',
      blindSpots: 'Snippets only, often no LinkedIn URL',
      limit: { standing: 'heuristic', text: 'cap unknown, same stop rule' },
    },
  },
  {
    key: 'linkedin',
    label: 'LinkedIn / Unipile',
    rank: 3,
    people: {
      tools: '`search_linkedin_people`',
      bestFor: 'Live LinkedIn people (classic / Sales Nav / Recruiter)',
      requires: 'Connected LinkedIn Unipile account',
      learnTools: ['search_linkedin_people'],
      orderLabel: 'LinkedIn via Unipile',
      section: 'src-linkedin',
    },
    companies: {
      tools: '`search_linkedin_companies`',
      bestFor:
        'Live LinkedIn company results; `has_job_offers`, geo/industry facets',
      requires: 'Connected LinkedIn Unipile account',
      learnTools: [
        'search_linkedin_companies',
        'search_linkedin_parameters',
        'generate_linkedin_query_set',
      ],
      orderLabel: 'LinkedIn via Unipile',
      section: 'src-linkedin',
    },
    profile: {
      name: 'LinkedIn (Unipile)',
      strongFor: 'Named lists, Sales Nav facets, pasted URLs',
      blindSpots: 'Account is rate-limited',
      limit: { standing: 'firm', text: '1,000 results per search, free' },
    },
  },
  {
    key: 'harvest',
    label: 'Harvest',
    rank: 4,
    people: {
      tools: '`search_harvest_leads`',
      bestFor: 'Sales Navigator people filters without a seat; paid',
      requires: 'Harvest configured',
      learnTools: [],
      orderLabel: 'Harvest',
      section: 'src-harvest',
    },
    companies: {
      tools: '`search_harvest_accounts`',
      bestFor:
        'Sales Navigator company filters: headcount, growth, revenue, hiring; paid',
      requires: 'Harvest configured',
      learnTools: [],
      orderLabel: 'Harvest',
      section: 'src-harvest',
    },
    profile: {
      name: 'Harvest',
      strongFor: 'Sales Navigator filters without a LinkedIn seat',
      blindSpots: '$0.004 per record; no lead or account lists',
      limit: { standing: 'firm', text: '2,500 per search (100 pages of 25)' },
    },
  },
  {
    key: 'apollo',
    label: 'Apollo',
    rank: 5,
    people: {
      tools: '`search_apollo_people`',
      bestFor:
        'Firmographic people search: title, company, headcount, location, keywords; emails/phones',
      requires: 'Apollo connected (server config)',
      learnTools: ['search_apollo_people'],
      markerPrefix: 'search-apollo-people',
      orderLabel: 'Apollo',
      section: 'src-apollo',
    },
    companies: {
      tools: '`search_apollo_companies`',
      bestFor:
        'Firmographic company search: industry, headcount, location, keywords; richest company metadata',
      requires: 'Apollo connected (server config)',
      learnTools: ['search_apollo_companies'],
      markerPrefix: 'search-apollo-companies',
      orderLabel: 'Apollo',
      section: 'src-apollo',
    },
    profile: {
      name: 'Apollo',
      strongFor: 'Firmographic search with contact data',
      blindSpots: 'Contact data is contact enrichment, not sourcing',
      limit: { standing: 'heuristic', text: 'cap unknown, same stop rule' },
    },
  },
  {
    key: 'exa',
    label: 'Exa',
    people: {
      tools: '`exa_web_search`',
      bestFor: 'Web/AI search for hard-to-find people; `category: "people"`',
      requires: '`EXA_API_KEY` set',
      learnTools: ['exa_web_search'],
      markerPrefix: 'search-exa-people',
    },
    companies: {
      tools: '`app_exa_web_search` (preloaded) or `exa_web_search`',
      bestFor:
        'Web/AI search for hard-to-find or new companies; `category: "company"`',
      requires: '`EXA_API_KEY` set',
      learnTools: ['exa_web_search'],
      markerPrefix: 'search-exa-companies',
    },
    profile: {
      name: 'Exa',
      strongFor: 'Niche public people, speakers, authors, new companies',
      blindSpots: 'Title, URL and snippet only',
      limit: { standing: 'heuristic', text: 'cap unknown' },
    },
  },
  {
    key: 'wikidata',
    label: 'Wikidata',
    companies: {
      tools: '`search_wikidata_companies`',
      bestFor:
        'Fallback facts for a known domain/URL when Bright Data instant domain lookup returns nothing (HQ, industry, employees, CEO)',
      requires: 'Public Wikidata API (no key)',
      learnTools: ['search_wikidata_companies'],
      markerPrefix: 'search-wikidata-companies',
    },
    profile: {
      name: 'Wikidata',
      strongFor: 'Firmographics for a known domain',
      blindSpots: 'Not a crawler',
      limit: { standing: 'firm', text: 'free, no key' },
    },
  },
  {
    key: 'internal-index',
    label: 'Internal index',
    people: {
      tools: '`search_people_index`',
      bestFor: 'Dedupe against people already in the workspace',
      requires: 'Elasticsearch index',
      learnTools: ['search_people_index'],
      markerPrefix: 'search-people-index',
    },
    companies: {
      tools: '`search_companies_index`',
      bestFor: 'Free-text company search across ES indices',
      requires: 'Elasticsearch index',
      learnTools: ['search_companies_index'],
      markerPrefix: 'search-companies-index',
    },
  },
  {
    key: 'google-maps',
    label: 'Google Maps',
    facts: {
      costPerThousand: '$1.50',
      costPerRecord: '$0.0015',
    },
    companies: {
      tools:
        '`plan-local-business-city-coverage`, `fetch-and-upsert-local-businesses`',
      bestFor:
        'Outlets you can walk into across a city (hotels, restaurants, clinics, stores); Bright Data Google Maps, about {{fact: google-maps.costPerThousand}} per 1,000 records. Load `places`',
      requires: '`BRIGHT_DATA_API_KEY` set',
      learnTools: [],
    },
  },
  {
    key: 'raw-name-resolver',
    label: 'Raw → std name',
    companies: {
      tools: '`resolve_company_from_raw_name`',
      bestFor:
        'Standardize a messy employer string to one best company profile (`std_company_data_scores`)',
      requires: 'Elasticsearch (`ES_ENDPOINT`)',
      learnTools: ['resolve_company_from_raw_name'],
    },
  },
  {
    key: 'naukri',
    label: 'Naukri',
    profile: {
      name: 'Naukri',
      strongFor: 'Mid-level and plant-level roles',
      blindSpots: 'Only what the extension has read',
      limit: {
        standing: 'unknown',
        text: 'compare with LinkedIn on a probe, report the share',
      },
    },
  },
];
