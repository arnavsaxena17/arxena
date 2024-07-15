import styled from '@emotion/styled';

import { H2Title } from '@/ui/display/typography/components/H2Title';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: min-content;
`;

const StyledTextArea = styled.textarea`
  background-color: ${({ theme }) => theme.background.transparent.lighter};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  box-sizing: border-box;
  color: ${({ theme }) => theme.font.color.primary};
  font-family: inherit;
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.regular};
  line-height: 16px;
  overflow: auto;
  padding: ${({ theme }) => theme.spacing(2)};
  padding-top: ${({ theme }) => theme.spacing(3)};
  resize: none;
  width: 100%;
  height: min-content;

  &:focus {
    outline: none;
  }

  &::placeholder {
    color: ${({ theme }) => theme.font.color.light};
    font-weight: ${({ theme }) => theme.font.weight.regular};
  }

  &:disabled {
    color: ${({ theme }) => theme.font.color.tertiary};
  }
`;

export const AdditionalInformation = () => {
  return (
    <StyledContainer>
      <H2Title title="Introduction" />
      <StyledTextArea
        placeholder={'Additional Information...'}
        rows={4}
        name="newAIInterview[0][introduction]"
      />
    </StyledContainer>
  );
};
