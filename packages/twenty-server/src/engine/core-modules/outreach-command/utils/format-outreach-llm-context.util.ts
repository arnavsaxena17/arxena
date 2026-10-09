import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

import {
  asChatTurns,
  type ChatTurn,
} from 'src/engine/core-modules/outreach-command/utils/chat-message-turns.util';
import { flattenFatOutreachSenderProfile } from 'src/engine/core-modules/outreach-command/utils/flatten-fat-outreach-sender-profile.util';

// Leave workflow template chips alone so resolveInput can still substitute them.
export const isUnresolvedWorkflowTemplate = (value: string): boolean =>
  /\{\{[^{}]+\}\}/.test(value);

const tryParseJson = (value: string): unknown => {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const listLine = (label: string, value: unknown): string[] => {
  if (typeof value === 'string' && isNonEmptyString(value.trim())) {
    return [`${label}: ${value.trim()}`];
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return [`${label}: ${String(value)}`];
  }

  if (Array.isArray(value) && value.length > 0) {
    const items = value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(isNonEmptyString);

    if (items.length === 0) {
      return [];
    }

    return [`${label}: ${items.join('; ')}`];
  }

  return [];
};

const roleLabel = (role: string): 'us' | 'them' | 'system' =>
  role === 'system'
    ? 'system'
    : role === 'assistant' || role === 'us'
      ? 'us'
      : 'them';

// Beyond this the oldest turns are folded into a short facts line, so a long
// thread cannot grow the prompt without bound.
const MAX_VERBATIM_TURNS = 30;
const TRANSCRIPT_TIME_ZONE = 'Asia/Kolkata';
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /\+?\d[\d\s().-]{8,}\d/g;

const formatTurnTime = (timestamp?: string): string => {
  const parsed = Date.parse(timestamp ?? '');

  if (Number.isNaN(parsed)) {
    return '';
  }

  return (
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TRANSCRIPT_TIME_ZONE,
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(parsed)) + ' IST'
  );
};

const uniqueMatches = (texts: string[], pattern: RegExp): string[] => [
  ...new Set(
    texts.flatMap((text) => text.match(pattern) ?? []).map((m) => m.trim()),
  ),
];

const summarizeOmittedTurns = (omitted: ChatTurn[]): string => {
  const prospectTexts = omitted
    .filter((turn) => roleLabel(turn.role) === 'them')
    .map((turn) => turn.content);
  const emails = uniqueMatches(prospectTexts, EMAIL_PATTERN);
  const phones = uniqueMatches(prospectTexts, PHONE_PATTERN);
  const since = formatTurnTime(omitted[0]?.timestamp);
  const facts = [
    emails.length > 0 ? `emails they gave: ${emails.join(', ')}` : '',
    phones.length > 0 ? `phones they gave: ${phones.join(', ')}` : '',
  ].filter(isNonEmptyString);

  return `[${omitted.length} earlier messages omitted${since ? `, thread started ${since}` : ''}${facts.length > 0 ? `; ${facts.join('; ')}` : ''}]`;
};

export const formatOutreachChatTurnsForLlm = (
  turns: unknown,
  options?: { showChannel?: boolean },
): string => {
  const all = asChatTurns(turns);
  const omitted = all.slice(0, Math.max(0, all.length - MAX_VERBATIM_TURNS));
  const lines = all.slice(omitted.length).map((turn) => {
    const meta = [
      options?.showChannel === true ? turn.channel : undefined,
      formatTurnTime(turn.timestamp),
    ].filter(isNonEmptyString);

    return `${roleLabel(turn.role)}${meta.length > 0 ? ` [${meta.join(', ')}]` : ''}: ${turn.content}`;
  });

  return [
    ...(omitted.length > 0 ? [summarizeOmittedTurns(omitted)] : []),
    ...lines,
  ].join('\n---\n');
};

const ALREADY_FORMATTED_PATTERN = /^(us|them|system)(\s\[[^\]\n]*\])?:/;

