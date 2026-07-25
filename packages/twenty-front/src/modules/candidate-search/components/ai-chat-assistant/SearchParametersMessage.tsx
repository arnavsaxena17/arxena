import { Button } from 'twenty-ui';
import { IconRefresh, IconSettings } from 'twenty-ui/icon';
import { SearchParametersResponse, SearchVariation } from '@/candidate-search/types/candidate-search.types';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import React, { useEffect, useState } from 'react';

const StyledMessageContainer = styled.div`
  padding: ${themeCssVariables.spacing[3]};
  background-color: ${themeCssVariables.background.secondary};
  border-radius: ${themeCssVariables.border.radius.md};
  margin: ${themeCssVariables.spacing[2]} 0;
`;

const StyledHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[2]};
  margin-bottom: ${themeCssVariables.spacing[3]};
`;

const StyledTitle = styled.h3`
  margin: 0;
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.lg};
`;

const StyledContent = styled.div`
  margin-bottom: ${themeCssVariables.spacing[3]};
  line-height: 1.6;
`;

const StyledVariationsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  margin: ${themeCssVariables.spacing[2]} 0;
`;

const StyledVariationCard = styled.div<{ isSelected?: boolean }>`
  padding: ${themeCssVariables.spacing[2]};
  border: 1px solid ${({ isSelected }) => 
    isSelected ? themeCssVariables.color.blue8 : themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  background-color: ${({ isSelected }) => 
    isSelected ? themeCssVariables.color.blue10 : themeCssVariables.background.primary};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: ${themeCssVariables.color.blue6};
    background-color: ${themeCssVariables.color.blue10};
  }
`;

const StyledVariationHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${themeCssVariables.spacing[1]};
`;

const StyledVariationName = styled.h4`
  margin: 0;
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
`;

const StyledVariationType = styled.span<{ type: 'broad' | 'narrow' | 'targeted' }>`
  padding: ${themeCssVariables.spacing['0.5']} ${themeCssVariables.spacing[1]};
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
  background-color: ${({ type }) => {
    switch (type) {
      case 'broad': return themeCssVariables.color.green10;
      case 'narrow': return themeCssVariables.color.orange10;
      case 'targeted': return themeCssVariables.color.blue10;
      default: return themeCssVariables.background.secondary;
    }
  }};
  color: ${({ type }) => {
    switch (type) {
      case 'broad': return themeCssVariables.color.green8;
      case 'narrow': return themeCssVariables.color.orange8;
      case 'targeted': return themeCssVariables.color.blue8;
      default: return themeCssVariables.font.color.primary;
    }
  }};
`;

const StyledVariationDescription = styled.p`
  margin: ${themeCssVariables.spacing[1]} 0;
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledVariationReasoning = styled.p`
  margin: ${themeCssVariables.spacing[1]} 0;
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
  font-style: italic;
`;

const StyledActionButtons = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  margin-top: ${themeCssVariables.spacing[3]};
`;

const StyledComplexityBadge = styled.div<{ complexity: 'simple' | 'moderate' | 'complex' }>`
  display: inline-flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  background-color: ${({ complexity }) => {
    switch (complexity) {
      case 'simple': return themeCssVariables.color.green10;
      case 'moderate': return themeCssVariables.color.orange10;
      case 'complex': return themeCssVariables.color.red10;
      default: return themeCssVariables.background.secondary;
    }
  }};
  color: ${({ complexity }) => {
    switch (complexity) {
      case 'simple': return themeCssVariables.color.green8;
      case 'moderate': return themeCssVariables.color.orange8;
      case 'complex': return themeCssVariables.color.red8;
      default: return themeCssVariables.font.color.primary;
    }
  }};
`;

const StyledParametersSection = styled.div`
  margin: ${themeCssVariables.spacing[2]} 0;
`;

const StyledParametersTitle = styled.h5`
  margin: 0 0 ${themeCssVariables.spacing[1]} 0;
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
`;

const StyledParametersList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledParameterItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[1]};
  background-color: ${themeCssVariables.background.tertiary};
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledParameterLabel = styled.span`
  font-weight: ${themeCssVariables.font.weight.medium};
  color: ${themeCssVariables.font.color.primary};
  min-width: 120px;
`;

const StyledParameterValue = styled.span`
  color: ${themeCssVariables.font.color.secondary};
`;

const StyledStrategiesContainer = styled.div`
  margin: ${themeCssVariables.spacing[3]} 0;
`;

const StyledStrategySummaryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing['1.5']};
  margin-bottom: ${themeCssVariables.spacing[2]};
`;

const StyledStrategySummaryItem = styled.div<{ isSelected?: boolean }>`
  padding: ${themeCssVariables.spacing[2]};
  border: 1px solid ${({ isSelected }) => 
    isSelected ? themeCssVariables.color.blue6 : themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  background-color: ${({ isSelected }) => 
    isSelected ? themeCssVariables.color.blue10 : themeCssVariables.background.primary};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: ${themeCssVariables.color.blue6};
    background-color: ${themeCssVariables.color.blue10};
  }
`;

const StyledStrategiesTabs = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  margin-bottom: ${themeCssVariables.spacing[2]};
  flex-wrap: wrap;
