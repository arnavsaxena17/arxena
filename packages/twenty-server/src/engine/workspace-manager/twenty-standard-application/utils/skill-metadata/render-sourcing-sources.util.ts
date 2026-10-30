import {
  SOURCING_ALWAYS_LEARNED_TOOLS,
  SOURCING_SOURCES,
  type SourcingEntity,
  type SourcingSource,
  type SourcingSourceUse,
} from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/sourcing-sources.constant';
import { SOURCE_CAPABILITIES } from 'src/engine/workspace-manager/twenty-standard-application/utils/skill-metadata/sourcing-source-capabilities.constant';

// A generated block sits on a line of its own, like an include
const SOURCES_BLOCK_PATTERN =
  /^\{\{sources: ([a-z-]+)(?: ([a-z0-9-]+))?\}\}$/gm;
const FACT_PATTERN = /\{\{fact: ([a-z0-9-]+)\.([a-zA-Z]+)\}\}/g;
// Inline, so a routing table cell can name a source; `default` is the
// top-ranked source for the entity
const SOURCE_PATTERN = /\{\{source: ([a-z0-9-]+) ([a-z]+)\}\}/g;

const ENTITIES: readonly SourcingEntity[] = ['people', 'companies'];

const isEntity = (value: string | undefined): value is SourcingEntity =>
  ENTITIES.includes(value as SourcingEntity);

const findSource = (key: string): SourcingSource => {
  const source = SOURCING_SOURCES.find((entry) => entry.key === key);

  if (source === undefined) {
    throw new Error(`Unknown sourcing source "${key}"`);
  }

  return source;
};

// Wrapped in the markers the provider flags strip at read time
const markLines = (
  lines: string,
  markerPrefix: string | undefined,
  suffix: string,
): string =>
  markerPrefix === undefined
    ? lines
    : [
        `<!-- ${markerPrefix}-${suffix}:start -->`,
        lines,
        `<!-- ${markerPrefix}-${suffix}:end -->`,
      ].join('\n');

const usesFor = (
  entity: SourcingEntity,
): { source: SourcingSource; use: SourcingSourceUse }[] =>
  SOURCING_SOURCES.flatMap((source) => {
    const use = source[entity];

    return use === undefined ? [] : [{ source, use }];
  });

const renderProviderMap = (entity: SourcingEntity): string =>
  [
    '| Source | Tool(s) | Best for | Requires |',
    '| --- | --- | --- | --- |',
    ...usesFor(entity).map(({ source, use }) =>
      markLines(
        `| **${source.label}** | ${use.tools} | ${use.bestFor} | ${use.requires} |`,
        use.markerPrefix,
        'provider-row',
      ),
    ),
  ].join('\n');

const renderLearnTools = (entity: SourcingEntity): string => {
  const alwaysLearned = SOURCING_ALWAYS_LEARNED_TOOLS[entity];
  const learned = new Set<string>(alwaysLearned);
  const sourceLines = usesFor(entity).flatMap(({ use }) => {
    const toolNames = use.learnTools.filter((toolName) => {
      if (learned.has(toolName)) {
        return false;
      }

      learned.add(toolName);

      return true;
    });

    return toolNames.length === 0
      ? []
      : [
          markLines(
            toolNames.map((toolName) => `    "${toolName}",`).join('\n'),
            use.markerPrefix,
            'learn-tools-line',
          ),
        ];
  });

  return [
    '```',
    '# Outreach (default)',
    'learn_tools({',
    '  "toolNames": [',
    ...sourceLines,
    alwaysLearned.map((toolName) => `    "${toolName}"`).join(',\n'),
    '  ]',
    '})',
    '',
    '# Save to CRM only, after the user asks',
    'learn_tools({ "toolNames": ["save_outreach_targets_to_crm"] })',
    '```',
  ].join('\n');
};

// Which picked source can filter on which field; the table a question should be
// built from instead of a filter the source does not have
const renderCapabilities = (entity: 'company' | 'person'): string => {
  const labels = new Map(
    SOURCING_SOURCES.map((source) => [source.key, source.label]),
  );
  const byField = new Map<string, { label: string; sources: string[] }>();

  for (const capability of SOURCE_CAPABILITIES.filter(
    (entry) => entry.entity === entity,
  )) {
    for (const field of capability.searchable) {
      const entry = byField.get(field.field) ?? {
        label: field.label,
        sources: [],
      };

      entry.sources.push(labels.get(capability.key) ?? capability.key);
      byField.set(field.field, entry);
    }
  }

  return [
    '| Field | Filterable on |',
    '| --- | --- |',
    ...[...byField.values()].map(
      (entry) =>
        `| ${entry.label} | ${[...new Set(entry.sources)].join(', ')} |`,
    ),
  ]
    .filter((line) => line.length > 0)
    .join('\n');
};

