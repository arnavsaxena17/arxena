import { Columns } from '@/spreadsheet-import/steps/components/MatchColumnsStep/MatchColumnsStep';
import { SpreadsheetImportStepType } from '@/spreadsheet-import/steps/types/SpreadsheetImportStepType';
import { ImportedRow } from '@/spreadsheet-import/types';
import { WorkBook } from 'xlsx-ugnis';

export type SpreadsheetImportStep =
  | {
      type: SpreadsheetImportStepType.upload;
    }
  | {
      type: SpreadsheetImportStepType.selectFiles;
      files: File[];
      workbooks: WorkBook[];
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
    }
  | {
      type: SpreadsheetImportStepType.matchColumns;
      data: ImportedRow[];
      headerValues: ImportedRow;
      file: File;
    }
  | {
      type: SpreadsheetImportStepType.validateData;
      data: any[];
      importedColumns: Columns<string>;
      files: File[];
    }
  | {
      type: SpreadsheetImportStepType.uploadResumes;
      files: File[];
    }
  | {
      type: SpreadsheetImportStepType.loading;
    };
