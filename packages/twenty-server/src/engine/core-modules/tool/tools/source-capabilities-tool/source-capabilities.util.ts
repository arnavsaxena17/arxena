import {
  CAPABILITY_PROXIES,
  LINKEDIN_HEADCOUNT_BANDS,
  SOURCE_CAPABILITIES,
  SOURCE_HANDOFFS,
  type CapabilityField,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/sourcing-source-capabilities.constant';
import { getSkillFragment } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/skill-library';

export type CapabilitiesEntity = 'company' | 'person';

export type CapabilityQuestion = {
  header: string;
  question: string;
  options: string[];
  allowMultiSelect: boolean;
  allowFreeText: boolean;
  freeTextHint: string;
};

export type SourceCapabilitiesResult = {
  sources: Array<{ key: string; label: string; entity: CapabilitiesEntity }>;
  // Field -> which picked sources can filter on it
  searchable: Array<{
    field: string;
    label: string;
    kind: CapabilityField['kind'];
    values?: string[];
    unit?: string;
    sources: string[];
  }>;
  // A wanted field no picked source has, with the stand-in to ask about instead
  notSearchable: Array<{
    field: string;
    why: string;
    nearest?: string;
    upgrade?: string;
  }>;
  returns: Array<{ source: string; fields: string[] }>;
  handoff: Array<{
    from: string;
    field: string;
    to: string;
    toField: string;
    note: string;
  }>;
  questions: CapabilityQuestion[];
};

const SOURCE_LABELS: Readonly<Record<string, string>> = {
  'bright-data': 'Bright Data',
  serp: 'Google search',
  linkedin: 'LinkedIn (your account)',
  harvest: 'Harvest',
  'internal-index': 'Arxena index',
  'google-maps': 'Google Maps',
  naukri: 'Naukri',
  apollo: 'Apollo',
  exa: 'Exa',
  wikidata: 'Wikidata',
};

const sourceLabel = (key: string): string => SOURCE_LABELS[key] ?? key;

const unique = <TValue>(values: TValue[]): TValue[] => [...new Set(values)];

// "₹500-800 Cr", "500 crore", "$1.2bn", "5,000 employees" -> the numbers, so a
// question can offer the bands the user's own words touch
export const parseRangeHint = (
  text: string,
):
  | { min?: number; max?: number; unit?: 'usd-millions' | 'inr-crore' }
  | undefined => {
  const normalized = text.toLowerCase().replace(/,/g, '');
  const numbers = [...normalized.matchAll(/(\d+(?:\.\d+)?)/g)].map((match) =>
    Number(match[1]),
  );

  if (numbers.length === 0) {
    return undefined;
  }

  const isCrore = /crore|\bcr\b/.test(normalized);
  const isUsdMillions = /\$|usd|million|\bmn\b/.test(normalized);

  return {
    min: Math.min(...numbers),
    max: Math.max(...numbers),
    ...(isCrore && { unit: 'inr-crore' as const }),
    ...(!isCrore && isUsdMillions && { unit: 'usd-millions' as const }),
  };
};

// The employee bands a headcount question should offer: the standard LinkedIn
// bands, or the ones a revenue hint maps near (revenue is not headcount, so this
// is only a starting point for the user to correct)
const headcountQuestion = (): CapabilityQuestion => ({
  header: 'Company size',
  question:
    'Which employee-count bands should I search on? (If you gave revenue instead, say it in the note: revenue is checked after the pull unless Harvest or your LinkedIn is picked.)',
  options: LINKEDIN_HEADCOUNT_BANDS.slice(0, 7),
  allowMultiSelect: true,
  allowFreeText: true,
  freeTextHint: 'e.g. "200-800 employees, ₹500-800 Cr revenue, Pune"',
});

const revenueQuestion = (): CapabilityQuestion => ({
  header: 'Revenue',
  question:
    'What annual revenue range should I filter on? Sales Navigator filters on it; Bright Data and Google only report it after a lookup.',
  options: ['Under ₹100 Cr', '₹100-500 Cr', '₹500-1000 Cr', '₹1000 Cr+'],
  allowMultiSelect: false,
  allowFreeText: true,
  freeTextHint: 'e.g. "₹700-900 Cr, FY25"',
});

const locationQuestion = (entity: CapabilitiesEntity): CapabilityQuestion => ({
  header: 'Location',
  question:
    entity === 'company'
      ? 'Where should the companies be headquartered?'
      : 'Where should the people be based?',
  options:
    entity === 'company'
      ? ['One city', 'One state or region', 'India-wide']
      : ['Same city as the company', 'India-wide', 'Anywhere'],
  allowMultiSelect: false,
  allowFreeText: true,
  freeTextHint: 'e.g. "Pune and Chakan", "Gujarat", "Bangalore metro"',
});

// The industry table is the single source of the labels; this reads it rather
// than keeping a second copy that drifts. The table packs a sector's sub-groups
// into one cell ("**Glass, Ceramics and Concrete**. **Chemical**: ..."), so the
// cell is split on sentence endings, then each "Group: labels" chunk is split
// on ";" or ", " with the Oxford comma kept inside one label.
const parseIndustryLabels = (): Array<{ sector: string; label: string }> => {
  let fragment = '';

  try {
    fragment = getSkillFragment('linkedin-industries');
  } catch {
    return [];
  }

  const labels: Array<{ sector: string; label: string }> = [];
  const seen = new Set<string>();
  const addLabel = (sector: string, raw: string): void => {
    const part = raw
      .replace(/^Also:\s*/i, '')
      .replace(/\*\*/g, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/\.$/, '')
      .trim();

    if (part.length < 3 || /^sub-groups/i.test(part)) {
      return;
    }

    const withSuffix =
      sector === 'Manufacturing' && !/manufacturing$/i.test(part)
        ? `${part} Manufacturing`
        : sector === 'Wholesale' && !/^wholesale\s/i.test(part)
          ? `Wholesale ${part}`
          : part;
    const key = `${sector}|${withSuffix.toLowerCase()}`;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    labels.push({ sector, label: withSuffix });
  };
  // A sub-group's labels are separated by ";" (distinct labels) or ", "
  // (a list). An Oxford comma list is one label: "Paint, Coating, and
  // Adhesive" ends in "and Adhesive". A comma inside a label ("Artificial
  // Rubber and Synthetic Fiber") does not make the whole list one label.
  const splitLabels = (raw: string): string[] => {
    const value = raw.trim();

    if (value === '') {
      return [];
    }

    if (value.includes(';')) {
      return value
        .split(';')
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
    }

    const parts = value
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    if (parts.length > 1 && /^and\s+/i.test(parts[parts.length - 1])) {
      return [value];
    }

    return parts;
  };

  for (const line of fragment.split('\n')) {
    if (!line.startsWith('| ') || line.includes('---')) {
      continue;
    }

    const cells = line
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0);

    if (cells.length < 2 || cells[0] === 'Sector') {
      continue;
    }

    const sector = cells[0];
    const body = cells.slice(1).join(' ').replace(/\*\*/g, '');

    // The table uses ". " between sub-groups; a label itself has no period.
    for (const segment of body.split(/\.\s+/)) {
      const part = segment.trim().replace(/^Also:\s*/i, '');

      if (part === '') {
        continue;
      }

      const colon = part.indexOf(':');

      if (colon === -1) {
        // No sub-group heading: the whole segment is one label, even with a
        // comma ("Glass, Ceramics and Concrete"). Only ";" lists several.
        for (const label of part.includes(';') ? part.split(';') : [part]) {
          addLabel(sector, label);
        }
        continue;
      }

      addLabel(sector, part.slice(0, colon));

      for (const label of splitLabels(part.slice(colon + 1))) {
        addLabel(sector, label);
      }
    }
  }

  return labels;
};

