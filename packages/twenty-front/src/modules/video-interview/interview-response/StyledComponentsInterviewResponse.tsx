import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

export const StyledContainer = styled.div`
  background-color: ${themeCssVariables.background.primary};
  display: flex;
  flex-direction: column;
  max-width: 100%;
  min-height: 100%;
  overflow-x: hidden;
  @media (min-width: 768px) {
    flex-direction: row;
  }
`;
export const EndInterviewStyledContainer = styled.div`
  background-color: ${themeCssVariables.background.primary};
  display: flex;
  flex-direction: column;
  max-width: 100%;
  min-height: 100%;
  overflow-x: hidden;
  @media (min-width: 768px) {
    flex-direction: row;
  }
`;
export const SnapScrollContainer = styled.div`
  height: 100vh;
  overflow-y: scroll;
  scroll-snap-type: y mandatory;

  @media (min-width: 768px) {
    display: flex;
    overflow-y: visible;
    height: auto;
  }

  @media (max-width: 767px) {
    flex-direction: column;
    height: auto;
    width: 100%;
  }
`;
export const StyledLeftPanel = styled.div`
  background-color: ${themeCssVariables.background.secondary};
  color: ${themeCssVariables.font.color.secondary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.regular};
  padding: 16px;
  width: 30%;

  @media (max-width: 767px) {
    width: 90%;
    padding: 16px;
    font-size: ${themeCssVariables.font.size.sm};
  }
`;
export const StartInterviewStyledLeftPanel = styled.div`
  background-color: ${themeCssVariables.background.secondary};
  color: ${themeCssVariables.font.color.secondary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.regular};
  padding: 16px;
  width: 30%;

  @media (max-width: 767px) {
    width: 90%;
    padding: 16px;
    font-size: ${themeCssVariables.font.size.sm};
  }
`;

export const EndInterviewStyledLeftPanel = styled.div`
  background-color: ${themeCssVariables.background.secondary};
  color: ${themeCssVariables.font.color.secondary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.regular};
  height: 100vh;
  padding: 16px;
  width: 30%;

  @media (max-width: 767px) {
    width: 90%;
    height: auto;
    padding: 16px;
    font-size: ${themeCssVariables.font.size.sm};
  }
`;

export const StyledAnswerTimer = styled.div`
  background-color: rgba(0, 0, 0, 0.5);
  border-radius: 15px;
  color: white;
  font-size: 14px;
  font-weight: 600;
  padding: 5px 10px;
  position: absolute;
  right: 10px;
  top: 10px;
  z-index: 20;

  @media (max-width: 768px) {
    top: 5px;
    right: 5px;
    font-size: 12px;
    padding: 3px 8px;
  }
`;

export const StyledControlsOverlay = styled.div`
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
    padding: 10px;
    bottom: 10px;
  }
`;

interface StyledRecordButtonProps {
  isRecording: boolean;
}

export const StyledRecordButton = styled.button<StyledRecordButtonProps>`
  align-items: center;
  background-color: ${(props) => (props.isRecording ? '#ff4136' : '#4285f4')};
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
    margin-bottom: 5px;
  }
`;

export const ButtonText = styled.span`
  @media (max-width: 768px) {
    text-align: center;
    font-size: 12px;
  }
`;

export const ButtonContainer = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 24px;
`;

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

export const StyledButton = styled.button`
  background-color: #4285f4;
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  max-width: 250px;
  padding: 10px 16px;
  transition: background-color 0.3s ease;
  width: 100%;

  &:hover {
    background-color: #3367d6;
  }

  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }

  @media (min-width: 768px) {
    padding: 12px 24px;
    font-size: 16px;
    max-width: 300px;
  }
`;

export const AccessMessage = styled.p`
  color: #4caf50;
  font-weight: 600;
  margin: 16px 0;
`;

export const StyledLeftPanelContentBox = styled.div`
  align-items: flex-start;
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;

  @media (max-width: 767px) {
    gap: 8px;
  }
`;

export const StyledTextLeftPanelTextHeadline = styled.div`
  align-items: flex-start;
  align-self: stretch;
  border-left: 2px solid #999;
  display: flex;
  font-size: 16px;
  font-weight: 600;
  gap: 4px;
  padding: 4px 8px;

  @media (max-width: 767px) {
    font-size: 14px;
    padding: 2px 6px;
  }
`;

export const FeedbackContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 80%;
`;

