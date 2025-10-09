import { enrichmentsState } from '@/arx-enrich/states/arxEnrichModalOpenState';
import { ParsedJD } from '@/arx-jd-upload/types/ParsedJD';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { LinkedInSearchCategory, LinkedInSearchType } from '@/candidate-search/CandidateSearch';
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
  createSearchPlan: (plan: Omit<SearchPlan, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateSearchPlan: (id: string, updates: Partial<SearchPlan>) => void;
  deleteSearchPlan: (id: string) => void;
  setCurrentSearchPlan: (plan: SearchPlan | null) => void;
  applySearchPlan: (plan: SearchPlan) => Promise<void>;
  generateSearchPlanFromJD: (parsedJD: ParsedJD) => Promise<SearchPlan>;
  createEnrichmentsFromPlan: (plan: SearchPlan) => Promise<void>;
}

export const useSearchPlanManager = (): SearchPlanManager => {
  const [searchPlans, setSearchPlans] = useState<SearchPlan[]>([]);
  const [currentSearchPlan, setCurrentSearchPlan] = useState<SearchPlan | null>(null);
  const [enrichments, setEnrichments] = useRecoilState(enrichmentsState);
  const [tokenPair] = useRecoilState(tokenPairState);
  const [currentWorkspaceMember] = useRecoilState(currentWorkspaceMemberState);
  const { enqueueSnackBar } = useSnackBar();

  const createSearchPlan = useCallback((plan: Omit<SearchPlan, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newPlan: SearchPlan = {
      ...plan,
      id: Date.now().toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    setSearchPlans(prev => [...prev, newPlan]);
    setCurrentSearchPlan(newPlan);
    
    enqueueSnackBar(`Search plan "${newPlan.name}" created successfully`, {
      variant: SnackBarVariant.Success,
    });
  }, [enqueueSnackBar]);

  const updateSearchPlan = useCallback((id: string, updates: Partial<SearchPlan>) => {
    setSearchPlans(prev => 
      prev.map(plan => 
        plan.id === id 
          ? { ...plan, ...updates, updatedAt: new Date() }
          : plan
      )
    );
    
    if (currentSearchPlan?.id === id) {
      setCurrentSearchPlan(prev => prev ? { ...prev, ...updates, updatedAt: new Date() } : null);
    }
  }, [currentSearchPlan?.id]);

  const deleteSearchPlan = useCallback((id: string) => {
    setSearchPlans(prev => prev.filter(plan => plan.id !== id));
    
    if (currentSearchPlan?.id === id) {
      setCurrentSearchPlan(null);
    }
    
    enqueueSnackBar('Search plan deleted successfully', {
      variant: SnackBarVariant.Success,
    });
  }, [currentSearchPlan?.id, enqueueSnackBar]);

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
          searchType: 'classic',
          searchCategory: 'people',
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
