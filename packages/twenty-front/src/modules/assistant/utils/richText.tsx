import React from 'react';

type TextSegment = {
  type: 'text' | 'bold' | 'markdownLink' | 'url' | 'phone' | 'id';
  content: string;
  url?: string;
  start: number;
  end: number;
};

const JSON_BLOCK_REGEX = /```json\s*\n([\s\S]*?)```/g;

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

const parseMessageContentWithJson = (text: string): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  let lastEnd = 0;
  let match: RegExpExecArray | null;
  JSON_BLOCK_REGEX.lastIndex = 0;
  while ((match = JSON_BLOCK_REGEX.exec(text)) !== null) {
    if (match.index > lastEnd) {
      parts.push(...parseRichText(text.slice(lastEnd, match.index)));
    }
    const jsonStr = match[1].trim();
    try {
      const data = JSON.parse(jsonStr) as Record<string, unknown>;
      parts.push(
        <div key={`json-${match.index}`}>
          {Object.entries(data).map(([key, value]) => (
            <div key={key}>
              <span>{key}</span>
              <span>
                {value === null
                  ? 'null'
                  : Array.isArray(value)
                  ? value.join(', ')
                  : typeof value === 'object'
                  ? JSON.stringify(value)
                  : String(value)}
              </span>
            </div>
          ))}
        </div>,
      );
    } catch {
      parts.push(...parseRichText(`\`\`\`json\n${jsonStr}\n\`\`\``));
    }
    lastEnd = match.index + match[0].length;
  }
  if (lastEnd < text.length) {
    parts.push(...parseRichText(text.slice(lastEnd)));
  }
  return parts.length > 0 ? parts : parseRichText(text);
};

export { parseRichText, parseMessageContentWithJson };

