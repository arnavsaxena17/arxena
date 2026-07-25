import { ArxJDStepNavigation } from '@/arx-jd-upload/components/ArxJDStepNavigation';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledActionContainer = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 16px 24px;
  border-top: 1px solid #e5e7eb;
  background-color: #f9fafb;
`;

const StyledActionButtons = styled.div`
  display: flex;
  gap: 12px;
`;

type ActionButtonsProps = {
  showResults: boolean;
  isUploading: boolean;
  selectedCandidatesCount: number;
  isSearching: boolean;
  onBack: () => void;
  onNext: () => void;
  onSkipSearch: () => void;
  onSearch: () => void;
  setShowResults: (show: boolean) => void;
  closeModal: () => void;
};

export const ActionButtons = ({
  showResults,
  isUploading,
  selectedCandidatesCount,
  isSearching,
  onBack,
  onNext,
  onSkipSearch,
  onSearch,
  setShowResults,
  closeModal,
}: ActionButtonsProps) => {
  return (
    <StyledActionContainer>
      <StyledActionButtons>
        <ArxJDStepNavigation
          onBack={showResults ? () => setShowResults(false) : closeModal}
          onNext={onNext}
          onSkipSearch={onSkipSearch}
          showBackButton={true}
          showNextButton={showResults}
          showSearchButton={!showResults}
          showSkipSearchButton={true}
          nextLabel={
            isUploading 
              ? `Uploading ${selectedCandidatesCount} Candidates...` 
              : `Add ${selectedCandidatesCount} Candidates`
          }
          isNextDisabled={selectedCandidatesCount === 0 || isUploading}
          searchLabel={
            isSearching 
              ? 'Searching...' 
              : 'Search LinkedIn'
          }
          isSearchDisabled={isSearching}
          onSearch={onSearch}
        />
      </StyledActionButtons>
    </StyledActionContainer>
  );
};