// Find-records dump, messageObj turns, Unipile messages, or an already-plain transcript.
export const formatOutreachTranscriptForLlm = (value: unknown): string => {
  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!isNonEmptyString(trimmed) || isUnresolvedWorkflowTemplate(trimmed)) {
      return trimmed;
    }

    if (
      ALREADY_FORMATTED_PATTERN.test(trimmed) ||
      trimmed.startsWith('[') ||
      trimmed.includes('\n---\n')
    ) {
      return trimmed;
    }

    const parsed = tryParseJson(trimmed);

    if (isDefined(parsed)) {
      return formatOutreachTranscriptForLlm(parsed);
    }

    return trimmed;
  }

  if (!isDefined(value)) {
    return '';
  }

  const record = asRecord(value);

  if (isDefined(record) && ('all' in record || 'first' in record)) {
    const rows = Array.isArray(record.all)
      ? record.all
      : isDefined(record.first)
        ? [record.first]
        : [];
    // Find chats order by createdAt DESC — reverse so the thread reads oldest→newest.
    const chronologicalRows = [...rows].reverse();
    const taggedTurns = chronologicalRows.flatMap((row) => {
      const chatMessage = asRecord(row);
      const channel =
        typeof chatMessage?.channel === 'string' ? chatMessage.channel : '';

      return asChatTurns(chatMessage?.messageObj).map((turn) => ({
        ...turn,
        ...(isNonEmptyString(channel) && !isNonEmptyString(turn.channel)
          ? { channel }
          : {}),
      }));
    });
    const channels = new Set(
      taggedTurns.map((turn) => turn.channel).filter(isNonEmptyString),
    );
    const isMultiChannel = channels.size > 1;
    // One row per channel keeps each channel's turns together; merge them into
    // one timeline when every turn carries a time.
    const turns =
      isMultiChannel &&
      taggedTurns.every(
        (turn) => !Number.isNaN(Date.parse(turn.timestamp ?? '')),
      )
        ? [...taggedTurns].sort(
            (left, right) =>
              Date.parse(left.timestamp ?? '') -
              Date.parse(right.timestamp ?? ''),
          )
        : taggedTurns;

    if (turns.length > 0) {
      return formatOutreachChatTurnsForLlm(turns, {
        showChannel: isMultiChannel,
      });
    }

    const fallbackMessages = chronologicalRows
      .map((row) => {
        const chatMessage = asRecord(row);
        const message =
          typeof chatMessage?.message === 'string'
            ? chatMessage.message.trim()
            : '';

        return isNonEmptyString(message) ? `them: ${message}` : '';
      })
      .filter(isNonEmptyString);

    return fallbackMessages.join('\n---\n');
  }

  if (Array.isArray(value)) {
    return formatOutreachChatTurnsForLlm(value);
  }

  if (isDefined(record) && 'messageObj' in record) {
    return formatOutreachChatTurnsForLlm(record.messageObj);
  }

  // Unipile / fetch-linkedin-messages envelope: { messages: [{ text, isSender }] }
  if (isDefined(record) && Array.isArray(record.messages)) {
    return formatOutreachChatTurnsForLlm(record.messages);
  }

  return '';
};

// Product default for proposing times in copy (matches outreach send window).
const OUTREACH_SLOT_DISPLAY_TIMEZONE = 'Asia/Kolkata';
const OUTREACH_SLOT_DISPLAY_ZONE_LABEL: Record<string, string> = {
  'Asia/Kolkata': 'IST',
};

const parseSlotInstant = (iso: string): Date | null => {
  const date = new Date(iso);

  return Number.isNaN(date.getTime()) ? null : date;
};

const slotFormatParts = (
  date: Date,
  options: Intl.DateTimeFormatOptions,
): Record<string, string> =>
  Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: OUTREACH_SLOT_DISPLAY_TIMEZONE,
      ...options,
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

