import { parsedJDSelector } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { resolvedParametersSelector } from '@/candidate-table/states/states';
import styled from '@emotion/styled';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

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
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledLabel = styled.label`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledInput = styled.input`
  padding: ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
  background-color: ${({ theme }) => theme.background.primary};
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.color.blue20};
  }
`;

const StyledDropdown = styled.div`
  position: relative;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme }) => theme.background.primary};
  z-index: 10;
`;

const StyledDropdownItem = styled.div<{ isSelected: boolean }>`
  padding: ${({ theme }) => theme.spacing(2)};
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
  background-color: ${({ isSelected, theme }) => 
    isSelected ? theme.color.blue10 : 'transparent'};
  
  &:hover {
    background-color: ${({ theme }) => theme.color.gray10};
  }
`;

const StyledSelectedContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing(1)};
  margin-top: ${({ theme }) => theme.spacing(1)};
`;

const StyledSelectedItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  background-color: ${({ theme }) => theme.color.blue10};
  border: 1px solid ${({ theme }) => theme.color.blue20};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.color.blue60};
`;

const StyledRemoveButton = styled.button`
  background: none;
  border: none;
  color: ${({ theme }) => theme.color.blue60};
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.size.sm};
  padding: 0;
  
  &:hover {
    color: ${({ theme }) => theme.color.red60};
  }
