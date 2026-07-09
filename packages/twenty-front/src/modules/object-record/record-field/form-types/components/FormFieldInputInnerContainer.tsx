import { usePushFocusItemToFocusStack } from '@/ui/utilities/focus/hooks/usePushFocusItemToFocusStack';
import { useRemoveFocusItemFromFocusStackById } from '@/ui/utilities/focus/hooks/useRemoveFocusItemFromFocusStackById';
import { FocusComponentType } from '@/ui/utilities/focus/types/FocusComponentType';
import styled from '@emotion/styled';
import { forwardRef, type HTMLAttributes, type Ref } from 'react';

type FormFieldInputInnerContainerProps = {
  hasRightElement: boolean;
  hoverable?: boolean;
  multiline?: boolean;
  readonly?: boolean;
  preventFocusStackUpdate?: boolean;
  formFieldInputInstanceId: string;
};

const StyledFormFieldInputInnerContainer = styled.div<
  Omit<FormFieldInputInnerContainerProps, 'formFieldInputInstanceId'>
>`
  align-items: ${({ multiline }) => (multiline ? 'flex-start' : 'center')};
  background-color: ${({ theme }) => theme.background.transparent.lighter};
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-bottom-left-radius: ${({ theme }) => theme.border.radius.sm};
  border-bottom-right-radius: ${({ multiline, hasRightElement, theme }) =>
    multiline || !hasRightElement ? theme.border.radius.sm : '0'};
  border-right: ${({ multiline, hasRightElement, theme }) =>
    multiline || !hasRightElement
      ? `1px solid ${theme.border.color.medium}`
      : 'none'};
  border-top-left-radius: ${({ theme }) => theme.border.radius.sm};
  border-top-right-radius: ${({ multiline, hasRightElement, theme }) =>
    multiline || !hasRightElement ? theme.border.radius.sm : '0'};
  box-sizing: border-box;
  display: flex;
  justify-content: space-between;
  overflow-x: auto;
  overflow-y: ${({ multiline }) => (multiline ? 'auto' : 'hidden')};
  scrollbar-width: none;
  width: 100%;

  &::-webkit-scrollbar {
    display: none;
  }

  &:hover,
  &[data-open='true'] {
    background-color: ${({ hoverable, theme }) =>
      hoverable
        ? theme.background.transparent.light
        : theme.background.transparent.lighter};
  }
`;

export const FormFieldInputInnerContainer = forwardRef(
  (
    {
      className,
      children,
      onFocus,
      onBlur,
      hasRightElement,
      hoverable,
      multiline,
      readonly,
      preventFocusStackUpdate = false,
      onClick,
      formFieldInputInstanceId,
    }: HTMLAttributes<HTMLDivElement> & FormFieldInputInnerContainerProps,
    ref: Ref<HTMLDivElement>,
  ) => {
    const { pushFocusItemToFocusStack } = usePushFocusItemToFocusStack();
    const { removeFocusItemFromFocusStackById } =
      useRemoveFocusItemFromFocusStackById();

    const handleFocus = (e: React.FocusEvent<HTMLDivElement>) => {
      onFocus?.(e);

      if (!preventFocusStackUpdate) {
        pushFocusItemToFocusStack({
          focusId: formFieldInputInstanceId,
          component: {
            type: FocusComponentType.FORM_FIELD_INPUT,
            instanceId: formFieldInputInstanceId,
          },
          globalHotkeysConfig: {
            enableGlobalHotkeysConflictingWithKeyboard: false,
          },
        });
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
      onBlur?.(e);

      if (!preventFocusStackUpdate) {
        removeFocusItemFromFocusStackById({
          focusId: formFieldInputInstanceId,
        });
      }
    };

    return (
      <StyledFormFieldInputInnerContainer
        ref={ref}
        className={className}
        hasRightElement={hasRightElement}
        hoverable={hoverable}
        multiline={multiline}
        readonly={readonly}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClick={onClick}
      >
        {children}
      </StyledFormFieldInputInnerContainer>
    );
  },
);