// Words a user says that are not the label itself but name the same segment.
const INDUSTRY_ALIASES: Record<string, string> = {
  cement: 'Glass, Ceramics and Concrete Manufacturing',
  ceramics: 'Glass, Ceramics and Concrete Manufacturing',
  glass: 'Glass, Ceramics and Concrete Manufacturing',
  steel: 'Primary Metal Manufacturing',
  aluminium: 'Primary Metal Manufacturing',
  aluminum: 'Primary Metal Manufacturing',
  plastic: 'Plastics and Rubber Products Manufacturing',
  plastics: 'Plastics and Rubber Products Manufacturing',
  pharma: 'Pharmaceutical Manufacturing',
  pharmaceutical: 'Pharmaceutical Manufacturing',
  auto: 'Motor Vehicle Parts Manufacturing',
  automotive: 'Motor Vehicle Manufacturing',
  packaging: 'Packaging and Containers Manufacturing',
  textile: 'Textile Manufacturing',
  apparel: 'Apparel Manufacturing',
};

let industryLabelCache: Array<{ sector: string; label: string }> | undefined;

export const matchIndustryLabels = (
  term: string,
  limit = 8,
): Array<{ sector: string; label: string }> => {
  industryLabelCache ??= parseIndustryLabels();

  const wanted = term.trim().toLowerCase();

  if (wanted === '') {
    return [];
  }

  const tokens = wanted
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3);
  const scored = industryLabelCache
    .map((entry) => {
      const sector = entry.sector.toLowerCase();
      const label = entry.label.toLowerCase();
      let score = 0;

      if (label === wanted) {
        score += 10;
      }
      if (label.includes(wanted)) {
        score += 6;
      }
      if (sector.includes(wanted)) {
        score += 5;
      }
      for (const token of tokens) {
        if (label.includes(token)) {
          score += 2;
        }
        if (sector.includes(token)) {
          score += 1;
        }
      }

      return { ...entry, score };
    })
    .filter((entry) => entry.score > 0)
    .sort(
      (first, second) =>
        second.score - first.score || first.label.localeCompare(second.label),
    );

  if (scored.length === 0) {
    const aliased = [
      ...new Set(
        tokens
          .map((token) => INDUSTRY_ALIASES[token])
          .filter((label): label is string => label !== undefined),
      ),
    ];

    return aliased.slice(0, limit).map((label) => ({
      sector: label.endsWith(' Manufacturing') ? 'Manufacturing' : 'Other',
      label,
    }));
  }

  return scored.slice(0, limit).map(({ sector, label }) => ({ sector, label }));
};

