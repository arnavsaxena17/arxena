import { isValidPhoneNumber } from 'libphonenumber-js';

import { isValidUuid } from '@/object-record/spreadsheet-import/util/isValidUuid';
import { Validation } from '@/spreadsheet-import/types';
import { FieldMetadataType } from '~/generated-metadata/graphql';

export const getSpreadSheetValidation = (
  type: FieldMetadataType,
  fieldName: string,
): Validation[] => {
  switch (type) {
    case FieldMetadataType.Number:
      return [
        {
          rule: 'regex',
          value: '^\\d+$',
          errorMessage: fieldName + ' must be a number',
          level: 'error',
        },
      ];
    case FieldMetadataType.Phone:
      return [
        {
          rule: 'function',
          isValid: (value: string) => {
            const phoneNumber = value.startsWith('+') 
              ? value 
              : `+91${value}`;
            return isValidPhoneNumber(phoneNumber, 'IN');
          },
          errorMessage: fieldName + ' is not valid',
          level: 'error',
        },
      ];
      case FieldMetadataType.Relation:
        if (fieldName.toLowerCase().includes('job')) {
          return [
            {
              rule: 'function',
              isValid: (value: string) => {
                return value ? true : false; // Allow any non-empty value for jobs
              },
              errorMessage: fieldName + ' cannot be empty',
              level: 'error',
            },
          ];
        } else {
          return [
            {
              rule: 'function',
              isValid: (value: string) => isValidUuid(value),
              errorMessage: fieldName + ' is not valid',
              level: 'error',
            },
          ];
        }
        
      default:
      return [];
  }
};
