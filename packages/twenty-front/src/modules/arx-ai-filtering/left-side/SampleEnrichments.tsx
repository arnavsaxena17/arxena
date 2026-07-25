import {
  activeEnrichmentState,
  enrichmentsState,
  sampleEnrichmentsState,
  type Enrichment,
} from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
import { normalizeEnrichmentResumeFlag } from '@/arx-ai-filtering/utils/resumeMetadata';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { styled } from '@linaria/react';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

const StyledSampleContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 24px;
`;

const StyledError = styled.div`
  color: ${themeCssVariables.color.red};
  font-size: ${themeCssVariables.font.size.sm};
  margin-bottom: 8px;
`;

const StyledSampleCard = styled.div`
  padding: 12px;
  border-radius: 8px;
  background-color: ${themeCssVariables.background.secondary};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${themeCssVariables.background.tertiary};
  }
`;

const StyledSampleTitle = styled.div`
  font-weight: ${themeCssVariables.font.weight.medium};
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.primary};
`;

const StyledSampleDescription = styled.div`
  font-size: ${themeCssVariables.font.size.xs};
  color: ${themeCssVariables.font.color.tertiary};
  margin-top: 4px;
`;

const SAMPLE_ENRICHMENTS = [
  {
    modelName: 'DistanceFromJob',
    filterDescription:
      "Calculate the distance in kilometers between each candidate's location and Surat, Gujarat, India. This will help identify candidates based on their proximity to the job location.",
    prompt:
      'For the given location below, return the distance in kilometeres between the location and the Surat, Gujarat, India. Return only the distance in kilometers. No explanation is needed.',
    fields: [
      {
        name: 'distanceFromJob',
        type: 'number',
        description:
          'This is the distance of the location from Surat, Gujarat, India in kilometers',
        id: 1733655403505,
        required: true,
      },
    ],
    selectedMetadataFields: ['location_name'],
    selectedModel: 'gpt4omini',
    bestOf: 1,
  },
  {
    modelName: 'JobTitleClasssification',
    filterDescription:
      "Analyze job titles to classify them by function (sales, marketing, finance, legal) and level (entry, mid, senior, executive) to better understand the candidate's role and seniority.",
    prompt:
      'Classify the given job title into one of the following function categories - sales, marketing, finance, legal and levels - entry, mid, senior, executive.',
    fields: [
      {
        name: 'function',
        type: 'text',
        description:
          'This is the function within which the job title is classified',
        id: 1733654764250,
        required: true,
      },
      {
        name: 'level',
        type: 'text',
        description:
          'This is the level within which the job title is classified',
        id: 1733655310939,
        required: true,
      },
    ],
    selectedMetadataFields: ['jobTitle'],
    selectedModel: 'gpt4omini',
    bestOf: 1,
  },
];

export const SampleEnrichments = () => {
  const [enrichments, setEnrichments] = useAtomState(enrichmentsState);
  const [, setActiveEnrichment] = useAtomState(activeEnrichmentState);
  const [sampleEnrichments, setSampleEnrichments] =
    useAtomState(sampleEnrichmentsState);
  const [error, setError] = useState('');
  const [localSampleEnrichments, setLocalSampleEnrichments] =
    useState<Enrichment[]>(SAMPLE_ENRICHMENTS);
  const [tokenPair] = useAtomState(tokenPairState);

  useEffect(() => {
    if (sampleEnrichments.length === 0) {
      const fetchSampleEnrichments = async () => {
        try {
          const response = await axios.post(
            `${REACT_APP_SERVER_BASE_URL}/candidate-sourcing/find-many-ai-filters`,
            {},
            {
              headers: {
                Authorization: `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}`,
              },
            },
          );

          if (response.status === 200 || response.status === 201) {
            // API may return undefined when GraphQL edges are missing
            const serverEnrichments = Array.isArray(response.data?.data)
              ? response.data.data
              : [];
            const combinedEnrichments = [
              ...SAMPLE_ENRICHMENTS,
              ...serverEnrichments,
            ];
            combinedEnrichments.sort(
              (first, second) =>
                new Date(second.createdAt).getTime() -
                new Date(first.createdAt).getTime(),
            );
            const deduplicatedEnrichments = combinedEnrichments.reduce(
              (accumulator, current) => {
                const existingItem = accumulator.find(
                  (item: { modelName: string }) =>
                    item.modelName === current.modelName,
                );
                if (!existingItem) {
                  return accumulator.concat([current]);
                } else {
                  return accumulator;
                }
              },
              [],
            );

            setLocalSampleEnrichments(deduplicatedEnrichments);
            setSampleEnrichments(deduplicatedEnrichments);
          }
        } catch (fetchError) {
          console.error('Error fetching sample enrichments:', fetchError);
          setError('Failed to fetch sample enrichments');
          setSampleEnrichments(SAMPLE_ENRICHMENTS);
        }
      };

      fetchSampleEnrichments();
    } else {
      setLocalSampleEnrichments(sampleEnrichments);
    }
  }, [tokenPair, setSampleEnrichments, sampleEnrichments.length, sampleEnrichments]);

  const handleSampleClick = (sample: Enrichment) => {
    setEnrichments((previousEnrichments) => {
      const exists = previousEnrichments.some(
        (enrichment) => enrichment.modelName === sample.modelName,
      );
      if (!exists) {
        const newEnrichment = normalizeEnrichmentResumeFlag({
          ...sample,
          fields: sample.fields.map((field) => ({
            ...field,
            id: Date.now() + Math.random(),
          })),
        });
        return [...previousEnrichments.map((enrichment) => ({ ...enrichment })), newEnrichment];
      }
      return previousEnrichments;
    });
    setActiveEnrichment(enrichments.length);
  };

  return (
    <StyledSampleContainer>
      <StyledSampleTitle>Sample Enrichments</StyledSampleTitle>
      {error && <StyledError>{error}</StyledError>}
      {localSampleEnrichments.map((sample, index) => (
        <StyledSampleCard key={index} onClick={() => handleSampleClick(sample)}>
          <StyledSampleTitle>{sample.modelName}</StyledSampleTitle>
          <StyledSampleDescription>
            {sample.fields.length} field(s) •{' '}
            {sample.selectedMetadataFields.join(', ')}
          </StyledSampleDescription>
        </StyledSampleCard>
      ))}
    </StyledSampleContainer>
  );
};
