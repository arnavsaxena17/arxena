import {
  ColumnType,
  type Columns,
} from '@/spreadsheet-import/types/columnTypes';
import {
  Fields,
  ImportedRow,
  ImportedStructuredRow,
} from '@/spreadsheet-import/types';

import { isDefined } from 'twenty-shared';
import { z } from 'zod';
import { normalizeCheckboxValue } from './normalizeCheckboxValue';

// Helper function to check if a field is a phone number field
export const isPhoneNumberField = (fieldKey: string): boolean => {
  return fieldKey === 'Phone number (phones)' || 
         fieldKey === 'phoneNumber' || 
         fieldKey === 'PrimaryPhoneNumber' ||
         fieldKey === 'primaryPhoneNumber' ||
         fieldKey === 'phoneNumber PrimaryPhoneNumber' ||
         fieldKey === 'Phone country code (phones)' ||
         fieldKey === 'phoneCountryCode' ||
         fieldKey === 'countryCode' ||
         fieldKey === 'phoneCode';
};

// Helper function to validate phone number value
export const isValidPhoneNumber = (value: any): boolean => {
  return typeof value === 'string' && value.trim() !== '';
};

export const normalizeTableData = <T extends string>(
  columns: Columns<T>,
  data: ImportedRow[],
  fields: Fields<T>,
) =>
  data.map((row) =>
    columns.reduce((acc, column, index) => {
      const curr = row[index];
      switch (column.type) {
        case ColumnType.matchedCheckbox: {
          const field = fields.find((field) => field.key === column.value);

          if (!field) {
            return acc;
          }

          if (
            'booleanMatches' in field.fieldType &&
            Object.keys(field.fieldType).length > 0
          ) {
            const booleanMatchKey = Object.keys(
              field.fieldType.booleanMatches || [],
            ).find((key) => key.toLowerCase() === curr?.toLowerCase());

            if (!booleanMatchKey) {
              return acc;
            }

            const booleanMatch =
              field.fieldType.booleanMatches?.[booleanMatchKey];
            acc[column.value] = booleanMatchKey
              ? booleanMatch
              : normalizeCheckboxValue(curr);
          } else {
            acc[column.value] = normalizeCheckboxValue(curr);
          }
          return acc;
        }
        case ColumnType.matched: {
          // Special handling for phone number fields - only accept strings
          if (isPhoneNumberField(column.value)) {
            // Only add phone number if it's a valid string
            if (isValidPhoneNumber(curr)) {
              acc[column.value] = curr;
            } else {
              // Skip non-string phone numbers
              acc[column.value] = undefined;
            }
          } else {
            acc[column.value] = curr === '' ? undefined : curr;
          }
          return acc;
        }
        case ColumnType.matchedSelect:
        case ColumnType.matchedSelectOptions: {
          const field = fields.find((field) => field.key === column.value);

          if (!field) {
            return acc;
          }

          if (field.fieldType.type === 'multiSelect' && isDefined(curr)) {
            const currentOptionsSchema = z.preprocess(
              (value) => JSON.parse(z.string().parse(value)),
              z.array(z.unknown()),
            );

            const rawCurrentOptions = currentOptionsSchema.safeParse(curr).data;

            const matchedOptionValues = [
              ...new Set(
                rawCurrentOptions
                  ?.map(
                    (option) =>
                      column.matchedOptions.find(
                        (matchedOption) => matchedOption.entry === option,
                      )?.value,
                  )
                  .filter(isDefined),
              ),
            ];

            const fieldValue =
              matchedOptionValues && matchedOptionValues.length > 0
                ? JSON.stringify(matchedOptionValues)
                : undefined;

            acc[column.value] = fieldValue;
          } else {
            const matchedOption = column.matchedOptions.find(
              ({ entry }) => entry === curr,
            );
            acc[column.value] = matchedOption?.value || undefined;
          }
          return acc;
        }
        case ColumnType.empty:
        case ColumnType.ignored: {
          return acc;
        }
        default:
          return acc;
      }
    }, {} as ImportedStructuredRow<T>),
  );
