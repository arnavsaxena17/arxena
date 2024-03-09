import { createState } from '@/ui/utilities/state/utils/createState';

import { SpreadsheetOptions } from '../types';

export type SpreadsheetImportState<T extends string> = {
  isOpen: boolean;
  options: Omit<SpreadsheetOptions<T>, 'isOpen' | 'onClose'> | null;
};

export const spreadsheetImportState = createState<SpreadsheetImportState<any>>({
  key: 'spreadsheetImportState',
  defaultValue: {
    isOpen: false,
    options: null,
  },
});
