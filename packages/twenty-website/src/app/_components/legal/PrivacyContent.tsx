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

      <StyledParagraph>
        This Privacy Policy describes how your personal information is
        collected, used, and shared when you visit or make a purchase from{' '}
        <StyledLink href="https://arxena.com/">
          https://arxena.com/
        </StyledLink>{' '}
        (the &quot;Site&quot;).
      </StyledParagraph>

      <StyledHeading>Retention and Use of Google APIs Data</StyledHeading>
      <StyledParagraph>
        We understand the importance of transparency and respect for user
        privacy when handling data obtained through Google APIs. Our application
        may collect user data through Google APIs to enhance functionalities and
        provide a seamless user experience. However, it&apos;s crucial to note
        that we do not use this data for developing, improving, or training AI
        and/or ML models that are personalized.
      </StyledParagraph>
      <StyledParagraph>
        Any data obtained through Google APIs is utilized solely for the
        intended purposes of the application&apos;s functionalities. We do not
        retain user data for secondary purposes. Users have the right to know
        how their data is being utilized and can manage their preferences
        accordingly through the application settings.
      </StyledParagraph>

      <StyledHeading>
        Data Protection Mechanisms for Sensitive Data
      </StyledHeading>
      <StyledParagraph>
        Protecting the privacy and security of our users&apos; sensitive data is
        of utmost importance to us. While our privacy policy outlines our
        commitment to safeguarding user information, we recognize the need for
        specific data protection mechanisms, especially concerning sensitive
        data.
      </StyledParagraph>
      <StyledParagraph>
        Sensitive data, including, but not limited to, personally identifiable
        information, and financial information is treated with the highest level
        of care and attention. We employ industry-standard encryption protocols,
        access controls, and other technical safeguards to prevent unauthorized
        access, disclosure, or misuse of sensitive data.
      </StyledParagraph>
      <StyledParagraph>
        Furthermore, we conduct regular security audits and compliance checks to
        ensure that our data protection measures remain robust and effective.
        Our commitment to maintaining the confidentiality and integrity of
        sensitive data extends to compliance with relevant data protection
        regulations.
      </StyledParagraph>

      <StyledHeading>Personal Information We Collect</StyledHeading>
      <StyledParagraph>
        When you visit the Site, we automatically collect certain information
        about your device, including information about your web browser, IP
        address, time zone, and some of the cookies that are installed on your
        device. Additionally, as you browse the Site, we collect information
        about the individual web pages or products that you view, what websites
        or search terms referred you to the Site, and information about how you
        interact with the Site. We refer to this automatically-collected
        information as &quot;Device Information.&quot;
      </StyledParagraph>
      <StyledParagraph>
        We collect Device Information using the following technologies:
      </StyledParagraph>
      <StyledList>
        <li>
          &quot;Cookies&quot; are data files that are placed on your device or
          computer and often include an anonymous unique identifier. For more
          information about cookies, and how to disable cookies, visit{' '}
          <StyledAnchor
            href="http://www.allaboutcookies.org"
            target="_blank"
            rel="noreferrer"
          >
            http://www.allaboutcookies.org
          </StyledAnchor>
          .
        </li>
        <li>
          &quot;Log files&quot; track actions occurring on the Site, and collect
          data including your IP address, browser type, Internet service
          provider, referring/exit pages, and date/time stamps.
        </li>
        <li>
          &quot;Web beacons,&quot; &quot;tags,&quot; and &quot;pixels&quot; are
          electronic files used to record information about how you browse the
          Site.
        </li>
      </StyledList>
      <StyledParagraph>
        Additionally when you make a purchase or attempt to make a purchase
        through the Site, we collect certain information from you, including
        your name, billing address, shipping address, payment information
        (including credit card numbers), email address, phone number, and
        company search information. We refer to this information as &quot;Order
        Information.&quot;
      </StyledParagraph>
      <StyledParagraph>
        When we talk about &quot;Personal Information&quot; in this Privacy
        Policy, we are talking both about Device Information and Order
        Information.
      </StyledParagraph>

      <StyledHeading>How Do We Use Your Personal Information?</StyledHeading>
      <StyledParagraph>
        We use the Order Information that we collect generally to fulfill any
        orders placed through the Site (including processing your payment
        information, arranging for shipping, and providing you with invoices
        and/or order confirmations). Additionally, we use this Order Information
        to: communicate with you; screen our orders for potential risk or fraud;
        and when in line with the preferences you have shared with us, provide
        you with information or advertising relating to our products or
        services.
      </StyledParagraph>
      <StyledParagraph>
        We use the Device Information that we collect to help us screen for
        potential risk and fraud (in particular, your IP address), and more
        generally to improve and optimize our Site (for example, by generating
        analytics about how our customers browse and interact with the Site, and
        to assess the success of our marketing and advertising campaigns).
      </StyledParagraph>

      <StyledHeading>Your Rights</StyledHeading>
      <StyledParagraph>
        If you are a European resident, you have the right to access personal
        information we hold about you and to ask that your personal information
        be corrected, updated, or deleted. If you would like to exercise this
        right, please contact us through the contact information below.
      </StyledParagraph>
      <StyledParagraph>
        Additionally, if you are a European resident we note that we are
        processing your information in order to fulfill contracts we might have
        with you (for example if you make an order through the Site), or
        otherwise to pursue our legitimate business interests listed above.
        Additionally, please note that your information will be transferred
        outside of Europe, including to Canada and the United States.
      </StyledParagraph>

      <StyledHeading>Changes</StyledHeading>
      <StyledParagraph>
        We may update this privacy policy from time to time in order to reflect,
        for example, changes to our practices or for other operational, legal or
        regulatory reasons.
      </StyledParagraph>

      <StyledHeading>Contact Us</StyledHeading>
      <StyledParagraph>
        For more information about our privacy practices, if you have questions,
        or if you would like to make a complaint, please contact us by e-mail at{' '}
        <StyledLink href={`mailto:${COMPANY_INFO.email}`}>
          {COMPANY_INFO.email}
        </StyledLink>{' '}
        or by mail using the details provided below:
      </StyledParagraph>
      <StyledParagraph>
        {COMPANY_INFO.name}
        <br />
        {COMPANY_INFO.addresses.map((addr) => (
          <span key={addr}>
            {addr}
            <br />
          </span>
        ))}
        Email: {COMPANY_INFO.email}
      </StyledParagraph>
    </StyledSection>
  );
};
