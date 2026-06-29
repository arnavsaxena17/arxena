import { Field, Fields, ImportedRow } from '@/spreadsheet-import/types';
import lavenstein from 'js-levenshtein';

/**
 * Simplified matching utility for spreadsheet import
 * Combines functionality from findMatch, getMatchedColumns, and normalizeTableData
 */

export type MatchResult<T extends string> = {
  fieldKey: T;
  fieldLabel: string;
  confidence: 'exact' | 'fuzzy' | 'custom';
  score: number;
};

export type ColumnMatch<T extends string> = {
  header: string;
  index: number;
  match: MatchResult<T> | null;
  data: any[];
  isValid: boolean;
};

export type MatchingOptions = {
  autoMapDistance?: number;
  customMappings?: Record<string, string>;
  validateData?: boolean;
  requiredFields?: string[];
};

/**
 * Default alternate matches for common field patterns
 */
const DEFAULT_ALTERNATE_MATCHES: Record<string, string[]> = {
  'name': ['name', 'firstname', 'first_name', 'candidate', 'candidate name', 'Name'],
  'lastName': ['lastname', 'last_name', 'surname'],
  'Email (email)': ['emailaddress', 'email_address', 'primaryemail', 'primary_email', 'Email ID', 'email id', 'emailid', 'email'],
  'Phone number (phoneNumber)': ['mobile', 'cell', 'telephone', 'phonenumber', 'mobilephone', 'primaryphonenumber', 'phone_number', 'mobile_phone', 'phone', 'Phone Number', 'phone number'],
  'Phone country code (phoneNumber)': ['countrycode', 'country_code', 'phonecode', 'phone_code'],
  'jobCompanyName': ['organization', 'business', 'employer', 'firm', 'companyname', 'company_name', 'Curr. Company name', 'Current Company', 'company'],
  'jobTitle': ['jobtitle', 'job_title', 'title', 'position', 'jobname', 'job_name', 'occupation', 'role', 'designation', 'Job Title', 'Curr. Company Designation'],
  'city': ['location', 'locationname', 'location_name', 'town', 'locality', 'municipality', 'Current Location', 'Home Town/City'],
  'Location Name': ['location', 'locationname', 'location_name', 'town', 'locality', 'municipality', 'Current Location', 'Home Town/City'],
  'salary': ['inferredsalary', 'inferred_salary', 'ctc', 'compensation', 'pay', 'Annual Salary', 'Ans(What is your current CTC in Lakhs per annum?)'],
  'linkedinUrl': ['linkedin', 'linkedinurl', 'linkedin_url', 'linkedin profile', 'linkedin link'],
  'twitterUrl': ['twitter', 'x', 'twitterurl', 'twitter_url', 'xurl', 'x_url'],
  'profilePicture': ['profilepicture', 'profile_picture', 'avatar', 'photo', 'picture'],
  'uniqueStringKey': ['uniquekeystring', 'unique_key_string', 'uniquekey', 'unique_key', 'id'],
  'updatedAt': ['lastupdated', 'last_updated', 'updated', 'modified', 'lastmodified'],
  'createdBy': ['creator', 'created_by', 'author'],
  'deletedAt': ['deleted', 'deleted_at', 'isdeleted', 'is_deleted'],
  'naukriHiringUrl': ['naukriHiringUrl', 'Hiring Naukri URL', 'Hiring Naukri Link'],
  'status': ['candidate_status', 'candidatestatus'],
  'remarks': ['notes', 'comments', 'note', 'Summary'],
  'source': ['sourcechannel', 'source_channel', 'lead_source', 'Source'],
  'messagingChannel': ['messaging_channel', 'channel', 'communication_channel'],
  'engagementStatus': ['engagement_status', 'isengaged', 'is_engaged'],
  'whatsappProvider': ['whatsapp_provider', 'provider'],
  'isProfilePurchased': ['is_profile_purchased', 'profilepurchased', 'profile_purchased'],
  'chatCount': ['chat_count', 'messagecount', 'message_count'],
  'campaign': ['campaignname', 'campaign_name'],
  'lastMessage': ['last_message', 'recentmessage', 'recent_message'],
  'hasCv': ['has_cv', 'cvavailable', 'cv_available', 'resumeavailable', 'resume_available', 'Resume Headline'],
};

/**
 * Check if two strings match exactly (case-insensitive)
 */
const isExactMatch = (a: string, b: string): boolean => {
  return a.toLowerCase().trim() === b.toLowerCase().trim();
};

/**
 * Check if a field is a phone number field
 */
