import { tokenPairState } from '@/auth/states/tokenPairState';
import styled from '@emotion/styled';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import { LinkedInSearchCategory, LinkedInSearchType } from '../types/CandidateSearch';
import { ParsedJD } from '../types/ParsedJD';
import { SearchParametersManager } from './SearchParametersManager';

type CandidateSearchParametersFormProps = {
  parsedJD: ParsedJD;
  onSearch: (searchType: LinkedInSearchType, searchCategory: LinkedInSearchCategory, parameters: any) => void;
  isLoading: boolean;
  onSearchRef?: (searchFn: () => void) => void;
  generatedParameters?: any;
};

const StyledForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
`;

const StyledSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledLabel = styled.label`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledSelect = styled.select`
  padding: ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.color.blue};
  }
`;

const StyledInput = styled.input`
  padding: ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.color.blue};
  }
`;

const StyledTextArea = styled.textarea`
  padding: ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  min-height: 80px;
  resize: vertical;
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.color.blue};
  }
`;

const StyledButtonContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  justify-content: flex-end;
`;

const StyledGeneratedParams = styled.div`
  padding: ${({ theme }) => theme.spacing(2)};
  background-color: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledButton = styled.button`
  padding: ${({ theme }) => theme.spacing(2)};
  background-color: ${({ theme }) => theme.color.blue};
  color: ${({ theme }) => theme.font.color.inverted};
  border: none;
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  cursor: pointer;
  
  &:hover {
    background-color: ${({ theme }) => theme.color.blue50};
  }
  
  &:disabled {
    background-color: ${({ theme }) => theme.color.gray20};
    cursor: not-allowed;
  }
`;

const StyledAdvancedSection = styled.div`
  padding: ${({ theme }) => theme.spacing(3)};
  background-color: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
`;

const StyledResolutionStatus = styled.div<{ isResolving: boolean; isResolved: boolean }>`
  padding: ${({ theme }) => theme.spacing(2)};
  background-color: ${({ isResolving, isResolved, theme }) => 
    isResolving ? theme.color.yellow10 : 
    isResolved ? theme.color.green10 : 
    theme.color.gray10};
  border: 1px solid ${({ isResolving, isResolved, theme }) => 
    isResolving ? theme.color.yellow20 : 
    isResolved ? theme.color.green20 : 
    theme.color.gray20};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ isResolving, isResolved, theme }) => 
    isResolving ? theme.color.yellow60 : 
    isResolved ? theme.color.green60 : 
    theme.color.gray60};
`;

