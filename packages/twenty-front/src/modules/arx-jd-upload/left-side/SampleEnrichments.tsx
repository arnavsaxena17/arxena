import styled from '@emotion/styled';
import { useRecoilState } from 'recoil';
import { enrichmentsState, activeEnrichmentState } from '@/arx-enrich/states/arxEnrichModalOpenState';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { tokenPairState } from '@/auth/states/tokenPairState';

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
    prompt: "For the given location below, return the distance in kilometeres between the location and the Surat, Gujarat, India. Return only the distance in kilometers. No explanation is needed.",
    fields: [
      {
        name: "distanceFromJob",
        type: "number",
        description: "This is the distance of the location from Surat, Gujarat, India in kilometers",
        id: 1733655403505
      }
    ],
    selectedMetadataFields: ["currentLocation"],
    selectedModel: "gpt4omini"
  },
  {
    modelName: "JobTitleClasssification",
    prompt: "Classify the given job title into one of the following function categories - sales, marketing, finance, legal and levels - entry, mid, senior, executive.",
    fields: [
      {
        name: "function",
        type: "text",
        description: "This is the function within which the job title is classified",
        id: 1733654764250
      },
      {
        name: "level",
        type: "text",
        description: "This is the level within which the job title is classified",
        id: 1733655310939
      }
    ],
    selectedMetadataFields: ["resumeHeadline", "jobTitle"],
    selectedModel: "gpt4omini"
  }
];

export const SampleEnrichments = () => {
  const [enrichments, setEnrichments] = useRecoilState(enrichmentsState);
  const [, setActiveEnrichment] = useRecoilState(activeEnrichmentState);
  const [error, setError] = useState('');
  const [sampleEnrichments, setSampleEnrichments] = useState(SAMPLE_ENRICHMENTS);
  const [tokenPair] = useRecoilState(tokenPairState);


  useEffect(() => {
    const fetchSampleEnrichments = async () => {
      try {
        const response = await axios.post(
          `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-sourcing/find-many-enrichments`,
          {},
          {
            headers: { 
              Authorization: `Bearer ${tokenPair?.accessToken?.token}` 
            }
          }
        );
        console.log("thisis response data:", response.data.data);
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
          setSampleEnrichments(deduplicatedEnrichments);
        }
      } catch (error) {
        console.error('Error fetching sample enrichments:', error);
        setError('Failed to fetch sample enrichments');
      }
    };

    fetchSampleEnrichments();
  }, []); // Run once on component mount

  const handleSampleClick = (sample: { modelName: string; prompt: string; fields: { name: string; type: string; description: string;  id: number; }[]; selectedMetadataFields: string[]; selectedModel: string; }) => {
    setEnrichments(prev => {
      // Check if an enrichment with the same modelName already exists
      const exists = prev.some(enrichment => enrichment.modelName === sample.modelName);
      // Only add if it doesn't exist
      return exists ? prev : [...prev, { ...sample }];
    });
    setActiveEnrichment(enrichments.length);
    };

  return (
    <StyledSampleContainer>
      <StyledSampleTitle>Sample Enrichments</StyledSampleTitle>
      {error && (
        <StyledError>{error}</StyledError>
      )}
      {sampleEnrichments.map((sample, index) => (
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
