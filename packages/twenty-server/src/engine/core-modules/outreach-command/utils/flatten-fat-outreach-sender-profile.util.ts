import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

import { type OutreachSenderProfile } from 'src/engine/core-modules/outreach-command/types/outreach-sender-profile.type';

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const toStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(isNonEmptyString),
    ),
  ];
};

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

// One-shot migration helper for pre-slim nested sender JSON.
export const flattenFatOutreachSenderProfile = (
  value: unknown,
): OutreachSenderProfile => {
  const record = asRecord(value);

  if (!isDefined(record)) {
    return { targetTitles: [], locations: [], brief: '' };
  }

  // Already-slim blob (brief, or legacy prose key before upgrade rewrite).
  if (
    (typeof record.brief === 'string' || typeof record.prose === 'string') &&
    !('identity' in record)
  ) {
    const brief =
      typeof record.brief === 'string'
        ? record.brief.trim()
        : typeof record.prose === 'string'
          ? record.prose.trim()
          : '';

    return {
      targetTitles: toStringList(record.targetTitles),
      locations: toStringList(record.locations),
      brief,
    };
  }

  const identity = asRecord(record.identity) ?? {};
  const credibility = asRecord(record.credibility) ?? {};
  const offer = asRecord(record.offer) ?? {};
  const icp = asRecord(record.icp) ?? {};
  const voice = asRecord(record.voice) ?? {};
  const meeting = asRecord(record.meeting) ?? {};
  const faq = Array.isArray(offer.faq) ? offer.faq : [];
  const objections = Array.isArray(icp.known_objections)
    ? icp.known_objections
    : [];

  const lines = [
    ...listLine(
      'Sender',
      [identity.full_name, identity.title, identity.company]
        .filter((part) => typeof part === 'string' && isNonEmptyString(part))
        .join(' · '),
    ),
    ...listLine('Signs as', identity.how_they_sign),
    ...listLine('Sign-off', voice.sign_off),
    ...listLine('Timezone', identity.timezone),
    ...listLine('Voice', voice.register),
    ...listLine('Formality', voice.formality),
    ...listLine('Uses honorifics', voice.uses_honorifics),
    ...listLine('Signature phrases', voice.signature_phrases),
    ...listLine('Avoid phrases', voice.avoid_phrases),
    ...listLine('Credibility', credibility.one_liner),
    ...listLine('Operator', credibility.operator_line),
    ...listLine('Credentials', credibility.credentials),
    ...listLine('Industries known', credibility.industries_known),
    ...listLine('Offer', offer.product_name),
    ...listLine('Category', offer.category),
    ...listLine('One-sentence offer', offer.one_sentence),
    ...listLine('Problem statements', offer.problem_statements),
    ...listLine('Outcomes', offer.outcomes),
    ...listLine('Proof points', offer.proof_points),
    ...listLine('Works with', offer.works_with),
    ...listLine('Implementation', offer.implementation_time),
    ...listLine('Pilot', offer.pilot_offer),
    ...listLine('Pricing', offer.pricing_line),
    ...listLine('Data security', offer.data_security_line),
    ...(faq.length > 0
      ? [
          'FAQ:',
          ...faq.flatMap((item) => {
            const faqItem = asRecord(item);

            if (!isDefined(faqItem)) {
              return [];
            }

            const question =
              typeof faqItem.q === 'string' ? faqItem.q.trim() : '';
            const answer =
              typeof faqItem.a === 'string' ? faqItem.a.trim() : '';

            if (!isNonEmptyString(question)) {
              return [];
            }

            return [`- Q: ${question}`, `  A: ${answer || '(none)'}`];
          }),
        ]
      : []),
    ...listLine('ICP roles', icp.target_roles),
    ...listLine('ICP companies', icp.target_company_profile),
    ...listLine('ICP geography', icp.geography),
    ...listLine('Exclude roles', icp.exclude_roles),
    ...(objections.length > 0
      ? [
          'Known objections:',
          ...objections.flatMap((item) => {
            const objection = asRecord(item);

            if (!isDefined(objection)) {
              return [];
            }

            const objectionText =
              typeof objection.objection === 'string'
                ? objection.objection.trim()
                : '';
            const response =
              typeof objection.response === 'string'
                ? objection.response.trim()
                : '';

            if (!isNonEmptyString(objectionText)) {
              return [];
            }

            return [
              `- Objection: ${objectionText}`,
              `  Response: ${response || '(none)'}`,
            ];
          }),
        ]
      : []),
    ...listLine('Meeting duration (min)', meeting.default_duration_min),
    ...listLine('Meeting platform', meeting.platform),
    ...listLine('Preferred windows', meeting.preferred_windows),
    ...listLine('Agenda', meeting.agenda_template),
  ];

  return {
    targetTitles: toStringList(icp.target_roles ?? record.targetTitles),
    locations: toStringList(icp.geography ?? record.locations),
    brief: lines.join('\n'),
    collateralFiles: [],
  };
};
