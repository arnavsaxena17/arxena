import { IconMail } from 'twenty-ui/icons';
import styled from '@emotion/styled';
import { useRecoilState } from 'recoil';

import { currentJobIdForDripState, isDripCampaignModalOpenState } from '../states/dripCampaignModalOpenState';

const StyledButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: 1px solid ${({ theme }) => theme.border.color.medium};
  border-radius: 8px;
  background: ${({ theme }) => theme.background.primary};
  color: ${({ theme }) => theme.font.color.primary};
  font-size: ${({ theme }) => theme.font.size.sm};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${({ theme }) => theme.background.transparent.light};
    border-color: ${({ theme }) => theme.color.blue60};
  }
`;

interface DripCampaignActionButtonProps {
  jobId: string;
  objectNameSingular: string;
  objectRecordId: string;
  onRefresh?: () => void;
}

export const DripCampaignActionButton: React.FC<DripCampaignActionButtonProps> = ({
  jobId,
  objectNameSingular,
  objectRecordId,
  onRefresh
}) => {
  const [, setIsDripCampaignModalOpen] = useRecoilState(isDripCampaignModalOpenState);
  const [, setCurrentJobIdForDrip] = useRecoilState(currentJobIdForDripState);

  const handleOpenDripCampaignModal = () => {
    setCurrentJobIdForDrip(jobId);
    setIsDripCampaignModalOpen(true);
  };

  return (
    <StyledButton onClick={handleOpenDripCampaignModal}>
      <IconMail size={16} />
      Drip Campaigns
    </StyledButton>
  );
};
