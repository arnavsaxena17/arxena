import styled from '@emotion/styled';

type OnboardingIntentModalLayoutWidth = 'md' | 'lg' | 'xl';

const StyledOnboardingRoot = styled.div<{
  panelWidth: OnboardingIntentModalLayoutWidth;
}>`
  display: flex;
  flex-direction: column;
  margin: 0 auto;
  max-width: ${({ panelWidth }) => {
    switch (panelWidth) {
      case 'xl':
        return '1080px';
      case 'lg':
        return '860px';
      case 'md':
      default:
        return '640px';
    }
  }};
  width: 100%;
`;

type OnboardingIntentModalLayoutProps = {
  children: React.ReactNode;
  panelWidth?: OnboardingIntentModalLayoutWidth;
};

export const OnboardingIntentModalLayout = ({
  children,
  panelWidth = 'md',
}: OnboardingIntentModalLayoutProps) => {
  return (
    <StyledOnboardingRoot panelWidth={panelWidth}>{children}</StyledOnboardingRoot>
  );
};
