import { enrichmentsState } from '@/arx-enrich/states/arxEnrichModalOpenState';
import { ParsedJD } from '@/arx-jd-upload/types/ParsedJD';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { LinkedInSearchCategory, LinkedInSearchType } from '@/candidate-search/types/CandidateSearch';
import { searchPlansSelector } from '@/candidate-table/states/states';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useCallback, useState } from 'react';
import { useRecoilState } from 'recoil';

export interface SearchPlan {
  id: string;
  name: string;
  filters: {
    keywords: string[];
    jobTitle: string;
    location: string;
    industry: string;
    seniority: string;
    searchType: LinkedInSearchType;
    searchCategory: LinkedInSearchCategory;
  };
  enrichments: string[];
  columnFilters: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchPlanManager {
  searchPlans: SearchPlan[];
  currentSearchPlan: SearchPlan | null;
  createSearchPlan: (plan: Omit<SearchPlan, 'id' | 'createdAt' | 'updatedAt'>, parsedJD?: ParsedJD) => Promise<void>;
  updateSearchPlan: (id: string, updates: Partial<SearchPlan>, parsedJD?: ParsedJD) => Promise<void>;
  deleteSearchPlan: (id: string, parsedJD?: ParsedJD) => Promise<void>;
  setCurrentSearchPlan: (plan: SearchPlan | null) => void;
  applySearchPlan: (plan: SearchPlan) => Promise<void>;
  generateSearchPlanFromJD: (parsedJD: ParsedJD) => Promise<SearchPlan>;
  createEnrichmentsFromPlan: (plan: SearchPlan) => Promise<void>;
}

export const useSearchPlanManager = (): SearchPlanManager => {
  const [searchPlans, setSearchPlans] = useRecoilState(searchPlansSelector);
  const [currentSearchPlan, setCurrentSearchPlan] = useState<SearchPlan | null>(null);
  const [enrichments, setEnrichments] = useRecoilState(enrichmentsState);
  const [tokenPair] = useRecoilState(tokenPairState);
  const [currentWorkspaceMember] = useRecoilState(currentWorkspaceMemberState);
  const { enqueueSnackBar } = useSnackBar();

  const createSearchPlan = useCallback(async (plan: Omit<SearchPlan, 'id' | 'createdAt' | 'updatedAt'>, parsedJD?: ParsedJD) => {
    const newPlan: SearchPlan = {
      ...plan,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    setSearchPlans(prev => [...prev, newPlan]);
    setCurrentSearchPlan(newPlan);
    
    // Save to backend if we have the necessary data
    if (parsedJD?.searchFilters?.[0]?.id && tokenPair?.accessToken?.token) {
      try {
        // Convert search plan to enrichment configs format for backend
        const enrichmentConfigs = newPlan.enrichments.map((enrichment, index) => ({
          id: `${newPlan.id}_${index}`,
          name: enrichment,
          prompt: `Analyze the candidate's profile and provide a ${enrichment.toLowerCase()} score from 1-10.`,
          selectedModel: 'gpt-4o',
          fields: [
            {
              id: index * 10 + 1,
              name: enrichment.toLowerCase().replace(/\s+/g, '_'),
              type: 'Number',
              description: `${enrichment} score (1-10)`,
              required: true,
            }
          ],
        }));

        // Update searchFilter with enrichment configs
        await fetch(`${process.env.REACT_APP_SERVER_BASE_URL}/search-plan-chat/${parsedJD.searchFilters[0].id}/message`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            Authorization: `Bearer ${tokenPair.accessToken.token}` 
          },
          body: JSON.stringify({ 
            message: `Create search plan: ${newPlan.name} with enrichments: ${newPlan.enrichments.join(', ')}`,
            enrichmentConfigs: enrichmentConfigs,
            columnFilters: newPlan.columnFilters,
          }),
        });

        console.log('Successfully saved search plan to backend:', {
          searchFilterId: parsedJD.searchFilters[0].id,
          searchPlan: newPlan,
          enrichmentConfigs,
        });
      } catch (error) {
        console.error('Failed to save search plan to backend:', error);
        // Don't show error to user as the plan is still created locally
      }
    }
    
    enqueueSnackBar(`Search plan "${newPlan.name}" created successfully`, {
      variant: SnackBarVariant.Success,
    });
  }, [enqueueSnackBar, tokenPair?.accessToken?.token]);

