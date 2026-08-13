import React from 'react';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledControlsOverlay = styled.div`
  align-items: center;
  background-color: rgba(0, 0, 0, 0.5);
  border-radius: 20px;
  bottom: 20px;
  color: white;
  cursor: pointer;
  display: flex;
  font-size: 14px;
  justify-content: center;
  left: 50%;
  padding: 10px 20px;
  position: absolute;
  transform: translateX(-50%);
  white-space: nowrap;
  z-index: 10;
  
  @media (max-width: 768px) {
    width: 80%;
    flex-direction: column;
    padding: 15px;
  }
`;

interface StyledRecordButtonProps {
  isRecording: boolean;
}

const StyledRecordButton = styled.button<StyledRecordButtonProps>`
  align-items: center;
  background-color: ${props => (props.isRecording ? '#ff4136' : '#4285f4')};
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  height: 40px;
  justify-content: center;
  margin-right: 10px;
  width: 40px;

  @media (max-width: 768px) {
    margin-right: 0;
    margin-bottom: 10px;
  }
`;

const ButtonText = styled.span`
  @media (max-width: 768px) {
    text-align: center;
  }
`;

export const RecordIcon = () => <StyledIcon style={{ borderRadius: '50%' }} />;

export const StopIcon = () => <StyledIcon style={{ width: '14px', height: '14px' }} />;
export const StyledIcon = styled.div`
  background-color: white;
  height: 20px;
  width: 20px;
`;
interface ControlsOverlayProps {
  isRecording: boolean;
  onClick: () => void;
}

const ControlsOverlay: React.FC<ControlsOverlayProps> = ({ isRecording, onClick }) => (
  <StyledControlsOverlay onClick={onClick}>
    <StyledRecordButton isRecording={isRecording}>
      {isRecording ? <StopIcon /> : <RecordIcon />}
    </StyledRecordButton>
    <ButtonText>
      {isRecording ? 'Stop Recording and Submit' : 'Click to record your response'}
    </ButtonText>
  </StyledControlsOverlay>
);

export default ControlsOverlay;