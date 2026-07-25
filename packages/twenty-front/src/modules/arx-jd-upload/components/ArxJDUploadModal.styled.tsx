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
  pointer-events: auto;
  position: fixed;
  top: 0;
  width: 100vw;
  z-index: 2000;
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
  z-index: 2001;
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
  background-color: ${themeCssVariables.background.tertiary};
  box-shadow: ${themeCssVariables.boxShadow.superHeavy};
  border-radius: 16px;
  display: flex;
  flex-direction: row;
  height: 100%;
  flex-basis: 900px;
  z-index: 2002;
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

  /* Removed global pointer-events override that was interfering with button clicks */

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
  padding: ${themeCssVariables.spacing[4]};
  position: relative;
  overflow: hidden;
`;

export const StyledModalHeader = styled.div`
  align-items: center;
  background-color: ${themeCssVariables.background.tertiary};
  display: flex;
  flex-shrink: 0;
  justify-content: space-between;
  margin-top: ${themeCssVariables.spacing[4]};
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
  flex: 1;
  gap: ${themeCssVariables.spacing[2]};
  padding-bottom: ${themeCssVariables.spacing[2]};
  overflow-y: auto;
`;

export const StyledFooter = styled.div`
  align-items: center;
  background-color: ${themeCssVariables.background.noisy};
  border-top: 1px solid ${themeCssVariables.border.color.light};
  display: flex;
  justify-content: flex-end;
  gap: ${themeCssVariables.spacing[3]};
  /* padding: ${themeCssVariables.spacing[2]}; */
  width: 100%;
  flex-shrink: 0;
  z-index: 1;
  /* position: sticky; */
  height: 0;
  bottom: 0;
`;

export const StyledDropzoneArea = styled.div`
  align-items: center;
  background-color: ${themeCssVariables.background.secondary};
  border: 2px dashed ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  justify-content: center;
  min-height: 80%;
  padding: ${themeCssVariables.spacing[4]};
  width: 95%;
  &:hover {
    background-color: ${themeCssVariables.background.tertiary};
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

// Section styling components
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