const orderCell = (use: SourcingSourceUse | undefined): string =>
  use?.orderLabel === undefined
    ? '—'
    : `${use.orderLabel} (\`${use.section}\`)`;

const renderSourceOrder = (): string =>
  [
    '| # | People | Companies |',
    '| --- | --- | --- |',
    ...SOURCING_SOURCES.filter((source) => source.rank !== undefined)
      .sort((first, second) => (first.rank ?? 0) - (second.rank ?? 0))
      .map(
        (source) =>
          `| ${source.rank} | ${orderCell(source.people)} | ${orderCell(source.companies)} |`,
      ),
  ].join('\n');

const renderSourceProfiles = (): string =>
  [
    '| Source | Strong for | Blind spots | Limit and cost |',
    '| --- | --- | --- | --- |',
    ...SOURCING_SOURCES.flatMap(({ profile }) =>
      profile === undefined
        ? []
        : [
            `| ${profile.name} | ${profile.strongFor} | ${profile.blindSpots} | ${profile.limit.standing}: ${profile.limit.text} |`,
          ],
    ),
  ].join('\n');

const renderLimits = (key: string): string => {
  const { limits } = findSource(key);

  if (limits === undefined) {
    throw new Error(`Sourcing source "${key}" has no limits`);
  }

  return `### Limits and exhaustion\n\n${limits}`;
};

const renderBlock = (
  block: string,
  argument: string | undefined,
): string | undefined => {
  if (block === 'provider-map' && isEntity(argument)) {
    return renderProviderMap(argument);
  }

  if (block === 'learn-tools' && isEntity(argument)) {
    return renderLearnTools(argument);
  }

  if (block === 'source-order' && argument === undefined) {
    return renderSourceOrder();
  }

  if (block === 'source-profiles' && argument === undefined) {
    return renderSourceProfiles();
  }

  if (block === 'capabilities') {
    const entity =
      argument === 'people' || argument === 'person'
        ? 'person'
        : argument === 'companies' || argument === 'company'
          ? 'company'
          : undefined;

    if (entity !== undefined) {
      return renderCapabilities(entity);
    }
  }

  if (block === 'limits' && argument !== undefined) {
    return renderLimits(argument);
  }

  return undefined;
};

export const renderSourcingFacts = (content: string): string =>
  content.replace(FACT_PATTERN, (_token, key: string, factName: string) => {
    const fact = findSource(key).facts?.[factName];

    if (fact === undefined) {
      throw new Error(`Sourcing source "${key}" has no fact "${factName}"`);
    }

    return fact;
  });

const findDefaultSource = (entity: SourcingEntity): SourcingSource => {
  const [source] = SOURCING_SOURCES.filter(
    (entry) => entry.rank !== undefined && entry[entity] !== undefined,
  ).sort((first, second) => (first.rank ?? 0) - (second.rank ?? 0));

  if (source === undefined) {
    throw new Error(`No ranked sourcing source for "${entity}"`);
  }

  return source;
};

export const renderSourcingSourceNames = (content: string): string =>
  content.replace(SOURCE_PATTERN, (token, key: string, entity: string) => {
    if (!isEntity(entity)) {
      throw new Error(`Unknown sourcing entity: ${token}`);
    }

    const source =
      key === 'default' ? findDefaultSource(entity) : findSource(key);
    const use = source[entity];

    if (use === undefined) {
      throw new Error(`Sourcing source "${source.key}" has no ${entity} use`);
    }

    return use.section === undefined
      ? source.label
      : `${source.label} (\`${use.section}\`)`;
  });

// Blocks first, so the facts they quote are filled in with the rest
export const renderSourcingSources = (content: string): string =>
  renderSourcingFacts(
    renderSourcingSourceNames(
      content.replace(
        SOURCES_BLOCK_PATTERN,
        (line, block: string, argument: string | undefined) => {
          const rendered = renderBlock(block, argument);

          if (rendered === undefined) {
            throw new Error(`Unknown sourcing block: ${line}`);
          }

          return rendered;
        },
      ),
    ),
  );
