import { SearchParametersResponse, SearchVariation } from '@/candidate-search/types/candidate-search.types';
import styled from '@emotion/styled';
import React, { useState } from 'react';
import { Button, IconRefresh, IconSettings } from 'twenty-ui';

const StyledMessageContainer = styled.div`
  padding: ${({ theme }) => theme.spacing(3)};
  background-color: ${({ theme }) => theme.background.secondary};
  border-radius: ${({ theme }) => theme.border.radius.md};
  margin: ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-bottom: ${({ theme }) => theme.spacing(3)};
`;

const StyledTitle = styled.h3`
  margin: 0;
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.lg};
`;

const StyledContent = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing(3)};
  line-height: 1.6;
`;

const StyledVariationsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  margin: ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledVariationCard = styled.div<{ isSelected?: boolean }>`
  padding: ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme, isSelected }) => 
    isSelected ? theme.color.blue80 : theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme, isSelected }) => 
    isSelected ? theme.color.blue10 : theme.background.primary};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: ${({ theme }) => theme.color.blue60};
    background-color: ${({ theme }) => theme.color.blue10};
  }
`;

const StyledVariationHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing(1)};
`;

const StyledVariationName = styled.h4`
  margin: 0;
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
`;

const StyledVariationType = styled.span<{ type: 'broad' | 'narrow' | 'targeted' }>`
  padding: ${({ theme }) => theme.spacing(0.5)} ${({ theme }) => theme.spacing(1)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  background-color: ${({ type, theme }) => {
    switch (type) {
      case 'broad': return theme.color.green10;
      case 'narrow': return theme.color.orange10;
      case 'targeted': return theme.color.blue10;
      default: return theme.background.secondary;
    }
  }};
  color: ${({ type, theme }) => {
    switch (type) {
      case 'broad': return theme.color.green80;
      case 'narrow': return theme.color.orange80;
      case 'targeted': return theme.color.blue80;
      default: return theme.font.color.primary;
    }
  }};
`;

const StyledVariationDescription = styled.p`
  margin: ${({ theme }) => theme.spacing(1)} 0;
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledVariationReasoning = styled.p`
  margin: ${({ theme }) => theme.spacing(1)} 0;
  color: ${({ theme }) => theme.font.color.tertiary};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-style: italic;
`;

const StyledActionButtons = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-top: ${({ theme }) => theme.spacing(3)};
`;

const StyledComplexityBadge = styled.div<{ complexity: 'simple' | 'moderate' | 'complex' }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  background-color: ${({ complexity, theme }) => {
    switch (complexity) {
      case 'simple': return theme.color.green10;
      case 'moderate': return theme.color.orange10;
      case 'complex': return theme.color.red10;
      default: return theme.background.secondary;
    }
  }};
  color: ${({ complexity, theme }) => {
    switch (complexity) {
      case 'simple': return theme.color.green80;
      case 'moderate': return theme.color.orange80;
      case 'complex': return theme.color.red80;
      default: return theme.font.color.primary;
    }
  }};
`;

const StyledParametersSection = styled.div`
  margin: ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledParametersTitle = styled.h5`
  margin: 0 0 ${({ theme }) => theme.spacing(1)} 0;
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.md};
`;