export const StyledTextArea = styled.textarea`
  border: 1px solid #ccc;
  border-radius: 8px;
  font-family: ${themeCssVariables.font.family};
  font-size: 16px;
  height: 150px;
  padding: 12px;
  resize: vertical;
  width: 100%;
  &:focus {
    border-color: #4285f4;
    box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.2);
    outline: none;
  }
`;

export const SubmitButton = styled.button`
  align-self: flex-start;
  background-color: #4285f4;
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  padding: 12px 24px;
  transition: background-color 0.3s ease;

  &:hover {
    background-color: #3367d6;
  }
`;

// export const ThankYouMessage = styled.h1`
//   font-size: 24px;
//   font-weight: 600;
//   color: #333;
//   margin-bottom: 20px;
// `;

export const FeedbackPrompt = styled.p`
  color: #666;
  font-size: 16px;
  margin-bottom: 20px;
`;

export const StyledTextLeftPaneldisplay = styled.div`
  color: #808080;
  font-size: ${themeCssVariables.font.size.md};
  line-height: 150%;

  @media (max-width: 767px) {
    font-size: ${themeCssVariables.font.size.sm};
    line-height: 140%;
  }
`;

export const InstructionSection = styled.div`
  margin-bottom: 16px;
`;

export const InstructionList = styled.ol`
  font-size: 12px;
  margin: 8px 0;
  padding-left: 20px;

  @media (min-width: 768px) {
    font-size: 14px;
    margin: 12px 0;
  }
`;

export const PageTitle = styled.h1`
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 12px;

  @media (min-width: 768px) {
    font-size: 24px;
    margin-bottom: 16px;
  }
`;

export const SubTitle = styled.h2`
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 8px;

  @media (min-width: 768px) {
    font-size: 18px;
    margin-bottom: 12px;
  }
`;

export const StyledRightPanel = styled.div`
  background-color: ${themeCssVariables.background.primary};
  color: #808080;
  display: flex;
  flex-direction: column;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.md};
  font-style: normal;
  font-weight: 400;
  gap: 16px;
  height: 100vh;
  line-height: 150%;
  padding: 16px;
  width: 70%;

  @media (max-width: 767px) {
    width: 93%;
    padding: 16px;
    font-size: ${themeCssVariables.font.size.sm};
    gap: 12px;
  }
`;
export const StartInterviewStyledRightPanel = styled.div`
  background-color: ${themeCssVariables.background.primary};
  color: #808080;
  display: flex;
  flex-direction: column;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.md};
  font-style: normal;
  font-weight: 400;
  gap: 16px;
  height: 100vh;
  line-height: 150%;
  padding: 16px;
  width: 70%;

  @media (max-width: 767px) {
    width: 93%;
    padding: 16px;
    font-size: ${themeCssVariables.font.size.sm};
    gap: 12px;
  }
`;
export const EndInterviewStyledRightPanel = styled.div`
  background-color: ${themeCssVariables.background.primary};
  color: #808080;
  display: flex;
  flex-direction: column;
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.md};
  font-style: normal;
  font-weight: 400;
  gap: 16px;
  line-height: 150%;
  padding: 16px;
  width: 70%;

  @media (max-width: 767px) {
    width: 93%;
    height: 100vh;
    padding: 16px;
    font-size: ${themeCssVariables.font.size.sm};
    gap: 12px;
  }
`;

export const StyledVideoContainer = styled.div`
  background-color: ${themeCssVariables.background.secondary};
  border-radius: 30px;
  margin-bottom: 20px;
  overflow: hidden;

  padding-top: 56.25%;
  position: relative;
  width: 100%; // 16:9 aspect ratio

  video,
  .react-webcam {
    height: 100%;
    left: 0;
    object-fit: cover;
    position: absolute;
    top: 0;
    width: 100%;
  }

  @media (max-width: 767px) {
    border-radius: 15px;
    margin-bottom: 10px;
    height: 45vh;
  }
`;

export const StyledMessage = styled.div`
  background-color: #e8f5e9;
  border-radius: 4px;
  font-size: ${themeCssVariables.font.size.md};
  margin-top: 20px;
  padding: 10px;
  text-align: center;
`;

export const StyledTimer = styled.div`
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin-top: 20px;
  text-align: center;
`;

export const StyledError = styled.div`
  background-color: black;
  border-radius: 4px;
  color: white;
  font-size: ${themeCssVariables.font.size.md};
  margin-top: 20px;
  padding: 10px;
`;

export const StyledCountdownOverlay = styled.div`
  align-items: center;
  background-color: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  color: white;
  display: flex;
  font-size: 72px;
  height: 120px;
  justify-content: center;
  left: 50%;
  padding: 20px;
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 120px;
  z-index: 20;
`;
