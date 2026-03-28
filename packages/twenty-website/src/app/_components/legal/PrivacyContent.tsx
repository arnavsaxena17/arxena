'use client';

import styled from '@emotion/styled';
import Link from 'next/link';

import { COMPANY_INFO } from '@/lib/company-info';

const StyledSection = styled.section`
  max-width: 720px;
  margin: 0 auto;
  padding: 64px 24px 96px;
`;

const StyledHeadline = styled.h1`
  font-size: clamp(2rem, 4vw, 2.5rem);
  font-weight: 600;
  line-height: 1.2;
  margin: 0 0 32px 0;
  color: #141414;
`;

const StyledParagraph = styled.p`
  font-size: 16px;
  line-height: 1.7;
  color: #474747;
  margin: 0 0 20px 0;
  font-family: var(--font-inter);
`;

const StyledHeading = styled.h2`
  font-size: 18px;
  font-weight: 600;
  color: #141414;
  margin: 32px 0 16px 0;
  font-family: var(--font-inter);
`;

const StyledSubheading = styled.h3`
  font-size: 16px;
  font-weight: 600;
  color: #141414;
  margin: 20px 0 8px 0;
  font-family: var(--font-inter);
`;

const StyledList = styled.ul`
  margin: 0 0 20px 0;
  padding-left: 24px;
  font-size: 16px;
  line-height: 1.7;
  color: #474747;
  font-family: var(--font-inter);
`;

const StyledLink = styled(Link)`
  color: #2563eb;
  text-decoration: none;
  &:hover {
    text-decoration: underline;
  }
`;

const StyledAnchor = styled.a`
  color: #2563eb;
  text-decoration: none;
  &:hover {
    text-decoration: underline;
  }
`;

