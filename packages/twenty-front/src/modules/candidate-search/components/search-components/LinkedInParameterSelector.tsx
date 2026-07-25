import { parsedJDSelector } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { resolvedParametersSelector } from '@/candidate-table/states/states';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAtomState } from '@/ui/utilities/state/jotai/hooks/useAtomState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

import { REACT_APP_SERVER_BASE_URL } from '~/config';

type LinkedInParameter = {
  object: 'LinkedinSearchParameter';
  id: string;
  title: string;
  additional_data?: Record<string, any>;
};

type LinkedInParameterSelectorProps = {
  parameterType: string;
  label: string;
  placeholder?: string;
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  onSelectionDisplayChange?: (displayItems: Array<{ id: string; title: string }>) => void;
  keywords?: string;
  limit?: number;
};

// Generate a unique instance ID for each component instance
let instanceCounter = 0;
const getInstanceId = () => ++instanceCounter;

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledLabel = styled.label`
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  color: ${themeCssVariables.font.color.primary};
`;

const StyledInput = styled.input`
  padding: ${themeCssVariables.spacing[2]};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.primary};
  background-color: ${themeCssVariables.background.primary};
  
  &:focus {
    outline: none;
    border-color: ${themeCssVariables.color.blue2};
  }
`;

const StyledDropdown = styled.div`
  position: relative;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  background-color: ${themeCssVariables.background.primary};
  z-index: 10;
`;

const StyledDropdownItem = styled.div<{ isSelected: boolean }>`
  padding: ${themeCssVariables.spacing[2]};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.primary};
  background-color: ${({ isSelected }) => 
    isSelected ? themeCssVariables.color.blue10 : 'transparent'};
  
  &:hover {
    background-color: ${themeCssVariables.color.gray10};
  }
`;

const StyledSelectedContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${themeCssVariables.spacing[1]};
  margin-top: ${themeCssVariables.spacing[1]};
`;

const StyledSelectedItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  background-color: ${themeCssVariables.color.blue10};
  border: 1px solid ${themeCssVariables.color.blue2};
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.color.blue6};
`;

const StyledRemoveButton = styled.button`
  background: none;
  border: none;
  color: ${themeCssVariables.color.blue6};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.sm};
  padding: 0;
  
  &:hover {
    color: ${themeCssVariables.color.red6};
  }
`;

const StyledLoadingContainer = styled.div`
  padding: ${themeCssVariables.spacing[2]};
  text-align: center;
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
`;

const StyledErrorContainer = styled.div`
  padding: ${themeCssVariables.spacing[2]};
  background-color: ${themeCssVariables.color.red10};
  border: 1px solid ${themeCssVariables.color.red2};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.color.red6};
  font-size: ${themeCssVariables.font.size.sm};
`;

