import type { Columns } from '@/spreadsheet-import/types/columnTypes';
import { SpreadsheetImportStepType } from '@/spreadsheet-import/steps/types/SpreadsheetImportStepType';
import type { ImportedRow } from '@/spreadsheet-import/types/importedRow';
import { DeduplicationStats } from '@/spreadsheet-import/utils/mergeWorkbooks';
import { WorkBook } from 'xlsx-ugnis';

export type SpreadsheetImportStep =
  | {
      type: SpreadsheetImportStepType.upload;
    }
  | {
      type: SpreadsheetImportStepType.selectFiles;
      files: File[];
      workbooks: WorkBook[];
      deduplicationStats?: DeduplicationStats;
    }
  | {
      type: SpreadsheetImportStepType.selectSheet;
      workbook: WorkBook;
      file: File;
    }
  | {
      type: SpreadsheetImportStepType.selectHeader;
      data: ImportedRow[];
      file: File;
      deduplicationStats?: DeduplicationStats;
    }
  | {
      type: SpreadsheetImportStepType.matchColumns;
      data: ImportedRow[];
      headerValues: ImportedRow;
      file: File;
      deduplicationStats?: DeduplicationStats;
    }
  | {
      type: SpreadsheetImportStepType.validateData;
      data: any[];
      importedColumns: Columns<string>;
      files: File[];
      deduplicationStats?: DeduplicationStats;
    }
  | {
      type: SpreadsheetImportStepType.uploadResumes;
      files: File[];
    }
  | {
      type: SpreadsheetImportStepType.loading;
    };
