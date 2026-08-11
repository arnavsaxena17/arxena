import {
  WIKIDATA_COMPANY_INSTANCE_IDS,
  WIKIDATA_PROPERTY,
  WIKIDATA_PUBLIC_COMPANY_ID,
} from 'src/engine/core-modules/wikidata/constants/wikidata.constants';
import {
  type WikidataCompanyProfile,
  type WikidataEntity,
  type WikidataEntityClaim,
  type WikidataEntityClaimSnak,
} from 'src/engine/core-modules/wikidata/types/wikidata-company.types';
import {
  extractHostFromWebsiteUrl,
  normalizeCompanyDomain,
} from 'src/engine/core-modules/wikidata/utils/wikidata-domain.util';

const readSnakValue = (
  snak: WikidataEntityClaimSnak | undefined,
): string | number | null => {
  const value = snak?.datavalue?.value;

  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  if (typeof value.id === 'string') {
    return value.id;
  }

  if (typeof value.text === 'string') {
    return value.text;
  }

  if (typeof value.time === 'string') {
    return value.time;
  }

  if (typeof value.amount === 'string') {
    const amount = Number(value.amount);

    return Number.isFinite(amount) ? amount : value.amount;
  }

  return null;
};

export const getClaimValues = (
  entity: WikidataEntity,
  propertyId: string,
): Array<string | number> => {
  const claims = entity.claims?.[propertyId] ?? [];

  return claims
    .map((claim) => readSnakValue(claim.mainsnak))
    .filter((value): value is string | number => value !== null);
};

export const getClaimEntityIds = (
  entity: WikidataEntity,
  propertyId: string,
): string[] =>
  getClaimValues(entity, propertyId).filter(
    (value): value is string =>
      typeof value === 'string' && /^Q\d+$/.test(value),
  );

export const collectReferencedEntityIds = (
  entity: WikidataEntity,
): string[] => {
  const propertyIds = [
    WIKIDATA_PROPERTY.INSTANCE_OF,
    WIKIDATA_PROPERTY.HEADQUARTERS,
    WIKIDATA_PROPERTY.COUNTRY,
    WIKIDATA_PROPERTY.INDUSTRY,
    WIKIDATA_PROPERTY.CEO,
    WIKIDATA_PROPERTY.CHAIRPERSON,
    WIKIDATA_PROPERTY.STOCK_EXCHANGE,
    WIKIDATA_PROPERTY.LEGAL_FORM,
    WIKIDATA_PROPERTY.OWNED_BY,
    WIKIDATA_PROPERTY.PARENT_ORGANIZATION,
  ];

  const entityIds = propertyIds.flatMap((propertyId) =>
    getClaimEntityIds(entity, propertyId),
  );

  // HQ place → country is often only on the place entity; still collect HQ id
  // Ticker is usually a qualifier on P414
  const exchangeClaims = entity.claims?.[WIKIDATA_PROPERTY.STOCK_EXCHANGE] ?? [];

  for (const claim of exchangeClaims) {
    const tickerSnaks = claim.qualifiers?.[WIKIDATA_PROPERTY.TICKER_SYMBOL] ?? [];

    for (const snak of tickerSnaks) {
      const value = readSnakValue(snak);

      if (typeof value === 'string' && /^Q\d+$/.test(value)) {
        entityIds.push(value);
      }
    }
  }

  return [...new Set(entityIds)];
};

const parseInception = (
  raw: string | number | null,
): { foundedYear: number | null; inceptionDate: string | null } => {
  if (typeof raw !== 'string') {
    return { foundedYear: null, inceptionDate: null };
  }

  // Wikidata time: +1995-01-01T00:00:00Z
  const match = raw.match(/^\+?(-?\d{1,6})-(\d{2})-(\d{2})/);

  if (!match) {
    return { foundedYear: null, inceptionDate: null };
  }

  const year = Number(match[1]);
  const month = match[2];
  const day = match[3];

  return {
    foundedYear: Number.isFinite(year) ? year : null,
    inceptionDate: `${match[1]}-${month}-${day}`,
  };
};

