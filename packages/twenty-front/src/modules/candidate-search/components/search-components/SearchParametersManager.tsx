import { SearchParametersManagerProps } from '@/candidate-search/types/candidate-search.types';
import { useCallback } from 'react';
import { useParameterHandlers } from '../../hooks/useParameterHandlers';
import { useSearchParametersManager } from '../../hooks/useSearchParametersManager';
import {
  StyledContainer,
  StyledGeneratedLabel,
  StyledGeneratedSection,
  StyledResolvedLabel,
  StyledResolvedSection,
  StyledScrollableContent,
} from '../../styles/SearchParametersManager.styled';
import { ClassicCompaniesParameters, ClassicJobsParameters, ClassicPeopleParameters } from './filter-renderers/ClassicParameterRenderers';
import { RecruiterPeopleParameters } from './filter-renderers/RecruiterParameterRenderers';
import { SalesNavigatorCompaniesParameters, SalesNavigatorPeopleParameters } from './filter-renderers/SalesNavigatorParameterRenderers';

export const SearchParametersManager = ({
  searchType,
  searchCategory,
  onParametersChange,
  generatedParameters,
  resolvedParameters,
  initialParameters,
  onAssistantThreadUpdate,
  onSearch,
  onClear,
}: SearchParametersManagerProps) => {
  const {
    parameters,
    updateParameters,
    hasResolvedParameters,
    areCurrentParametersModified,
    hasGeneratedParams,
  } = useSearchParametersManager(
    searchType,
    searchCategory,
    generatedParameters,
    resolvedParameters,
    onParametersChange,
    onAssistantThreadUpdate,
    initialParameters
  );

  const {
    handleParameterChange,
  } = useParameterHandlers(parameters, updateParameters, searchType, searchCategory);

  // Wrap onSearch to pass current parameters (preserving user-modified keywords)
  const handleSearch = useCallback(() => {
    if (onSearch) {
      onSearch();
    }
  }, [onSearch, parameters]);

  const renderParameters = () => {
    const rendererProps = {
      parameters,
      updateParameters,
      handleParameterChange,
      onSearch: handleSearch,
      onClear,
    };

    if (searchType === 'classic') {
      switch (searchCategory) {
        case 'people':
          return <ClassicPeopleParameters {...rendererProps} />;
        case 'companies':
          return <ClassicCompaniesParameters {...rendererProps} />;
        case 'jobs':
          return <ClassicJobsParameters {...rendererProps} />;
        default:
          return null;
      }
    } else if (searchType === 'sales_navigator') {
      switch (searchCategory) {
        case 'people':
          return <SalesNavigatorPeopleParameters {...rendererProps} />;
        case 'companies':
          return <SalesNavigatorCompaniesParameters {...rendererProps} />;
        default:
          return null;
      }
    } else if (searchType === 'recruiter') {
      switch (searchCategory) {
        case 'people':
          return <RecruiterPeopleParameters {...rendererProps} />;
        default:
          return null;
      }
    }
    return null;
  };

  const isResolved = hasResolvedParameters;
  const hasModifiedParams = areCurrentParametersModified;

  return (
    <StyledContainer>
      {hasGeneratedParams && !hasModifiedParams && (
        <StyledGeneratedSection>
          <StyledGeneratedLabel>
            ✓ AI-Generated Parameters (You can modify these below)
          </StyledGeneratedLabel>
        </StyledGeneratedSection>
      )}
      
      {hasGeneratedParams && hasModifiedParams && (
        <StyledResolvedSection>
          <StyledResolvedLabel>
            ✏️ Parameters Modified (Custom search criteria)
          </StyledResolvedLabel>
        </StyledResolvedSection>
      )}
      
      {/* {isResolved && !hasModifiedParams && (
        <StyledResolvedSection>
          <StyledResolvedLabel>
            🔗 Parameters Resolved to LinkedIn IDs (Ready for search)
          </StyledResolvedLabel>
        </StyledResolvedSection>
      )}
       */}
      <StyledScrollableContent>
        {renderParameters()}
      </StyledScrollableContent>
    </StyledContainer>
  );
};