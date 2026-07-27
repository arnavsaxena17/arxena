import { styled } from '@linaria/react';
import {
    forwardRef,
    type ComponentPropsWithoutRef,
    type ElementRef,
} from 'react';

const StyledGraphWidgetChartContainer = styled.div`
  flex: 1;
  position: relative;
  width: 100%;

  &[data-clickable='true'][data-cursor-selector='svg g path'] svg g path {
    cursor: pointer;
  }

  &[data-clickable='true'][data-cursor-selector='canvas'] canvas {
    cursor: pointer;
  }
`;

type GraphWidgetChartContainerProps = ComponentPropsWithoutRef<'div'> & {
  $isClickable?: boolean;
  $cursorSelector?: string;
};

export const GraphWidgetChartContainer = forwardRef<
  ElementRef<'div'>,
  GraphWidgetChartContainerProps
>(({ $isClickable, $cursorSelector, ...props }, ref) => (
  <StyledGraphWidgetChartContainer
    ref={ref}
    {...props}
    data-clickable={$isClickable === true ? 'true' : undefined}
    data-cursor-selector={$cursorSelector}
  />
));
