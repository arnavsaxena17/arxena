// Meta forbids \n / tabs />4 spaces in template body parameters.
// SO 79342462 \r workaround is API-accepted but does not render as line breaks
// (fields glue together or show �). Template {{2}} stays one-line; Flow/Unipile use \n.

const TEMPLATE_PARAM_MAX_LENGTH = 800;
const FLOW_DETAILS_MAX_LENGTH = 1200;
const UNIPILE_DETAILS_MAX_LENGTH = 3500;

const collapseWhitespace = (value: string): string =>
  value.replace(/\s+/g, ' ').trim();

const truncate = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

// "Last inbound: { ... \"message\": \"Hi\" ... }" → "Last inbound: Hi"
const simplifyJsonishFieldValue = (label: string, value: string): string => {
  const trimmed = value.trim();

  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return `${label}: ${trimmed}`;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;

    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      'first' in parsed
    ) {
      const first = (parsed as { first?: unknown }).first;

      if (first && typeof first === 'object' && !Array.isArray(first)) {
        const message = (first as { message?: unknown }).message;

        if (typeof message === 'string' && message.trim()) {
          return `${label}: ${message.trim()}`;
        }
      }
    }

    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      'message' in parsed &&
      typeof (parsed as { message?: unknown }).message === 'string'
    ) {
      return `${label}: ${String((parsed as { message: string }).message).trim()}`;
    }
  } catch {
    const messageMatch = /"message"\s*:\s*"((?:\\.|[^"\\])*)"/.exec(trimmed);

    if (messageMatch?.[1]) {
      const unescaped = messageMatch[1]
        .replace(/\\"/g, '"')
        .replace(/\\n/g, ' ')
        .replace(/\\\\/g, '\\');

      return `${label}: ${unescaped.trim()}`;
    }
  }

  return `${label}: (see Open form)`;
};

const splitDetailSegments = (detailsText: string): string[] => {
  return detailsText
    .split(/\s*\|\s*/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
};

const normalizeDetailSegment = (segment: string): string => {
  const separatorIndex = segment.indexOf(':');

  if (separatorIndex <= 0) {
    return collapseWhitespace(segment);
  }

  const label = segment.slice(0, separatorIndex).trim();
  const value = segment.slice(separatorIndex + 1).trim();

  if (!label) {
    return collapseWhitespace(segment);
  }

  if (
    label.toLowerCase().includes('inbound') ||
    value.startsWith('{') ||
    value.startsWith('[')
  ) {
    return simplifyJsonishFieldValue(label, value);
  }

  return `${label}: ${collapseWhitespace(value)}`;
};

const buildNormalizedDetailLines = (detailsText: string): string[] => {
  const segments = splitDetailSegments(detailsText);

  if (segments.length === 0) {
    const collapsed = collapseWhitespace(detailsText);

    return collapsed ? [collapsed] : [];
  }

  return segments
    .map((segment) => normalizeDetailSegment(segment))
    .filter((line) => {
      const separatorIndex = line.indexOf(':');

      if (separatorIndex <= 0) {
        return line.length > 0;
      }

      // Drop empty fields like "Title:"
      return line.slice(separatorIndex + 1).trim().length > 0;
    });
};

// Meta rejects \n/\r\n/tabs in template params. Live probes also showed:
// - \r is accepted but glues lines together (no visible break)
// - Unicode separators (LS/PS/NEL) render as �
// So keep a plain one-line separator for template {{2}}; use \n only in Flow/Unipile.
export const formatWhatsappTemplateDetailsParam = (
  detailsText: string,
  maxLength = TEMPLATE_PARAM_MAX_LENGTH,
): string => {
  const lines = buildNormalizedDetailLines(detailsText);

  if (lines.length === 0) {
    return '-';
  }

  return truncate(lines.join(' · '), maxLength);
};

export const formatWhatsappFlowDetailsBody = (
  detailsText: string,
  maxLength = FLOW_DETAILS_MAX_LENGTH,
): string => {
  const lines = buildNormalizedDetailLines(detailsText);

  if (lines.length === 0) {
    return '-';
  }

  return truncate(lines.join('\n'), maxLength);
};

export const formatWhatsappUnipileDetailsText = (
  detailsText: string,
  maxLength = UNIPILE_DETAILS_MAX_LENGTH,
): string => {
  const lines = buildNormalizedDetailLines(detailsText);

  if (lines.length === 0) {
    return '-';
  }

  return truncate(lines.join('\n'), maxLength);
};

export const formatWhatsappTemplateContextParam = (
  contextText: string,
  maxLength = 200,
): string => {
  const collapsed = collapseWhitespace(contextText);

  if (!collapsed) {
    return '-';
  }

  return truncate(collapsed, maxLength);
};

export type WhatsappStructuredTemplateDetails = {
  contact: string;
  company: string;
  draft: string;
};

const paramOrDash = (value: string, maxLength = 500): string => {
  const collapsed = collapseWhitespace(value);

  if (!collapsed) {
    return '-';
  }

  return truncate(collapsed, maxLength);
};

// Split pipe/details text into Contact / Company / Draft for multiline templates
export const splitWhatsappStructuredTemplateDetails = (
  detailsText: string,
): WhatsappStructuredTemplateDetails => {
  const lines = buildNormalizedDetailLines(detailsText);
  let contact = '';
  let company = '';
  let draft = '';
  const extras: string[] = [];

  for (const line of lines) {
    const separatorIndex = line.indexOf(':');
    const label =
      separatorIndex > 0
        ? line.slice(0, separatorIndex).trim().toLowerCase()
        : '';
    const value =
      separatorIndex > 0 ? line.slice(separatorIndex + 1).trim() : line.trim();

    if (label === 'contact' || label === 'name') {
      contact = value;
    } else if (label === 'company') {
      company = value;
    } else if (label === 'draft' || label === 'message' || label === 'body') {
      draft = value;
    } else if (label === 'title' && value) {
      extras.push(`Title: ${value}`);
    } else if (label.startsWith('last inbound') && value) {
      extras.push(`Inbound: ${value}`);
    } else if (value) {
      extras.push(line);
    }
  }

  if (!draft) {
    const textField = lines.find((line) =>
      /^(draft|message|body):/i.test(line),
    );

    if (textField) {
      draft = textField.replace(/^(draft|message|body):\s*/i, '');
    }
  }

  if (extras.length > 0) {
    company = company
      ? `${company} · ${extras.join(' · ')}`
      : extras.join(' · ');
  }

  return {
    contact: paramOrDash(contact),
    company: paramOrDash(company),
    draft: paramOrDash(draft, 800),
  };
};
