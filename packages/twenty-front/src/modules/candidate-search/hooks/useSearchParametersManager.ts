import { parsedJDSelector } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { DefaultParameters } from '@/candidate-search/types/candidate-search.types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import { LinkedInSearchCategory, LinkedInSearchType } from 'twenty-shared';

export const useSearchParametersManager = (
  searchType: LinkedInSearchType,
  searchCategory: LinkedInSearchCategory,
  generatedParameters?: any,
  resolvedParameters?: any,
  onParametersChange?: (parameters: any) => void,
  onSearchFilterUpdate?: (
    searchType: LinkedInSearchType,
    searchCategory: LinkedInSearchCategory,
    generatedParameters: any,
    resolvedParameters: any
  ) => Promise<void>,
  initialParameters?: any
) => {
  const [parsedJD, setParsedJD] = useRecoilState(parsedJDSelector);
  const searchFilterId = parsedJD?.searchFilters?.[0]?.id;
  
  // Helper function to construct parameter key matching backend logic
  const constructParameterKey = (searchType: LinkedInSearchType, searchCategory: LinkedInSearchCategory): string => {
    const camelCaseSearchType = searchType.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    const capitalizedCategory = searchCategory.charAt(0).toUpperCase() + searchCategory.slice(1);
    return `${camelCaseSearchType}${capitalizedCategory}Search`;
  };

  // Create a stable reference to search parameters to prevent infinite loops
  const stableSearchParameters = useMemo(() => {
    if (!parsedJD?.searchFilters) return null;
    
    const parameterKey = constructParameterKey(searchType, searchCategory);
    
    // Find the relevant parameters for this search type/category
    const relevantParams = parsedJD.searchFilters.find(filter => {
      const searchFilterParam = filter.searchFilterParameter;
      if (!searchFilterParam) return false;
      
      // Check if this parameter entry contains the specific search type/category key
      const hasGenerated = searchFilterParam.generatedSearchParameters && (searchFilterParam.generatedSearchParameters as any)[parameterKey];
      const hasResolved = searchFilterParam.resolvedSearchParameters && (searchFilterParam.resolvedSearchParameters as any)[parameterKey];
      
      // Also check for the exact parameter key in resolvedSearchParameters
      const hasExactResolved = searchFilterParam.resolvedSearchParameters && (searchFilterParam.resolvedSearchParameters as any)[parameterKey];
      
      // Check if resolvedSearchParameters contains direct parameters for this search type
      const hasDirectParams = searchFilterParam.resolvedSearchParameters && 
        Object.keys(searchFilterParam.resolvedSearchParameters).some(key => {
          // Check if the key matches the parameter key exactly
          if (key === parameterKey) return true;
          
          // Check if the key contains the search type and category
          if (key.includes(searchType) && key.includes(searchCategory)) return true;
          
          // Check if it's a direct parameter (not a display parameter)
          const directParamKeys = [
            'keywords', 'network_distance', 'industry', 'location', 'company', 'school', 'skills', 
            'seniority', 'job_type', 'presence', 'headcount', 'tenure', 'company_headcount', 
            'function', 'role', 'company_type', 'tenure_at_company', 'tenure_at_role', 'past_role',
            'following_your_company', 'viewed_your_profile_recently', 'posted_on_linkedin', 
            'changed_jobs', 'past_colleague', 'shared_experiences', 'mentionned_in_news',
            'viewed_profile_recently', 'messaged_recently', 'include_saved_leads', 
            'include_saved_accounts', 'groups', 'spoken_languages', 'profile_language', 
            'spotlights', 'recruiting_activity', 'recently_joined', 'first_name', 'last_name', 
            'notes', 'past_companies', 'current_companies', 'graduation_year_range', 
            'military_background', 'past_applicants', 'hide_previously_viewed', 'locale', 
            'saved_filter', 'location_within_area', 'activity_filters', 'time_at_current_company', 
            'past_roles', 'experience_tenure', 'search_category', 'search_type', 'exclude', 
            'tenure_range', 'company_headcount_ranges'
          ];
          return directParamKeys.includes(key);
        });
      
      return hasGenerated || hasResolved || hasExactResolved || hasDirectParams;
    });
    
    // Create a content key only for the relevant parameters
    const contentKey = relevantParams ? JSON.stringify({
      generated: relevantParams.searchFilterParameter?.generatedSearchParameters,
      resolved: relevantParams.searchFilterParameter?.resolvedSearchParameters,
      parameterKey
    }) : 'no-relevant-params';
    
    return {
      data: parsedJD.searchFilters,
      relevantParams: relevantParams?.searchFilterParameter,
      contentKey
    };
  }, [parsedJD?.searchFilters, searchType, searchCategory]);

  // Create a stable reference to resolvedParameters to detect actual changes
  const stableResolvedParameters = useMemo(() => {
    if (!resolvedParameters) return null;
    
    // Create a more specific key that includes the current search type/category
    const parameterKey = constructParameterKey(searchType, searchCategory);
    const searchSpecificParams = resolvedParameters[parameterKey];

    const timestamp = Date.now();
    return JSON.stringify({
      all: resolvedParameters,
      specific: searchSpecificParams,
      key: parameterKey,
      isCleared: searchSpecificParams && Object.keys(searchSpecificParams).length === 0,
      timestamp: timestamp
    });
  }, [resolvedParameters, searchType, searchCategory]);

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
      // Additional LinkedIn search parameters
      past_companies: [],
      current_companies: [],
      graduation_year_range: { min: undefined, max: undefined },
      military_background: false,
      past_applicants: false,
      hide_previously_viewed: { days: undefined },
      locale: '',
      saved_filter: '',
      location_within_area: undefined,
      activity_filters: [],
      time_at_current_company: { min: undefined, max: undefined },
      past_roles: [],
      experience_tenure: { min: undefined, max: undefined },
      search_category: '',
      search_type: '',
      exclude: [],
      tenure_range: { min: undefined, max: undefined },
      company_headcount_ranges: [],
    };

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
    
    // Check if sourceParams is in the new nested structure
    const parameterKey = constructParameterKey(searchType, searchCategory);
    
    if (sourceParams[parameterKey]) {
      // New nested structure - search-specific parameters
      source = sourceParams[parameterKey];
    } else {
      // Check for old nested structure
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
      
      // If still no source found, check if sourceParams is a flat structure (direct parameters)
      if (!source || Object.keys(source).length === 0) {
        // Check if sourceParams contains direct parameter keys (flat structure)
        // Filter parameters based on search type and category to avoid loading wrong parameter types
        let directParamKeys: string[] = [];
        
        if (searchType === 'classic') {
          if (searchCategory === 'people') {
            directParamKeys = [
              'keywords', 'network_distance', 'industry', 'location', 'company', 'school', 
              'profile_language', 'past_company', 'service', 'connections_of', 'followers_of', 'open_to',
              'advanced_keywords'
            ];
          } else if (searchCategory === 'companies') {
            directParamKeys = [
              'keywords', 'industry', 'location', 'headcount'
            ];
          } else if (searchCategory === 'jobs') {
            directParamKeys = [
              'keywords', 'industry', 'location', 'company', 'seniority', 'job_type', 'presence'
            ];
          }
        } else if (searchType === 'sales_navigator') {
          if (searchCategory === 'people') {
            directParamKeys = [
              'keywords', 'last_viewed_at', 'saved_search_id', 'recent_search_id', 'location',
              'location_by_postal_code', 'industry', 'first_name', 'last_name', 'tenure', 'groups',
              'school', 'profile_language', 'company', 'company_headcount', 'company_type',
              'company_location', 'tenure_at_company', 'past_company', 'function', 'role',
              'tenure_at_role', 'past_role', 'seniority', 'following_your_company',
              'viewed_your_profile_recently', 'network_distance', 'connections_of', 'past_colleague',
              'shared_experiences', 'mentionned_in_news', 'viewed_profile_recently', 'messaged_recently',
              'include_saved_leads', 'include_saved_accounts'
            ];
          } else if (searchCategory === 'companies') {
            directParamKeys = [
              'keywords', 'industry', 'location', 'company_headcount', 'company_type', 'company_location'
            ];
          }
        } else if (searchType === 'recruiter' && searchCategory === 'people') {
          directParamKeys = [
            'keywords', 'groups', 'spoken_languages', 'profile_language', 'spotlights', 'recruiting_activity',
            'recently_joined', 'first_name', 'last_name', 'notes', 'past_companies', 
            'current_companies', 'graduation_year_range', 'military_background', 'past_applicants',
            'hide_previously_viewed', 'locale', 'saved_filter', 'location_within_area',
            'activity_filters', 'time_at_current_company', 'past_roles', 'experience_tenure',
            'search_category', 'search_type', 'exclude', 'tenure_range', 'company_headcount_ranges'
          ];
        }
        
        const hasDirectParams = directParamKeys.some(key => sourceParams.hasOwnProperty(key));
        
        if (hasDirectParams) {
          source = sourceParams; // Use the flat structure directly
        }
      }
    }
    
    // Additional check: if source is still empty, try to extract from the top-level sourceParams
    // This handles cases where parameters are stored directly in resolvedSearchParameters
    if (!source || Object.keys(source).length === 0) {
      // Filter parameters based on search type and category to avoid loading wrong parameter types
      let directParamKeys: string[] = [];
      
      if (searchType === 'classic') {
        if (searchCategory === 'people') {
          directParamKeys = [
            'keywords', 'network_distance', 'industry', 'location', 'company', 'school', 
            'profile_language', 'past_company', 'service', 'connections_of', 'followers_of', 'open_to',
            'advanced_keywords'
          ];
        } else if (searchCategory === 'companies') {
          directParamKeys = [
            'keywords', 'industry', 'location', 'headcount'
          ];
        } else if (searchCategory === 'jobs') {
          directParamKeys = [
            'keywords', 'industry', 'location', 'company', 'seniority', 'job_type', 'presence'
          ];
        }
      } else if (searchType === 'sales_navigator') {
        if (searchCategory === 'people') {
          directParamKeys = [
            'keywords', 'last_viewed_at', 'saved_search_id', 'recent_search_id', 'location',
            'location_by_postal_code', 'industry', 'first_name', 'last_name', 'tenure', 'groups',
            'school', 'profile_language', 'company', 'company_headcount', 'company_type',
            'company_location', 'tenure_at_company', 'past_company', 'function', 'role',
            'tenure_at_role', 'past_role', 'seniority', 'following_your_company',
            'viewed_your_profile_recently', 'network_distance', 'connections_of', 'past_colleague',
            'shared_experiences', 'mentionned_in_news', 'viewed_profile_recently', 'messaged_recently',
            'include_saved_leads', 'include_saved_accounts'
          ];
        } else if (searchCategory === 'companies') {
          directParamKeys = [
            'keywords', 'industry', 'location', 'company_headcount', 'company_type', 'company_location'
          ];
        }
      } else if (searchType === 'recruiter' && searchCategory === 'people') {
        directParamKeys = [
          'keywords', 'groups', 'spoken_languages', 'profile_language', 'spotlights', 'recruiting_activity',
          'recently_joined', 'first_name', 'last_name', 'notes', 'past_companies', 
          'current_companies', 'graduation_year_range', 'military_background', 'past_applicants',
          'hide_previously_viewed', 'locale', 'saved_filter', 'location_within_area',
          'activity_filters', 'time_at_current_company', 'past_roles', 'experience_tenure',
          'search_category', 'search_type', 'exclude', 'tenure_range', 'company_headcount_ranges'
        ];
      }
      
      const hasDirectParams = directParamKeys.some(key => sourceParams.hasOwnProperty(key));
      
      if (hasDirectParams) {
        source = sourceParams; // Use the flat structure directly
      } else {
        // If sourceParams only contains display information, create a minimal source object
        // This prevents the mergeParameters from resetting existing values to defaults
        const displayOnlyKeys = ['industry_display', 'location_display', 'company_display', 'school_display'];
        const hasDisplayOnly = displayOnlyKeys.some(key => sourceParams.hasOwnProperty(key));
        
        if (hasDisplayOnly) {
          // Create an empty source object to preserve existing values
          source = {};
        }
      }
    }

    // Also check parsedJD for display information
    let displayInfo: any = {};
    if (parsedJD?.searchFilters) {
      for (const searchFilter of parsedJD.searchFilters) {
        const searchFilterParam = searchFilter.searchFilterParameter;
        if (searchFilterParam?.resolvedSearchParameters) {
          // Extract display information for each parameter type
          const resolvedParams = searchFilterParam.resolvedSearchParameters as any;
          if (resolvedParams.industry_display) {
            displayInfo.industry_display = resolvedParams.industry_display;
          }
          if (resolvedParams.location_display) {
            displayInfo.location_display = resolvedParams.location_display;
          }
          if (resolvedParams.company_display) {
            displayInfo.company_display = resolvedParams.company_display;
          }
          if (resolvedParams.school_display) {
            displayInfo.school_display = resolvedParams.school_display;
          }
        }
      }
    }
    
    // Also check sourceParams directly for display information (in case it's already resolved)
    if (sourceParams.industry_display) {
      displayInfo.industry_display = sourceParams.industry_display;
    }
    if (sourceParams.location_display) {
      displayInfo.location_display = sourceParams.location_display;
    }
    if (sourceParams.company_display) {
      displayInfo.company_display = sourceParams.company_display;
    }
    if (sourceParams.school_display) {
      displayInfo.school_display = sourceParams.school_display;
    }
    
    // Also check nested structures for display information
    if (source.classicPeopleSearch?.industry_display) {
      displayInfo.industry_display = source.classicPeopleSearch.industry_display;
    }
    if (source.classicPeopleSearch?.location_display) {
      displayInfo.location_display = source.classicPeopleSearch.location_display;
    }
    if (source.classicPeopleSearch?.company_display) {
      displayInfo.company_display = source.classicPeopleSearch.company_display;
    }
    if (source.classicPeopleSearch?.school_display) {
      displayInfo.school_display = source.classicPeopleSearch.school_display;
    }
    
    // Check other search types as well
    if (source.salesNavigatorPeopleSearch?.industry_display) {
      displayInfo.industry_display = source.salesNavigatorPeopleSearch.industry_display;
    }
    if (source.salesNavigatorPeopleSearch?.location_display) {
      displayInfo.location_display = source.salesNavigatorPeopleSearch.location_display;
    }
    if (source.salesNavigatorPeopleSearch?.company_display) {
      displayInfo.company_display = source.salesNavigatorPeopleSearch.company_display;
    }
    if (source.salesNavigatorPeopleSearch?.school_display) {
      displayInfo.school_display = source.salesNavigatorPeopleSearch.school_display;
    }
    
    const mergedParams = {
      ...defaultParams,
      // Basic search parameters
      keywords: source.keywords !== undefined ? source.keywords : defaultParams.keywords,
      network_distance: source.network_distance !== undefined ? source.network_distance : defaultParams.network_distance,
      industry: source.industry !== undefined ? source.industry : defaultParams.industry,
      location: source.location !== undefined ? source.location : defaultParams.location,
      company: source.company !== undefined ? source.company : defaultParams.company,
      school: source.school !== undefined ? source.school : defaultParams.school,
      seniority: source.seniority !== undefined ? source.seniority : defaultParams.seniority,
      job_type: source.job_type !== undefined ? source.job_type : defaultParams.job_type,
      presence: source.presence !== undefined ? source.presence : defaultParams.presence,
      headcount: source.headcount || defaultParams.headcount,
      // Sales Navigator specific fields
      tenure: source.tenure || defaultParams.tenure,
      company_headcount: searchType === 'recruiter' ? (source.company_headcount || []) : (source.company_headcount || defaultParams.company_headcount),
      function: searchType === 'recruiter' ? (source.function || []) : (source.function || defaultParams.function),
      role: searchType === 'recruiter' ? (source.role || []) : (source.role || defaultParams.role),
      company_type: source.company_type !== undefined ? source.company_type : defaultParams.company_type,
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
      // Recruiter specific fields
      skills: searchType === 'recruiter' ? (source.skills !== undefined ? source.skills : []) : (source.skills !== undefined ? source.skills : defaultParams.skills),
      groups: searchType === 'recruiter' ? (source.groups !== undefined ? source.groups : []) : (source.groups !== undefined ? source.groups : defaultParams.groups),
      spoken_languages: searchType === 'recruiter' ? (source.spoken_languages !== undefined ? source.spoken_languages : []) : (source.spoken_languages !== undefined ? source.spoken_languages : defaultParams.spoken_languages),
      profile_language: searchType === 'recruiter' ? (source.profile_language !== undefined ? source.profile_language : []) : (source.profile_language !== undefined ? source.profile_language : defaultParams.profile_language),
      spotlights: searchType === 'recruiter' ? (source.spotlights !== undefined ? source.spotlights : []) : (source.spotlights !== undefined ? source.spotlights : defaultParams.spotlights),
      recruiting_activity: searchType === 'recruiter' ? (source.recruiting_activity !== undefined ? source.recruiting_activity : []) : (source.recruiting_activity !== undefined ? source.recruiting_activity : defaultParams.recruiting_activity),
      recently_joined: searchType === 'recruiter' ? (source.recently_joined !== undefined ? source.recently_joined : []) : (source.recently_joined !== undefined ? source.recently_joined : defaultParams.recently_joined),
      first_name: searchType === 'recruiter' ? (source.first_name !== undefined ? source.first_name : []) : (source.first_name !== undefined ? source.first_name : defaultParams.first_name),
      last_name: searchType === 'recruiter' ? (source.last_name !== undefined ? source.last_name : []) : (source.last_name !== undefined ? source.last_name : defaultParams.last_name),
      notes: searchType === 'recruiter' ? (source.notes !== undefined ? source.notes : []) : (source.notes !== undefined ? source.notes : defaultParams.notes),
      // Additional LinkedIn search parameters
      past_companies: source.past_companies !== undefined ? source.past_companies : defaultParams.past_companies,
      current_companies: source.current_companies !== undefined ? source.current_companies : defaultParams.current_companies,
      graduation_year_range: source.graduation_year_range || defaultParams.graduation_year_range,
      military_background: source.military_background ?? defaultParams.military_background,
      past_applicants: source.past_applicants ?? defaultParams.past_applicants,
      hide_previously_viewed: source.hide_previously_viewed || defaultParams.hide_previously_viewed,
      locale: source.locale !== undefined ? source.locale : defaultParams.locale,
      saved_filter: source.saved_filter !== undefined ? source.saved_filter : defaultParams.saved_filter,
      location_within_area: source.location_within_area !== undefined ? source.location_within_area : defaultParams.location_within_area,
      activity_filters: source.activity_filters !== undefined ? source.activity_filters : defaultParams.activity_filters,
      time_at_current_company: source.time_at_current_company || defaultParams.time_at_current_company,
      past_roles: source.past_roles !== undefined ? source.past_roles : defaultParams.past_roles,
      experience_tenure: source.experience_tenure || defaultParams.experience_tenure,
      search_category: source.search_category !== undefined ? source.search_category : defaultParams.search_category,
      search_type: source.search_type !== undefined ? source.search_type : defaultParams.search_type,
      exclude: source.exclude !== undefined ? source.exclude : defaultParams.exclude,
      tenure_range: source.tenure_range || defaultParams.tenure_range,
      company_headcount_ranges: source.company_headcount_ranges !== undefined ? source.company_headcount_ranges : defaultParams.company_headcount_ranges,
      // Include display information from parsedJD
      ...displayInfo,
    };
    
    return mergedParams;
  };

  const [parameters, setParameters] = useState<DefaultParameters>(() => {
    const defaultParams = getDefaultParameters();
    
    // PRIORITY 1: Use initial parameters if provided (from persistent state)
    if (initialParameters) {
      const merged = mergeParameters(defaultParams, initialParameters);
      return merged;
    }
    
    // PRIORITY 2: If we have resolved parameters, use them instead
    if (resolvedParameters) {
      const merged = mergeParameters(defaultParams, resolvedParameters);
      return merged;
    }

    // PRIORITY 3: Merge with generated parameters if available
    if (generatedParameters) {
      const merged = mergeParameters(defaultParams, generatedParameters);
      return merged;
    }

    return defaultParams;
  });

  // Debounce timer for API calls to prevent rapid-fire requests
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Debounce timer for parameter updates to prevent excessive API calls on every keystroke
  const parameterDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

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
    // Only check if the current parameters are actually resolved (contain LinkedIn IDs)
    // Don't check resolvedParameters prop as it may exist but not be applied yet
    return areParametersResolved(parameters);
  };

  // Check if current parameters are user-modified (different from generated)
  const areCurrentParametersModified = useCallback(() => {
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
    
    return isModified;
  }, [generatedParameters, searchType, searchCategory, parameters]);

  // Function to save parameters to Recoil state
  const saveParametersToRecoil = useCallback((updatedParams: DefaultParameters) => {
    if (!parsedJD) return;
    
    // Extract display information from updatedParams
    const displayInfo: any = {};
    if ((updatedParams as any).industry_display) {
      displayInfo.industry_display = (updatedParams as any).industry_display;
    }
    if ((updatedParams as any).location_display) {
      displayInfo.location_display = (updatedParams as any).location_display;
    }
    if ((updatedParams as any).company_display) {
      displayInfo.company_display = (updatedParams as any).company_display;
    }
    if ((updatedParams as any).school_display) {
      displayInfo.school_display = (updatedParams as any).school_display;
    }
    
    // Also preserve existing display information from parsedJD if not in updatedParams
    if (parsedJD?.searchFilters) {
      for (const searchFilter of parsedJD.searchFilters) {
        const searchFilterParam = searchFilter.searchFilterParameter;
        if (searchFilterParam?.resolvedSearchParameters) {
          const resolvedParams = searchFilterParam.resolvedSearchParameters as any;
          if (!displayInfo.industry_display && resolvedParams.industry_display) {
            displayInfo.industry_display = resolvedParams.industry_display;
          }
          if (!displayInfo.location_display && resolvedParams.location_display) {
            displayInfo.location_display = resolvedParams.location_display;
          }
          if (!displayInfo.company_display && resolvedParams.company_display) {
            displayInfo.company_display = resolvedParams.company_display;
          }
          if (!displayInfo.school_display && resolvedParams.school_display) {
            displayInfo.school_display = resolvedParams.school_display;
          }
        }
      }
    }
    
    // TODO: Update utility functions to work with new searchFilters structure
    // For now, we'll update the searchFilters directly
    // const updatedSearchParams = updateSearchParameterEntry(
    //   parsedJD.searchParameters,
    //   searchType,
    //   searchCategory,
    //   updatedParams,
    //   { ...updatedParams, ...displayInfo }
    // );
    
    // Update the parsedJD state with searchFilters structure
    setParsedJD(prevParsedJD => {
      if (!prevParsedJD) return prevParsedJD;
      
      // Find existing search filter or create new one
      const existingFilterIndex = prevParsedJD.searchFilters?.findIndex(filter => 
        filter.searchFilterParameter?.resolvedSearchParameters
      ) ?? -1;
      
      const parameterKey = constructParameterKey(searchType, searchCategory);
      const resolvedParams = { ...updatedParams, ...displayInfo };
      
      if (existingFilterIndex >= 0 && prevParsedJD.searchFilters) {
        // Update existing filter
        const updatedFilters = [...prevParsedJD.searchFilters];
        const existingFilter = updatedFilters[existingFilterIndex];
        updatedFilters[existingFilterIndex] = {
          ...existingFilter,
          searchFilterParameter: {
            ...existingFilter.searchFilterParameter,
            resolvedSearchParameters: {
              ...existingFilter.searchFilterParameter?.resolvedSearchParameters,
              [parameterKey]: resolvedParams
            }
          }
        };
        
        return {
          ...prevParsedJD,
          searchFilters: updatedFilters
        };
      } else {
        // Create new filter
        const newFilter = {
          id: `search-filter-${Date.now()}`,
          name: `${searchType}_${searchCategory}`,
          searchFilterParameter: {
            resolvedSearchParameters: {
              [parameterKey]: resolvedParams
            }
          }
        };
        
        return {
          ...prevParsedJD,
          searchFilters: [...(prevParsedJD.searchFilters || []), newFilter]
        };
      }
    });
    
  }, [parsedJD, searchType, searchCategory, setParsedJD]);

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
      setParameters(updated);
      
      if (parameterDebounceTimerRef.current) {
        clearTimeout(parameterDebounceTimerRef.current);
      }
      
      // Debounce the API calls and Recoil state updates
      parameterDebounceTimerRef.current = setTimeout(() => {
        onParametersChange?.(updated);
        saveParametersToRecoil(updated);
      }, 300); // 300ms debounce delay for parameter updates
    } 
  }, [parameters, onParametersChange, saveParametersToRecoil]);

  // Function to update search filter record when parameters change (with debouncing)
  const updateSearchFilterRecord = useCallback(async (
    newSearchType: LinkedInSearchType,
    newSearchCategory: LinkedInSearchCategory,
    newGeneratedParameters: any,
    newResolvedParameters: any
  ) => {
    if (!searchFilterId || !onSearchFilterUpdate) {
      return;
    }

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new debounced timer
    debounceTimerRef.current = setTimeout(async () => {
      try {

        
        await onSearchFilterUpdate(
          newSearchType,
          newSearchCategory,
          newGeneratedParameters,
          newResolvedParameters
        );
      } catch (error) {
        console.error('Failed to update search filter record:', error);
      }
    }, 500); // 500ms debounce delay
  }, [searchFilterId, onSearchFilterUpdate]);

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (parameterDebounceTimerRef.current) {
        clearTimeout(parameterDebounceTimerRef.current);
      }
    };
  }, []);

  // Consolidate search parameters on mount to ensure only one entry per searchPlanId
  
  // Initialize parameters - reactive to Recoil state changes
  useEffect(() => {
    // Early return if no stable parameters and no generated/resolved parameters
    if (!stableSearchParameters?.relevantParams && !generatedParameters && !resolvedParameters) {
      return;
    }


    const defaultParams = getDefaultParameters();
    let paramsToMerge = defaultParams;
    
    // PRIORITY 1: Load from parsedJD resolvedSearchParameters (contains user's latest changes)
    if (stableSearchParameters?.relevantParams?.resolvedSearchParameters) {
      const resolvedParams = stableSearchParameters.relevantParams.resolvedSearchParameters;

      // Check if resolvedSearchParameters contains search-specific parameters
      const parameterKey = constructParameterKey(searchType, searchCategory);
      const searchSpecificParams = (resolvedParams as any)[parameterKey];
      
      if (searchSpecificParams) {
        // Use search-specific parameters
        paramsToMerge = mergeParameters(paramsToMerge, searchSpecificParams);
      } else {
        // Check if resolvedSearchParameters contains direct parameters (flat structure)
        // Filter parameters based on search type and category to avoid loading wrong parameter types
        let directParamKeys: string[] = [];
        
        if (searchType === 'classic') {
          if (searchCategory === 'people') {
            directParamKeys = [
              'keywords', 'network_distance', 'industry', 'location', 'company', 'school', 
              'profile_language', 'past_company', 'service', 'connections_of', 'followers_of', 'open_to',
              'advanced_keywords'
            ];
          } else if (searchCategory === 'companies') {
            directParamKeys = [
              'keywords', 'industry', 'location', 'headcount'
            ];
          } else if (searchCategory === 'jobs') {
            directParamKeys = [
              'keywords', 'industry', 'location', 'company', 'seniority', 'job_type', 'presence'
            ];
          }
        } else if (searchType === 'sales_navigator') {
          if (searchCategory === 'people') {
            directParamKeys = [
              'keywords', 'last_viewed_at', 'saved_search_id', 'recent_search_id', 'location',
              'location_by_postal_code', 'industry', 'first_name', 'last_name', 'tenure', 'groups',
              'school', 'profile_language', 'company', 'company_headcount', 'company_type',
              'company_location', 'tenure_at_company', 'past_company', 'function', 'role',
              'tenure_at_role', 'past_role', 'seniority', 'following_your_company',
              'viewed_your_profile_recently', 'network_distance', 'connections_of', 'past_colleague',
              'shared_experiences', 'mentionned_in_news', 'viewed_profile_recently', 'messaged_recently',
              'include_saved_leads', 'include_saved_accounts'
            ];
          } else if (searchCategory === 'companies') {
            directParamKeys = [
              'keywords', 'industry', 'location', 'company_headcount', 'company_type', 'company_location'
            ];
          }
        } else if (searchType === 'recruiter' && searchCategory === 'people') {
          directParamKeys = [
            'keywords', 'groups', 'spoken_languages', 'profile_language', 'spotlights', 'recruiting_activity',
            'recently_joined', 'first_name', 'last_name', 'notes', 'past_companies', 
            'current_companies', 'graduation_year_range', 'military_background', 'past_applicants',
            'hide_previously_viewed', 'locale', 'saved_filter', 'location_within_area',
            'activity_filters', 'time_at_current_company', 'past_roles', 'experience_tenure',
            'search_category', 'search_type', 'exclude', 'tenure_range', 'company_headcount_ranges'
          ];
        }
        
        const hasDirectParams = directParamKeys.some(key => resolvedParams.hasOwnProperty(key));
        
        if (hasDirectParams) {
          paramsToMerge = mergeParameters(paramsToMerge, resolvedParams);
        }
      }
    }
    
    // PRIORITY 2: Load from parsedJD generatedSearchParameters (fallback for initial values)
    if (stableSearchParameters?.relevantParams?.generatedSearchParameters) {
      const generatedParams = stableSearchParameters.relevantParams.generatedSearchParameters;
      const parameterKey = constructParameterKey(searchType, searchCategory);
      const searchSpecificParams = (generatedParams as any)[parameterKey];
      
      if (searchSpecificParams) {
        // Merge search-specific parameters (only if not already set from resolved)
        paramsToMerge = mergeParameters(paramsToMerge, searchSpecificParams);
      } else {
        // Check if generatedSearchParameters contains direct parameters (flat structure)
        // Filter parameters based on search type and category to avoid loading wrong parameter types
        let directParamKeys: string[] = [];
        
        if (searchType === 'classic') {
          if (searchCategory === 'people') {
            directParamKeys = [
              'keywords', 'network_distance', 'industry', 'location', 'company', 'school', 
              'profile_language', 'past_company', 'service', 'connections_of', 'followers_of', 'open_to',
              'advanced_keywords'
            ];
          } else if (searchCategory === 'companies') {
            directParamKeys = [
              'keywords', 'industry', 'location', 'headcount'
            ];
          } else if (searchCategory === 'jobs') {
            directParamKeys = [
              'keywords', 'industry', 'location', 'company', 'seniority', 'job_type', 'presence'
            ];
          }
        } else if (searchType === 'sales_navigator') {
          if (searchCategory === 'people') {
            directParamKeys = [
              'keywords', 'last_viewed_at', 'saved_search_id', 'recent_search_id', 'location',
              'location_by_postal_code', 'industry', 'first_name', 'last_name', 'tenure', 'groups',
              'school', 'profile_language', 'company', 'company_headcount', 'company_type',
              'company_location', 'tenure_at_company', 'past_company', 'function', 'role',
              'tenure_at_role', 'past_role', 'seniority', 'following_your_company',
              'viewed_your_profile_recently', 'network_distance', 'connections_of', 'past_colleague',
              'shared_experiences', 'mentionned_in_news', 'viewed_profile_recently', 'messaged_recently',
              'include_saved_leads', 'include_saved_accounts'
            ];
          } else if (searchCategory === 'companies') {
            directParamKeys = [
              'keywords', 'industry', 'location', 'company_headcount', 'company_type', 'company_location'
            ];
          }
        } else if (searchType === 'recruiter' && searchCategory === 'people') {
          directParamKeys = [
            'keywords', 'groups', 'spoken_languages', 'profile_language', 'spotlights', 'recruiting_activity',
            'recently_joined', 'first_name', 'last_name', 'notes', 'past_companies', 
            'current_companies', 'graduation_year_range', 'military_background', 'past_applicants',
            'hide_previously_viewed', 'locale', 'saved_filter', 'location_within_area',
            'activity_filters', 'time_at_current_company', 'past_roles', 'experience_tenure',
            'search_category', 'search_type', 'exclude', 'tenure_range', 'company_headcount_ranges'
          ];
        }
        
        const hasDirectParams = directParamKeys.some(key => generatedParams.hasOwnProperty(key));
        
        if (hasDirectParams) {
          // Merge direct parameters from generatedSearchParameters (only if not already set from resolved)
          paramsToMerge = mergeParameters(paramsToMerge, generatedParams);
        }
      }
    }
    
    // PRIORITY 3: Merge with external generated parameters if available (lowest priority)
    if (generatedParameters) {
      paramsToMerge = mergeParameters(paramsToMerge, generatedParameters);
    }
    
    
    // Only update if parameters actually changed
    const hasChanged = Object.keys(paramsToMerge).some(key => {
      const current = parameters[key as keyof DefaultParameters];
      const newValue = paramsToMerge[key as keyof DefaultParameters];
      
      if (Array.isArray(current) && Array.isArray(newValue)) {
        const sortSafe = (arr: any[]) => [...arr].slice().sort();
        const currentStr = JSON.stringify(sortSafe(current));
        const newStr = JSON.stringify(sortSafe(newValue));
        const changed = currentStr !== newStr;
        return changed;
      }
      
      const currentStr = JSON.stringify(current);
      const newStr = JSON.stringify(newValue);
      const changed = currentStr !== newStr;
      return changed;
    });
    
    if (hasChanged) {
      setParameters(paramsToMerge);
      // Don't call onParametersChange here to prevent infinite loop
      // onParametersChange will be called by updateParameters when user makes changes
    } 
  }, [stableSearchParameters?.contentKey, generatedParameters, searchType, searchCategory]);

  // Separate useEffect to handle resolvedParameters changes without infinite loop
  useEffect(() => {
    if (resolvedParameters && stableResolvedParameters) {
      
      // Check if resolvedParameters contains search-specific parameters for current search type/category
      const parameterKey = constructParameterKey(searchType, searchCategory);
      const searchSpecificParams = resolvedParameters[parameterKey];
      
      
      // Check if parameters were cleared (empty object or undefined)
      if (!searchSpecificParams || (searchSpecificParams && Object.keys(searchSpecificParams).length === 0)) {
        const defaultParams = getDefaultParameters();
        setParameters(defaultParams);
        return;
      }
      
      // Only update if we have search-specific parameters for the current search type/category
      if (searchSpecificParams && Object.keys(searchSpecificParams).length > 0) {
        
        const defaultParams = getDefaultParameters();
        const paramsToMerge = mergeParameters(defaultParams, searchSpecificParams);

        // Only update if parameters actually changed
        const hasChanged = Object.keys(paramsToMerge).some(key => {
          const current = parameters[key as keyof DefaultParameters];
          const newValue = paramsToMerge[key as keyof DefaultParameters];
          
          if (Array.isArray(current) && Array.isArray(newValue)) {
            const sortSafe = (arr: any[]) => [...arr].slice().sort();
            return JSON.stringify(sortSafe(current)) !== JSON.stringify(sortSafe(newValue));
          }
          return JSON.stringify(current) !== JSON.stringify(newValue);
        });
        
        if (hasChanged) {
          setParameters(paramsToMerge);
        } 
      }
    } 
  }, [stableResolvedParameters, searchType, searchCategory]); // Use stable reference to detect actual changes

  // Handle initialParameters changes (for persistent state restoration)
  useEffect(() => {
    if (initialParameters) {
      console.log('useSearchParametersManager: initialParameters changed, updating parameters:', initialParameters);
      
      const defaultParams = getDefaultParameters();
      const mergedParams = mergeParameters(defaultParams, initialParameters);
      
      // Only update if parameters actually changed
      const hasChanged = Object.keys(mergedParams).some(key => {
        const current = parameters[key as keyof DefaultParameters];
        const newValue = mergedParams[key as keyof DefaultParameters];
        
        if (Array.isArray(current) && Array.isArray(newValue)) {
          const sortSafe = (arr: any[]) => [...arr].slice().sort();
          return JSON.stringify(sortSafe(current)) !== JSON.stringify(sortSafe(newValue));
        }
        return JSON.stringify(current) !== JSON.stringify(newValue);
      });
      
      if (hasChanged) {
        console.log('useSearchParametersManager: Parameters changed, updating state');
        setParameters(mergedParams);
      }
    }
  }, [initialParameters]); // Only depend on initialParameters

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
