import {
  activeEnrichmentState,
  enrichmentsState,
  type Enrichment,
} from '@/arx-ai-filtering/states/arxEnrichModalOpenState';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { styled } from '@linaria/react';
import { IconTrash } from 'twenty-ui/icon';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { SampleEnrichments } from './SampleEnrichments';

const StyledContainer = styled.div`
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  flex-direction: column;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  gap: 32px;
  padding: 44px 32px 44px 32px;
  width: calc(100% * (1 / 6));
  max-width: 300px;
  min-width: 224px;
  flex-shrink: 1;
  position: relative;
  pointer-events: auto;
`;

const ScrollableContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 32px;
  flex: 1;
  overflow-y: auto;
  min-height: 0;

  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: ${themeCssVariables.background.tertiary};
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb {
    background: ${themeCssVariables.background.quaternary};
    border-radius: 4px;

    &:hover {
      background: ${themeCssVariables.background.noisy};
    }
  }

  scrollbar-width: thin;
  scrollbar-color: ${themeCssVariables.background.quaternary}
    ${themeCssVariables.background.tertiary};
`;

const StyledModalNavElementContainer = styled.nav`
  display: flex;
  gap: 4px;
  padding: 6px 0 6px 0;
  flex-direction: column;
  overflow: visible;
`;

const StyledIntroductionNavElement = styled.div`
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
  padding: 6px;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: ${themeCssVariables.background.transparent.light};
  }
  &.active {
    background-color: ${themeCssVariables.background.transparent.light};
  }
  color: ${themeCssVariables.grayScale.gray5};
  border-radius: 4px;
  width: 200px;
  cursor: pointer;
`;

const StyledButton = styled.div`
  border: none;
  font-family: inherit;
  color: ${themeCssVariables.font.color.light};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.regular};
  cursor: pointer;
  background-color: none;
  margin-top: 16px;
`;

const StyledQuestionsContainer = styled.ol`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0;
  margin: 0px;
  list-style-type: none;
  scroll-behavior: smooth;
`;

const StyledListItem = styled.li`
  display: flex;
  justify-content: space-between;
  align-items: center;
  &::marker {
    display: none;
    font-family: inherit;
    color: ${themeCssVariables.font.color.light};
    font-size: ${themeCssVariables.font.size.md};
    font-weight: ${themeCssVariables.font.weight.regular};
  }
`;

export const ModalNavElementContainer = () => {
  const [enrichments, setEnrichments] = useAtomState(enrichmentsState);
  const [activeEnrichment, setActiveEnrichment] =
    useAtomState(activeEnrichmentState);

  const addEnrichment = () => {
    const newEnrichment: Enrichment = {
      modelName: '',
      fields: [],
      selectedMetadataFields: [],
      filterDescription: '',
      prompt: '',
      selectedModel: 'gpt4omini',
      bestOf: 1,
      includeResume: false,
    };
    setEnrichments((previousEnrichments) => [
      ...previousEnrichments,
      newEnrichment,
    ]);
    setActiveEnrichment(enrichments.length);
  };

  const deleteEnrichment = (index: number) => {
    setEnrichments((previousEnrichments) =>
      previousEnrichments.filter((_, enrichmentIndex) => enrichmentIndex !== index),
    );
    if (activeEnrichment === index) {
      setActiveEnrichment(0);
    } else if (activeEnrichment !== null && activeEnrichment > index) {
      setActiveEnrichment(activeEnrichment - 1);
    }
  };

  const handleEnrichmentClick = (index: number) => {
    setActiveEnrichment(index);
  };

  return (
    <StyledModalNavElementContainer>
      <StyledQuestionsContainer>
        {enrichments.map((enrichment, index) => (
          <StyledListItem key={index}>
            <StyledIntroductionNavElement
              className={activeEnrichment === index ? 'active' : ''}
              onClick={() => handleEnrichmentClick(index)}
            >
              {enrichment.modelName || `Enrichment - ${index + 1}`}
            </StyledIntroductionNavElement>
            <IconTrash
              size={16}
              stroke={1.5}
              style={{ cursor: 'pointer' }}
              onClick={() => deleteEnrichment(index)}
            />
          </StyledListItem>
        ))}
      </StyledQuestionsContainer>
      <StyledButton onClick={addEnrichment}>+ Add Enrichment</StyledButton>
    </StyledModalNavElementContainer>
  );
};

export const ArxEnrichLeftSideContainer = () => {
  return (
    <StyledContainer>
      <div>AI Filtering</div>
      <ScrollableContent>
        <ModalNavElementContainer />
        <SampleEnrichments />
      </ScrollableContent>
    </StyledContainer>
  );
};
