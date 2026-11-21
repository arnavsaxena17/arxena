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
  padding-left: ${themeCssVariables.spacing[3]};
  padding-right: 0;
`;

const StyledPageBody = styled(PageBody)`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[4]};
  max-width: 640px;
  padding: ${themeCssVariables.spacing[6]};
`;

const StyledTitle = styled.h2`
  color: ${themeCssVariables.font.color.primary};
  font-size: ${themeCssVariables.font.size.xl};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  margin: 0;
`;

const StyledCopy = styled.p`
  color: ${themeCssVariables.font.color.secondary};
  line-height: 1.5;
  margin: 0;
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
