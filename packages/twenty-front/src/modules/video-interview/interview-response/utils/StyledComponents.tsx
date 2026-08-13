import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';


// Styled components remain the same
export const StyledVideoPane = styled.div`
  align-self: stretch;
  border-radius: 16px;
  height: 300px;
  overflow: hidden;
  position: relative;
`;

export const StyledVideo = styled.video`
  height: 100%;
  object-fit: cover;
  width: 100%;
`;

export const StyledVideoControls = styled.div`
  bottom: 10px;
  display: flex;
  gap: 10px;
  left: 50%;
  position: absolute;
  transform: translateX(-50%);
`;

export const StyledVideoButton = styled.button`
  align-items: center;
  background-color: rgba(255, 255, 255, 0.7);
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  height: 40px;
  justify-content: center;
  width: 40px;
  &:hover {
    background-color: rgba(255, 255, 255, 0.9);
  }
`;

export const StyledLoadingMessage = styled.div`
  background-color: rgba(0, 0, 0, 0.5);
  border-radius: 5px;
  color: white;
  left: 50%;
  padding: 10px;
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
`;