  const updateSearchPlan = useCallback(async (id: string, updates: Partial<SearchPlan>, parsedJD?: ParsedJD) => {
    const updatedPlan = { ...updates, updatedAt: new Date() };
    
    setSearchPlans(prev => 
      prev.map(plan => 
        plan.id === id 
          ? { ...plan, ...updatedPlan }
          : plan
      )
    );
    
    if (currentSearchPlan?.id === id) {
      setCurrentSearchPlan(prev => prev ? { ...prev, ...updatedPlan } : null);
    }

    // Save to backend if we have the necessary data
    if (parsedJD?.searchFilters?.[0]?.id && tokenPair?.accessToken?.token) {
      try {
        await fetch(`${process.env.REACT_APP_SERVER_BASE_URL}/search-plan-chat/${parsedJD.searchFilters[0].id}/message`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            Authorization: `Bearer ${tokenPair.accessToken.token}` 
          },
          body: JSON.stringify({ 
            message: `Update search plan: ${updates.name || 'unnamed plan'} with updates: ${JSON.stringify(updates)}`,
          }),
        });

        console.log('Successfully updated search plan in backend:', {
          searchFilterId: parsedJD.searchFilters[0].id,
          planId: id,
          updates,
        });
      } catch (error) {
        console.error('Failed to update search plan in backend:', error);
        // Don't show error to user as the plan is still updated locally
      }
    }
  }, [currentSearchPlan?.id, tokenPair?.accessToken?.token]);

  const deleteSearchPlan = useCallback(async (id: string, parsedJD?: ParsedJD) => {
    const planToDelete = searchPlans.find(plan => plan.id === id);
    
    setSearchPlans(prev => prev.filter(plan => plan.id !== id));
    
    if (currentSearchPlan?.id === id) {
      setCurrentSearchPlan(null);
    }

    // Save to backend if we have the necessary data
    if (parsedJD?.searchFilters?.[0]?.id && tokenPair?.accessToken?.token && planToDelete) {
      try {
        await fetch(`${process.env.REACT_APP_SERVER_BASE_URL}/search-plan-chat/${parsedJD.searchFilters[0].id}/message`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            Authorization: `Bearer ${tokenPair.accessToken.token}` 
          },
          body: JSON.stringify({ 
            message: `Delete search plan: ${planToDelete.name}`,
          }),
        });

        console.log('Successfully deleted search plan in backend:', {
          searchFilterId: parsedJD.searchFilters[0].id,
          planId: id,
          planName: planToDelete.name,
        });
      } catch (error) {
        console.error('Failed to delete search plan in backend:', error);
        // Don't show error to user as the plan is still deleted locally
      }
    }
    
    enqueueSnackBar('Search plan deleted successfully', {
      variant: SnackBarVariant.Success,
    });
  }, [currentSearchPlan?.id, enqueueSnackBar, searchPlans, tokenPair?.accessToken?.token]);

  const applySearchPlan = useCallback(async (plan: SearchPlan) => {
    try {
      // Apply the search plan filters to the search parameters
      // This would integrate with the search system
      console.log('Applying search plan:', plan);
      
      enqueueSnackBar(`Search plan "${plan.name}" applied successfully`, {
        variant: SnackBarVariant.Success,
      });
    } catch (error) {
      enqueueSnackBar(`Failed to apply search plan: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        variant: SnackBarVariant.Error,
      });
    }
  }, [enqueueSnackBar]);

  const generateSearchPlanFromJD = useCallback(async (parsedJD: ParsedJD): Promise<SearchPlan> => {
    try {
      // Simulate AI analysis of the job description
      const mockPlan: SearchPlan = {
        id: Date.now().toString(),
        name: `${parsedJD.name} - Search Plan`,
        filters: {
          keywords: parsedJD.name ? [parsedJD.name] : [],
          jobTitle: parsedJD.name || '',
          location: parsedJD.jobLocation || '',
          industry: parsedJD.companyName || '',
          seniority: 'mid_level',
          searchType: 'classic' as LinkedInSearchType,
          searchCategory: 'people' as LinkedInSearchCategory,
        },
        enrichments: [
          'Cultural Fit Score',
          'Leadership Experience Score',
          'Industry Experience',
          'Location Match Score',
          'Skills Assessment',
        ],
        columnFilters: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // In a real implementation, this would call an AI service to analyze the JD
      // and generate appropriate search parameters and enrichments
      
      return mockPlan;
    } catch (error) {
      throw new Error(`Failed to generate search plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, []);

  const createEnrichmentsFromPlan = useCallback(async (plan: SearchPlan) => {
    try {
      // Create enrichments based on the search plan
      const newEnrichments = plan.enrichments.map((enrichment, index) => ({
        id: Date.now() + index,
        modelName: enrichment,
        prompt: `Analyze the candidate's profile and provide a ${enrichment.toLowerCase()} score from 1-10.`,
        filterDescription: `Filter candidates based on ${enrichment.toLowerCase()}`,
        fields: [
          {
            id: index * 10 + 1,
            name: enrichment.toLowerCase().replace(/\s+/g, '_'),
            type: 'Number',
            description: `${enrichment} score (1-10)`,
            required: true,
          }
        ],
        selectedModel: 'gpt-4',
        selectedMetadataFields: ['name', 'headline', 'experience'],
        bestOf: 1,
      }));

      setEnrichments(prev => [...prev, ...newEnrichments]);
      
      enqueueSnackBar(`Created ${newEnrichments.length} enrichments from search plan`, {
        variant: SnackBarVariant.Success,
      });
    } catch (error) {
      enqueueSnackBar(`Failed to create enrichments: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        variant: SnackBarVariant.Error,
      });
    }
  }, [setEnrichments, enqueueSnackBar]);

  return {
    searchPlans,
    currentSearchPlan,
    createSearchPlan,
    updateSearchPlan,
    deleteSearchPlan,
    setCurrentSearchPlan,
    applySearchPlan,
    generateSearchPlanFromJD,
    createEnrichmentsFromPlan,
  };
};