// (0) Wed, Sep 17 · 11:00–11:20 AM IST
const formatSlotWindowForLlm = (
  startsAt: string,
  endsAt: string,
  index: number,
): string => {
  const start = parseSlotInstant(startsAt);

  if (!isDefined(start)) {
    return isNonEmptyString(endsAt)
      ? `(${index}) ${startsAt} → ${endsAt}`
      : `(${index}) ${startsAt}`;
  }

  const dayParts = slotFormatParts(start, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const startTimeParts = slotFormatParts(start, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const day = `${dayParts.weekday}, ${dayParts.month} ${dayParts.day}`;
  const zone =
    OUTREACH_SLOT_DISPLAY_ZONE_LABEL[OUTREACH_SLOT_DISPLAY_TIMEZONE] ??
    OUTREACH_SLOT_DISPLAY_TIMEZONE;
  const end = parseSlotInstant(endsAt);

  if (!isDefined(end)) {
    return `(${index}) ${day} · ${startTimeParts.hour}:${startTimeParts.minute} ${startTimeParts.dayPeriod} ${zone}`;
  }

  const endTimeParts = slotFormatParts(end, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const timeRange =
    startTimeParts.dayPeriod === endTimeParts.dayPeriod
      ? `${startTimeParts.hour}:${startTimeParts.minute}–${endTimeParts.hour}:${endTimeParts.minute} ${endTimeParts.dayPeriod}`
      : `${startTimeParts.hour}:${startTimeParts.minute} ${startTimeParts.dayPeriod}–${endTimeParts.hour}:${endTimeParts.minute} ${endTimeParts.dayPeriod}`;

  return `(${index}) ${day} · ${timeRange} ${zone}`;
};

const reformatIndexedIsoSlotLine = (line: string): string => {
  const match = line
    .trim()
    .match(
      /^\((\d+)\)\s+(\d{4}-\d{2}-\d{2}T\S+?)(?:\s*→\s*(\d{4}-\d{2}-\d{2}T\S+))?$/,
    );

  if (!isDefined(match)) {
    return line.trim();
  }

  return formatSlotWindowForLlm(match[2], match[3] ?? '', Number(match[1]));
};

export const formatOutreachSlotsForLlm = (value: unknown): string => {
  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!isNonEmptyString(trimmed) || isUnresolvedWorkflowTemplate(trimmed)) {
      return trimmed;
    }

    // Indexed lines — humanize leftover ISO windows; leave prose alone.
    if (/^\(\d+\)\s/.test(trimmed)) {
      return trimmed
        .split('\n')
        .map((line) => reformatIndexedIsoSlotLine(line))
        .filter(isNonEmptyString)
        .join('\n');
    }

    const parsed = tryParseJson(trimmed);

    if (isDefined(parsed)) {
      return formatOutreachSlotsForLlm(parsed);
    }

    // Comma-separated ISO starts (legacy prompt fixtures).
    if (trimmed.includes('T') && trimmed.includes(',')) {
      return trimmed
        .split(',')
        .map((part) => part.trim())
        .filter(isNonEmptyString)
        .map((startsAt, index) => formatSlotWindowForLlm(startsAt, '', index))
        .join('\n');
    }

    return trimmed;
  }

  if (!Array.isArray(value) || value.length === 0) {
    return '';
  }

  return value
    .map((rawSlot, index) => {
      const slot = asRecord(rawSlot);
      const startsAt =
        typeof slot?.startsAt === 'string' ? slot.startsAt.trim() : '';
      const endsAt = typeof slot?.endsAt === 'string' ? slot.endsAt.trim() : '';

      if (!isNonEmptyString(startsAt)) {
        return '';
      }

      return formatSlotWindowForLlm(startsAt, endsAt, index);
    })
    .filter(isNonEmptyString)
    .join('\n');
};

export const formatOutreachSenderForLlm = (value: unknown): string => {
  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!isNonEmptyString(trimmed) || isUnresolvedWorkflowTemplate(trimmed)) {
      return trimmed;
    }

    if (trimmed === '{}' || trimmed === 'null') {
      return '';
    }

    const parsed = tryParseJson(trimmed);

    if (!isDefined(parsed)) {
      return trimmed;
    }

    return formatOutreachSenderForLlm(parsed);
  }

  const record = asRecord(value);

  if (!isDefined(record)) {
    return '';
  }

  // Workspace member row, or a find-records `first` record.
  if (
    'outreachSenderProfile' in record &&
    isDefined(record.outreachSenderProfile)
  ) {
    return formatOutreachSenderForLlm(record.outreachSenderProfile);
  }

  // Slim member profile: brief + discovery chips.
  if (
    typeof record.brief === 'string' ||
    Array.isArray(record.targetTitles) ||
    (Array.isArray(record.locations) && !('identity' in record))
  ) {
    const lines = [
      typeof record.brief === 'string' && isNonEmptyString(record.brief.trim())
        ? record.brief.trim()
        : '',
      ...listLine('Target titles', record.targetTitles),
      ...listLine('Locations', record.locations),
    ].filter(isNonEmptyString);

    return lines.join('\n');
  }

  // Legacy fat JSON still in flight during upgrade.
  if ('identity' in record || 'offer' in record) {
    return formatOutreachSenderForLlm(flattenFatOutreachSenderProfile(record));
  }

  // Find Records result: { first, all, totalCount }.
  const firstRecord = asRecord(record.first);

  if (isDefined(firstRecord) && ('all' in record || 'totalCount' in record)) {
    return formatOutreachSenderForLlm(firstRecord);
  }

  return '';
};

