
import styled from '@emotion/styled';


export const StyledContainer = styled.div`
  display: flex;
  height: 100vh;
  width:100vw;
  background-color: ${({ theme }) => theme.background.tertiary};
`;

// const StyledContainer = styled.div`
//   display: flex;
//   height: 100vh;
//   background-color: ${({ theme }) => theme.background.tertiary};
// `;

// export const StyledLeftPanel = styled.div`
//   width: calc(100% * (1 / 3));
//   max-width: 300px;
//   min-width: 224px;
//   padding: 44px 32px;
//   color: ${({ theme }) => theme.font.color.secondary};
//   font-family: ${({ theme }) => theme.font.family};
//   font-size: ${({ theme }) => theme.font.size.lg};
//   font-weight: ${({ theme }) => theme.font.weight.semiBold};
// `;



export const StyledTextLeftPanel = styled.div`
color: #333;
font-family: Inter;
font-size: 24px;
font-style: normal;
font-weight: 600;
line-height: 120%;`

export const StyledLeftPanel = styled.div`
  width: calc(100% * (1 / 3));
  max-width: 300px;
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

export const StyledButton = styled.button`
  padding: 10px 20px;
  background-color: #4285f4;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: ${({ theme }) => theme.font.size.md};
`;



export const StyledAnswerTimer = styled.div`
  position: absolute;
  bottom: 20px;
  right: 20px;
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  color: white;
  background-color: rgba(0, 0, 0, 0.5);
  padding: 10px;
  border-radius: 5px;
`;



export const StyledCountdownOverlay = styled.div`
  position: absolute;
  top: 40%;
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
