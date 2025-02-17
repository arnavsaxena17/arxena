import {
  CallToActionContainer,
  LinkNextToCTA,
  StyledButton,
} from '@/app/_components/ui/layout/header/styled';

export const CallToAction = () => {
  return (
    <CallToActionContainer>
      <LinkNextToCTA href="https://app.arxena.com">Sign in</LinkNextToCTA>
      <a href="https://app.arxena.com">
        <StyledButton>Get Started</StyledButton>
      </a>
    </CallToActionContainer>
  );
};
