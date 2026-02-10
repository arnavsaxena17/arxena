import styled from '@emotion/styled';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { IconDatabase } from 'twenty-ui';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { ArxDownloadModal } from '@/candidate-table/components/ArxDownloadModal';
import { CandidateTablePageHeader } from '@/candidate-table/components/CandidateTablePageHeader';
import { useChromeExtensionDetection } from '@/candidate-table/hooks/useChromeExtensionDetection';
import { AppPath } from '@/types/AppPath';
import { useBaileysConnection } from '../baileys/contexts/BaileysContext';
import { useUnipile } from '../unipile/contexts/UnipileContext';

import { ArxOrgChart } from './ArxOrgChart';

const StyledPageContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  overflow: hidden;
  background: ${({ theme }) => theme.background.primary};
`;

const StyledContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const StyledEmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: ${({ theme }) => theme.spacing(4)};
  color: ${({ theme }) => theme.font.color.tertiary};
  text-align: center;
`;

const StyledEmptyTitle = styled.h3`
  margin: 0 0 ${({ theme }) => theme.spacing(2)};
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme }) => theme.font.color.primary};
`;

function OrgChart() {
  const tokenPair = useRecoilValue(tokenPairState);
  const accessToken = tokenPair?.accessToken?.token ?? null;
  const navigate = useNavigate();
  const { companyKey } = useParams<{ companyKey?: string }>();
  const companyIdFromUrl = companyKey ?? null;

  const [selectedCompany, setSelectedCompany] = useState<{
    companyId: string;
    companyName: string;
    website?: string;
    locationName?: string;
    industry?: string;
    profileCount?: number;
    linkedinUrl?: string;
  } | null>(null);

  const { isBaileysLoggedIn } = useBaileysConnection();
  const { isLinkedinConnected, isWhatsappUnipileConnected } = useUnipile();
  const isWhatsappLoggedIn = isBaileysLoggedIn || isWhatsappUnipileConnected;
  const { isExtensionInstalled } = useChromeExtensionDetection();
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

  useEffect(() => {
    if (companyIdFromUrl) {
      setSelectedCompany({
        companyId: companyIdFromUrl,
        companyName: companyIdFromUrl,
      });
    } else {
      setSelectedCompany(null);
    }
  }, [companyIdFromUrl]);

  const handleCompanySelect = useCallback(
    (company: {
      companyId: string;
      companyName: string;
      website?: string;
      locationName?: string;
      industry?: string;
      profileCount?: number;
      linkedinUrl?: string;
    }) => {
      setSelectedCompany(company);
      navigate(`/${AppPath.OrgChart}/${company.companyId}`, { replace: true });
    },
    [navigate],
  );

  const handleGoToJobs = () => {
    navigate(`/${AppPath.Jobs}`);
  };

  const handleDownloadClick = () => {
    setIsDownloadModalOpen(true);
  };

  if (!accessToken) {
    return (
      <StyledPageContainer>
        <StyledEmptyState>
          <StyledEmptyTitle>Please sign in to view org charts.</StyledEmptyTitle>
        </StyledEmptyState>
      </StyledPageContainer>
    );
  }

  return (
    <StyledPageContainer>
      <CandidateTablePageHeader
        title="Org charts"
        Icon={IconDatabase}
        onAddJob={handleGoToJobs}
        onCompanySelect={handleCompanySelect}
        hasToken={!!accessToken}
        isExtensionInstalled={isExtensionInstalled}
        onDownloadClick={handleDownloadClick}
        isLinkedinConnected={isLinkedinConnected}
        isWhatsappLoggedIn={isWhatsappLoggedIn}
      />
      <StyledContent>
        {selectedCompany ? (
          <ArxOrgChart
            companyId={selectedCompany.companyId}
            companyName={selectedCompany.companyName}
            website={selectedCompany.website}
            locationName={selectedCompany.locationName}
            industry={selectedCompany.industry}
            profileCount={selectedCompany.profileCount}
            linkedinUrl={selectedCompany.linkedinUrl}
          />
        ) : (
          <StyledEmptyState>
            <StyledEmptyTitle>Select a company to view its org chart</StyledEmptyTitle>
            <p>Use the search bar above to find and select a company.</p>
          </StyledEmptyState>
        )}
      </StyledContent>
      <ArxDownloadModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
      />
    </StyledPageContainer>
  );
}

export default OrgChart;
