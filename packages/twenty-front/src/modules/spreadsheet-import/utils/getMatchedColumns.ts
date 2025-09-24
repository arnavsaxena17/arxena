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
) => {
  console.log('getMatchedColumns called with:', {
    columnsCount: columns.length,
    fieldsCount: fields.length,
    autoMapDistance,
    customMappings: customMappings ? Object.keys(customMappings) : 'none'
  });
  
  // Early return if fields array is empty or undefined
  if (!fields || fields.length === 0) {
    console.warn('Fields array is empty or undefined, returning original columns');
    return columns;
  }
  
  return columns.reduce<Column<T>[]>((arr, column) => {
    console.log('Processing column:', column.header, 'type:', column.type);
    // First check if there's a custom mapping for this header
    const customMatch = customMappings?.[column.header];
    console.log('customMatch', customMatch);
    // Then try auto-matching if no custom mapping exists
    const autoMatch =
      customMatch || findMatch(column.header, fields, autoMapDistance);
    console.log('autoMatch', autoMatch);
    if (isDefined(autoMatch)) {
      const field = fields.find((field) => field.key === autoMatch);
      console.log('field', field);
      
      if (!field) {
        console.warn(`Field with key "${autoMatch}" not found in fields array`);
        return [...arr, column];
      }
      
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
            setColumn(column, field as Field<T>, data),
          ];
        }

        // Otherwise, use Levenshtein distance to determine the better match
        const isDuplicateBetter =
          lavenstein(duplicate.value, duplicate.header) <
          lavenstein(autoMatch, column.header)
            ? [
                ...arr.slice(0, duplicateIndex),
                setColumn(arr[duplicateIndex], field as Field<T>, data),
                ...arr.slice(duplicateIndex + 1),
                setColumn(column),
              ]
            : [
                ...arr.slice(0, duplicateIndex),
                setColumn(arr[duplicateIndex]),
                ...arr.slice(duplicateIndex + 1),
                setColumn(column, field as Field<T>, data),
              ];

        return isDuplicateBetter;
      } else {
        const newColumn = setColumn(column, field as Field<T>, data);
        return [...arr, newColumn];
      }
    } else {
      return [...arr, column];
    }
  }, []);
};
