
import { parsedJDSelector } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { DEFAULT_STRATEGY_TEMPLATES } from '@/search-plan/templates/defaultStrategies';
import { ENRICHMENT_RESPONSE_FORMAT_OPTIONS } from '@/search-plan/types/EnrichmentResponseFormatOptions';
import { FILTER_RESPONSE_FORMAT_OPTIONS } from '@/search-plan/types/FilterResponseFormatOptions';
import { RESPONSE_FORMAT_OPTIONS } from '@/search-plan/types/ResponseFormatOptions';
import { StrategyTemplate } from '@/search-plan/types/SearchStrategy';
import styled from '@emotion/styled';
import React, { useEffect, useState } from 'react';
import { useRecoilValue } from 'recoil';

const StyledContainer = styled.div`
  display: flex;
  height: 100vh;
  width: 100vw;
  background-color: ${({ theme }) => theme.background.primary};
`;

const StyledSidebar = styled.div`
  width: 300px;
  background-color: ${({ theme }) => theme.background.secondary};
  border-right: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  flex-direction: column;
`;

const StyledSidebarHeader = styled.div`
  padding: ${({ theme }) => theme.spacing(3)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
`;

const StyledSidebarTitle = styled.h2`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0 0 ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledTemplateList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing(2)};
`;

const StyledTemplateItem = styled.div`
  padding: ${({ theme }) => theme.spacing(2)};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  background-color: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: ${({ theme }) => theme.color.blue80};
    box-shadow: ${({ theme }) => theme.boxShadow.strong};
  }
`;

const StyledTemplateName = styled.h3`
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0 0 ${({ theme }) => theme.spacing(1)} 0;
`;

const StyledTemplateDescription = styled.p`
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
  margin: 0;
  line-height: 1.4;
`;

const StyledStaticVariablesSection = styled.div`
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
  padding: ${({ theme }) => theme.spacing(2)};
`;

const StyledStaticVariablesTitle = styled.h3`
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0 0 ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledStaticVariableItem = styled.div`
  padding: ${({ theme }) => theme.spacing(2)};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  background-color: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: ${({ theme }) => theme.color.blue80};
    box-shadow: ${({ theme }) => theme.boxShadow.strong};
  }
`;

const StyledStaticVariableName = styled.h4`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0 0 ${({ theme }) => theme.spacing(1)} 0;
`;

const StyledStaticVariableValue = styled.p`
  font-size: ${({ theme }) => theme.font.size.xs};
  color: ${({ theme }) => theme.font.color.secondary};
  margin: 0;
  line-height: 1.3;
  word-break: break-all;
`;

const StyledModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const StyledModalContent = styled.div`
  background-color: ${({ theme }) => theme.background.primary};
  border-radius: ${({ theme }) => theme.border.radius.md};
  padding: ${({ theme }) => theme.spacing(4)};
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
`;

const StyledModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${({ theme }) => theme.spacing(3)};
`;

const StyledModalTitle = styled.h2`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0;
`;

const StyledCloseButton = styled.button`
  background: none;
  border: none;
  font-size: ${({ theme }) => theme.font.size.xl};
  color: ${({ theme }) => theme.font.color.secondary};
  cursor: pointer;
  padding: ${({ theme }) => theme.spacing(1)};
  
  &:hover {
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledModalForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
`;

const StyledFormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledFormLabel = styled.label`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledFormInput = styled.input`
  padding: ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-family: ${({ theme }) => theme.font.family};
  outline: none;
  transition: border-color 0.2s ease;

  &:focus {
    border-color: ${({ theme }) => theme.color.blue80};
    box-shadow: 0 0 0 2px ${({ theme }) => theme.color.blue20};
  }
`;

const StyledFormTextArea = styled.textarea`
  padding: ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-family: ${({ theme }) => theme.font.family};
  line-height: 1.4;
  resize: vertical;
  outline: none;
  transition: border-color 0.2s ease;
  min-height: 100px;

  &:focus {
    border-color: ${({ theme }) => theme.color.blue80};
    box-shadow: 0 0 0 2px ${({ theme }) => theme.color.blue20};
  }
