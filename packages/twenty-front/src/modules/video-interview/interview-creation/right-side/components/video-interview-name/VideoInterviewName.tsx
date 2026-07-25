import { styled } from '@linaria/react';
import { useId } from 'react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { usePushFocusItemToFocusStack } from '@/ui/utilities/focus/hooks/usePushFocusItemToFocusStack';
import { useRemoveFocusItemFromFocusStackById } from '@/ui/utilities/focus/hooks/useRemoveFocusItemFromFocusStackById';
import { FocusComponentType } from '@/ui/utilities/focus/types/FocusComponentType';
import { VideoInterviewCreateButton } from '@/video-interview/interview-creation/right-side/components/video-interview-name/VideoInterviewCreateButton';
import { VideoInterviewModalCloseButton } from '@/video-interview/interview-creation/right-side/components/video-interview-name/VideoInterviewModalCloseButton';

const StyledVideoInterviewNameContainer = styled.div`
  display: flex;
`;

const StyledInput = styled.input`
  align-items: flex-start;
  &::placeholder {
    color: ${themeCssVariables.font.color.tertiary};
    font-size: ${themeCssVariables.font.size.lg};
    font-weight: ${themeCssVariables.font.weight.medium};
    font-family: ${themeCssVariables.font.family};
  }
  &:focus {
    outline: none;
  }
  display: flex;
  flex-grow: 1;
  border: none;
  height: auto;
  color: ${themeCssVariables.font.color.secondary};
  font-family: ${themeCssVariables.font.family};
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.semiBold};
`;

const StyledButtonsContainer = styled.div`
  display: flex;
  flex-direction: row;
  width: min-content;
  gap: 8px;
`;

export const VideoInterviewName = ({
  closeModal,
}: {
  closeModal: () => void;
}) => {
  const focusId = useId();
  const { pushFocusItemToFocusStack } = usePushFocusItemToFocusStack();
  const { removeFocusItemFromFocusStackById } =
    useRemoveFocusItemFromFocusStackById();

  const handleFocus = () => {
    pushFocusItemToFocusStack({
      focusId,
      component: {
        type: FocusComponentType.TEXT_INPUT,
        instanceId: focusId,
      },
      globalHotkeysConfig: {
        enableGlobalHotkeysConflictingWithKeyboard: false,
      },
    });
  };

  const handleBlur = () => {
    removeFocusItemFromFocusStackById({ focusId });
  };

  return (
    <StyledVideoInterviewNameContainer>
      <StyledInput
        type="text"
        placeholder="Interview Name..."
        name="newVideoInterviewTemplate[0][VideoInterviewTemplateName]"
        required
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      <StyledButtonsContainer>
        <VideoInterviewModalCloseButton closeModal={closeModal} />
        <VideoInterviewCreateButton />
      </StyledButtonsContainer>
    </StyledVideoInterviewNameContainer>
  );
};
