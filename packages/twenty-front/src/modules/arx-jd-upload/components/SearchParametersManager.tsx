import styled from '@emotion/styled';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LinkedInSearchCategory, LinkedInSearchType } from '../types/CandidateSearch';
import { LinkedInParameterSelector } from './LinkedInParameterSelector';

type SearchParametersManagerProps = {
  searchType: LinkedInSearchType;
  searchCategory: LinkedInSearchCategory;
  onParametersChange: (parameters: any) => void;
  generatedParameters?: any;
  resolvedParameters?: any;
};

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
`;

const StyledSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledSectionTitle = styled.h4`
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0;
`;

const StyledInput = styled.input`
  padding: ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
  background-color: ${({ theme }) => theme.background.primary};
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.color.blue20};
  }
`;

const StyledTextArea = styled.textarea`
  padding: ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
  background-color: ${({ theme }) => theme.background.primary};
  min-height: 80px;
  resize: vertical;
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.color.blue20};
  }
`;

const StyledSelect = styled.select`
  padding: ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
  background-color: ${({ theme }) => theme.background.primary};
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.color.blue20};
  }
`;

const StyledLabel = styled.label`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledCheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledCheckbox = styled.input`
  margin: 0;
`;

const StyledGeneratedSection = styled.div`
  padding: ${({ theme }) => theme.spacing(2)};
  background-color: ${({ theme }) => theme.color.green10};
  border: 1px solid ${({ theme }) => theme.color.green20};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
`;

const StyledGeneratedLabel = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.color.green60};
  margin-bottom: ${({ theme }) => theme.spacing(1)};
`;

const StyledResolvedSection = styled.div`
  padding: ${({ theme }) => theme.spacing(2)};
  background-color: ${({ theme }) => theme.color.blue10};
  border: 1px solid ${({ theme }) => theme.color.blue20};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
`;

const StyledResolvedLabel = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.color.blue60};
  margin-bottom: ${({ theme }) => theme.spacing(1)};
`;

