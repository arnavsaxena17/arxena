
import styled from '@emotion/styled';

export const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  // background-color: ${({ theme }) => theme.background.tertiary};
  max-width: 100%;
  overflow-x: hidden;
  min-height: 100%;
  background-color: white;
  @media (min-width: 768px) {
    flex-direction: row;
    
  }
`;
export const EndInterviewStyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  // background-color: ${({ theme }) => theme.background.tertiary};
  max-width: 100%;
  overflow-x: hidden;
  min-height: 100%;
  background-color: white;
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
    width:100%
    
  }
`;
export const StyledLeftPanel = styled.div`
  width: 30%;
  padding: 16px;
  background-color: ${({ theme }) => theme.background.secondary};
  color: ${({ theme }) => theme.font.color.secondary};
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.regular};

  @media (max-width: 767px) {
    width: 90%;
    padding: 16px;
    font-size: ${({ theme }) => theme.font.size.sm};
  }
`;
export const StartInterviewStyledLeftPanel = styled.div`
  width: 30%;
  padding: 16px;
  background-color: ${({ theme }) => theme.background.secondary};
  color: ${({ theme }) => theme.font.color.secondary};
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.regular};

  @media (max-width: 767px) {
    width: 90%;
    padding: 16px;
    font-size: ${({ theme }) => theme.font.size.sm};
  }
`;


export const EndInterviewStyledLeftPanel = styled.div`
  width: 30%;
  padding: 16px;
  background-color: ${({ theme }) => theme.background.secondary};
  color: ${({ theme }) => theme.font.color.secondary};
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.regular};
  height:100vh;

  @media (max-width: 767px) {
    width: 90%;
    height:auto;
    padding: 16px;
    font-size: ${({ theme }) => theme.font.size.sm};
  }
`;



export const StyledAnswerTimer = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 14px;
  font-weight: 600;
  color: white;
  background-color: rgba(0, 0, 0, 0.5);
  padding: 5px 10px;
  border-radius: 15px;
  z-index: 20;

  @media (max-width: 768px) {
    top: 5px;
    right: 5px;
    font-size: 12px;
    padding: 3px 8px;
  }
`;

export const StyledControlsOverlay = styled.div`
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
    padding: 10px;
    bottom: 10px;
  }
`;

interface StyledRecordButtonProps {
  isRecording: boolean;
}


export const StyledRecordButton = styled.button<StyledRecordButtonProps>`
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
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  margin-top: 24px;
`;


// Styled components remain the same
export const StyledVideoPane = styled.div`
  height: 300px;
  align-self: stretch;
  border-radius: 16px;
  overflow: hidden;
  position: relative;
`;

export const StyledVideo = styled.video`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

export const StyledVideoControls = styled.div`
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 10px;
`;

export const StyledVideoButton = styled.button`
  background-color: rgba(255, 255, 255, 0.7);
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  &:hover {
    background-color: rgba(255, 255, 255, 0.9);
  }
`;

export const StyledLoadingMessage = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: white;
  background-color: rgba(0, 0, 0, 0.5);
  padding: 10px;
  border-radius: 5px;
`;



export const StyledButton = styled.button`
  padding: 10px 16px;
  background-color: #4285f4;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  width: 100%;
  max-width: 250px;
  transition: background-color 0.3s ease;

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
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  width: 100%;

  @media (max-width: 767px) {
    gap: 8px;
  }
`;



export const StyledTextLeftPanelTextHeadline = styled.div`
  display: flex;
  padding: 4px 8px;
  align-items: flex-start;
  gap: 4px;
  align-self: stretch;
  border-left: 2px solid #999;
  font-size: 16px;
  font-weight: 600;

  @media (max-width: 767px) {
    font-size: 14px;
    padding: 2px 6px;
  }
`;

export const FeedbackContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
  width:80%
`;

export const StyledTextArea = styled.textarea`
  width: 100%;
  height: 150px;
  padding: 12px;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-family: ${({ theme }) => theme.font.family};
  font-size: 16px;
  resize: vertical;
  &:focus {
    outline: none;
    border-color: #4285f4;
    box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.2);
  }
`;

export const SubmitButton = styled.button`
  background-color: #4285f4;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.3s ease;
  align-self: flex-start;

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
  font-size: 16px;
  color: #666;
  margin-bottom: 20px;
`;


export const StyledTextLeftPaneldisplay = styled.div`
  color: #808080;
  font-size: ${({ theme }) => theme.font.size.md};
  line-height: 150%;

  @media (max-width: 767px) {
    font-size: ${({ theme }) => theme.font.size.sm};
    line-height: 140%;
  }
`;

export const InstructionSection = styled.div`
  margin-bottom: 16px;
`;

export const InstructionList = styled.ol`
  padding-left: 20px;
  margin: 8px 0;
  font-size: 12px;

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
  width: 70%;
  padding: 16px;
  background-color: ${({ theme }) => theme.background.primary};
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: #808080;
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.md};
  font-style: normal;
  font-weight: 400;
  line-height: 150%;
  height:100vh;

  @media (max-width: 767px) {
    width: 93%;
    padding: 16px;
    font-size: ${({ theme }) => theme.font.size.sm};
    gap: 12px;
  }
`;
export const StartInterviewStyledRightPanel = styled.div`
  width: 70%;
  padding: 16px;
  background-color: ${({ theme }) => theme.background.primary};
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: #808080;
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.md};
  font-style: normal;
  font-weight: 400;
  line-height: 150%;
  height:100vh;

  @media (max-width: 767px) {
    width: 93%;
    padding: 16px;
    font-size: ${({ theme }) => theme.font.size.sm};
    gap: 12px;
  }
`;
export const EndInterviewStyledRightPanel = styled.div`
  width: 70%;
  padding: 16px;
  background-color: ${({ theme }) => theme.background.primary};
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: #808080;
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.md};
  font-style: normal;
  font-weight: 400;
  line-height: 150%;

  @media (max-width: 767px) {
    width: 93%;
    height:100vh;
    padding: 16px;
    font-size: ${({ theme }) => theme.font.size.sm};
    gap: 12px;
  }
`;


export const StyledVideoContainer = styled.div`
  position: relative;
  background-color: white;
  border-radius: 30px;
  margin-bottom: 20px;

  overflow: hidden;
  width: 100%;
  padding-top: 56.25%; // 16:9 aspect ratio

  video, .react-webcam {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  @media (max-width: 767px) {
    border-radius: 15px;
    margin-bottom: 10px;
    height: 45vh;
  }
`;



export const StyledMessage = styled.div`
  margin-top: 20px;
  padding: 10px;
  background-color: #e8f5e9;
  border-radius: 4px;
  font-size: ${({ theme }) => theme.font.size.md};
  text-align: center;
`;


export const StyledTimer = styled.div`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  margin-top: 20px;
  text-align: center;
`;

export const StyledError = styled.div`
  margin-top: 20px;
  padding: 10px;
  background-color: #ffcdd2;
  border-radius: 4px;
  font-size: ${({ theme }) => theme.font.size.md};
`;

export const StyledCountdownOverlay = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 72px;
  color: white;
  background-color: rgba(0, 0, 0, 0.5);
  padding: 20px;
  border-radius: 50%;
  width: 120px;
  height: 120px;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 20;
`;
