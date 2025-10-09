import { StyledGeneratingSection } from './SearchFormComponents.styled';

type LoadingStatusProps = {
  isGenerating: boolean;
  isResolving: boolean;
  searchType: string;
  searchCategory: string;
};

export const LoadingStatus = ({
  isGenerating,
  isResolving,
  searchType,
  searchCategory,
}: LoadingStatusProps) => {
  if (!isGenerating && !isResolving) {
    return null;
  }

  return (
    <StyledGeneratingSection>
      🔄 {isGenerating ? 'Generating' : 'Resolving'} search parameters for {searchType} {searchCategory}...
    </StyledGeneratingSection>
  );
};
