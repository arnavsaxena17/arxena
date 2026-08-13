import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const sharedInputStyles = `
  width: 100%;
  padding: 0.5rem 1rem;
  font-size: 1rem;
  font-weight: 500;
  background: ${themeCssVariables.background.primary};
  color: ${themeCssVariables.font.color.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: 0.5rem;
  outline: none;
  font-family: inherit;
  transition: all 0.2s;

  &:focus {
    border-color: ${themeCssVariables.color.blue};
    box-shadow: 0 0 0 2px ${themeCssVariables.background.transparent.blue};
  }
`;

export const Container = styled.div`
  align-items: flex-start;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 100%;
  padding: 1.5rem;
  width: 100%;
`;

export const StyledInput = styled.input`
  ${sharedInputStyles}
  align-self: flex-start;
  width: 400px;
`;

export const StyledTextArea = styled.textarea`
  ${sharedInputStyles}
  align-self: flex-start;
  resize: vertical;
  width: 400px;
`;

export const StyledSelect = styled.select`
  ${sharedInputStyles}
  width: 400px;
`;

export const FieldsList = styled.div`
  align-self: flex-start;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 400px;
`;

export const FieldContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

export const EnumValuesInput = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

export const EnumValueRow = styled.div`
  align-items: center;
  display: flex;
  gap: 0.5rem;
`;

export const FieldCard = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: 0.5rem;
  display: flex;
  font-family: inherit;
  gap: 1rem;
  padding: 1rem;
  transition: all 0.2s;

  &:hover {
    border-color: ${themeCssVariables.border.color.strong};
  }
`;

export const FieldContent = styled.div`
  flex: 1;
`;

export const FieldHeader = styled.div`
  align-items: center;
  display: flex;
  gap: 0.5rem;
`;

export const FieldName = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-weight: 500;
`;

export const FieldType = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: 0.875rem;
`;

export const RequiredBadge = styled.span`
  color: ${themeCssVariables.color.red};
  font-size: 0.75rem;
`;

export const FieldDescription = styled.p`
  color: ${themeCssVariables.font.color.secondary};
  font-size: 0.875rem;
  margin-top: 0.25rem;
`;

export const AddFieldForm = styled.div`
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;

  form {
    margin: 0;
  }
`;

export const CheckboxContainer = styled.div`
  align-items: center;
  display: flex;
  gap: 0.5rem;
`;

export const CodeBlock = styled.div`
  align-self: flex-start;
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: 0.5rem;
  color: ${themeCssVariables.font.color.primary};
  margin-top: 1.5rem;
  padding: 1rem;
  width: 400px;

  pre {
    overflow-x: auto;
    white-space: pre-wrap;
  }
`;

export const ErrorAlert = styled.div`
  align-items: center;
  background: ${themeCssVariables.tag.background.red};
  border: 1px solid ${themeCssVariables.border.color.danger};
  border-radius: 0.5rem;
  color: ${themeCssVariables.tag.text.red};
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem;
`;

export const ButtonGroup = styled.div`
  display: flex;
  gap: 0.5rem;
`;

export const SelectedFieldsContainer = styled.div`
  align-self: flex-start;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 1rem;
  max-width: 400px;
  min-height: 2.5rem;
  overflow-x: auto;
  overflow-y: hidden;
  width: 400px;
`;

export const SelectedFieldTag = styled.div`
  align-items: center;
  background: ${themeCssVariables.background.tertiary};
  border-radius: 0.25rem;
  color: ${themeCssVariables.font.color.primary};
  display: flex;
  flex-shrink: 0;
  font-size: 0.875rem;
  gap: 0.5rem;
  min-width: fit-content;
  padding: 0.5rem;
  white-space: nowrap;
`;

export const MultiSelect = styled.select`
  ${sharedInputStyles}
  font-family: inherit;
  height: auto;
  min-height: 80px;
  multiple: true;
  width: 400px;
`;

export const SelectLabel = styled.label`
  align-self: flex-start;
  color: ${themeCssVariables.font.color.primary};
  display: block;
  font-weight: 500;
  margin-bottom: 0.5rem;
`;

export const ModelCodeDisplay = styled.div<{ show: boolean }>`
  align-self: flex-start;
  margin-top: 1.5rem;
  opacity: ${(props) => (props.show ? 1 : 0)};
  transition: opacity 0.3s ease-in-out;
`;

export const LoadingIndicator = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  font-size: 0.875rem;
  justify-content: center;
  padding: 1rem;
`;

export const FieldsLoadingContainer = styled.div`
  align-items: center;
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: 0.5rem;
  display: flex;
  justify-content: center;
  min-height: 80px;
  width: 400px;
`;

export const CheckboxFieldsContainer = styled.div`
  align-self: flex-start;
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: 0.5rem;
  max-height: 200px;
  overflow-y: auto;
  padding: 0.5rem;
  width: 400px;
`;

export const CheckboxField = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.primary};
  cursor: pointer;
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
  transition: background-color 0.2s;

  &:hover {
    background-color: ${themeCssVariables.background.tertiary};
  }

  input[type='checkbox'] {
    cursor: pointer;
  }

  label {
    cursor: pointer;
    flex: 1;
    user-select: none;
  }
`;

export const ProcessButton = styled.button`
  align-self: flex-start;
  margin-top: 1rem;
`;

export const TokenUsageContainer = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  margin-top: ${themeCssVariables.spacing['4']};
  padding: ${themeCssVariables.spacing['4']};
`;

export const TokenUsageSection = styled.div`
  margin-bottom: ${themeCssVariables.spacing['4']};

  &:last-child {
    margin-bottom: 0;
  }
`;

export const TokenUsageTitle = styled.h3`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin: 0 0 ${themeCssVariables.spacing['2']};
`;

export const TokenUsageRow = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.secondary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  justify-content: space-between;
  padding: ${themeCssVariables.spacing['1']} 0;
`;

export const TokenUsageLabel = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
`;

export const TokenUsageValue = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

export const LoadingContainer = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing['2']};
  margin-top: ${themeCssVariables.spacing['3']};
`;

export const SectionGap = styled.div`
  margin-top: ${themeCssVariables.spacing['8']};
`;