`;

const StyledModalButtons = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  justify-content: flex-end;
`;

const StyledButton = styled.button`
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${({ theme }) => theme.background.secondary};
  }

  &.primary {
    background-color: ${({ theme }) => theme.color.blue80};
    color: white;
    border-color: ${({ theme }) => theme.color.blue80};

    &:hover {
      background-color: ${({ theme }) => theme.color.blue80};
      opacity: 0.9;
    }
  }
`;

const StyledMainContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
`;

const StyledResultsPanel = styled.div`
  width: 300px;
  background-color: ${({ theme }) => theme.background.secondary};
  border-left: 1px solid ${({ theme }) => theme.border.color.light};
  padding: ${({ theme }) => theme.spacing(3)};
  overflow-y: auto;
`;

const StyledResultsTitle = styled.h3`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0 0 ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledResultsSection = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing(3)};
`;

const StyledResultsSectionTitle = styled.h4`
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0 0 ${({ theme }) => theme.spacing(1)} 0;
`;

const StyledResultsList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const StyledResultsItem = styled.li`
  padding: ${({ theme }) => theme.spacing(1)} 0;
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
`;

const StyledEmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: ${({ theme }) => theme.font.color.secondary};
  text-align: center;
`;

const StyledMainContentHeader = styled.div`
  padding: ${({ theme }) => theme.spacing(3)};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
`;

const StyledMainContentTitle = styled.h2`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0 0 ${({ theme }) => theme.spacing(2)} 0;
`;

const StyledJDTextAreaContainer = styled.div`
  padding: ${({ theme }) => theme.spacing(3)};
  display: flex;
  flex-direction: column;
`;

const StyledJDTextAreaLabel = styled.label`
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
  display: block;
`;

const StyledJDTextArea = styled.textarea`
  height: 200px;
  width: 100%;
  padding: ${({ theme }) => theme.spacing(3)};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-family: ${({ theme }) => theme.font.family};
  line-height: 1.5;
  resize: vertical;
  outline: none;
  transition: border-color 0.2s ease;

  &:focus {
    border-color: ${({ theme }) => theme.color.blue80};
    box-shadow: 0 0 0 2px ${({ theme }) => theme.color.blue20};
  }

  &::placeholder {
    color: ${({ theme }) => theme.font.color.tertiary};
  }
`;

const StyledPromptsContainer = styled.div`
  flex: 1;
  padding: ${({ theme }) => theme.spacing(3)};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
`;

const StyledPromptSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledHorizontalSection = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(3)};
  align-items: flex-start;
`;

const StyledPromptColumn = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledDropdownColumn = styled.div`
  width: 300px;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledPromptLabel = styled.label`
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  display: block;
`;

const StyledPromptTextArea = styled.textarea`
  height: 120px;
  width: 100%;
  padding: ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-family: ${({ theme }) => theme.font.family};
  line-height: 1.4;
  resize: vertical;
  outline: none;
  transition: border-color 0.2s ease;

  &:focus {
    border-color: ${({ theme }) => theme.color.blue80};
    box-shadow: 0 0 0 2px ${({ theme }) => theme.color.blue20};
  }

  &::placeholder {
    color: ${({ theme }) => theme.font.color.tertiary};
  }
`;

const StyledDropdownContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledDropdownLabel = styled.label`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledDropdown = styled.select`
  padding: ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-family: ${({ theme }) => theme.font.family};
  outline: none;
  transition: border-color 0.2s ease;
  cursor: pointer;

  &:focus {
    border-color: ${({ theme }) => theme.color.blue80};
    box-shadow: 0 0 0 2px ${({ theme }) => theme.color.blue20};
  }

  &:hover {
    border-color: ${({ theme }) => theme.color.blue80};
  }
