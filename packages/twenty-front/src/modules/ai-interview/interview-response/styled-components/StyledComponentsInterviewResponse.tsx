
import styled from '@emotion/styled';


export const StyledContainer = styled.div`
  display: flex;
  height: 100vh;
  width:100vw;
  background-color: ${({ theme }) => theme.background.tertiary};
`;


export const StyledLeftPanelContentBox = styled.div`
display: flex;
flex-direction: column;
align-items: flex-start;
gap: 24px;
flex: 1 0 0;
align-self: stretch;
box-sizing: border-box
padding: 44px 32px;
`

export const StyledTextLeftPanelTextHeadline = styled.div`
display: flex;
padding: var(--Spacing-4px, 4px) 12px;
align-items: flex-start;
gap: 6px;
align-self: stretch;
border-left: var(--Spacing-2px, 2px) solid #999;
`

export const StyledTextLeftPanelVideoPane = styled.div`
height: 300px;
align-self: stretch;
border-radius: 16px;
background: var(--John, url(/videos/Video.png) lightgray 50% / cover no-repeat);
`
export const FeedbackContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

export const StyledTextArea = styled.textarea`
  width: 100%;
  height: 150px;
  padding: 12px;
  border: 1px solid #ccc;
  border-radius: 8px;
  font-family: 'Inter', sans-serif;
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

export const ThankYouMessage = styled.h1`
  font-size: 24px;
  font-weight: 600;
  color: #333;
  margin-bottom: 20px;
`;

export const FeedbackPrompt = styled.p`
  font-size: 16px;
  color: #666;
  margin-bottom: 20px;
`;


export const StyledTextLeftPaneldisplay = styled.div`
color: #808080;
leading-trim: both;
text-edge: cap;
font-family: Inter;
font-size: 14px;
font-style: normal;
font-weight: 600;
line-height: 150%`


export const InstructionSection = styled.div`
  margin-bottom: 15px;
`;

export const InstructionList = styled.ol`
  padding-left: 20px;
  margin: 5px 0;
`;


export const TermsLink = styled.a`
  color: blue;
  text-decoration: underline;
  margin-bottom: 10px;
  display: inline-block;
`;

export const StyledTextLeftPanelHeadline = styled.div`
color: #333;
font-family: Inter;
font-size: 24px;
font-style: normal;
font-weight: 600;
line-height: 120%;`

export const StyledLeftPanel = styled.div`
  width: calc(100% * (1 / 3));
  min-width: 224px;
  padding: 44px 32px;
  color: ${({ theme }) => theme.font.color.secondary};
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;


export const StyledRightPanel = styled.div`
  width: calc(100% * (2 / 3));
  min-width: 264px;
  padding: 44px 32px;
  background-color: ${({ theme }) => theme.background.primary};
  display: flex;
  flex-direction: column;
  gap: 44px;
  color: #808080;
leading-trim: both;
text-edge: cap;
font-family: Inter;
font-size: 16px;
font-style: normal;
font-weight: 600;
line-height: 150%; /* 24px */
`;
// const StyledRightPanel = styled.div`
//   width: calc(100% * (2 / 3));
//   min-width: 264px;
//   padding: 44px 32px;
//   background-color: ${({ theme }) => theme.background.primary};
//   display: flex;
//   flex-direction: column;
//   gap: 44px;
// `;


// export const StyledButton = styled.button`
//   padding: 10px 20px;
//   background-color: #4285f4;
//   color: white;
//   border: none;
//   border-radius: 4px;
//   cursor: pointer;
//   font-size: ${({ theme }) => theme.font.size.md};
// `;

export const StyledButtonCameraAccess = styled.button`
  padding: 10px 20px;
  background-color: #4285f4;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  width: 10%;
  font-size: ${({ theme }) => theme.font.size.md};
`;

export const AccessMessage = styled.p`
      color: green;
    padding: 10px 20px;

    width: 10%;


`;

export const StyledButton = styled.button`
  padding: 10px 20px;
  background-color: #4285f4;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  width: 10%;
  font-size: ${({ theme }) => theme.font.size.md};
`;



export const StyledVideoContainer = styled.div`
  background-color: black;
  height: 60%;
  margin-bottom: 20px;
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





export const StyledRecordButton = styled.button<{ isRecording: boolean }>`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: ${props => (props.isRecording ? '#ff4136' : '#4285f4')};
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 10px;
`;
export const StyledIcon = styled.div`
  width: 20px;
  height: 20px;
  background-color: white;
`;

export const RecordIcon = () => <StyledIcon style={{ borderRadius: '50%' }} />;

export const StopIcon = () => <StyledIcon style={{ width: '14px', height: '14px' }} />;

export const StyledControlsOverlay = styled.div`
  position: absolute;
  bottom: 20%;
  left: 66%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.5);
  border-radius: 20px;
  padding: 10px;
  cursor: pointer;
  color: white;
`;

export const StyledAnswerTimer = styled.div`
  position: absolute;
  bottom: 15%;
  right: 31%;
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: white;
  background-color: rgba(0, 0, 0, 0.5);
  padding: 10px;
  border-radius: 5px;
`;

export const StyledCountdownOverlay = styled.div`
  position: absolute;
  top: 45%;
  left: 66.5%;
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
`;

// const StyledRightPanel = styled.div`
//   width: calc(100% * (2 / 3));
//   min-width: 264px;
//   padding: 44px 32px;
//   background-color: ${({ theme }) => theme.background.primary};
//   display: flex;
//   flex-direction: column;
//   gap: 44px;
// `;

// const StyledButton = styled.button`
//   padding: 10px 20px;
//   background-color: #4285f4;
//   color: white;
//   border: none;
//   border-radius: 4px;
//   cursor: pointer;
//   font-size: ${({ theme }) => theme.font.size.md};
// `;
