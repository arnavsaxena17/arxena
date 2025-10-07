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
  searchFilterId?: string;
  onSearchFilterUpdate?: (
    searchFilterId: string,
    searchType: LinkedInSearchType,
    searchCategory: LinkedInSearchCategory,
    generatedParameters: any,
    resolvedParameters: any
  ) => Promise<void>;
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
  searchFilterId,
  onSearchFilterUpdate,
}: SearchParametersManagerProps) => {
  // Debug logging - only log when values actually change to reduce noise
  const lastLoggedGeneratedParams = useRef<any>(null);
  const lastLoggedResolvedParams = useRef<any>(null);
  
  useEffect(() => {
    const currentGeneratedStr = JSON.stringify(generatedParameters);
    const lastGeneratedStr = JSON.stringify(lastLoggedGeneratedParams.current);
    if (currentGeneratedStr !== lastGeneratedStr) {
      console.log('SearchParametersManager received generatedParameters:', generatedParameters);
      lastLoggedGeneratedParams.current = generatedParameters;
    }
  }, [generatedParameters]);
  
  useEffect(() => {
    const currentResolvedStr = JSON.stringify(resolvedParameters);
    const lastResolvedStr = JSON.stringify(lastLoggedResolvedParams.current);
    if (currentResolvedStr !== lastResolvedStr) {
      console.log('SearchParametersManager received resolvedParameters:', resolvedParameters);
      lastLoggedResolvedParams.current = resolvedParameters;
    }
  }, [resolvedParameters]);
  
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
      // Sales Navigator specific fields
      tenure: { min: undefined, max: undefined },
      company_headcount: { min: undefined, max: undefined },
      function: { include: [], exclude: [] },
      role: { include: [], exclude: [] },
      company_type: [],
      tenure_at_company: { min: undefined, max: undefined },
      tenure_at_role: { min: undefined, max: undefined },
      past_role: { include: [], exclude: [] },
      following_your_company: false,
      viewed_your_profile_recently: false,
      posted_on_linkedin: false,
      changed_jobs: false,
      past_colleague: false,
      shared_experiences: false,
      mentionned_in_news: false,
      viewed_profile_recently: false,
      messaged_recently: false,
      include_saved_leads: false,
      include_saved_accounts: false,
    };

    // Merge with generated parameters if available
    if (generatedParameters) {
      let generated: any = {};
      
      // Get the appropriate generated parameters based on search type and category
      if (searchType === 'classic') {
        if (searchCategory === 'people') {
          generated = generatedParameters.classicPeopleSearch || {};
        } else if (searchCategory === 'companies') {
          generated = generatedParameters.classicCompaniesSearch || {};
        } else if (searchCategory === 'jobs') {
          generated = generatedParameters.classicJobsSearch || {};
        }
      } else if (searchType === 'sales_navigator') {
        if (searchCategory === 'people') {
          generated = generatedParameters.salesNavigatorPeopleSearch || {};
        } else if (searchCategory === 'companies') {
          generated = generatedParameters.salesNavigatorCompaniesSearch || {};
        }
      } else if (searchType === 'recruiter' && searchCategory === 'people') {
        generated = generatedParameters.recruiterPeopleSearch || {};
      }
      
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
        // Sales Navigator specific fields
        tenure: generated.tenure || defaultParams.tenure,
        company_headcount: generated.company_headcount || defaultParams.company_headcount,
        function: generated.function || defaultParams.function,
        role: generated.role || defaultParams.role,
        company_type: generated.company_type || defaultParams.company_type,
        tenure_at_company: generated.tenure_at_company || defaultParams.tenure_at_company,
        tenure_at_role: generated.tenure_at_role || defaultParams.tenure_at_role,
        past_role: generated.past_role || defaultParams.past_role,
        following_your_company: generated.following_your_company ?? defaultParams.following_your_company,
        viewed_your_profile_recently: generated.viewed_your_profile_recently ?? defaultParams.viewed_your_profile_recently,
        posted_on_linkedin: generated.posted_on_linkedin ?? defaultParams.posted_on_linkedin,
        changed_jobs: generated.changed_jobs ?? defaultParams.changed_jobs,
        past_colleague: generated.past_colleague ?? defaultParams.past_colleague,
        shared_experiences: generated.shared_experiences ?? defaultParams.shared_experiences,
        mentionned_in_news: generated.mentionned_in_news ?? defaultParams.mentionned_in_news,
        viewed_profile_recently: generated.viewed_profile_recently ?? defaultParams.viewed_profile_recently,
        messaged_recently: generated.messaged_recently ?? defaultParams.messaged_recently,
        include_saved_leads: generated.include_saved_leads ?? defaultParams.include_saved_leads,
        include_saved_accounts: generated.include_saved_accounts ?? defaultParams.include_saved_accounts,
      };
    }

    // If we have resolved parameters, use them instead
    if (resolvedParameters) {
      let resolved: any = {};
      
      // Get the appropriate resolved parameters based on search type and category
      if (searchType === 'classic') {
        if (searchCategory === 'people') {
          resolved = resolvedParameters.classicPeopleSearch || {};
        } else if (searchCategory === 'companies') {
          resolved = resolvedParameters.classicCompaniesSearch || {};
        } else if (searchCategory === 'jobs') {
          resolved = resolvedParameters.classicJobsSearch || {};
        }
      } else if (searchType === 'sales_navigator') {
        if (searchCategory === 'people') {
          resolved = resolvedParameters.salesNavigatorPeopleSearch || {};
        } else if (searchCategory === 'companies') {
          resolved = resolvedParameters.salesNavigatorCompaniesSearch || {};
        }
      } else if (searchType === 'recruiter' && searchCategory === 'people') {
        resolved = resolvedParameters.recruiterPeopleSearch || {};
      }
      
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
        // Sales Navigator specific fields
        tenure: resolved.tenure || defaultParams.tenure,
        company_headcount: resolved.company_headcount || defaultParams.company_headcount,
        function: resolved.function || defaultParams.function,
        role: resolved.role || defaultParams.role,
        company_type: resolved.company_type || defaultParams.company_type,
        tenure_at_company: resolved.tenure_at_company || defaultParams.tenure_at_company,
        tenure_at_role: resolved.tenure_at_role || defaultParams.tenure_at_role,
        past_role: resolved.past_role || defaultParams.past_role,
        following_your_company: resolved.following_your_company ?? defaultParams.following_your_company,
        viewed_your_profile_recently: resolved.viewed_your_profile_recently ?? defaultParams.viewed_your_profile_recently,
        posted_on_linkedin: resolved.posted_on_linkedin ?? defaultParams.posted_on_linkedin,
        changed_jobs: resolved.changed_jobs ?? defaultParams.changed_jobs,
        past_colleague: resolved.past_colleague ?? defaultParams.past_colleague,
        shared_experiences: resolved.shared_experiences ?? defaultParams.shared_experiences,
        mentionned_in_news: resolved.mentionned_in_news ?? defaultParams.mentionned_in_news,
        viewed_profile_recently: resolved.viewed_profile_recently ?? defaultParams.viewed_profile_recently,
        messaged_recently: resolved.messaged_recently ?? defaultParams.messaged_recently,
        include_saved_leads: resolved.include_saved_leads ?? defaultParams.include_saved_leads,
        include_saved_accounts: resolved.include_saved_accounts ?? defaultParams.include_saved_accounts,
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
    
    let generated: any = {};
    
    // Get the appropriate generated parameters based on search type and category
    if (searchType === 'classic') {
      if (searchCategory === 'people') {
        generated = generatedParameters.classicPeopleSearch || {};
      } else if (searchCategory === 'companies') {
        generated = generatedParameters.classicCompaniesSearch || {};
      } else if (searchCategory === 'jobs') {
        generated = generatedParameters.classicJobsSearch || {};
      }
    } else if (searchType === 'sales_navigator') {
      if (searchCategory === 'people') {
        generated = generatedParameters.salesNavigatorPeopleSearch || {};
      } else if (searchCategory === 'companies') {
        generated = generatedParameters.salesNavigatorCompaniesSearch || {};
      }
    } else if (searchType === 'recruiter' && searchCategory === 'people') {
      generated = generatedParameters.recruiterPeopleSearch || {};
    }
    
    // If no generated parameters exist for this search type/category, 
    // don't consider it modified (it's just not generated yet)
    if (!generated || Object.keys(generated).length === 0) {
      console.log('No generated parameters for this search type/category - not considered modified');
      return false;
    }
    
    // Compare current parameters with generated ones
    const isModified = Object.keys(parameters).some(key => {
      const current = parameters[key];
      const original = generated[key];
      
      if (Array.isArray(current) && Array.isArray(original)) {
        return JSON.stringify([...current].sort()) !== JSON.stringify([...original].sort());
      }
      return JSON.stringify(current) !== JSON.stringify(original);
    });
    
    console.log('Parameters modification check:', {
      searchType,
      searchCategory,
      isModified,
      generatedKeys: Object.keys(generated),
      parametersKeys: Object.keys(parameters)
    });
    
    return isModified;
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

  // Function to update search filter record when parameters change
  const updateSearchFilterRecord = useCallback(async (
    newSearchType: LinkedInSearchType,
    newSearchCategory: LinkedInSearchCategory,
    newGeneratedParameters: any,
    newResolvedParameters: any
  ) => {
    if (!searchFilterId || !onSearchFilterUpdate) {
      return;
    }

    try {
      await onSearchFilterUpdate(
        searchFilterId,
        newSearchType,
        newSearchCategory,
        newGeneratedParameters,
        newResolvedParameters
      );
    } catch (error) {
      console.error('Failed to update search filter record:', error);
    }
  }, [searchFilterId, onSearchFilterUpdate]);

  // Initialize parameters when generatedParameters first become available
  useEffect(() => {
    if (generatedParameters && !hasInitialized.current) {
      let generated: any = {};
      
      // Get the appropriate generated parameters based on search type and category
      if (searchType === 'classic') {
        if (searchCategory === 'people') {
          generated = generatedParameters.classicPeopleSearch || {};
        } else if (searchCategory === 'companies') {
          generated = generatedParameters.classicCompaniesSearch || {};
        } else if (searchCategory === 'jobs') {
          generated = generatedParameters.classicJobsSearch || {};
        }
      } else if (searchType === 'sales_navigator') {
        if (searchCategory === 'people') {
          generated = generatedParameters.salesNavigatorPeopleSearch || {};
        } else if (searchCategory === 'companies') {
          generated = generatedParameters.salesNavigatorCompaniesSearch || {};
        }
      } else if (searchType === 'recruiter' && searchCategory === 'people') {
        generated = generatedParameters.recruiterPeopleSearch || {};
      }
      
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
        // Sales Navigator specific fields
        tenure: generated.tenure || { min: undefined, max: undefined },
        company_headcount: generated.company_headcount || { min: undefined, max: undefined },
        function: generated.function || { include: [], exclude: [] },
        role: generated.role || { include: [], exclude: [] },
        company_type: generated.company_type || [],
        tenure_at_company: generated.tenure_at_company || { min: undefined, max: undefined },
        tenure_at_role: generated.tenure_at_role || { min: undefined, max: undefined },
        past_role: generated.past_role || { include: [], exclude: [] },
        following_your_company: generated.following_your_company ?? false,
        viewed_your_profile_recently: generated.viewed_your_profile_recently ?? false,
        posted_on_linkedin: generated.posted_on_linkedin ?? false,
        changed_jobs: generated.changed_jobs ?? false,
        past_colleague: generated.past_colleague ?? false,
        shared_experiences: generated.shared_experiences ?? false,
        mentionned_in_news: generated.mentionned_in_news ?? false,
        viewed_profile_recently: generated.viewed_profile_recently ?? false,
        messaged_recently: generated.messaged_recently ?? false,
        include_saved_leads: generated.include_saved_leads ?? false,
        include_saved_accounts: generated.include_saved_accounts ?? false,
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
      let resolved: any = {};
      
      // Get the appropriate resolved parameters based on search type and category
      if (searchType === 'classic') {
        if (searchCategory === 'people') {
          resolved = resolvedParameters.classicPeopleSearch || {};
        } else if (searchCategory === 'companies') {
          resolved = resolvedParameters.classicCompaniesSearch || {};
        } else if (searchCategory === 'jobs') {
          resolved = resolvedParameters.classicJobsSearch || {};
        }
      } else if (searchType === 'sales_navigator') {
        if (searchCategory === 'people') {
          resolved = resolvedParameters.salesNavigatorPeopleSearch || {};
        } else if (searchCategory === 'companies') {
          resolved = resolvedParameters.salesNavigatorCompaniesSearch || {};
        }
      } else if (searchType === 'recruiter' && searchCategory === 'people') {
        resolved = resolvedParameters.recruiterPeopleSearch || {};
      }
      
      // Only update if current parameters haven't been modified by user
      // Check if current parameters are different from the original generated ones
      const currentParamsAreModified = areCurrentParametersModified();
      
      console.log('SearchParametersManager resolved parameters effect:', {
        searchType,
        searchCategory,
        currentParamsAreModified,
        hasInitialized: hasInitialized.current,
        resolvedChanged,
        resolvedParameters: resolvedParameters
      });
      
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
          // Sales Navigator specific fields
          tenure: resolved.tenure || parameters.tenure || { min: undefined, max: undefined },
          company_headcount: resolved.company_headcount || parameters.company_headcount || { min: undefined, max: undefined },
          function: resolved.function || parameters.function || { include: [], exclude: [] },
          role: resolved.role || parameters.role || { include: [], exclude: [] },
          company_type: resolved.company_type || parameters.company_type || [],
          tenure_at_company: resolved.tenure_at_company || parameters.tenure_at_company || { min: undefined, max: undefined },
          tenure_at_role: resolved.tenure_at_role || parameters.tenure_at_role || { min: undefined, max: undefined },
          past_role: resolved.past_role || parameters.past_role || { include: [], exclude: [] },
          following_your_company: resolved.following_your_company ?? parameters.following_your_company ?? false,
          viewed_your_profile_recently: resolved.viewed_your_profile_recently ?? parameters.viewed_your_profile_recently ?? false,
          posted_on_linkedin: resolved.posted_on_linkedin ?? parameters.posted_on_linkedin ?? false,
          changed_jobs: resolved.changed_jobs ?? parameters.changed_jobs ?? false,
          past_colleague: resolved.past_colleague ?? parameters.past_colleague ?? false,
          shared_experiences: resolved.shared_experiences ?? parameters.shared_experiences ?? false,
          mentionned_in_news: resolved.mentionned_in_news ?? parameters.mentionned_in_news ?? false,
          viewed_profile_recently: resolved.viewed_profile_recently ?? parameters.viewed_profile_recently ?? false,
          messaged_recently: resolved.messaged_recently ?? parameters.messaged_recently ?? false,
          include_saved_leads: resolved.include_saved_leads ?? parameters.include_saved_leads ?? false,
          include_saved_accounts: resolved.include_saved_accounts ?? parameters.include_saved_accounts ?? false,
        };
        
        setParameters(updatedParams);
        onParametersChange(updatedParams);
        hasAppliedResolved.current = true;
        
        // Update search filter record with merged resolved parameters
        console.log('SearchParametersManager calling updateSearchFilterRecord with merged parameters:', {
          searchType,
          searchCategory,
          generatedParameters,
          resolvedParameters
        });
        updateSearchFilterRecord(searchType, searchCategory, generatedParameters, resolvedParameters);
      } else {
        console.log('Skipping resolved parameters update - user has modified parameters');
        hasAppliedResolved.current = true; // Mark as applied even if skipped
      }
      
      // Update the last resolved parameters reference
      lastResolvedParameters.current = resolvedParameters;
    }
  }, [JSON.stringify(resolvedParameters)]); // Use JSON.stringify for deep comparison to prevent loops

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

  const renderSalesNavigatorPeopleParameters = () => (
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

      <LinkedInParameterSelector
        parameterType="SCHOOL"
        label="Schools"
        selectedValues={parameters.school || []}
        onSelectionChange={handleSchoolChange}
      />

      {/* Sales Navigator specific fields */}
      <StyledSection>
        <StyledSectionTitle>Experience (Tenure)</StyledSectionTitle>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <StyledInput
            type="number"
            placeholder="Min years"
            value={parameters.tenure?.min || ''}
            onChange={(e) => updateParameters({
              tenure: {
                ...parameters.tenure,
                min: parseInt(e.target.value) || undefined
              }
            })}
          />
          <span>to</span>
          <StyledInput
            type="number"
            placeholder="Max years"
            value={parameters.tenure?.max || ''}
            onChange={(e) => updateParameters({
              tenure: {
                ...parameters.tenure,
                max: parseInt(e.target.value) || undefined
              }
            })}
          />
        </div>
      </StyledSection>

      <StyledSection>
        <StyledSectionTitle>Company Size</StyledSectionTitle>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <StyledInput
            type="number"
            placeholder="Min employees"
            value={parameters.company_headcount?.min || ''}
            onChange={(e) => updateParameters({
              company_headcount: {
                ...parameters.company_headcount,
                min: parseInt(e.target.value) || undefined
              }
            })}
          />
          <span>to</span>
          <StyledInput
            type="number"
            placeholder="Max employees"
            value={parameters.company_headcount?.max || ''}
            onChange={(e) => updateParameters({
              company_headcount: {
                ...parameters.company_headcount,
                max: parseInt(e.target.value) || undefined
              }
            })}
          />
        </div>
      </StyledSection>

      <LinkedInParameterSelector
        parameterType="JOB_FUNCTION"
        label="Job Functions"
        selectedValues={parameters.function?.include || []}
        onSelectionChange={(values) => updateParameters({ 
          function: { 
            include: values, 
            exclude: parameters.function?.exclude || [] 
          } 
        })}
      />

      <LinkedInParameterSelector
        parameterType="JOB_TITLE"
        label="Roles"
        selectedValues={parameters.role?.include || []}
        onSelectionChange={(values) => updateParameters({ 
          role: { 
            include: values, 
            exclude: parameters.role?.exclude || [] 
          } 
        })}
      />

      <StyledSection>
        <StyledLabel>Seniority Level</StyledLabel>
        <StyledSelect
          multiple
          value={parameters.seniority || []}
          onChange={(e) => {
            const values = Array.from(e.target.selectedOptions, option => option.value);
            updateParameters({ seniority: values });
          }}
        >
          <option value="entry_level">Entry Level</option>
          <option value="in_training">In Training</option>
          <option value="associate">Associate</option>
          <option value="senior">Senior</option>
          <option value="experienced_manager">Experienced Manager</option>
          <option value="director">Director</option>
          <option value="executive">Executive</option>
        </StyledSelect>
      </StyledSection>

      <StyledSection>
        <StyledSectionTitle>Network Distance</StyledSectionTitle>
        <StyledCheckboxContainer>
          <StyledCheckbox
            type="checkbox"
            id="sn-distance-1"
            value={1}
            checked={parameters.network_distance?.includes(1)}
            onChange={(e) => {
              const value = parseInt(e.target.value);
              const distances = e.target.checked
                ? [...(parameters.network_distance || []), value]
                : (parameters.network_distance || []).filter((d: number) => d !== value);
              updateParameters({ network_distance: distances });
            }}
          />
          <StyledLabel htmlFor="sn-distance-1">1st connections</StyledLabel>
        </StyledCheckboxContainer>
        <StyledCheckboxContainer>
          <StyledCheckbox
            type="checkbox"
            id="sn-distance-2"
            value={2}
            checked={parameters.network_distance?.includes(2)}
            onChange={(e) => {
              const value = parseInt(e.target.value);
              const distances = e.target.checked
                ? [...(parameters.network_distance || []), value]
                : (parameters.network_distance || []).filter((d: number) => d !== value);
              updateParameters({ network_distance: distances });
            }}
          />
          <StyledLabel htmlFor="sn-distance-2">2nd connections</StyledLabel>
        </StyledCheckboxContainer>
        <StyledCheckboxContainer>
          <StyledCheckbox
            type="checkbox"
            id="sn-distance-3"
            value={3}
            checked={parameters.network_distance?.includes(3)}
            onChange={(e) => {
              const value = parseInt(e.target.value);
              const distances = e.target.checked
                ? [...(parameters.network_distance || []), value]
                : (parameters.network_distance || []).filter((d: number) => d !== value);
              updateParameters({ network_distance: distances });
            }}
          />
          <StyledLabel htmlFor="sn-distance-3">3rd connections</StyledLabel>
        </StyledCheckboxContainer>
      </StyledSection>

      <StyledSection>
        <StyledLabel>Company Type</StyledLabel>
        <StyledSelect
          multiple
          value={parameters.company_type || []}
          onChange={(e) => {
            const values = Array.from(e.target.selectedOptions, option => option.value);
            updateParameters({ company_type: values });
          }}
        >
          <option value="public_company">Public Company</option>
          <option value="privately_held">Privately Held</option>
          <option value="self_employed">Self Employed</option>
          <option value="government_agency">Government Agency</option>
          <option value="non_profit">Non Profit</option>
          <option value="self_owned">Self Owned</option>
          <option value="educational">Educational</option>
        </StyledSelect>
      </StyledSection>

      <StyledSection>
        <StyledSectionTitle>Time at Current Company</StyledSectionTitle>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <StyledInput
            type="number"
            placeholder="Min years"
            value={parameters.tenure_at_company?.min || ''}
            onChange={(e) => updateParameters({
              tenure_at_company: {
                ...parameters.tenure_at_company,
                min: parseInt(e.target.value) || undefined
              }
            })}
          />
          <span>to</span>
          <StyledInput
            type="number"
            placeholder="Max years"
            value={parameters.tenure_at_company?.max || ''}
            onChange={(e) => updateParameters({
              tenure_at_company: {
                ...parameters.tenure_at_company,
                max: parseInt(e.target.value) || undefined
              }
            })}
          />
        </div>
      </StyledSection>

      <LinkedInParameterSelector
        parameterType="JOB_TITLE"
        label="Past Roles"
        selectedValues={parameters.past_role?.include || []}
        onSelectionChange={(values) => updateParameters({ 
          past_role: { 
            include: values, 
            exclude: parameters.past_role?.exclude || [] 
          } 
        })}
      />

      <StyledSection>
        <StyledSectionTitle>Activity Filters</StyledSectionTitle>
        <StyledCheckboxContainer>
          <StyledCheckbox
            type="checkbox"
            id="following-company"
            checked={parameters.following_your_company || false}
            onChange={(e) => updateParameters({ following_your_company: e.target.checked })}
          />
          <StyledLabel htmlFor="following-company">Following your company</StyledLabel>
        </StyledCheckboxContainer>
        <StyledCheckboxContainer>
          <StyledCheckbox
            type="checkbox"
            id="viewed-profile"
            checked={parameters.viewed_your_profile_recently || false}
            onChange={(e) => updateParameters({ viewed_your_profile_recently: e.target.checked })}
          />
          <StyledLabel htmlFor="viewed-profile">Viewed your profile recently</StyledLabel>
        </StyledCheckboxContainer>
        <StyledCheckboxContainer>
          <StyledCheckbox
            type="checkbox"
            id="posted-linkedin"
            checked={parameters.posted_on_linkedin || false}
            onChange={(e) => updateParameters({ posted_on_linkedin: e.target.checked })}
          />
          <StyledLabel htmlFor="posted-linkedin">Posted on LinkedIn recently</StyledLabel>
        </StyledCheckboxContainer>
        <StyledCheckboxContainer>
          <StyledCheckbox
            type="checkbox"
            id="changed-jobs"
            checked={parameters.changed_jobs || false}
            onChange={(e) => updateParameters({ changed_jobs: e.target.checked })}
          />
          <StyledLabel htmlFor="changed-jobs">Changed jobs recently</StyledLabel>
        </StyledCheckboxContainer>
      </StyledSection>
    </>
  );

  const renderSalesNavigatorCompaniesParameters = () => (
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

  const renderRecruiterPeopleParameters = () => (
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

      <LinkedInParameterSelector
        parameterType="SCHOOL"
        label="Schools"
        selectedValues={parameters.school || []}
        onSelectionChange={handleSchoolChange}
      />
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
    } else if (searchType === 'sales_navigator') {
      switch (searchCategory) {
        case 'people':
          return renderSalesNavigatorPeopleParameters();
        case 'companies':
          return renderSalesNavigatorCompaniesParameters();
        default:
          return null;
      }
    } else if (searchType === 'recruiter') {
      switch (searchCategory) {
        case 'people':
          return renderRecruiterPeopleParameters();
        default:
          return null;
      }
    }
    return null;
  };

  const isResolved = hasResolvedParameters();
  const hasGeneratedParams = generatedParameters && (
    generatedParameters.classicPeopleSearch || 
    generatedParameters.classicCompaniesSearch || 
    generatedParameters.classicJobsSearch ||
    generatedParameters.salesNavigatorPeopleSearch ||
    generatedParameters.salesNavigatorCompaniesSearch ||
    generatedParameters.recruiterPeopleSearch
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
