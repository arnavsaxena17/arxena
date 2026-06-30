import styled from '@emotion/styled';
import { H2Title, Section } from 'twenty-ui';

import { useLingui } from '@lingui/react/macro';

const StyledPre = styled.pre`
  background: ${({ theme }) => theme.background.secondary};
  border-radius: ${({ theme }) => theme.border.radius.sm};
  font-size: ${({ theme }) => theme.font.size.sm};
  overflow-x: auto;
  padding: ${({ theme }) => theme.spacing(3)};
  white-space: pre-wrap;
  word-break: break-all;
`;

type SettingsDevelopersMcpConnectorSectionProps = {
  apiKeyToken: string;
};

const MCP_PUBLIC_URL =
  import.meta.env.VITE_MCP_PUBLIC_URL ?? 'https://mcp.arxena.com/mcp';

export const SettingsDevelopersMcpConnectorSection = ({
  apiKeyToken,
}: SettingsDevelopersMcpConnectorSectionProps) => {
  const { t } = useLingui();

  const remoteConfig = JSON.stringify(
    {
      mcpServers: {
        arxena: {
          url: MCP_PUBLIC_URL,
          headers: {
            'X-API-KEY': apiKeyToken,
          },
        },
      },
    },
    null,
    2,
  );

  const stdioConfig = JSON.stringify(
    {
      mcpServers: {
        arxena: {
          command: 'node',
          args: ['/path/to/twenty-mcp-server/dist/index.js'],
          env: {
            ARXENA_API_TOKEN: apiKeyToken,
            ARXENA_BASE_URL:
              import.meta.env.VITE_SERVER_BASE_URL ?? 'https://arxena.com',
          },
        },
      },
    },
    null,
    2,
  );

  return (
    <>
      <Section>
        <H2Title
          title={t`Remote MCP (Cursor / Claude custom connector)`}
          description={t`Paste into your MCP client config. The X-API-KEY value is this API key token.`}
        />
        <StyledPre>{remoteConfig}</StyledPre>
      </Section>
      <Section>
        <H2Title
          title={t`Local MCP (Claude Desktop stdio)`}
          description={t`Use when running twenty-mcp-server locally on your machine.`}
        />
        <StyledPre>{stdioConfig}</StyledPre>
      </Section>
      <Section>
        <H2Title
          title={t`Directory publication`}
          description={t`Claude and ChatGPT app directories require OAuth via https://mcp.arxena.com — not API key headers alone.`}
        />
      </Section>
    </>
  );
};
