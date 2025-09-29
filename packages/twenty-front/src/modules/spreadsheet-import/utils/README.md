# Simple Matching Utility

A simplified, unified utility for matching Excel/JSON column headers to database fields in the spreadsheet import system.

## Overview

This utility combines the functionality from multiple complex files (`findMatch.ts`, `getMatchedColumns.ts`, `normalizeTableData.ts`, and parts of `MatchColumnsStep.tsx`) into a single, easy-to-use API.

## Key Features

- **Unified API**: Single function call for complete matching workflow
- **Smart Matching**: Exact, fuzzy, and custom mapping support
- **Data Validation**: Built-in phone number and data type validation
- **Type Safety**: Full TypeScript support with proper typing
- **Flexible Configuration**: Customizable matching options
- **Comprehensive Validation**: Required field and data quality checks

## Basic Usage

```typescript
import { matchSpreadsheetData } from './simpleMatchingUtility';

const result = matchSpreadsheetData(
  headers,      // string[] - Column headers from Excel/JSON
  fields,       // Fields<T> - Database fields from your system
  data,         // ImportedRow[] - Raw data rows
  options       // MatchingOptions - Optional configuration
);
```

## API Reference

### `matchSpreadsheetData<T>(headers, fields, data, options?)`

Main function that performs complete matching workflow.

**Parameters:**
- `headers: string[]` - Column headers from the spreadsheet
- `fields: Fields<T>` - Available database fields
- `data: ImportedRow[]` - Raw data rows
- `options: MatchingOptions` - Optional configuration

**Returns:**
```typescript
{
  matches: ColumnMatch<T>[];           // Detailed match results
  normalizedData: Record<string, any>[]; // Processed data ready for import
  validation: { isValid: boolean; errors: string[] }; // Validation results
  summary: {                           // Summary statistics
    totalColumns: number;
    matchedColumns: number;
    unmatchedColumns: number;
    requiredFieldsMatched: boolean;
  }
}
```

### `MatchingOptions`

```typescript
type MatchingOptions = {
  autoMapDistance?: number;           // Max Levenshtein distance for fuzzy matching (default: 3)
  customMappings?: Record<string, string>; // Custom header-to-field mappings
  validateData?: boolean;             // Enable data validation (default: true)
  requiredFields?: string[];          // Fields that must be matched
};
```

### `ColumnMatch<T>`

```typescript
type ColumnMatch<T> = {
  header: string;                     // Original column header
  index: number;                      // Column index
  match: MatchResult<T> | null;       // Match result or null
  data: any[];                        // Column data
  isValid: boolean;                   // Whether the match is valid
};
```

### `MatchResult<T>`

```typescript
type MatchResult<T> = {
  fieldKey: T;                        // Matched field key
  fieldLabel: string;                 // Matched field label
  confidence: 'exact' | 'fuzzy' | 'custom'; // Match confidence level
  score: number;                      // Match score (lower is better)
};
```

## Examples

### Basic Matching

```typescript
import { matchSpreadsheetData } from './simpleMatchingUtility';

const headers = ['Name', 'Email', 'Phone', 'Company'];
const fields = [
  { key: 'firstName', label: 'First Name', /* ... */ },
  { key: 'email', label: 'Email Address', /* ... */ },
  { key: 'phoneNumber', label: 'Phone Number', /* ... */ },
  { key: 'company', label: 'Company', /* ... */ }
];
const data = [
  ['John Doe', 'john@example.com', '+1234567890', 'Acme Corp'],
  ['Jane Smith', 'jane@example.com', '+1987654321', 'Tech Inc']
];

const result = matchSpreadsheetData(headers, fields, data);

console.log('Matched columns:', result.summary.matchedColumns);
console.log('Validation:', result.validation.isValid);
```

### With Custom Mappings