`;

const StyledStrategyTab = styled.button<{ isActive?: boolean }>`
  padding: ${themeCssVariables.spacing['1.5']} ${themeCssVariables.spacing[2]};
  border: 1px solid ${({ isActive }) => 
    isActive ? themeCssVariables.color.blue6 : themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  background-color: ${({ isActive }) => 
    isActive ? themeCssVariables.color.blue10 : themeCssVariables.background.primary};
  color: ${({ isActive }) => 
    isActive ? themeCssVariables.color.blue8 : themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${({ isActive }) => 
    isActive ? themeCssVariables.font.weight.medium : themeCssVariables.font.weight.regular};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: ${themeCssVariables.color.blue6};
    background-color: ${themeCssVariables.color.blue10};
  }
`;

const StyledStrategyInfo = styled.div`
  margin: ${themeCssVariables.spacing[2]} 0;
  padding: ${themeCssVariables.spacing[2]};
  background-color: ${themeCssVariables.background.tertiary};
  border-radius: ${themeCssVariables.border.radius.sm};
`;

const StyledStrategyInfoRow = styled.div`
  margin: ${themeCssVariables.spacing[1]} 0;
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledStrategyInfoLabel = styled.span`
  font-weight: ${themeCssVariables.font.weight.medium};
  color: ${themeCssVariables.font.color.primary};
  margin-right: ${themeCssVariables.spacing[1]};
`;

const StyledStrategyInfoValue = styled.span`
  color: ${themeCssVariables.font.color.secondary};
`;

const StyledRationalesSection = styled.div`
  margin-top: ${themeCssVariables.spacing[2]};
  padding-top: ${themeCssVariables.spacing[2]};
  border-top: 1px solid ${themeCssVariables.border.color.light};
`;

const StyledRationaleItem = styled.div`
  margin: ${themeCssVariables.spacing[1]} 0;
  font-size: ${themeCssVariables.font.size.xs};
  color: ${themeCssVariables.font.color.tertiary};
  font-style: italic;
`;

const StyledRationaleLabel = styled.span`
  font-weight: ${themeCssVariables.font.weight.medium};
  color: ${themeCssVariables.font.color.secondary};
  margin-right: ${themeCssVariables.spacing[1]};
`;

const StyledStrategyResults = styled.div`
  margin-top: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]};
  background-color: ${themeCssVariables.background.secondary};
  border-radius: ${themeCssVariables.border.radius.sm};
  border: 1px solid ${themeCssVariables.border.color.light};
`;

const StyledResultsHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${themeCssVariables.spacing[1]};
`;

const StyledResultsCount = styled.span`
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  color: ${themeCssVariables.color.blue};
`;

const StyledErrorContainer = styled.div`
  margin-top: ${themeCssVariables.spacing[2]};
  padding: ${themeCssVariables.spacing[2]};
  background-color: ${themeCssVariables.color.red10};
  border: 1px solid ${themeCssVariables.color.red3};
  border-radius: ${themeCssVariables.border.radius.sm};
`;

const StyledErrorHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
  margin-bottom: ${themeCssVariables.spacing[1]};
  color: ${themeCssVariables.color.red};
  font-weight: ${themeCssVariables.font.weight.medium};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledErrorMessage = styled.div`
  color: ${themeCssVariables.color.red8};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.5;
`;

const StyledErrorDetails = styled.div`
  margin-top: ${themeCssVariables.spacing[1]};
  padding-top: ${themeCssVariables.spacing[1]};
  border-top: 1px solid ${themeCssVariables.color.red3};
  color: ${themeCssVariables.color.red7};
  font-size: ${themeCssVariables.font.size.xs};
  font-style: italic;
`;

const StyledViewResultsButton = styled.button`
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  background-color: ${themeCssVariables.color.blue};
  color: ${themeCssVariables.font.color.inverted};
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.xs};
  font-weight: ${themeCssVariables.font.weight.medium};
  transition: background-color 0.2s ease;
  
  &:hover {
    background-color: ${themeCssVariables.color.blue5};
  }
  
  &:disabled {
    background-color: ${themeCssVariables.color.gray2};
    cursor: not-allowed;
  }
`;

const StyledResultsMetadata = styled.div`
  font-size: ${themeCssVariables.font.size.xs};
  color: ${themeCssVariables.font.color.secondary};
  margin-top: ${themeCssVariables.spacing['0.5']};
`;

const StyledLinkedInLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing['1.5']} ${themeCssVariables.spacing[2]};
  background-color: ${themeCssVariables.color.blue10};
  color: ${themeCssVariables.color.blue};
  border: 1px solid ${themeCssVariables.color.blue3};
  border-radius: ${themeCssVariables.border.radius.sm};
  text-decoration: none;
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  transition: all 0.2s ease;
  margin-top: ${themeCssVariables.spacing[2]};
  
  &:hover {
    background-color: ${themeCssVariables.color.blue2};
    border-color: ${themeCssVariables.color.blue5};
    color: ${themeCssVariables.color.blue8};
  }
  
  &:visited {
    color: ${themeCssVariables.color.blue};
  }
`;

const StyledNestedParameterContainer = styled.div`
  margin-bottom: ${themeCssVariables.spacing[2]};
`;

const StyledNestedParameterTitle = styled(StyledParametersTitle)`
  margin-bottom: ${themeCssVariables.spacing[1]};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.semiBold};
`;

