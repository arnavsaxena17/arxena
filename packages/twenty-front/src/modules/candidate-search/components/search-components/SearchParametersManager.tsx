import { SearchParametersManagerProps } from '@/candidate-search/types/CandidateSearch';
import { useParameterHandlers } from '../../hooks/useParameterHandlers';
import { useSearchParametersManager } from '../../hooks/useSearchParametersManager';
import { ClassicCompaniesParameters, ClassicJobsParameters, ClassicPeopleParameters } from './ClassicParameterRenderers';
import { RecruiterPeopleParameters } from './RecruiterParameterRenderers';
import { SalesNavigatorCompaniesParameters, SalesNavigatorPeopleParameters } from './SalesNavigatorParameterRenderers';
import {
  StyledContainer,
  StyledGeneratedLabel,
  StyledGeneratedSection,
  StyledResolvedLabel,
  StyledResolvedSection,
  StyledScrollableContent,
} from './SearchParametersManager.styled';

export const SearchParametersManager = ({
  searchType,
  searchCategory,
  onParametersChange,
  generatedParameters,
  resolvedParameters,
  onSearchFilterUpdate,
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
    onSearchFilterUpdate
  );

  const {
    handleParameterChange,
  } = useParameterHandlers(parameters, updateParameters);

  const renderParameters = () => {
    const rendererProps = {
      parameters,
      updateParameters,
      handleParameterChange,
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
      
      {isResolved && !hasModifiedParams && (
        <StyledResolvedSection>
          <StyledResolvedLabel>
            🔗 Parameters Resolved to LinkedIn IDs (Ready for search)
          </StyledResolvedLabel>
        </StyledResolvedSection>
      )}
      
      <StyledScrollableContent>
        {renderParameters()}
      </StyledScrollableContent>
    </StyledContainer>
  );
};