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

const StyledList = styled.ol`
  margin: 0 0 20px 0;
  padding-left: 24px;
  font-size: 16px;
  line-height: 1.7;
  color: #474747;
  font-family: var(--font-inter);
`;

const StyledUnorderedList = styled.ul`
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

const StyledAddressSection = styled.address`
  margin: 0 0 20px 0;
  font-size: 16px;
  line-height: 1.65;
  color: #474747;
  font-family: var(--font-inter);
  font-style: normal;
`;

const StyledCompanyName = styled.span`
  display: block;
  font-weight: 600;
  color: #141414;
  margin-bottom: 16px;
`;

const StyledOfficeBlock = styled.div`
  margin-top: 16px;
  border-left: 3px solid #e5e5e5;
  padding-left: 16px;

  &:first-of-type {
    margin-top: 0;
  }
`;

const StyledAddressEmailLine = styled.p`
  font-size: 16px;
  line-height: 1.7;
  color: #474747;
  margin: 16px 0 0 0;
  font-family: var(--font-inter);
`;

const StyledOfficeRegion = styled.span`
  display: block;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: #737373;
  margin-bottom: 6px;
`;

const StyledOfficeLines = styled.span`
  display: block;
  line-height: 1.6;
`;

export const TermsContent = () => {
  return (
    <StyledSection>
      <StyledHeadline>Arxena, Inc. – Terms of Service</StyledHeadline>

      <StyledParagraph>
        These Terms of Service are a legally binding agreement between Arxena,
        Inc. DBA Arxena (&quot;Arxena&quot;, &quot;the Company&quot;,
        &quot;we&quot; or &quot;us&quot;) and between you (&quot;user&quot; or
        &quot;you&quot;) and constitute legal basis for the download,
        installation, access and general use you (either an individual or
        entity) make from the Arxena website (&quot;Product&quot;).
      </StyledParagraph>
      <StyledParagraph>
        The Product, the Arxena website (
        <StyledLink href="https://arxena.com/">https://arxena.com/</StyledLink>)
        (the &quot;Site&quot;), including any feature, functionality, data and
        content therein will be herein referred to as the &quot;Services&quot;.
      </StyledParagraph>
      <StyledParagraph>
        Please read the Terms of Service carefully before using our Services.
      </StyledParagraph>
      <StyledParagraph>
        By accessing, using, downloading or installing our Services you
        acknowledge that you have read these Terms of Service and our{' '}
        <StyledLink href="/legal/privacy">Privacy Policy</StyledLink> which is
        incorporated herein by reference, as may be amended from time to time
        (collectively &quot;the Terms&quot;). These Terms shall govern any and
        all kind of use and features offered via the Services as may become
        available from time to time. You agree to be bound by these Terms and to
        fully comply with them.
      </StyledParagraph>
      <StyledParagraph>
        If you do not agree to any of the Terms you should immediately stop
        using the Services. In this case, you may not download, copy, access or
        install the Product or use any of our Services in any manner whatsoever.
      </StyledParagraph>

      <StyledHeading>The Product and Services</StyledHeading>
      <StyledParagraph>
        Our Services are designed to help users and vendors to map the
        organizational structure of their target accounts and find business
        profiles they seek. We operate as a data transformation, organization
        and visualization platform. Most of the base information Arxena
        retrieves is not created directly by Arxena, rather than retrieved from
        the web or from contribution of relevant data from other users and
        business partners. We then apply our proprietary algorithm to reorganize
        these base information into org chart diagrams which are present to our
        users.
      </StyledParagraph>
      <StyledParagraph>
        If you believe that information about you that is provided through the
        Product or Services is inaccurate, false or if you wish such information
        about you to be removed, please send us a request at{' '}
        <StyledLink href="mailto:info@arxena.com">info@arxena.com</StyledLink>
        .
      </StyledParagraph>

      <StyledHeading>Eligibility</StyledHeading>
      <StyledParagraph>
        Any use or access by anyone under the age of 13 is prohibited. By
        accepting the Terms, you declare that you are at least 13 years or older
        and that you have the legal capacity to enter this agreement, including
        consent of your parent or guardian (where applicable) to use the
        Services.
      </StyledParagraph>

      <StyledHeading>Changes to Terms of Service</StyledHeading>
      <StyledParagraph>
        We reserve the right (but we are under no obligation) to modify,
        correct, amend, enhance, improve, make any other changes to, suspend or
        discontinue, temporarily or permanently the Product, Services or any
        portion of which (the &quot;Changes&quot;) with or without notice with
        no liability, at any time and for any reason, including without
        limitation any Changes which may be done automatically for the purpose
        of improving, enhancing or de-bugging versions of the Product or aspects
        of the Services. We will notify you of any material change via the Site
        or Services (including without limitation by sending you an email
        notification) by any other form prior to those material changes becoming
        effective. Otherwise, any other, non-material change, will be effective
        upon the &quot;last updated&quot; date stated at the top of these Terms.
      </StyledParagraph>
      <StyledParagraph>
        Your continued use of the Product or Services, following any such
        revisions, constitutes your complete and irrevocable acceptance of such
        Changes. If you do not agree with the new/modified Terms, your sole
        remedy is to discontinue using the Product and the Services and cancel
        your registration. Each time you use a Arxena Product, you reaffirm your
        acceptance of the then-current Terms of Service. If you do not wish to
        be bound by these Terms, you may discontinue using Arxena Services.
      </StyledParagraph>

      <StyledHeading>Creating an Account</StyledHeading>
      <StyledParagraph>
        In order to fully use the Services, you must register and create an
        account. Creating your account can be done by providing specific details
        (e.g. full name; email address; etc.) through the Site. Alternately, a
        Arxena representative can create an account for new users.
      </StyledParagraph>
      <StyledParagraph>
        To learn more about our data collection practices and the specific types
        of data we may collect, use and disclose, please read our{' '}
        <StyledLink href="/legal/privacy">Privacy Policy</StyledLink> which is
        incorporated in these Terms by reference.
      </StyledParagraph>
      <StyledParagraph>
        You agree to keep your account credential secret and secure. You also
        agree to inform us immediately of any unauthorized use of your account.
        By accepting the Terms, you declare that you are responsible for all
        activities taken under your account. Once you create an account, you
        will automatically join to our mailing list. You can choose to remove
        your email address from that mailing list by choosing the
        &quot;unsubscribe&quot; link at the bottom of any email communication we
        send to you.
      </StyledParagraph>
      <StyledParagraph>
        We may cancel your access to the Services and terminate your account, at
        our sole consideration, at any time and for any reason, with or without
        notice to you. Upon any termination, discontinuation or cancellation of
        Services or your account, all provisions of these Terms which by their
        nature should survive will survive, including, without limitation,
        licenses and ownership provisions, warranty disclaimers, limitations of
        liability, indemnity, and dispute resolution provisions.
      </StyledParagraph>

      <StyledHeading>Free Trial</StyledHeading>
      <StyledParagraph>
        Your Free Trial includes the services as described in your free trial
        agreement. The term period and type of your free trial appears upon sign
        up to our services. Creating multiple accounts for the same user is
        strictly forbidden. Arxena reserves the right to charge your account for
        any use of additional accounts set up for the same user.
      </StyledParagraph>

      <StyledHeading>Payment and Fees</StyledHeading>
      <StyledParagraph>
        In order to enjoy the full scale of the Services that we offer, you will
        be required to pay the applicable fees assessed to your account for the
        purpose of obtaining credits. These credits which will enable you to
        obtain information regarding the org charts you seek. Each credit you
        purchase allows you to receive information which relates to a single org
        chart or another pre-defined package.
      </StyledParagraph>
      <StyledParagraph>
        We may offer you from time to time (but not obliged to), at our sole
        discretion, a version of limited credits for free. In addition, we may
        offer you free extra credits when you refer other users to our Product
        through our Services. Such free credits will be offered to you at our
        sole discretion and only as a gesture of good will and you acknowledge
        that we will not have any legal or commercial obligation to grant you
        such free credits.
      </StyledParagraph>
      <StyledParagraph>
        When using our Services through any of the Platforms which our Product
        may operate on, you acknowledge and agree that you (and not Arxena) are
        obliged to comply with the applicable terms of use and all associated
        policies and guidelines of such Platforms. If for any reason: (i) Arxena
        will not be able to provide you its Services through a specific
        Platform; or (ii) any Platform&apos;s terms of use shall require that
        you cease using our Product, deny your access to our Product when using
        the Platform or terminate your Platform&apos;s account, Arxena will not
        have any liability whatsoever and will not have any legal or commercial
        obligation to refund any paid fees made by you in connection with the
        Services. However, Arxena, at its sole discretion, may offer you other
        alternatives to use its Product (e.g. through other Platforms).
      </StyledParagraph>

      <StyledHeading>
        100% Satisfaction or Your Money Back Guarantee
      </StyledHeading>
      <StyledParagraph>
        Arxena offers a 100% satisfaction money back guarantee on our monthly
        plans listed on our site. Arxena will at its discretion, return 100% of
        your money back if you aren&apos;t satisfied with Arxena services.
      </StyledParagraph>

      <StyledHeading>Limitations</StyledHeading>
      <StyledParagraph>
        In order to qualify for the money back guarantee, you must have used no
        more than 5 org chart credits from your account. Using beyond this
        amount nullifies the guarantee and you may not be eligible for your
        money back. This guarantee is valid for 15 days from purchase date.
      </StyledParagraph>
      <StyledParagraph>
        By agreeing to our terms and conditions, you agree that you are limited
        to a refund on one occasion only, and you will not be eligible for
        another refund should you purchase Arxena services on any additional
        occasion. These terms also apply should you attempt to purchase Arxena
        services from an additionally registered account.
      </StyledParagraph>

      <StyledHeading>Custom, Annual and Enterprise Plans</StyledHeading>
      <StyledParagraph>
        We maintain no refund or cancellation policy of any paid fees.
      </StyledParagraph>

      <StyledHeading>Intellectual Property and License</StyledHeading>
      <StyledParagraph>
        Subject to the terms and conditions of these Terms, we hereby grant you
        a personal, limited, non-exclusive, non-transferable, non-assignable,
        fully revocable license to download, install the Product and use the
        Services.
      </StyledParagraph>
      <StyledParagraph>
        Except as provided in this license, you may not (i) copy, distribute,
        modify, translate, reverse engineer, decompile, disassemble, or create
        derivative works based on the Product or Services; (ii) Access to data
        not intended for you, such as logging into a server or an account which
        you are not authorized to access; (iii) Interfere with the
        Product&apos;s or Services&apos; operation (or any portion of them) in
        any manner, including, without limitation, by means of submitting a
        virus or malicious code of any type; (iv) Delete or modify any
        attributions, legal notices or other proprietary designations or labels
        on the Product or Services, or on any third party material contained or
        otherwise available therein; or (v) use any data in an abusive or
        illegal manner. Any right that is not explicitly provided to you under
        these Terms is expressly reserved by us.
      </StyledParagraph>
      <StyledParagraph>
        As between you and us, we are the sole owners of the Product and the
        Services, including without limitation, all copyrights, patents, patent
        applications or other inventions, trademarks, trade secrets, databases
        and other intellectual property rights thereto, including all titles and
        intellectual property rights in and to the Product, Services and
        respective content (including that of any third party website which may
        be linked to or viewed in connection with the Services). These Terms
        grant you no rights to use such content except as allowed by such third
        party.
      </StyledParagraph>
      <StyledParagraph>
        The Arxena name, logos, and other Arxena related properties are
        trademarks of Arxena. All other trademarks appearing on the Product or
        Services are trademarks of their respective owners.
      </StyledParagraph>

      <StyledHeading>Privacy</StyledHeading>
      <StyledParagraph>
        You acknowledge that to the extent you choose to use or access certain
        features of the Services you may be asked to submit or enable the
        transmission of certain personal information, which is required for the
        operability of our Services.
      </StyledParagraph>
      <StyledParagraph>
        At all times your information will be treated in accordance with our{' '}
        <StyledLink href="/legal/privacy">Privacy Policy</StyledLink>, which
        describes how we access, use, store and disclose your information when
        you use the Services, and is incorporated in these Terms by reference.
      </StyledParagraph>
      <StyledParagraph>
        You hereby grant us a worldwide, non-revocable, royalty-free,
        sub-licensable and transferable license to use information you submit to
        us as described in our Privacy Policy, operate them and constantly
        improve them, including for the purpose of introducing new features when
        they become available, to reproduce, distribute, make derivatives of it
        and use it in order to promote the Services.
      </StyledParagraph>
      <StyledParagraph>
        By accessing and using the Services, you agree and understand that we
        will use your information as set forth in our Privacy Policy, and you
        allow us to do so.
      </StyledParagraph>

      <StyledHeading>Maintenance and Support</StyledHeading>
      <StyledParagraph>
        We are aiming at providing our users with the best support for our
        Services and to constantly improve them. We created different tools to
        help our users address frequently asked questions and additional
        technical and general support issues. Also, we test frequent updates,
        maintenance, error shooting and additional means in order to improve the
        Services.
      </StyledParagraph>
      <StyledParagraph>
        However, we do not undertake to keep operate any of the above, and we
        reserve the right to change, reduce, limit or terminate our maintenance
        and support efforts.
      </StyledParagraph>
      <StyledParagraph>
        You may use the Services solely for your or your employer&apos;s lawful
        internal personal or business purposes. You may not sell, resell,
        license, sublicense, distribute, make available, rent, or lease the
        Services, or include any portion of the Services in a service bureau or
        outsourcing offering.
      </StyledParagraph>
      <StyledParagraph>
        You shall use our Services in complete accordance with the Terms, as
        amended from time to time, and only for the purposes stipulated in the
        Terms.
      </StyledParagraph>
      <StyledParagraph>
        You represent and warrant that all information and content that you
        submit upon the sign-in process (including information submitted from
        your social network account, if applicable) and all other content which
        is shared by you when using our Services, is accurate and truthful and
        that you will promptly update any information or content provided by you
        that subsequently becomes inaccurate, incomplete, misleading or false.
      </StyledParagraph>
      <StyledParagraph>
        By using the Services with respect to content which is uploaded or used
        by you (&quot;Content&quot;), you affirm, represent, and warrant that:
      </StyledParagraph>
      <StyledList>
        <li>
          you own or have the necessary licenses, rights, consents, and
          permissions to use and authorize us to use all patent, trademark,
          trade secret, copyright or other proprietary rights in and to your
          Content in the manner contemplated by the Services and these Terms;
        </li>
        <li>
          the Content does not violate any applicable laws, including but not
          limited to applicable local laws and privacy and data collection laws.
        </li>
      </StyledList>
      <StyledParagraph>
        You grant the Company a worldwide, non-exclusive, perpetual,
        irrevocable, royalty-free, sub-licensable and transferable license to
        use and store your information and Content in connection with the
        Services.
      </StyledParagraph>
      <StyledParagraph>
        You acknowledge that any unsolicited materials submitted or sent to us
        will be deemed to be not confidential or secret. By submitting or
        sending information or other material to us or through the Site or
        Services you: (i) warrant that you have all rights of any kind to the
        material and that to the best of your knowledge no other party has any
        rights to the material; and (ii) grant us an unrestricted, perpetual,
        irrevocable license to use, reproduce, display, perform, modify,
        transmit and distribute the material, and you further agree that Arxena
        is free to use any ideas, know-how, concepts or techniques you send us
        for any purpose, without any compensation to you or any other person.
      </StyledParagraph>
      <StyledParagraph>
        You acknowledge that you are responsible for any information or Content
        that you submit or transmit through the Services and any other
        communications options available by us, including your responsibility as
        to the privacy, legality, reliability, appropriateness, originality, and
        copyright of any such information and Content, whether publicly posted
        or privately transmitted.
      </StyledParagraph>
      <StyledParagraph>
        You acknowledge that in order to use the Services, you must use WiFi or
        receive data connectivity services from your service provider. The cost
        of the WiFi or data connectivity service may vary among service
        providers. It is your responsibility to review such costs and to
        determine whether you wish to bear such costs or not. In particular, you
        further acknowledge that the cost of such data connectivity service may
        rise significantly when roaming internationally. Therefore, you are
        advised to consider the cost of using the Services, depending on your
        location at any particular time.
      </StyledParagraph>

      <StyledHeading>Limitation of Use</StyledHeading>
      <StyledParagraph>
        You may not use the Services in any manner that is or may be found by
        us, at our sole discretion as:
      </StyledParagraph>
      <StyledUnorderedList>
        <li>violating or infringing in any way upon the rights of others;</li>
        <li>
          unlawful, threatening, abusive, defamatory, invasive of privacy or
          publicity rights, or otherwise objectionable;
        </li>
        <li>
          encouraging conduct that would constitute a criminal or civil offense;
        </li>
        <li>giving rise to civil liability;</li>
        <li>
          collect content or information, or otherwise access the Services using
          any automated means (such as bots or scrapers) without our prior
          permission;
        </li>
        <li>
          access Arxena servers and Services through unauthorized means, such as
          unlicensed software clients;
        </li>
        <li>
          violates any applicable local, state, federal or international law,
          ordinance including any regulations requirements, procedures or
          policies in force from time to time, or any right of any third party,
          including without limitation, any right of privacy or publicity.
        </li>
      </StyledUnorderedList>
      <StyledParagraph>
        Disruption: You may not use the Services in any manner that could
        disable, overburden, damage, or impair the Services, or interfere with
        any other party&apos;s use and enjoyment of the Services; including by
        (a) uploading or otherwise disseminating any virus, adware, spyware,
        worm or other malicious code, or (b) interfering with or disrupting any
        network, equipment, or server connected to or used to provide any of the
        services, or violating any regulation, policy, or procedure of any
        network, equipment, or server.
      </StyledParagraph>
      <StyledParagraph>
        You may not impersonate another person or entity, or misrepresent your
        affiliation with a person or entity when using the services; You may not
        use or attempt to use another&apos;s account or personal information.
        You may not attempt to gain unauthorized access to data or the Services,
        or the computer or mobile systems or networks connected to the Services,
        through hacking password mining or any other means; Otherwise violating
        these Terms or creating liability for us.
      </StyledParagraph>
      <StyledParagraph>
        You may not use the Services to determine a consumer&apos;s eligibility
        for credit or insurance for personal, family or household purposes,
        employment or a government license or benefit or for any other purpose
        governed by the FCRA (Fair Credit Reporting Act).
      </StyledParagraph>
      <StyledParagraph>
        You may not undertake any conduct that, in our judgment, restricts or
        inhibits any other user from using or enjoying the Services.
      </StyledParagraph>

      <StyledHeading>Termination</StyledHeading>
      <StyledParagraph>
        We reserve the right to terminate your access to the Product or Services
        for any reason, including, without limitation, if we have good reason to
        believe your use to be unacceptable, or in the event of any breach by
        you of the Terms (either directly or through breach of any other terms
        and conditions or operating rules applicable to you). We may, but shall
        be under no obligation to, provide you a warning prior to termination of
        your use of the Product or Services.
      </StyledParagraph>
      <StyledParagraph>
        All provisions which according to their nature shall survive in order to
        give effect to their meaning, shall survive any expiration or
        termination of this agreement, including without limitation all of your
        representations, warranties and indemnification obligations.
      </StyledParagraph>

      <StyledHeading>Disclaimer of Warranty</StyledHeading>
      <StyledParagraph>
        YOUR USE OF THE PRODUCT OR SERVICES IS AT YOUR SOLE RISK AND
        RESPONSIBILITY. Arxena SERVICES ARE PROVIDED &quot;AS IS&quot; AND
        &quot;AS AVAILABLE&quot; FOR YOUR USE, WITHOUT WARRANTIES OF ANY KIND,
        EITHER EXPRESS OR IMPLIED, UNLESS SUCH WARRANTIES ARE LEGALLY INCAPABLE
        OF EXCLUSION. WITHOUT LIMITATION OF THE FOREGOING, THE COMPANY AND ITS
        AFFILIATES, OFFICERS AND VENDORS SPECIFICALLY DISCLAIM ANY AND ALL
        WARRANTIES, INCLUDING, BUT NOT LIMITED TO: (I) ANY WARRANTIES CONCERNING
        THE AVAILABILITY, ACCURACY, SECURITY, USEFULNESS, INTEROPERABILITY, OR
        CONTENT OF THE SERVICES; AND (II) ANY WARRANTIES OF TITLE, WARRANTY OF
        NON-INFRINGEMENT, WARRANTIES OF MERCHANTABILITY OR FITNESS FOR A
        PARTICULAR PURPOSE. Arxena PARTIES DO NOT WARRANT THAT THE FUNCTIONS
        CONTAINED IN THE PRODUCT OR SERVICES WILL MEET YOUR REQUIREMENTS OR THAT
        THE OPERATION OF THE PRODUCT OR SERVICES WILL BE UNINTERRUPTED OR
        ERROR-FREE, OR THAT DEFECTS IN THE SERVICES WILL BE CORRECTED. Arxena
        PARTIES DO NOT WARRANT OR MAKE ANY REPRESENTATIONS REGARDING THE USE OR
        THE RESULTS OF THE USE OF THE PRODUCT OR SERVICES OR RELATED
        DOCUMENTATION IN TERMS OF THEIR CORRECTNESS, ACCURACY, RELIABILITY OR
        OTHERWISE. WE PROVIDE THE SERVICES ON A COMMERCIALLY REASONABLE BASIS
        AND DO NOT GUARANTEE THAT USERS WILL BE ABLE TO ACCESS OR USE Arxena
        SERVICES AT TIMES OR LOCATIONS OF THEIR CHOOSING, OR THAT WE WILL HAVE
        ADEQUATE CAPACITY FOR THE SERVICES AS A WHOLE.
      </StyledParagraph>
      <StyledParagraph>
        This disclaimer of liability applies to any damages or injury caused by
        the Services, including without limitation as a result of any failure of
        performance, error, omission, interruption, deletion, defect, delay in
        operation or transmission, computer virus, communication line failure,
        theft or destruction or unauthorized access to, alteration of, or use of
        record, whether for breach of contract, tort, negligence, or under any
        other cause of action. Arxena does not warrant or guarantee that all
        versions shall be provided with similar grades and levels of service,
        features, functionality and the ability to use the service.
      </StyledParagraph>
      <StyledParagraph>
        Arxena does not warrant or guarantee that (i) any program or portion of
        the Services will be free of infection by viruses, worms, trojan horses
        or anything else manifesting contaminating or destructive properties; or
        (ii) the functions or services performed by the Product will be
        uninterrupted or error-free or that defects in the service will be
        corrected.
      </StyledParagraph>
      <StyledParagraph>
        It is your sole responsibility to isolate the information, execute
        anti-contamination software and otherwise take steps to ensure that
        software or other information obtained from the Services or other users,
        if contaminated or infected, will not damage your information or system.
      </StyledParagraph>

      <StyledHeading>No Liability</StyledHeading>
      <StyledParagraph>
        IN NO EVENT WILL Arxena, ITS OFFICERS, DIRECTORS, EMPLOYEES, PARENTS,
        AFFILIATES, SUCCESSORS OR ASSIGNS (TOGETHER &quot;Arxena PARTIES&quot;),
        BE LIABLE TO ANY PARTY (1) FOR ANY INDIRECT, DIRECT, SPECIAL, PUNITIVE,
        INCIDENTAL, EXEMPLARY OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
        LIMITED TO, DAMAGES FOR LOSS OF BUSINESS PROFITS, BUSINESS INTERRUPTION,
        LOSS OF PROGRAMS OR DATA, LOSS OF GOODWILL, OR INFORMATION, WORK
        STOPPAGE, COMPUTER FAILURE OR MALFUNCTION, OR ANY OTHER COMMERCIAL
        DAMAGES OR LOSSES AND THE LIKE), OR ANY OTHER DAMAGES ARISING IN ANY WAY
        OUT OF THE AVAILABILITY, USE, RELIANCE ON, OR INABILITY TO USE THE
        PRODUCT OR SERVICES, EVEN IF Arxena PARTIES SHALL HAVE BEEN ADVISED OF
        THE POSSIBILITY OF SUCH DAMAGES, AND REGARDLESS OF THE FORM OF ACTION,
        WHETHER IN CONTRACT, TORT, OR OTHERWISE; OR (2) FOR ANY CLAIM
        ATTRIBUTABLE TO ERRORS, OMISSIONS, OR OTHER INACCURACIES IN, OR
        DESTRUCTIVE PROPERTIES OF ANY OTHER SOFTWARE OR OTHER CONTENT INCLUDED
        AS PART OF THE PRODUCT OR SERVICES.
      </StyledParagraph>
      <StyledParagraph>
        Without derogating any of the above, If for any reason: (i) Arxena will
        not be able to provide you its Services through a specific Platform; or
        if (ii) any Platform&apos;s terms of use shall require that you cease
        using our Product, deny your access to our Product when using the
        Platform or terminate your Platform&apos;s account, Arxena Parties will
        not be liable to any damages, as stipulated in this section.
      </StyledParagraph>
      <StyledParagraph>
        Because some states or jurisdictions do not allow the exclusion or the
        limitation of liability for consequential or incidental damages, in such
        states or jurisdictions, Arxena Parties&apos; liability shall be limited
        to the extent permitted by applicable law. Arxena Parties&apos; entire
        liability and your exclusive remedy with respect to any dispute with
        Arxena Parties (including without limitation your use of the Product or
        Services) is to discontinue your use of Arxena Services and request for
        removal of your data as described in detail under the Privacy Policy. We
        do not endorse, warrant or guarantee any product or service offered
        through the Services and will not be a party to or in any way be
        responsible for monitoring any transaction between you and third-party
        providers of such products or services.
      </StyledParagraph>

      <StyledHeading>Indemnification</StyledHeading>
      <StyledParagraph>
        You agree to defend, indemnify and hold harmless Arxena, its directors,
        employees and agents, from and against any and all claims, damages,
        obligations, losses, liabilities, costs or debt, and expenses (including
        but not limited to attorney&apos;s fees) arising from: (i) your use of
        and access to the Services; (ii) your violation of any term of these
        Terms; (iii) your violation of any third party right, including without
        limitation any copyright, property, or privacy right; or (iv) any claim
        that one of your act or omission caused damage to a third party.
      </StyledParagraph>
      <StyledParagraph>
        Under no circumstances whatsoever will the Company be liable in any way
        for any of the Content (including your contact) you share or publish,
        including, without limitation, for any infringement of third
        party&apos;s right, loss or damage of any kind incurred as a result of
        the use or display or performance of any third party content
        transmitted, displayed or otherwise made available through the Services.
      </StyledParagraph>

      <StyledHeading>Copyright Infringements</StyledHeading>
      <StyledParagraph>
        Notification: we respect the intellectual property of others, and we ask
        you to do the same. We may, in appropriate circumstances and at our
        discretion, terminate the Services (or a portion of them) and/or access
        to the Site or Services to users who infringe the intellectual property
        rights of others. If you believe that your date or work is the subject
        of copyright infringement and/or a trademark infringement and appears on
        the Site or Services, please send us a proper notification or request
        for removal at{' '}
        <StyledLink href="mailto:contact@arxena.com">
          contact@arxena.com
        </StyledLink>{' '}
        together with the following information:
      </StyledParagraph>
      <StyledList>
        <li>
          A physical or electronic signature of a person authorized to act on
          behalf of the owner of an exclusive right that is allegedly infringed.
        </li>
        <li>
          Identification of the copyrighted work claimed to have been infringed,
          or if multiple copyrighted works at a single online site are covered
          by a single notification, a representative list of such works at that
          site.
        </li>
        <li>
          Identification of the material that is claimed to be infringing or to
          be the subject of infringing activity and that is to be removed or
          access to which is to be disabled, and information reasonably
          sufficient to permit us to locate the material.
        </li>
        <li>
          Information reasonably sufficient to permit us to contact the
          complaining party, such as an address, telephone number, and, if
          available, an electronic mail address at which the complaining party
          may be contacted.
        </li>
        <li>
          A statement that the complaining party has a good faith belief that
          use of the material in the manner complained of is not authorized by
          the copyright owner, its agent, or the law.
        </li>
        <li>
          A statement that the information in the notification is accurate, and
          under penalty of perjury, that the complaining party is authorized to
          act on behalf of the owner of an exclusive right that is allegedly
          infringed.
        </li>
      </StyledList>
      <StyledParagraph>
        Counter-Notification: If you elect to send us a counter-notice, to be
        effective it must be a written communication provided to our designated
        agent that includes substantially the following (please consult your
        legal counsel to confirm these requirements):
      </StyledParagraph>
      <StyledList>
        <li>A physical or electronic signature of the user.</li>
        <li>
          Identification of the material that has been removed or to which
          access has been disabled and the location at which the material
          appeared before it was removed or access to it was disabled.
        </li>
        <li>
          A statement under penalty of perjury that the user has a good faith
          belief that the material was removed or disabled as a result of
          mistake or misidentification of the material to be removed or
          disabled.
        </li>
        <li>The user&apos;s name, address, and telephone number.</li>
      </StyledList>
      <StyledParagraph>
        Only the intellectual property rights owner may report potentially
        infringing items through our reporting system as set forth above. If you
        are not the intellectual property rights owner, you should contact the
        intellectual property rights owner and they can choose whether to use
        the procedures set forth in these Terms.
      </StyledParagraph>

      <StyledHeading>General Provisions</StyledHeading>
      <StyledParagraph>
        Jurisdiction and Governmental Law – These Terms, as well as all disputes
        arising out of or in connection with these Terms, shall be governed by
        and construed in accordance with the laws of the State of New York,
        regardless of choice of law rules or principles. Any dispute arising out
        of or in connection with these Terms, or in future agreements resulting
        therefrom, shall be exclusively resolved before the competent court in
        New York.
      </StyledParagraph>
      <StyledParagraph>
        International Use – Recognizing the global nature of the Internet, you
        agree to comply with all local rules regarding online conduct and
        privacy. Specifically, you agree to comply with all applicable laws
        regarding privacy and privacy invasion which apply in the country in
        which you reside.
      </StyledParagraph>
      <StyledParagraph>
        No Support by Arxena – You understand that your use of the Product and
        Services is at your own risk and that we may – but under no obligation
        to – provide support or assistance other than the information posted on
        the Site.
      </StyledParagraph>
      <StyledParagraph>
        Electronic Delivery Policy – Arxena, as an online business, transacts
        with its users electronically. When you sign up for any of the Services,
        you consent to receive electronic communication from us including
        without limitation any privacy or other notices, agreements,
        disclosures, reports, documents, communications, or other records
        (collectively, &quot;Notices&quot;). You agree that generally, we can
        send you electronic notices in either or both of the following ways: (i)
        to the e-mail address that you provided to us during registration or
        (ii) on a welcoming screen or top page of the relevant Arxena Product or
        Service. The delivery of any Notices from Arxena is effective when sent
        by us, regardless of whether you read the Notice when you receive it or
        whether you actually receive the delivery.
      </StyledParagraph>
      <StyledParagraph>
        Entire Agreement – These Terms (together with the Privacy Policy and
        with any other incorporated policy) constitute the entire understanding
        between us and you with respect to the subject matter hereof. There are
        no understandings, agreements, conditions or representations, oral or
        written, express or implied, with reference to the subject matter hereof
        that are not merged herein, expressly referenced herein, or superseded
        hereby.
      </StyledParagraph>
      <StyledParagraph>
        No Waiver – The failure or delay of us to exercise or enforce any rights
        or provision of these Terms does not constitute a waiver of such right
        or provision.
      </StyledParagraph>
      <StyledParagraph>
        Provisions unenforceable or invalid – Should any part of these Terms be
        held invalid by any court or tribunal, such invalidity shall not affect
        the validity of any remaining part, which will remain in full force and
        effect as if the Terms had been executed without that part having been
        held to be invalid.
      </StyledParagraph>
      <StyledParagraph>
        Assignment – You shall not transfer, assign, sublicense nor pledge in
        any manner whatsoever, any of your rights or obligations under this
        agreement. We may transfer, assign, sublicense or pledge in any manner
        whatsoever, any of our rights and obligations under this agreement to a
        subsidiary, affiliate, successor thereof or to any third party
        whatsoever.
      </StyledParagraph>

      <StyledHeading>Contact Us</StyledHeading>
      <StyledParagraph>
        If you have questions or concerns regarding these Terms, you should
        first contact us by email at{' '}
        <StyledLink href={`mailto:${COMPANY_INFO.email}`}>
          {COMPANY_INFO.email}
        </StyledLink>
        .
      </StyledParagraph>
      <StyledAddressSection>
        <StyledCompanyName>{COMPANY_INFO.name}</StyledCompanyName>
        <StyledOfficeBlock>
          <StyledOfficeRegion>United States</StyledOfficeRegion>
          <StyledOfficeLines>
            651 N Broad St, Suite 206
            <br />
            Middletown, New Castle, DE 19709
          </StyledOfficeLines>
        </StyledOfficeBlock>
        <StyledOfficeBlock>
          <StyledOfficeRegion>India</StyledOfficeRegion>
          <StyledOfficeLines>
            WeWork NESCO, Building 4, North Wing
            <br />
            Nesco IT Park, Goregaon East
            <br />
            Mumbai - 400063
          </StyledOfficeLines>
        </StyledOfficeBlock>
        <StyledAddressEmailLine>
          Email:{' '}
          <StyledLink href={`mailto:${COMPANY_INFO.email}`}>
            {COMPANY_INFO.email}
          </StyledLink>
        </StyledAddressEmailLine>
      </StyledAddressSection>
    </StyledSection>
  );
};
