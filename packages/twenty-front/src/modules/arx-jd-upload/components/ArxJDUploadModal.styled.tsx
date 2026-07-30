import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

export const StyledBackdrop = styled.div`
  -moz-user-select: none;
  -ms-user-select: none;
  -webkit-user-select: none;
  align-items: center;
  background-color: ${themeCssVariables.color.gray8}80;
  display: flex;
  height: 100vh;
  justify-content: center;
  left: 0;
  padding: ${themeCssVariables.spacing[6]};
  pointer-events: auto;
  position: fixed;
  top: 0;
  width: 100vw;
  z-index: 2000;
  isolation: isolate;
`;

export const StyledModalContainer = styled.div`
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  position: relative;
  width: 100%;
  z-index: 2001;
`;

export const StyledAdjuster = styled.div`
  align-items: center;
  display: flex;
  justify-content: center;
  max-height: 100%;
  max-width: 900px;
  position: relative;
  width: min(900px, 100%);
`;

export const StyledModal = styled.div`
  background-color: ${themeCssVariables.background.tertiary};
  border-radius: 16px;
  box-shadow: ${themeCssVariables.boxShadow.superHeavy};
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  isolation: isolate;
  max-height: 90vh;
  overflow: hidden;
  pointer-events: auto;
  position: relative;
  user-select: text;
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  width: 100%;
  z-index: 2002;

  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: ${themeCssVariables.background.tertiary};
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb {
    background: ${themeCssVariables.background.quaternary};
    border-radius: 4px;

    &:hover {
      background: ${themeCssVariables.background.tertiary};
    }
  }

  scrollbar-width: thin;
  scrollbar-color: ${themeCssVariables.background.quaternary}
    ${themeCssVariables.background.tertiary};
`;

export const StyledScrollableContent = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  width: 100%;
`;

export const StyledModalContent = styled.div`
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  overflow: hidden;
  padding: ${themeCssVariables.spacing[5]};
  position: relative;
  width: 100%;
`;

export const StyledModalHeader = styled.div`
  align-items: center;
  background-color: ${themeCssVariables.background.tertiary};
  display: flex;
  flex-shrink: 0;
  justify-content: space-between;
  margin-bottom: ${themeCssVariables.spacing[4]};
  z-index: 1;
`;

export const StyledTitle = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.semiBold};
`;

export const StyledBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
  min-height: 0;
  width: 100%;
`;

export const StyledFooter = styled.div`
  align-items: center;
  background-color: ${themeCssVariables.background.noisy};
  border-top: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  flex-shrink: 0;
  gap: ${themeCssVariables.spacing[3]};
  justify-content: flex-end;
  margin-top: ${themeCssVariables.spacing[4]};
  padding-top: ${themeCssVariables.spacing[3]};
  width: 100%;
  z-index: 1;
`;

export const StyledDropzoneArea = styled.div`
  align-items: center;
  background-color: ${themeCssVariables.background.secondary};
  border: 2px dashed ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
  justify-content: center;
  min-height: 160px;
  padding: ${themeCssVariables.spacing[6]};
  text-align: center;
  width: 100%;

  &:hover {
    background-color: ${themeCssVariables.background.transparent.light};
    cursor: pointer;
  }
`;

export const StyledParsedContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  margin-top: ${themeCssVariables.spacing[4]};
`;

export const StyledInput = styled.input`
  background-color: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  padding: ${themeCssVariables.spacing[2]};
  width: 100%;
`;

export const StyledFieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  margin-bottom: ${themeCssVariables.spacing[3]};
`;

export const StyledLabel = styled.label`
  color: ${themeCssVariables.font.color.secondary};
  font-size: ${themeCssVariables.font.size.sm};
  font-weight: ${themeCssVariables.font.weight.medium};
  margin-bottom: ${themeCssVariables.spacing[1]};
`;

export const StyledFormGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${themeCssVariables.spacing[6]};
  margin-bottom: ${themeCssVariables.spacing[4]};
`;

export const StyledFullWidthField = styled(StyledFieldGroup)`
  grid-column: 1 / -1;
  margin-bottom: ${themeCssVariables.spacing[6]};
`;

export const StyledSectionHeader = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.primary};
  display: flex;
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.medium};
  margin-bottom: ${themeCssVariables.spacing[3]};
`;

export const StyledSectionContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[2]};
  margin-bottom: ${themeCssVariables.spacing[0]};
`;

export const StyledSectionDivider = styled.div`
  width: 100%;
  height: 1px;
  background-color: ${themeCssVariables.border.color.light};
  margin: ${themeCssVariables.spacing[4]} 0;
`;

export const StyledSection = styled.div`
  margin-bottom: ${themeCssVariables.spacing[10]};
`;

export const StyledRemoveButton = styled.button`
  background-color: transparent;
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  color: ${themeCssVariables.color.gray5};
  cursor: pointer;
  font-size: ${themeCssVariables.font.size.sm};
  padding: ${themeCssVariables.spacing[1]} ${themeCssVariables.spacing[2]};
  transition: all 0.1s ease-in-out;

  &:hover {
    background-color: ${themeCssVariables.background.transparent.light};
    color: ${themeCssVariables.color.gray6};
  }
`;
