import {
  CallToActionContainer,
  LinkNextToCTA,
  StyledButton,
} from '@/app/_components/ui/layout/header/styled';
import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';

export const CallToAction = () => {
  return (
    <CallToActionContainer>
      <LinkNextToCTA href={getSignInUrl()}>Sign in</LinkNextToCTA>
      <a href={getSignUpUrl()}>
        <StyledButton>Get Started</StyledButton>
      </a>
    </CallToActionContainer>
  );
};
