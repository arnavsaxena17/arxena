import { Logger } from '@nestjs/common';

import { i18n } from '@lingui/core';

import { generateMessageId } from './generateMessageId';

const logger = new Logger('StandardMetadataI18n');

const loggedMissingCatalogKeys = new Set<string>();

export type StandardMetadataTranslationLogContext =
  | {
      entity: 'object';
      labelKey: 'labelPlural' | 'labelSingular' | 'description';
      nameSingular: string;
    }
  | {
      entity: 'field';
      labelKey: 'label' | 'description';
      objectMetadataId: string;
      name: string;
    };

/**
 * Resolves a standard (non-custom) object/field label via Lingui without calling
 * `i18n._()` when the message id is absent from the active locale catalog. That
 * avoids @lingui/core's "Uncompiled message" console.warn spam when the DB label
 * does not match a compiled catalog key (e.g. drift from canonical `msg` strings).
 */
export function resolveStandardMetadataTranslation(
  sourceEnglish: string,
  logContext: StandardMetadataTranslationLogContext,
): string {
  if (sourceEnglish === '') {
    return '';
  }

  const messageId = generateMessageId(sourceEnglish);
  const catalog = i18n.messages as Record<string, unknown>;

  if (catalog[messageId] === undefined) {
    const dedupeKey = `${i18n.locale}:${messageId}:${sourceEnglish}`;
    if (!loggedMissingCatalogKeys.has(dedupeKey)) {
      loggedMissingCatalogKeys.add(dedupeKey);
      if (logContext.entity === 'object') {
        logger.warn(
          `Missing Lingui catalog entry for standard object metadata (locale=${i18n.locale}, messageId=${messageId}, labelKey=${logContext.labelKey}, nameSingular=${logContext.nameSingular}, sourceEnglish=${JSON.stringify(sourceEnglish)}). Ensure twenty-server lingui extract/compile ran and the DB label matches the canonical msg string exactly.`,
        );
      } else {
        logger.warn(
          `Missing Lingui catalog entry for standard field metadata (locale=${i18n.locale}, messageId=${messageId}, labelKey=${logContext.labelKey}, objectMetadataId=${logContext.objectMetadataId}, name=${logContext.name}, sourceEnglish=${JSON.stringify(sourceEnglish)}). Ensure twenty-server lingui extract/compile ran and the DB label matches the canonical msg string exactly.`,
        );
      }
    }
    return sourceEnglish;
  }

  const translatedMessage = i18n._(messageId);

  if (translatedMessage === messageId) {
    return sourceEnglish;
  }

  return translatedMessage;
}