export const LinkedInParameterSelector = ({
  parameterType,
  label,
  placeholder = `Search ${label.toLowerCase()}...`,
  selectedValues,
  onSelectionChange,
  onSelectionDisplayChange,
  keywords,
  limit = 50,
}: LinkedInParameterSelectorProps) => {
  const [tokenPair] = useAtomState(tokenPairState);
  const [parsedJD, setParsedJD] = useAtomState(parsedJDSelector);
  const resolvedParameters = useAtomStateValue(resolvedParametersSelector);
  const [searchTerm, setSearchTerm] = useState('');
  const [parameters, setParameters] = useState<LinkedInParameter[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedParameters, setSelectedParameters] = useState<Map<string, string>>(new Map());
  const lastDisplayKeyRef = useRef<string>('');
  const instanceId = useRef(getInstanceId()).current;
  const displayData = useMemo(() => {
    const paramKey = parameterType.toLowerCase();
    const displayKey = `${paramKey}_display`;
    
    
    // First, check in resolvedParameters state (most recent data)
    if (resolvedParameters) {
      // Check flat structure first
      if (resolvedParameters[displayKey]) {
        return resolvedParameters[displayKey];
      }
      
      // Check nested structure
      for (const [key, value] of Object.entries(resolvedParameters)) {
        if (typeof value === 'object' && value !== null && (value as any)[displayKey]) {
          return (value as any)[displayKey];
        }
      }
    }
    
    // Fallback to parsedJD.searchParameters (legacy data)
    if (parsedJD?.searchParameters) {
      
      for (const searchParam of parsedJD.searchParameters) {
        if (searchParam.resolvedSearchParameters) {
          const resolvedSearchParameters = searchParam.resolvedSearchParameters as Record<
            string,
            unknown
          >;
          if (resolvedSearchParameters[displayKey]) {
            return resolvedSearchParameters[displayKey];
          }
          for (const [key, value] of Object.entries(resolvedSearchParameters)) {
            if (typeof value === 'object' && value !== null && (value as any)[displayKey]) {
              return (value as any)[displayKey];
            }
          }
        }
      }
    }
    
    return null;
  }, [resolvedParameters, parsedJD?.searchParameters, parameterType]);

  const fetchParameters = useCallback(async (searchKeywords: string) => {
    if (!searchKeywords.trim()) {
      setParameters([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const searchTerms = searchKeywords.split(/\s+/).slice(0, 3);
      const searchTerm = searchTerms.join(' ');
      const queryParams = new URLSearchParams({
        keywords: searchTerm,
        limit: limit.toString(),
      });

      const response = await fetch(
        `${REACT_APP_SERVER_BASE_URL}/candidate-search/parameters/${parameterType}?${queryParams}`,
        { method: 'GET', headers: { 'Authorization': `Bearer ${tokenPair?.accessOrWorkspaceAgnosticToken?.token}` } }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch ${parameterType} parameters: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Sort results by relevance (exact matches first, then partial matches)
      const sortedItems = (data.items || []).sort((a: LinkedInParameter, b: LinkedInParameter) => {
        const aTitle = a.title.toLowerCase();
        const bTitle = b.title.toLowerCase();
        const searchLower = searchTerm.toLowerCase();
        
        // Exact match gets highest priority
        if (aTitle === searchLower && bTitle !== searchLower) return -1;
        if (bTitle === searchLower && aTitle !== searchLower) return 1;
        
        // Starts with match gets second priority
        if (aTitle.startsWith(searchLower) && !bTitle.startsWith(searchLower)) return -1;
        if (bTitle.startsWith(searchLower) && !aTitle.startsWith(searchLower)) return 1;
        
        // Contains match gets third priority
        if (aTitle.includes(searchLower) && !bTitle.includes(searchLower)) return -1;
        if (bTitle.includes(searchLower) && !aTitle.includes(searchLower)) return 1;
        
        // Otherwise sort alphabetically
        return aTitle.localeCompare(bTitle);
      });
      
      setParameters(sortedItems);
    } catch (err) {
      console.error(`Error fetching ${parameterType} parameters:`, err);
      setError(err instanceof Error ? err.message : 'Failed to fetch parameters');
    } finally {
      setIsLoading(false);
    }
  }, [parameterType, limit, tokenPair?.accessOrWorkspaceAgnosticToken?.token]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchParameters(searchTerm);
    }, 300); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [searchTerm, fetchParameters]);

  // Initialize selectedParameters map from parsedJD - improved approach
  useEffect(() => {

    if (displayData && selectedValues.length > 0) {
      const newMap = new Map<string, string>();
      displayData.forEach((item: { id: string; title: string }) => {
        if (selectedValues.includes(item.id)) {
          newMap.set(item.id, item.title);
        }
      });
      
      // Check if all selectedValues are represented in the newMap
      const allSelectedValuesInNewMap = selectedValues.every(id => newMap.has(id));
      const missingItems = selectedValues.filter(id => !newMap.has(id));
      
      // Only update selectedParameters if:
      // 1. All selectedValues are in the newMap (displayData is complete), OR
      // 2. The selectedParameters map is empty (initial load)
      if (allSelectedValuesInNewMap || selectedParameters.size === 0) {
        setSelectedParameters(newMap);
      } else {
        
      }
    } else if (selectedValues.length === 0) {
      // Clear the map if no values are selected
      setSelectedParameters(new Map());
    }
  }, [displayData, selectedValues, parameterType]);

  // Effect to call onSelectionDisplayChange when selectedParameters changes
  useEffect(() => {
    if (onSelectionDisplayChange && selectedParameters.size > 0) {
      const displayArray = Array.from(selectedParameters.entries()).map(([id, title]) => ({ id, title }));
      // Only call onSelectionDisplayChange if the display data has actually changed
      // This prevents unnecessary updates when the same data is being set again
      const currentDisplayKey = JSON.stringify(displayArray.sort((a, b) => a.id.localeCompare(b.id)));
      
      if (currentDisplayKey !== lastDisplayKeyRef.current) {
        onSelectionDisplayChange(displayArray);
        lastDisplayKeyRef.current = currentDisplayKey;
      }
    }
  }, [selectedParameters, onSelectionDisplayChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setShowDropdown(true);
  };

  const handleParameterSelect = (parameter: LinkedInParameter) => {
    if (!selectedValues.includes(parameter.id)) {
      const newSelectedValues = [...selectedValues, parameter.id];
      onSelectionChange(newSelectedValues);
      
      // Store the parameter with its title for display
      setSelectedParameters(prev => {
        const newMap = new Map(prev).set(parameter.id, parameter.title);
        
        // Immediately call onSelectionDisplayChange to update the display
        if (onSelectionDisplayChange) {
          const displayArray = Array.from(newMap.entries()).map(([id, title]) => ({ id, title }));
          onSelectionDisplayChange(displayArray);
        }
        
        return newMap;
      });
      
      // Update parsedJD state with the new parameter information
      if (parsedJD) {
        setParsedJD(prev => {
          if (!prev) return null;
          
          // Create display item for the new parameter
          const newDisplayItem = { id: parameter.id, title: parameter.title };
          
          // Determine which parameter array to update based on parameterType
          let updatedSearchParameters = [...(prev.searchParameters || [])];
          
          // Find the appropriate search parameter entry
          let searchParamIndex = updatedSearchParameters.findIndex(
            param => param.resolvedSearchParameters && 
            Object.keys(param.resolvedSearchParameters).some(key => 
              key.includes(parameterType.toLowerCase())
            )
          );
          
          if (searchParamIndex === -1) {
            // Create new search parameter entry
            updatedSearchParameters.push({
              generatedSearchParameters: {},
              resolvedSearchParameters: {}
            });
            searchParamIndex = updatedSearchParameters.length - 1;
          }
          
          // Update the appropriate parameter array and display array
          const paramKey = parameterType.toLowerCase();
          const displayKey = `${paramKey}_display`;
          
          // Find the appropriate nested structure (e.g., classicPeopleSearch)
          const resolvedParams = (updatedSearchParameters[searchParamIndex]
            .resolvedSearchParameters ?? {}) as Record<string, any>;
          let targetNestedKey = null;
          
          // Look for existing nested structures
          for (const [key, value] of Object.entries(resolvedParams)) {
            if (typeof value === 'object' && value !== null && 
                (key.includes('classic') || key.includes('sales') || key.includes('recruiter'))) {
              targetNestedKey = key;
              break;
            }
          }
          
          // If no nested structure found, try to determine from parameterType
          if (!targetNestedKey) {
            // Default to classicPeopleSearch for most parameter types
            if (['location', 'industry', 'company', 'school'].includes(paramKey)) {
              targetNestedKey = 'classicPeopleSearch';
            }
          }
          
          if (targetNestedKey) {
            // Add to nested structure
            const nestedParams = resolvedParams[targetNestedKey] || {};
            const currentIds = nestedParams[paramKey] || [];
            const currentDisplay = nestedParams[displayKey] || [];
            
            if (!currentIds.includes(parameter.id)) {
              updatedSearchParameters[searchParamIndex] = {
                ...updatedSearchParameters[searchParamIndex],
                resolvedSearchParameters: {
                  ...resolvedParams,
                  [targetNestedKey]: {
                    ...nestedParams,
                    [paramKey]: [...currentIds, parameter.id],
                    [displayKey]: [...currentDisplay, newDisplayItem]
                  }
                }
              };
            }
          } else {
            // Fallback to top-level structure (for backward compatibility)
            const currentIds = resolvedParams[paramKey] || [];
            const currentDisplay = resolvedParams[displayKey] || [];
            
            if (!currentIds.includes(parameter.id)) {
              updatedSearchParameters[searchParamIndex] = {
                ...updatedSearchParameters[searchParamIndex],
                resolvedSearchParameters: {
                  ...resolvedParams,
                  [paramKey]: [...currentIds, parameter.id],
                  [displayKey]: [...currentDisplay, newDisplayItem]
                }
              };
            }
          }
          
          return {
            ...prev,
            searchParameters: updatedSearchParameters
          };
        });
      }
    }
    setSearchTerm('');
    setShowDropdown(false);
  };

  const handleRemoveSelected = (valueToRemove: string) => {
    const newSelectedValues = selectedValues.filter(value => value !== valueToRemove);
    onSelectionChange(newSelectedValues);
    
    // Update parsedJD state to remove the parameter
    if (parsedJD) {
      setParsedJD(prev => {
        if (!prev) return null;
        
        const updatedSearchParameters = [...(prev.searchParameters || [])];
        
        // Find the appropriate search parameter entry
        const searchParamIndex = updatedSearchParameters.findIndex(
          param => param.resolvedSearchParameters && 
          Object.keys(param.resolvedSearchParameters).some(key => 
            key.includes(parameterType.toLowerCase())
          )
        );
        
        if (searchParamIndex !== -1) {
          const paramKey = parameterType.toLowerCase();
          const displayKey = `${paramKey}_display`;
          const resolvedParams = (updatedSearchParameters[searchParamIndex]
            .resolvedSearchParameters ?? {}) as Record<string, any>;
          
          // Find the appropriate nested structure (e.g., classicPeopleSearch)
          let targetNestedKey = null;
          
          // Look for existing nested structures
          for (const [key, value] of Object.entries(resolvedParams)) {
            if (typeof value === 'object' && value !== null && 
                (key.includes('classic') || key.includes('sales') || key.includes('recruiter'))) {
              targetNestedKey = key;
              break;
            }
          }
          
          // If no nested structure found, try to determine from parameterType
          if (!targetNestedKey) {
            // Default to classicPeopleSearch for most parameter types
            if (['location', 'industry', 'company', 'school'].includes(paramKey)) {
              targetNestedKey = 'classicPeopleSearch';
            }
          }
          
          if (targetNestedKey) {
            // Remove from nested structure
            const nestedParams = resolvedParams[targetNestedKey] || {};
            const currentIds = nestedParams[paramKey] || [];
            const currentDisplay = nestedParams[displayKey] || [];
            
            
            // Remove the parameter from both arrays
            const updatedIds = currentIds.filter((id: string) => id !== valueToRemove);
            const updatedDisplay = currentDisplay.filter((item: { id: string; title: string }) => item.id !== valueToRemove);
            
            updatedSearchParameters[searchParamIndex] = {
              ...updatedSearchParameters[searchParamIndex],
              resolvedSearchParameters: {
                ...resolvedParams,
                [targetNestedKey]: {
                  ...nestedParams,
                  [paramKey]: updatedIds,
                  [displayKey]: updatedDisplay
                }
              }
            };
          } else {
            // Fallback to top-level structure (for backward compatibility)
            const currentIds = resolvedParams[paramKey] || [];
            const currentDisplay = resolvedParams[displayKey] || [];
            
            
            // Remove the parameter from both arrays
            const updatedIds = currentIds.filter((id: string) => id !== valueToRemove);
            const updatedDisplay = currentDisplay.filter((item: { id: string; title: string }) => item.id !== valueToRemove);
            
            updatedSearchParameters[searchParamIndex] = {
              ...updatedSearchParameters[searchParamIndex],
              resolvedSearchParameters: {
                ...resolvedParams,
                [paramKey]: updatedIds,
                [displayKey]: updatedDisplay
              }
            };
          }
        }
        return {
          ...prev,
          searchParameters: updatedSearchParameters
        };
      });
    }
    
    // Remove from selectedParameters map
    setSelectedParameters(prev => {
      const newMap = new Map(prev);
      newMap.delete(valueToRemove);
      return newMap;
    });
  };

  const getSelectedParameterTitle = (id: string) => {
    if (selectedParameters.has(id)) {
      const title = selectedParameters.get(id);
      return title;
    }
    
    if (displayData) {
      const displayItem = displayData.find((item: { id: string; title: string }) => item.id === id);
      if (displayItem?.title) {
        return displayItem.title;
      }
    }
    
    // Try to find display data in parsedJD directly
    if (parsedJD?.searchParameters) {
      const paramKey = parameterType.toLowerCase();
      const displayKey = `${paramKey}_display`;
      
      for (const searchParam of parsedJD.searchParameters) {
        if (searchParam.resolvedSearchParameters) {
          const resolvedSearchParameters = searchParam.resolvedSearchParameters as Record<
            string,
            { id: string; title: string }[]
          >;
          // Check flat structure first
          if (resolvedSearchParameters[displayKey]) {
            const displayArray = resolvedSearchParameters[displayKey];
            const displayItem = displayArray.find((item: { id: string; title: string }) => item.id === id);
            if (displayItem?.title) {
              return displayItem.title;
            }
          }
          
          // Check nested structure
          for (const [key, value] of Object.entries(searchParam.resolvedSearchParameters)) {
            if (typeof value === 'object' && value !== null && (value as any)[displayKey]) {
              const displayArray = (value as any)[displayKey];
              const displayItem = displayArray.find((item: { id: string; title: string }) => item.id === id);
              if (displayItem?.title) {
                return displayItem.title;
              }
            }
          }
        }
      }
    }
    
    const parameter = parameters.find(p => p.id === id);
    const title = parameter?.title || id;
    return title;
  };

  return (
    <StyledContainer>
      <StyledLabel>{label}</StyledLabel>
      <StyledInput
        type="text"
        value={searchTerm}
        onChange={handleInputChange}
        onFocus={() => setShowDropdown(true)}
        placeholder={placeholder}
      />
      
      {showDropdown && (
        <StyledDropdown>
          {isLoading && (
            <StyledLoadingContainer>
              Loading {label.toLowerCase()}...
            </StyledLoadingContainer>
          )}
          
          {error && (
            <StyledErrorContainer>
              {error}
            </StyledErrorContainer>
          )}
          
          {!isLoading && !error && parameters.length === 0 && searchTerm && (
            <StyledLoadingContainer>
              No {label.toLowerCase()} found for "{searchTerm}"
            </StyledLoadingContainer>
          )}
          
          {!isLoading && !error && parameters.map((parameter) => (
            <StyledDropdownItem
              key={`${instanceId}-${parameterType}-${label}-dropdown-${parameter.id}`}
              isSelected={selectedValues.includes(parameter.id)}
              onClick={() => handleParameterSelect(parameter)}
            >
              {parameter.title}
            </StyledDropdownItem>
          ))}
        </StyledDropdown>
      )}
      
      {selectedValues.length > 0 && (
        <StyledSelectedContainer>
          {selectedValues.map((value) => (
            <StyledSelectedItem key={`${instanceId}-${parameterType}-${label}-selected-${value}`}>
              <span>{getSelectedParameterTitle(value)}</span>
              <StyledRemoveButton
                onClick={() => handleRemoveSelected(value)}
                type="button"
              >
                ×
              </StyledRemoveButton>
            </StyledSelectedItem>
          ))}
        </StyledSelectedContainer>
      )}
    </StyledContainer>
  );
};