// Full LinkedIn profile for drafting / qualify (from fetch-linkedin-profile.result).
export const formatOutreachProspectProfileForLlm = (value: unknown): string => {
  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!isNonEmptyString(trimmed) || isUnresolvedWorkflowTemplate(trimmed)) {
      return trimmed;
    }

    if (trimmed === '{}' || trimmed === 'null' || trimmed === '(none)') {
      return '';
    }

    // Already humanized (starts with a name / Headline line).
    if (
      !trimmed.startsWith('{') &&
      !trimmed.startsWith('[') &&
      (trimmed.includes('\n') || !trimmed.includes('"success"'))
    ) {
      return trimmed;
    }

    const parsed = tryParseJson(trimmed);

    if (!isDefined(parsed)) {
      return trimmed;
    }

    return formatOutreachProspectProfileForLlm(parsed);
  }

  const record = asRecord(value);

  if (!isDefined(record)) {
    return '';
  }

  if (typeof record.text === 'string' && isNonEmptyString(record.text.trim())) {
    const nested = record.text.trim();

    // Avoid recursion on pretty-JSON text from older withLlmFormattedText.
    if (nested.startsWith('{') || nested.startsWith('[')) {
      return formatOutreachProspectProfileForLlm(
        tryParseJson(nested) ?? nested,
      );
    }

    if (
      !nested.includes('"success"') &&
      !nested.includes('"linkedinProfileId"')
    ) {
      return nested;
    }

    return formatOutreachProspectProfileForLlm(tryParseJson(nested) ?? '');
  }

  const firstName =
    typeof record.firstName === 'string' ? record.firstName.trim() : '';
  const lastName =
    typeof record.lastName === 'string' ? record.lastName.trim() : '';
  const name = [firstName, lastName].filter(isNonEmptyString).join(' ');
  const headline =
    typeof record.headline === 'string' ? record.headline.trim() : '';
  const about = typeof record.about === 'string' ? record.about.trim() : '';
  const location =
    typeof record.location === 'string' ? record.location.trim() : '';
  const linkedinUrl =
    typeof record.linkedinUrl === 'string' ? record.linkedinUrl.trim() : '';

  const experienceLines = Array.isArray(record.experience)
    ? record.experience.flatMap((item) => {
        const experience = asRecord(item);

        if (!isDefined(experience)) {
          return [];
        }

        const position =
          typeof experience.position === 'string'
            ? experience.position.trim()
            : '';
        const company =
          typeof experience.company === 'string'
            ? experience.company.trim()
            : '';
        const start =
          typeof experience.start === 'string' ? experience.start.trim() : '';
        const end =
          typeof experience.end === 'string' &&
          isNonEmptyString(experience.end.trim())
            ? experience.end.trim()
            : 'Present';
        const role = [position, company].filter(isNonEmptyString).join(' @ ');

        if (!isNonEmptyString(role)) {
          return [];
        }

        const dates =
          isNonEmptyString(start) || end !== 'Present'
            ? ` (${start || '?'} – ${end})`
            : '';

        return [`- ${role}${dates}`];
      })
    : [];

  const skills = Array.isArray(record.skills)
    ? record.skills
        .map((skill) => {
          if (typeof skill === 'string') {
            return skill.trim();
          }

          const skillRecord = asRecord(skill);

          return typeof skillRecord?.name === 'string'
            ? skillRecord.name.trim()
            : '';
        })
        .filter(isNonEmptyString)
    : [];

  const lines = [
    name,
    headline,
    ...listLine('Location', location),
    ...listLine('About', about),
    ...(experienceLines.length > 0 ? ['Experience:', ...experienceLines] : []),
    ...(skills.length > 0 ? [`Skills: ${skills.join(', ')}`] : []),
    ...listLine('LinkedIn', linkedinUrl),
  ].filter(isNonEmptyString);

  return lines.join('\n');
};