`;

const StyledLoadingContainer = styled.div`
  padding: ${({ theme }) => theme.spacing(2)};
  text-align: center;
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledErrorContainer = styled.div`
  padding: ${({ theme }) => theme.spacing(2)};
  background-color: ${({ theme }) => theme.color.red10};
  border: 1px solid ${({ theme }) => theme.color.red20};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.color.red60};
  font-size: ${({ theme }) => theme.font.size.sm};
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
  const [tokenPair] = useRecoilState(tokenPairState);
  const [parsedJD, setParsedJD] = useRecoilState(parsedJDSelector);
  const resolvedParameters = useRecoilValue(resolvedParametersSelector);
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
    
    console.log(`LinkedInParameterSelector - looking for display data with key: ${displayKey}`);
    
    // First, check in resolvedParameters state (most recent data)
    if (resolvedParameters) {
      console.log(`LinkedInParameterSelector - checking resolvedParameters state:`, resolvedParameters);
      
      // Check flat structure first
      if (resolvedParameters[displayKey]) {
        console.log(`LinkedInParameterSelector - found display data in resolvedParameters flat structure:`, resolvedParameters[displayKey]);
        return resolvedParameters[displayKey];
      }
      
      // Check nested structure
      for (const [key, value] of Object.entries(resolvedParameters)) {
        if (typeof value === 'object' && value !== null && (value as any)[displayKey]) {
          console.log(`LinkedInParameterSelector - found display data in resolvedParameters nested structure (${key}):`, (value as any)[displayKey]);
          return (value as any)[displayKey];
        }
      }
    }
    
    // Fallback to parsedJD.searchParameters (legacy data)
    if (parsedJD?.searchParameters) {
      console.log(`LinkedInParameterSelector - checking parsedJD searchParameters:`, parsedJD.searchParameters);
      
      for (const searchParam of parsedJD.searchParameters) {
        if (searchParam.resolvedSearchParameters) {
          if (searchParam.resolvedSearchParameters[displayKey]) {
            return searchParam.resolvedSearchParameters[displayKey];
          }
          for (const [key, value] of Object.entries(searchParam.resolvedSearchParameters)) {
            if (typeof value === 'object' && value !== null && (value as any)[displayKey]) {
              console.log(`LinkedInParameterSelector - found display data in nested structure (${key}):`, (value as any)[displayKey]);
              return (value as any)[displayKey];
            }
          }
        }
      }
    }
    
    console.log(`LinkedInParameterSelector - no display data found for ${displayKey}`);
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
        `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-search/parameters/${parameterType}?${queryParams}`,
        { method: 'GET', headers: { 'Authorization': `Bearer ${tokenPair?.accessToken?.token}` } }
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
  }, [parameterType, limit, tokenPair?.accessToken?.token]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchParameters(searchTerm);
    }, 300); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [searchTerm, fetchParameters]);

  // Initialize selectedParameters map from parsedJD - improved approach
  useEffect(() => {
    console.log('LinkedInParameterSelector - initializing selectedParameters with:', {
      parameterType,
      selectedValues,
      hasDisplayData: !!displayData
    });
    
    if (displayData && selectedValues.length > 0) {
      const newMap = new Map<string, string>();
      displayData.forEach((item: { id: string; title: string }) => {
        if (selectedValues.includes(item.id)) {
          newMap.set(item.id, item.title);
          console.log(`LinkedInParameterSelector - added to map: ${item.id} -> ${item.title}`);
        }
      });
      console.log('LinkedInParameterSelector - final newMap:', newMap);
      setSelectedParameters(newMap);
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
        console.log('LinkedInParameterSelector - calling onSelectionDisplayChange via useEffect with:', displayArray);
        onSelectionDisplayChange(displayArray);
        lastDisplayKeyRef.current = currentDisplayKey;
      } else {
        console.log('LinkedInParameterSelector - display data unchanged, skipping onSelectionDisplayChange');
      }
    }
  }, [selectedParameters, onSelectionDisplayChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setShowDropdown(true);
  };

  const handleParameterSelect = (parameter: LinkedInParameter) => {
    console.log('LinkedInParameterSelector - handleParameterSelect called with:', {
      parameter,
      parameterType,
      currentSelectedValues: selectedValues,
      willAdd: !selectedValues.includes(parameter.id)
    });
    
    if (!selectedValues.includes(parameter.id)) {
      const newSelectedValues = [...selectedValues, parameter.id];
      console.log('LinkedInParameterSelector - calling onSelectionChange with:', newSelectedValues);
      onSelectionChange(newSelectedValues);
      
      // Store the parameter with its title for display
      setSelectedParameters(prev => {
        const newMap = new Map(prev).set(parameter.id, parameter.title);
        console.log('LinkedInParameterSelector - updated selectedParameters map:', newMap);
        
        // Immediately call onSelectionDisplayChange to update the display
        if (onSelectionDisplayChange) {
          const displayArray = Array.from(newMap.entries()).map(([id, title]) => ({ id, title }));
          console.log('LinkedInParameterSelector - calling onSelectionDisplayChange immediately with:', displayArray);
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
          const resolvedParams = updatedSearchParameters[searchParamIndex].resolvedSearchParameters;
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
              console.log(`LinkedInParameterSelector - Adding parameter to nested structure: ${targetNestedKey}.${paramKey}`);
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
              console.log(`LinkedInParameterSelector - Adding parameter to top-level structure: ${paramKey}`);
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
    console.log('LinkedInParameterSelector - handleRemoveSelected called with:', valueToRemove);
    
    const newSelectedValues = selectedValues.filter(value => value !== valueToRemove);
    console.log('LinkedInParameterSelector - calling onSelectionChange with:', newSelectedValues);
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
          const resolvedParams = updatedSearchParameters[searchParamIndex].resolvedSearchParameters;
          
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
            
            console.log(`LinkedInParameterSelector - Removing parameter from nested structure: ${targetNestedKey}.${paramKey}`);
            
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
            
            console.log(`LinkedInParameterSelector - Removing parameter from top-level structure: ${paramKey}`);
            
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
    console.log(`LinkedInParameterSelector - getSelectedParameterTitle called for id: ${id}`);
    console.log(`LinkedInParameterSelector - parameterType: ${parameterType}`);
    console.log(`LinkedInParameterSelector - displayData:`, displayData);
    console.log(`LinkedInParameterSelector - selectedParameters map:`, selectedParameters);
    
    if (selectedParameters.has(id)) {
      const title = selectedParameters.get(id);
      console.log(`LinkedInParameterSelector - found in selectedParameters map: ${id} -> ${title}`);
      return title;
    }
    
    if (displayData) {
      const displayItem = displayData.find((item: { id: string; title: string }) => item.id === id);
      if (displayItem?.title) {
        console.log(`LinkedInParameterSelector - found in displayData: ${id} -> ${displayItem.title}`);
        return displayItem.title;
      }
    }
    
    // Try to find display data in parsedJD directly
    if (parsedJD?.searchParameters) {
      const paramKey = parameterType.toLowerCase();
      const displayKey = `${paramKey}_display`;
      
      for (const searchParam of parsedJD.searchParameters) {
        if (searchParam.resolvedSearchParameters) {
          // Check flat structure first
          if (searchParam.resolvedSearchParameters[displayKey]) {
            const displayArray = searchParam.resolvedSearchParameters[displayKey];
            const displayItem = displayArray.find((item: { id: string; title: string }) => item.id === id);
            if (displayItem?.title) {
              console.log(`LinkedInParameterSelector - found in parsedJD flat structure: ${id} -> ${displayItem.title}`);
              return displayItem.title;
            }
          }
          
          // Check nested structure
          for (const [key, value] of Object.entries(searchParam.resolvedSearchParameters)) {
            if (typeof value === 'object' && value !== null && (value as any)[displayKey]) {
              const displayArray = (value as any)[displayKey];
              const displayItem = displayArray.find((item: { id: string; title: string }) => item.id === id);
              if (displayItem?.title) {
                console.log(`LinkedInParameterSelector - found in parsedJD nested structure: ${id} -> ${displayItem.title}`);
                return displayItem.title;
              }
            }
          }
        }
      }
    }
    
    const parameter = parameters.find(p => p.id === id);
    const title = parameter?.title || id;
    console.log(`LinkedInParameterSelector - fallback title: ${id} -> ${title}`);
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
