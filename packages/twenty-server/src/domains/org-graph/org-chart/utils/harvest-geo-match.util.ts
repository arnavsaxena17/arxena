type HarvestGeoElement = { geoId?: unknown; title?: unknown };

export type HarvestGeoMatch = {
  geoIds: string[];
  titles: string[];
  matchedVia: 'metro' | 'exact' | 'superset' | 'none';
};

const METRO_TITLE_PATTERN =
  /metropolitan (area|region)|\barea\b|^greater\b|\bregion\b/i;

export const normalizeGeoLabel = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const toTokens = (value: string): Set<string> =>
  new Set(normalizeGeoLabel(value).split(' ').filter(Boolean));

const containsAllTokens = (title: string, tokens: Set<string>): boolean => {
  const titleTokens = toTokens(title);

  for (const token of tokens) {
    if (!titleTokens.has(token)) {
      return false;
    }
  }

  return true;
};

const readElements = (elements: unknown): HarvestGeoElement[] =>
  Array.isArray(elements)
    ? elements.filter(
        (element): element is HarvestGeoElement =>
          typeof element === 'object' && element !== null,
      )
    : [];

const toCandidate = (
  element: HarvestGeoElement,
): { geoId: string; title: string } | null => {
  const geoId =
    typeof element.geoId === 'string' || typeof element.geoId === 'number'
      ? String(element.geoId).trim()
      : '';
  const title = typeof element.title === 'string' ? element.title.trim() : '';

  return geoId && title ? { geoId, title } : null;
};

// Harvest exposes LinkedIn's own geo tree, where a city also has a wider
// "… Area" / "Greater …" / "… Metropolitan Region" node that contains it. The
// wider node is the more inclusive filter, and it is what LinkedIn's own
// suggestion box offers for a bare city name, so it wins over the exact city
// when the caller named a city without qualifying it. A qualified location
// ("Mumbai, Maharashtra, India") keeps its exact node: the metro title does not
// carry those qualifiers, so the token test below rejects it.
export const pickHarvestGeoMatch = (
  elements: unknown,
  location: string,
): HarvestGeoMatch => {
  const normalizedLocation = normalizeGeoLabel(location);

  if (!normalizedLocation) {
    return { geoIds: [], titles: [], matchedVia: 'none' };
  }

  const candidates = readElements(elements)
    .map(toCandidate)
    .filter(
      (candidate): candidate is { geoId: string; title: string } =>
        candidate !== null,
    );

  const locationTokens = toTokens(location);
  const metro = candidates.find(
    (candidate) =>
      METRO_TITLE_PATTERN.test(candidate.title) &&
      containsAllTokens(candidate.title, locationTokens),
  );

  if (metro) {
    return {
      geoIds: [metro.geoId],
      titles: [metro.title],
      matchedVia: 'metro',
    };
  }

  const exact = candidates.filter(
    (candidate) => normalizeGeoLabel(candidate.title) === normalizedLocation,
  );

  if (exact.length > 0) {
    return {
      geoIds: [...new Set(exact.map((candidate) => candidate.geoId))],
      titles: exact.map((candidate) => candidate.title),
      matchedVia: 'exact',
    };
  }

  const superset = candidates.find((candidate) =>
    containsAllTokens(candidate.title, locationTokens),
  );

  if (superset) {
    return {
      geoIds: [superset.geoId],
      titles: [superset.title],
      matchedVia: 'superset',
    };
  }

  return { geoIds: [], titles: [], matchedVia: 'none' };
};
