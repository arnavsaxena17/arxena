import { activeEnrichmentState, Enrichment, enrichmentsState, sampleEnrichmentsState } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
import { normalizeEnrichmentResumeFlag } from '@/arx-ai-filtering/utils/resumeMetadata';
import { tokenPairState } from '@/auth/states/tokenPairState';
import axios from 'axios';
import { useCallback, useState } from 'react';
import { useRecoilState } from 'recoil';

const SAMPLE_ENRICHMENTS = [
  {
    modelName: 'Extract Key Skills',
    fields: [
      { id: 1, name: 'primarySkills', type: 'text', description: 'Primary technical skills', required: true, enumValues: [] },
      { id: 2, name: 'secondarySkills', type: 'text', description: 'Secondary technical skills', required: false, enumValues: [] },
      { id: 3, name: 'yearsOfExperience', type: 'number', description: 'Years of experience in primary skill', required: true, enumValues: [] }
    ],
    selectedMetadataFields: ['resume', 'linkedinProfile'],
    filterDescription: 'Extract technical skills from candidate profiles',
    prompt: 'Analyze the candidate profile and extract their technical skills, experience level, and expertise areas.',
    selectedModel: 'gpt4omini',
    bestOf: 1
  },
  {
    modelName: 'Assess Cultural Fit',
    fields: [
      { id: 4, name: 'culturalFitScore', type: 'number', description: 'Cultural fit score (1-10)', required: true, enumValues: [] },
      { id: 5, name: 'communicationStyle', type: 'enum', description: 'Communication style', required: true, enumValues: ['Direct', 'Diplomatic', 'Collaborative', 'Assertive'] },
      { id: 6, name: 'teamOrientation', type: 'boolean', description: 'Prefers team work over individual work', required: true, enumValues: [] }
    ],
    selectedMetadataFields: ['resume', 'linkedinProfile', 'coverLetter'],
    filterDescription: 'Assess cultural fit and soft skills',
    prompt: 'Evaluate the candidate\'s cultural fit, communication style, and team orientation based on their profile.',
    selectedModel: 'gpt4omini',
    bestOf: 1
  },
  {
    modelName: 'Salary Expectations',
    fields: [
      { id: 7, name: 'expectedSalary', type: 'number', description: 'Expected salary range', required: true, enumValues: [] },
      { id: 8, name: 'salaryNegotiable', type: 'boolean', description: 'Is salary negotiable', required: true, enumValues: [] },
      { id: 9, name: 'benefitsPriority', type: 'enum', description: 'Most important benefit', required: false, enumValues: ['Health Insurance', 'Remote Work', 'Stock Options', 'Professional Development'] }
    ],
    selectedMetadataFields: ['resume', 'linkedinProfile'],
    filterDescription: 'Extract salary expectations and benefits preferences',
    prompt: 'Analyze the candidate profile to determine their salary expectations and benefits preferences.',
    selectedModel: 'gpt4omini',
    bestOf: 1
  }
];

export const useInitializeEnrichments = () => {
  const [enrichments, setEnrichments] = useRecoilState(enrichmentsState);
  const [sampleEnrichments, setSampleEnrichments] = useRecoilState(sampleEnrichmentsState);
  const [activeEnrichment, setActiveEnrichment] = useRecoilState(activeEnrichmentState);
  const [tokenPair] = useRecoilState(tokenPairState);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initializeEnrichments = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Initialize custom enrichments if empty
      if (enrichments.length === 0) {
        const initialEnrichment: Enrichment = {
          modelName: '',
          fields: [],
          selectedMetadataFields: [],
          filterDescription: '',
          prompt: '',
          selectedModel: 'gpt4omini',
          bestOf: 1,
          includeResume: false,
        };
        setEnrichments([initialEnrichment]);
        setActiveEnrichment(0);
      }

      // Load sample enrichments if empty
      if (sampleEnrichments.length === 0) {
        try {
          const response = await axios.post(
            `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-sourcing/find-many-ai-filters`,
            {},
            {
              headers: { 
                Authorization: `Bearer ${tokenPair?.accessToken?.token}` 
              }
            }
          );
          
          if (response.status === 200 || response.status === 201) {
            // Combine server enrichments with local samples
            const combinedEnrichments = [...SAMPLE_ENRICHMENTS, ...response.data.data].map(
              (item) => normalizeEnrichmentResumeFlag(item),
            );
            // Sort by createdAt
            combinedEnrichments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            // Deduplicate by modelName
            const deduplicatedEnrichments = combinedEnrichments.reduce((acc, current) => {
              const x = acc.find((item: { modelName: any; }) => item.modelName === current.modelName);
              if (!x) {
                return acc.concat([current]);
              } else {
                return acc;
              }
            }, []);
            
            setSampleEnrichments(deduplicatedEnrichments);
          } else {
            // Fallback to local samples if API fails
            setSampleEnrichments(SAMPLE_ENRICHMENTS);
          }
        } catch (error) {
          console.error('Failed to fetch sample enrichments:', error);
          // Fallback to local samples
          setSampleEnrichments(SAMPLE_ENRICHMENTS);
        }
      }
    } catch (error) {
      console.error('Error initializing enrichments:', error);
      setError('Failed to initialize enrichments');
    } finally {
      setIsLoading(false);
    }
  }, [enrichments.length, sampleEnrichments.length, setEnrichments, setSampleEnrichments, setActiveEnrichment, tokenPair?.accessToken?.token]);

  return {
    initializeEnrichments,
    isLoading,
    error
  };
};
