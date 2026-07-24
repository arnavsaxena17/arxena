import { ParsedJD } from '@/arx-jd-upload/types/ParsedJD';
import { useCallback } from 'react';
import { StyledGeneratedParams, StyledLabel, StyledSection } from '../../styles/SearchFormComponents.styled';

type ParametersDisplayProps = {
  parsedJD: ParsedJD;
  advancedParameters: any;
  searchType: string;
  searchCategory: string;
  resolvedParameters: any;
};

export const ParametersDisplay = ({
  parsedJD,
  advancedParameters,
  searchType,
  searchCategory,
  resolvedParameters,
}: ParametersDisplayProps) => {

  
  const getCurrentKeywords = useCallback(() => {
    // First check if we have keywords from the advanced parameters (user-modified)
    if (advancedParameters?.keywords) {
      return advancedParameters.keywords;
    }
    
    // Fall back to generated keywords from the job description
    const keywords = [];
    if (parsedJD.name) keywords.push(parsedJD.name);
    if (parsedJD.description) {
      // Extract key terms from description
      const words = parsedJD.description.split(' ').filter(word => 
        word.length > 3 && 
        !['the', 'and', 'for', 'with', 'this', 'that', 'will', 'can', 'are', 'you'].includes(word.toLowerCase())
      );
      keywords.push(...words.slice(0, 5)); // Take first 5 meaningful words
    }
    return keywords.join(' ');
  }, [advancedParameters?.keywords, parsedJD.name, parsedJD.description]);

  // Helper: get the resolved block for current search type/category
  const getCurrentResolvedBlock = useCallback((): any => {
    if (!resolvedParameters) return null;
    
    // Convert searchType to camelCase to match backend parameter key construction
    const camelCaseSearchType = searchType.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    const capitalizedCategory = searchCategory.charAt(0).toUpperCase() + searchCategory.slice(1);
    const parameterKey = `${camelCaseSearchType}${capitalizedCategory}Search`;
    
    return resolvedParameters[parameterKey] || null;
  }, [resolvedParameters, searchType, searchCategory]);

  // Helper: format values for display using *_display when available
  const formatDisplayValue = useCallback((key: string, value: any): string => {
    if (value === undefined || value === null) return '';
    const resolvedBlock = getCurrentResolvedBlock();
    const mappableKeys = new Set(['industry', 'location', 'company', 'school', 'past_company']);
    console.log('formatDisplayValue', key, value, resolvedBlock);
    if (Array.isArray(value)) {
      if (mappableKeys.has(key) && resolvedBlock && Array.isArray(resolvedBlock[`${key}_display`])) {
        const displayArr = resolvedBlock[`${key}_display`] as Array<{ id: string; title: string }>;
        const idToTitle = new Map(displayArr.map((d) => [d.id, d.title]));
        const titles = value.map((v) => idToTitle.get(String(v)) || String(v));
        return titles.join(', ');
      }
      return value.join(', ');
    }
    if (typeof value === 'object') {
      return Object.entries(value)
        .filter(([_, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
    }
    return String(value);
  }, [getCurrentResolvedBlock]);

  return (
    <>
      {/* <StyledSection>
        <StyledLabel>Current Keywords</StyledLabel>
        <StyledGeneratedParams>
          {getCurrentKeywords()}
        </StyledGeneratedParams>
      </StyledSection> */}

      {Object.keys(advancedParameters).length > 0 && (
        <StyledSection>
          <StyledLabel>Current Search Parameters</StyledLabel>
          <StyledGeneratedParams>
            {Object.entries(advancedParameters)
              .filter(([_, value]) => {
                if (Array.isArray(value)) return value.length > 0;
                if (typeof value === 'object' && value !== null) {
                  return Object.values(value).some(v => v !== undefined && v !== null && v !== '');
                }
                return value !== undefined && value !== null && value !== '';
              })
              .map(([key, value]) => {
                const formattedValue = formatDisplayValue(key, value);
                return `${key}: ${formattedValue}`;
              })
              .join('\n')}
          </StyledGeneratedParams>
        </StyledSection>
      )}
    </>
  );
};
