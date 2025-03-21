import lavenstein from 'js-levenshtein';

import {
  Column,
  Columns,
  MatchColumnsStepProps,
} from '@/spreadsheet-import/steps/components/MatchColumnsStep/MatchColumnsStep';
import { Field, Fields } from '@/spreadsheet-import/types';
import { isDefined } from 'twenty-shared';

import { findMatch } from './findMatch';
import { setColumn } from './setColumn';

/**
 * Static mapping of common field keys to their alternate matches
 * Use this for auto-matching column headers that might use different terminology
 */

export const getMatchedColumns = <T extends string>(
  columns: Columns<T>,
  fields: Fields<T>,
  data: MatchColumnsStepProps['data'],
  autoMapDistance: number,
  customMappings?: Record<string, T>,
) =>
  columns.reduce<Column<T>[]>((arr, column) => {
    // First check if there's a custom mapping for this header
    const customMatch = customMappings?.[column.header];
    console.log('customMatch', customMatch);
    // Then try auto-matching if no custom mapping exists
    const autoMatch =
      customMatch || findMatch(column.header, fields, autoMapDistance);
    console.log('autoMatch', autoMatch);
    if (isDefined(autoMatch)) {
      const field = fields.find((field) => field.key === autoMatch) as Field<T>;
      console.log('field', field);
      const duplicateIndex = arr.findIndex(
        (column) => 'value' in column && column.value === field.key,
      );

      const duplicate = arr[duplicateIndex];
      if (duplicate && 'value' in duplicate) {
        // If this is a custom mapping, prioritize it over auto-matched duplicates
        if (customMatch !== undefined) {
          return [
            ...arr.slice(0, duplicateIndex),
            setColumn(arr[duplicateIndex]),
            ...arr.slice(duplicateIndex + 1),
            setColumn(column, field, data),
          ];
        }

        // Otherwise, use Levenshtein distance to determine the better match
        const isDuplicateBetter =
          lavenstein(duplicate.value, duplicate.header) <
          lavenstein(autoMatch, column.header)
            ? [
                ...arr.slice(0, duplicateIndex),
                setColumn(arr[duplicateIndex], field, data),
                ...arr.slice(duplicateIndex + 1),
                setColumn(column),
              ]
            : [
                ...arr.slice(0, duplicateIndex),
                setColumn(arr[duplicateIndex]),
                ...arr.slice(duplicateIndex + 1),
                setColumn(column, field, data),
              ];

        return isDuplicateBetter;
      } else {
        const newColumn = setColumn(column, field, data);
        return [...arr, newColumn];
      }
    } else {
      return [...arr, column];
    }
  }, []);
