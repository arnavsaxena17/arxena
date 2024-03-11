import { isNonEmptyString } from '@sniptt/guards';

import { FieldMetadataItem } from '@/object-metadata/types/FieldMetadataItem';
import { FieldMetadataType } from '~/generated/graphql';
import { capitalize } from '~/utils/string/capitalize';

export const generateEmptyFieldValue = (
  fieldMetadataItem: FieldMetadataItem,
) => {
  switch (fieldMetadataItem.type) {
    case FieldMetadataType.Email:
    case FieldMetadataType.Phone:
    case FieldMetadataType.Text: {
      return '';
    }
    case FieldMetadataType.Link: {
      return {
        label: '',
        url: '',
      };
    }
    case FieldMetadataType.FullName: {
      return {
        firstName: '',
        lastName: '',
      };
    }
    case FieldMetadataType.DateTime: {
      return null;
    }
    case FieldMetadataType.Number:
    case FieldMetadataType.Rating:
    case FieldMetadataType.Position:
    case FieldMetadataType.Numeric: {
      return null;
    }
    case FieldMetadataType.Uuid: {
      return null;
    }
    case FieldMetadataType.Boolean: {
      return true;
    }
    case FieldMetadataType.Relation: {
      // TODO: refactor with relationDefiniton once the PR is merged : https://github.com/twentyhq/twenty/pull/4378
      // so we can directly check the relation type from this field point of view.
      if (
        !isNonEmptyString(
          fieldMetadataItem.fromRelationMetadata?.toObjectMetadata
            ?.nameSingular,
        )
      ) {
        return null;
      }

      return {
        __typename: `${capitalize(
          fieldMetadataItem.fromRelationMetadata.toObjectMetadata.nameSingular,
        )}Connection`,
        edges: [],
      };
    }
    case FieldMetadataType.Currency: {
      return {
        amountMicros: null,
        currencyCode: null,
      };
    }
    case FieldMetadataType.Select: {
      return null;
    }
    case FieldMetadataType.MultiSelect: {
      throw new Error('Not implemented yet');
    }
    default: {
      throw new Error('Unhandled FieldMetadataType');
    }
  }
};