const isPhoneNumberField = (fieldKey: string): boolean => {
  return (fieldKey.toLowerCase().includes('phone') && 
          !fieldKey.toLowerCase().includes('country code')) ||
         fieldKey === 'Phone number (phoneNumber)';
};

/**
 * Check if a field is a country code field
 */
const isCountryCodeField = (fieldKey: string, fieldLabel: string): boolean => {
  return (fieldKey.toLowerCase().includes('country code') || 
          fieldKey.toLowerCase().includes('phonecode') ||
          fieldKey.toLowerCase().includes('phone_code')) ||
         (fieldLabel.toLowerCase().includes('country code'));
};

/**
 * Validate phone number data
 */
const isValidPhoneData = (data: any[]): boolean => {
  return data.some(value => {
    if (value === undefined || value === '') return false;
    if (typeof value !== 'string') return false;
    if (value.trim().startsWith('[') || value.trim().startsWith('{')) return false;
    return value.trim() !== '';
  });
};

/**
 * Get alternate matches for a field
 */
const getAlternateMatches = <T extends string>(field: Field<T>): string[] => {
  const alternates = field.alternateMatches ? [...field.alternateMatches] : [];
  const defaultAlternates = DEFAULT_ALTERNATE_MATCHES[field.key] || [];
  return [...alternates, ...defaultAlternates];
};

/**
 * Calculate match score between header and field
 */
const calculateMatchScore = <T extends string>(
  header: string,
  field: Field<T>,
  data: any[]
): { score: number; confidence: 'exact' | 'fuzzy' } => {
  const headerLower = header.toLowerCase();
  const fieldKeyLower = field.key.toLowerCase();
  const fieldLabelLower = field.label.toLowerCase();
  
  // Exact matches get highest score
  if (isExactMatch(header, field.key)) {
    return { score: 0, confidence: 'exact' };
  }
  
  if (isExactMatch(header, field.label)) {
    return { score: 0, confidence: 'exact' };
  }
  
  // Check alternate matches
  const alternates = getAlternateMatches(field);
  for (const alternate of alternates) {
    if (isExactMatch(header, alternate)) {
      return { score: 0, confidence: 'exact' };
    }
  }
  
  // Calculate Levenshtein distance for fuzzy matching
  const distances = [
    lavenstein(headerLower, fieldKeyLower),
    lavenstein(headerLower, fieldLabelLower),
    ...alternates.map(alt => lavenstein(headerLower, alt.toLowerCase()))
  ];
  
  const minDistance = Math.min(...distances);
  return { score: minDistance, confidence: 'fuzzy' };
};

/**
 * Find the best match for a column header
 */
const findBestMatch = <T extends string>(
  header: string,
  fields: Fields<T>,
  data: any[],
  options: MatchingOptions
): MatchResult<T> | null => {
  const { autoMapDistance = 3, customMappings, validateData = true } = options;
  
  // Check custom mappings first
  if (customMappings?.[header]) {
    const field = fields.find(f => f.key === customMappings![header]);
    if (field) {
      // Validate custom mapping if needed
      if (validateData && isPhoneNumberField(field.key) && !isValidPhoneData(data)) {
        return null;
      }
      return {
        fieldKey: field.key as T,
        fieldLabel: field.label,
        confidence: 'custom',
        score: 0
      };
    }
  }
  
  let bestMatch: MatchResult<T> | null = null;
  let bestScore = Infinity;
  
  for (const field of fields) {
    // Special handling for phone number fields
    if (isPhoneNumberField(field.key)) {
      const isPhoneHeader = header.toLowerCase().includes('phone') || 
                           header.toLowerCase().includes('mobile') ||
                           header.toLowerCase().includes('cell');
      
      // Skip country code fields for phone headers
      if (isPhoneHeader && isCountryCodeField(field.key, field.label)) {
        continue;
      }
      
      // Validate phone data if needed
      if (validateData && !isValidPhoneData(data)) {
        continue;
      }
    }
    
    // Skip country code fields for non-phone headers
    if (!header.toLowerCase().includes('phone') && 
        !header.toLowerCase().includes('mobile') &&
        !header.toLowerCase().includes('cell') &&
        isCountryCodeField(field.key, field.label)) {
      continue;
    }
    
    const { score, confidence } = calculateMatchScore(header, field as Field<string>, data);
    
    if (score < bestScore && score <= autoMapDistance) {
      bestScore = score;
      bestMatch = {
        fieldKey: field.key as T,
        fieldLabel: field.label,
        confidence,
        score
      };
    }
  }
  
  return bestMatch;
};

