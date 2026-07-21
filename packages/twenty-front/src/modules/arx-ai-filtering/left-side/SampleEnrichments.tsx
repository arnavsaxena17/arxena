import { activeEnrichmentState, enrichmentsState, sampleEnrichmentsState } from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
import { normalizeEnrichmentResumeFlag } from '@/arx-ai-filtering/utils/resumeMetadata';
import { tokenPairState } from '@/auth/states/tokenPairState';
import styled from '@emotion/styled';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';

const StyledSampleContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 24px;
`;

// Add this styled component for error messages
const StyledError = styled.div`
  color: ${({ theme }) => theme.color.red};
  font-size: ${({ theme }) => theme.font.size.sm};
  margin-bottom: 8px;
`;

const StyledSampleCard = styled.div`
  padding: 12px;
  border-radius: 8px;
  background-color: ${({ theme }) => theme.background.secondary};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${({ theme }) => theme.background.tertiary};
  }
`;

const StyledSampleTitle = styled.div`
  font-weight: ${({ theme }) => theme.font.weight.medium};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledSampleDescription = styled.div`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
  margin-top: 4px;
`;

const SAMPLE_ENRICHMENTS = [
  {
    modelName: "DistanceFromJob",
    filterDescription: "Calculate the distance in kilometers between each candidate's location and Surat, Gujarat, India. This will help identify candidates based on their proximity to the job location.",
    prompt: "For the given location below, return the distance in kilometeres between the location and the Surat, Gujarat, India. Return only the distance in kilometers. No explanation is needed.",
    fields: [
      {
        name: "distanceFromJob",
        type: "number",
        description: "This is the distance of the location from Surat, Gujarat, India in kilometers",
        id: 1733655403505,
        required: true
      }
    ],
    selectedMetadataFields: ["location_name"],
    selectedModel: "gpt4omini",
    bestOf: 1
  },
  {
    modelName: "JobTitleClasssification",
    filterDescription: "Analyze job titles to classify them by function (sales, marketing, finance, legal) and level (entry, mid, senior, executive) to better understand the candidate's role and seniority.",
    prompt: "Classify the given job title into one of the following function categories - sales, marketing, finance, legal and levels - entry, mid, senior, executive.",
    fields: [
      {
        name: "function",
        type: "text",
        description: "This is the function within which the job title is classified",
        id: 1733654764250,
        required: true
      },
      {
        name: "level",
        type: "text",
        description: "This is the level within which the job title is classified",
        id: 1733655310939,
        required: true
      }
    ],
    selectedMetadataFields: ["jobTitle"],
    selectedModel: "gpt4omini",
    bestOf: 1
  }
];

export const SampleEnrichments = () => {
  const [enrichments, setEnrichments] = useRecoilState(enrichmentsState);
  const [, setActiveEnrichment] = useRecoilState(activeEnrichmentState);
  const [sampleEnrichments, setSampleEnrichments] = useRecoilState(sampleEnrichmentsState);
  const [error, setError] = useState('');
  const [localSampleEnrichments, setLocalSampleEnrichments] = useState(SAMPLE_ENRICHMENTS);
  const [tokenPair] = useRecoilState(tokenPairState);

  useEffect(() => {
    // Only fetch if sample enrichments are not already loaded
    if (sampleEnrichments.length === 0) {
      const fetchSampleEnrichments = async () => {
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
            const combinedEnrichments = [...SAMPLE_ENRICHMENTS, ...response.data.data];
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
            
            setLocalSampleEnrichments(deduplicatedEnrichments);
            // Update the Recoil state for sample enrichments
            setSampleEnrichments(deduplicatedEnrichments);
          }
        } catch (error) {
          console.error('Error fetching sample enrichments:', error);
          setError('Failed to fetch sample enrichments');
          // Set default sample enrichments in case of error
          setSampleEnrichments(SAMPLE_ENRICHMENTS);
        }
      };

      fetchSampleEnrichments();
    } else {
      // Use already loaded sample enrichments
      setLocalSampleEnrichments(sampleEnrichments);
    }
  }, [tokenPair, setSampleEnrichments, sampleEnrichments.length]);

  const handleSampleClick = (sample: { modelName: string; prompt: string; fields: { name: string; type: string; description: string;  id: number; required: boolean; }[]; selectedMetadataFields: string[]; selectedModel: string; filterDescription: string; bestOf: number; includeResume?: boolean; }) => {
    setEnrichments(prev => {
      // Check if an enrichment with the same modelName already exists
      const exists = prev.some(enrichment => enrichment.modelName === sample.modelName);
      // Only add if it doesn't exist
      if (!exists) {
        // Create a new enrichment with all sample values
        const newEnrichment = normalizeEnrichmentResumeFlag({
          ...sample,
          fields: sample.fields.map(field => ({
            ...field,
            id: Date.now() + Math.random() // Ensure unique IDs
          }))
        });
        return [...prev.map(e => ({...e})), newEnrichment];
      }
      return prev;
    });
    setActiveEnrichment(enrichments.length);
  };

  return (
    <StyledSampleContainer>
      <StyledSampleTitle>Sample Enrichments</StyledSampleTitle>
      {error && (
        <StyledError>{error}</StyledError>
      )}
      {localSampleEnrichments.map((sample, index) => (
        <StyledSampleCard key={index} onClick={() => handleSampleClick(sample)}>
          <StyledSampleTitle>{sample.modelName}</StyledSampleTitle>
          <StyledSampleDescription>
            {sample.fields.length} field(s) • {sample.selectedMetadataFields.join(', ')}
          </StyledSampleDescription>
        </StyledSampleCard>
      ))}
    </StyledSampleContainer>
  );
};