// Recent LinkedIn posts for drafting / qualify (from FETCH_LINKEDIN_ACTIVITY.result).
export const formatOutreachProspectPostsForLlm = (value: unknown): string => {
  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!isNonEmptyString(trimmed) || isUnresolvedWorkflowTemplate(trimmed)) {
      return trimmed;
    }

    if (trimmed === '[]' || trimmed === '{}' || trimmed === 'null') {
      return '';
    }

    const parsed = tryParseJson(trimmed);

    if (!isDefined(parsed)) {
      return trimmed;
    }

    return formatOutreachProspectPostsForLlm(parsed);
  }

  const record = asRecord(value);

  if (isDefined(record)) {
    if (
      typeof record.text === 'string' &&
      isNonEmptyString(record.text.trim())
    ) {
      return record.text.trim();
    }

    if (Array.isArray(record.posts)) {
      return formatOutreachProspectPostsForLlm(record.posts);
    }
  }

  if (!Array.isArray(value) || value.length === 0) {
    return '';
  }

  const lines = value.flatMap((item, index) => {
    const post = asRecord(item);

    if (!isDefined(post)) {
      return [];
    }

    const text = typeof post.text === 'string' ? post.text.trim() : '';

    if (!isNonEmptyString(text)) {
      return [];
    }

    const when =
      typeof post.parsedDatetime === 'string' &&
      isNonEmptyString(post.parsedDatetime.trim())
        ? ` (${post.parsedDatetime.trim()})`
        : '';

    return [`- (${index})${when} ${text}`];
  });

  return lines.join('\n');
};

