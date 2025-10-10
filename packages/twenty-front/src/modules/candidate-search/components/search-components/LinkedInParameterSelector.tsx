import { parsedJDState } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import styled from '@emotion/styled';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';

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
  const [parsedJD, setParsedJD] = useRecoilState(parsedJDState);
  const [searchTerm, setSearchTerm] = useState('');
  const [parameters, setParameters] = useState<LinkedInParameter[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedParameters, setSelectedParameters] = useState<Map<string, string>>(new Map());

  const fetchParameters = useCallback(async (searchKeywords: string) => {
    if (!searchKeywords.trim()) {
      setParameters([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Use the first few words/characters for better matching
      const searchTerms = searchKeywords.split(/\s+/).slice(0, 3); // Take first 3 words
      const searchTerm = searchTerms.join(' ');
      
      const queryParams = new URLSearchParams({
        keywords: searchTerm,
        limit: limit.toString(),
      });

      const response = await fetch(
        `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-search/parameters/${parameterType}?${queryParams}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${tokenPair?.accessToken?.token}`,
          },
        }
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

  // Initialize selectedParameters map from parsedJD - simplified approach
  useEffect(() => {
    if (parsedJD?.searchParameters && selectedValues.length > 0) {
      const paramKey = parameterType.toLowerCase();
      const displayKey = `${paramKey}_display`;
      
      const searchParam = parsedJD.searchParameters.find(param => 
        param.resolvedSearchParameters && 
        Object.keys(param.resolvedSearchParameters).some(key => 
          key.includes(paramKey)
        )
      );
      
      if (searchParam?.resolvedSearchParameters) {
        const displayArray = searchParam.resolvedSearchParameters[displayKey];
        
        if (Array.isArray(displayArray)) {
          const newMap = new Map<string, string>();
          displayArray.forEach(item => {
            if (selectedValues.includes(item.id)) {
              newMap.set(item.id, item.title);
            }
          });
          setSelectedParameters(newMap);
        }
      }
    }
  }, [parsedJD?.searchParameters, selectedValues, parameterType]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setShowDropdown(true);
  };

  const handleParameterSelect = (parameter: LinkedInParameter) => {
    if (!selectedValues.includes(parameter.id)) {
      const newSelectedValues = [...selectedValues, parameter.id];
      onSelectionChange(newSelectedValues);
      
      // Store the parameter with its title for display
      setSelectedParameters(prev => new Map(prev).set(parameter.id, parameter.title));
      
      // Update parsedJD state with the new parameter information
      if (parsedJD) {
        setParsedJD(prev => {
          if (!prev) return null;
          
          // Create display item for the new parameter
          const newDisplayItem = { id: parameter.id, title: parameter.title };
          
          // Determine which parameter array to update based on parameterType
          let updatedSearchParameters = [...(prev.searchParameters || [])];
          
          // Find or create the appropriate search parameter entry
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
          
          const currentIds = updatedSearchParameters[searchParamIndex].resolvedSearchParameters?.[paramKey] || [];
          const currentDisplay = updatedSearchParameters[searchParamIndex].resolvedSearchParameters?.[displayKey] || [];
          
          // Add the new parameter if not already present
          if (!currentIds.includes(parameter.id)) {
            updatedSearchParameters[searchParamIndex] = {
              ...updatedSearchParameters[searchParamIndex],
              resolvedSearchParameters: {
                ...updatedSearchParameters[searchParamIndex].resolvedSearchParameters,
                [paramKey]: [...currentIds, parameter.id],
                [displayKey]: [...currentDisplay, newDisplayItem]
              }
            };
          }
          
          return {
            ...prev,
            searchParameters: updatedSearchParameters
          };
        });
      }
      
      // Emit detailed display items
      if (onSelectionDisplayChange) {
        const nextMap = new Map(selectedParameters);
        nextMap.set(parameter.id, parameter.title);
        const displayItems = Array.from(nextMap.entries()).map(([id, title]) => ({ id, title }));
        onSelectionDisplayChange(displayItems.filter(item => newSelectedValues.includes(item.id)));
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
          
          const currentIds = updatedSearchParameters[searchParamIndex].resolvedSearchParameters?.[paramKey] || [];
          const currentDisplay = updatedSearchParameters[searchParamIndex].resolvedSearchParameters?.[displayKey] || [];
          
          // Remove the parameter from both arrays
          const updatedIds = currentIds.filter((id: string) => id !== valueToRemove);
          const updatedDisplay = currentDisplay.filter((item: { id: string; title: string }) => item.id !== valueToRemove);
          
          updatedSearchParameters[searchParamIndex] = {
            ...updatedSearchParameters[searchParamIndex],
            resolvedSearchParameters: {
              ...updatedSearchParameters[searchParamIndex].resolvedSearchParameters,
              [paramKey]: updatedIds,
              [displayKey]: updatedDisplay
            }
          };
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
      if (onSelectionDisplayChange) {
        const filtered = Array.from(newMap.entries())
          .filter(([id]) => newSelectedValues.includes(id))
          .map(([id, title]) => ({ id, title }));
        onSelectionDisplayChange(filtered);
      }
      return newMap;
    });
  };

  const getSelectedParameterTitle = (id: string) => {
    if (selectedParameters.has(id)) {
      return selectedParameters.get(id);
    }
    if (parsedJD?.searchParameters) {
      for (const searchParam of parsedJD.searchParameters) {
        if (searchParam.resolvedSearchParameters) {
          const paramKey = parameterType.toLowerCase();
          const displayKey = `${paramKey}_display`;
          const displayArray = searchParam.resolvedSearchParameters[displayKey];
          
          if (Array.isArray(displayArray)) {
            const displayItem = displayArray.find(item => item.id === id);
            if (displayItem?.title) {
              return displayItem.title;
            }
          }
        }
      }
    }
    const parameter = parameters.find(p => p.id === id);
    return parameter?.title || id;
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
              key={parameter.id}
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
            <StyledSelectedItem key={value}>
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