const StyledNestedParametersList = styled(StyledParametersList)`
  margin-left: ${themeCssVariables.spacing[2]};
  border-left: 2px solid ${themeCssVariables.border.color.light};
  padding-left: ${themeCssVariables.spacing['1.5']};
`;

// Helper function to check if an object is a nested parameter object
const isNestedParameterObject = (value: any): boolean => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  
  // Check if it contains common search parameter keys
  const searchParameterKeys = [
    'keywords', 'location', 'company', 'industry', 'school',
    'title', 'jobTitle', 'currentTitle', 'pastTitle',
    'network_distance', 'yearsOfExperience', 'education',
    'skills', 'languages', 'certifications'
  ];
  
  return searchParameterKeys.some(key => key in value);
};

// Helper function to format parameter values for display
const formatParameterValue = (key: string, value: any, displayParams?: any): string => {
  // Handle network_distance with user-friendly labels
  if (key === 'network_distance' && Array.isArray(value)) {
    const labels: { [key: number]: string } = {
      1: '1st connections',
      2: '2nd connections',
      3: '3rd connections'
    };
    return value.map(v => labels[v] || v).join(', ');
  }
  
  // Handle display fields for resolved parameters
  if (key === 'location' && displayParams?.location_display) {
    return displayParams.location_display.map((loc: any) => loc.title).join(', ');
  }
  
  if (key === 'company' && displayParams?.company_display) {
    return displayParams.company_display.map((comp: any) => comp.title).join(', ');
  }
  
  if (key === 'industry' && displayParams?.industry_display) {
    return displayParams.industry_display.map((ind: any) => ind.title).join(', ');
  }
  
  if (key === 'school' && displayParams?.school_display) {
    return displayParams.school_display.map((sch: any) => sch.title).join(', ');
  }
  
  // Handle arrays
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  
  // Handle objects - but skip nested parameter objects (they'll be rendered separately)
  if (typeof value === 'object' && !isNestedParameterObject(value)) {
    return JSON.stringify(value, null, 2);
  }
  
  // Default: convert to string
  return String(value);
};

type SearchParametersMessageProps = {
  searchParameters: SearchParametersResponse | any; // Allow legacy format
  selectedVariationId?: string;
  onVariationSelect?: (variationId: string) => void;
  onGenerateEnrichments?: () => void;
  onApplyParameters?: (parameters: any) => void;
  onViewStrategyResults?: (strategy: any, preview: any, parameterKey: string) => void;
};

