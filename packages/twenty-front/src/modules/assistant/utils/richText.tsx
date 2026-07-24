import React from 'react';

import { JsonMessageViewer } from '@/utils/JsonMessageViewer';

type TextSegment = {
  type: 'text' | 'bold' | 'markdownLink' | 'url' | 'phone' | 'id';
  content: string;
  url?: string;
  start: number;
  end: number;
};

const JSON_BLOCK_REGEX = /```json\s*\n([\s\S]*?)```/g;

/** Find JSON object boundaries using balanced brace matching */
function findJsonBoundaries(text: string): { start: number; end: number } | null {
  const startIdx = text.search(/\{/);
  if (startIdx === -1) return null;
  let braceCount = 0;
  let inString = false;
  let escapeNext = false;
  let quoteChar = '';
  for (let i = startIdx; i < text.length; i++) {
    const char = text[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    if (inString) {
      if (char === quoteChar) inString = false;
      continue;
    }
    if (char === '"' || char === "'") {
      inString = true;
      quoteChar = char;
      continue;
    }
    if (char === '{') braceCount++;
    else if (char === '}') {
      braceCount--;
      if (braceCount === 0) return { start: startIdx, end: i + 1 };
    }
  }
  return null;
}

/** Infer label for JSON from content */
function inferJsonLabel(jsonContent: string): string {
  if (jsonContent.includes('original_requirement')) return 'Parsed requirement';
  if (jsonContent.includes('keywords') && jsonContent.includes('all_terms'))
    return 'Keywords';
  if (jsonContent.includes('primary_query')) return 'Primary query';
  if (jsonContent.includes('factored_query')) return 'Factored query';
  if (jsonContent.includes('splitting_strategy')) return 'Splitting strategy';
  if (jsonContent.includes('query_set')) return 'Query set';
  if (jsonContent.includes('orchestrator_result')) return 'Orchestrator result';
  if (jsonContent.includes('unresolved_search_parameters'))
    return 'Search parameters';
  return 'JSON';
}

const parseRichText = (text: string): React.ReactNode[] => {
  const segments: TextSegment[] = [];
  let key = 0;

  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = markdownLinkRegex.exec(text)) !== null) {
    segments.push({
      type: 'markdownLink',
      content: match[1],
      url: match[2],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  const boldRegex = /\*\*([^*]+)\*\*/g;
  while ((match = boldRegex.exec(text)) !== null) {
    const matchIndex = match.index;
    const matchLength = match[0].length;
    const overlaps = segments.some(
      (s) => s.type === 'markdownLink' && s.start < matchIndex + matchLength && s.end > matchIndex,
    );
    if (!overlaps) {
      segments.push({
        type: 'bold',
        content: match[1],
        start: matchIndex,
        end: matchIndex + matchLength,
      });
    }
  }

  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  while ((match = urlRegex.exec(text)) !== null) {
    const matchIndex = match.index;
    const matchLength = match[0].length;
    const isInMarkdownLink = segments.some(
      (s) => s.type === 'markdownLink' && s.start <= matchIndex && s.end >= matchIndex + matchLength,
    );
    if (!isInMarkdownLink) {
      let url = match[0];
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }
      segments.push({
        type: 'url',
        content: match[0],
        url,
        start: matchIndex,
        end: matchIndex + matchLength,
      });
    }
  }

  const phoneRegex =
    /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+\d{10,15}/g;
  while ((match = phoneRegex.exec(text)) !== null) {
    const matchIndex = match.index;
    const matchLength = match[0].length;
    const isProcessed = segments.some(
      (s) => s.start <= matchIndex && s.end >= matchIndex + matchLength,
    );
    if (!isProcessed) {
      const phoneNumber = match[0].replace(/\s/g, '');
      segments.push({
        type: 'phone',
        content: match[0],
        url: `tel:${phoneNumber}`,
        start: matchIndex,
        end: matchIndex + matchLength,
      });
    }
  }

  const uuidRegex =
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
  while ((match = uuidRegex.exec(text)) !== null) {
    const matchIndex = match.index;
    const matchLength = match[0].length;
    const isProcessed = segments.some(
      (s) => s.start <= matchIndex && s.end >= matchIndex + matchLength,
    );
    if (!isProcessed) {
      segments.push({
        type: 'id',
        content: match[0],
        url: `#${match[0]}`,
        start: matchIndex,
        end: matchIndex + matchLength,
      });
    }
  }

  segments.sort((a, b) => a.start - b.start);

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const segment of segments) {
    if (segment.start > lastIndex) {
      const beforeText = text.slice(lastIndex, segment.start);
      if (beforeText) {
        parts.push(beforeText);
      }
    }

    switch (segment.type) {
      case 'bold':
        parts.push(<strong key={key++}>{segment.content}</strong>);
        break;
      case 'markdownLink':
        parts.push(
          <a
            key={key++}
            href={segment.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {segment.content}
          </a>,
        );
        break;
      case 'url':
        parts.push(
          <a
            key={key++}
            href={segment.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {segment.content}
          </a>,
        );
        break;
      case 'phone':
        parts.push(
          <a key={key++} href={segment.url}>
            {segment.content}
          </a>,
        );
        break;
      case 'id':
        parts.push(
          <a
            key={key++}
            href={segment.url}
            style={{ cursor: 'pointer', textDecoration: 'underline' }}
          >
            {segment.content}
          </a>,
        );
        break;
      default:
        parts.push(segment.content);
    }

    lastIndex = segment.end;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
};

/** Renders a single JSON string with a collapsible block */
const renderJsonBlock = (
  jsonStr: string,
  label: string,
  key: string,
): React.ReactNode => (
  <JsonMessageViewer key={key} content={jsonStr} label={label} />
);

const parseMessageContentWithJson = (text: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  let keyIdx = 0;
  let lastEnd = 0;

  // First pass: handle ```json blocks
  JSON_BLOCK_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = JSON_BLOCK_REGEX.exec(text)) !== null) {
    if (match.index > lastEnd) {
      const between = text.slice(lastEnd, match.index);
      // Check for raw JSON in the "between" text
      const rawParts = parseTextWithRawJson(between, () => keyIdx++);
      parts.push(...rawParts);
    }
    const jsonStr = match[1].trim();
    try {
      JSON.parse(jsonStr);
      parts.push(
        renderJsonBlock(jsonStr, inferJsonLabel(jsonStr), `json-${keyIdx++}`),
      );
    } catch {
      parts.push(...parseRichText(`\`\`\`json\n${jsonStr}\n\`\`\``));
    }
    lastEnd = match.index + match[0].length;
  }

  // Handle remainder (including raw JSON)
  if (lastEnd < text.length) {
    const remainder = text.slice(lastEnd);
    const rawParts = parseTextWithRawJson(remainder, () => keyIdx++);
    parts.push(...rawParts);
  }

  return parts.length > 0 ? parts : parseRichText(text);
};

/** Parse text that may contain raw JSON objects, render JSON as collapsible blocks */
function parseTextWithRawJson(
  text: string,
  nextKey: () => number,
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    const boundaries = findJsonBoundaries(remaining);
    if (!boundaries) {
      const rich = parseRichText(remaining);
      if (rich.length) parts.push(...rich);
      break;
    }

    const before = remaining.slice(0, boundaries.start);
    if (before) {
      parts.push(...parseRichText(before));
    }

    const jsonStr = remaining.slice(boundaries.start, boundaries.end);
    try {
      JSON.parse(jsonStr);
      parts.push(
        renderJsonBlock(
          jsonStr,
          inferJsonLabel(jsonStr),
          `raw-json-${nextKey()}`,
        ),
      );
    } catch {
      parts.push(...parseRichText(jsonStr));
    }

    remaining = remaining.slice(boundaries.end);
  }

  return parts;
}

export { parseMessageContentWithJson, parseRichText };