`;

const StyledDropdownOption = styled.option`
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  padding: ${({ theme }) => theme.spacing(1)};
`;

const StyledFormatPreview = styled.div`
  margin-top: ${({ theme }) => theme.spacing(2)};
  padding: ${({ theme }) => theme.spacing(2)};
  background-color: ${({ theme }) => theme.background.secondary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
`;

const StyledFormatPreviewTitle = styled.h4`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0 0 ${({ theme }) => theme.spacing(1)} 0;
`;

const StyledFormatPreviewCode = styled.pre`
  font-size: ${({ theme }) => theme.font.size.xs};
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  color: ${({ theme }) => theme.font.color.secondary};
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
`;

const StyledProcessButton = styled.button`
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  border: 1px solid ${({ theme }) => theme.color.blue80};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme }) => theme.color.blue80};
  color: white;
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: ${({ theme }) => theme.spacing(2)};
  width: 100%;

  &:hover {
    background-color: ${({ theme }) => theme.color.blue80};
    opacity: 0.9;
  }

  &:disabled {
    background-color: ${({ theme }) => theme.background.secondary};
    color: ${({ theme }) => theme.font.color.secondary};
    border-color: ${({ theme }) => theme.border.color.light};
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

const StyledLoadingSpinner = styled.div`
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid ${({ theme }) => theme.color.blue20};
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s ease-in-out infinite;
  margin-right: ${({ theme }) => theme.spacing(1)};

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const StyledOutputsContainer = styled.div`
  flex: 1;
  padding: ${({ theme }) => theme.spacing(3)};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};
`;

const StyledOutputSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
`;

const StyledOutputLabel = styled.label`
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
  display: block;
`;

const StyledOutputTextArea = styled.textarea`
  height: 150px;
  width: 100%;
  padding: ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  background-color: ${({ theme }) => theme.background.secondary};
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  line-height: 1.3;
  resize: vertical;
  outline: none;
  transition: border-color 0.2s ease;

  &:focus {
    border-color: ${({ theme }) => theme.color.blue80};
    box-shadow: 0 0 0 2px ${({ theme }) => theme.color.blue20};
  }

  &::placeholder {
    color: ${({ theme }) => theme.font.color.tertiary};
  }
`;

type StaticVariable = {
  id: string;
  name: string;
  value: string;
};

