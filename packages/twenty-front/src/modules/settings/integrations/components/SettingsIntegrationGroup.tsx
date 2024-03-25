import styled from '@emotion/styled';

import { SettingsIntegrationComponent } from '@/settings/integrations/components/SettingsIntegrationComponent';
import { SettingsIntegrationCategory } from '@/settings/integrations/types/SettingsIntegrationCategory';
import { H2Title } from '@/ui/display/typography/components/H2Title';
import { Section } from '@/ui/layout/section/components/Section';

interface SettingsIntegrationGroupProps {
  integrationGroup: SettingsIntegrationCategory;
}

const StyledIntegrationGroupHeader = styled.div`
  align-items: start;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`;

const StyledGroupLink = styled.div`
  align-items: start;
  display: flex;
  flex-direction: row;
  font-size: ${({ theme }) => theme.font.size.md};
  gap: ${({ theme }) => theme.spacing(1)};
  cursor: pointer;
`;

const StyledIntegrationsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing(4)};
`;

export const SettingsIntegrationGroup = ({
  integrationGroup,
}: SettingsIntegrationGroupProps) => (
  <Section>
    <StyledIntegrationGroupHeader>
      <H2Title title={integrationGroup.title} />
      {integrationGroup.hyperlink && (
        <StyledGroupLink
          onClick={() => window.open(integrationGroup.hyperlink ?? '')}
        >
          <div>{integrationGroup.hyperlinkText}</div>
          <div>→</div>
        </StyledGroupLink>
      )}
    </StyledIntegrationGroupHeader>
    <StyledIntegrationsSection>
      {integrationGroup.integrations.map((integration) => (
        <SettingsIntegrationComponent
          key={[
            integrationGroup.key,
            integration.from.key,
            integration.to?.key,
          ].join('-')}
          integration={integration}
        />
      ))}
    </StyledIntegrationsSection>
  </Section>
);
