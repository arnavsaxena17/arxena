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
  keywords,
  limit = 50,
}: LinkedInParameterSelectorProps) => {
  const [tokenPair] = useRecoilState(tokenPairState);
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setShowDropdown(true);
  };

  const handleParameterSelect = (parameter: LinkedInParameter) => {
    if (!selectedValues.includes(parameter.id)) {
      onSelectionChange([...selectedValues, parameter.id]);
      // Store the parameter with its title for display
      setSelectedParameters(prev => new Map(prev).set(parameter.id, parameter.title));
    }
    setSearchTerm('');
    setShowDropdown(false);
  };

  const handleRemoveSelected = (valueToRemove: string) => {
    onSelectionChange(selectedValues.filter(value => value !== valueToRemove));
    // Remove from selectedParameters map
    setSelectedParameters(prev => {
      const newMap = new Map(prev);
      newMap.delete(valueToRemove);
      return newMap;
    });
  };

  // Effect to initialize selected parameters with human-readable names
  useEffect(() => {
    if (selectedValues.length > 0) {
      const newMap = new Map();
      
      // Check if selectedValues contain human-readable names (not LinkedIn IDs)
      const hasHumanReadableNames = selectedValues.some(value => 
        !value.match(/^\d+$/) && !value.includes('urn:li:')
      );
      
      if (hasHumanReadableNames) {
        // If we have human-readable names, use them directly
        selectedValues.forEach(value => {
          newMap.set(value, value);
        });
      } else {
        // If we have LinkedIn IDs, we'll fetch their titles in the next effect
        selectedValues.forEach(value => {
          newMap.set(value, `ID: ${value}`);
        });
      }
      
      setSelectedParameters(newMap);
    } else {
      // Clear the map if no selected values
      setSelectedParameters(new Map());
    }
  }, [selectedValues]);

  // Effect to handle LinkedIn IDs that don't have titles stored yet
  useEffect(() => {
    const fetchTitlesForIds = async () => {
      const idsNeedingTitles = selectedValues.filter(id => 
        !selectedParameters.has(id) && 
        (id.match(/^\d+$/) || id.includes('urn:li:')) // Check if it's a LinkedIn ID
      );
      
      if (idsNeedingTitles.length > 0 && tokenPair?.accessToken?.token) {
        try {
          // Try to fetch the actual titles for these LinkedIn IDs
          const response = await fetch(
            `${process.env.REACT_APP_SERVER_BASE_URL}/candidate-search/parameters/${parameterType}?ids=${idsNeedingTitles.join(',')}`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${tokenPair.accessToken.token}`,
              },
            }
          );
          
          if (response.ok) {
            const data = await response.json();
            const newMap = new Map(selectedParameters);
            data.items?.forEach((item: LinkedInParameter) => {
              newMap.set(item.id, item.title);
            });
            setSelectedParameters(newMap);
          } else {
            // Fallback: use a more user-friendly display
            const newMap = new Map(selectedParameters);
            idsNeedingTitles.forEach(id => {
              newMap.set(id, `ID: ${id}`);
            });
            setSelectedParameters(newMap);
          }
        } catch (error) {
          console.error('Failed to fetch titles for LinkedIn IDs:', error);
          // Fallback: use a more user-friendly display
          const newMap = new Map(selectedParameters);
          idsNeedingTitles.forEach(id => {
            newMap.set(id, `ID: ${id}`);
          });
          setSelectedParameters(newMap);
        }
      }
    };
    
    fetchTitlesForIds();
  }, [selectedValues, selectedParameters, parameterType, tokenPair?.accessToken?.token]);

  const getSelectedParameterTitle = (id: string) => {
    // First check if we have the title stored in selectedParameters
    if (selectedParameters.has(id)) {
      return selectedParameters.get(id);
    }
    // Fallback to finding in current parameters array
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
