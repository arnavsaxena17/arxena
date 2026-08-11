export const WIKIDATA_API_BASE_URL = 'https://www.wikidata.org/w/api.php';

export const WIKIDATA_USER_AGENT =
  'ArxenaWikidataCompanySearch/1.0 (https://arxena.com; company-enrichment)';

export const WIKIDATA_REQUEST_TIMEOUT_MS = 30_000;

// Company / business taxonomy roots used for ranking
export const WIKIDATA_COMPANY_INSTANCE_IDS = new Set([
  'Q783794', // company
  'Q4830453', // business
  'Q891723', // publicly traded company
  'Q6881511', // enterprise
  'Q167037', // corporation
  'Q43229', // organization
]);

export const WIKIDATA_PUBLIC_COMPANY_ID = 'Q891723';

// Claim properties used for company profiles
export const WIKIDATA_PROPERTY = {
  INSTANCE_OF: 'P31',
  OFFICIAL_WEBSITE: 'P856',
  HEADQUARTERS: 'P159',
  COUNTRY: 'P17',
  INCEPTION: 'P571',
  EMPLOYEES: 'P1128',
  INDUSTRY: 'P452',
  CEO: 'P169',
  CHAIRPERSON: 'P488',
  OFFICIAL_NAME: 'P1448',
  STOCK_EXCHANGE: 'P414',
  TICKER_SYMBOL: 'P249',
  LEGAL_FORM: 'P1454',
  OWNED_BY: 'P127',
  PARENT_ORGANIZATION: 'P749',
} as const;