export const SearchParametersManager = ({
  searchType,
  searchCategory,
  onParametersChange,
  generatedParameters,
  resolvedParameters,
}: SearchParametersManagerProps) => {
  // Debug logging
  console.log('SearchParametersManager received generatedParameters:', generatedParameters);
  console.log('SearchParametersManager received resolvedParameters:', resolvedParameters);
  
  // Track if we've initialized parameters to prevent infinite loops
  const hasInitialized = useRef(false);
  // Track if we've applied resolved parameters to prevent re-application
  const hasAppliedResolved = useRef(false);
  // Track the last resolved parameters to detect changes
  const lastResolvedParameters = useRef<any>(null);
  
  const [parameters, setParameters] = useState<any>(() => {
    const defaultParams = {
      keywords: '',
      network_distance: [],
      industry: [],
      location: [],
      company: [],
      school: [],
      seniority: [],
      job_type: [],
      presence: [],
      headcount: { min: 0, max: 10000 },
    };

    // Merge with generated parameters if available
    if (generatedParameters) {
      const generated = generatedParameters.classicPeopleSearch || 
                      generatedParameters.classicCompaniesSearch || 
                      generatedParameters.classicJobsSearch || {};
      
      return {
        ...defaultParams,
        keywords: generated.keywords || defaultParams.keywords,
        network_distance: generated.network_distance || defaultParams.network_distance,
        industry: generated.industry || defaultParams.industry,
        location: generated.location || defaultParams.location,
        company: generated.company || defaultParams.company,
        school: generated.school || defaultParams.school,
        seniority: generated.seniority || defaultParams.seniority,
        job_type: generated.job_type || defaultParams.job_type,
        presence: generated.presence || defaultParams.presence,
        headcount: generated.headcount || defaultParams.headcount,
      };
    }

    // If we have resolved parameters, use them instead
    if (resolvedParameters) {
      const resolved = resolvedParameters.classicPeopleSearch || 
                      resolvedParameters.classicCompaniesSearch || 
                      resolvedParameters.classicJobsSearch || {};
      
      return {
        ...defaultParams,
        keywords: resolved.keywords || defaultParams.keywords,
        network_distance: resolved.network_distance || defaultParams.network_distance,
        industry: resolved.industry || defaultParams.industry,
        location: resolved.location || defaultParams.location,
        company: resolved.company || defaultParams.company,
        school: resolved.school || defaultParams.school,
        seniority: resolved.seniority || defaultParams.seniority,
        job_type: resolved.job_type || defaultParams.job_type,
        presence: resolved.presence || defaultParams.presence,
        headcount: resolved.headcount || defaultParams.headcount,
      };
    }

    return defaultParams;
  });

  // Helper function to check if parameters contain LinkedIn IDs (resolved) vs names (unresolved)
  const areParametersResolved = (params: any): boolean => {
    if (!params) return false;
    
    // Check if any parameter arrays contain LinkedIn IDs (typically numeric strings)
    const checkArray = (arr: any[]): boolean => {
      if (!Array.isArray(arr) || arr.length === 0) return false;
      return arr.some(item => 
        typeof item === 'string' && 
        (item.match(/^\d+$/) || item.includes('urn:li:'))
      );
    };
    
    return checkArray(params.industry) || 
           checkArray(params.location) || 
           checkArray(params.company) || 
           checkArray(params.school);
  };

  // Check if we have resolved parameters available (from upload flow or manual resolution)
  const hasResolvedParameters = () => {
    // Check if the current parameters are resolved (contain LinkedIn IDs)
    if (areParametersResolved(parameters)) {
      return true;
    }
    
    // Check if we have resolved parameters from the upload flow
    if (resolvedParameters) {
      return true;
    }
    
    return false;
  };

  // Check if current parameters are user-modified (different from generated)
  const areCurrentParametersModified = () => {
    if (!generatedParameters) return false;
    
    const generated = generatedParameters.classicPeopleSearch || 
                     generatedParameters.classicCompaniesSearch || 
                     generatedParameters.classicJobsSearch || {};
    
    // Compare current parameters with generated ones
    return Object.keys(parameters).some(key => {
      const current = parameters[key];
      const original = generated[key];
      
      if (Array.isArray(current) && Array.isArray(original)) {
        return JSON.stringify([...current].sort()) !== JSON.stringify([...original].sort());
      }
      return JSON.stringify(current) !== JSON.stringify(original);
    });
  };

  const updateParameters = useCallback((newParams: any) => {
    const updated = { ...parameters, ...newParams };
    
    // Check if parameters actually changed to prevent unnecessary updates
    const hasChanged = Object.keys(newParams).some(key => {
      const current = parameters[key];
      const newValue = newParams[key];
      
      if (Array.isArray(current) && Array.isArray(newValue)) {
        return JSON.stringify(current.sort()) !== JSON.stringify(newValue.sort());
      }
      return JSON.stringify(current) !== JSON.stringify(newValue);
    });
    
    if (hasChanged) {
      console.log('SearchParametersManager.updateParameters called:', {
        newParams,
        currentParameters: parameters,
        updatedParameters: updated
      });
      setParameters(updated);
      onParametersChange(updated);
      // Reset the resolved flag since user is modifying parameters
      hasAppliedResolved.current = false;
    }
  }, [parameters, onParametersChange]);

  // Initialize parameters when generatedParameters first become available
  useEffect(() => {
    if (generatedParameters && !hasInitialized.current) {
      const generated = generatedParameters.classicPeopleSearch || 
                      generatedParameters.classicCompaniesSearch || 
                      generatedParameters.classicJobsSearch || {};
      
      const updatedParams = {
        keywords: generated.keywords || '',
        network_distance: generated.network_distance || [],
        industry: generated.industry || [],
        location: generated.location || [],
        company: generated.company || [],
        school: generated.school || [],
        seniority: generated.seniority || [],
        job_type: generated.job_type || [],
        presence: generated.presence || [],
        headcount: generated.headcount || { min: 0, max: 10000 },
      };
      
      setParameters(updatedParams);
      onParametersChange(updatedParams);
      hasInitialized.current = true;
      
      // Log the generated parameters for debugging
      console.log('Generated parameters loaded:', {
        searchType,
        searchCategory,
        generated: generated,
        updatedParams: updatedParams,
        locationArray: generated.location,
        companyArray: generated.company,
        industryArray: generated.industry,
        schoolArray: generated.school
      });
    }
  }, [generatedParameters, onParametersChange, searchType, searchCategory]);

  // Effect to handle resolvedParameters updates - only update if parameters haven't been user-modified
  useEffect(() => {
    // Check if resolvedParameters actually changed
    const resolvedChanged = JSON.stringify(resolvedParameters) !== JSON.stringify(lastResolvedParameters.current);
    
    if (resolvedParameters && hasInitialized.current && resolvedChanged) {
      const resolved = resolvedParameters.classicPeopleSearch || 
                      resolvedParameters.classicCompaniesSearch || 
                      resolvedParameters.classicJobsSearch || {};
      
      // Only update if current parameters haven't been modified by user
      // Check if current parameters are different from the original generated ones
      const currentParamsAreModified = areCurrentParametersModified();
      
      if (!currentParamsAreModified) {
        console.log('Updating parameters with resolved values (no user modifications detected)');
        const updatedParams = {
          keywords: resolved.keywords || parameters.keywords || '',
          network_distance: resolved.network_distance || parameters.network_distance || [],
          industry: resolved.industry || parameters.industry || [],
          location: resolved.location || parameters.location || [],
          company: resolved.company || parameters.company || [],
          school: resolved.school || parameters.school || [],
          seniority: resolved.seniority || parameters.seniority || [],
          job_type: resolved.job_type || parameters.job_type || [],
          presence: resolved.presence || parameters.presence || [],
          headcount: resolved.headcount || parameters.headcount || { min: 0, max: 10000 },
        };
        
        setParameters(updatedParams);
        onParametersChange(updatedParams);
        hasAppliedResolved.current = true;
      } else {
        console.log('Skipping resolved parameters update - user has modified parameters');
        hasAppliedResolved.current = true; // Mark as applied even if skipped
      }
      
      // Update the last resolved parameters reference
      lastResolvedParameters.current = resolvedParameters;
    }
  }, [resolvedParameters]); // Remove parameters and onParametersChange from dependencies to prevent loops

  const handleKeywordsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateParameters({ keywords: e.target.value });
  };

  const handleKeywordsInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateParameters({ keywords: e.target.value });
  };

  const handleNetworkDistanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    const distances = e.target.checked
      ? [...parameters.network_distance, value]
      : parameters.network_distance.filter((d: number) => d !== value);
    updateParameters({ network_distance: distances });
  };

  const handleIndustryChange = (values: string[]) => {
    updateParameters({ industry: values });
  };

  const handleLocationChange = (values: string[]) => {
    updateParameters({ location: values });
  };

  const handleCompanyChange = (values: string[]) => {
    updateParameters({ company: values });
  };

  const handleSchoolChange = (values: string[]) => {
    updateParameters({ school: values });
  };

  const handleSeniorityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(e.target.selectedOptions, option => option.value);
    updateParameters({ seniority: values });
  };

  const handleJobTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(e.target.selectedOptions, option => option.value);
    updateParameters({ job_type: values });
  };

  const handlePresenceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(e.target.selectedOptions, option => option.value);
    updateParameters({ presence: values });
  };

  const handleHeadcountMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateParameters({
      headcount: {
        ...parameters.headcount,
        min: parseInt(e.target.value) || 0,
      },
    });
  };

  const handleHeadcountMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateParameters({
      headcount: {
        ...parameters.headcount,
        max: parseInt(e.target.value) || 10000,
      },
    });
  };

  const renderClassicPeopleParameters = () => (
    <>
      <StyledSection>
        <StyledLabel>Keywords</StyledLabel>
        <StyledTextArea
          value={parameters.keywords || ''}
          onChange={handleKeywordsChange}
          placeholder="Enter job titles, skills, technologies..."
        />
      </StyledSection>

      <StyledSection>
        <StyledSectionTitle>Network Distance</StyledSectionTitle>
        <StyledCheckboxContainer>
          <StyledCheckbox
            type="checkbox"
            id="distance-1"
            value={1}
            checked={parameters.network_distance?.includes(1)}
            onChange={handleNetworkDistanceChange}
          />
          <StyledLabel htmlFor="distance-1">1st connections</StyledLabel>
        </StyledCheckboxContainer>
        <StyledCheckboxContainer>
          <StyledCheckbox
            type="checkbox"
            id="distance-2"
            value={2}
            checked={parameters.network_distance?.includes(2)}
            onChange={handleNetworkDistanceChange}
          />
          <StyledLabel htmlFor="distance-2">2nd connections</StyledLabel>
        </StyledCheckboxContainer>
        <StyledCheckboxContainer>
          <StyledCheckbox
            type="checkbox"
            id="distance-3"
            value={3}
            checked={parameters.network_distance?.includes(3)}
            onChange={handleNetworkDistanceChange}
          />
          <StyledLabel htmlFor="distance-3">3rd connections</StyledLabel>
        </StyledCheckboxContainer>
      </StyledSection>

      <LinkedInParameterSelector
        parameterType="INDUSTRY"
        label="Industries"
        selectedValues={parameters.industry || []}
        onSelectionChange={handleIndustryChange}
      />

      <LinkedInParameterSelector
        parameterType="LOCATION"
        label="Locations"
        selectedValues={parameters.location || []}
        onSelectionChange={handleLocationChange}
      />

      <LinkedInParameterSelector
        parameterType="COMPANY"
        label="Companies"
        selectedValues={parameters.company || []}
        onSelectionChange={handleCompanyChange}
      />

      <LinkedInParameterSelector
        parameterType="SCHOOL"
        label="Schools"
        selectedValues={parameters.school || []}
        onSelectionChange={handleSchoolChange}
      />
    </>
  );

  const renderClassicCompaniesParameters = () => (
    <>
      <StyledSection>
        <StyledLabel>Keywords</StyledLabel>
        <StyledTextArea
          value={parameters.keywords || ''}
          onChange={handleKeywordsChange}
          placeholder="Enter company names, industries, technologies..."
        />
      </StyledSection>

      <LinkedInParameterSelector
        parameterType="INDUSTRY"
        label="Industries"
        selectedValues={parameters.industry || []}
        onSelectionChange={handleIndustryChange}
      />

      <LinkedInParameterSelector
        parameterType="LOCATION"
        label="Locations"
        selectedValues={parameters.location || []}
        onSelectionChange={handleLocationChange}
      />

      <StyledSection>
        <StyledSectionTitle>Company Size</StyledSectionTitle>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <StyledInput
            type="number"
            placeholder="Min employees"
            value={parameters.headcount?.min || ''}
            onChange={handleHeadcountMinChange}
          />
          <span>to</span>
          <StyledInput
            type="number"
            placeholder="Max employees"
            value={parameters.headcount?.max || ''}
            onChange={handleHeadcountMaxChange}
          />
        </div>
      </StyledSection>
    </>
  );

  const renderClassicJobsParameters = () => (
    <>
      <StyledSection>
        <StyledLabel>Keywords</StyledLabel>
        <StyledTextArea
          value={parameters.keywords || ''}
          onChange={handleKeywordsChange}
          placeholder="Enter job titles, skills, technologies..."
        />
      </StyledSection>

      <LinkedInParameterSelector
        parameterType="INDUSTRY"
        label="Industries"
        selectedValues={parameters.industry || []}
        onSelectionChange={handleIndustryChange}
      />

      <LinkedInParameterSelector
        parameterType="LOCATION"
        label="Locations"
        selectedValues={parameters.location || []}
        onSelectionChange={handleLocationChange}
      />

      <LinkedInParameterSelector
        parameterType="COMPANY"
        label="Companies"
        selectedValues={parameters.company || []}
        onSelectionChange={handleCompanyChange}
      />

      <StyledSection>
        <StyledLabel>Seniority Level</StyledLabel>
        <StyledSelect
          multiple
          value={parameters.seniority || []}
          onChange={handleSeniorityChange}
        >
          <option value="executive">Executive</option>
          <option value="director">Director</option>
          <option value="mid_senior">Mid-Senior</option>
          <option value="associate">Associate</option>
          <option value="entry">Entry Level</option>
          <option value="intern">Intern</option>
        </StyledSelect>
      </StyledSection>

      <StyledSection>
        <StyledLabel>Employment Type</StyledLabel>
        <StyledSelect
          multiple
          value={parameters.job_type || []}
          onChange={handleJobTypeChange}
        >
          <option value="full_time">Full Time</option>
          <option value="part_time">Part Time</option>
          <option value="contract">Contract</option>
          <option value="temporary">Temporary</option>
          <option value="volunteer">Volunteer</option>
          <option value="internship">Internship</option>
          <option value="other">Other</option>
        </StyledSelect>
      </StyledSection>

      <StyledSection>
        <StyledLabel>Work Arrangement</StyledLabel>
        <StyledSelect
          multiple
          value={parameters.presence || []}
          onChange={handlePresenceChange}
        >
          <option value="on_site">On Site</option>
          <option value="hybrid">Hybrid</option>
          <option value="remote">Remote</option>
        </StyledSelect>
      </StyledSection>
    </>
  );

  const renderParameters = () => {
    if (searchType === 'classic') {
      switch (searchCategory) {
        case 'people':
          return renderClassicPeopleParameters();
        case 'companies':
          return renderClassicCompaniesParameters();
        case 'jobs':
          return renderClassicJobsParameters();
        default:
          return null;
      }
    }
    // Add other search types (sales_navigator, recruiter) as needed
    return null;
  };

  const isResolved = hasResolvedParameters();
  const hasGeneratedParams = generatedParameters && (
    generatedParameters.classicPeopleSearch || 
    generatedParameters.classicCompaniesSearch || 
    generatedParameters.classicJobsSearch
  );
  const hasModifiedParams = areCurrentParametersModified();

  return (
    <StyledContainer>
      {hasGeneratedParams && !hasModifiedParams && (
        <StyledGeneratedSection>
          <StyledGeneratedLabel>
            ✓ AI-Generated Parameters (You can modify these below)
          </StyledGeneratedLabel>
        </StyledGeneratedSection>
      )}
      
      {hasGeneratedParams && hasModifiedParams && (
        <StyledResolvedSection>
          <StyledResolvedLabel>
            ✏️ Parameters Modified (Custom search criteria)
          </StyledResolvedLabel>
        </StyledResolvedSection>
      )}
      
      {isResolved && !hasModifiedParams && (
        <StyledResolvedSection>
          <StyledResolvedLabel>
            🔗 Parameters Resolved to LinkedIn IDs (Ready for search)
          </StyledResolvedLabel>
        </StyledResolvedSection>
      )}
      {renderParameters()}
    </StyledContainer>
  );
};
