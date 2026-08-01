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
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  align-items: flex-start;
  width: 100%;
  max-width: 100%;
`;

export const StyledInput = styled.input`
  ${sharedInputStyles}
  width: 400px;
  align-self: flex-start;
`;

export const StyledTextArea = styled.textarea`
  ${sharedInputStyles}
  resize: vertical;
  width: 400px;
  align-self: flex-start;
`;

export const StyledSelect = styled.select`
  ${sharedInputStyles}
  width: 400px;
`;

export const FieldsList = styled.div`
  width: 400px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-self: flex-start;
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
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;

export const FieldCard = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  font-family: inherit;
  border-radius: 0.5rem;
  transition: all 0.2s;

  &:hover {
    border-color: ${themeCssVariables.border.color.strong};
  }
`;

export const FieldContent = styled.div`
  flex: 1;
`;

export const FieldHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

export const FieldName = styled.span`
  font-weight: 500;
  color: ${themeCssVariables.font.color.primary};
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
  padding: 1rem;
  background: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;

  form {
    margin: 0;
  }
`;

export const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

export const CodeBlock = styled.div`
  background: ${themeCssVariables.background.primary};
  color: ${themeCssVariables.font.color.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  padding: 1rem;
  border-radius: 0.5rem;
  width: 400px;
  margin-top: 1.5rem;
  align-self: flex-start;

  pre {
    white-space: pre-wrap;
    overflow-x: auto;
  }
`;

export const ErrorAlert = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: ${themeCssVariables.tag.background.red};
  border: 1px solid ${themeCssVariables.border.color.danger};
  border-radius: 0.5rem;
  color: ${themeCssVariables.tag.text.red};
`;

export const ButtonGroup = styled.div`
  display: flex;
  gap: 0.5rem;
`;

export const SelectedFieldsContainer = styled.div`
  margin-top: 1rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  width: 400px;
  max-width: 400px;
  align-self: flex-start;
  overflow-x: auto;
  overflow-y: hidden;
  min-height: 2.5rem;
`;

export const SelectedFieldTag = styled.div`
  background: ${themeCssVariables.background.tertiary};
  color: ${themeCssVariables.font.color.primary};
  padding: 0.5rem;
  border-radius: 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  flex-shrink: 0;
  white-space: nowrap;
  min-width: fit-content;
`;

export const MultiSelect = styled.select`
  ${sharedInputStyles}
  width: 400px;
  height: auto;
  font-family: inherit;
  min-height: 80px;
  multiple: true;
`;

export const SelectLabel = styled.label`
  font-weight: 500;
  margin-bottom: 0.5rem;
  align-self: flex-start;
  display: block;
  color: ${themeCssVariables.font.color.primary};
`;

export const ModelCodeDisplay = styled.div<{ show: boolean }>`
  margin-top: 1.5rem;
  align-self: flex-start;
  opacity: ${(props) => (props.show ? 1 : 0)};
  transition: opacity 0.3s ease-in-out;
`;

export const LoadingIndicator = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  color: ${themeCssVariables.font.color.tertiary};
  font-size: 0.875rem;
`;

export const FieldsLoadingContainer = styled.div`
  width: 400px;
  min-height: 80px;
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const CheckboxFieldsContainer = styled.div`
  width: 400px;
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: 0.5rem;
  max-height: 200px;
  overflow-y: auto;
  padding: 0.5rem;
  align-self: flex-start;
`;

export const CheckboxField = styled.div`
  display: flex;
  align-items: center;
  padding: 0.5rem;
  gap: 0.5rem;
  cursor: pointer;
  transition: background-color 0.2s;
  color: ${themeCssVariables.font.color.primary};

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
  margin-top: 1rem;
  align-self: flex-start;
`;

export const TokenUsageContainer = styled.div`
  margin-top: ${themeCssVariables.spacing['4']};
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
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
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${themeCssVariables.spacing['1']} 0;
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
`;

export const TokenUsageLabel = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
`;

export const TokenUsageValue = styled.span`
  color: ${themeCssVariables.font.color.primary};
  font-weight: ${themeCssVariables.font.weight.medium};
`;

export const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${themeCssVariables.spacing['2']};
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  margin-top: ${themeCssVariables.spacing['3']};
`;

export const SectionGap = styled.div`
  margin-top: ${themeCssVariables.spacing['8']};
`;
