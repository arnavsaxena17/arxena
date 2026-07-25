import { styled } from '@linaria/react';
import { useId } from 'react';
import { themeCssVariables } from 'twenty-ui/theme-constants';

import { usePushFocusItemToFocusStack } from '@/ui/utilities/focus/hooks/usePushFocusItemToFocusStack';
import { useRemoveFocusItemFromFocusStackById } from '@/ui/utilities/focus/hooks/useRemoveFocusItemFromFocusStackById';
import { FocusComponentType } from '@/ui/utilities/focus/types/FocusComponentType';

import { H2Title } from 'twenty-ui';

const StyledContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: min-content;
`;

const StyledTextArea = styled.textarea`
  background-color: ${themeCssVariables.background.transparent.lighter};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.sm};
  box-sizing: border-box;
  color: ${themeCssVariables.font.color.primary};
  font-family: inherit;
  font-size: ${themeCssVariables.font.size.md};
  font-weight: ${themeCssVariables.font.weight.regular};
  line-height: 16px;
  overflow: auto;
  padding: ${themeCssVariables.spacing[2]};
  padding-top: ${themeCssVariables.spacing[3]};
  resize: none;
  width: 100%;
  height: min-content;

  &:focus {
    outline: none;
  }

  &::placeholder {
    color: ${themeCssVariables.font.color.light};
    font-weight: ${themeCssVariables.font.weight.regular};
  }

  &:disabled {
    color: ${themeCssVariables.font.color.tertiary};
  }
`;

export const AdditionalInformation = () => {
  const focusId = useId();
  const { pushFocusItemToFocusStack } = usePushFocusItemToFocusStack();
  const { removeFocusItemFromFocusStackById } =
    useRemoveFocusItemFromFocusStackById();

  const handleFocus = () => {
    pushFocusItemToFocusStack({
      focusId,
      component: {
        type: FocusComponentType.TEXT_AREA,
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
    <StyledContainer>
      <H2Title title="Introduction" />
      <StyledTextArea
        placeholder={'Additional Information...'}
        rows={4}
        onFocus={handleFocus}
        onBlur={handleBlur}
        name="newVideoInterviewTemplate[0][introduction]"
      />
    </StyledContainer>
  );
};