```typescript
const result = matchSpreadsheetData(headers, fields, data, {
  customMappings: {
    'Name': 'firstName',
    'Email': 'email',
    'Mobile': 'phoneNumber'
  },
  requiredFields: ['firstName', 'email'],
  autoMapDistance: 2
});
```

### With Job Context

```typescript
const result = matchSpreadsheetData(headers, fields, data, {
  customMappings: {
    'Default Job Name': 'jobTitle',
    'Job Name': 'jobTitle'
  },
  requiredFields: ['firstName', 'email', 'phoneNumber', 'jobTitle']
});
```

## Advanced Usage

### Individual Functions

You can also use individual functions for more control:

```typescript
import { 
  matchColumnsToFields, 
  normalizeMatchedData, 
  validateMatches 
} from './simpleMatchingUtility';

// Step 1: Match columns
const matches = matchColumnsToFields(headers, fields, data, options);

// Step 2: Normalize data
const normalizedData = normalizeMatchedData(matches, data);

// Step 3: Validate
const validation = validateMatches(matches, requiredFields);
```

### Custom Validation

```typescript
import { validatePhoneNumbers } from './usageExample';

const phoneValidation = validatePhoneNumbers(matches, data);
if (!phoneValidation.isValid) {
  console.log('Invalid phone data in:', phoneValidation.invalidColumns);
}
```

## Migration from Existing Code

### Replace Complex useEffect in MatchColumnsStep.tsx

**Before:**
```typescript
useEffect(() => {
  // 200+ lines of complex matching logic
  // Custom mappings, phone validation, job handling, etc.
}, [autoMapHeaders, autoMapDistance]);
```

**After:**
```typescript
const matchingResult = useSimpleColumnMatching(
  headerValues, 
  fields, 
  data, 
  currentJob
);
```

### Replace handleOnContinue Logic

**Before:**
```typescript
const handleOnContinue = useCallback(async () => {
  // 100+ lines of validation logic
  // Phone number checks, required field validation, etc.
}, [/* many dependencies */]);
```

**After:**
```typescript
const validation = validateRequiredFields(matches, requiredFields);
const phoneValidation = validatePhoneNumbers(matches, data);
```

## Built-in Field Mappings

The utility includes comprehensive alternate matches for common field patterns:

- **Names**: `firstName` → `name`, `first_name`, `candidate`
- **Contact**: `email` → `email_address`, `primary_email`
- **Phone**: `phoneNumber` → `mobile`, `cell`, `phone`
- **Company**: `company` → `organization`, `employer`, `firm`
- **Job**: `jobTitle` → `title`, `position`, `role`
- **Location**: `city` → `location`, `town`, `locality`

## Data Validation

The utility automatically validates:

- **Phone Numbers**: Ensures string data, not JSON objects/arrays
- **Required Fields**: Checks that all required fields are matched
- **Data Types**: Validates data format for specific field types
- **Duplicates**: Prevents duplicate field assignments

## Error Handling

The utility provides comprehensive error reporting:

```typescript
if (!result.validation.isValid) {
  result.validation.errors.forEach(error => {
    console.error('Validation error:', error);
  });
}
```

## Performance

- **Optimized**: Single-pass matching with early returns
- **Memory Efficient**: Minimal data copying
- **Fast**: O(n*m) complexity where n=columns, m=fields
- **Cached**: Alternate matches are pre-computed

## TypeScript Support

Full TypeScript support with:
- Generic type parameters
- Strict type checking
- IntelliSense support
- Compile-time validation

## Testing

Run the test file to see examples:

```bash
npx ts-node simpleMatchingUtility.test.ts
```

## Benefits Over Previous System

1. **Simplified**: 1 file vs 4+ complex files
2. **Maintainable**: Clear, readable code structure
3. **Testable**: Easy to unit test individual functions
4. **Flexible**: Configurable options for different use cases
5. **Type Safe**: Full TypeScript support
6. **Documented**: Comprehensive documentation and examples
7. **Performant**: Optimized for speed and memory usage
