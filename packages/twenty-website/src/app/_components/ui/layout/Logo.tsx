import styled from '@emotion/styled';
import Link from 'next/link';

export type LogoVariant = 'header' | 'hero' | 'footer';

const StyledLink = styled(Link)<{ variant: LogoVariant }>`
  display: block;
  flex-shrink: 0;
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
  border-radius: 8px;
  opacity: 1;
  ${({ variant }) =>
    variant === 'header' &&
    `
    height: 40px;
    width: 120px;
    background-image: url('/images/favicon/icon-512.png');
  `}
  ${({ variant }) =>
    variant === 'hero' &&
    `
    height: 100px;
    width: 200px;
    background-image: url('/images/core/arxena-logo-black-straight.png');
  `}
  ${({ variant }) =>
    variant === 'footer' &&
    `
    height: 40px;
    width: 40px;
    background-image: url('/images/favicon/icon-512.png');
  `}
`;

type LogoProps = {
  variant?: LogoVariant;
};

export const Logo = ({ variant = 'header' }: LogoProps) => {
  return <StyledLink href="/" variant={variant} />;
};
