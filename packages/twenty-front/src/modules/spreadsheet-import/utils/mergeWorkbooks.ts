import { ImportedRow } from '@/spreadsheet-import/types';
import * as XLSX from 'xlsx-ugnis';

/**
 * Merges multiple workbooks into a single workbook with all candidate data
 * @param workbooks Array of workbooks to merge
 * @param files Array of files corresponding to workbooks
 * @returns Merged workbook with all candidate data
 */
export const mergeWorkbooks = (workbooks: XLSX.WorkBook[], files: File[]): XLSX.WorkBook => {
  if (workbooks.length === 0) {
    throw new Error('No workbooks to merge');
  }

  if (workbooks.length === 1) {
    return workbooks[0];
  }

  // Collect all data from all workbooks
  const allData: ImportedRow[] = [];
  const allHeaders = new Set<string>();
  const fileNames: string[] = [];

  // Process each workbook
  for (let i = 0; i < workbooks.length; i++) {
    const workbook = workbooks[i];
    const file = files[i];
    
    // Get the first sheet (assuming single sheet per file)
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON with headers
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      blankrows: false,
      raw: false,
    }) as ImportedRow[];

    if (jsonData.length === 0) {
      continue; // Skip empty sheets
    }

    // First row contains headers
    const headers = jsonData[0] as string[];
    const dataRows = jsonData.slice(1);

    // Add headers to our set
    headers.forEach(header => {
      if (header && typeof header === 'string') {
        allHeaders.add(header);
      }
    });

    // Add data rows with source file information
    dataRows.forEach(row => {
      // Add source file information as a new column
      const rowWithSource = [...row, file.name];
      allData.push(rowWithSource);
    });

    fileNames.push(file.name);
  }

  // Create unified headers array
  const unifiedHeaders = Array.from(allHeaders);
  
  // Add source file column header
  unifiedHeaders.push('Source File');

  // Create the merged data array
  const mergedData: ImportedRow[] = [unifiedHeaders];

  // Add all data rows
  allData.forEach(row => {
    // Ensure each row has the same number of columns as headers
    const normalizedRow: ImportedRow = [];
    
    for (let i = 0; i < unifiedHeaders.length; i++) {
      normalizedRow[i] = row[i] || '';
    }
    
    mergedData.push(normalizedRow);
  });

  // Create new worksheet from merged data
  const mergedWorksheet = XLSX.utils.aoa_to_sheet(mergedData);

  // Create merged workbook
  const mergedWorkbook: XLSX.WorkBook = {
    SheetNames: ['Merged Candidates'],
    Sheets: {
      'Merged Candidates': mergedWorksheet
    }
  };

  return mergedWorkbook;
};

/**
 * Merges multiple JSON files containing candidate data
 * @param jsonFiles Array of JSON data from files
 * @param fileNames Array of file names
 * @returns Merged workbook with all candidate data
 */
export const mergeJsonFiles = (jsonFiles: any[], fileNames: string[]): XLSX.WorkBook => {
  if (jsonFiles.length === 0) {
    throw new Error('No JSON files to merge');
  }

  if (jsonFiles.length === 1) {
    // Convert single JSON to workbook format
    const applications = jsonFiles[0].applications || [];
    const headers = applications.length > 0 ? Object.keys(applications[0]) : [];
    
    const data = [headers];
    applications.forEach((application: any) => {
      const row = headers.map(header => {
        const value = application[header];
        if (value === null || value === undefined) {
          return '';
        }
        if (typeof value === 'object') {
          return JSON.stringify(value);
        }
        return String(value);
      });
      data.push(row);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    return {
      SheetNames: ['Candidates'],
      Sheets: {
        Candidates: worksheet
      }
    };
  }

  // Merge multiple JSON files
  const allApplications: any[] = [];
  const allHeaders = new Set<string>();

  jsonFiles.forEach((jsonData, index) => {
    const applications = jsonData.applications || [];
    
    applications.forEach((application: any) => {
      // Add source file information
      const applicationWithSource = {
        ...application,
        'Source File': fileNames[index]
      };
      
      allApplications.push(applicationWithSource);
      
      // Collect headers
      Object.keys(applicationWithSource).forEach(key => allHeaders.add(key));
    });
  });

  if (allApplications.length === 0) {
    return {
      SheetNames: ['Merged Candidates'],
      Sheets: {
        'Merged Candidates': XLSX.utils.aoa_to_sheet([['No data found']])
      }
    };
  }

  // Create unified headers
  const unifiedHeaders = Array.from(allHeaders);
  
  // Create data array
  const data = [unifiedHeaders];
  allApplications.forEach(application => {
    const row = unifiedHeaders.map(header => {
      const value = application[header];
      if (value === null || value === undefined) {
        return '';
      }
      if (typeof value === 'object') {
        return JSON.stringify(value);
      }
      return String(value);
    });
    data.push(row);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  return {
    SheetNames: ['Merged Candidates'],
    Sheets: {
      'Merged Candidates': worksheet
    }
  };
};

/**
 * Determines if files should be merged based on their types
 * @param files Array of files
 * @returns true if files should be merged, false otherwise
 */
export const shouldMergeFiles = (files: File[]): boolean => {
  if (files.length <= 1) {
    return false;
  }

  // Check if all files are spreadsheet files (xlsx, xls, csv) or JSON files
  const spreadsheetTypes = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'application/json'
  ];

  const spreadsheetExtensions = ['.xlsx', '.xls', '.csv', '.json'];

  return files.every(file => 
    spreadsheetTypes.includes(file.type) || 
    spreadsheetExtensions.some(ext => file.name.toLowerCase().endsWith(ext))
  );
};
