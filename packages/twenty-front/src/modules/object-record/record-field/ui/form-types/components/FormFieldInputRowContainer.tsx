import { styled } from '@linaria/react';

export const LINE_HEIGHT = 24;

const StyledFormFieldInputRowContainer = styled.div<{
  multiline?: boolean;
  maxHeight?: number;
  height?: number;
}>`
  display: flex;
  flex-direction: row;
  height: ${({ height, multiline }) =>
    height !== undefined ? `${height}px` : multiline ? 'auto' : '32px'};

  line-height: ${({ multiline }) =>
    multiline ? `${LINE_HEIGHT}px` : 'normal'};
  max-height: ${({ height, multiline, maxHeight }) =>
    height !== undefined
      ? `${height}px`
      : multiline
        ? `${maxHeight ?? 5 * LINE_HEIGHT}px`
        : 'none'};
  min-height: ${({ height, multiline }) =>
    height !== undefined ? '0' : multiline ? `${3 * LINE_HEIGHT}px` : 'auto'};
  position: relative;
`;

export const FormFieldInputRowContainer = StyledFormFieldInputRowContainer;
