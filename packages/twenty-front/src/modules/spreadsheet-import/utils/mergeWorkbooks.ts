import { ImportedRow } from '@/spreadsheet-import/types';
import * as XLSX from 'xlsx-ugnis';

// Helper function to check if a field is an email field
const isEmailField = (fieldKey: string): boolean => {
  return fieldKey.toLowerCase().includes('email') || 
         fieldKey === 'email' ||
         fieldKey === 'Email' ||
         fieldKey === 'emailAddress' ||
         fieldKey === 'Email Address';
};

// Helper function to check if a field is a phone number field
const isPhoneNumberField = (fieldKey: string): boolean => {
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

// Helper function to normalize email for comparison
const normalizeEmail = (email: any): string | null => {
  if (typeof email !== 'string' || !email.trim()) return null;
  return email.toLowerCase().trim();
};

// Helper function to normalize phone number for comparison
const normalizePhoneNumber = (phone: any): string | null => {
  if (typeof phone !== 'string' || !phone.trim()) return null;
  // Remove all non-digit characters for comparison
  return phone.replace(/\D/g, '');
};

// Helper function to extract deduplication key from a row
const getDeduplicationKey = (row: any[], headers: string[]): string | null => {
  // Look for email field first
  for (let i = 0; i < headers.length; i++) {
    if (isEmailField(headers[i])) {
      const email = normalizeEmail(row[i]);
      if (email) return `email:${email}`;
    }
  }
  
  // If no email, look for phone number
  for (let i = 0; i < headers.length; i++) {
    if (isPhoneNumberField(headers[i])) {
      const phone = normalizePhoneNumber(row[i]);
      if (phone) return `phone:${phone}`;
    }
  }
  
  return null;
};

export type DeduplicationStats = {
  totalFiles: number;
  totalCandidates: number;
  deduplicatedCandidates: number;
  duplicatesRemoved: number;
  deduplicationKey: 'email' | 'phone' | 'none';
};

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

  // Deduplication logic
  const seenKeys = new Set<string>();
  const deduplicatedData: ImportedRow[] = [];
  let deduplicationKey: 'email' | 'phone' | 'none' = 'none';

  // First pass: determine deduplication key type
  for (const header of unifiedHeaders) {
    if (isEmailField(header)) {
      deduplicationKey = 'email';
      break;
    } else if (isPhoneNumberField(header)) {
      deduplicationKey = 'phone';
    }
  }

  // Second pass: deduplicate based on the key
  allData.forEach(row => {
    const key = getDeduplicationKey(row, unifiedHeaders);
    
    if (key && seenKeys.has(key)) {
      // Skip duplicate
      return;
    }
    
    if (key) {
      seenKeys.add(key);
    }
    
    // Ensure each row has the same number of columns as headers
    const normalizedRow: ImportedRow = [];
    
    for (let i = 0; i < unifiedHeaders.length; i++) {
      normalizedRow[i] = row[i] || '';
    }
    
    deduplicatedData.push(normalizedRow);
  });

  // Create the merged data array
  const mergedData: ImportedRow[] = [unifiedHeaders, ...deduplicatedData];

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
 * Merges multiple workbooks with deduplication and returns statistics
 * @param workbooks Array of workbooks to merge
 * @param files Array of files corresponding to workbooks
 * @returns Object containing merged workbook and deduplication statistics
 */
export const mergeWorkbooksWithStats = (workbooks: XLSX.WorkBook[], files: File[]): { workbook: XLSX.WorkBook; stats: DeduplicationStats } => {
  if (workbooks.length === 0) {
    throw new Error('No workbooks to merge');
  }

  if (workbooks.length === 1) {
    // For single workbook, still calculate stats
    const workbook = workbooks[0];
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      blankrows: false,
      raw: false,
    }) as ImportedRow[];

    const totalCandidates = Math.max(0, jsonData.length - 1); // Subtract header row

    return {
      workbook,
      stats: {
        totalFiles: 1,
        totalCandidates,
        deduplicatedCandidates: totalCandidates,
        duplicatesRemoved: 0,
        deduplicationKey: 'none'
      }
    };
  }

  // Collect all data from all workbooks
  const allData: ImportedRow[] = [];
  const allHeaders = new Set<string>();
  const fileNames: string[] = [];
  let totalCandidatesBeforeDedup = 0;

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
    totalCandidatesBeforeDedup += dataRows.length;

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

  // Deduplication logic
  const seenKeys = new Set<string>();
  const deduplicatedData: ImportedRow[] = [];
  let deduplicationKey: 'email' | 'phone' | 'none' = 'none';

  // First pass: determine deduplication key type
  for (const header of unifiedHeaders) {
    if (isEmailField(header)) {
      deduplicationKey = 'email';
      break;
    } else if (isPhoneNumberField(header)) {
      deduplicationKey = 'phone';
    }
  }

  // Second pass: deduplicate based on the key
  allData.forEach(row => {
    const key = getDeduplicationKey(row, unifiedHeaders);
    
    if (key && seenKeys.has(key)) {
      // Skip duplicate
      return;
    }
    
    if (key) {
      seenKeys.add(key);
    }
    
    // Ensure each row has the same number of columns as headers
    const normalizedRow: ImportedRow = [];
    
    for (let i = 0; i < unifiedHeaders.length; i++) {
      normalizedRow[i] = row[i] || '';
    }
    
    deduplicatedData.push(normalizedRow);
  });

  // Create the merged data array
  const mergedData: ImportedRow[] = [unifiedHeaders, ...deduplicatedData];

  // Create new worksheet from merged data
  const mergedWorksheet = XLSX.utils.aoa_to_sheet(mergedData);

  // Create merged workbook
  const mergedWorkbook: XLSX.WorkBook = {
    SheetNames: ['Merged Candidates'],
    Sheets: {
      'Merged Candidates': mergedWorksheet
    }
  };

  // Calculate statistics
  const stats: DeduplicationStats = {
    totalFiles: files.length,
    totalCandidates: totalCandidatesBeforeDedup,
    deduplicatedCandidates: deduplicatedData.length,
    duplicatesRemoved: totalCandidatesBeforeDedup - deduplicatedData.length,
    deduplicationKey
  };

  return { workbook: mergedWorkbook, stats };
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

  // Deduplication logic for JSON files
  const seenKeys = new Set<string>();
  const deduplicatedApplications: any[] = [];
  let deduplicationKey: 'email' | 'phone' | 'none' = 'none';

  // First pass: determine deduplication key type
  for (const header of allHeaders) {
    if (isEmailField(header)) {
      deduplicationKey = 'email';
      break;
    } else if (isPhoneNumberField(header)) {
      deduplicationKey = 'phone';
    }
  }

  // Second pass: deduplicate based on the key
  allApplications.forEach(application => {
    const key = getDeduplicationKey(Object.values(application), Array.from(allHeaders));
    
    if (key && seenKeys.has(key)) {
      // Skip duplicate
      return;
    }
    
    if (key) {
      seenKeys.add(key);
    }
    
    deduplicatedApplications.push(application);
  });

  if (deduplicatedApplications.length === 0) {
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
  deduplicatedApplications.forEach(application => {
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
