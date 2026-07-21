import { IconPlus, IconTrash } from 'twenty-ui/icons';
import {
  activeDripCampaignState,
  dripCampaignsState,
  type DripCampaign
} from '@/drip-campaign/states/dripCampaignModalOpenState';
import styled from '@emotion/styled';
import { useRecoilState } from 'recoil';

const StyledContainer = styled.div`
  color: ${({ theme }) => theme.font.color.secondary};
  display: flex;
  flex-direction: column;
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semiBold};
  gap: 32px;
  padding: 44px 32px 44px 32px;
  width: calc(100% * (1 / 6));
  max-width: 300px;
  min-width: 224px;
  flex-shrink: 1;
  position: relative;
  pointer-events: auto;
`;

const ScrollableContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 32px;
  flex: 1;
  overflow-y: auto;
  min-height: 0; // Important for flex containers
  
  /* Add custom scrollbar styling */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: ${({ theme }) => theme.background.tertiary};
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.background.quaternary || '#888'};
    border-radius: 4px;
    
    &:hover {
      background: ${({ theme }) => theme.background.noisy || '#666'};
    }
  }

  scrollbar-width: thin;
  scrollbar-color: ${({ theme }) => `${theme.background.quaternary || '#888'} ${theme.background.tertiary}`};
`;

const StyledModalNavElementContainer = styled.nav`
  display: flex;
  gap: 4px;
  padding: 6px 0 6px 0;
  flex-direction: column;
  overflow: visible;
`;

const StyledIntroductionNavElement = styled.div`
  font-family: ${({ theme }) => theme.font.family};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  padding: 6px;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: ${({ theme }) => theme.background.transparent.light};
  }
  &.active {
    background-color: ${({ theme }) => theme.background.transparent.light};
  }
  color: ${({ theme }) => theme.grayScale.gray50};
  border-radius: 4px;
  width: 200px;
  cursor: pointer;
`;

const StyledButton = styled.div`
  border: none;
  font-family: inherit;
  color: ${({ theme }) => theme.font.color.light};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.regular};
  cursor: pointer;
  background-color: none;
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const StyledQuestionsContainer = styled.ol`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0;
  margin: 0px;
  list-style-type: none;
  scroll-behavior: smooth;
`;

const StyledListItem = styled.li`
  display: flex;
  justify-content: space-between;
  align-items: center;
  &::marker {
    display: none;
    font-family: inherit;
    color: ${({ theme }) => theme.font.color.light};
    font-size: ${({ theme }) => theme.font.size.md};
    font-weight: ${({ theme }) => theme.font.weight.regular};
  }
`;

export const ModalNavElementContainer = () => {
  const [campaigns, setCampaigns] = useRecoilState(dripCampaignsState);
  const [activeCampaign, setActiveCampaign] = useRecoilState(activeDripCampaignState);

  const addCampaign = () => {
    const newCampaign: DripCampaign = {
      id: `campaign_${Date.now()}`,
      name: '',
      description: '',
      jobId: '',
      emailSequences: [],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setCampaigns(prev => [...prev, newCampaign]);
    setActiveCampaign(newCampaign);
  };

  const deleteCampaign = (campaignId: string) => {
    setCampaigns(prev => prev.filter(campaign => campaign.id !== campaignId));
    if (activeCampaign?.id === campaignId) {
      setActiveCampaign(null);
    }
  };

  const handleCampaignClick = (campaign: DripCampaign) => {
    setActiveCampaign(campaign);
  };

  return (
    <StyledModalNavElementContainer>
      <StyledQuestionsContainer>
        {campaigns.map((campaign) => (
          <StyledListItem key={campaign.id}>
            <StyledIntroductionNavElement
              className={activeCampaign?.id === campaign.id ? 'active' : ''}
              onClick={() => handleCampaignClick(campaign)}
            >
              {campaign.name || 'Untitled Campaign'}
            </StyledIntroductionNavElement>
            <IconTrash
              size={16}
              stroke={1.5}
              style={{ cursor: 'pointer' }}
              onClick={() => deleteCampaign(campaign.id)}
            />
          </StyledListItem>
        ))}
      </StyledQuestionsContainer>
      <StyledButton onClick={addCampaign}>
        <IconPlus size={16} />
        Add Campaign
      </StyledButton>
    </StyledModalNavElementContainer>
  );
};

export const DripCampaignLeftSideContainer = () => {
  return (
    <StyledContainer>
      <div>Drip Campaigns</div>
      <ScrollableContent>
        <ModalNavElementContainer />
      </ScrollableContent>
    </StyledContainer>
  );
};
