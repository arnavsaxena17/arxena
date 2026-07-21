import { IconButton } from 'twenty-ui';
import { IconX } from 'twenty-ui/icons';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { tableStateAtom } from '@/candidate-table/states/states';
import { SnackBarVariant } from '@/ui/feedback/snack-bar-manager/components/SnackBar';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { isBulkMessageModalOpenState } from '@/ui/layout/modal/states/bulkMessageModalState';
import { usePreviousHotkeyScope } from '@/ui/utilities/hotkey/hooks/usePreviousHotkeyScope';
import { AppHotkeyScope } from '@/ui/utilities/hotkey/types/AppHotkeyScope';
import styled from '@emotion/styled';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';

const StyledModalContainer = styled.div`
  background-color: solid;
  top: 10vh;
  left: 10vw;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  position: fixed;
  height: 80vh;
  width: 80vw;
  z-index: 10000;
  pointer-events: none;
`;

const StyledModalBackdrop = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 9999;
  pointer-events: all;
`;

const StyledAdjuster = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
  padding: 0 120px;
  justify-content: center;
  align-items: center;
`;

const StyledModal = styled.div`
  background-color: ${({ theme }) => theme.background.tertiary};
  box-shadow: ${({ theme }) => theme.boxShadow.superHeavy};
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  height: 100%;
  flex-basis: 900px;
  z-index: 2001;
  overflow: hidden;
  max-height: 680px;
  box-sizing: border-box;
  position: relative;
  pointer-events: auto;
  user-select: none;

  & * {
    pointer-events: auto;
  }

  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.background.tertiary};
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.background.quaternary || '#888'};
    border-radius: 4px;
    
    &:hover {
      background: ${({ theme }) => theme.background.noisy || '#666'};
    }
  }

  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) => `${theme.background.quaternary || '#888'} ${theme.background.tertiary}`};
`;

const StyledHeader = styled.div`
  align-items: center;
  display: flex;
  justify-content: space-between;
  padding: 24px;
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
`;

const StyledTitle = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

const StyledContent = styled.div`
  display: flex;
  flex-direction: column;
  padding: 24px;
  flex: 1;
  overflow-y: auto;
`;

const StyledTextArea = styled.textarea`
  width: 98%;
  height: 200px;
  padding: 12px;
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: 8px;
  resize: none;
  font-family: inherit;
  font-size: ${({ theme }) => theme.font.size.md};
  background-color: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.color.blue};
  }
`;

const StyledFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  padding: 24px;
  border-top: 1px solid ${({ theme }) => theme.border.color.light};
  gap: 12px;
`;

const StyledButton = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: ${({ theme }) => theme.font.weight.medium};
  cursor: pointer;
  transition: all 0.2s ease;

  ${({ variant, theme }) =>
    variant === 'primary'
      ? `
    background-color: ${theme.color.blue};
    color: white;
    border: none;
    &:hover {
      background-color: ${theme.color.blue70};
    }
  `
      : `
    background-color: transparent;
    color: ${theme.font.color.primary};
    border: 1px solid ${theme.border.color.medium};
    &:hover {
      background-color: ${theme.background.transparent.light};
    }
  `}
`;

export const BulkMessageModal = () => {
  const [isBulkMessageModalOpen, setIsBulkMessageModalOpen] = useRecoilState(isBulkMessageModalOpenState);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const tokenPair = useRecoilValue(tokenPairState);
  const tableState = useRecoilValue(tableStateAtom);
  const { enqueueSnackBar } = useSnackBar();
  
  const {
    setHotkeyScopeAndMemorizePreviousScope,
    goBackToPreviousHotkeyScope,
  } = usePreviousHotkeyScope();

  const closeModal = () => {
    setIsBulkMessageModalOpen(false);
    goBackToPreviousHotkeyScope();
  };

  useEffect(() => {
    if (isBulkMessageModalOpen) {
      setHotkeyScopeAndMemorizePreviousScope(AppHotkeyScope.App, {
        commandMenu: false,
        goto: false,
        keyboardShortcutMenu: false,
      });
    }
  }, [isBulkMessageModalOpen, setHotkeyScopeAndMemorizePreviousScope]);

  if (!isBulkMessageModalOpen) {
    return null;
  }

  console.log('tableState', tableState);
  console.log('tableState.selectedRowIds', tableState.selectedRowIds);

  const selectedRecords = tableState?.rawData.filter(record => 
    tableState.selectedRowIds.includes(record.id)
  );
  const handleSubmit = async () => {
    if (!message.trim()) {
      enqueueSnackBar('Please enter a message', {
        variant: SnackBarVariant.Error,
      });
      return;
    }
    setIsLoading(true);
    try {
      console.log('selectedRecords', selectedRecords);
      const candidateIds = selectedRecords?.map(record => record.id);
      console.log('candidateIds', candidateIds);

      await axios.post(
        `${process.env.REACT_APP_SERVER_BASE_URL}/arx-chat/send-bulk-chats-by-candidate-ids`,
        { candidateIds, messageToSend: message.trim() },
        { headers: { Authorization: `Bearer ${tokenPair?.accessToken?.token}` }, }
      );

      enqueueSnackBar('Messages sent successfully', {
        variant: SnackBarVariant.Success,
      });
      
      closeModal();
      setMessage('');
    } catch (error) {
      console.error('Error sending bulk messages:', error);
      enqueueSnackBar('Failed to send messages', {
        variant: SnackBarVariant.Error,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <StyledModalBackdrop onClick={closeModal} />
      <StyledModalContainer>
        <StyledAdjuster>
          <StyledModal onClick={(e) => e.stopPropagation()}>
            <StyledHeader>
              <StyledTitle>Send Bulk Messages</StyledTitle>
              <IconButton Icon={IconX} onClick={closeModal} variant="tertiary" />
            </StyledHeader>
            <StyledContent>
              <StyledTextArea 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter your message here..."
                autoFocus
              />
            </StyledContent>
            <StyledFooter>
              <StyledButton onClick={closeModal}>
                Cancel
              </StyledButton>
              <StyledButton variant="primary" onClick={handleSubmit} disabled={isLoading}>
                Send Messages
              </StyledButton>
            </StyledFooter>
          </StyledModal>
        </StyledAdjuster>
      </StyledModalContainer>
    </>
  );
}; 