import { isNonEmptyString } from '@sniptt/guards';
import { isDefined } from 'twenty-shared/utils';

import type { BrightDataGoogleMapsPlaceRecord } from 'src/engine/core-modules/bright-data/types/bright-data-google-maps-place.types';

export const websiteFromBrightDataPlace = (
  place: BrightDataGoogleMapsPlaceRecord,
): string => {
  const direct = (place.website ?? '').toString().trim();

  if (isNonEmptyString(direct)) {
    return direct;
  }

  const details = place.business_details;

  if (!Array.isArray(details)) {
    return '';
  }

  for (const detail of details) {
    if (
      !isDefined(detail) ||
      typeof detail !== 'object' ||
      !('field_name' in detail)
    ) {
      continue;
    }

    const fieldName = String(
      (detail as { field_name?: unknown }).field_name ?? '',
    ).toLowerCase();

    if (fieldName !== 'authority' && fieldName !== 'website') {
      continue;
    }

    const link =
      'link' in detail
        ? String((detail as { link?: unknown }).link ?? '').trim()
        : '';
    const text =
      'details' in detail
        ? String((detail as { details?: unknown }).details ?? '').trim()
        : '';

    if (isNonEmptyString(link)) {
      return link;
    }

    if (isNonEmptyString(text)) {
      return text.startsWith('http') ? text : `https://${text}`;
    }
  }

  return '';
};
