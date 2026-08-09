import { useOpenAskAiPageInSidePanel } from '@/side-panel/hooks/useOpenAskAiPageInSidePanel';
import { PageBody } from '@/ui/layout/page/components/PageBody';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { PageHeader } from '@/ui/layout/page/components/PageHeader';
import { styled } from '@linaria/react';
import { IconMessage, IconSparkles } from 'twenty-ui/icon';
import { Button } from 'twenty-ui/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledPageContainer = styled(PageContainer)`
  height: 100%;
`;

const StyledPageHeader = styled(PageHeader)`
  padding: ${themeCssVariables.spacing[3]};
  padding-right: 0;
  padding-left: ${themeCssVariables.spacing[3]};
`;

const StyledPageBody = styled(PageBody)`
  padding: ${themeCssVariables.spacing[6]};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  max-width: 640px;
`;

const StyledTitle = styled.h2`
  margin: 0;
  font-size: ${themeCssVariables.font.size.xl};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  color: ${themeCssVariables.font.color.primary};
`;

const StyledCopy = styled.p`
  margin: 0;
  color: ${themeCssVariables.font.color.secondary};
  line-height: 1.5;
`;

export const AssistantPage = () => {
  const { openAskAiPage } = useOpenAskAiPageInSidePanel();

  return (
    <StyledPageContainer>
      <StyledPageHeader title="Assistant" Icon={IconMessage} />
      <StyledPageBody>
        <StyledTitle>Assistant moved to Ask AI</StyledTitle>
        <StyledCopy>
          The legacy Assistant chat page is retired. Use Ask AI in the side
          panel for CRM tools, Arxena GTM skills, and workspace MCP servers
          (Settings → AI → MCP servers).
        </StyledCopy>
        <div>
          <Button
            title="Open Ask AI"
            Icon={IconSparkles}
            variant="primary"
            onClick={() => openAskAiPage({ resetNavigationStack: true })}
          />
        </div>
      </StyledPageBody>
    </StyledPageContainer>
  );
};
