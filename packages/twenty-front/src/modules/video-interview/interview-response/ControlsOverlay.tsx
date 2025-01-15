import React from 'react';
import styled from '@emotion/styled';

const StyledControlsOverlay = styled.div`
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.5);
  border-radius: 20px;
  padding: 10px 20px;
  cursor: pointer;
  color: white;
  z-index: 10;
  white-space: nowrap;
  font-size: 14px;
  
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
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: ${props => (props.isRecording ? '#ff4136' : '#4285f4')};
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 10px;

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
  width: 20px;
  height: 20px;
  background-color: white;
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