export const SearchParametersMessage: React.FC<SearchParametersMessageProps> = ({
  searchParameters,
  selectedVariationId,
  onVariationSelect,
  onGenerateEnrichments,
  onApplyParameters,
  onViewStrategyResults,
}) => {
  // State to track selected strategy when multiple strategies are available
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);
  
  // Use a ref to track auto-loaded strategies to persist across remounts
  // We'll use localStorage key based on the strategy ID to persist this
  const getAutoLoadedKey = (strategyId: string) => `autoLoadedStrategy_${strategyId}`;
  const hasAutoLoadedStrategy = (strategyId: string): boolean => {
    return localStorage.getItem(getAutoLoadedKey(strategyId)) === 'true';
  };
  const markStrategyAsAutoLoaded = (strategyId: string) => {
    localStorage.setItem(getAutoLoadedKey(strategyId), 'true');
  };

  // Log searchParameters on component mount/update
  useEffect(() => {
    const strategyResults = searchParameters?.strategyResults;
    console.log('=== SearchParametersMessage - Component rendered/updated ===', {
      searchParametersKeys: Object.keys(searchParameters || {}),
      hasStrategyResults: !!strategyResults,
      strategyResultsLength: strategyResults?.length || 0,
      hasGeneratedParams: !!searchParameters?.generatedParams,
      hasGeneratedSearchParameters: !!searchParameters?.generatedSearchParameters,
      onViewStrategyResultsAvailable: !!onViewStrategyResults,
      strategyResultsDetails: strategyResults?.map((sr: any) => ({
        strategyId: sr.strategy?.id,
        strategyLabel: sr.strategy?.label,
        hasPreview: !!sr.preview,
        previewKeys: sr.preview ? Object.keys(sr.preview) : [],
        itemCount: sr.preview?.itemCount,
        hasTransformedCandidates: !!sr.preview?.transformedCandidates,
        transformedCandidatesLength: sr.preview?.transformedCandidates?.length || 0,
        hasSearchResults: !!sr.preview?.searchResults,
        searchResultsItemsLength: sr.preview?.searchResults?.items?.length || 0
      }))
    });
  }, [searchParameters, onViewStrategyResults]);

  // Helper function to render strategy tabs and content
  const renderStrategiesView = (
    strategies: any[],
    primaryParams: any,
    parameterKey: string,
    isGeneratedParamsFormat: boolean = false,
    strategyResults?: Array<{ strategy: any; preview: any }>
  ) => {
    console.log("renderStrategiesView - strategies:", strategies);
    // If we have strategies, use them; otherwise use primary params
    const hasStrategies = strategies && strategies.length > 0;
    const effectiveStrategies = hasStrategies ? strategies : [];
    
    // Determine which strategy/params to show
    // Use selectedStrategyId if set, otherwise default to first strategy
    const currentStrategyId = selectedStrategyId || 
      (hasStrategies && effectiveStrategies.length > 0 ? effectiveStrategies[0].id : null);
    // Find strategy from strategyResults to get linkedInUrl
    const selectedStrategyResult = strategyResults?.find(sr => sr.strategy.id === currentStrategyId);
    const selectedStrategy = selectedStrategyResult?.strategy || 
      (hasStrategies && currentStrategyId
        ? effectiveStrategies.find(s => s.id === currentStrategyId)
        : null);
    const displayParams = selectedStrategy?.parameters || primaryParams;

    const handleStrategySelect = (strategyId: string) => {
      setSelectedStrategyId(strategyId);
    };

    const handleApplyClick = () => {
      if (onApplyParameters && displayParams) {
        console.log('SearchParametersMessage - Applying parameters:', displayParams);
        const resolvedParams = {
          [parameterKey]: displayParams
        };
        onApplyParameters(resolvedParams);
      }
    };

    return (
      <StyledMessageContainer>
        <StyledHeader>
          <IconSettings size={20} />
          <StyledTitle>Search Parameters Generated</StyledTitle>
        </StyledHeader>

        <StyledContent>
          <p>Search parameters have been generated. {hasStrategies ? `${effectiveStrategies.length} search strateg${effectiveStrategies.length > 1 ? 'ies' : 'y'} ${effectiveStrategies.length > 1 ? 'are' : 'is'} available. ${effectiveStrategies.length > 1 ? 'Select a strategy below to view its parameters and results.' : 'View the strategy details below.'}` : 'Click "Apply to Search Form" to use these parameters in your search.'}</p>
        </StyledContent>

        {/* Display strategies - always show if they exist, even if only one */}
        {hasStrategies && effectiveStrategies.length > 0 && (
          <StyledStrategiesContainer>
            <StyledParametersTitle>
              {effectiveStrategies.length > 1 
                ? `Search Strategies (${effectiveStrategies.length})` 
                : 'Search Strategy'}
            </StyledParametersTitle>
            
            {/* Show strategy summary list for quick reference */}
            {effectiveStrategies.length > 1 && (
              <StyledStrategySummaryList>
                {effectiveStrategies.map((strategy) => {
                  const strategyResult = strategyResults?.find(sr => sr.strategy.id === strategy.id);
                  const preview = strategyResult?.preview;
                  // Get candidateCount from strategy first, then fallback to preview.itemCount
                  const candidateCount = strategyResult?.strategy?.candidateCount ?? preview?.itemCount ?? 0;
                  const hasError = preview?.error;
                  const isSelected = selectedStrategyId === strategy.id || 
                    (!selectedStrategyId && strategy.id === effectiveStrategies[0].id);
                  
                  return (
                    <StyledStrategySummaryItem 
                      key={strategy.id}
                      isSelected={isSelected}
                      onClick={() => handleStrategySelect(strategy.id)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                        <div>
                          <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                            {strategy.label || strategy.name || `Strategy ${strategy.id}`}
                          </div>
                          <div style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
                            {candidateCount > 0 
                              ? `${candidateCount} candidates`
                              : 'N/A candidates'}
                          </div>
                        </div>
                        {hasError ? (
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 600, color: '#d32f2f' }}>
                              Failed
                            </div>
                          </div>
                        ) : preview && (
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 600, color: '#0066cc' }}>
                              {candidateCount} found
                            </div>
                          </div>
                        )}
                      </div>
                    </StyledStrategySummaryItem>
                  );
                })}
              </StyledStrategySummaryList>
            )}
            
            {/* Show tabs only if multiple strategies */}
            {/* {effectiveStrategies.length > 1 && (
              <StyledStrategiesTabs>
                {effectiveStrategies.map((strategy) => {
                  const isActive = selectedStrategyId === strategy.id || 
                    (!selectedStrategyId && strategy.id === effectiveStrategies[0].id);
                  return (
                    <StyledStrategyTab
                      key={strategy.id}
                      isActive={isActive}
                      onClick={() => handleStrategySelect(strategy.id)}
                    >
                      {strategy.label || strategy.name || `Strategy ${strategy.id}`}
                    </StyledStrategyTab>
                  );
                })}
              </StyledStrategiesTabs>
            )} */}

            {/* Display selected strategy info - show for single or multiple strategies */}
            {selectedStrategy && (
              <StyledStrategyInfo>
                {/* Show strategy label/name prominently when there's only one strategy */}
                {effectiveStrategies.length === 1 && (
                  <StyledStrategyInfoRow style={{ marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
                    <StyledStrategyInfoLabel style={{ fontSize: '16px', fontWeight: 600 }}>
                      {selectedStrategy.label || selectedStrategy.name || 'Strategy'}
                    </StyledStrategyInfoLabel>
                  </StyledStrategyInfoRow>
                )}
                {selectedStrategy.filterFocus && (
                  <StyledStrategyInfoRow>
                    <StyledStrategyInfoLabel>Filter Focus:</StyledStrategyInfoLabel>
                    <StyledStrategyInfoValue>{selectedStrategy.filterFocus}</StyledStrategyInfoValue>
                  </StyledStrategyInfoRow>
                )}
                {/* {selectedStrategy.description && (
                  <StyledStrategyInfoRow>
                    <StyledStrategyInfoLabel>Description:</StyledStrategyInfoLabel>
                    <StyledStrategyInfoValue>{selectedStrategy.description}</StyledStrategyInfoValue>
                  </StyledStrategyInfoRow>
                )} */}

                {/* Display strategy results if available */}
                {strategyResults && (() => {
                  const strategyResult = strategyResults.find(sr => sr.strategy.id === selectedStrategy.id);
                  const preview = strategyResult?.preview;
                  // Get candidateCount from strategy first, then fallback to preview.itemCount
                  const candidateCount = strategyResult?.strategy?.candidateCount ?? preview?.itemCount ?? 0;
                  const hasError = preview?.error;
                  
                  if (hasError) {
                    return (
                      <StyledErrorContainer>
                        <StyledErrorHeader>
                          <span>⚠️</span>
                          <span>Search Failed</span>
                        </StyledErrorHeader>
                        <StyledErrorMessage>
                          {preview?.error?.details || preview?.error?.message}
                        </StyledErrorMessage>
                        {preview?.error?.code && (
                          <StyledErrorDetails>
                            Error code: {preview?.error?.code}
                          </StyledErrorDetails>
                        )}
                      </StyledErrorContainer>
                    );
                  }
                  
                  if (preview) {
                    return (
                      <StyledStrategyResults>
                        <StyledResultsHeader>
                          <StyledResultsCount>
                            {candidateCount} candidate{candidateCount !== 1 ? 's' : ''} found
                          </StyledResultsCount>
                          {onViewStrategyResults && preview.transformedCandidates && preview.transformedCandidates.length > 0 && (
                            <StyledViewResultsButton
                              onClick={() => {
                                console.log('=== View Results button clicked ===', {
                                  strategyId: selectedStrategy.id,
                                  strategyLabel: selectedStrategy.label,
                                  hasPreview: !!preview,
                                  previewKeys: preview ? Object.keys(preview) : [],
                                  hasTransformedCandidates: !!preview?.transformedCandidates,
                                  transformedCandidatesLength: preview?.transformedCandidates?.length || 0,
                                  itemCount: preview?.itemCount,
                                  previewStructure: {
                                    hasItemCount: 'itemCount' in preview,
                                    hasTransformedCandidates: 'transformedCandidates' in preview,
                                    hasSearchResults: 'searchResults' in preview,
                                    hasSearchMetadata: 'searchMetadata' in preview
                                  },
                                  firstCandidate: preview?.transformedCandidates?.[0] ? {
                                    id: preview.transformedCandidates[0].id,
                                    fullName: preview.transformedCandidates[0].fullName,
                                    tempId: preview.transformedCandidates[0].tempId
                                  } : null,
                                  parameterKey
                                });
                                onViewStrategyResults(selectedStrategy, preview, parameterKey);
                              }}
                            >
                              View Results
                            </StyledViewResultsButton>
                          )}
                        </StyledResultsHeader>
                        {preview.searchMetadata && (
                          <StyledResultsMetadata>
                            Total available: {preview.searchMetadata.totalCount || 'N/A'}
                          </StyledResultsMetadata>
                        )}
                      </StyledStrategyResults>
                    );
                  }
                  return null;
                })()}
              </StyledStrategyInfo>
            )}
          </StyledStrategiesContainer>
        )}

        {/* Display LinkedIn URL if available */}
        {selectedStrategy?.linkedInUrl && (
          <StyledLinkedInLink
            href={selectedStrategy.linkedInUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            🔗 View on LinkedIn
          </StyledLinkedInLink>
        )}
        {!hasStrategies && searchParameters.linkedInUrl && (
          <StyledLinkedInLink
            href={searchParameters.linkedInUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            🔗 View on LinkedIn
          </StyledLinkedInLink>
        )}

        {/* Display the actual search parameters */}
        {displayParams && Object.keys(displayParams).length > 0 && (
          <StyledParametersSection>
            <StyledParametersTitle>
              {hasStrategies && selectedStrategy ? `${selectedStrategy.label || 'Selected Strategy'} Parameters:` : 'Generated Search Parameters:'}
            </StyledParametersTitle>
            <StyledParametersList>
              {Object.entries(displayParams).map(([key, value]) => {
                // Skip internal metadata fields
                if (key === 'location_display' || key === 'company_display' || key === 'industry_display' || key === 'school_display') {
                  return null;
                }
                
                if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) {
                  return null;
                }
                
                // Handle nested parameter objects (e.g., classicPeopleSearch, salesNavigatorPeopleSearch)
                if (isNestedParameterObject(value)) {
                  return (
                    <StyledNestedParameterContainer key={key}>
                      <StyledNestedParameterTitle>
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).replace(/_/g, ' ')}:
                      </StyledNestedParameterTitle>
                      <StyledNestedParametersList>
                        {Object.entries(value as Record<string, any>).map(([nestedKey, nestedValue]) => {
                          // Skip internal metadata fields
                          if (nestedKey === 'location_display' || nestedKey === 'company_display' || nestedKey === 'industry_display' || nestedKey === 'school_display') {
                            return null;
                          }
                          
                          if (nestedValue === null || nestedValue === undefined || (Array.isArray(nestedValue) && nestedValue.length === 0)) {
                            return null;
                          }
                          
                          const displayValue = formatParameterValue(nestedKey, nestedValue, value);

                          return (
                            <StyledParameterItem key={nestedKey}>
                              <StyledParameterLabel>
                                {nestedKey.replace(/_/g, ' ').replace(/\b\w/g, l => l?.toString().toUpperCase())}:
                              </StyledParameterLabel>
                              <StyledParameterValue>{displayValue}</StyledParameterValue>
                            </StyledParameterItem>
                          );
                        })}
                      </StyledNestedParametersList>
                    </StyledNestedParameterContainer>
                  );
                }
                
                const displayValue = formatParameterValue(key, value, displayParams);

                return (
                  <StyledParameterItem key={key}>
                    <StyledParameterLabel>
                      {key.replace(/_/g, ' ').replace(/\b\w/g, l => l?.toString().toUpperCase())}:
                    </StyledParameterLabel>
                    <StyledParameterValue>{displayValue}</StyledParameterValue>
                  </StyledParameterItem>
                );
              })}
            </StyledParametersList>
          </StyledParametersSection>
        )}

        <StyledActionButtons>
          <Button
            variant="secondary"
            title="Apply to Search Form"
            onClick={handleApplyClick}
            Icon={IconSettings}
          />
          <Button
            variant="primary"
            title="Generate AI filters"
            onClick={onGenerateEnrichments}
            Icon={IconRefresh}
          />
        </StyledActionButtons>
      </StyledMessageContainer>
    );
  };

  // Auto-load first strategy's results when available
  useEffect(() => {
    console.log('SearchParametersMessage useEffect - checking for auto-load:', {
      hasOnViewStrategyResults: !!onViewStrategyResults,
      searchParametersKeys: Object.keys(searchParameters || {}),
      hasStrategyResults: !!searchParameters.strategyResults,
      strategyResultsLength: searchParameters.strategyResults?.length || 0,
      searchParameters: searchParameters
    });

    if (!onViewStrategyResults) {
      console.log('SearchParametersMessage useEffect - onViewStrategyResults not available yet');
      return;
    }
    
    // Check for strategy results in different formats
    const strategyResults = searchParameters.strategyResults || 
                           searchParameters.data?.strategyResults ||
                           (searchParameters.generatedParams && searchParameters.strategyResults);
    
    console.log('SearchParametersMessage useEffect - strategyResults found:', {
      strategyResultsLength: strategyResults?.length || 0,
      strategyResults: strategyResults
    });
    
    if (strategyResults && strategyResults.length > 0) {
      // Find first strategy with results
      const firstStrategyWithResults = strategyResults.find((sr: any) => 
        sr.preview && sr.preview.transformedCandidates && sr.preview.transformedCandidates.length > 0
      );
      
      console.log('SearchParametersMessage useEffect - firstStrategyWithResults:', {
        found: !!firstStrategyWithResults,
        hasStrategy: !!firstStrategyWithResults?.strategy,
        hasPreview: !!firstStrategyWithResults?.preview,
        candidateCount: firstStrategyWithResults?.preview?.transformedCandidates?.length || 0
      });
      
      if (firstStrategyWithResults && firstStrategyWithResults.strategy) {
        const strategy = firstStrategyWithResults.strategy;
        const strategyId = strategy.id;
        
        // Check if this strategy has already been auto-loaded (persisted in localStorage)
        if (hasAutoLoadedStrategy(strategyId)) {
          console.log('SearchParametersMessage useEffect - Strategy already auto-loaded, skipping:', strategyId);
          return;
        }
        
        const preview = firstStrategyWithResults.preview;
        
        // Determine parameter key
        const parameterKeys = [
          'classicPeopleSearch',
          'classicCompaniesSearch',
          'classicJobsSearch',
          'salesNavigatorPeopleSearch',
          'salesNavigatorCompaniesSearch',
          'recruiterPeopleSearch'
        ];
        const generatedParams = searchParameters.generatedParams || searchParameters.generatedSearchParameters || {};
        const parameterKey = parameterKeys.find(key => generatedParams[key]) || 'classicPeopleSearch';
        
        console.log('SearchParametersMessage useEffect - Auto-loading first strategy results:', {
          strategyId: strategy.id,
          strategyLabel: strategy.label,
          candidateCount: preview.transformedCandidates.length,
          parameterKey,
          previewKeys: Object.keys(preview || {})
        });
        
        // Mark as auto-loaded BEFORE calling onViewStrategyResults to prevent duplicate calls
        markStrategyAsAutoLoaded(strategyId);
        
        // Auto-load after a short delay to ensure component is fully mounted
        const timeoutId = setTimeout(() => {
          console.log('SearchParametersMessage useEffect - Executing auto-load now');
          onViewStrategyResults(strategy, preview, parameterKey);
        }, 500);
        
        return () => clearTimeout(timeoutId);
      } else {
        console.log('SearchParametersMessage useEffect - No strategy with results found');
      }
    } else {
      console.log('SearchParametersMessage useEffect - No strategyResults found or empty');
    }
  }, [searchParameters, onViewStrategyResults]);

  // Handle new format with generatedParams wrapper (from streaming response)
  // Structure: { generatedParams: { classicPeopleSearch: {...}, classicPeopleSearchStrategies: [...] } }
  if (searchParameters.generatedParams) {
    const generatedParams = searchParameters.generatedParams;
    
    // Find the correct parameter key dynamically
    const parameterKeys = [
      'classicPeopleSearch',
      'classicCompaniesSearch',
      'classicJobsSearch',
      'salesNavigatorPeopleSearch',
      'salesNavigatorCompaniesSearch',
      'recruiterPeopleSearch'
    ];
    const parameterKey = parameterKeys.find(key => generatedParams[key]) || 'classicPeopleSearch';
    const primaryParams = generatedParams[parameterKey] || generatedParams.primary || {};
    const strategies = generatedParams.classicPeopleSearchStrategies || generatedParams.strategies || [];
    const strategyResults = searchParameters.strategyResults;
    
    return renderStrategiesView(strategies, primaryParams, parameterKey, true, strategyResults);
  }

  // Handle new format with primary and strategies (from streaming response)
  // Also handle classicPeopleSearch directly
  // Find the correct parameter key dynamically
  const parameterKeys = [
    'classicPeopleSearch',
    'classicCompaniesSearch',
    'classicJobsSearch',
    'salesNavigatorPeopleSearch',
    'salesNavigatorCompaniesSearch',
    'recruiterPeopleSearch'
  ];
  const parameterKey = parameterKeys.find(key => searchParameters[key]) || 'classicPeopleSearch';
  const primaryParams = searchParameters.primary || searchParameters[parameterKey] || {};
  const hasPrimaryOrClassic = searchParameters.primary || searchParameters[parameterKey];
  const strategies = searchParameters.strategies || searchParameters.classicPeopleSearchStrategies || [];
  const strategyResults = searchParameters.strategyResults;
  
  if (hasPrimaryOrClassic) {
    return renderStrategiesView(strategies, primaryParams, parameterKey, false, strategyResults);
  }

  // Handle legacy format with generatedSearchParameters
  if (searchParameters.generatedSearchParameters || searchParameters.resolvedSearchParameters) {
    const resolvedParams = searchParameters.resolvedSearchParameters;
    const generatedParams = searchParameters.generatedSearchParameters;
    
    // Extract strategies from generatedSearchParameters
    const strategies = generatedParams?.classicPeopleSearchStrategies || 
                      generatedParams?.strategies || 
                      [];
    const strategyResults = searchParameters.strategyResults;
    
    // Extract the actual search parameters (could be classicPeopleSearch, etc.)
    const parameterKeys = [
      'classicPeopleSearch',
      'classicCompaniesSearch',
      'classicJobsSearch',
      'salesNavigatorPeopleSearch',
      'salesNavigatorCompaniesSearch',
      'recruiterPeopleSearch'
    ];
    const parameterKey = parameterKeys.find(key => generatedParams?.[key] || resolvedParams?.[key]) || 'classicPeopleSearch';
    const primaryParams = resolvedParams?.[parameterKey] || generatedParams?.[parameterKey] || {};
    
    // If we have strategies, use the strategies view; otherwise use simple view
    if (strategies && strategies.length > 0) {
      return renderStrategiesView(strategies, primaryParams, parameterKey, false, strategyResults);
    }
    
    // Fallback to simple view if no strategies
    const handleApplyClick = () => {
      if (onApplyParameters && resolvedParams) {
        console.log('SearchParametersMessage - Applying parameters:', resolvedParams);
        onApplyParameters(resolvedParams);
      }
    };
    
    return (
      <StyledMessageContainer>
        <StyledHeader>
          <IconSettings size={20} />
          <StyledTitle>Search Parameters Generated</StyledTitle>
        </StyledHeader>

        <StyledContent>
          <p>Search parameters have been generated. Click "Apply to Search Form" to use these parameters in your search.</p>
        </StyledContent>

        {/* Display LinkedIn URL if available */}
        {searchParameters.linkedInUrl && (
          <StyledLinkedInLink
            href={searchParameters.linkedInUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            🔗 View on LinkedIn
          </StyledLinkedInLink>
        )}

        {/* Display the actual search parameters */}
        {Object.keys(primaryParams).length > 0 && (
          <StyledParametersSection>
            <StyledParametersTitle>Generated Search Parameters:</StyledParametersTitle>
            <StyledParametersList>
              {Object.entries(primaryParams).map(([key, value]) => {
                // Skip internal metadata fields
                if (key === 'location_display' || key === 'company_display' || key === 'industry_display' || key === 'school_display') {
                  return null;
                }
                
                if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) {
                  return null;
                }
                
                // Handle nested parameter objects (e.g., classicPeopleSearch, salesNavigatorPeopleSearch)
                if (isNestedParameterObject(value)) {
                  return (
                    <StyledNestedParameterContainer key={key}>
                      <StyledNestedParameterTitle>
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).replace(/_/g, ' ')}:
                      </StyledNestedParameterTitle>
                      <StyledNestedParametersList>
                        {Object.entries(value as Record<string, any>).map(([nestedKey, nestedValue]) => {
                          // Skip internal metadata fields
                          if (nestedKey === 'location_display' || nestedKey === 'company_display' || nestedKey === 'industry_display' || nestedKey === 'school_display') {
                            return null;
                          }
                          
                          if (nestedValue === null || nestedValue === undefined || (Array.isArray(nestedValue) && nestedValue.length === 0)) {
                            return null;
                          }
                          
                          const displayValue = formatParameterValue(nestedKey, nestedValue, value);

                          return (
                            <StyledParameterItem key={nestedKey}>
                              <StyledParameterLabel>
                                {nestedKey.replace(/_/g, ' ').replace(/\b\w/g, l => l?.toString().toUpperCase())}:
                              </StyledParameterLabel>
                              <StyledParameterValue>{displayValue}</StyledParameterValue>
                            </StyledParameterItem>
                          );
                        })}
                      </StyledNestedParametersList>
                    </StyledNestedParameterContainer>
                  );
                }
                
                const displayValue = formatParameterValue(key, value, primaryParams);

                return (
                  <StyledParameterItem key={key}>
                    <StyledParameterLabel>
                      {key.replace(/_/g, ' ').replace(/\b\w/g, l => l?.toString().toUpperCase())}:
                    </StyledParameterLabel>
                    <StyledParameterValue>{displayValue}</StyledParameterValue>
                  </StyledParameterItem>
                );
              })}
            </StyledParametersList>
          </StyledParametersSection>
        )}

        <StyledActionButtons>
          <Button
            variant="secondary"
            title="Apply to Search Form"
            onClick={handleApplyClick}
            Icon={IconSettings}
          />
          <Button
            variant="primary"
            title="Generate AI filters"
            onClick={onGenerateEnrichments}
            Icon={IconRefresh}
          />
        </StyledActionButtons>
      </StyledMessageContainer>
    );
  }
  
  // Handle case where searchParameters doesn't have variations (backward compatibility)
  if (!searchParameters.variations || !Array.isArray(searchParameters.variations)) {
    const handleApplyClickSimple = () => {
      if (onApplyParameters && searchParameters) {
        console.log('SearchParametersMessage - Applying simple parameters:', searchParameters);
        onApplyParameters(searchParameters);
      }
    };
    
    return (
      <StyledMessageContainer>
        <StyledHeader>
          <IconSettings size={20} />
          <StyledTitle>Search Parameters Generated</StyledTitle>
        </StyledHeader>

        <StyledContent>
          <p>Search parameters have been generated. Click "Apply to Search Form" to use these parameters in your search.</p>
        </StyledContent>

        <StyledActionButtons>
          <Button
            variant="secondary"
            onClick={handleApplyClickSimple}
            Icon={IconSettings}
           title="Apply to Search Form" />
          <Button
            variant="primary"
            onClick={onGenerateEnrichments}
            Icon={IconRefresh}
           title="Generate AI filters" />
        </StyledActionButtons>
      </StyledMessageContainer>
    );
  }

  return (
    <StyledMessageContainer>
      <StyledHeader>
        <IconSettings size={20} />
        <StyledTitle>Search Strategy Generated</StyledTitle>
        <StyledComplexityBadge complexity={searchParameters.complexity}>
          {searchParameters.complexity?.toUpperCase()}
        </StyledComplexityBadge>
      </StyledHeader>

      <StyledContent>
        <p><strong>Overall Strategy:</strong> {searchParameters.overallStrategy}</p>
        <p><strong>Complexity Analysis:</strong> {searchParameters.reasoning}</p>
      </StyledContent>

      <StyledVariationsList>
        {searchParameters.variations.map((variation: SearchVariation) => (
          <StyledVariationCard
            key={variation.id}
            isSelected={selectedVariationId === variation.id}
            onClick={() => onVariationSelect?.(variation.id)}
          >
            <StyledVariationHeader>
              <StyledVariationName>{variation.name}</StyledVariationName>
              <StyledVariationType type={variation.type}>
                {variation.type?.toUpperCase()}
              </StyledVariationType>
            </StyledVariationHeader>
            
            <StyledVariationDescription>
              {variation.description}
            </StyledVariationDescription>
            
            <StyledVariationReasoning>
              <strong>Expected Results:</strong> {variation.expectedResultSize} | 
              <strong> Reasoning:</strong> {variation.reasoning}
            </StyledVariationReasoning>

            {/* Display actual search parameters */}
            {variation.searchParameters && Object.keys(variation.searchParameters).length > 0 && (
              <StyledParametersSection>
                <StyledParametersTitle>Search Parameters:</StyledParametersTitle>
                <StyledParametersList>
                  {Object.entries(variation.searchParameters).map(([key, value]) => {
                    // Skip internal metadata fields
                    if (key === 'location_display' || key === 'company_display' || key === 'industry_display' || key === 'school_display') {
                      return null;
                    }
                    
                    if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) {
                      return null;
                    }
                    
                    const displayValue = formatParameterValue(key, value, variation.searchParameters);
            
                    return (
                      <StyledParameterItem key={key}>
                        <StyledParameterLabel>{key.replace(/_/g, ' ').replace(/\b\w/g, l => l?.toString().toUpperCase())}:</StyledParameterLabel>
                        <StyledParameterValue>{displayValue}</StyledParameterValue>
                      </StyledParameterItem>
                    )
                  })}
                </StyledParametersList>
              </StyledParametersSection>
            )}
          </StyledVariationCard>
        ))}
      </StyledVariationsList>

      <StyledActionButtons>
        <Button
          variant="primary"
          onClick={onGenerateEnrichments}
          Icon={IconRefresh}
         title="Generate AI filters" />
      </StyledActionButtons>
    </StyledMessageContainer>
  );
};
