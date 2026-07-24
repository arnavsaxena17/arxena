import styled from '@emotion/styled';

export const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(3)};

  overflow-y: auto;
  padding-right: ${({ theme }) => theme.spacing(1)};
  margin-bottom: ${({ theme }) => theme.spacing(5)};
`;

export const StyledSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-top: ${({ theme }) => theme.spacing(5)};
`;

export const StyledSectionTitle = styled.h4`
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: ${({ theme }) => theme.font.color.primary};
  margin: 0;
`;

export const StyledInput = styled.input`
  padding: ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
  background-color: ${({ theme }) => theme.background.primary};
  width: ${({ theme }) => theme.spacing(20)};
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.color.blue20};
  }
`;

export const StyledTextArea = styled.textarea`
  padding: ${({ theme }) => theme.spacing(2)};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.primary};
  background-color: ${({ theme }) => theme.background.primary};
  min-height: 80px;
  resize: vertical;
  
  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.color.blue20};
  }
`;

export const StyledSelect = styled.select`
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

export const StyledLabel = styled.label`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
`;

export const StyledCheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(1)};
`;

export const StyledCheckbox = styled.input`
  margin: 0;
`;

export const StyledRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
  align-items: center;
  flex-wrap: wrap;
`;

export const StyledRowButton = styled.button`
  padding: ${({ theme }) => theme.spacing(1)} ${({ theme }) => theme.spacing(2)};
  background-color: ${({ theme }) => theme.color.blue10};
  color: ${({ theme }) => theme.color.blue60};
  border: 1px solid ${({ theme }) => theme.color.blue20};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  cursor: pointer;
  &:hover { background-color: ${({ theme }) => theme.color.blue20}; }
`;

export const StyledGeneratedSection = styled.div`
  padding: ${({ theme }) => theme.spacing(2)};
  background-color: ${({ theme }) => theme.color.green10};
  border: 1px solid ${({ theme }) => theme.color.green20};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
`;

export const StyledGeneratedLabel = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.color.green60};
  margin-bottom: ${({ theme }) => theme.spacing(1)};
`;

export const StyledResolvedSection = styled.div`
  padding: ${({ theme }) => theme.spacing(2)};
  background-color: ${({ theme }) => theme.color.blue10};
  border: 1px solid ${({ theme }) => theme.color.blue20};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
`;

export const StyledResolvedLabel = styled.div`
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.color.blue60};
  margin-bottom: ${({ theme }) => theme.spacing(1)};
`;

export const StyledScrollableContent = styled.div`
  flex: 1;
  padding-right: ${({ theme }) => theme.spacing(1)};
  
  /* Custom scrollbar styling */
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.background.secondary};
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.border.color.medium};
    border-radius: 3px;
    
    &:hover {
      background: ${({ theme }) => theme.border.color.strong};
    }
  }
`;

export const StyledButtonContainer = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-bottom: ${({ theme }) => theme.spacing(2)};
`;
