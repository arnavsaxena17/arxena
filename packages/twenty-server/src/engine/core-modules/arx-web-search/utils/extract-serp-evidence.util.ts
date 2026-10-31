import { type BrightDataSerpGoogleJson } from 'src/engine/core-modules/bright-data/types/bright-data-serp.types';

export type ArxWebSearchSnippet = {
  title: string;
  url: string;
  description: string;
};

export type ArxWebSearchProvider = 'perplexity' | 'bright-data-serp';

export type ArxWebSearchEvidence = {
  query: string;
  provider: ArxWebSearchProvider;
  // What this lookup cost, so callers can report spend per provider
  costUsd: number;
  aiOverview: string | null;
  snippets: ArxWebSearchSnippet[];
  // Ready to paste into a prompt: AI overview first, then the ranked snippets
  text: string;
};

const MAX_SNIPPETS = 6;
const MAX_AI_OVERVIEW_CHARS = 2_500;
const MAX_SNIPPET_CHARS = 600;

// Bright Data documents `ai_overview.texts`; entries are plain strings or
// objects carrying the text, so read both and ignore anything else.
const collectText = (value: unknown, parts: string[]): void => {
  if (typeof value === 'string') {
    if (value.trim() !== '') {
      parts.push(value.trim());
    }

    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectText(item, parts));

    return;
  }

  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;

    collectText(record.text ?? record.snippet ?? record.texts, parts);
    // Bullets arrive as a nested list; their text is not under texts[].snippet,
    // so without this the overview silently loses every list item
    collectText(record.list, parts);
  }
};

export const extractAiOverviewText = (
  serp: BrightDataSerpGoogleJson,
): string | null => {
  const parts: string[] = [];

  collectText(serp.ai_overview, parts);

  if (parts.length === 0) {
    return null;
  }

  return parts.join('\n').slice(0, MAX_AI_OVERVIEW_CHARS);
};

export const extractOrganicSnippets = (
  serp: BrightDataSerpGoogleJson,
): ArxWebSearchSnippet[] =>
  (serp.organic ?? [])
    .map((entry) => ({
      title: (entry.title ?? '').trim(),
      url: (entry.link ?? entry.url ?? '').trim(),
      description: (entry.description ?? '')
        .replace(/\s*Read more\s*$/i, '')
        .trim()
        .slice(0, MAX_SNIPPET_CHARS),
    }))
    .filter((snippet) => snippet.title !== '' && snippet.description !== '')
    .slice(0, MAX_SNIPPETS);

// Null when the provider returned nothing usable, so the caller can fall back.
export const buildEvidence = ({
  query,
  provider,
  costUsd,
  aiOverview,
  snippets,
}: {
  query: string;
  provider: ArxWebSearchProvider;
  costUsd: number;
  aiOverview: string | null;
  snippets: ArxWebSearchSnippet[];
}): ArxWebSearchEvidence | null => {
  if (aiOverview === null && snippets.length === 0) {
    return null;
  }

  const sections: string[] = [];

  if (aiOverview !== null) {
    sections.push(`GOOGLE AI OVERVIEW:\n${aiOverview}`);
  }

  if (snippets.length > 0) {
    sections.push(
      `SEARCH RESULTS:\n${snippets
        .map(
          (snippet, index) =>
            `${index + 1}. ${snippet.title} (${snippet.url})\n${snippet.description}`,
        )
        .join('\n')}`,
    );
  }

  return {
    query,
    provider,
    costUsd,
    aiOverview,
    snippets,
    text: sections.join('\n\n'),
  };
};

export const buildSerpEvidence = (
  query: string,
  serp: BrightDataSerpGoogleJson,
  costUsd = 0,
): ArxWebSearchEvidence | null =>
  buildEvidence({
    query,
    provider: 'bright-data-serp',
    costUsd,
    aiOverview: extractAiOverviewText(serp),
    snippets: extractOrganicSnippets(serp),
  });
