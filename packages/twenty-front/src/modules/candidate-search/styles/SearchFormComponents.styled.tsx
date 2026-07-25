import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

export const StyledForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
  height: 100%;
  overflow-y: auto;
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
  }
  
  &::-webkit-scrollbar-thumb:hover {
    background: ${themeCssVariables.border.color.strong};
  }
`;

export const StyledSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  margin-bottom: ${themeCssVariables.spacing[2]};
  
  &:last-child {
    margin-bottom: 0;
  }
`;

export const StyledLabel = styled.label`
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  color: ${themeCssVariables.font.color.primary};
`;

export const StyledSelect = styled.select`
  padding: ${themeCssVariables.spacing[2]};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.sm};
  background-color: ${themeCssVariables.background.primary};
  color: ${themeCssVariables.font.color.primary};
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right ${themeCssVariables.spacing[2]} center;
  background-size: 16px;
  padding-right: ${themeCssVariables.spacing[5]};
  
  &:focus {
    outline: none;
    border-color: ${themeCssVariables.color.blue};
  }
`;

export const StyledInput = styled.input`
  padding: ${themeCssVariables.spacing[2]};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.sm};
  background-color: ${themeCssVariables.background.primary};
  color: ${themeCssVariables.font.color.primary};
  
  &:focus {
    outline: none;
    border-color: ${themeCssVariables.color.blue};
  }
`;

export const StyledTextArea = styled.textarea`
  padding: ${themeCssVariables.spacing[2]};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.sm};
  background-color: ${themeCssVariables.background.primary};
  color: ${themeCssVariables.font.color.primary};
  min-height: 80px;
  resize: vertical;
  
  &:focus {
    outline: none;
    border-color: ${themeCssVariables.color.blue};
  }
`;

export const StyledButtonContainer = styled.div`
  display: flex;
  gap: ${themeCssVariables.spacing[2]};
  justify-content: flex-end;
`;

export const StyledGeneratedParams = styled.div`
  padding: ${themeCssVariables.spacing[2]};
  background-color: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.xs};
  color: ${themeCssVariables.font.color.secondary};
  line-height: 1.5;
  word-wrap: break-word;
  white-space: pre-wrap;
  max-height: 200px;
  overflow-y: auto;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
`;

export const StyledButton = styled.button`
  padding: ${themeCssVariables.spacing[2]};
  background-color: ${themeCssVariables.color.blue};
  color: ${themeCssVariables.font.color.inverted};
  border: none;
  border-radius: ${themeCssVariables.border.radius.sm};
  font-size: ${themeCssVariables.font.size.sm};
  cursor: pointer;
  
  &:hover {
    background-color: ${themeCssVariables.color.blue5};
  }
  
  &:disabled {
    background-color: ${themeCssVariables.color.gray2};
    cursor: not-allowed;
  }
`;

export const StyledAdvancedSection = styled.div`
  padding: ${themeCssVariables.spacing[3]};
  background-color: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.sm};
`;

export const StyledResolutionStatus = styled.div<{ isResolving: boolean; isResolved: boolean }>`
  padding: ${themeCssVariables.spacing[2]};
  background-color: ${({ isResolving, isResolved }) => 
    isResolving ? themeCssVariables.color.yellow10 : 
    isResolved ? themeCssVariables.color.green10 : 
    themeCssVariables.color.gray10};
  border: 1px solid ${({ isResolving, isResolved }) => 
    isResolving ? themeCssVariables.color.yellow2 : 
    isResolved ? themeCssVariables.color.green2 : 
    themeCssVariables.color.gray2};
  border-radius: ${themeCssVariables.border.radius.sm};
  margin-bottom: ${themeCssVariables.spacing[2]};
  font-size: ${themeCssVariables.font.size.sm};
  color: ${({ isResolving, isResolved }) => 
    isResolving ? themeCssVariables.color.yellow6 : 
    isResolved ? themeCssVariables.color.green6 : 
    themeCssVariables.color.gray6};
`;

export const StyledResolutionLabel = styled.div`
  font-weight: ${themeCssVariables.font.weight.medium};
`;

export const StyledGeneratingSection = styled.div`
  padding: ${themeCssVariables.spacing[2]};
  background-color: ${themeCssVariables.color.yellow10};
  border: 1px solid ${themeCssVariables.color.yellow2};
  border-radius: ${themeCssVariables.border.radius.sm};
  margin-bottom: ${themeCssVariables.spacing[2]};
  font-size: ${themeCssVariables.font.size.sm};
  color: ${themeCssVariables.color.yellow6};
`;
