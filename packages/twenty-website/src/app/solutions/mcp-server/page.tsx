import { Metadata } from 'next';

import { getAuthBaseUrl, getSignInUrl, getSignUpUrl } from '@/lib/auth-urls';
import { MCP_SERVER_SOLUTION_PAGE } from '@/lib/mcp-server-solution-content';

import { McpServerSolutionContent } from '@/app/_components/solutions/McpServerSolutionContent';
import { ContentContainer } from '@/app/_components/ui/layout/ContentContainer';
import { Header } from '@/app/_components/ui/layout/header';

export const metadata: Metadata = {
  title: `${MCP_SERVER_SOLUTION_PAGE.title} | Arxena`,
  description: MCP_SERVER_SOLUTION_PAGE.metaDescription,
  alternates: {
    canonical: `/solutions/${MCP_SERVER_SOLUTION_PAGE.slug}`,
  },
};

export default function McpServerSolutionPage() {
  const signInUrl = getSignInUrl();
  const signUpUrl = getSignUpUrl();
  const developersSettingsUrl = `${getAuthBaseUrl()}/settings/developers`;

  return (
    <>
      <Header showSearch={false} signInUrl={signInUrl} signUpUrl={signUpUrl} />
      <ContentContainer>
        <McpServerSolutionContent
          developersSettingsUrl={developersSettingsUrl}
          signUpUrl={signUpUrl}
        />
      </ContentContainer>
    </>
  );
}
