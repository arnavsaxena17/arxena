import styled from '@emotion/styled';

export const StyledBackdrop = styled.div`
  -moz-user-select: none;
  -ms-user-select: none;
  -webkit-user-select: none;
  align-items: center;
  background-color: ${({ theme }) => `${theme.color.gray80}80`};
  display: flex;
  height: 100vh;
  justify-content: center;
  left: 0;
  pointer-events: auto;
  position: fixed;
  top: 0;
  user-select: none;
  width: 100vw;
  z-index: 999;
  isolation: isolate; /* Creates a new stacking context */
`;

export const StyledModalContainer = styled.div`
  align-items: center;
  background-color: transparent;
  display: flex;
  flex-direction: row;
  height: 90vh;
  justify-content: center;
  position: relative;
  width: 80vw;
  z-index: 1000;
`;

export const StyledAdjuster = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  padding: 0 120px;
  justify-content: center;
  align-items: center;
  position: relative;
`;

export const StyledModal = styled.div`
  background-color: ${({ theme }) => theme.background.tertiary};
  box-shadow: ${({ theme }) => theme.boxShadow.superHeavy};
  border-radius: 16px;
  display: flex;
  flex-direction: row;
  height: 100%;
  flex-basis: 900px;
  z-index: 1001;
  overflow: hidden;
  max-height: 90vh;
  box-sizing: border-box;
  position: relative;
  pointer-events: auto;
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  isolation: isolate;

  & * {
    pointer-events: auto !important;
  }

  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.background.tertiary};
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.background.quaternary};
    border-radius: 4px;

    &:hover {
      background: ${({ theme }) => theme.background.tertiary};
    }
  }

  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) =>
    `${theme.background.quaternary} ${theme.background.tertiary}`};
`;

export const StyledScrollableContent = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  flex: 1;
  overflow-y: auto;
  padding-right: 8px;
  min-height: 0;
  max-height: calc(
    90vh - 120px
  ); /* Increased from 160px to allow more content to be visible */
`;

export const StyledModalContent = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  padding: ${({ theme }) => theme.spacing(4)};
  position: relative;
  overflow: hidden;
`;

export const StyledModalHeader = styled.div`
  align-items: center;
  background-color: ${({ theme }) => theme.background.tertiary};
  display: flex;
  flex-shrink: 0;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.spacing(4)};
  z-index: 1;
`;

export const StyledTitle = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

export const StyledBody = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: ${({ theme }) => theme.spacing(2)};
  padding-bottom: ${({ theme }) => theme.spacing(2)};
  overflow-y: auto;
`;

export const StyledFooter = styled.div`
  align-items: center;
  background-color: ${({ theme }) => theme.background.noisy};
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing(3)};
  /* padding: ${({ theme }) => theme.spacing(2)}; */
  width: 100%;
  flex-shrink: 0;
  z-index: 1;
  /* position: sticky; */
  height: 0;
  bottom: 0;
`;

export const StyledDropzoneArea = styled.div`
  align-items: center;
  background-color: ${({ theme }) => theme.background.secondary};
  border: 2px dashed ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
  justify-content: center;
  min-height: 400px;
  padding: ${({ theme }) => theme.spacing(4)};
  width: 100%;

  &:hover {
    background-color: ${({ theme }) => theme.background.tertiary};
    cursor: pointer;
  }
`;

export const StyledParsedContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
  margin-top: ${({ theme }) => theme.spacing(4)};
`;

export const StyledInput = styled.input`
  background-color: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  padding: ${({ theme }) => theme.spacing(2)};
  width: 100%;
`;

export const StyledFieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-bottom: ${({ theme }) => theme.spacing(3)};
`;

export const StyledLabel = styled.label`
  color: ${({ theme }) => theme.font.color.secondary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  margin-bottom: ${({ theme }) => theme.spacing(1)};
`;

export const StyledFormGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing(6)};
  margin-bottom: ${({ theme }) => theme.spacing(4)};
`;

export const StyledFullWidthField = styled(StyledFieldGroup)`
  grid-column: 1 / -1;
  margin-bottom: ${({ theme }) => theme.spacing(6)};
`;

// Section styling components
export const StyledSectionHeader = styled.div`
  align-items: center;
  color: ${({ theme }) => theme.font.color.primary};
  display: flex;
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  margin-bottom: ${({ theme }) => theme.spacing(3)};
`;

export const StyledSectionContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(2)};
  margin-bottom: ${({ theme }) => theme.spacing(4)};
`;

export const StyledSectionDivider = styled.div`
  width: 100%;
  height: 1px;
  background-color: ${({ theme }) => theme.border.color.light};
  margin: ${({ theme }) => theme.spacing(4)} 0;
`;

export const StyledSection = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing(4)};
`;