export const PrivacyContent = () => {
  return (
    <StyledSection>
      <StyledHeadline>Arxena – Privacy Policy</StyledHeadline>

      <StyledParagraph>Last updated: March 27, 2025</StyledParagraph>

      <StyledParagraph>
        This Privacy Policy describes how Arxena (&quot;we&quot;, &quot;our&quot;,
        &quot;us&quot;) collects, uses, and shares information when you use the
        Arxena website, web application, and Chrome extension (the
        &quot;Service&quot;).
      </StyledParagraph>

      <StyledParagraph>
        This policy applies to{' '}
        <StyledLink href="https://arxena.com">https://arxena.com</StyledLink>,{' '}
        <StyledAnchor href="https://app.arxena.com">
          app.arxena.com
        </StyledAnchor>
        , and the Arxena Chrome Extension.
      </StyledParagraph>

      <StyledHeading>1. Purpose of the Service</StyledHeading>
      <StyledParagraph>
        Arxena provides recruiting, sales, and workflow automation tools that
        allow users to capture profile data, manage contacts, and communicate
        with candidates or leads across supported platforms such as LinkedIn,
        Naukri, WhatsApp Web, and the Arxena web application.
      </StyledParagraph>
      <StyledParagraph>
        The Chrome extension operates only to provide these user-requested
        features.
      </StyledParagraph>

      <StyledHeading>2. Information We Collect</StyledHeading>
      <StyledParagraph>
        We collect information only when required to provide the functionality
        requested by the user.
      </StyledParagraph>
      <StyledParagraph>
        The extension may access the following types of information:
      </StyledParagraph>

      <StyledSubheading>Account Information</StyledSubheading>
      <StyledList>
        <li>Name</li>
        <li>Email address</li>
        <li>Workspace / organization information</li>
        <li>Login tokens required for authentication</li>
      </StyledList>

      <StyledSubheading>Platform Data (when the user uses the feature)</StyledSubheading>
      <StyledList>
        <li>Profile data from LinkedIn or Naukri pages viewed by the user</li>
        <li>Resume / CV files downloaded by the user</li>
        <li>Message content the user chooses to send through the extension</li>
        <li>Contact details visible on pages the user opens</li>
        <li>
          WhatsApp Web message data only when the user enables related features
        </li>
      </StyledList>

      <StyledSubheading>Cookies and Authentication Data</StyledSubheading>
      <StyledList>
        <li>
          Session cookies required to connect the user&apos;s account to
          supported platforms
        </li>
        <li>
          Example: LinkedIn or Naukri session cookies used only to authenticate
          requests on behalf of the user
        </li>
      </StyledList>

      <StyledSubheading>Device &amp; Usage Data</StyledSubheading>
      <StyledList>
        <li>Browser type</li>
        <li>IP address</li>
        <li>Extension usage logs</li>
        <li>Error logs</li>
        <li>Feature usage events</li>
      </StyledList>

      <StyledParagraph>
        We do NOT collect data unrelated to the features used by the user.
      </StyledParagraph>

      <StyledHeading>3. How We Use Information</StyledHeading>
      <StyledParagraph>We use collected information only to:</StyledParagraph>
      <StyledList>
        <li>Provide extension functionality requested by the user</li>
        <li>Sync data with the Arxena web application</li>
        <li>Enable integrations with supported platforms</li>
        <li>Download or upload files requested by the user</li>
        <li>Send messages requested by the user</li>
        <li>Maintain user sessions</li>
        <li>Prevent fraud or abuse</li>
        <li>Improve reliability and performance</li>
      </StyledList>
      <StyledParagraph>We do NOT sell personal data.</StyledParagraph>
      <StyledParagraph>We do NOT use user data for advertising.</StyledParagraph>
      <StyledParagraph>
        We do NOT use user data to train AI models.
      </StyledParagraph>

      <StyledHeading>4. Data From Third-Party Platforms</StyledHeading>
      <StyledParagraph>
        When the user enables features involving third-party sites such as
        LinkedIn, Naukri, or WhatsApp Web:
      </StyledParagraph>
      <StyledList>
        <li>Data is accessed only from pages the user actively opens</li>
        <li>
          Cookies are used only to authenticate the user&apos;s own account
        </li>
        <li>
          Data is transferred only to the Arxena service to provide the
          requested feature
        </li>
      </StyledList>
      <StyledParagraph>
        We do not access data from these platforms unless the user installs the
        extension and uses the feature.
      </StyledParagraph>

      <StyledHeading>5. Data Sharing</StyledHeading>
      <StyledParagraph>We may share data only with:</StyledParagraph>
      <StyledList>
        <li>Arxena backend services</li>
        <li>Cloud hosting providers</li>
        <li>Infrastructure providers required to operate the service</li>
      </StyledList>
      <StyledParagraph>We do not sell or rent user data.</StyledParagraph>
      <StyledParagraph>We do not share data for advertising.</StyledParagraph>
      <StyledParagraph>We do not share data with data brokers.</StyledParagraph>

      <StyledHeading>6. Data Retention</StyledHeading>
      <StyledParagraph>
        We retain data only as long as necessary to provide the service.
      </StyledParagraph>
      <StyledParagraph>
        Users may request deletion of their data at any time by contacting
        support.
      </StyledParagraph>
      <StyledParagraph>
        Session cookies and temporary data may be stored only for the duration
        of the session.
      </StyledParagraph>

      <StyledHeading>7. Chrome Extension Permissions</StyledHeading>
      <StyledParagraph>
        The extension requests permissions only to provide its features,
        including:
      </StyledParagraph>
      <StyledList>
        <li>Access to supported websites to read profile data</li>
        <li>Cookies permission to authenticate user sessions</li>
        <li>Storage to store user settings</li>
        <li>Tabs to open pages requested by the user</li>
        <li>Downloads to save files requested by the user</li>
        <li>Notifications to show status updates</li>
      </StyledList>
      <StyledParagraph>
        Permissions are not used for unrelated purposes.
      </StyledParagraph>

      <StyledHeading>8. Security</StyledHeading>
      <StyledParagraph>We use industry-standard safeguards including:</StyledParagraph>
      <StyledList>
        <li>HTTPS encryption</li>
        <li>Access controls</li>
        <li>Secure storage</li>
        <li>Authentication checks</li>
      </StyledList>
      <StyledParagraph>We take reasonable steps to protect user data.</StyledParagraph>

      <StyledHeading>9. Google API Data</StyledHeading>
      <StyledParagraph>
        If Google APIs are used, data obtained from Google APIs is used only to
        provide user-requested features.
      </StyledParagraph>
      <StyledParagraph>
        We do not use Google API data to develop, improve, or train generalized
        AI or ML models.
      </StyledParagraph>

      <StyledHeading>10. User Rights</StyledHeading>
      <StyledParagraph>Users may request to:</StyledParagraph>
      <StyledList>
        <li>Access their data</li>
        <li>Correct their data</li>
        <li>Delete their data</li>
        <li>Export their data</li>
      </StyledList>
      <StyledParagraph>
        Contact:{' '}
        <StyledLink href={`mailto:${COMPANY_INFO.email}`}>
          {COMPANY_INFO.email}
        </StyledLink>
      </StyledParagraph>

      <StyledHeading>11. Changes</StyledHeading>
      <StyledParagraph>
        We may update this policy when required by law or when the Service
        changes.
      </StyledParagraph>
      <StyledParagraph>The latest version will always be available at:</StyledParagraph>
      <StyledParagraph>
        <StyledLink href="https://arxena.com/legal/privacy">
          https://www.arxena.com/legal/privacy
        </StyledLink>
      </StyledParagraph>

      <StyledHeading>12. Contact</StyledHeading>
      <StyledParagraph>
        {COMPANY_INFO.name}
        <br />
        {COMPANY_INFO.addresses.map((addr) => (
          <span key={addr}>
            {addr}
            <br />
          </span>
        ))}
        Email:{' '}
        <StyledLink href={`mailto:${COMPANY_INFO.email}`}>
          {COMPANY_INFO.email}
        </StyledLink>
        <br />
        Website:{' '}
        <StyledLink href="https://arxena.com">https://arxena.com</StyledLink>
      </StyledParagraph>
    </StyledSection>
  );
};