const StyledResolutionLabel = styled.div`
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

export const CandidateSearchParametersForm = ({
  parsedJD,
  onSearch,
  isLoading,
  onSearchRef,
  generatedParameters,
}: CandidateSearchParametersFormProps) => {
  const [tokenPair] = useRecoilState(tokenPairState);
  const [searchType, setSearchType] = useState<LinkedInSearchType>('classic');
  const [searchCategory, setSearchCategory] = useState<LinkedInSearchCategory>('people');
  const [easyApply, setEasyApply] = useState<boolean | undefined>(undefined);
  const [inYourNetwork, setInYourNetwork] = useState<boolean | undefined>(undefined);
  const [fairChanceEmployer, setFairChanceEmployer] = useState<boolean | undefined>(undefined);
  const [hasJobOffers, setHasJobOffers] = useState<boolean | undefined>(undefined);
  const [sortBy, setSortBy] = useState<'relevance' | 'date'>('relevance');
  const [datePosted, setDatePosted] = useState<number | undefined>(undefined);
  const [locationWithinArea, setLocationWithinArea] = useState<number | undefined>(undefined);
  const [advancedParameters, setAdvancedParameters] = useState<any>({});
  const [resolvedParameters, setResolvedParameters] = useState<any>(null);
  const [isResolving, setIsResolving] = useState(false);
  const hasSetResolvedParameters = useRef(false);
  
  // Create a stable resolved parameters object that doesn't change unless the actual resolved parameters change
  const stableResolvedParameters = useMemo(() => {
    return resolvedParameters;
  }, [resolvedParameters]);

  // Debug logging
  console.log('CandidateSearchParametersForm received generatedParameters:', generatedParameters);

  // Function to resolve parameters to LinkedIn IDs
  const resolveParameters = useCallback(async (parameters: any) => {
    if (!parameters || !tokenPair?.accessToken?.token) {
      return null;
    }

    setIsResolving(true);
    try {
      const response = await fetch(
        `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-search/resolve-parameters`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenPair.accessToken.token}`,
          },
          body: JSON.stringify({
            searchParameters: parameters,
            searchType,
            searchCategory,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to resolve parameters: ${response.statusText}`);
      }

      const resolved = await response.json();
      console.log('Parameters resolved successfully:', resolved);
      return resolved;
    } catch (error) {
      console.error('Failed to resolve parameters:', error);
      return null;
    } finally {
      setIsResolving(false);
    }
  }, [searchType, searchCategory, tokenPair?.accessToken?.token]);

  // Check if parameters are already resolved from upload flow
  useEffect(() => {
    if (parsedJD.searchParameters?.resolvedSearchParameters && !hasSetResolvedParameters.current) {
      console.log('Parameters already resolved from upload flow');
      setResolvedParameters(parsedJD.searchParameters.resolvedSearchParameters);
      hasSetResolvedParameters.current = true;
    }
  }, [parsedJD.searchParameters?.resolvedSearchParameters]);

  // Initialize resolved parameters immediately if available
  useEffect(() => {
    if (parsedJD.searchParameters?.resolvedSearchParameters && !resolvedParameters) {
      console.log('Initializing resolved parameters from upload flow');
      setResolvedParameters(parsedJD.searchParameters.resolvedSearchParameters);
    }
  }, [parsedJD.searchParameters?.resolvedSearchParameters, resolvedParameters]);

  // Create a stable search function that always calls the current handleSearch
  const stableSearchFunction = useCallback(() => {
    const parameters: any = {
      easyApply: easyApply,
      inYourNetwork: inYourNetwork,
      fairChanceEmployer: fairChanceEmployer,
      hasJobOffers: hasJobOffers,
      sortBy: sortBy,
      datePosted: datePosted,
      locationWithinArea: locationWithinArea,
      ...advancedParameters, // Include advanced parameters from SearchParametersManager
    };
    
    // Remove undefined values
    Object.keys(parameters).forEach(key => {
      if (parameters[key] === undefined) {
        delete parameters[key];
      }
    });
    
    console.log('CandidateSearchParametersForm.stableSearchFunction calling onSearch with:', {
      searchType,
      searchCategory,
      parameters,
      advancedParameters
    });
    
    onSearch(searchType, searchCategory, parameters);
  }, [
    searchType, searchCategory, easyApply, inYourNetwork, fairChanceEmployer, hasJobOffers, 
    sortBy, datePosted, locationWithinArea, onSearch, advancedParameters
  ]);

  const handleAdvancedParametersChange = useCallback((newParameters: any) => {
    console.log('CandidateSearchParametersForm.handleAdvancedParametersChange called:', {
      newParameters,
      currentAdvancedParameters: advancedParameters
    });
    setAdvancedParameters(newParameters);
    
    // Update resolvedParameters to reflect the new user-modified parameters
    // This ensures that when parameters are modified, the resolvedParameters state is updated
    setResolvedParameters((prevResolved: any) => {
      if (prevResolved) {
        // Update the resolved parameters with the new user-modified parameters
        const updatedResolved = { ...prevResolved };
        if (updatedResolved.classicPeopleSearch) {
          updatedResolved.classicPeopleSearch = {
            ...updatedResolved.classicPeopleSearch,
            ...newParameters
          };
        } else if (updatedResolved.classicCompaniesSearch) {
          updatedResolved.classicCompaniesSearch = {
            ...updatedResolved.classicCompaniesSearch,
            ...newParameters
          };
        } else if (updatedResolved.classicJobsSearch) {
          updatedResolved.classicJobsSearch = {
            ...updatedResolved.classicJobsSearch,
            ...newParameters
          };
        }
        return updatedResolved;
      }
      return prevResolved;
    });
  }, []); // Remove advancedParameters from dependencies to prevent recreation


  // Expose search function to parent component
  React.useEffect(() => {
    if (onSearchRef) {
      onSearchRef(stableSearchFunction);
    }
  }, [onSearchRef, stableSearchFunction]);

  const getCurrentKeywords = () => {
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
  };

  return (
    <StyledForm>
      <StyledSection>
        <StyledLabel>Search Type</StyledLabel>
        <StyledSelect
          value={searchType}
          onChange={(e) => setSearchType(e.target.value as LinkedInSearchType)}
        >
          <option value="classic">LinkedIn Classic</option>
          <option value="sales_navigator">Sales Navigator</option>
          <option value="recruiter">LinkedIn Recruiter</option>
        </StyledSelect>
      </StyledSection>

      <StyledSection>
        <StyledLabel>Search Category</StyledLabel>
        <StyledSelect
          value={searchCategory}
          onChange={(e) => setSearchCategory(e.target.value as LinkedInSearchCategory)}
        >
          <option value="people">People</option>
          <option value="companies">Companies</option>
          <option value="jobs">Jobs</option>
          <option value="posts">Posts</option>
        </StyledSelect>
      </StyledSection>

      <StyledSection>
        <StyledLabel>Current Keywords</StyledLabel>
        <StyledGeneratedParams>
          {getCurrentKeywords()}
        </StyledGeneratedParams>
      </StyledSection>

      {Object.keys(advancedParameters).length > 0 && (
        <StyledSection>
          <StyledLabel>Current Search Parameters</StyledLabel>
          <StyledGeneratedParams>
            {Object.entries(advancedParameters)
              .filter(([key, value]) => {
                // Only show non-empty values
                if (Array.isArray(value)) return value.length > 0;
                if (typeof value === 'object' && value !== null) {
                  return Object.values(value).some(v => v !== undefined && v !== null && v !== '');
                }
                return value !== undefined && value !== null && value !== '';
              })
              .map(([key, value]) => {
                let displayValue = '';
                if (Array.isArray(value)) {
                  displayValue = value.join(', ');
                } else if (typeof value === 'object' && value !== null) {
                  displayValue = Object.entries(value)
                    .filter(([k, v]) => v !== undefined && v !== null && v !== '')
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(', ');
                } else {
                  displayValue = String(value);
                }
                return `${key}: ${displayValue}`;
              })
              .join(' | ')}
          </StyledGeneratedParams>
        </StyledSection>
      )}


      {searchCategory === 'jobs' && (
        <>
          <StyledSection>
            <StyledLabel>Sort By</StyledLabel>
            <StyledSelect
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'relevance' | 'date')}
            >
              <option value="relevance">Relevance</option>
              <option value="date">Date Posted</option>
            </StyledSelect>
          </StyledSection>

          <StyledSection>
            <StyledLabel>Date Posted (days ago)</StyledLabel>
            <StyledInput
              type="number"
              value={datePosted || ''}
              onChange={(e) => setDatePosted(e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="e.g., 7 for past week..."
            />
          </StyledSection>

          <StyledSection>
            <StyledLabel>Location Within Area (miles)</StyledLabel>
            <StyledInput
              type="number"
              value={locationWithinArea || ''}
              onChange={(e) => setLocationWithinArea(e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="e.g., 25..."
            />
          </StyledSection>

          <StyledSection>
            <StyledLabel>Easy Apply</StyledLabel>
            <StyledSelect
              value={easyApply === undefined ? '' : easyApply.toString()}
              onChange={(e) => setEasyApply(e.target.value === '' ? undefined : e.target.value === 'true')}
            >
              <option value="">Any</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </StyledSelect>
          </StyledSection>

          <StyledSection>
            <StyledLabel>In Your Network</StyledLabel>
            <StyledSelect
              value={inYourNetwork === undefined ? '' : inYourNetwork.toString()}
              onChange={(e) => setInYourNetwork(e.target.value === '' ? undefined : e.target.value === 'true')}
            >
              <option value="">Any</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </StyledSelect>
          </StyledSection>

          <StyledSection>
            <StyledLabel>Fair Chance Employer</StyledLabel>
            <StyledSelect
              value={fairChanceEmployer === undefined ? '' : fairChanceEmployer.toString()}
              onChange={(e) => setFairChanceEmployer(e.target.value === '' ? undefined : e.target.value === 'true')}
            >
              <option value="">Any</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </StyledSelect>
          </StyledSection>
        </>
      )}

      {searchCategory === 'companies' && (
        <StyledSection>
          <StyledLabel>Has Job Offers</StyledLabel>
          <StyledSelect
            value={hasJobOffers === undefined ? '' : hasJobOffers.toString()}
            onChange={(e) => setHasJobOffers(e.target.value === '' ? undefined : e.target.value === 'true')}
          >
            <option value="">Any</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </StyledSelect>
        </StyledSection>
      )}


        <StyledAdvancedSection>
          <SearchParametersManager
            searchType={searchType}
            searchCategory={searchCategory}
            onParametersChange={handleAdvancedParametersChange}
            generatedParameters={generatedParameters}
            resolvedParameters={stableResolvedParameters}
          />
        </StyledAdvancedSection>

    </StyledForm>
  );
};
