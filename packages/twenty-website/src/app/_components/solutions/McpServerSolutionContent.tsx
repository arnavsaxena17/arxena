'use client';

import styled from '@emotion/styled';
import Link from 'next/link';

import {
    MCP_DOCS_URL,
    MCP_OAUTH_ISSUER_URL,
    MCP_REMOTE_CONFIG_EXAMPLE,
    MCP_SERVER_SOLUTION_PAGE,
    MCP_SERVER_URL,
    MCP_STDIO_CONFIG_EXAMPLE,
} from '@/lib/mcp-server-solution-content';

const StyledSection = styled.section`
  max-width: 720px;
  margin: 0 auto;
  padding: 48px 24px 96px;
`;

const StyledBack = styled(Link)`
  display: inline-flex;
  align-items: center;
  font-size: 15px;
  color: #818181;
  text-decoration: none;
  margin-bottom: 32px;

  &:hover {
    color: #141414;
    text-decoration: underline;
  }
`;

const StyledHeadline = styled.h1`
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 600;
  line-height: 1.15;
  margin: 0 0 20px 0;
  color: #141414;
`;

const StyledLead = styled.p`
  font-size: 18px;
  line-height: 1.65;
  color: #474747;
  margin: 0 0 36px 0;
`;

const StyledBlockTitle = styled.h2`
  font-size: 20px;
  font-weight: 600;
  margin: 40px 0 12px 0;
  color: #141414;
`;

const StyledParagraph = styled.p`
  font-size: 16px;
  line-height: 1.65;
  color: #474747;
  margin: 0 0 16px 0;
`;

const StyledOrderedList = styled.ol`
  margin: 0 0 8px 0;
  padding-left: 1.25rem;
  color: #474747;
  font-size: 16px;
  line-height: 1.65;

  li {
    margin-bottom: 12px;
  }
`;

const StyledBulletList = styled.ul`
  margin: 0;
  padding-left: 1.25rem;
  color: #474747;
  font-size: 16px;
  line-height: 1.65;

  li {
    margin-bottom: 10px;
  }
`;

const StyledPre = styled.pre`
  background: #f5f5f5;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.5;
  overflow-x: auto;
  padding: 16px;
  margin: 12px 0 0 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: #141414;
`;

const StyledInlineCode = styled.code`
  background: #f5f5f5;
  border-radius: 4px;
  font-size: 0.92em;
  padding: 2px 6px;
`;

const StyledLink = styled.a`
  color: #141414;
  text-decoration: underline;

  &:hover {
    color: #474747;
  }
`;

const StyledNote = styled.p`
  font-size: 15px;
  line-height: 1.6;
  color: #818181;
  margin: 16px 0 0 0;
  padding-top: 20px;
  border-top: 1px solid rgba(20, 20, 20, 0.08);
`;

type McpServerSolutionContentProps = {
  developersSettingsUrl: string;
  signUpUrl: string;
};

export const McpServerSolutionContent = ({
  developersSettingsUrl,
  signUpUrl,
}: McpServerSolutionContentProps) => {
  return (
    <StyledSection>
      <StyledBack href="/solutions">← All solutions</StyledBack>
      <StyledHeadline>{MCP_SERVER_SOLUTION_PAGE.headline}</StyledHeadline>
      <StyledLead>{MCP_SERVER_SOLUTION_PAGE.lead}</StyledLead>

      <StyledBlockTitle>1. Create an API key</StyledBlockTitle>
      <StyledOrderedList>
        <li>
          Sign in to{' '}
          <StyledLink href={developersSettingsUrl}>
            Arxena Settings → Developers
          </StyledLink>{' '}
          (workspace admin required).
        </li>
        <li>
          Create an API key and copy the JWT token. You will paste this into your
          MCP client as <StyledInlineCode>X-API-KEY</StyledInlineCode> or{' '}
          <StyledInlineCode>Authorization: Bearer</StyledInlineCode>.
        </li>
        <li>
          The MCP connector section on the API key detail page shows a
          ready-to-copy config with your token filled in.
        </li>
      </StyledOrderedList>

      <StyledBlockTitle>2. Remote MCP (recommended)</StyledBlockTitle>
      <StyledParagraph>
        Use the hosted endpoint at{' '}
        <StyledLink href={MCP_SERVER_URL}>{MCP_SERVER_URL}</StyledLink> for
        Cursor, Claude custom connectors, and other clients that support remote
        MCP over HTTP.
      </StyledParagraph>
      <StyledPre>{MCP_REMOTE_CONFIG_EXAMPLE}</StyledPre>
      <StyledParagraph>
        In <strong>Cursor</strong>: open Settings → MCP → add a custom server and
        paste the JSON above (replace the placeholder with your API key JWT).
      </StyledParagraph>

      <StyledBlockTitle>3. Local MCP (Claude Desktop)</StyledBlockTitle>
      <StyledParagraph>
        Run the stdio server on your machine when a remote connector is not
        available. Clone the Arxena repo, build{' '}
        <StyledInlineCode>packages/twenty-mcp-server</StyledInlineCode>, then
        point Claude Desktop at <StyledInlineCode>dist/index.js</StyledInlineCode>
        :
      </StyledParagraph>
      <StyledPre>{MCP_STDIO_CONFIG_EXAMPLE}</StyledPre>

      <StyledBlockTitle>4. Claude &amp; ChatGPT app directories (OAuth)</StyledBlockTitle>
      <StyledParagraph>
        Published directory integrations use OAuth 2.1 against{' '}
        <StyledInlineCode>{MCP_OAUTH_ISSUER_URL}</StyledInlineCode>. Connect
        through the app store flow; at consent, paste your workspace API key JWT
        to authorize access to your data.
      </StyledParagraph>
      <StyledParagraph>
        Claude callback URL:{' '}
        <StyledInlineCode>https://claude.ai/api/mcp/auth_callback</StyledInlineCode>
      </StyledParagraph>

      <StyledBlockTitle>What you can do</StyledBlockTitle>
      <StyledBulletList>
        <li>Search and fetch company org charts and leadership structure</li>
        <li>Query and update candidates, jobs, companies, and people</li>
        <li>Run LinkedIn search and enrichment workflows</li>
        <li>Draft and send outreach across connected channels</li>
        <li>Use OpenAI-compatible search and fetch tools for company knowledge</li>
      </StyledBulletList>

      <StyledBlockTitle>Reference</StyledBlockTitle>
      <StyledBulletList>
        <li>
          Live docs: <StyledLink href={MCP_DOCS_URL}>{MCP_DOCS_URL}</StyledLink>
        </li>
        <li>
          Privacy policy:{' '}
          <StyledLink href="/legal/privacy/mcp">MCP connector privacy</StyledLink>
        </li>
        <li>
          Support:{' '}
          <StyledLink href="mailto:support@arxena.com">support@arxena.com</StyledLink>
        </li>
      </StyledBulletList>

      <StyledNote>
        New to Arxena?{' '}
        <StyledLink href={signUpUrl}>Create a workspace</StyledLink> first, then
        generate an API key from Developers settings.
      </StyledNote>
    </StyledSection>
  );
};
