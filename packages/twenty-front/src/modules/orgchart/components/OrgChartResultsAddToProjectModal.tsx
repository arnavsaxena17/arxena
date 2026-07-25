import { IconButton } from 'twenty-ui';
import { styled } from '@linaria/react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { IconX } from 'twenty-ui/icon';

import { Modal } from '@/ui/layout/modal/components/Modal';
import { OnboardingIntentModalLayout } from '~/pages/onboarding/OnboardingIntentModalLayout';

import type { ContextResultItem } from '../types';
import {
    OrgChartModalTightContent,
    OrgChartModalTightHeader,
} from './OrgChartModalTightContent';
import { OrgChartResultsAddToProjectPanel } from './OrgChartResultsAddToProjectPanel';

const StyledOrgChartAddResultsModal = styled(Modal)`
  max-height: 90dvh;
  width: min(640px, 100vw - ${themeCssVariables.spacing[8]});
`;

const StyledHeaderContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
`;

const StyledTitle = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.lg};
  font-weight: ${themeCssVariables.font.weight.semiBold};
`;

export type OrgChartResultsAddToProjectModalProps = {
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

export const OrgChartResultsAddToProjectModal = ({
  isOpen,
  onClose,
  results,
  companyName,
  contextModalMode,
  selectedNodeFunction,
  selectedNodeGrade,
  queueStartChatAfter = true,
  onSuccess,
}: OrgChartResultsAddToProjectModalProps) => {
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
          <OrgChartResultsAddToProjectPanel
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
