'use client';

import styled from '@emotion/styled';
import Link from 'next/link';

import {
  ORG_CHART_EMBED_DOCS_PATH,
  ORG_CHART_EMBED_SOLUTION_PAGE,
  ORG_CHART_EMBED_SNIPPET_EXAMPLE,
} from '@/lib/org-chart-embed-solution-content';

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

type OrgChartEmbedSolutionContentProps = {
  developersSettingsUrl: string;
  signUpUrl: string;
};

export const OrgChartEmbedSolutionContent = ({
  developersSettingsUrl,
  signUpUrl,
}: OrgChartEmbedSolutionContentProps) => {
  return (
    <StyledSection>
      <StyledBack href="/solutions">← All solutions</StyledBack>
      <StyledHeadline>{ORG_CHART_EMBED_SOLUTION_PAGE.headline}</StyledHeadline>
      <StyledLead>{ORG_CHART_EMBED_SOLUTION_PAGE.lead}</StyledLead>

      <StyledBlockTitle>1. Create an embed key</StyledBlockTitle>
      <StyledOrderedList>
        <li>
          Sign in to{' '}
          <StyledLink href={developersSettingsUrl}>
            Arxena Settings → Developers → Org chart embed
          </StyledLink>
          .
        </li>
        <li>
          Choose <strong>live</strong> (domain lookup) or{' '}
          <strong>published</strong> (fixed snapshot) mode.
        </li>
        <li>
          Add allowed origins for your site (e.g.{' '}
          <StyledInlineCode>https://www.yourcompany.com</StyledInlineCode>).
        </li>
      </StyledOrderedList>

      <StyledBlockTitle>2. Paste the snippet</StyledBlockTitle>
      <StyledParagraph>
        Copy the generated snippet from the embed detail page. The loader uses
        the branded <StyledInlineCode>function(A,r,x,e,n,a)</StyledInlineCode>{' '}
        pattern (spells ARXENA):
      </StyledParagraph>
      <StyledPre>{ORG_CHART_EMBED_SNIPPET_EXAMPLE}</StyledPre>

      <StyledBlockTitle>3. Verify on your site</StyledBlockTitle>
      <StyledParagraph>
        The chart loads in an iframe from arxena.com by default. Your origin must
        match the allowlist on the embed key.
      </StyledParagraph>

      <StyledBlockTitle>Use cases</StyledBlockTitle>
      <StyledBulletList>
        <li>Careers page leadership structure</li>
        <li>Investor relations and annual report embeds</li>
        <li>Sales enablement on customer account pages</li>
        <li>Partner portals with company structure context</li>
      </StyledBulletList>

      <StyledBlockTitle>Enterprise</StyledBlockTitle>
      <StyledBulletList>
        <li>Published snapshot mode for stable, S3-backed charts</li>
        <li>Custom branding and hide powered-by (paid plans)</li>
        <li>Usage analytics and webhooks</li>
        <li>Domain lock and higher rate limits</li>
      </StyledBulletList>

      <StyledBlockTitle>Reference</StyledBlockTitle>
      <StyledBulletList>
        <li>
          Developer docs:{' '}
          <StyledLink href="https://github.com/arxena/arxena/blob/main/docs/org-chart-embed.md">
            org-chart-embed.md
          </StyledLink>
        </li>
        <li>
          Solution page:{' '}
          <StyledLink href={ORG_CHART_EMBED_DOCS_PATH}>
            arxena.com{ORG_CHART_EMBED_DOCS_PATH}
          </StyledLink>
        </li>
      </StyledBulletList>

      <StyledNote>
        New to Arxena?{' '}
        <StyledLink href={signUpUrl}>Create a workspace</StyledLink> first, then
        create an embed key from Developers settings.
      </StyledNote>
    </StyledSection>
  );
};