const StyledParametersList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledParameterItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(1)};
  background-color: ${({ theme }) => theme.background.tertiary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledParameterLabel = styled.span`
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  min-width: 120px;
`;

const StyledParameterValue = styled.span`
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledStrategiesContainer = styled.div`
  margin: ${({ theme }) => theme.spacing(3)} 0;
`;

const StyledStrategiesTabs = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  flex-wrap: wrap;
`;

const StyledStrategyTab = styled.button<{ isActive?: boolean }>`
  padding: ${({ theme }) => theme.spacing(1.5)} ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme, isActive }) => 
    isActive ? theme.color.blue60 : theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme, isActive }) => 
    isActive ? theme.color.blue10 : theme.background.primary};
  color: ${({ theme, isActive }) => 
    isActive ? theme.color.blue80 : theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme, isActive }) => 
    isActive ? theme.font.weight.medium : theme.font.weight.regular};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: ${({ theme }) => theme.color.blue60};
    background-color: ${({ theme }) => theme.color.blue10};
  }
`;

const StyledStrategyInfo = styled.div`
  margin: ${({ theme }) => theme.spacing(2)} 0;
  padding: ${({ theme }) => theme.spacing(2)};
  background-color: ${({ theme }) => theme.background.tertiary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
`;

const StyledStrategyInfoRow = styled.div`
  margin: ${({ theme }) => theme.spacing(1)} 0;
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledStrategyInfoLabel = styled.span`
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  margin-right: ${({ theme }) => theme.spacing(1)};
`;

const StyledStrategyInfoValue = styled.span`
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledRationalesSection = styled.div`
  margin-top: ${({ theme }) => theme.spacing(2)};
  padding-top: ${({ theme }) => theme.spacing(2)};
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
`;

const StyledRationaleItem = styled.div`
  margin: ${({ theme }) => theme.spacing(1)} 0;
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.tertiary};
  font-style: italic;
`;

const StyledRationaleLabel = styled.span`
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.secondary};
  margin-right: ${({ theme }) => theme.spacing(1)};
`;

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
  
  // Handle objects
  if (typeof value === 'object') {
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
};

export const SearchParametersMessage: React.FC<SearchParametersMessageProps> = ({
  searchParameters,
  selectedVariationId,
  onVariationSelect,
  onGenerateEnrichments,
  onApplyParameters,
}) => {
  // State to track selected strategy when multiple strategies are available
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);

  // Helper function to render strategy tabs and content
  const renderStrategiesView = (
    strategies: any[],
    primaryParams: any,
    parameterKey: string,
    isGeneratedParamsFormat: boolean = false
  ) => {
    // If we have strategies, use them; otherwise use primary params
    const hasStrategies = strategies && strategies.length > 0;
    const effectiveStrategies = hasStrategies ? strategies : [];
    
    // Determine which strategy/params to show
    // Use selectedStrategyId if set, otherwise default to first strategy
    const currentStrategyId = selectedStrategyId || 
      (hasStrategies && effectiveStrategies.length > 0 ? effectiveStrategies[0].id : null);
    const selectedStrategy = hasStrategies && currentStrategyId
      ? effectiveStrategies.find(s => s.id === currentStrategyId)
      : null;
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
          <p>Search parameters have been generated. {hasStrategies ? 'Select a strategy below to view its parameters.' : 'Click "Apply to Search Form" to use these parameters in your search.'}</p>
        </StyledContent>

        {/* Display strategy tabs if we have multiple strategies */}
        {hasStrategies && effectiveStrategies.length > 1 && (
          <StyledStrategiesContainer>
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

            {/* Display selected strategy info */}
            {selectedStrategy && (
              <StyledStrategyInfo>
                <StyledStrategyInfoRow>
                  <StyledStrategyInfoLabel>Goal:</StyledStrategyInfoLabel>
                  <StyledStrategyInfoValue>{selectedStrategy.goal}</StyledStrategyInfoValue>
                </StyledStrategyInfoRow>
                <StyledStrategyInfoRow>
                  <StyledStrategyInfoLabel>Aggressiveness:</StyledStrategyInfoLabel>
                  <StyledStrategyInfoValue>{selectedStrategy.aggressiveness}</StyledStrategyInfoValue>
                </StyledStrategyInfoRow>
                <StyledStrategyInfoRow>
                  <StyledStrategyInfoLabel>Estimated Candidates:</StyledStrategyInfoLabel>
                  <StyledStrategyInfoValue>
                    {selectedStrategy.estimatedCandidateCount?.minimum || 'N/A'} - {selectedStrategy.estimatedCandidateCount?.maximum || 'N/A'}
                  </StyledStrategyInfoValue>
                </StyledStrategyInfoRow>
                {selectedStrategy.filterFocus && (
                  <StyledStrategyInfoRow>
                    <StyledStrategyInfoLabel>Filter Focus:</StyledStrategyInfoLabel>
                    <StyledStrategyInfoValue>{selectedStrategy.filterFocus}</StyledStrategyInfoValue>
                  </StyledStrategyInfoRow>
                )}
                {selectedStrategy.whenToUse && (
                  <StyledStrategyInfoRow>
                    <StyledStrategyInfoLabel>When to Use:</StyledStrategyInfoLabel>
                    <StyledStrategyInfoValue>{selectedStrategy.whenToUse}</StyledStrategyInfoValue>
                  </StyledStrategyInfoRow>
                )}
                {selectedStrategy.description && (
                  <StyledStrategyInfoRow>
                    <StyledStrategyInfoLabel>Description:</StyledStrategyInfoLabel>
                    <StyledStrategyInfoValue>{selectedStrategy.description}</StyledStrategyInfoValue>
                  </StyledStrategyInfoRow>
                )}
                
                {/* Display parameter rationales if available */}
                {selectedStrategy.parameterRationales && Object.keys(selectedStrategy.parameterRationales).length > 0 && (
                  <StyledRationalesSection>
                    <StyledParametersTitle>Parameter Rationales:</StyledParametersTitle>
                    {Object.entries(selectedStrategy.parameterRationales).map(([paramName, rationale]) => (
                      <StyledRationaleItem key={paramName}>
                        <StyledRationaleLabel>
                          {paramName.replace(/_/g, ' ').replace(/\b\w/g, l => l?.toString().toUpperCase())}:
                        </StyledRationaleLabel>
                        {String(rationale)}
                      </StyledRationaleItem>
                    ))}
                  </StyledRationalesSection>
                )}
              </StyledStrategyInfo>
            )}
          </StyledStrategiesContainer>
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
          >
            Apply to Search Form
          </Button>
          <Button
            variant="primary"
            title="Generate Enrichments"
            onClick={onGenerateEnrichments}
            Icon={IconRefresh}
          >
            Generate Enrichments
          </Button>
        </StyledActionButtons>
      </StyledMessageContainer>
    );
  };

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
    
    return renderStrategiesView(strategies, primaryParams, parameterKey, true);
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
  
  if (hasPrimaryOrClassic) {
    return renderStrategiesView(strategies, primaryParams, parameterKey, false);
  }

  // Handle legacy format with generatedSearchParameters
  if (searchParameters.generatedSearchParameters || searchParameters.resolvedSearchParameters) {
    const resolvedParams = searchParameters.resolvedSearchParameters;
    const generatedParams = searchParameters.generatedSearchParameters;
    
    // Extract the actual search parameters (could be classicPeopleSearch, etc.)
    const searchParamKey = Object.keys(resolvedParams || generatedParams || {})[0];
    const displayParams = resolvedParams?.[searchParamKey] || generatedParams?.[searchParamKey] || {};
    
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

        {/* Display the actual search parameters */}
        {Object.keys(displayParams).length > 0 && (
          <StyledParametersSection>
            <StyledParametersTitle>Generated Search Parameters:</StyledParametersTitle>
            <StyledParametersList>
              {Object.entries(displayParams).map(([key, value]) => {
                // Skip internal metadata fields
                if (key === 'location_display' || key === 'company_display' || key === 'industry_display' || key === 'school_display') {
                  return null;
                }
                
                if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) {
                  return null;
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
          >
            Apply to Search Form
          </Button>
          <Button
            variant="primary"
            title="Generate Enrichments"
            onClick={onGenerateEnrichments}
            Icon={IconRefresh}
          >
            Generate Enrichments
          </Button>
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
          >
            Apply to Search Form
          </Button>
          <Button
            variant="primary"
            onClick={onGenerateEnrichments}
            Icon={IconRefresh}
          >
            Generate Enrichments
          </Button>
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
        >
          Generate Enrichments
        </Button>
      </StyledActionButtons>
    </StyledMessageContainer>
  );
};
