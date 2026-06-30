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

const ARXENA_BASE_URL =
  import.meta.env.VITE_SERVER_BASE_URL ?? 'https://app.arxena.com';

export const SettingsDevelopersMcpConnectorSection = ({
  apiKeyToken,
}: SettingsDevelopersMcpConnectorSectionProps) => {
  const { t } = useLingui();

  const cursorConfig = JSON.stringify(
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

  const claudeDesktopConfig = JSON.stringify(
    {
      mcpServers: {
        arxena: {
          command: 'npx',
          args: [
            '-y',
            'mcp-remote',
            MCP_PUBLIC_URL,
            '--header',
            'X-API-KEY: ${ARXENA_API_KEY}',
          ],
          env: {
            ARXENA_API_KEY: apiKeyToken,
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
            ARXENA_BASE_URL,
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
          title={t`Cursor (remote MCP)`}
          description={t`Paste into Cursor Settings → MCP. Uses url + headers (Streamable HTTP).`}
        />
        <StyledPre>{cursorConfig}</StyledPre>
      </Section>
      <Section>
        <H2Title
          title={t`Claude Desktop (remote MCP)`}
          description={t`Paste into claude_desktop_config.json. Claude Desktop only supports stdio — use the mcp-remote bridge with your API key in env.`}
        />
        <StyledPre>{claudeDesktopConfig}</StyledPre>
      </Section>
      <Section>
        <H2Title
          title={t`Claude Desktop (local stdio)`}
          description={t`Alternative: run twenty-mcp-server on your machine instead of mcp.arxena.com.`}
        />
        <StyledPre>{stdioConfig}</StyledPre>
      </Section>
      <Section>
        <H2Title
          title={t`Claude Connectors UI (OAuth)`}
          description={t`Settings → Connectors → add https://mcp.arxena.com/mcp for directory-style OAuth (no JSON config). ChatGPT app directory uses the same OAuth flow.`}
        />
      </Section>
    </>
  );
};
