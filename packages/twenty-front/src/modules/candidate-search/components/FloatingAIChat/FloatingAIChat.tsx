import { parsedJDSelector } from '@/arx-jd-upload/states/arxJDFormStepperState';
import { AIChatAssistant } from '@/candidate-search/components/ai-chat-assistant/AIChatAssistant';
import { fetchedCandidatesCountSelector } from '@/candidate-search/states/searchResultsState';
import styled from '@emotion/styled';
import { useCallback, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { IconMinus, IconX } from 'twenty-ui';

const StyledFloatingChat = styled.div<{ isExpanded: boolean }>`
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: ${({ isExpanded }) => isExpanded ? '400px' : '60px'};
  height: ${({ isExpanded }) => isExpanded ? '900px' : '60px'};
  max-height: ${({ isExpanded }) => isExpanded ? 'calc(100vh - 40px)' : '60px'};
  background-color: ${({ theme }) => theme.background.primary};
  border: 1px solid ${({ theme }) => theme.border.color.light};
  border-radius: ${({ theme }) => theme.border.radius.xl};
  box-shadow: ${({ theme }) => theme.boxShadow.superHeavy};
  z-index: 1000;
  transition: all 200ms ease;
  border-radius: ${({ theme }) => theme.border.radius.xl};
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const StyledChatHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  background-color: ${({ theme }) => theme.background.secondary};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  min-height: 50px;
`;

const StyledChatTitle = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing(2)};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
`;

const StyledAvatar = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: ${({ theme }) => theme.color.gray80};
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

const StyledChatControls = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing(1)};
`;

const StyledControlButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: ${({ theme }) => theme.spacing(1)};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  color: ${({ theme }) => theme.font.color.secondary};
  
  &:hover {
    background-color: ${({ theme }) => theme.background.tertiary};
    color: ${({ theme }) => theme.font.color.primary};
  }
`;

const StyledChatContent = styled.div`
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0; /* Allow flex child to shrink */
  max-height: 100%;
`;

const StyledContextBar = styled.div`
  padding: ${({ theme }) => theme.spacing(2)} ${({ theme }) => theme.spacing(3)};
  background-color: ${({ theme }) => theme.background.tertiary};
  border-bottom: 1px solid ${({ theme }) => theme.border.color.light};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.font.color.secondary};
`;

const StyledMinimizedButton = styled.button`
  width: 100%;
  height: 100%;
  background: ${({ theme }) => theme.color.gray80};
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  font-size: ${({ theme }) => theme.font.size.lg};
  transition: transform 200ms ease;
  
  &:hover {
    transform: scale(1.05);
  }
  
  &:active {
    transform: scale(0.95);
  }
`;

const StyledUnreadBadge = styled.div`
  position: absolute;
  top: -5px;
  right: -5px;
  width: 20px;
  height: 20px;
  background-color: ${({ theme }) => theme.color.red};
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

type FloatingAIChatProps = {
  className?: string;
  /** When set with `onExpandedChange`, expand/collapse is controlled by the parent (e.g. header AI button). */
  isExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
};

export const FloatingAIChat = ({
  className,
  isExpanded: isExpandedProp,
  onExpandedChange,
}: FloatingAIChatProps) => {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const isControlled =
    isExpandedProp !== undefined && onExpandedChange !== undefined;
  const isExpanded = isControlled ? isExpandedProp : internalExpanded;

  const setExpanded = useCallback(
    (next: boolean) => {
      if (isControlled) {
        onExpandedChange?.(next);
      } else {
        setInternalExpanded(next);
      }
    },
    [isControlled, onExpandedChange],
  );

  const parsedJD = useRecoilValue(parsedJDSelector);
  const fetchedCount = useRecoilValue(fetchedCandidatesCountSelector);

  const toggleExpanded = useCallback(() => {
    const next = !isExpanded;
    setExpanded(next);
    if (next) {
      setUnreadCount(0);
    }
  }, [isExpanded, setExpanded]);

  const minimizeChat = useCallback(() => {
    setExpanded(false);
  }, [setExpanded]);

  const closeChat = useCallback(() => {
    setExpanded(false);
    setUnreadCount(0);
  }, [setExpanded]);

  // Context information for the chat
  const contextInfo = parsedJD ? 
    `${parsedJD.name} • ${fetchedCount} candidates fetched` : 
    `${fetchedCount} candidates fetched`;

  if (!isExpanded) {
    return (
      <StyledFloatingChat className={className} isExpanded={false}>
        <StyledMinimizedButton onClick={toggleExpanded}>
          <StyledAvatar>Arx</StyledAvatar>
          {unreadCount > 0 && (
            <StyledUnreadBadge>{unreadCount}</StyledUnreadBadge>
          )}
        </StyledMinimizedButton>
      </StyledFloatingChat>
    );
  }

  return (
    <StyledFloatingChat className={className} isExpanded={true}>
      <StyledChatHeader>
        <StyledChatTitle>
          <StyledAvatar>Arx</StyledAvatar>
          Arxena - AI Assistant
        </StyledChatTitle>
        <StyledChatControls>
          <StyledControlButton onClick={minimizeChat} title="Minimize">
            <IconMinus size={16} />
          </StyledControlButton>
          <StyledControlButton onClick={closeChat} title="Close">
            <IconX size={16} />
          </StyledControlButton>
        </StyledChatControls>
      </StyledChatHeader>

      <StyledChatContent>
        <StyledContextBar>
          {contextInfo}
        </StyledContextBar>
        
        {parsedJD && (
          <AIChatAssistant
            parsedJD={parsedJD}
            onJDUpload={async (file: File) => {
              console.log('JD Upload requested:', file.name);
            }}
            onEnrichmentCreate={(enrichments: any[]) => {
              console.log('Enrichments created:', enrichments);
            }}
            onJDRemove={async () => {
              console.log('JD Remove requested - handled by AIChatAssistant');
            }}
            onJDReplace={async (files: File[]) => {
              console.log('JD Replace requested:', files.map(f => f.name), '- handled by AIChatAssistant');
            }}
            onParsedJDUpdate={(updatedParsedJD: any) => {
              console.log('ParsedJD updated via Recoil:', updatedParsedJD);
            }}
          />
        )}
      </StyledChatContent>
    </StyledFloatingChat>
  );
};
