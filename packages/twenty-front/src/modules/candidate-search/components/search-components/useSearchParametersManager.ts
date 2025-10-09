import { DefaultParameters, LinkedInSearchCategory, LinkedInSearchType } from '@/candidate-search/CandidateSearch';
import { useCallback, useEffect, useRef, useState } from 'react';

export const useSearchParametersManager = (
  searchType: LinkedInSearchType,
  searchCategory: LinkedInSearchCategory,
  generatedParameters?: any,
  resolvedParameters?: any,
  onParametersChange?: (parameters: any) => void,
  searchFilterId?: string,
  onSearchFilterUpdate?: (
    searchFilterId: string,
    searchType: LinkedInSearchType,
    searchCategory: LinkedInSearchCategory,
    generatedParameters: any,
    resolvedParameters: any
  ) => Promise<void>
) => {
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

  const getDefaultParameters = (): DefaultParameters => {
    const defaultParams: DefaultParameters = {
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

    return defaultParams;
  };

  const mergeParameters = (defaultParams: DefaultParameters, sourceParams: any) => {
    if (!sourceParams) return defaultParams;

    let source: any = {};
    
    // Get the appropriate parameters based on search type and category
    if (searchType === 'classic') {
      if (searchCategory === 'people') {
        source = sourceParams.classicPeopleSearch || {};
      } else if (searchCategory === 'companies') {
        source = sourceParams.classicCompaniesSearch || {};
      } else if (searchCategory === 'jobs') {
        source = sourceParams.classicJobsSearch || {};
      }
    } else if (searchType === 'sales_navigator') {
      if (searchCategory === 'people') {
        source = sourceParams.salesNavigatorPeopleSearch || {};
      } else if (searchCategory === 'companies') {
        source = sourceParams.salesNavigatorCompaniesSearch || {};
      }
    } else if (searchType === 'recruiter' && searchCategory === 'people') {
      source = sourceParams.recruiterPeopleSearch || {};
    }
    
    return {
      ...defaultParams,
      keywords: source.keywords || defaultParams.keywords,
      network_distance: source.network_distance || defaultParams.network_distance,
      industry: source.industry || defaultParams.industry,
      location: source.location || defaultParams.location,
      company: source.company || defaultParams.company,
      school: source.school || defaultParams.school,
      seniority: source.seniority || defaultParams.seniority,
      job_type: source.job_type || defaultParams.job_type,
      presence: source.presence || defaultParams.presence,
      headcount: source.headcount || defaultParams.headcount,
      // Sales Navigator specific fields
      tenure: source.tenure || defaultParams.tenure,
      company_headcount: searchType === 'recruiter' ? (source.company_headcount || []) : (source.company_headcount || defaultParams.company_headcount),
      function: searchType === 'recruiter' ? (source.function || []) : (source.function || defaultParams.function),
      role: searchType === 'recruiter' ? (source.role || []) : (source.role || defaultParams.role),
      company_type: source.company_type || defaultParams.company_type,
      // Recruiter specific fields
      skills: searchType === 'recruiter' ? (source.skills || []) : (source.skills || defaultParams.skills),
      groups: searchType === 'recruiter' ? (source.groups || []) : (source.groups || defaultParams.groups),
      spoken_languages: searchType === 'recruiter' ? (source.spoken_languages || []) : (source.spoken_languages || defaultParams.spoken_languages),
      profile_language: searchType === 'recruiter' ? (source.profile_language || []) : (source.profile_language || defaultParams.profile_language),
      spotlights: searchType === 'recruiter' ? (source.spotlights || []) : (source.spotlights || defaultParams.spotlights),
      recruiting_activity: searchType === 'recruiter' ? (source.recruiting_activity || []) : (source.recruiting_activity || defaultParams.recruiting_activity),
      recently_joined: searchType === 'recruiter' ? (source.recently_joined || []) : (source.recently_joined || defaultParams.recently_joined),
      first_name: searchType === 'recruiter' ? (source.first_name || []) : (source.first_name || defaultParams.first_name),
      last_name: searchType === 'recruiter' ? (source.last_name || []) : (source.last_name || defaultParams.last_name),
      notes: searchType === 'recruiter' ? (source.notes || []) : (source.notes || defaultParams.notes),
      tenure_at_company: source.tenure_at_company || defaultParams.tenure_at_company,
      tenure_at_role: source.tenure_at_role || defaultParams.tenure_at_role,
      past_role: source.past_role || defaultParams.past_role,
      following_your_company: source.following_your_company ?? defaultParams.following_your_company,
      viewed_your_profile_recently: source.viewed_your_profile_recently ?? defaultParams.viewed_your_profile_recently,
      posted_on_linkedin: source.posted_on_linkedin ?? defaultParams.posted_on_linkedin,
      changed_jobs: source.changed_jobs ?? defaultParams.changed_jobs,
      past_colleague: source.past_colleague ?? defaultParams.past_colleague,
      shared_experiences: source.shared_experiences ?? defaultParams.shared_experiences,
      mentionned_in_news: source.mentionned_in_news ?? defaultParams.mentionned_in_news,
      viewed_profile_recently: source.viewed_profile_recently ?? defaultParams.viewed_profile_recently,
      messaged_recently: source.messaged_recently ?? defaultParams.messaged_recently,
      include_saved_leads: source.include_saved_leads ?? defaultParams.include_saved_leads,
      include_saved_accounts: source.include_saved_accounts ?? defaultParams.include_saved_accounts,
    };
  };

  const [parameters, setParameters] = useState<DefaultParameters>(() => {
    const defaultParams = getDefaultParameters();

    // If we have resolved parameters, use them instead
    if (resolvedParameters) {
      return mergeParameters(defaultParams, resolvedParameters);
    }

    // Merge with generated parameters if available
    if (generatedParameters) {
      return mergeParameters(defaultParams, generatedParameters);
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
      const current = parameters[key as keyof DefaultParameters];
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
      const current = parameters[key as keyof DefaultParameters];
      const newValue = newParams[key];
      
      if (Array.isArray(current) && Array.isArray(newValue)) {
        const sortSafe = (arr: any[]) => [...arr].slice().sort();
        return JSON.stringify(sortSafe(current)) !== JSON.stringify(sortSafe(newValue));
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
      onParametersChange?.(updated);
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
      const defaultParams = getDefaultParameters();
      const updatedParams = mergeParameters(defaultParams, generatedParameters);
      
      setParameters(updatedParams);
      onParametersChange?.(updatedParams);
      hasInitialized.current = true;
      
      // Log the generated parameters for debugging
      console.log('Generated parameters loaded:', {
        searchType,
        searchCategory,
        generated: generatedParameters,
        updatedParams: updatedParams,
        locationArray: generatedParameters.location,
        companyArray: generatedParameters.company,
        industryArray: generatedParameters.industry,
        schoolArray: generatedParameters.school
      });
    }
  }, [generatedParameters, onParametersChange, searchType, searchCategory]);

  // Effect to handle resolvedParameters updates - only update if parameters haven't been user-modified
  useEffect(() => {
    // Check if resolvedParameters actually changed
    const resolvedChanged = JSON.stringify(resolvedParameters) !== JSON.stringify(lastResolvedParameters.current);
    
    if (resolvedParameters && hasInitialized.current && resolvedChanged) {
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
        const defaultParams = getDefaultParameters();
        const updatedParams = mergeParameters(defaultParams, resolvedParameters);
        
        setParameters(updatedParams);
        onParametersChange?.(updatedParams);
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

  return {
    parameters,
    updateParameters,
    hasResolvedParameters: hasResolvedParameters(),
    areCurrentParametersModified: areCurrentParametersModified(),
    hasGeneratedParams: generatedParameters && (
      generatedParameters.classicPeopleSearch || 
      generatedParameters.classicCompaniesSearch || 
      generatedParameters.classicJobsSearch ||
      generatedParameters.salesNavigatorPeopleSearch ||
      generatedParameters.salesNavigatorCompaniesSearch ||
      generatedParameters.recruiterPeopleSearch
    ),
  };
};
