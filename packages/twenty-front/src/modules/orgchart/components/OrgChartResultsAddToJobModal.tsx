import styled from '@emotion/styled';
import { IconButton, IconX } from 'twenty-ui';

import { Modal } from '@/ui/layout/modal/components/Modal';
import { OnboardingIntentModalLayout } from '~/pages/onboarding/OnboardingIntentModalLayout';

import type { ContextResultItem } from '../types';
import {
    OrgChartModalTightContent,
    OrgChartModalTightHeader,
} from './OrgChartModalTightContent';
import { OrgChartResultsAddToJobPanel } from './OrgChartResultsAddToJobPanel';

const StyledOrgChartAddResultsModal = styled(Modal)`
  max-height: 90dvh;
  width: min(640px, 100vw - ${({ theme }) => theme.spacing(8)});
`;

const StyledHeaderContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
`;

const StyledTitle = styled.div`
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
`;

export type OrgChartResultsAddToJobModalProps = {
  isOpen: boolean;
  onClose: () => void;
  results: ContextResultItem[];
  companyName?: string | undefined | null;
  contextModalMode?: string | undefined | null;
  selectedNodeFunction?: string;
  selectedNodeGrade?: string;
  queueStartChatAfter?: boolean;
  onSuccess?: () => void;
};

export const OrgChartResultsAddToJobModal = ({
  isOpen,
  onClose,
  results,
  companyName,
  contextModalMode,
  selectedNodeFunction,
  selectedNodeGrade,
  queueStartChatAfter = true,
  onSuccess,
}: OrgChartResultsAddToJobModalProps) => {
  if (!isOpen) {
    return null;
  }

  return (
    <StyledOrgChartAddResultsModal
      isClosable
      onClose={onClose}
      size="large"
      padding="none"
    >
      <OrgChartModalTightHeader>
        <OnboardingIntentModalLayout>
          <StyledHeaderContainer>
            <StyledTitle>Add to job</StyledTitle>
            <IconButton Icon={IconX} onClick={onClose} variant="tertiary" />
          </StyledHeaderContainer>
        </OnboardingIntentModalLayout>
      </OrgChartModalTightHeader>
      <OrgChartModalTightContent>
        <OnboardingIntentModalLayout>
          <OrgChartResultsAddToJobPanel
            results={results}
            companyName={companyName}
            contextModalMode={contextModalMode}
            selectedNodeFunction={selectedNodeFunction}
            selectedNodeGrade={selectedNodeGrade}
            queueStartChatAfter={queueStartChatAfter}
            onCancel={onClose}
            onComplete={() => {
              onSuccess?.();
              onClose();
            }}
          />
        </OnboardingIntentModalLayout>
      </OrgChartModalTightContent>
    </StyledOrgChartAddResultsModal>
  );
};
