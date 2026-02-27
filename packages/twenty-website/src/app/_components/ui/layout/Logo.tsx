import styled from '@emotion/styled';

export type LogoVariant = 'header' | 'hero' | 'footer';

const StyledLink = styled.a<{ variant: LogoVariant }>`
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
    background-image: url('/images/favicon/512.png');
  `}
  ${({ variant }) =>
    variant === 'hero' &&
    `
    height: 100px;
    width: 100px;
    background-image: url('/images/favicon/512.png');
  `}
  ${({ variant }) =>
    variant === 'footer' &&
    `
    height: 40px;
    width: 40px;
    background-image: url('/images/favicon/512.png');
  `}
`;

type LogoProps = {
  variant?: LogoVariant;
};

export const Logo = ({ variant = 'header' }: LogoProps) => {
  return <StyledLink href="/" variant={variant} />;
};
