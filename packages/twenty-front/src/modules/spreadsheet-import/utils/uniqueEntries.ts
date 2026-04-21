import uniqBy from 'lodash.uniqby';

import type { MatchColumnsStepProps } from '@/spreadsheet-import/steps/types/matchColumnsStepProps';
import type { MatchedOptions } from '@/spreadsheet-import/types/columnTypes';

export const uniqueEntries = <T extends string>(
  data: MatchColumnsStepProps['data'],
  index: number,
): Partial<MatchedOptions<T>>[] =>
  uniqBy(
    data.map((row) => ({ entry: row[index] })),
    'entry',
  ).filter(({ entry }) => !!entry);
