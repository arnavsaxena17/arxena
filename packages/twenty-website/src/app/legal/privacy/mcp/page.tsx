import { getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';

import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'MCP Connector Privacy Policy | Arxena',
  description:
    'Privacy policy for the Arxena MCP connector used with Claude, ChatGPT, Cursor, and other MCP clients.',
  alternates: {
    canonical: '/legal/privacy/mcp',
  },
};

export default function McpPrivacyPage() {
  const signInUrl = getSignInUrl();
  const signUpUrl = getSignUpUrl();

  return (
    <>
      <Header showSearch={false} signInUrl={signInUrl} signUpUrl={signUpUrl} />
      <ContentContainer>
        <article style={{ maxWidth: 720, margin: '0 auto', lineHeight: 1.6 }}>
          <h1>Arxena MCP Connector Privacy Policy</h1>
          <p>Last updated: June 30, 2026</p>

          <h2>Overview</h2>
          <p>
            The Arxena MCP (Model Context Protocol) connector lets authorized AI
            clients access recruitment and org-chart data from your Arxena
            workspace when you connect with an API key or OAuth consent.
          </p>

          <h2>Data we process</h2>
          <ul>
            <li>Workspace jobs, candidates, companies, and people records</li>
            <li>Org chart structures and executive profile metadata</li>
            <li>LinkedIn and contact enrichment data available in your workspace</li>
            <li>Messages and outreach history when write tools are invoked</li>
          </ul>

          <h2>How data is used</h2>
          <p>
            Data is returned only to the MCP client you authorize (for example
            Claude, ChatGPT, or Cursor) to answer your prompts. Arxena does not
            sell MCP tool responses to third parties.
          </p>

          <h2>Storage and retention</h2>
          <p>
            MCP sessions are short-lived. OAuth authorization codes expire in
            minutes. API key tokens follow the expiration you configure in
            Settings → Developers → API Keys. Underlying CRM data retention
            follows your workspace policies.
          </p>

          <h2>Third-party sharing</h2>
          <p>
            When you use enrichment or messaging tools, data may be sent to
            integrated providers (for example LinkedIn via Unipile) according to
            your workspace configuration.
          </p>

          <h2>Contact</h2>
          <p>
            Questions: <a href="mailto:support@arxena.com">support@arxena.com</a>
          </p>

          <p>
            See also our general{' '}
            <a href="/legal/privacy">Arxena Privacy Policy</a>.
          </p>
        </article>
      </ContentContainer>
    </>
  );
}
