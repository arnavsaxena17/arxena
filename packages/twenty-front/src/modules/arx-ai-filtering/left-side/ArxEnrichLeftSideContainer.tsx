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
  flex-shrink: 1;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  gap: 32px;
  max-width: 300px;
  min-width: 224px;
  padding: 44px 32px 44px 32px;
  pointer-events: auto;
  position: relative;
  width: calc(100% * (1 / 6));
`;

const ScrollableContent = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 32px;
  min-height: 0;
  overflow-y: auto;

  ::-webkit-scrollbar {
    height: 8px;
    width: 8px;
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

  scrollbar-color: ${themeCssVariables.background.quaternary}
    ${themeCssVariables.background.tertiary};
  scrollbar-width: thin;
`;

const StyledModalNavElementContainer = styled.nav`
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: visible;
  padding: 6px 0 6px 0;
`;

const StyledIntroductionNavElement = styled.div`
  border-radius: 4px;
  color: ${themeCssVariables.grayScale.gray5};
  cursor: pointer;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.md};

  &:hover {
    background-color: ${themeCssVariables.background.transparent.light};
  }
  &.active {
    background-color: ${themeCssVariables.background.transparent.light};
  }
  font-weight: ${themeCssVariables.font.weight.medium};
  padding: 6px;
  transition: background-color 0.2s ease;
  width: 200px;
`;

const StyledButton = styled.div`
  background-color: none;
  border: none;
  color: ${themeCssVariables.font.color.light};
  cursor: pointer;
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.regular};
  margin-top: 16px;
`;

const StyledQuestionsContainer = styled.ol`
  display: flex;
  flex-direction: column;
  gap: 8px;
  list-style-type: none;
  margin: 0px;
  padding: 0;
  scroll-behavior: smooth;
`;

const StyledListItem = styled.li`
  align-items: center;
  display: flex;
  justify-content: space-between;
  &::marker {
    color: ${themeCssVariables.font.color.light};
    display: none;
    font-family: inherit;
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
