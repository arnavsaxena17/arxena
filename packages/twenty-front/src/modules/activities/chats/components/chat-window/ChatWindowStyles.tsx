import styled from "@emotion/styled";


export const StyledButton = styled.button<{ bgColor: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${(props) => props.bgColor};
  color: white;
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  cursor: pointer;
  transition: background-color 0.3s ease;
  position: relative;

  &:hover {
    filter: brightness(90%);
  }

  &::after {
    content: attr(data-tooltip);
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    background-color: #333;
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
    white-space: nowrap;
  }
  &:hover::after {
    opacity: 1;
  }
`;
// export const TopbarContainer = styled.div`
//   background-color: #f3f4f6;
//   padding: 8px;
//   border-radius: 4px;
//   box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
//   width: 100%;

//   @media (max-width: 1024px) {
//     padding: 6px;
//   }

//   @media (max-width: 768px) {
//     padding: 4px;
//   }
// `;

export const FieldsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 14px;

  @media (max-width: 1024px) {
    gap: 12px;
    font-size: 13px;
  }

  @media (max-width: 768px) {
    gap: 8px;
    font-size: 12px;
  }
`;

export const AdditionalInfoAndButtons = styled.div`
  align-items: center;
  display: flex;
  gap: 24px;
  justify-content: space-between;

  @media (max-width: 1024px) {
    gap: 16px;
  }

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    width: 100%;
  }
`;

export const AdditionalInfo = styled.div`
  font-size: 12px;
  color: #4b5563;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;

  @media (max-width: 1024px) {
    font-size: 11px;
    gap: 6px;
  }

  @media (max-width: 768px) {
    font-size: 10px;
    gap: 4px;
    width: 100%;
  }
`;

export const CopyableField = styled.span`
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 250px;

  &:hover {
    text-decoration: underline;
  }

  @media (max-width: 1024px) {
    max-width: 200px;
  }

  @media (max-width: 768px) {
    max-width: 150px;
  }
`;

export const MainInfo = styled.div`
  flex: 1;
`;
export const StyledTopBar = styled.div<{ sidebarWidth: number }>`
  padding: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: fixed;
  top: 10vh;
  background-color: rgba(255, 255, 255, 0.8);
  filter: drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.1));
  z-index: 10;
  backdrop-filter: saturate(180%) blur(10px);
  width: 35%;
  box-sizing: border-box;

  @media (max-width: 768px) {
    width: 100%;
    top: 11vh; // Position below sidebar
    padding: 1rem;
    flex-direction: column;
    gap: 1rem;
  }
`;

export const EditableField = styled.span<{ isEditing: boolean }>`
  cursor: ${(props) => (props.isEditing ? 'text' : 'pointer')};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;

  &:hover {
    text-decoration: ${(props) => (props.isEditing ? 'none' : 'underline')};
  }

  input {
    max-width: 120px;
    padding: 2px 4px;
    border: 1px solid #ccc;
    border-radius: 3px;
    font-size: inherit;
  }

  @media (max-width: 768px) {
    max-width: 100px;

    input {
      max-width: 80px;
    }
  }
`;

export const ButtonGroup = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
  white-space: nowrap;

  @media (max-width: 768px) {
    width: 100%;
    justify-content: flex-start;
  }
`;

export const StyledSelect = styled.select`
  background-color: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
  margin-right: 1em;
  min-width: 120px;
  padding: 0.5em;

  @media (max-width: 768px) {
    padding: 0.3em;
    margin-right: 0.5em;
    font-size: 12px;
    min-width: 100px;
  }
`;

export const SeparatorDot = styled.span`
  margin: 0 4px;

  @media (max-width: 768px) {
    margin: 0 2px;
  }
`;

export const Container = styled.div`
  gap: 2rem;
  padding: 1.5rem;
  background-color: #f9fafb;
  border-radius: 0.5rem;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  display: flex;
  justify-content: space-between;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
`;

export const InputWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;

  @media (max-width: 768px) {
    gap: 0.5rem;
    padding: 0.5rem;
  }
`;

export const PreviewSection = styled.div`
  display: flex;
  gap: 1rem;
  width: 100%; // Change this
  justify-content: space-between; // Add this
`;

export const ControlsContainer = styled.div`
  width: 48%; // Change this from flex-basis to width
  padding-right: 1rem; // Add some spacing
`;

export const TemplatePreview = styled.div`
  width: 48%; // Set to 48% instead of flex: 1
  padding: 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  background-color: #f9fafb;
  min-height: 80px;
  font-size: 0.875rem;
  line-height: 1.5;
  white-space: pre-wrap;
`;

export const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
`;

export const HeaderIcon = styled.svg`
  width: 1.25rem;
  height: 1.25rem;
  color: #2563eb;
`;

export const HeaderText = styled.h3`
  font-weight: 500;
  color: #111827;
  margin: 0;
`;

export const ActionButton = styled.button`
  width: 100%;
  padding: 0.4rem;
  background-color: black;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-weight: 500;
  cursor: pointer;
  font-size: 0.875rem;

  &:hover {
    background-color: grey;
  }

  &:disabled {
    background-color: #9ca3af;
    cursor: not-allowed;
  }
`;

export const Select = styled.select`
  background-color: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
  padding: 0.4rem;
  width: 100%;

  &:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
    outline: none;
  }
`;

export const ChatContainer = styled.div`
  display: flex;
  height: 100vh;
  width: 30%;
  position: relative;
  margin-left: 8px;
  margin-right: 8px;
  overflow: hidden;

  @media (max-width: 768px) {
    flex-direction: column;
    margin: 0;
    left: 30vw;
    height: calc(100vh - 60px); // Adjust for mobile header
    padding-bottom: 60px; // Space for input area
  }
`;



export const NotesPanel = styled.div`
  display: flex;
  position: relative;
  overflow-y: scroll;
  border-left: 1px solid #ccc;
`;

export const AttachmentButton = styled(StyledButton)`
  background-color: black;
`;

export const StyledButtonBottom = styled.button`
  background-color: black;
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
  margin-left: 1rem;
  padding: 0.5em;
`;
export const StyledWindow = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  position: fixed;
`;

export const StyledChatInput = styled.input`
  padding: 0.5em;
  // width: 100%;
  display: block;
  flex: 1;
  border: 1px solid #ccc;
  outline: none;
`;
export const StyledChatInputBox = styled.div<{ sidebarWidth: number }>`
  position: fixed;
  bottom: 0;
  width: calc(100% - ${(props) => props.sidebarWidth + 250}px);
  background-color: rgba(255, 255, 255, 0.8);
  filter: drop-shadow(0px -2px 4px rgba(0, 0, 0, 0.1));
  backdrop-filter: saturate(180%) blur(10px);
  padding: 1rem;
  z-index: 10;
  box-sizing: border-box;

  @media (max-width: 768px) {
    width: 100%;
    padding: 0.5rem;
    bottom: 10vh;
    left: 0;
  }
`;

export const ChatView = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  margin-bottom: 35vh;
  width: 70%;

  @media (max-width: 768px) {
    padding: 0.5rem;
    margin-bottom: 70px; // Increased space for mobile input area
  }
`;

export const StyledDateComponent = styled.span`
  padding: 0.5em;
  background-color: #ccf9ff;
  margin: 1rem 0;
  align-items: center;
  color: #0e6874;
  border-radius: 4px;
`;

export const StyledScrollingView = styled.div`
  padding-top: 8rem;
  margin-bottom: 5rem;
  z-index: 1;
`;

