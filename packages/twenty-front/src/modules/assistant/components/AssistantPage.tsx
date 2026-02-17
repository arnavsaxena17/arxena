import { McpClientChat } from '@/assistant/components/McpClientChat';
import { AppPath } from '@/types/AppPath';
import { PageBody } from '@/ui/layout/page/components/PageBody';
import { PageContainer } from '@/ui/layout/page/components/PageContainer';
import { SubMenuTopBarContainer } from '@/ui/layout/page/components/SubMenuTopBarContainer';
import styled from '@emotion/styled';
import { H2Title } from 'twenty-ui';

const StyledPageContainer = styled(PageContainer)`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const StyledPageBody = styled(PageBody)`
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

export const AssistantPage = () => {
  return (
    <StyledPageContainer>
      <SubMenuTopBarContainer links={[{ children: 'Assistant', href: AppPath.Assistant }]}>
        <H2Title title="Assistant" />
      </SubMenuTopBarContainer>
      <StyledPageBody>
        <McpClientChat />
      </StyledPageBody>
    </StyledPageContainer>
  );
};
