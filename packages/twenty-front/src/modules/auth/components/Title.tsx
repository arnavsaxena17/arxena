import styled from '@emotion/styled';
import React from 'react';
import { AnimatedEaseIn } from 'twenty-ui';

type TitleProps = React.PropsWithChildren & {
  animate?: boolean;
  noMarginTop?: boolean;
  /** Tighter gap below the title (e.g. dense onboarding modals). */
  denseSpacing?: boolean;
};

const StyledTitle = styled.div<
  Pick<TitleProps, 'noMarginTop' | 'denseSpacing'>
>`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.xl};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  margin-bottom: ${({ theme, denseSpacing }) =>
    denseSpacing ? theme.spacing(2) : theme.spacing(4)};
  text-align: center;
  margin-top: ${({ theme, noMarginTop }) =>
    !noMarginTop ? theme.spacing(4) : 0};
`;

export const Title = ({
  children,
  animate = false,
  noMarginTop = false,
  denseSpacing = false,
}: TitleProps) => {
  if (animate) {
    return (
      <StyledTitle denseSpacing={denseSpacing} noMarginTop={noMarginTop}>
        <AnimatedEaseIn>{children}</AnimatedEaseIn>
      </StyledTitle>
    );
  }

  return (
    <StyledTitle denseSpacing={denseSpacing} noMarginTop={noMarginTop}>
      {children}
    </StyledTitle>
  );
};