/**
 * Main matching function - matches column headers to database fields
 */
export const matchColumnsToFields = <T extends string>(
  headers: string[],
  fields: Fields<T>,
  data: ImportedRow[],
  options: MatchingOptions = {}
): ColumnMatch<T>[] => {
  const { requiredFields = [] } = options;
  
  if (!fields || fields.length === 0) {
    console.warn('No fields provided for matching');
    return headers.map((header, index) => ({
      header,
      index,
      match: null,
      data: data.map(row => row[index]),
      isValid: false
    }));
  }
  
  const results: ColumnMatch<T>[] = [];
  const usedFields = new Set<string>();
  
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const columnData = data.map(row => row[i]);
    
    const match = findBestMatch(header, fields, columnData, options);
    
    // Check for duplicates
    if (match && usedFields.has(match.fieldKey)) {
      // Try to find alternative match
      const alternativeMatch = findBestMatch(
        header, 
        fields.filter(f => f.key !== match.fieldKey), 
        columnData, 
        options
      );
      
      if (alternativeMatch) {
        usedFields.add(alternativeMatch.fieldKey);
        results.push({
          header,
          index: i,
          match: alternativeMatch as MatchResult<T>,
          data: columnData,
          isValid: true
        });
      } else {
        results.push({
          header,
          index: i,
          match: null,
          data: columnData,
          isValid: false
        });
      }
    } else if (match) {
      usedFields.add(match.fieldKey);
      results.push({
        header,
        index: i,
        match: match as MatchResult<T>,
        data: columnData,
        isValid: true
      });
    } else {
      results.push({
        header,
        index: i,
        match: null,
        data: columnData,
        isValid: false
      });
    }
  }
  
  return results;
};

/**
 * Normalize matched data for import
 */
export const normalizeMatchedData = <T extends string>(
  matches: ColumnMatch<T>[],
  data: ImportedRow[]
): Record<string, any>[] => {
  return data.map(row => {
    const normalizedRow: Record<string, any> = {};
    
    for (const match of matches) {
      if (match.match && match.isValid) {
        const value = row[match.index];
        
        // Special handling for phone numbers
        if (isPhoneNumberField(match.match.fieldKey)) {
          if (typeof value === 'string' && value.trim() !== '') {
            normalizedRow[match.match.fieldKey] = value;
          } else {
            normalizedRow[match.match.fieldKey] = undefined;
          }
        } else {
          // General handling
          normalizedRow[match.match.fieldKey] = value === '' ? undefined : value;
        }
      }
    }
    
    return normalizedRow;
  });
};

/**
 * Get unmatched required fields
 */
export const getUnmatchedRequiredFields = <T extends string>(
  matches: ColumnMatch<T>[],
  requiredFields: string[]
): string[] => {
  const matchedFields = matches
    .filter(match => match.match && match.isValid)
    .map(match => match.match!.fieldKey);
  
  return requiredFields.filter(field => !matchedFields.includes(field as T));
};

/**
 * Validate all matches
 */
export const validateMatches = <T extends string>(
  matches: ColumnMatch<T>[],
  requiredFields: string[] = []
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Check for unmatched required fields
  const unmatchedRequired = getUnmatchedRequiredFields(matches, requiredFields);
  if (unmatchedRequired.length > 0) {
    errors.push(`Missing required fields: ${unmatchedRequired.join(', ')}`);
  }
  
  // Only check for invalid matches if they are required fields
  const invalidRequiredMatches = matches.filter(match => 
    !match.isValid && 
    match.match && 
    requiredFields.includes(match.match.fieldKey)
  );
  if (invalidRequiredMatches.length > 0) {
    errors.push(`Invalid matches for required columns: ${invalidRequiredMatches.map(m => m.header).join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Simple API for complete matching workflow
 */
export const matchSpreadsheetData = <T extends string>(
  headers: string[],
  fields: Fields<T>,
  data: ImportedRow[],
  options: MatchingOptions = {}
) => {
  const matches = matchColumnsToFields(headers, fields, data, options);
  const normalizedData = normalizeMatchedData(matches, data);
  const validation = validateMatches(matches, options.requiredFields);
  
  return {
    matches,
    normalizedData,
    validation,
    summary: {
      totalColumns: headers.length,
      matchedColumns: matches.filter(m => m.match && m.isValid).length,
      unmatchedColumns: matches.filter(m => !m.match || !m.isValid).length,
      requiredFieldsMatched: validation.isValid
    }
  };
};
