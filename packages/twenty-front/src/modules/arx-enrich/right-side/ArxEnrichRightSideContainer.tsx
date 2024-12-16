import styled from '@emotion/styled';
import { useRecoilState, useRecoilValue } from 'recoil';
import { activeEnrichmentState, enrichmentsState } from '@/arx-enrich/states/arxEnrichModalOpenState';
import axios from 'axios';

import DynamicModelCreator from './FormCreatorRightSide';
import { ArxEnrichName } from './ArxEnrichName'; // Ensure this import is correct
import { useGetCurrentView } from '@/views/hooks/useGetCurrentView';
import { useViewStates } from '@/views/hooks/internal/useViewStates';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { ViewScope } from '@/views/scopes/ViewScope'; // Add this import
import { currentViewWithFiltersState } from '@/views/states/currentViewState';
import { useRecordTableStates } from '@/object-record/record-table/hooks/internal/useRecordTableStates';
import { selectedRecordsForModalState } from '@/object-record/states/selectedRecordsState';


const StyledAllContainer = styled.div`
  background-color: ${({ theme }) => theme.background.primary};
  display: flex;
  flex-direction: column;
  gap: 44px;
  padding: 44px 32px 44px 32px;
  width: calc(100% * (5 / 6));
  min-width: 264px;
  flex-shrink: 1;
`;

const StyledFormElement = styled.form`
  display: flex;
  gap: 44px;
  flex-grow: 1;
  flex-direction: column;
  overflow-y: scroll;
  scroll-behavior: smooth;
`;

const StyledQuestionsContainer = styled.ol`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  padding: 0;
  font-family: ${({ theme }) => theme.font.family};
  margin: 0px;
  list-style-type: none;
  overflow-y: scroll;
  scroll-behavior: smooth;
`;

interface ArxEnrichRightSideContainerProps {
  closeModal: () => void;
  objectNameSingular: string;
  objectRecordId: string;
}

export const ArxEnrichRightSideContainer: React.FC<ArxEnrichRightSideContainerProps> = ({ 
  closeModal, 
  objectNameSingular, 
  objectRecordId,
}) => {
  const [activeEnrichment, setActiveEnrichment] = useRecoilState(activeEnrichmentState);
  const [enrichments, setEnrichments] = useRecoilState(enrichmentsState);
  const [tokenPair] = useRecoilState(tokenPairState);

  const currentViewId = location.href.split("view=")[1];
  const {
    canPersistViewSelector,
    isViewBarExpandedState,
    availableFilterDefinitionsState,
    availableSortDefinitionsState,
  } = useViewStates(currentViewId);

  
  const availableSortDefinitions = useRecoilValue(
    availableSortDefinitionsState,
  );
  
  const availableFilterDefinitions = useRecoilValue(
    availableFilterDefinitionsState,
  );

  // console.log("Current Filters and Sorts:", availableSortDefinitions);
  // console.log("Current Filters and availableFilterDefinitionsState:", availableFilterDefinitionsState);
  // console.log("Current Filters and availableFilterDefinitions:", availableFilterDefinitions);  
  // const { currentViewWithCombinedFiltersAndSorts } = useGetCurrentView('6ccdeef7-be59-404f-a70a-593c7ee04def');

  const currentViewWithCombinedFiltersAndSorts = useRecoilValue(currentViewWithFiltersState);
  const selectedRecordIds = useRecoilValue(selectedRecordsForModalState);
  // const { selectedRowIdsSelector } = useRecordTableStates(recordTableId);
  
  // Get the selected row IDs
  // const selectedRowIds = useRecoilValue(selectedRowIdsSelector());
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    // const { currentViewWithCombinedFiltersAndSorts } = useGetCurrentView();
    event.preventDefault();
    try {
      console.log("Current Filters and Sorts:", currentViewWithCombinedFiltersAndSorts);
      // Send all enrichments to the backend
      console.log("Enrichments:", enrichments);
      console.log("objectNameSingular:", objectNameSingular);
      console.log("availableSortDefinitions:", availableSortDefinitions);
      console.log("availableFilterDefinitions:", availableFilterDefinitions);
      console.log("availableFilterDefinitionsState:", availableFilterDefinitionsState);
      console.log("viewId:",currentViewId);
      console.log("last ly before axios selectedRecordIds:", selectedRecordIds);
      

      const response = await axios.post(process.env.REACT_APP_SERVER_BASE_URL+'/candidate-sourcing/create-enrichments', {
        enrichments,
        objectNameSingular,
        availableSortDefinitions,
        availableFilterDefinitions,
        objectRecordId,
        selectedRecordIds
      }, {
        headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` }
      });

      if (response.status === 200 || response.status === 201) {
        console.log('Enrichments created successfully:', response.data);
        closeModal();
      } else {
        console.error('Failed to create enrichments:', response.status);
      }
    } catch (error) {
      console.error('Error creating enrichments:', error);
    }
  };

  return (

    <StyledAllContainer id={`${objectNameSingular}: ${objectRecordId}`}>
      <StyledFormElement onSubmit={handleSubmit} id="NewArxEnrichForm">
      <ArxEnrichName 
          closeModal={closeModal}
          onSubmit={handleSubmit}
          index={activeEnrichment || 0}
        />
        <StyledQuestionsContainer type="1">
          {activeEnrichment !== null && activeEnrichment < enrichments.length && (
            <DynamicModelCreator 
              objectNameSingular={objectNameSingular} 
              index={activeEnrichment}
            />
          )}
        </StyledQuestionsContainer>
      </StyledFormElement>
    </StyledAllContainer>

  );
};