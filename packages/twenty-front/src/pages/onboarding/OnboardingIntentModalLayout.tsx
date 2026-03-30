import { Modal } from '@/ui/layout/modal/components/Modal';
import styled from '@emotion/styled';

type OnboardingIntentModalLayoutWidth = 'md' | 'lg' | 'xl';

const StyledContent = styled(Modal.Content)`
  align-items: center;
  display: flex;
  justify-content: center;
  padding: ${({ theme }) => `${theme.spacing(6)} ${theme.spacing(5)}`};

  @media (max-width: 768px) {
    padding: ${({ theme }) => theme.spacing(4)};
  }
`;

const StyledPanel = styled.div<{
  panelWidth: OnboardingIntentModalLayoutWidth;
}>`
  display: flex;
  flex-direction: column;
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

const StyledModalContent = styled.div`
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
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
    <StyledContent>
      <StyledPanel panelWidth={panelWidth}>
        <StyledModalContent>{children}</StyledModalContent>
      </StyledPanel>
    </StyledContent>
  );
};