export const SearchPlans: React.FC = () => {
  const parsedJD = useRecoilValue(parsedJDSelector);
  const [jdText, setJdText] = useState<string>('');
  const [searchParametersPrompt, setSearchParametersPrompt] = useState<string>('');
  const [enrichmentsPrompt, setEnrichmentsPrompt] = useState<string>('');
  const [filtersPrompt, setFiltersPrompt] = useState<string>('');
  const [searchParametersOutput, setSearchParametersOutput] = useState<string>('');
  const [enrichmentsOutput, setEnrichmentsOutput] = useState<string>('');
  const [filtersOutput, setFiltersOutput] = useState<string>('');
  const [staticVariables, setStaticVariables] = useState<StaticVariable[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingVariable, setEditingVariable] = useState<StaticVariable | null>(null);
  const [newVariableName, setNewVariableName] = useState<string>('');
  const [newVariableValue, setNewVariableValue] = useState<string>('');
  const [selectedResponseFormat, setSelectedResponseFormat] = useState<string>('sales_navigator_people');
  const [selectedEnrichmentFormat, setSelectedEnrichmentFormat] = useState<string>('skills_extraction');
  const [selectedFilterFormat, setSelectedFilterFormat] = useState<string>('handsontable_basic');
  const [isProcessingSearchParams, setIsProcessingSearchParams] = useState<boolean>(false);
  const [isProcessingEnrichments, setIsProcessingEnrichments] = useState<boolean>(false);
  const [isProcessingFilters, setIsProcessingFilters] = useState<boolean>(false);

  // Load data from session storage on component mount
  useEffect(() => {
    const savedJdText = sessionStorage.getItem('searchPlans_jdText');
    const savedSearchParametersPrompt = sessionStorage.getItem('searchPlans_searchParametersPrompt');
    const savedEnrichmentsPrompt = sessionStorage.getItem('searchPlans_enrichmentsPrompt');
    const savedFiltersPrompt = sessionStorage.getItem('searchPlans_filtersPrompt');
    const savedStaticVariables = sessionStorage.getItem('searchPlans_staticVariables');
    const savedResponseFormat = sessionStorage.getItem('searchPlans_responseFormat');
    const savedEnrichmentFormat = sessionStorage.getItem('searchPlans_enrichmentFormat');
    const savedFilterFormat = sessionStorage.getItem('searchPlans_filterFormat');

    if (savedJdText) setJdText(savedJdText);
    if (savedSearchParametersPrompt) setSearchParametersPrompt(savedSearchParametersPrompt);
    if (savedEnrichmentsPrompt) setEnrichmentsPrompt(savedEnrichmentsPrompt);
    if (savedFiltersPrompt) setFiltersPrompt(savedFiltersPrompt);
    if (savedResponseFormat) setSelectedResponseFormat(savedResponseFormat);
    if (savedEnrichmentFormat) setSelectedEnrichmentFormat(savedEnrichmentFormat);
    if (savedFilterFormat) setSelectedFilterFormat(savedFilterFormat);
    if (savedStaticVariables) {
      try {
        setStaticVariables(JSON.parse(savedStaticVariables));
      } catch (error) {
        console.error('Error parsing saved static variables:', error);
      }
    }
  }, []);

  // Save data to session storage whenever state changes
  useEffect(() => {
    sessionStorage.setItem('searchPlans_jdText', jdText);
  }, [jdText]);

  useEffect(() => {
    sessionStorage.setItem('searchPlans_searchParametersPrompt', searchParametersPrompt);
  }, [searchParametersPrompt]);

  useEffect(() => {
    sessionStorage.setItem('searchPlans_enrichmentsPrompt', enrichmentsPrompt);
  }, [enrichmentsPrompt]);

  useEffect(() => {
    sessionStorage.setItem('searchPlans_filtersPrompt', filtersPrompt);
  }, [filtersPrompt]);

  useEffect(() => {
    sessionStorage.setItem('searchPlans_staticVariables', JSON.stringify(staticVariables));
  }, [staticVariables]);

  useEffect(() => {
    sessionStorage.setItem('searchPlans_responseFormat', selectedResponseFormat);
  }, [selectedResponseFormat]);

  useEffect(() => {
    sessionStorage.setItem('searchPlans_enrichmentFormat', selectedEnrichmentFormat);
  }, [selectedEnrichmentFormat]);

  useEffect(() => {
    sessionStorage.setItem('searchPlans_filterFormat', selectedFilterFormat);
  }, [selectedFilterFormat]);

  const handleJdTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJdText(event.target.value);
  };

  const handleSearchParametersPromptChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSearchParametersPrompt(event.target.value);
  };

  const handleEnrichmentsPromptChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEnrichmentsPrompt(event.target.value);
  };

  const handleFiltersPromptChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFiltersPrompt(event.target.value);
  };

  const handleResponseFormatChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedResponseFormat(event.target.value);
  };

  const handleEnrichmentFormatChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedEnrichmentFormat(event.target.value);
  };

  const handleFilterFormatChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedFilterFormat(event.target.value);
  };

  const handleStaticVariableClick = (variable: StaticVariable) => {
    setEditingVariable(variable);
    setNewVariableName(variable.name);
    setNewVariableValue(variable.value);
    setIsModalOpen(true);
  };

  const handleAddNewVariable = () => {
    setEditingVariable(null);
    setNewVariableName('');
    setNewVariableValue('');
    setIsModalOpen(true);
  };

  const handleSaveVariable = (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!newVariableName.trim() || !newVariableValue.trim()) {
      return;
    }

    if (editingVariable) {
      // Update existing variable
      setStaticVariables(prev => 
        prev.map(variable => 
          variable.id === editingVariable.id 
            ? { ...variable, name: newVariableName.trim(), value: newVariableValue.trim() }
            : variable
        )
      );
    } else {
      // Add new variable
      const newVariable: StaticVariable = {
        id: Date.now().toString(),
        name: newVariableName.trim(),
        value: newVariableValue.trim()
      };
      setStaticVariables(prev => [...prev, newVariable]);
    }

    setIsModalOpen(false);
    setEditingVariable(null);
    setNewVariableName('');
    setNewVariableValue('');
  };

  const handleDeleteVariable = (variableId: string) => {
    setStaticVariables(prev => prev.filter(variable => variable.id !== variableId));
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingVariable(null);
    setNewVariableName('');
    setNewVariableValue('');
  };

  // Function to replace template variables in prompts
  const replaceTemplateVariables = (text: string): string => {
    return staticVariables.reduce((acc, variable) => {
      const regex = new RegExp(`\\{\\{${variable.name}\\}\\}`, 'g');
      return acc.replace(regex, variable.value);
    }, text);
  };

  // Process Search Parameters Prompt
  const handleProcessSearchParameters = async () => {
    if (!jdText.trim() || !searchParametersPrompt.trim()) {
      alert('Please provide both Job Description and Search Parameters Prompt');
      return;
    }

    setIsProcessingSearchParams(true);
    try {
      const processedPrompt = replaceTemplateVariables(searchParametersPrompt);
      
      const response = await fetch(process.env.REACT_APP_SERVER_BASE_URL + '/candidate-search/process-search-parameters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          jdText,
          prompt: processedPrompt,
          responseFormat: selectedResponseFormat,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process search parameters');
      }

      const result = await response.json();
      setSearchParametersOutput(JSON.stringify(result.data, null, 2));
    } catch (error) {
      console.error('Error processing search parameters:', error);
      setSearchParametersOutput(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessingSearchParams(false);
    }
  };

  // Process Enrichments Prompt
  const handleProcessEnrichments = async () => {
    if (!jdText.trim() || !enrichmentsPrompt.trim()) {
      alert('Please provide both Job Description and Enrichments Prompt');
      return;
    }

    setIsProcessingEnrichments(true);
    try {
      const processedPrompt = replaceTemplateVariables(enrichmentsPrompt);
      
      const response = await fetch(process.env.REACT_APP_SERVER_BASE_URL + '/candidate-search/process-enrichments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          jdText,
          prompt: processedPrompt,
          responseFormat: selectedEnrichmentFormat,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process enrichments');
      }

      const result = await response.json();
      setEnrichmentsOutput(JSON.stringify(result.data, null, 2));
    } catch (error) {
      console.error('Error processing enrichments:', error);
      setEnrichmentsOutput(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessingEnrichments(false);
    }
  };

  // Process Filters Prompt
  const handleProcessFilters = async () => {
    if (!jdText.trim() || !filtersPrompt.trim()) {
      alert('Please provide both Job Description and Filters Prompt');
      return;
    }

    setIsProcessingFilters(true);
    try {
      const processedPrompt = replaceTemplateVariables(filtersPrompt);
      
      const response = await fetch(process.env.REACT_APP_SERVER_BASE_URL + '/candidate-search/process-filters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          jdText,
          prompt: processedPrompt,
          responseFormat: selectedFilterFormat,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process filters');
      }

      const result = await response.json();
      setFiltersOutput(JSON.stringify(result.data, null, 2));
    } catch (error) {
      console.error('Error processing filters:', error);
      setFiltersOutput(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessingFilters(false);
    }
  };

  return (
    <StyledContainer>
      <StyledSidebar>
        <StyledSidebarHeader>
          <StyledSidebarTitle>Strategy Templates</StyledSidebarTitle>
        </StyledSidebarHeader>

        <StyledTemplateList>
          {DEFAULT_STRATEGY_TEMPLATES.map((template: StrategyTemplate) => (
            <StyledTemplateItem
              key={template.id}
            >
              <StyledTemplateName>{template.name}</StyledTemplateName>
              <StyledTemplateDescription>
                {template.description}
              </StyledTemplateDescription>
            </StyledTemplateItem>
          ))}
        </StyledTemplateList>

        <StyledStaticVariablesSection>
          <StyledStaticVariablesTitle>Static Variables</StyledStaticVariablesTitle>
          {staticVariables.map((variable) => (
            <StyledStaticVariableItem
              key={variable.id}
              onClick={() => handleStaticVariableClick(variable)}
            >
              <StyledStaticVariableName>{`{{${variable.name}}}`}</StyledStaticVariableName>
              <StyledStaticVariableValue>
                {variable.value.length > 50 
                  ? `${variable.value.substring(0, 50)}...` 
                  : variable.value
                }
              </StyledStaticVariableValue>
            </StyledStaticVariableItem>
          ))}
          <StyledStaticVariableItem onClick={handleAddNewVariable}>
            <StyledStaticVariableName>+ Add New Variable</StyledStaticVariableName>
            <StyledStaticVariableValue>Click to add a new static variable</StyledStaticVariableValue>
          </StyledStaticVariableItem>
        </StyledStaticVariablesSection>
      </StyledSidebar>

      <StyledMainContent>
        <StyledMainContentHeader>
          <StyledMainContentTitle>Search Strategy Configuration</StyledMainContentTitle>
        </StyledMainContentHeader>
        
        <StyledJDTextAreaContainer>
          <StyledJDTextAreaLabel htmlFor="jd-textarea">
            Job Description:
          </StyledJDTextAreaLabel>
          <StyledJDTextArea
            id="jd-textarea"
            value={jdText}
            onChange={handleJdTextChange}
            placeholder="Paste your job description here... For example:

Job Description: Head of Corporate Strategy and Planning
Modern Insulators Limited

Company Overview
Modern Insulators Limited stands as a global leader in the electrical insulator industry..."
          />
        </StyledJDTextAreaContainer>

        <StyledPromptsContainer>
          <StyledHorizontalSection>
            <StyledPromptColumn>
              <StyledPromptLabel htmlFor="search-parameters-prompt">
                Search Parameters Prompt:
              </StyledPromptLabel>
              <StyledPromptTextArea
                id="search-parameters-prompt"
                value={searchParametersPrompt}
                onChange={handleSearchParametersPromptChange}
                placeholder="Enter prompt for generating LinkedIn search parameters... You can use static variables like {{companyName}}, {{industry}}, {{location}} etc."
              />
              <StyledProcessButton
                onClick={handleProcessSearchParameters}
                disabled={isProcessingSearchParams || !jdText.trim() || !searchParametersPrompt.trim()}
              >
                {isProcessingSearchParams ? (
                  <>
                    <StyledLoadingSpinner />
                    Processing...
                  </>
                ) : (
                  'Process Search Parameters'
                )}
              </StyledProcessButton>
            </StyledPromptColumn>

            <StyledDropdownColumn>
              <StyledDropdownContainer>
                <StyledDropdownLabel htmlFor="response-format-dropdown">
                  Response Format:
                </StyledDropdownLabel>
                <StyledDropdown
                  id="response-format-dropdown"
                  value={selectedResponseFormat}
                  onChange={handleResponseFormatChange}
                >
                  {RESPONSE_FORMAT_OPTIONS.map((option) => (
                    <StyledDropdownOption key={option.id} value={option.id}>
                      {option.name}
                    </StyledDropdownOption>
                  ))}
                </StyledDropdown>
              </StyledDropdownContainer>
              
              <StyledFormatPreview>
                <StyledFormatPreviewTitle>
                  Example Output Format:
                </StyledFormatPreviewTitle>
                <StyledFormatPreviewCode>
                  {JSON.stringify(
                    RESPONSE_FORMAT_OPTIONS.find(opt => opt.id === selectedResponseFormat)?.example || {},
                    null,
                    2
                  )}
                </StyledFormatPreviewCode>
              </StyledFormatPreview>
            </StyledDropdownColumn>
          </StyledHorizontalSection>

          <StyledHorizontalSection>
            <StyledPromptColumn>
              <StyledPromptLabel htmlFor="enrichments-prompt">
                Enrichments Prompt:
              </StyledPromptLabel>
              <StyledPromptTextArea
                id="enrichments-prompt"
                value={enrichmentsPrompt}
                onChange={handleEnrichmentsPromptChange}
                placeholder="Enter prompt for candidate enrichment... You can use static variables like {{companyName}}, {{industry}}, {{location}} etc."
              />
              <StyledProcessButton
                onClick={handleProcessEnrichments}
                disabled={isProcessingEnrichments || !jdText.trim() || !enrichmentsPrompt.trim()}
              >
                {isProcessingEnrichments ? (
                  <>
                    <StyledLoadingSpinner />
                    Processing...
                  </>
                ) : (
                  'Process Enrichments'
                )}
              </StyledProcessButton>
            </StyledPromptColumn>

            <StyledDropdownColumn>
              <StyledDropdownContainer>
                <StyledDropdownLabel htmlFor="enrichment-format-dropdown">
                  Enrichment Response Format:
                </StyledDropdownLabel>
                <StyledDropdown
                  id="enrichment-format-dropdown"
                  value={selectedEnrichmentFormat}
                  onChange={handleEnrichmentFormatChange}
                >
                  {ENRICHMENT_RESPONSE_FORMAT_OPTIONS.map((option) => (
                    <StyledDropdownOption key={option.id} value={option.id}>
                      {option.name}
                    </StyledDropdownOption>
                  ))}
                </StyledDropdown>
              </StyledDropdownContainer>
              
              <StyledFormatPreview>
                <StyledFormatPreviewTitle>
                  Example Enrichment Format:
                </StyledFormatPreviewTitle>
                <StyledFormatPreviewCode>
                  {JSON.stringify(
                    ENRICHMENT_RESPONSE_FORMAT_OPTIONS.find(opt => opt.id === selectedEnrichmentFormat)?.examples || [],
                    null,
                    2
                  )}
                </StyledFormatPreviewCode>
              </StyledFormatPreview>
            </StyledDropdownColumn>
          </StyledHorizontalSection>

          <StyledHorizontalSection>
            <StyledPromptColumn>
              <StyledPromptLabel htmlFor="filters-prompt">
                Filters Prompt:
              </StyledPromptLabel>
              <StyledPromptTextArea
                id="filters-prompt"
                value={filtersPrompt}
                onChange={handleFiltersPromptChange}
                placeholder="Enter prompt for candidate filtering... You can use static variables like {{companyName}}, {{industry}}, {{location}} etc."
              />
              <StyledProcessButton
                onClick={handleProcessFilters}
                disabled={isProcessingFilters || !jdText.trim() || !filtersPrompt.trim()}
              >
                {isProcessingFilters ? (
                  <>
                    <StyledLoadingSpinner />
                    Processing...
                  </>
                ) : (
                  'Process Filters'
                )}
              </StyledProcessButton>
            </StyledPromptColumn>

            <StyledDropdownColumn>
              <StyledDropdownContainer>
                <StyledDropdownLabel htmlFor="filter-format-dropdown">
                  Filter Response Format:
                </StyledDropdownLabel>
                <StyledDropdown
                  id="filter-format-dropdown"
                  value={selectedFilterFormat}
                  onChange={handleFilterFormatChange}
                >
                  {FILTER_RESPONSE_FORMAT_OPTIONS.map((option) => (
                    <StyledDropdownOption key={option.id} value={option.id}>
                      {option.name}
                    </StyledDropdownOption>
                  ))}
                </StyledDropdown>
              </StyledDropdownContainer>
              
              <StyledFormatPreview>
                <StyledFormatPreviewTitle>
                  Example Filter Format:
                </StyledFormatPreviewTitle>
                <StyledFormatPreviewCode>
                  {JSON.stringify(
                    FILTER_RESPONSE_FORMAT_OPTIONS.find(opt => opt.id === selectedFilterFormat)?.examples || {},
                    null,
                    2
                  )}
                </StyledFormatPreviewCode>
              </StyledFormatPreview>
            </StyledDropdownColumn>
          </StyledHorizontalSection>
        </StyledPromptsContainer>
      </StyledMainContent>

      <StyledResultsPanel>
        <StyledResultsTitle>Strategy Outputs</StyledResultsTitle>
        
        <StyledOutputsContainer>
          <StyledOutputSection>
            <StyledOutputLabel htmlFor="search-parameters-output">
              Search Parameters Output:
            </StyledOutputLabel>
            <StyledOutputTextArea
              id="search-parameters-output"
              value={searchParametersOutput}
              readOnly
              placeholder="Search parameters JSON output will appear here..."
            />
          </StyledOutputSection>

          <StyledOutputSection>
            <StyledOutputLabel htmlFor="enrichments-output">
              Enrichments Output:
            </StyledOutputLabel>
            <StyledOutputTextArea
              id="enrichments-output"
              value={enrichmentsOutput}
              readOnly
              placeholder="Enrichments JSON output will appear here..."
            />
          </StyledOutputSection>

          <StyledOutputSection>
            <StyledOutputLabel htmlFor="filters-output">
              Filters Output:
            </StyledOutputLabel>
            <StyledOutputTextArea
              id="filters-output"
              value={filtersOutput}
              readOnly
              placeholder="Filters JSON output will appear here..."
            />
          </StyledOutputSection>
        </StyledOutputsContainer>
      </StyledResultsPanel>

      {isModalOpen && (
        <StyledModal onClick={handleCloseModal}>
          <StyledModalContent onClick={(e) => e.stopPropagation()}>
            <StyledModalHeader>
              <StyledModalTitle>
                {editingVariable ? 'Edit Static Variable' : 'Add New Static Variable'}
              </StyledModalTitle>
              <StyledCloseButton onClick={handleCloseModal}>×</StyledCloseButton>
            </StyledModalHeader>
            
            <StyledModalForm onSubmit={handleSaveVariable}>
              <StyledFormGroup>
                <StyledFormLabel htmlFor="variable-name">Variable Name</StyledFormLabel>
                <StyledFormInput
                  id="variable-name"
                  type="text"
                  value={newVariableName}
                  onChange={(e) => setNewVariableName(e.target.value)}
                  placeholder="e.g., companyName, industry, location"
                  required
                />
              </StyledFormGroup>
              
              <StyledFormGroup>
                <StyledFormLabel htmlFor="variable-value">Variable Value</StyledFormLabel>
                <StyledFormTextArea
                  id="variable-value"
                  value={newVariableValue}
                  onChange={(e) => setNewVariableValue(e.target.value)}
                  placeholder="Enter the value for this variable..."
                  required
                />
              </StyledFormGroup>
              
              <StyledModalButtons>
                <StyledButton type="button" onClick={handleCloseModal}>
                  Cancel
                </StyledButton>
                {editingVariable && (
                  <StyledButton 
                    type="button" 
                    onClick={() => {
                      handleDeleteVariable(editingVariable.id);
                      handleCloseModal();
                    }}
                  >
                    Delete
                  </StyledButton>
                )}
                <StyledButton type="submit" className="primary">
                  {editingVariable ? 'Update' : 'Add'} Variable
                </StyledButton>
              </StyledModalButtons>
            </StyledModalForm>
          </StyledModalContent>
        </StyledModal>
      )}

    </StyledContainer>
  );
};