export const formatOutreachProspectEnrichmentForLlm = (
  value: unknown,
): string => {
  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!isNonEmptyString(trimmed) || isUnresolvedWorkflowTemplate(trimmed)) {
      return trimmed;
    }

    if (trimmed === '{}') {
      return '';
    }

    if (trimmed.startsWith('Prospect:') || trimmed.startsWith('Hooks:')) {
      return trimmed;
    }

    const parsed = tryParseJson(trimmed);

    if (!isDefined(parsed)) {
      return trimmed;
    }

    return formatOutreachProspectEnrichmentForLlm(parsed);
  }

  const record = asRecord(value);

  if (!isDefined(record)) {
    return '';
  }

  if (
    'outreachProspectEnrichment' in record &&
    isDefined(record.outreachProspectEnrichment)
  ) {
    return formatOutreachProspectEnrichmentForLlm(
      record.outreachProspectEnrichment,
    );
  }

  const firstRecord = asRecord(record.first);

  if (isDefined(firstRecord) && ('all' in record || 'totalCount' in record)) {
    return formatOutreachProspectEnrichmentForLlm(firstRecord);
  }

  if (
    typeof record.score === 'undefined' &&
    typeof record.hooks === 'undefined'
  ) {
    return '';
  }

  const hooks = Array.isArray(record.hooks) ? record.hooks : [];
  const honorific =
    typeof record.honorific === 'string' && isNonEmptyString(record.honorific)
      ? `${record.honorific} `
      : '';
  const firstName =
    typeof record.first_name === 'string' ? record.first_name.trim() : '';
  const company =
    typeof record.company_short === 'string' ? record.company_short.trim() : '';

  const lines = [
    ...listLine(
      'Prospect',
      [honorific + firstName, company].filter(isNonEmptyString).join(' · '),
    ),
    ...listLine('Go', record.go),
    ...listLine('Score', record.score),
    ...listLine('Segment', record.segment),
    ...listLine('Reason', record.reason),
    ...listLine('Industry', record.industry_phrase),
    ...listLine('Likely systems', record.likely_systems),
    ...listLine('Matching problem', record.matching_problem_statement),
    ...listLine('Referral source', record.referral_source),
    ...(hooks.length > 0
      ? [
          'Hooks:',
          ...hooks.flatMap((item, index) => {
            const hook = asRecord(item);
            const text = typeof hook?.text === 'string' ? hook.text.trim() : '';
            const source =
              typeof hook?.source === 'string' ? hook.source.trim() : '';

            if (!isNonEmptyString(text)) {
              return [];
            }

            return [
              `- (${index}) ${text}${isNonEmptyString(source) ? ` [${source}]` : ''}`,
            ];
          }),
        ]
      : []),
  ];

  return lines.join('\n');
};

// After resolveInput, objects land as JSON.stringify inside labeled sections.
// Rewrite those sections so the model sees prose instead of raw dumps.
export const rewriteOutreachResolvedPromptSections = (
  prompt: string,
): string => {
  if (
    !prompt.includes('SENDER_JSON') &&
    !prompt.includes('PROSPECT_ENRICHMENT') &&
    !prompt.includes('Prospect:') &&
    !prompt.includes('prospect:') &&
    !prompt.includes('prospect_posts:') &&
    !prompt.includes('prospect_profile:') &&
    !prompt.includes('0-based index into Available slots') &&
    !prompt.includes('Available slots (only source of times)') &&
    !prompt.includes('chat_history:') &&
    !prompt.includes('Transcript:') &&
    !prompt.includes('calendar:') &&
    !prompt.includes('calendar (ignore')
  ) {
    return prompt;
  }

  const withNoneFallback =
    (format: (raw: string) => string) =>
    (raw: string): string =>
      format(raw) || '(none)';

  const sectionFormatters: Array<{
    prefix: string;
    format: (raw: string) => string;
  }> = [
    {
      prefix: 'Transcript: ',
      format: withNoneFallback(formatOutreachTranscriptForLlm),
    },
    {
      prefix: 'chat_history: ',
      format: withNoneFallback(formatOutreachTranscriptForLlm),
    },
    {
      prefix: 'Available slots (index order): ',
      format: withNoneFallback(formatOutreachSlotsForLlm),
    },
    {
      prefix: 'Available slots (only source of times): ',
      format: withNoneFallback(formatOutreachSlotsForLlm),
    },
    {
      prefix: 'calendar (ignore — do not use): ',
      format: withNoneFallback(formatOutreachSlotsForLlm),
    },
    {
      prefix: 'calendar: ',
      format: withNoneFallback(formatOutreachSlotsForLlm),
    },
    {
      // Optional space: prompts are often `SENDER_JSON:{{step.text}}`.
      // The leading space in the replacement keeps `SENDER_JSON: <brief>`.
      prefix: 'SENDER_JSON:',
      format: (raw: string) =>
        ` ${withNoneFallback(formatOutreachSenderForLlm)(raw)}`,
    },
    {
      prefix: 'PROSPECT_ENRICHMENT: ',
      format: withNoneFallback(formatOutreachProspectEnrichmentForLlm),
    },
    {
      prefix: 'prospect: ',
      format: withNoneFallback(formatOutreachProspectEnrichmentForLlm),
    },
    {
      // Prompts label this section `Prospect:`; the formatter also starts
      // with that word, so drop the duplicate.
      prefix: 'Prospect:',
      format: (raw: string) => {
        const formatted = withNoneFallback(
          formatOutreachProspectEnrichmentForLlm,
        )(raw);

        if (formatted.startsWith('Prospect:')) {
          return formatted.slice('Prospect:'.length);
        }

        return ` ${formatted}`;
      },
    },
    {
      prefix: 'prospect_profile: ',
      format: withNoneFallback(formatOutreachProspectProfileForLlm),
    },
    {
      prefix: 'prospect_posts: ',
      format: withNoneFallback(formatOutreachProspectPostsForLlm),
    },
  ];

  let result = prompt;

  for (const { prefix, format } of sectionFormatters) {
    let searchFrom = 0;

    while (searchFrom < result.length) {
      const prefixIndex = result.indexOf(prefix, searchFrom);

      if (prefixIndex < 0) {
        break;
      }

      const valueStart = prefixIndex + prefix.length;
      const extracted = extractSectionValue(result, valueStart);

      if (!isDefined(extracted)) {
        break;
      }

      const formatted = format(extracted.raw);
      const nextResult =
        result.slice(0, valueStart) + formatted + result.slice(extracted.end);

      searchFrom = valueStart + formatted.length;
      result = nextResult;
    }
  }

  return result;
};