const industryQuestion = (term: string | undefined): CapabilityQuestion => {
  const matches = term === undefined ? [] : matchIndustryLabels(term);
  const options =
    matches.length > 0
      ? matches.map((entry) => entry.label).slice(0, 4)
      : [
          'Manufacturing',
          'Financial Services',
          'Retail',
          'Technology, Information and Media',
        ];

  return {
    header: 'Industry',
    question:
      matches.length > 0
        ? `"${term}" maps to several LinkedIn labels. Which exactly should I search?`
        : 'Which LinkedIn industry labels should I search? A company picks one label itself, so a segment is spread over several.',
    options,
    allowMultiSelect: true,
    allowFreeText: true,
    freeTextHint: 'Type any other label, or describe the segment in your words',
  };
};

export const buildSourceCapabilities = ({
  sources,
  entity,
  want = [],
  term,
}: {
  sources?: string[];
  entity?: CapabilitiesEntity;
  want?: string[];
  term?: string;
}): SourceCapabilitiesResult => {
  const wantedSources =
    sources !== undefined && sources.length > 0
      ? unique(sources)
      : unique(SOURCE_CAPABILITIES.map((capability) => capability.key));
  const entities: CapabilitiesEntity[] =
    entity === undefined ? ['company', 'person'] : [entity];
  const picked = SOURCE_CAPABILITIES.filter(
    (capability) =>
      wantedSources.includes(capability.key) &&
      entities.includes(capability.entity),
  );

  // Field -> sources that have it, across everything picked
  const byField = new Map<
    string,
    {
      field: string;
      label: string;
      kind: CapabilityField['kind'];
      values?: string[];
      unit?: string;
      sources: string[];
    }
  >();

  for (const capability of picked) {
    for (const field of capability.searchable) {
      const existing = byField.get(field.field);

      if (existing === undefined) {
        byField.set(field.field, {
          field: field.field,
          label: field.label,
          kind: field.kind,
          ...(field.values !== undefined && { values: field.values }),
          ...(field.unit !== undefined && { unit: field.unit }),
          sources: [capability.key],
        });
      } else if (!existing.sources.includes(capability.key)) {
        existing.sources.push(capability.key);
      }
    }
  }

  const searchable = [...byField.values()];
  const notSearchable = want
    .filter((field) => !byField.has(field))
    .map((field) => {
      const nearest = CAPABILITY_PROXIES[field];
      const nearestLabel =
        nearest === undefined ? undefined : byField.get(nearest)?.label;
      const reasons = picked
        .flatMap((capability) => capability.notSearchable ?? [])
        .filter((entry) => entry.field === field);

      return {
        field,
        why:
          reasons[0]?.why ??
          `${picked.map((entry) => sourceLabel(entry.key)).join(', ') || 'No picked source'} cannot filter on ${field}`,
        ...(nearest !== undefined && { nearest }),
        ...(nearestLabel !== undefined && {
          upgrade: `Ask for ${nearestLabel} instead${picked.some((entry) => entry.key === 'harvest' || entry.key === 'linkedin') ? '' : ', or add Harvest or your LinkedIn to filter on ' + field}`,
        }),
      };
    });

  const questions: CapabilityQuestion[] = [];

  for (const field of want) {
    if (field === 'employees' && byField.has('employees')) {
      questions.push(headcountQuestion());
    }
    if (
      field === 'annualRevenue' &&
      (byField.has('annualRevenue') || byField.has('employees'))
    ) {
      questions.push(
        byField.has('annualRevenue') ? revenueQuestion() : headcountQuestion(),
      );
    }
    if (field === 'industry') {
      questions.push(industryQuestion(term));
    }
    if (
      (field === 'location' || field === 'hqLocation') &&
      entity !== undefined
    ) {
      questions.push(locationQuestion(entity));
    }
  }

  return {
    sources: picked.map((capability) => ({
      key: capability.key,
      label: sourceLabel(capability.key),
      entity: capability.entity,
    })),
    searchable,
    notSearchable,
    returns: unique(picked.map((capability) => capability.key)).map((key) => ({
      source: key,
      fields: unique(
        picked
          .filter((capability) => capability.key === key)
          .flatMap((capability) => capability.returns),
      ),
    })),
    handoff: SOURCE_HANDOFFS.filter(
      (handoff) =>
        wantedSources.includes(handoff.from) ||
        wantedSources.includes(handoff.to),
    ).map((handoff) => ({ ...handoff })),
    questions: [
      ...new Map(
        questions.map((question) => [question.header, question]),
      ).values(),
    ].slice(0, 4),
  };
};
