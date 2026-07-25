import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledModalContainer = styled.div`
  background-color: solid;
  top: 1vh;
  left: 0vw;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  position: fixed;
  height: 95vh;
  width: 100vw;
  z-index: 9999999;
  pointer-events: none;
`;

const StyledModalBackdrop = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 99999;
  pointer-events: all;
`;

const StyledAdjuster = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  padding: 0 20px;
  justify-content: center;
  align-items: center;
`;

const StyledModal = styled.div`
  background-color: ${themeCssVariables.background.tertiary};
  box-shadow: ${themeCssVariables.boxShadow.superHeavy};
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  height: 100%;
  flex-basis: 1400px;
  z-index: 2001;
  overflow: hidden;
  max-height: 900px;
  box-sizing: border-box;
  position: relative;
  pointer-events: auto;

  & * {
    pointer-events: auto;
  }

  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: ${themeCssVariables.background.tertiary};
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb {
    background: ${themeCssVariables.background.quaternary || '#888'};
    border-radius: 4px;
    
    &:hover {
      background: ${themeCssVariables.background.noisy || '#666'};
    }
  }

  scrollbar-width: thin;
  scrollbar-color: ${`${themeCssVariables.background.quaternary || '#888'} ${themeCssVariables.background.tertiary}`};
`;

const StyledContent = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  position: relative;
`;

type ModalContainerProps = {
  children: React.ReactNode;
  onBackdropClick: () => void;
  onModalClick: (e: React.MouseEvent) => void;
};

export const ModalContainer = ({ children, onBackdropClick, onModalClick }: ModalContainerProps) => {
  return (
    <>
      <StyledModalBackdrop onClick={onBackdropClick} />
      <StyledModalContainer>
        <StyledAdjuster>
          <StyledModal onClick={onModalClick}>
            <StyledContent>
              {children}
            </StyledContent>
          </StyledModal>
        </StyledAdjuster>
      </StyledModalContainer>
    </>
  );
};
