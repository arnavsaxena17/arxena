import { ParsedJD } from '../types/ParsedJD';

/**
 * Consolidates search parameters into a single group per ParsedJD with one assistantThreadId
 * Merges all search parameters from multiple entries into one consolidated entry
 */
export const consolidateSearchParameters = (searchParameters: ParsedJD['searchParameters']): ParsedJD['searchParameters'] => {
  if (!searchParameters || searchParameters.length === 0) {
    return [];
  }

  // Initialize consolidated parameters
  const consolidatedGeneratedParams: any = {};
  const consolidatedResolvedParams: any = {};

  // Process each search parameter entry and merge into single group
  searchParameters.forEach(param => {
    if (!param) return;

    const { generatedSearchParameters, resolvedSearchParameters } = param;

    // Merge generated search parameters
    if (generatedSearchParameters) {
      Object.keys(generatedSearchParameters).forEach(key => {
        const paramValue = (generatedSearchParameters as Record<string, any>)[key];
        if (paramValue && Object.keys(paramValue).length > 0) {
          consolidatedGeneratedParams[key] = paramValue;
        }
      });
    }

    // Merge resolved search parameters
    if (resolvedSearchParameters) {
      Object.keys(resolvedSearchParameters).forEach(key => {
        const paramValue = (resolvedSearchParameters as Record<string, any>)[key];
        if (paramValue && Object.keys(paramValue).length > 0) {
          consolidatedResolvedParams[key] = paramValue;
        }
      });
    }
  });

  // Return single consolidated entry if there are any parameters
  const hasGeneratedParams = Object.keys(consolidatedGeneratedParams).length > 0;
  const hasResolvedParams = Object.keys(consolidatedResolvedParams).length > 0;

  if (hasGeneratedParams || hasResolvedParams) {
    const consolidated = [{
      generatedSearchParameters: hasGeneratedParams ? consolidatedGeneratedParams : {},
      resolvedSearchParameters: hasResolvedParams ? consolidatedResolvedParams : {}
    }];

    console.log('Consolidated search parameters into single group:', {
      original: searchParameters.length,
      consolidated: consolidated.length,
      generatedKeys: Object.keys(consolidatedGeneratedParams),
      resolvedKeys: Object.keys(consolidatedResolvedParams)
    });

    return consolidated;
  }

  return [];
};

/**
 * Finds an existing search parameter entry for a specific search type and category
 * Since we now have only one group, this returns the first (and only) entry if it contains the parameter
 */
export const findSearchParameterEntry = (
  searchParameters: ParsedJD['searchParameters'],
  searchType: string,
  searchCategory: string
): { index: number; entry: any } | null => {
  if (!searchParameters || searchParameters.length === 0) {
    return null;
  }

  const parameterKey = `${searchType}${searchCategory.charAt(0).toUpperCase() + searchCategory.slice(1)}Search`;

  // Since we now have only one consolidated entry, check the first (and only) entry
  const param = searchParameters[0];
  if (!param) return null;

  // Check if this entry contains the parameter we're looking for
  const hasGeneratedParam = param.generatedSearchParameters 
    ? (param.generatedSearchParameters as Record<string, any>)[parameterKey]
    : undefined;
  const hasResolvedParam = param.resolvedSearchParameters
    ? (param.resolvedSearchParameters as Record<string, any>)[parameterKey]
    : undefined;

  if (hasGeneratedParam || hasResolvedParam) {
    return { index: 0, entry: param };
  }

  return null;
};

/**
 * Updates or creates a search parameter entry for a specific search type and category
 * Since we now have only one group, this always updates the first (and only) entry
 */
export const updateSearchParameterEntry = (
  searchParameters: ParsedJD['searchParameters'],
  searchType: string,
  searchCategory: string,
  generatedParameters: any,
  resolvedParameters: any
): ParsedJD['searchParameters'] => {
  const parameterKey = `${searchType}${searchCategory.charAt(0).toUpperCase() + searchCategory.slice(1)}Search`;
  
  // Ensure we have at least one entry
  const updatedSearchParams = searchParameters && searchParameters.length > 0 
    ? [...searchParameters] 
    : [{ generatedSearchParameters: {}, resolvedSearchParameters: {} }];

  // Always update the first (and only) entry
  const existingEntry = updatedSearchParams[0];
  
  updatedSearchParams[0] = {
    ...existingEntry,
    generatedSearchParameters: {
      ...(existingEntry.generatedSearchParameters || {}),
      [parameterKey]: generatedParameters
    } as any,
    resolvedSearchParameters: {
      ...(existingEntry.resolvedSearchParameters || {}),
      [parameterKey]: resolvedParameters
    } as any
  };

  return updatedSearchParams;
};

/**
 * Removes empty or invalid search parameter entries
 * Since we now have only one group, this checks if the single entry has any valid parameters
 */
export const cleanSearchParameters = (searchParameters: ParsedJD['searchParameters']): ParsedJD['searchParameters'] => {
  if (!searchParameters || searchParameters.length === 0) {
    return [];
  }

  // Since we now have only one consolidated entry, check if it has any valid parameters
  const param = searchParameters[0];
  if (!param) return [];

  const hasGeneratedParams = param.generatedSearchParameters && 
    Object.keys(param.generatedSearchParameters).some(key => {
      const paramValue = (param.generatedSearchParameters as Record<string, any>)[key];
      return paramValue && Object.keys(paramValue).length > 0;
    });

  const hasResolvedParams = param.resolvedSearchParameters && 
    Object.keys(param.resolvedSearchParameters).some(key => {
      const paramValue = (param.resolvedSearchParameters as Record<string, any>)[key];
      return paramValue && Object.keys(paramValue).length > 0;
    });

  // Return the single entry if it has any valid parameters, otherwise return empty array
  return (hasGeneratedParams || hasResolvedParams) ? [param] : [];
};

/**
 * Gets the single search parameter group from a ParsedJD
 * Since we now ensure only one group per JD, this returns the first (and only) entry
 */
export const getSingleSearchParameterGroup = (searchParameters: ParsedJD['searchParameters']): {
  generatedSearchParameters?: any;
  resolvedSearchParameters?: any;
} | null => {
  if (!searchParameters || searchParameters.length === 0) {
    return null;
  }

  const param = searchParameters[0];
  if (!param) return null;

  return {
    generatedSearchParameters: param.generatedSearchParameters,
    resolvedSearchParameters: param.resolvedSearchParameters,
  };
};

/**
 * Creates a single search parameter group with assistantThreadId
 * This ensures we always have exactly one group per ParsedJD
 */
export const createSingleSearchParameterGroup = (
  generatedParameters: any = {},
  resolvedParameters: any = {},
  assistantThreadId?: string,
): ParsedJD['searchParameters'] => {
  const group = {
    generatedSearchParameters: generatedParameters,
    resolvedSearchParameters: resolvedParameters,
    ...(assistantThreadId && { assistantThreadId }),
  };

  return [group];
};