const extractSectionValue = (
  text: string,
  startIndex: number,
): { raw: string; end: number } | null => {
  let index = startIndex;

  // Only skip spaces on the same line. Skipping newlines used to pull the next
  // labeled section (e.g. chat_history) into an empty prospect_posts value.
  while (index < text.length && text[index] === ' ') {
    index += 1;
  }

  if (index >= text.length || text[index] === '\n') {
    return { raw: '', end: index };
  }

  const opener = text[index];

  if (opener === '{' || opener === '[') {
    const closer = opener === '{' ? '}' : ']';
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let cursor = index; cursor < text.length; cursor += 1) {
      const character = text[cursor];

      if (inString) {
        if (escaped) {
          escaped = false;
          continue;
        }

        if (character === '\\') {
          escaped = true;
          continue;
        }

        if (character === '"') {
          inString = false;
        }

        continue;
      }

      if (character === '"') {
        inString = true;
        continue;
      }

      if (character === opener) {
        depth += 1;
      } else if (character === closer) {
        depth -= 1;

        if (depth === 0) {
          return {
            raw: text.slice(index, cursor + 1),
            end: cursor + 1,
          };
        }
      }
    }

    return {
      raw: text.slice(index),
      end: text.length,
    };
  }

  const lineEnd = text.indexOf('\n', index);

  if (lineEnd < 0) {
    return { raw: text.slice(index), end: text.length };
  }

  return { raw: text.slice(index, lineEnd), end: lineEnd };
};

export const buildFindRecordsLlmText = (records: unknown[]): string => {
  const structuredResult = {
    first: records[0],
    all: records,
    totalCount: records.length,
  };
  const looksLikeChatMessages = records.some((record) => {
    const row = asRecord(record);

    return (
      isDefined(row) &&
      ('messageObj' in row ||
        row.channel === 'LINKEDIN' ||
        row.channel === 'WHATSAPP' ||
        row.channel === 'EMAIL' ||
        row.typeOfMessage === 'linkedin')
    );
  });

  if (looksLikeChatMessages) {
    const transcript = formatOutreachTranscriptForLlm(structuredResult);

    if (isNonEmptyString(transcript)) {
      return transcript;
    }
  }

  const looksLikeSenderProfiles = records.some((record) => {
    const row = asRecord(record);

    return isDefined(row) && 'outreachSenderProfile' in row;
  });

  if (looksLikeSenderProfiles) {
    return formatOutreachSenderForLlm(structuredResult) || '(none)';
  }

  return JSON.stringify(structuredResult, null, 2);
};
