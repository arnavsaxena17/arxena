import { isNonEmptyString } from '@sniptt/guards';

import { type FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { type ObjectRecord } from '@/object-record/types/ObjectRecord';
import { FieldMetadataType } from 'twenty-shared/types';
import { getLinkFaviconUrl, isDefined } from 'twenty-shared/utils';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

export const getImageIdentifierFieldValue = (
  record: ObjectRecord,
  imageIdentifierFieldMetadataItem: FieldMetadataItem | undefined,
  allowRequestsToTwentyIcons?: boolean,
): string | null => {
  if (!isDefined(imageIdentifierFieldMetadataItem?.name)) {
    return null;
  }

  const fieldValue = record[imageIdentifierFieldMetadataItem.name];

  if (!isDefined(fieldValue)) {
    return null;
  }

  switch (imageIdentifierFieldMetadataItem.type) {
    case FieldMetadataType.FILES: {
      const url = Array.isArray(fieldValue) ? fieldValue[0]?.url : undefined;

      return isNonEmptyString(url) ? url : null;
    }
    case FieldMetadataType.LINKS: {
      if (allowRequestsToTwentyIcons !== true) {
        return null;
      }

      const primaryLinkUrl =
        typeof fieldValue === 'object' && 'primaryLinkUrl' in fieldValue
          ? fieldValue.primaryLinkUrl
          : undefined;

      return isNonEmptyString(primaryLinkUrl)
        ? (getLinkFaviconUrl(primaryLinkUrl, REACT_APP_SERVER_BASE_URL) ??
            null)
        : null;
    }
    default:
      return null;
  }
};
