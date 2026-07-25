import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

export const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};

  overflow-y: auto;
  padding-right: ${themeCssVariables.spacing[1]};
  margin-bottom: ${themeCssVariables.spacing[5]};
`;

export const StyledSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  margin-top: ${themeCssVariables.spacing[5]};
`;

export const StyledSectionTitle = styled.h4`
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  color: ${themeCssVariables.font.color.primary};
  margin: 0;
`;

export const StyledInput = styled.input`
  padding: ${themeCssVariables.spacing[2]};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.primary};
  background-color: ${themeCssVariables.background.primary};
  width: ${themeCssVariables.spacing[20]};
  &:focus {
    outline: none;
    border-color: ${themeCssVariables.color.blue2};
  }
`;

export const StyledTextArea = styled.textarea`
  padding: ${themeCssVariables.spacing[2]};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.font.color.primary};
  background-color: ${themeCssVariables.background.primary};
  min-height: 80px;
  resize: vertical;
  
  &:focus {
    outline: none;
    border-color: ${themeCssVariables.color.blue2};
  }
`;

export const StyledSelect = styled.select`
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

export const StyledLabel = styled.label`
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  color: ${themeCssVariables.font.color.primary};
`;

export const StyledCheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing[1]};
`;

export const StyledCheckbox = styled.input`
  margin: 0;
`;

export const StyledRow = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[1]};
  align-items: center;
  flex-wrap: wrap;
`;

export const StyledRowButton = styled.button`
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  background-color: ${themeCssVariables.color.blue10};
  color: ${themeCssVariables.color.blue6};
  border: 1px solid ${themeCssVariables.color.blue2};
  border-radius: ${themeCssVariables.border.radius.sm};
  cursor: pointer;
  &:hover { background-color: ${themeCssVariables.color.blue2}; }
`;

export const StyledGeneratedSection = styled.div`
  padding: ${themeCssVariables.spacing[2]};
  background-color: ${themeCssVariables.color.green10};
  border: 1px solid ${themeCssVariables.color.green2};
  border-radius: ${themeCssVariables.border.radius.sm};
  margin-bottom: ${themeCssVariables.spacing[2]};
`;

export const StyledGeneratedLabel = styled.div`
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  color: ${themeCssVariables.color.green6};
  margin-bottom: ${themeCssVariables.spacing[1]};
`;

export const StyledResolvedSection = styled.div`
  padding: ${themeCssVariables.spacing[2]};
  background-color: ${themeCssVariables.color.blue10};
  border: 1px solid ${themeCssVariables.color.blue2};
  border-radius: ${themeCssVariables.border.radius.sm};
  margin-bottom: ${themeCssVariables.spacing[2]};
`;

export const StyledResolvedLabel = styled.div`
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  color: ${themeCssVariables.color.blue6};
  margin-bottom: ${themeCssVariables.spacing[1]};
`;

export const StyledScrollableContent = styled.div`
  flex: 1;
  padding-right: ${themeCssVariables.spacing[1]};
  
  /* Custom scrollbar styling */
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: ${themeCssVariables.background.secondary};
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: ${themeCssVariables.border.color.medium};
    border-radius: 3px;
    
    &:hover {
      background: ${themeCssVariables.border.color.strong};
    }
  }
`;

export const StyledButtonContainer = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  margin-bottom: ${themeCssVariables.spacing[2]};
`;
