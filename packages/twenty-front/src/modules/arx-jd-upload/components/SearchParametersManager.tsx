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

const StyledRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
  align-items: center;
  flex-wrap: wrap;
`;

const StyledRowButton = styled.button`
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  background-color: ${({ theme }) => theme.color.blue10};
  color: ${({ theme }) => theme.color.blue60};
  border: 1px solid ${({ theme }) => theme.color.blue20};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  cursor: pointer;
  &:hover { background-color: ${({ theme }) => theme.color.blue20}; }
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
      // Recruiter specific fields
      skills: [],
      groups: [],
      spoken_languages: [],
      profile_language: [],
      spotlights: [],
      recruiting_activity: [],
      recently_joined: [],
      first_name: [],
      last_name: [],
      notes: [],
    };

    // Adjust defaults based on search type
    if (searchType === 'recruiter') {
      (defaultParams as any).role = [];
      (defaultParams as any).skills = [];
      (defaultParams as any).spoken_languages = [];
      (defaultParams as any).company_headcount = [];
      (defaultParams as any).recently_joined = [];
      (defaultParams as any).seniority = { include: [], exclude: [] };
      (defaultParams as any).function = [];
    }

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
        company_headcount: searchType === 'recruiter' ? (generated.company_headcount || []) : (generated.company_headcount || defaultParams.company_headcount),
        function: searchType === 'recruiter' ? (generated.function || []) : (generated.function || defaultParams.function),
        role: searchType === 'recruiter' ? (generated.role || []) : (generated.role || defaultParams.role),
        company_type: generated.company_type || defaultParams.company_type,
        // Recruiter specific fields
        skills: searchType === 'recruiter' ? (generated.skills || []) : (generated.skills || defaultParams.skills),
        groups: searchType === 'recruiter' ? (generated.groups || []) : (generated.groups || defaultParams.groups),
        spoken_languages: searchType === 'recruiter' ? (generated.spoken_languages || []) : (generated.spoken_languages || defaultParams.spoken_languages),
        profile_language: searchType === 'recruiter' ? (generated.profile_language || []) : (generated.profile_language || defaultParams.profile_language),
        spotlights: searchType === 'recruiter' ? (generated.spotlights || []) : (generated.spotlights || defaultParams.spotlights),
        recruiting_activity: searchType === 'recruiter' ? (generated.recruiting_activity || []) : (generated.recruiting_activity || defaultParams.recruiting_activity),
        recently_joined: searchType === 'recruiter' ? (generated.recently_joined || []) : (generated.recently_joined || defaultParams.recently_joined),
        first_name: searchType === 'recruiter' ? (generated.first_name || []) : (generated.first_name || defaultParams.first_name),
        last_name: searchType === 'recruiter' ? (generated.last_name || []) : (generated.last_name || defaultParams.last_name),
        notes: searchType === 'recruiter' ? (generated.notes || []) : (generated.notes || defaultParams.notes),
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
        company_headcount: searchType === 'recruiter' ? (resolved.company_headcount || []) : (resolved.company_headcount || defaultParams.company_headcount),
        function: searchType === 'recruiter' ? (resolved.function || []) : (resolved.function || defaultParams.function),
        role: searchType === 'recruiter' ? (resolved.role || []) : (resolved.role || defaultParams.role),
        company_type: resolved.company_type || defaultParams.company_type,
        // Recruiter specific fields
        skills: searchType === 'recruiter' ? (resolved.skills || []) : (resolved.skills || defaultParams.skills),
        groups: searchType === 'recruiter' ? (resolved.groups || []) : (resolved.groups || defaultParams.groups),
        spoken_languages: searchType === 'recruiter' ? (resolved.spoken_languages || []) : (resolved.spoken_languages || defaultParams.spoken_languages),
        profile_language: searchType === 'recruiter' ? (resolved.profile_language || []) : (resolved.profile_language || defaultParams.profile_language),
        spotlights: searchType === 'recruiter' ? (resolved.spotlights || []) : (resolved.spotlights || defaultParams.spotlights),
        recruiting_activity: searchType === 'recruiter' ? (resolved.recruiting_activity || []) : (resolved.recruiting_activity || defaultParams.recruiting_activity),
        recently_joined: searchType === 'recruiter' ? (resolved.recently_joined || []) : (resolved.recently_joined || defaultParams.recently_joined),
        first_name: searchType === 'recruiter' ? (resolved.first_name || []) : (resolved.first_name || defaultParams.first_name),
        last_name: searchType === 'recruiter' ? (resolved.last_name || []) : (resolved.last_name || defaultParams.last_name),
        notes: searchType === 'recruiter' ? (resolved.notes || []) : (resolved.notes || defaultParams.notes),
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

  // Build a display map (id -> title) by pairing generated names with resolved ids when available
  const buildDisplayMap = useCallback((key: string): Record<string, string> | undefined => {
    if (!generatedParameters || !resolvedParameters) return undefined;

    const pickFor = (source: any) => {
      if (!source) return undefined;
      if (searchType === 'classic') {
        if (searchCategory === 'people') return source.classicPeopleSearch?.[key];
        if (searchCategory === 'companies') return source.classicCompaniesSearch?.[key];
        if (searchCategory === 'jobs') return source.classicJobsSearch?.[key];
      } else if (searchType === 'sales_navigator') {
        if (searchCategory === 'people') return source.salesNavigatorPeopleSearch?.[key];
        if (searchCategory === 'companies') return source.salesNavigatorCompaniesSearch?.[key];
      } else if (searchType === 'recruiter' && searchCategory === 'people') {
        return source.recruiterPeopleSearch?.[key];
      }
      return undefined;
    };

    const generatedValues = pickFor(generatedParameters) as string[] | undefined; // human-readable names
    const resolvedValues = pickFor(resolvedParameters) as any[] | undefined; // Can be strings (old format) or objects (new format)

    console.log(`buildDisplayMap for ${key}:`, {
      generatedValues,
      resolvedValues,
      generatedLength: generatedValues?.length,
      resolvedLength: resolvedValues?.length
    });

    if (Array.isArray(resolvedValues)) {
      const map: Record<string, string> = {};
      
      // Process resolved values - they can be either strings (old format) or objects (new format)
      resolvedValues.forEach((resolvedItem, index) => {
        if (typeof resolvedItem === 'object' && resolvedItem !== null && resolvedItem.id && resolvedItem.name) {
          // New format: {id: string, name: string}
          map[resolvedItem.id] = resolvedItem.name;
          console.log(`Using new format for ${key}: ID ${resolvedItem.id} -> ${resolvedItem.name}`);
        } else if (typeof resolvedItem === 'string') {
          // Old format: just the LinkedIn ID as string
          const id = resolvedItem;
          
          // Try to find a corresponding name from generated values
          let name: string | undefined;
          
          // First, try to find by index (for aligned arrays)
          if (index < (generatedValues?.length || 0) && typeof generatedValues?.[index] === 'string') {
            name = generatedValues[index];
          }
          
          // If no name found by index, try to find by matching the ID in generated values
          if (!name && generatedValues) {
            const matchingIndex = generatedValues.findIndex(genVal => 
              typeof genVal === 'string' && genVal === id
            );
            if (matchingIndex >= 0) {
              name = generatedValues[matchingIndex];
            }
          }
          
          // If we found a name, add it to the map
          if (name) {
            map[id] = name;
          } else {
            // If no name found, check if the ID itself looks like a human-readable name
            if (!id.match(/^\d+$/) && !id.includes('urn:li:')) {
              map[id] = id; // Use the ID as its own display name
            } else {
              console.warn(`No name found for ${key} ID: ${id}. This suggests the backend resolution process may not be preserving name mappings.`);
            }
          }
        }
      });
      
      console.log(`buildDisplayMap result for ${key}:`, map);
      return Object.keys(map).length > 0 ? map : undefined;
    }
    return undefined;
  }, [generatedParameters, resolvedParameters, searchType, searchCategory]);

  // Helper function to extract IDs from parameter values (handles both old string format and new object format)
  const extractIdsFromParameterValues = (values: any[]): string[] => {
    if (!Array.isArray(values)) return [];
    
    return values.map(value => {
      // New format: object with id and name
      if (typeof value === 'object' && value !== null && value.id) {
        return value.id;
      }
      // Old format: string (could be ID or name)
      if (typeof value === 'string') {
        return value;
      }
      return String(value);
    });
  };

  // Helper function to check if parameters contain LinkedIn IDs (resolved) vs names (unresolved)
  const areParametersResolved = (params: any): boolean => {
    if (!params) return false;
    
    // Check if any parameter arrays contain LinkedIn IDs (typically numeric strings) or objects with IDs
    const checkArray = (arr: any[]): boolean => {
      if (!Array.isArray(arr) || arr.length === 0) return false;
      return arr.some(item => {
        // New format: object with id and name
        if (typeof item === 'object' && item !== null && item.id) {
          return true;
        }
        // Old format: string that looks like a LinkedIn ID
        if (typeof item === 'string') {
          return item.match(/^\d+$/) || item.includes('urn:li:');
        }
        return false;
      });
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
        return JSON.stringify([...(current as any[])].sort()) !== JSON.stringify([...(newValue as any[])].sort());
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
        seniority: searchType === 'recruiter' ? (generated.seniority || { include: [], exclude: [] }) : (generated.seniority || []),
        job_type: generated.job_type || [],
        presence: generated.presence || [],
        headcount: generated.headcount || { min: 0, max: 10000 },
        // Sales Navigator specific fields
        tenure: generated.tenure || { min: undefined, max: undefined },
        company_headcount: searchType === 'recruiter' ? (generated.company_headcount || []) : (generated.company_headcount || { min: undefined, max: undefined }),
        function: searchType === 'recruiter' ? (generated.function || []) : (generated.function || { include: [], exclude: [] }),
        role: searchType === 'recruiter' ? (generated.role || []) : (generated.role || { include: [], exclude: [] }),
        company_type: generated.company_type || [],
        // Recruiter specific fields
        skills: searchType === 'recruiter' ? (generated.skills || []) : (generated.skills || []),
        groups: searchType === 'recruiter' ? (generated.groups || []) : (generated.groups || []),
        spoken_languages: searchType === 'recruiter' ? (generated.spoken_languages || []) : (generated.spoken_languages || []),
        profile_language: searchType === 'recruiter' ? (generated.profile_language || []) : (generated.profile_language || []),
        spotlights: searchType === 'recruiter' ? (generated.spotlights || []) : (generated.spotlights || []),
        recruiting_activity: searchType === 'recruiter' ? (generated.recruiting_activity || []) : (generated.recruiting_activity || []),
        recently_joined: searchType === 'recruiter' ? (generated.recently_joined || []) : (generated.recently_joined || []),
        first_name: searchType === 'recruiter' ? (generated.first_name || []) : (generated.first_name || []),
        last_name: searchType === 'recruiter' ? (generated.last_name || []) : (generated.last_name || []),
        notes: searchType === 'recruiter' ? (generated.notes || []) : (generated.notes || []),
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
          seniority: searchType === 'recruiter' ? (resolved.seniority || parameters.seniority || { include: [], exclude: [] }) : (resolved.seniority || parameters.seniority || []),
          job_type: resolved.job_type || parameters.job_type || [],
          presence: resolved.presence || parameters.presence || [],
          headcount: resolved.headcount || parameters.headcount || { min: 0, max: 10000 },
          // Sales Navigator specific fields
          tenure: resolved.tenure || parameters.tenure || { min: undefined, max: undefined },
          company_headcount: searchType === 'recruiter' ? (resolved.company_headcount || parameters.company_headcount || []) : (resolved.company_headcount || parameters.company_headcount || { min: undefined, max: undefined }),
          function: searchType === 'recruiter' ? (resolved.function || parameters.function || []) : (resolved.function || parameters.function || { include: [], exclude: [] }),
          role: searchType === 'recruiter' ? (resolved.role || parameters.role || []) : (resolved.role || parameters.role || { include: [], exclude: [] }),
          company_type: resolved.company_type || parameters.company_type || [],
          // Recruiter specific fields
          skills: searchType === 'recruiter' ? (resolved.skills || parameters.skills || []) : (resolved.skills || parameters.skills || []),
          groups: searchType === 'recruiter' ? (resolved.groups || parameters.groups || []) : (resolved.groups || parameters.groups || []),
          spoken_languages: searchType === 'recruiter' ? (resolved.spoken_languages || parameters.spoken_languages || []) : (resolved.spoken_languages || parameters.spoken_languages || []),
          profile_language: searchType === 'recruiter' ? (resolved.profile_language || parameters.profile_language || []) : (resolved.profile_language || parameters.profile_language || []),
          spotlights: searchType === 'recruiter' ? (resolved.spotlights || parameters.spotlights || []) : (resolved.spotlights || parameters.spotlights || []),
          recruiting_activity: searchType === 'recruiter' ? (resolved.recruiting_activity || parameters.recruiting_activity || []) : (resolved.recruiting_activity || parameters.recruiting_activity || []),
          recently_joined: searchType === 'recruiter' ? (resolved.recently_joined || parameters.recently_joined || []) : (resolved.recently_joined || parameters.recently_joined || []),
          first_name: searchType === 'recruiter' ? (resolved.first_name || parameters.first_name || []) : (resolved.first_name || parameters.first_name || []),
          last_name: searchType === 'recruiter' ? (resolved.last_name || parameters.last_name || []) : (resolved.last_name || parameters.last_name || []),
          notes: searchType === 'recruiter' ? (resolved.notes || parameters.notes || []) : (resolved.notes || parameters.notes || []),
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

  const handleParameterChange = (key: string, value: any) => {
    updateParameters({ [key]: value });
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
        selectedValues={extractIdsFromParameterValues(parameters.industry || [])}
        onSelectionChange={handleIndustryChange}
        selectedDisplayMap={buildDisplayMap('industry')}
      />

      <LinkedInParameterSelector
        parameterType="LOCATION"
        label="Locations"
        selectedValues={extractIdsFromParameterValues(parameters.location || [])}
        onSelectionChange={handleLocationChange}
        selectedDisplayMap={buildDisplayMap('location')}
      />

      <LinkedInParameterSelector
        parameterType="COMPANY"
        label="Companies"
        selectedValues={extractIdsFromParameterValues(parameters.company || [])}
        onSelectionChange={handleCompanyChange}
        selectedDisplayMap={buildDisplayMap('company')}
      />

      <LinkedInParameterSelector
        parameterType="SCHOOL"
        label="Schools"
        selectedValues={extractIdsFromParameterValues(parameters.school || [])}
        onSelectionChange={handleSchoolChange}
        selectedDisplayMap={buildDisplayMap('school')}
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
        selectedValues={extractIdsFromParameterValues(parameters.industry || [])}
        onSelectionChange={handleIndustryChange}
        selectedDisplayMap={buildDisplayMap('industry')}
      />

      <LinkedInParameterSelector
        parameterType="LOCATION"
        label="Locations"
        selectedValues={extractIdsFromParameterValues(parameters.location || [])}
        onSelectionChange={handleLocationChange}
        selectedDisplayMap={buildDisplayMap('location')}
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
        selectedValues={extractIdsFromParameterValues(parameters.industry || [])}
        onSelectionChange={handleIndustryChange}
        selectedDisplayMap={buildDisplayMap('industry')}
      />

      <LinkedInParameterSelector
        parameterType="LOCATION"
        label="Locations"
        selectedValues={extractIdsFromParameterValues(parameters.location || [])}
        onSelectionChange={handleLocationChange}
        selectedDisplayMap={buildDisplayMap('location')}
      />

      <LinkedInParameterSelector
        parameterType="COMPANY"
        label="Companies"
        selectedValues={extractIdsFromParameterValues(parameters.company || [])}
        onSelectionChange={handleCompanyChange}
        selectedDisplayMap={buildDisplayMap('company')}
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
        selectedValues={extractIdsFromParameterValues(parameters.industry || [])}
        onSelectionChange={handleIndustryChange}
        selectedDisplayMap={buildDisplayMap('industry')}
      />

      <LinkedInParameterSelector
        parameterType="LOCATION"
        label="Locations"
        selectedValues={extractIdsFromParameterValues(parameters.location || [])}
        onSelectionChange={handleLocationChange}
        selectedDisplayMap={buildDisplayMap('location')}
      />

      <LinkedInParameterSelector
        parameterType="COMPANY"
        label="Companies"
        selectedValues={extractIdsFromParameterValues(parameters.company || [])}
        onSelectionChange={handleCompanyChange}
        selectedDisplayMap={buildDisplayMap('company')}
      />

      <LinkedInParameterSelector
        parameterType="SCHOOL"
        label="Schools"
        selectedValues={extractIdsFromParameterValues(parameters.school || [])}
        onSelectionChange={handleSchoolChange}
        selectedDisplayMap={buildDisplayMap('school')}
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
        selectedDisplayMap={buildDisplayMap('function')}
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
        selectedDisplayMap={buildDisplayMap('role')}
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
        selectedDisplayMap={buildDisplayMap('past_role')}
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
        selectedValues={extractIdsFromParameterValues(parameters.industry || [])}
        onSelectionChange={handleIndustryChange}
        selectedDisplayMap={buildDisplayMap('industry')}
      />

      <LinkedInParameterSelector
        parameterType="LOCATION"
        label="Locations"
        selectedValues={extractIdsFromParameterValues(parameters.location || [])}
        onSelectionChange={handleLocationChange}
        selectedDisplayMap={buildDisplayMap('location')}
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

      <StyledSection>
        <StyledLabel>Locale</StyledLabel>
        <StyledSelect
          value={parameters.locale || ''}
          onChange={(e) => handleParameterChange('locale', e.target.value || undefined)}
        >
          <option value="">Select Locale</option>
          <option value="english">English</option>
          <option value="spanish">Spanish</option>
          <option value="french">French</option>
          <option value="german">German</option>
          <option value="italian">Italian</option>
          <option value="portuguese">Portuguese</option>
          <option value="dutch">Dutch</option>
          <option value="russian">Russian</option>
          <option value="japanese">Japanese</option>
          <option value="korean">Korean</option>
          <option value="chinese_simplified">Chinese (Simplified)</option>
          <option value="chinese_traditional">Chinese (Traditional)</option>
          <option value="arabic">Arabic</option>
          <option value="hindi">Hindi</option>
          <option value="hebrew">Hebrew</option>
          <option value="thai">Thai</option>
          <option value="vietnamese">Vietnamese</option>
        </StyledSelect>
      </StyledSection>

      <StyledSection>
        <StyledLabel>Saved Filter</StyledLabel>
        <StyledInput
          value={parameters.saved_filter || ''}
          onChange={(e) => handleParameterChange('saved_filter', e.target.value || undefined)}
          placeholder="Enter saved filter name..."
        />
      </StyledSection>

      <LinkedInParameterSelector
        parameterType="LOCATION"
        label="Locations"
        selectedValues={extractIdsFromParameterValues(parameters.location || [])}
        onSelectionChange={handleLocationChange}
        selectedDisplayMap={buildDisplayMap('location')}
      />

      <StyledSection>
        <StyledLabel>Location Within Area (miles)</StyledLabel>
        <StyledInput
          type="number"
          value={parameters.location_within_area || ''}
          onChange={(e) => handleParameterChange('location_within_area', e.target.value ? parseInt(e.target.value) : undefined)}
          placeholder="e.g., 50"
        />
      </StyledSection>

      <LinkedInParameterSelector
        parameterType="INDUSTRY"
        label="Industries"
        selectedValues={extractIdsFromParameterValues(parameters.industry || [])}
        onSelectionChange={handleIndustryChange}
        selectedDisplayMap={buildDisplayMap('industry')}
      />

      <StyledSection>
        <StyledSectionTitle>Roles</StyledSectionTitle>
        {(Array.isArray(parameters.role) ? parameters.role : []).map((r: any, idx: number) => (
          <StyledRow key={`role-${idx}`}>
            <StyledInput
              placeholder="Role keywords"
              value={r.keywords || ''}
              onChange={(e) => {
                const roleArray = Array.isArray(parameters.role) ? parameters.role : [];
                const next = [...roleArray];
                next[idx] = { ...next[idx], keywords: e.target.value || undefined };
                handleParameterChange('role', next.filter(item => item && (item.id || item.keywords)));
              }}
            />
            <StyledSelect
              value={r.priority || 'CAN_HAVE'}
              onChange={(e) => {
                const roleArray = Array.isArray(parameters.role) ? parameters.role : [];
                const next = [...roleArray];
                next[idx] = { ...next[idx], priority: e.target.value };
                handleParameterChange('role', next);
              }}
            >
              <option value="CAN_HAVE">Can have</option>
              <option value="MUST_HAVE">Must have</option>
              <option value="DOESNT_HAVE">Doesn't have</option>
            </StyledSelect>
            <StyledSelect
              value={r.scope || 'CURRENT'}
              onChange={(e) => {
                const roleArray = Array.isArray(parameters.role) ? parameters.role : [];
                const next = [...roleArray];
                next[idx] = { ...next[idx], scope: e.target.value };
                handleParameterChange('role', next);
              }}
            >
              <option value="CURRENT_OR_PAST">Current or Past</option>
              <option value="CURRENT">Current</option>
              <option value="PAST">Past</option>
              <option value="PAST_NOT_CURRENT">Past not Current</option>
              <option value="OPEN_TO_WORK">Open to Work</option>
            </StyledSelect>
            <StyledRowButton
              onClick={() => {
                const roleArray = Array.isArray(parameters.role) ? parameters.role : [];
                const next = [...roleArray];
                next.splice(idx, 1);
                handleParameterChange('role', next.length ? next : undefined);
              }}
            >Remove</StyledRowButton>
          </StyledRow>
        ))}
        <StyledRow>
          <StyledRowButton
            onClick={() => {
              const roleArray = Array.isArray(parameters.role) ? parameters.role : [];
              const next = [...roleArray];
              next.push({ keywords: '' });
              handleParameterChange('role', next);
            }}
          >Add role</StyledRowButton>
        </StyledRow>
      </StyledSection>

      <StyledSection>
        <StyledSectionTitle>Skills</StyledSectionTitle>
        {(Array.isArray(parameters.skills) ? parameters.skills : []).map((s: any, idx: number) => (
          <StyledRow key={`skill-${idx}`}>
            <StyledInput
              placeholder="Skill keywords"
              value={s.keywords || ''}
              onChange={(e) => {
                const skillsArray = Array.isArray(parameters.skills) ? parameters.skills : [];
                const next = [...skillsArray];
                next[idx] = { ...next[idx], keywords: e.target.value || undefined };
                handleParameterChange('skills', next.filter(item => item && (item.id || item.keywords)));
              }}
            />
            <StyledSelect
              value={s.priority || 'CAN_HAVE'}
              onChange={(e) => {
                const skillsArray = Array.isArray(parameters.skills) ? parameters.skills : [];
                const next = [...skillsArray];
                next[idx] = { ...next[idx], priority: e.target.value };
                handleParameterChange('skills', next);
              }}
            >
              <option value="CAN_HAVE">Can have</option>
              <option value="MUST_HAVE">Must have</option>
              <option value="DOESNT_HAVE">Doesn't have</option>
            </StyledSelect>
            <StyledRowButton
              onClick={() => {
                const skillsArray = Array.isArray(parameters.skills) ? parameters.skills : [];
                const next = [...skillsArray];
                next.splice(idx, 1);
                handleParameterChange('skills', next.length ? next : undefined);
              }}
            >Remove</StyledRowButton>
          </StyledRow>
        ))}
        <StyledRow>
          <StyledRowButton
            onClick={() => {
              const skillsArray = Array.isArray(parameters.skills) ? parameters.skills : [];
              const next = [...skillsArray];
              next.push({ keywords: '' });
              handleParameterChange('skills', next);
            }}
          >Add skill</StyledRowButton>
        </StyledRow>
      </StyledSection>

      <LinkedInParameterSelector
        parameterType="COMPANY"
        label="Companies"
        selectedValues={extractIdsFromParameterValues(parameters.company || [])}
        onSelectionChange={handleCompanyChange}
        selectedDisplayMap={buildDisplayMap('company')}
      />

      <StyledSection>
        <StyledSectionTitle>Company Headcount Ranges</StyledSectionTitle>
        {(Array.isArray(parameters.company_headcount) ? parameters.company_headcount : []).map((r: any, idx: number) => (
          <StyledRow key={`headcount-${idx}`}>
            <StyledInput
              type="number"
              placeholder="Min"
              value={r?.min ?? ''}
              onChange={(e) => {
                const headcountArray = Array.isArray(parameters.company_headcount) ? parameters.company_headcount : [];
                const next = [...headcountArray];
                next[idx] = { ...(next[idx] || {}), min: e.target.value ? parseInt(e.target.value) : undefined };
                handleParameterChange('company_headcount', next);
              }}
            />
            <span>to</span>
            <StyledInput
              type="number"
              placeholder="Max"
              value={r?.max ?? ''}
              onChange={(e) => {
                const headcountArray = Array.isArray(parameters.company_headcount) ? parameters.company_headcount : [];
                const next = [...headcountArray];
                next[idx] = { ...(next[idx] || {}), max: e.target.value ? parseInt(e.target.value) : undefined };
                handleParameterChange('company_headcount', next);
              }}
            />
            <StyledRowButton
              onClick={() => {
                const headcountArray = Array.isArray(parameters.company_headcount) ? parameters.company_headcount : [];
                const next = [...headcountArray];
                next.splice(idx, 1);
                handleParameterChange('company_headcount', next.length ? next : undefined);
              }}
            >Remove</StyledRowButton>
          </StyledRow>
        ))}
        <StyledRow>
          <StyledRowButton
            onClick={() => {
              const headcountArray = Array.isArray(parameters.company_headcount) ? parameters.company_headcount : [];
              const next = [...headcountArray];
              next.push({});
              handleParameterChange('company_headcount', next);
            }}
          >Add range</StyledRowButton>
        </StyledRow>
      </StyledSection>

      <LinkedInParameterSelector
        parameterType="COMPANY"
        label="Current Companies"
        selectedValues={extractIdsFromParameterValues(parameters.current_company || [])}
        onSelectionChange={(values) => handleParameterChange('current_company', values)}
        selectedDisplayMap={buildDisplayMap('current_company')}
      />

      <LinkedInParameterSelector
        parameterType="COMPANY"
        label="Past Companies"
        selectedValues={extractIdsFromParameterValues(parameters.past_company || [])}
        onSelectionChange={(values) => handleParameterChange('past_company', values)}
        selectedDisplayMap={buildDisplayMap('past_company')}
      />

      <LinkedInParameterSelector
        parameterType="SCHOOL"
        label="Schools"
        selectedValues={extractIdsFromParameterValues(parameters.school || [])}
        onSelectionChange={handleSchoolChange}
        selectedDisplayMap={buildDisplayMap('school')}
      />

      <StyledSection>
        <StyledLabel>Groups</StyledLabel>
        <StyledTextArea
          value={Array.isArray(parameters.groups) ? parameters.groups.join('\n') : ''}
          onChange={(e) => {
            const groups = e.target.value.split('\n').filter(group => group.trim());
            handleParameterChange('groups', groups.length > 0 ? groups : undefined);
          }}
          placeholder="Enter LinkedIn group names (one per line)"
        />
      </StyledSection>

      <StyledSection>
        <StyledSectionTitle>Graduation Year Range</StyledSectionTitle>
        <StyledRow>
          <StyledInput
            type="number"
            placeholder="Min year"
            value={parameters.graduation_year?.min ?? ''}
            onChange={(e) => {
              const min = e.target.value ? parseInt(e.target.value) : undefined;
              const next = { ...(parameters.graduation_year || {}), min };
              if (next.min === undefined && next.max === undefined) return handleParameterChange('graduation_year', undefined);
              handleParameterChange('graduation_year', next);
            }}
          />
          <span>to</span>
          <StyledInput
            type="number"
            placeholder="Max year"
            value={parameters.graduation_year?.max ?? ''}
            onChange={(e) => {
              const max = e.target.value ? parseInt(e.target.value) : undefined;
              const next = { ...(parameters.graduation_year || {}), max };
              if (next.min === undefined && next.max === undefined) return handleParameterChange('graduation_year', undefined);
              handleParameterChange('graduation_year', next);
            }}
          />
        </StyledRow>
      </StyledSection>

      <StyledSection>
        <StyledSectionTitle>Tenure Range (years)</StyledSectionTitle>
        <StyledRow>
          <StyledInput
            type="number"
            placeholder="Min years"
            value={parameters.tenure?.min ?? ''}
            onChange={(e) => {
              const min = e.target.value ? parseInt(e.target.value) : undefined;
              const next = { ...(parameters.tenure || {}), min };
              if (next.min === undefined && next.max === undefined) return handleParameterChange('tenure', undefined);
              handleParameterChange('tenure', next);
            }}
          />
          <span>to</span>
          <StyledInput
            type="number"
            placeholder="Max years"
            value={parameters.tenure?.max ?? ''}
            onChange={(e) => {
              const max = e.target.value ? parseInt(e.target.value) : undefined;
              const next = { ...(parameters.tenure || {}), max };
              if (next.min === undefined && next.max === undefined) return handleParameterChange('tenure', undefined);
              handleParameterChange('tenure', next);
            }}
          />
        </StyledRow>
      </StyledSection>

      <StyledSection>
        <StyledSectionTitle>Seniority Level</StyledSectionTitle>
        <StyledLabel>Include</StyledLabel>
        <StyledSelect
          multiple
          value={(parameters.seniority?.include || []) as any}
          onChange={(e) => {
            const values = Array.from(e.target.selectedOptions, o => o.value);
            const next = { ...(parameters.seniority || {}), include: values };
            if ((!next.include || next.include.length === 0) && (!next.exclude || next.exclude.length === 0)) return handleParameterChange('seniority', undefined);
            handleParameterChange('seniority', next);
          }}
        >
          <option value="owner">Owner</option>
          <option value="partner">Partner</option>
          <option value="cxo">CxO</option>
          <option value="vp">VP</option>
          <option value="director">Director</option>
          <option value="manager">Manager</option>
          <option value="senior">Senior</option>
          <option value="entry">Entry</option>
          <option value="training">In Training</option>
          <option value="unpaid">Unpaid</option>
        </StyledSelect>
        <StyledLabel>Exclude</StyledLabel>
        <StyledSelect
          multiple
          value={(parameters.seniority?.exclude || []) as any}
          onChange={(e) => {
            const values = Array.from(e.target.selectedOptions, o => o.value);
            const next = { ...(parameters.seniority || {}), exclude: values };
            if ((!next.include || next.include.length === 0) && (!next.exclude || next.exclude.length === 0)) return handleParameterChange('seniority', undefined);
            handleParameterChange('seniority', next);
          }}
        >
          <option value="owner">Owner</option>
          <option value="partner">Partner</option>
          <option value="cxo">CxO</option>
          <option value="vp">VP</option>
          <option value="director">Director</option>
          <option value="manager">Manager</option>
          <option value="senior">Senior</option>
          <option value="entry">Entry</option>
          <option value="training">In Training</option>
          <option value="unpaid">Unpaid</option>
        </StyledSelect>
      </StyledSection>

      <StyledSection>
        <StyledLabel>Function</StyledLabel>
        <StyledTextArea
          value={Array.isArray(parameters.function) ? parameters.function.join('\n') : ''}
          onChange={(e) => {
            const functions = e.target.value.split('\n').filter(func => func.trim());
            handleParameterChange('function', functions.length > 0 ? functions : undefined);
          }}
          placeholder="Enter functions (one per line)&#10;e.g., Engineering"
        />
      </StyledSection>

      <StyledSection>
        <StyledSectionTitle>Network Distance</StyledSectionTitle>
        <StyledCheckboxContainer>
          <StyledCheckbox
            type="checkbox"
            id="rec-distance-1"
            checked={(parameters.network_distance || []).includes(1)}
            onChange={(e) => {
              const list: any[] = [...(parameters.network_distance || [])];
              if (e.target.checked) {
                list.push(1);
                handleParameterChange('network_distance', Array.from(new Set(list)) as any);
              } else {
                handleParameterChange('network_distance', list.filter(v => v !== 1));
              }
            }}
          />
          <StyledLabel htmlFor="rec-distance-1">1st</StyledLabel>
        </StyledCheckboxContainer>
        <StyledCheckboxContainer>
          <StyledCheckbox
            type="checkbox"
            id="rec-distance-2"
            checked={(parameters.network_distance || []).includes(2)}
            onChange={(e) => {
              const list: any[] = [...(parameters.network_distance || [])];
              if (e.target.checked) {
                list.push(2);
                handleParameterChange('network_distance', Array.from(new Set(list)) as any);
              } else {
                handleParameterChange('network_distance', list.filter(v => v !== 2));
              }
            }}
          />
          <StyledLabel htmlFor="rec-distance-2">2nd</StyledLabel>
        </StyledCheckboxContainer>
        <StyledCheckboxContainer>
          <StyledCheckbox
            type="checkbox"
            id="rec-distance-3"
            checked={(parameters.network_distance || []).includes(3)}
            onChange={(e) => {
              const list: any[] = [...(parameters.network_distance || [])];
              if (e.target.checked) {
                list.push(3);
                handleParameterChange('network_distance', Array.from(new Set(list)) as any);
              } else {
                handleParameterChange('network_distance', list.filter(v => v !== 3));
              }
            }}
          />
          <StyledLabel htmlFor="rec-distance-3">3rd</StyledLabel>
        </StyledCheckboxContainer>
        <StyledCheckboxContainer>
          <StyledCheckbox
            type="checkbox"
            id="rec-distance-group"
            checked={(parameters.network_distance || []).includes('GROUP')}
            onChange={(e) => {
              const list: any[] = [...(parameters.network_distance || [])];
              if (e.target.checked) {
                list.push('GROUP');
                handleParameterChange('network_distance', Array.from(new Set(list)) as any);
              } else {
                handleParameterChange('network_distance', list.filter(v => v !== 'GROUP'));
              }
            }}
          />
          <StyledLabel htmlFor="rec-distance-group">Group</StyledLabel>
        </StyledCheckboxContainer>
      </StyledSection>

      <StyledSection>
        <StyledSectionTitle>Spoken Languages</StyledSectionTitle>
        {(Array.isArray(parameters.spoken_languages) ? parameters.spoken_languages : []).map((l: any, idx: number) => (
          <StyledRow key={`lang-${idx}`}>
            <StyledInput
              placeholder="Language"
              value={l.language || ''}
              onChange={(e) => {
                const languagesArray = Array.isArray(parameters.spoken_languages) ? parameters.spoken_languages : [];
                const next = [...languagesArray];
                next[idx] = { ...next[idx], language: e.target.value || undefined };
                handleParameterChange('spoken_languages', next.filter(item => item && item.language));
              }}
            />
            <StyledSelect
              value={l.priority || 'CAN_HAVE'}
              onChange={(e) => {
                const languagesArray = Array.isArray(parameters.spoken_languages) ? parameters.spoken_languages : [];
                const next = [...languagesArray];
                next[idx] = { ...next[idx], priority: e.target.value };
                handleParameterChange('spoken_languages', next);
              }}
            >
              <option value="CAN_HAVE">Can have</option>
              <option value="MUST_HAVE">Must have</option>
              <option value="DOESNT_HAVE">Doesn't have</option>
            </StyledSelect>
            <StyledSelect
              value={l.scope || 'FULL_PROFESSIONAL'}
              onChange={(e) => {
                const languagesArray = Array.isArray(parameters.spoken_languages) ? parameters.spoken_languages : [];
                const next = [...languagesArray];
                next[idx] = { ...next[idx], scope: e.target.value };
                handleParameterChange('spoken_languages', next);
              }}
            >
              <option value="ELEMENTARY">Elementary</option>
              <option value="LIMITED_WORKING">Limited working</option>
              <option value="PROFESSIONAL_WORKING">Professional working</option>
              <option value="FULL_PROFESSIONAL">Full professional</option>
              <option value="NATIVE_OR_BILINGUAL">Native or bilingual</option>
            </StyledSelect>
            <StyledRowButton
              onClick={() => {
                const languagesArray = Array.isArray(parameters.spoken_languages) ? parameters.spoken_languages : [];
                const next = [...languagesArray];
                next.splice(idx, 1);
                handleParameterChange('spoken_languages', next.length ? next : undefined);
              }}
            >Remove</StyledRowButton>
          </StyledRow>
        ))}
        <StyledRow>
          <StyledRowButton
            onClick={() => {
              const languagesArray = Array.isArray(parameters.spoken_languages) ? parameters.spoken_languages : [];
              const next = [...languagesArray];
              next.push({ language: '' });
              handleParameterChange('spoken_languages', next);
            }}
          >Add language</StyledRowButton>
        </StyledRow>
      </StyledSection>

      <StyledSection>
        <StyledLabel>Profile Language</StyledLabel>
        <StyledTextArea
          value={Array.isArray(parameters.profile_language) ? parameters.profile_language.join('\n') : ''}
          onChange={(e) => {
            const languages = e.target.value.split('\n').filter(lang => lang.trim());
            handleParameterChange('profile_language', languages.length > 0 ? languages : undefined);
          }}
          placeholder="Enter profile languages (one per line)"
        />
      </StyledSection>

      <StyledSection>
        <StyledLabel>Spotlights</StyledLabel>
        <StyledTextArea
          value={Array.isArray(parameters.spotlights) ? parameters.spotlights.join('\n') : ''}
          onChange={(e) => {
            const spotlights = e.target.value.split('\n').filter(spotlight => spotlight.trim());
            const validSpotlights = spotlights.filter(s => 
              ['OPEN_TO_WORK', 'ACTIVE_TALENT', 'REDISCOVERED_CANDIDATES', 'INTERNAL_CANDIDATES', 'INTERESTED_IN_YOUR_COMPANY', 'HAVE_COMPANY_CONNECTIONS'].includes(s)
            );
            handleParameterChange('spotlights', validSpotlights.length > 0 ? validSpotlights as ('OPEN_TO_WORK' | 'ACTIVE_TALENT' | 'REDISCOVERED_CANDIDATES' | 'INTERNAL_CANDIDATES' | 'INTERESTED_IN_YOUR_COMPANY' | 'HAVE_COMPANY_CONNECTIONS')[] : undefined);
          }}
          placeholder="Enter spotlights (one per line)&#10;Valid options: OPEN_TO_WORK, ACTIVE_TALENT, REDISCOVERED_CANDIDATES, INTERNAL_CANDIDATES, INTERESTED_IN_YOUR_COMPANY, HAVE_COMPANY_CONNECTIONS"
        />
      </StyledSection>

      <StyledSection>
        <StyledLabel>Military Background</StyledLabel>
        <StyledSelect
          value={parameters.has_military_background === undefined ? '' : parameters.has_military_background.toString()}
          onChange={(e) => handleParameterChange('has_military_background', e.target.value === '' ? undefined : e.target.value === 'true')}
        >
          <option value="">Any</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </StyledSelect>
      </StyledSection>

      <StyledSection>
        <StyledLabel>Past Applicants</StyledLabel>
        <StyledSelect
          value={parameters.past_applicants === undefined ? '' : parameters.past_applicants.toString()}
          onChange={(e) => handleParameterChange('past_applicants', e.target.value === '' ? undefined : e.target.value === 'true')}
        >
          <option value="">Any</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </StyledSelect>
      </StyledSection>

      <StyledSection>
        <StyledLabel>Recruiting Activity</StyledLabel>
        <StyledTextArea
          value={Array.isArray(parameters.recruiting_activity) ? parameters.recruiting_activity.map((activity: any) => `${activity.id} (${activity.priority || 'CAN_HAVE'}, ${activity.timespan || 0} days)`).join('\n') : ''}
          onChange={(e) => {
            const lines = e.target.value.split('\n').filter(line => line.trim());
            const activities = lines.map(line => {
              const match = line.match(/^(.+?)\s*\((.+?),\s*(\d+)\s*days?\)$/);
              if (match) {
                return {
                  id: match[1].trim() as 'messages' | 'tags' | 'notes' | 'projects' | 'resumes' | 'reviews',
                  priority: match[2].trim() as 'CAN_HAVE' | 'MUST_HAVE' | 'DOESNT_HAVE',
                  timespan: parseInt(match[3])
                };
              }
              return null;
            }).filter(Boolean);
            handleParameterChange('recruiting_activity', activities.length > 0 ? activities : undefined);
          }}
          placeholder="Enter recruiting activity (format: activity (priority, days))&#10;e.g., messages (MUST_HAVE, 90 days)"
        />
      </StyledSection>

      <StyledSection>
        <StyledLabel>Hide Previously Viewed (days)</StyledLabel>
        <StyledInput
          type="number"
          value={parameters.hide_previously_viewed?.timespan || ''}
          onChange={(e) => handleParameterChange('hide_previously_viewed', e.target.value ? { timespan: parseInt(e.target.value) } : undefined)}
          placeholder="e.g., 30"
        />
      </StyledSection>

      <StyledSection>
        <StyledSectionTitle>Recently Joined Ranges (days)</StyledSectionTitle>
        {(Array.isArray(parameters.recently_joined) ? parameters.recently_joined : []).map((r: any, idx: number) => (
          <StyledRow key={`recent-${idx}`}>
            <StyledInput
              type="number"
              placeholder="Min days"
              value={r?.min ?? ''}
              onChange={(e) => {
                const recentArray = Array.isArray(parameters.recently_joined) ? parameters.recently_joined : [];
                const next = [...recentArray];
                next[idx] = { ...(next[idx] || {}), min: e.target.value ? parseInt(e.target.value) : undefined };
                handleParameterChange('recently_joined', next);
              }}
            />
            <span>to</span>
            <StyledInput
              type="number"
              placeholder="Max days"
              value={r?.max ?? ''}
              onChange={(e) => {
                const recentArray = Array.isArray(parameters.recently_joined) ? parameters.recently_joined : [];
                const next = [...recentArray];
                next[idx] = { ...(next[idx] || {}), max: e.target.value ? parseInt(e.target.value) : undefined };
                handleParameterChange('recently_joined', next);
              }}
            />
            <StyledRowButton
              onClick={() => {
                const recentArray = Array.isArray(parameters.recently_joined) ? parameters.recently_joined : [];
                const next = [...recentArray];
                next.splice(idx, 1);
                handleParameterChange('recently_joined', next.length ? next : undefined);
              }}
            >Remove</StyledRowButton>
          </StyledRow>
        ))}
        <StyledRow>
          <StyledRowButton
            onClick={() => {
              const recentArray = Array.isArray(parameters.recently_joined) ? parameters.recently_joined : [];
              const next = [...recentArray];
              next.push({});
              handleParameterChange('recently_joined', next);
            }}
          >Add range</StyledRowButton>
        </StyledRow>
      </StyledSection>

      <StyledSection>
        <StyledLabel>First Name</StyledLabel>
        <StyledTextArea
          value={Array.isArray(parameters.first_name) ? parameters.first_name.join('\n') : ''}
          onChange={(e) => {
            const names = e.target.value.split('\n').filter(name => name.trim());
            handleParameterChange('first_name', names.length > 0 ? names : undefined);
          }}
          placeholder="Enter first names (one per line)"
        />
      </StyledSection>

      <StyledSection>
        <StyledLabel>Last Name</StyledLabel>
        <StyledTextArea
          value={Array.isArray(parameters.last_name) ? parameters.last_name.join('\n') : ''}
          onChange={(e) => {
            const names = e.target.value.split('\n').filter(name => name.trim());
            handleParameterChange('last_name', names.length > 0 ? names : undefined);
          }}
          placeholder="Enter last names (one per line)"
        />
      </StyledSection>

      <StyledSection>
        <StyledLabel>Notes</StyledLabel>
        <StyledTextArea
          value={Array.isArray(parameters.notes) ? parameters.notes.join('\n') : ''}
          onChange={(e) => {
            const notes = e.target.value.split('\n').filter(note => note.trim());
            handleParameterChange('notes', notes.length > 0 ? notes : undefined);
          }}
          placeholder="Enter notes (one per line)"
        />
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