const resolveLabel = (
  entityId: string | null | undefined,
  labelById: Map<string, string>,
): string | null => {
  if (!entityId) {
    return null;
  }

  return labelById.get(entityId) ?? null;
};

const getFirstStringClaim = (
  entity: WikidataEntity,
  propertyId: string,
): string | null => {
  const value = getClaimValues(entity, propertyId)[0];

  return typeof value === 'string' ? value : null;
};

const getFirstNumberClaim = (
  entity: WikidataEntity,
  propertyId: string,
): number | null => {
  const value = getClaimValues(entity, propertyId)[0];

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const getStockListing = (
  entity: WikidataEntity,
  labelById: Map<string, string>,
): { exchange: string | null; tickerSymbol: string | null } | null => {
  const exchangeClaims =
    entity.claims?.[WIKIDATA_PROPERTY.STOCK_EXCHANGE] ?? [];

  if (exchangeClaims.length === 0) {
    // Standalone P249 ticker (rare)
    const tickerOnly = getFirstStringClaim(
      entity,
      WIKIDATA_PROPERTY.TICKER_SYMBOL,
    );

    if (!tickerOnly) {
      return null;
    }

    return { exchange: null, tickerSymbol: tickerOnly };
  }

  const firstClaim: WikidataEntityClaim = exchangeClaims[0];
  const exchangeId = readSnakValue(firstClaim.mainsnak);
  const exchange =
    typeof exchangeId === 'string'
      ? resolveLabel(exchangeId, labelById)
      : null;

  const tickerSnak =
    firstClaim.qualifiers?.[WIKIDATA_PROPERTY.TICKER_SYMBOL]?.[0];
  const tickerValue = readSnakValue(tickerSnak);
  const tickerSymbol =
    typeof tickerValue === 'string'
      ? tickerValue
      : getFirstStringClaim(entity, WIKIDATA_PROPERTY.TICKER_SYMBOL);

  if (!exchange && !tickerSymbol) {
    return null;
  }

  return { exchange, tickerSymbol };
};

export const scoreWikidataCompanyCandidate = ({
  entity,
  queryDomain,
}: {
  entity: WikidataEntity;
  queryDomain: string;
  labelById?: Map<string, string>;
}): { score: number; reason: string } => {
  const reasons: string[] = [];
  let score = 0;

  const websites = getClaimValues(entity, WIKIDATA_PROPERTY.OFFICIAL_WEBSITE)
    .filter((value): value is string => typeof value === 'string')
    .map((website) => extractHostFromWebsiteUrl(website))
    .filter((host): host is string => host !== null);

  const normalizedQuery = normalizeCompanyDomain(queryDomain) ?? queryDomain;

  if (websites.some((host) => host === normalizedQuery)) {
    score += 50;
    reasons.push('official website host matches domain');
  }

  const instanceIds = getClaimEntityIds(entity, WIKIDATA_PROPERTY.INSTANCE_OF);

  if (instanceIds.includes(WIKIDATA_PUBLIC_COMPANY_ID)) {
    score += 20;
    reasons.push('publicly traded company');
  }

  if (instanceIds.some((id) => WIKIDATA_COMPANY_INSTANCE_IDS.has(id))) {
    score += 10;
    reasons.push('instance of company/business');
  }

  if (getClaimEntityIds(entity, WIKIDATA_PROPERTY.HEADQUARTERS).length > 0) {
    score += 5;
    reasons.push('has headquarters');
  }

  if (getFirstNumberClaim(entity, WIKIDATA_PROPERTY.EMPLOYEES) !== null) {
    score += 5;
    reasons.push('has employee count');
  }

  if (getClaimEntityIds(entity, WIKIDATA_PROPERTY.STOCK_EXCHANGE).length > 0) {
    score += 8;
    reasons.push('has stock exchange listing');
  }

  // Prefer parent over owned subsidiary when both share the same website
  if (getClaimEntityIds(entity, WIKIDATA_PROPERTY.PARENT_ORGANIZATION).length > 0) {
    score -= 15;
    reasons.push('has parent organization (likely subsidiary)');
  }

  const label = entity.labels?.en?.value ?? '';

  if (!label) {
    score -= 25;
    reasons.push('missing English label');
  }

  if (/\((japan|united states|united kingdom|india|china|germany)\)/i.test(label)) {
    score -= 10;
    reasons.push('localized subsidiary label');
  }

  // Prefer richer English description / Wikipedia sitelink
  if (entity.descriptions?.en?.value) {
    score += 2;
  }

  if (entity.sitelinks?.enwiki?.title) {
    score += 5;
    reasons.push('has English Wikipedia article');
  }

  return {
    score,
    reason: reasons.length > 0 ? reasons.join('; ') : 'weak match',
  };
};

export const mapWikidataEntityToCompanyProfile = ({
  entity,
  queryDomain,
  labelById,
}: {
  entity: WikidataEntity;
  queryDomain: string;
  labelById: Map<string, string>;
}): WikidataCompanyProfile => {
  const companyName = entity.labels?.en?.value ?? entity.id;
  const description = entity.descriptions?.en?.value ?? null;
  const website = getFirstStringClaim(
    entity,
    WIKIDATA_PROPERTY.OFFICIAL_WEBSITE,
  );
  const legalName =
    getFirstStringClaim(entity, WIKIDATA_PROPERTY.OFFICIAL_NAME) ?? null;

  const industryIds = getClaimEntityIds(entity, WIKIDATA_PROPERTY.INDUSTRY);
  const industries = industryIds
    .map((id) => resolveLabel(id, labelById))
    .filter((label): label is string => label !== null);

  const hqId = getClaimEntityIds(entity, WIKIDATA_PROPERTY.HEADQUARTERS)[0];
  const countryFromEntity = getClaimEntityIds(
    entity,
    WIKIDATA_PROPERTY.COUNTRY,
  )[0];
  const countryLabel =
    resolveLabel(countryFromEntity, labelById) ??
    // Country is often only on the HQ place; caller may have pre-resolved place→country
    null;

  const hqLabel = resolveLabel(hqId, labelById);
  const headquarters =
    hqLabel || countryLabel
      ? {
          city: hqLabel,
          stateOrRegion: null,
          country: countryLabel,
          label: [hqLabel, countryLabel].filter(Boolean).join(', ') || null,
        }
      : null;

  const { foundedYear, inceptionDate } = parseInception(
    getClaimValues(entity, WIKIDATA_PROPERTY.INCEPTION)[0] ?? null,
  );

  const entityTypeIds = getClaimEntityIds(
    entity,
    WIKIDATA_PROPERTY.INSTANCE_OF,
  );
  const entityTypes = entityTypeIds
    .map((id) => resolveLabel(id, labelById))
    .filter((label): label is string => label !== null);

  const { score, reason } = scoreWikidataCompanyCandidate({
    entity,
    queryDomain,
  });

  const stockListing = getStockListing(entity, labelById);
  const wikipediaTitle = entity.sitelinks?.enwiki?.title ?? null;

  return {
    wikidataId: entity.id,
    companyDomain:
      normalizeCompanyDomain(website ?? queryDomain) ?? queryDomain,
    companyName,
    legalName,
    website,
    description,
    industry: industries[0] ?? null,
    industries,
    foundedYear,
    inceptionDate,
    headquarters,
    employeeCount: getFirstNumberClaim(entity, WIKIDATA_PROPERTY.EMPLOYEES),
    keyExecutives: {
      ceo: resolveLabel(
        getClaimEntityIds(entity, WIKIDATA_PROPERTY.CEO)[0],
        labelById,
      ),
      chairmanOfTheBoard: resolveLabel(
        getClaimEntityIds(entity, WIKIDATA_PROPERTY.CHAIRPERSON)[0],
        labelById,
      ),
    },
    stockListing,
    legalForm: resolveLabel(
      getClaimEntityIds(entity, WIKIDATA_PROPERTY.LEGAL_FORM)[0],
      labelById,
    ),
    entityTypes,
    country: countryLabel,
    dataSources: {
      wikidata: entity.id,
      wikipedia: wikipediaTitle,
    },
    matchScore: score,
    matchReason: reason,
  };
};
